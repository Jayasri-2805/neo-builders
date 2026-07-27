import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Eye, Pencil, Trash2, Filter, CheckCircle, Clock, ArrowUp } from 'lucide-react';
import { createMasterApi } from '../../api/masterApi';
import MasterViewModal from '../../components/masters/MasterViewModal';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

const purchaseIndentApi = createMasterApi('purchase-indents');

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function renderRefLabel(value) {
  return value?.productType || value?.priorityName || value?.siteType || value?.siteName || '—';
}

function renderPriorityBadge(priorityName) {
  if (!priorityName) return '—';
  return (
    <span className={`priority-badge priority-${String(priorityName).toLowerCase()}`}>
      <ArrowUp size={10} />
      {priorityName}
    </span>
  );
}

function renderApprovalBadge(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  let icon = <Clock size={10} />;
  let background = 'rgba(249,115,22,0.12)';
  let color = '#92400e';

  if (normalized === 'approved') {
    icon = <CheckCircle size={10} />;
    background = 'rgba(16,185,129,0.14)';
    color = '#065f46';
  } else if (normalized === 'rejected') {
    icon = <X size={12} />;
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
      {status || 'Pending'}
    </span>
  );
}

export default function RejectedPurchasePage() {
  const [orders, setOrders] = useState([]);
  const [portalTarget, setPortalTarget] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState(null);

  const toast = useToast();
  const confirm = useConfirm();

  const handleViewOrder = (order) => setViewingOrder(order);

  const handleDeleteOrder = async (order) => {
    const confirmed = await confirm({
      title: 'Delete Rejected Purchase',
      message: 'Are you sure you want to delete this rejected purchase record? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await purchaseIndentApi.remove(order._id);
      setOrders((prev) => prev.filter((item) => item._id !== order._id));
      toast.success('Rejected purchase deleted successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete rejected purchase.');
    }
  };

  const viewConfig = {
    title: 'Rejected Purchase',
    fields: [
      { name: 'indentDate', label: 'Date' },
      { name: 'indentNo', label: 'Indent No' },
      { name: 'siteId', label: 'Site', type: 'ref' },
      { name: 'productTypeId', label: 'Product Type', type: 'ref' },
      { name: 'purposeOfIndent', label: 'Purpose' },
      { name: 'material', label: 'Material' },
      { name: 'indentStatus', label: 'Status' },
      { name: 'raisedByName', label: 'Raised By' },
      { name: 'pmPdApproval', label: 'PM/PD Approval' },
    ],
  };

  useEffect(() => {
    setPortalTarget(document.getElementById('header-actions-target'));
  }, []);

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      try {
        const { data } = await purchaseIndentApi.list({ limit: 1000 });
        if (Array.isArray(data.data) && data.data.length > 0) {
          setOrders(data.data);
        }
      } catch (err) {
        console.error('Failed to load rejected purchase indents', err);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const filterOptions = useMemo(() => {
    const options = {
      site: new Set(),
      productType: new Set(),
      raisedBy: new Set(),
      pmPdApproval: new Set(),
    };
    orders.forEach((order) => {
      if (order.siteId?.siteType) options.site.add(order.siteId.siteType);
      if (order.productTypeId?.productType) options.productType.add(order.productTypeId.productType);
      if (order.raisedByName) options.raisedBy.add(order.raisedByName);
      if (order.pmPdApproval) options.pmPdApproval.add(order.pmPdApproval);
    });
    return {
      site: Array.from(options.site).sort(),
      productType: Array.from(options.productType).sort(),
      raisedBy: Array.from(options.raisedBy).sort(),
      pmPdApproval: Array.from(options.pmPdApproval).sort(),
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (order.indentStatus !== 'Rejected') return false;
      if (filters.site && filters.site !== 'All' && order.siteId?.siteType !== filters.site) return false;
      if (filters.productType && filters.productType !== 'All' && order.productTypeId?.productType !== filters.productType) return false;
      if (filters.raisedBy && filters.raisedBy !== 'All' && order.raisedByName !== filters.raisedBy) return false;
      if (filters.pmPdApproval && filters.pmPdApproval !== 'All' && order.pmPdApproval !== filters.pmPdApproval) return false;
      if (!term) return true;
      const text = [
        order.indentNo,
        order.siteId?.siteType,
        order.productTypeId?.productType,
        order.purposeOfIndent,
        order.material,
        order.raisedByName,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(term);
    });
  }, [orders, search, filters]);

  return (
    <div className="purchase-page" style={{ padding: '24px' }}>
      {portalTarget && createPortal(
        <div className="purchase-page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          {showSearch ? (
            <div className="search-input header-search" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <Search size={15} />
              <input
                autoFocus
                placeholder="Search rejected purchases…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '180px' }}
              />
              <button
                onClick={() => { setShowSearch(false); setSearch(''); }}
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
        </div>,
        portalTarget
      )}

      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Sno</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Indent No</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Site</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Product Type</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Priority</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Purpose</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Material</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Raised By</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>PM/PD Approval</th>
                <th className="col-actions" style={{ padding: '10px 16px', textAlign: 'left', width: '1%' }}>Actions</th>
              </tr>
              {showFilters && (
                <tr className="filters-row">
                <th />
                <th />
                <th />
                <th>
                  <select className="table-filter" value={filters.site || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, site: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.site.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <select className="table-filter" value={filters.productType || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, productType: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.productType.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th />
                <th />
                <th />
                <th>
                  <select className="table-filter" value={filters.raisedBy || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, raisedBy: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.raisedBy.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <select className="table-filter" value={filters.pmPdApproval || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, pmPdApproval: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.pmPdApproval.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th />
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading rejected purchases…</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No rejected purchases found</td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => (
                  <tr key={order._id || index}>
                    <td style={{ padding: '10px 16px' }}>{index + 1}</td>
                    <td style={{ padding: '10px 16px' }}>{formatDate(order.indentDate)}</td>
                    <td style={{ padding: '10px 16px' }}>{order.indentNo || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{renderRefLabel(order.siteId)}</td>
                    <td style={{ padding: '10px 16px' }}>{renderRefLabel(order.productTypeId)}</td>
                    <td style={{ padding: '10px 16px' }}>{renderPriorityBadge(order.priorityId?.priorityName)}</td>
                    <td style={{ padding: '10px 16px' }}>{order.purposeOfIndent || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{order.material || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{order.indentStatus || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{order.raisedByName || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{renderApprovalBadge(order.pmPdApproval)}</td>
                    <td className="col-actions" data-label="Actions" style={{ padding: '10px 16px' }}>
                      <div className="purchase-page-action-group" style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="icon-btn" title="View" onClick={() => handleViewOrder(order)}><Eye size={15} /></button>
                        <button className="icon-btn" title="Edit" onClick={() => handleViewOrder(order)}><Pencil size={15} /></button>
                        <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteOrder(order)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingOrder && (
        <MasterViewModal
          config={viewConfig}
          data={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  );
}

