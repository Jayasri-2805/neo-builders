import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Power, X, Filter } from 'lucide-react';
import * as Icons from 'lucide-react';
import { mastersConfig, sidebarGroups } from '../../config/mastersConfig';
import { createMasterApi, purchaseOrderApi as sharedPurchaseOrderApi } from '../../api/masterApi';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPath } from '../../utils/objectPath';
import MasterFormModal from '../../components/masters/MasterFormModal';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import MasterViewModal from '../../components/masters/MasterViewModal';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';

export default function MasterPage() {
  const { slug } = useParams();
  const location = useLocation();
  const config = mastersConfig[slug];
  const toast = useToast();
  const confirm = useConfirm();
  const [portalTarget, setPortalTarget] = useState(null);
  const api = useMemo(() => createMasterApi(config.endpoint), [config.endpoint]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [viewingRow, setViewingRow] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const purchaseOrderApi = useMemo(() => sharedPurchaseOrderApi, []);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-actions-target'));
  }, []);

  const handleCreatePurchaseOrder = async (rowParam) => {
    let row = rowParam;
    if (actionLoading) return;
    if (row.indentStatus !== 'Approved') {
      toast.error('Only approved purchase indents can be converted to a purchase order.');
      return;
    }
    if (String(row.pmPdApproval).toLowerCase() !== 'approved') {
      toast.error('Purchase orders can only be generated after PM/PD approval.');
      return;
    }

    try {
      setActionLoading(true);

      // Reload the latest indent from server to ensure we have up-to-date supplier info
      try {
        const latestRes = await api.getOne(row._id);
        if (latestRes?.data?.data) row = latestRes.data.data;
      } catch (e) {
        // ignore reload errors
      }

      const existing = await purchaseOrderApi.list({ purchaseIndentId: row._id, limit: 1 });
      if (Array.isArray(existing.data.data) && existing.data.data.length > 0) {
        toast.error('A purchase order already exists for this indent.');
        return;
      }

      let supplierId = row.supplierId ? (row.supplierId._id || row.supplierId) : null;
      if (!supplierId) {
        // Try to resolve supplier from related material request -> awarded quotation
        try {
          const materialRequestApi = createMasterApi('material-requests');
          const quotationApi = createMasterApi('quotations');
          const mrRes = await materialRequestApi.list({ indentNo: row.indentNo, limit: 1 });
          const mr = Array.isArray(mrRes.data?.data) && mrRes.data.data.length ? mrRes.data.data[0] : null;
          if (mr) {
            // preferred: awardedQuotationId set on material request
            if (mr.awardedQuotationId) {
              try {
                const qRes = await quotationApi.getOne(mr.awardedQuotationId);
                const q = qRes.data?.data || qRes.data;
                if (q && q.supplierId) supplierId = q.supplierId._id || q.supplierId;
              } catch (e) {
                // ignore
              }
            }

            // fallback: load any quotation for this material request
            if (!supplierId) {
              try {
                const qList = await quotationApi.list({ materialRequestId: mr._id, limit: 1 });
                const qItem = Array.isArray(qList.data?.data) && qList.data.data.length ? qList.data.data[0] : null;
                if (qItem && qItem.supplierId) supplierId = qItem.supplierId._id || qItem.supplierId;
              } catch (e) {}
            }
          }
        } catch (err) {
          // ignore resolution errors
          console.warn('Failed to auto-resolve supplier for PO', err);
        }

        if (!supplierId) {
          // Do not block creation — proceed and let the server attempt to resolve supplier from the indent/quotations
        }

        // persist supplierId to the indent so subsequent actions see it
        try {
          await api.update(row._id, { supplierId });
          // reload row after update
          const up = await api.getOne(row._id);
          if (up?.data?.data) row = up.data.data;
        } catch (e) {
          console.warn('Failed to persist supplierId to indent', e);
        }
      }

      const payload = {
        purchaseIndentId: row._id,
        indentNo: row.indentNo || '',
        requestNo: row.requestNo || row.indentNo || '',
        siteId: row.siteId?._id || row.siteId,
        supplierId: supplierId,
        requestedByName: row.raisedByName || user?.name || 'Unknown',
        requestDate: new Date().toISOString().split('T')[0],
        totalAmount: row.totalAmount || 0,
        indentSnapshot: row,
      };

      const createRes = await purchaseOrderApi.create(payload);
      const createdOrder = createRes.data?.data;

      if (!createdOrder || !createdOrder._id) {
        throw new Error('Purchase order could not be created.');
      }

      try {
        await api.update(row._id, {
          indentStatus: 'Converted',
          convertedAt: new Date().toISOString(),
        });
        toast.success('Purchase order created successfully.');
        fetchData();
        // show created PO to user so they can verify replicated indent data
        setViewingRow(createdOrder);
      } catch (err) {
        await purchaseOrderApi.remove(createdOrder._id).catch(() => {});
        throw err;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create purchase order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPurchaseIndent = async (row) => {
    if (actionLoading) return;
    if (row.indentStatus === 'Converted') {
      toast.error('A converted purchase indent cannot be rejected after a purchase order has been created.');
      return;
    }
    const confirmed = await confirm({
      title: 'Reject Purchase Indent',
      message: 'Rejecting this indent will move it to Rejected Purchases. Do you want to continue?',
      confirmText: 'Reject',
      danger: true,
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.update(row._id, {
        indentStatus: 'Rejected',
        rejectionReason: 'Rejected via purchase workflow',
        rejectedBy: user?.name || 'System',
        rejectedDate: new Date().toISOString(),
        rejectionSnapshot: row,
      });
      toast.success('Purchase indent rejected successfully.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reject purchase indent.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const handleFilterText = (e) => {
      const val = e.detail || '';
      setSearch(val);
      setPage(1);
      setShowSearch(Boolean(val));
    };
    window.addEventListener('filter-text', handleFilterText);
    return () => window.removeEventListener('filter-text', handleFilterText);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      // include non-empty filters
      Object.keys(filters || {}).forEach(k => {
        const v = filters[k];
        if (v && v !== 'All') params[k] = v;
      });
      const { data } = await api.list(params);
      setRows(data.data || []);
      setTotal(data.meta?.total ?? (data.data || []).length);
    } catch (err) {
      console.error('Fetch data error', err);
      toast.error(`Failed to load ${config.plural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [api, page, pageSize, search, config.plural, toast, filters]);

  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [slug]);

  // Load filter options for select fields (fetch referenced masters)
  useEffect(() => {
    let mounted = true;
    const loadOptions = async () => {
      if (!config || !config.fields) return;
      const opts = {};
      const promises = config.fields.map(async (f) => {
        if (f.refEndpoint) {
          try {
            const apiClient = createMasterApi(f.refEndpoint);
            const res = await apiClient.listAll();
            if (res.data && Array.isArray(res.data.data)) {
              const items = res.data.data.map(it => ({ label: it[f.refLabel] || it.name || it.siteName || it.priorityName || it.productType || it.categoryName || it.uomName, value: it._id }));
              opts[f.name] = items;
            }
          } catch (err) {
            console.error('Failed to load options for', f.refEndpoint, err);
          }
        } else if (Array.isArray(f.options) && f.options.length) {
          opts[f.name] = f.options.map(o => ({ label: o.label, value: o.value }));
        }
      });
      await Promise.all(promises);
      if (mounted) setFilterOptions(opts);
    };
    loadOptions();
    return () => { mounted = false; };
  }, [config]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: `Delete ${config.title}`,
      message: `Are you sure you want to delete this ${config.title.toLowerCase()}? This action cannot be undone.`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await api.remove(row._id);
      toast.success(`${config.title} deleted successfully`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const handleToggleStatus = async (row) => {
    try {
      const nextStatus = row.status === 'Active' ? 'Inactive' : 'Active';
      await api.updateStatus(row._id, nextStatus);
      toast.success('Status updated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const renderCell = (row, col) => {
    if (col.type === 'action') return null;
    const value = getPath(row, col.key);

    if (col.key === 'priorityId') {
      const label = value?.priorityName || '—';
      if (label === '—') return '—';
      return (
        <span className={`priority-badge priority-${String(label).toLowerCase()}`}>
          <Icons.ArrowUp size={10} />
          {label}
        </span>
      );
    }

    if (col.key === 'type') {
      const type = String(value || '');
      if (type === 'Urgent') return <span className="urgent-text">{type}</span>;
      if (type === 'Normal') return <span className="normal-text">{type}</span>;
    }

    if (['pmPdApproval', 'adminApproval', 'indentStatus'].includes(col.key)) {
      const status = value || 'Pending';
      let icon = <Icons.Clock size={10} />;
      let background = 'rgba(249,115,22,0.12)';
      let color = '#92400e';

      if (String(status).toLowerCase() === 'approved') {
        icon = <Icons.CheckCircle size={10} />;
        background = 'rgba(16,185,129,0.14)';
        color = '#065f46';
      } else if (String(status).toLowerCase() === 'rejected') {
        icon = <Icons.XCircle size={12} />;
        background = 'rgba(239,68,68,0.12)';
        color = '#991b1b';
      }

      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          background,
          color,
          fontWeight: 600,
          fontSize: '0.68rem'
        }}>
          {icon}
          {status}
        </span>
      );
    }

    if (col.type === 'ref') {
      if (!value) return '—';
      return value.priorityName || value.productType || value.departmentName || value.designationName || value.categoryName || value.uomName ||
        value.siteName || value.siteType || value.vehicleType || value.name || value.empName || '—';
    }
    if (value === undefined || value === null || value === '') return '—';
    return String(value);
  };

  const showStatusBadge = config.showStatusBadge !== false;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      {portalTarget && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          {showSearch ? (
            <div className="search-input header-search" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <Search size={15} />
              <input
                autoFocus
                placeholder={`Search ${config.plural.toLowerCase()}…`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: '150px' }}
              />
              <button 
                onClick={() => { setShowSearch(false); setSearch(''); setPage(1); fetchData(); }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button 
              className="icon-btn" 
              onClick={() => setShowSearch(true)}
              title="Search"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <Search size={15} />
            </button>
          )}

          {slug === 'purchase-indents' && (
            <button
              className="icon-btn"
              onClick={() => setShowFilters(prev => {
                const next = !prev;
                if (!next) setFilters({});
                return next;
              })}
              title="Filters"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <Filter size={15} />
            </button>
          )}

          {slug !== 'purchase-indents' && (
            <button 
              className="btn btn-primary" 
              onClick={() => { setEditingRow(null); setModalOpen(true); }}
              title={`Add ${config.title}`}
              style={{ padding: '8px', borderRadius: '6px' }}
            >
              <Plus size={16} />
            </button>
          )}
        </div>,
        portalTarget
      )}



      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={`No ${config.plural.toLowerCase()} yet`}
            description={`Get started by adding your first ${config.title.toLowerCase()}.`}
            action={
              <button className="btn btn-primary" onClick={() => { setEditingRow(null); setModalOpen(true); }}>
                <Plus size={16} /> Add {config.title}
              </button>
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S. No</th>
                  {config.columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  {showStatusBadge && <th style={{ width: '120px' }}>Status</th>}
                  <th className="col-actions">Actions</th>
                </tr>
                {slug === 'purchase-indents' && showFilters && (
                  <tr className="filters-row">
                    <th />
                    {config.columns.map((col) => (
                      <th key={col.key}>
                        {(() => {
                          const fld = config.fields && config.fields.find(f => f.name === col.key);
                          const opts = filterOptions[col.key] || (fld && fld.options ? fld.options.map(o => ({ label: o.label, value: o.value })) : []);
                          if (opts && opts.length) {
                            return (
                              <select
                                className="table-filter"
                                value={filters[col.key] || 'All'}
                                onChange={(e) => { setFilters(prev => ({ ...prev, [col.key]: e.target.value })); setPage(1); }}
                              >
                                <option value="All">All</option>
                                {opts.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            );
                          }
                          // fallback simple select
                          return (
                            <select className="table-filter" value={filters[col.key] || 'All'} onChange={(e) => { setFilters(prev => ({ ...prev, [col.key]: e.target.value })); setPage(1); }}>
                              <option value="All">All</option>
                            </select>
                          );
                        })()}
                      </th>
                    ))}
                    {showStatusBadge ? <th /> : null}
                    <th />
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row._id}>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    {config.columns.map((col) => (
                      col.type === 'action' ? (
                        <td key={col.key} data-label={col.label}>
                          {slug === 'purchase-indents' ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem' }}
                                disabled={actionLoading || row.indentStatus !== 'Approved' || String(row.pmPdApproval).toLowerCase() !== 'approved'}
                                onClick={() => handleCreatePurchaseOrder(row)}
                                title={row.indentStatus !== 'Approved' ? 'Purchase indent must be approved to generate PO' : row.pmPdApproval !== 'Approved' ? 'PM/PD approval is required to generate PO' : 'Create purchase order'}
                              >
                                Create PO
                              </button>
                              {(row.indentStatus !== 'Rejected' && row.indentStatus !== 'Converted') && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem' }}
                                  disabled={actionLoading}
                                  onClick={() => handleRejectPurchaseIndent(row)}
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          ) : (
                            <button className="btn btn-success" onClick={() => handleQuoteClick(row)}>
                              Quote
                            </button>
                          )}
                        </td>
                      ) : (
                        <td key={col.key} data-label={col.label}>{renderCell(row, col)}</td>
                      )
                    ))}
                    {showStatusBadge && (
                      <td data-label="Status">
                        <button className="badge-btn" onClick={() => handleToggleStatus(row)}>
                          <StatusBadge status={row.status} />
                        </button>
                      </td>
                    )}
                    <td className="col-actions" data-label="Actions">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="icon-btn" onClick={() => setViewingRow(row)} aria-label="View">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        <button className="icon-btn" onClick={() => { setEditingRow(row); setModalOpen(true); }} aria-label="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn" onClick={() => handleToggleStatus(row)} aria-label="Toggle status">
                          <Power size={15} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDelete(row)} aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />

      {modalOpen && (
        <ErrorBoundary>
          <MasterFormModal
            config={config}
            initialData={editingRow}
            toast={toast}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); fetchData(); }}
          />
        </ErrorBoundary>
      )}

      {viewingRow && (
        <MasterViewModal
          config={config}
          data={viewingRow}
          onClose={() => setViewingRow(null)}
        />
      )}
    </div>
  );
}
