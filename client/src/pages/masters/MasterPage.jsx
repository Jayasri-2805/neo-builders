import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Power, X } from 'lucide-react';
import * as Icons from 'lucide-react';
import { mastersConfig, sidebarGroups } from '../../config/mastersConfig';
import { createMasterApi } from '../../api/masterApi';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
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

  useEffect(() => {
    setPortalTarget(document.getElementById('header-actions-target'));
  }, []);

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
  const navigate = useNavigate();

  const handleQuoteClick = (row) => {
    navigate(`/requests?requestId=${row._id}&quotation=true`);
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
    if (col.type === 'ref') {
      if (!value) return '—';
      return value.productType || value.departmentName || value.designationName || value.categoryName || value.uomName ||
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

          <button 
            className="btn btn-primary" 
            onClick={() => { setEditingRow(null); setModalOpen(true); }}
            title={`Add ${config.title}`}
            style={{ padding: '8px', borderRadius: '6px' }}
          >
            <Plus size={16} />
          </button>
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
                {slug === 'purchase-indents' && (
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
                          <button className="btn btn-success" onClick={() => handleQuoteClick(row)}>
                            Quote
                          </button>
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
