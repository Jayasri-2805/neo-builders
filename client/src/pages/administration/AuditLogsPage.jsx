import { useEffect, useState } from 'react';
import { auditLogApi } from '../../api/masterApi';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    auditLogApi
      .list({ page, limit: pageSize })
      .then(({ data }) => {
        setLogs(data.data || []);
        setTotal(data.meta?.total ?? (data.data || []).length);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p className="page-subtitle">Track every change made across your company workspace</p>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading…</div>
        ) : logs.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions performed in your workspace will show up here." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S. No</th>
                  <th>Date</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log._id}>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.userName || log.user?.name || '—'}</td>
                    <td><span className={`badge badge-${log.action === 'delete' ? 'danger' : log.action === 'create' ? 'success' : 'muted'}`}>{log.action}</span></td>
                    <td>{log.module}</td>
                    <td className="truncate">{log.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
