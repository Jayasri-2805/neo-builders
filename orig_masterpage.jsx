import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, NavLink, useLocation } from 'react-router-dom';
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [viewingRow, setViewingRow] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.list({ page, limit: pageSize, search });
      setRows(data.data || []);
      setTotal(data.meta?.total ?? (data.data || []).length);
    } catch {
      toast.error(`Failed to load ${config.plural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [api, page, pageSize, search, config.plural, toast]);

  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [slug]);

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
    const value = getPath(row, col.key);
    if (col.type === 'ref') {
      if (!value) return 'ΓÇö';
      return value.departmentName || value.designationName || value.categoryName || value.uomName ||
        value.siteName || value.siteType || value.vehicleType || value.name || value.empName || 'ΓÇö';
    }
    if (value === undefined || value === null || value === '') return 'ΓÇö';
    return String(value);
  };

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
                placeholder={`Search ${config.plural.toLowerCase()}ΓÇª`}
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
          <div className="table-loading">LoadingΓÇª</div>
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
                  {config.columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th style={{ width: '120px' }}>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    {config.columns.map((col) => (
                      <td key={col.key} data-label={col.label}>{renderCell(row, col)}</td>
                    ))}
                    <td data-label="Status">
                      <button className="badge-btn" onClick={() => handleToggleStatus(row)}>
                        <StatusBadge status={row.status} />
                      </button>
                    </td>
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
