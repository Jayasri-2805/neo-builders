import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Lock } from 'lucide-react';
import { roleApi } from '../../api/masterApi';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import EmptyState from '../../components/common/EmptyState';

function RoleFormModal({ role, modules, actions, onClose, onSaved, toast }) {
  const isEdit = Boolean(role?._id);
  const [name, setName] = useState(role?.name || '');
  const [permissions, setPermissions] = useState(role?.permissions || {});
  const [saving, setSaving] = useState(false);

  const togglePermission = (mod, action) => {
    setPermissions((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] },
    }));
  };

  const toggleRow = (mod) => {
    const allOn = actions.every((a) => permissions[mod]?.[a]);
    setPermissions((prev) => ({
      ...prev,
      [mod]: actions.reduce((acc, a) => ({ ...acc, [a]: !allOn }), {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await roleApi.update(role._id, { name, permissions });
        toast.success('Role updated successfully');
      } else {
        await roleApi.create({ name, permissions });
        toast.success('Role created successfully');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Role' : 'Add Role'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group" style={{ maxWidth: '220px', alignSelf: 'flex-start' }}>
              <label>Role Name<span className="required-mark">*</span></label>
              <input
                className="form-input"
                style={{ width: '220px', maxWidth: '220px', alignSelf: 'flex-start' }}
                required
                disabled={role?.isSystem}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-section-title">Permissions</div>
            <div className="permission-matrix-wrapper">
              <table className="permission-matrix">
                <thead>
                  <tr>
                    <th>Module</th>
                    {actions.map((a) => (
                      <th key={a}>{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <tr key={mod}>
                      <td className="permission-module" onClick={() => toggleRow(mod)} style={{ width: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod}</td>
                      {actions.map((a) => (
                        <td key={a} style={{ width: '80px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(permissions[mod]?.[a])}
                            onChange={() => togglePermission(mod, a)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState({ modules: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await roleApi.list();
      setRoles(data.data || []);
      setMeta(data.meta || { modules: [], actions: [] });
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (role) => {
    const ok = await confirm({ title: 'Delete Role', message: `Delete the "${role.name}" role?`, confirmText: 'Delete' });
    if (!ok) return;
    try {
      await roleApi.remove(role._id);
      toast.success('Role deleted successfully');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Roles</h1>
          <p className="page-subtitle">Define roles and configure module-level permissions</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingRole(null); setModalOpen(true); }}>
          <Plus size={16} /> Add Role
        </button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading…</div>
        ) : roles.length === 0 ? (
          <EmptyState title="No roles yet" />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S. No</th>
                  <th>Role Name</th>
                  <th>Type</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role, idx) => (
                  <tr key={role._id}>
                    <td>{idx + 1}</td>
                    <td>{role.name}</td>
                    <td>{role.isSystem ? <span className="badge badge-muted"><Lock size={11} /> System</span> : <span className="badge badge-success">Custom</span>}</td>
                    <td className="col-actions">
                      <button className="icon-btn" onClick={() => { setEditingRole(role); setModalOpen(true); }}><Pencil size={15} /></button>
                      {!role.isSystem && (
                        <button className="icon-btn danger" onClick={() => handleDelete(role)}><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <RoleFormModal
          role={editingRole}
          modules={meta.modules}
          actions={meta.actions}
          toast={toast}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}
