import { X } from 'lucide-react';
import { getPath } from '../../utils/objectPath';

export default function MasterViewModal({ config, data, onClose }) {
  if (!data) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel view-modal ${config.fields && config.fields.length <= 2 ? 'modal-narrow' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{config.title} Details</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="details-grid">
            {config.fields.map((field) => {
              const value = getPath(data, field.name);
              let displayValue = value;
              let displayClass = '';

              if (field.name === 'priorityId') {
                const priorityName = value?.priorityName || value;
                displayClass = priorityName ? `priority-badge priority-${String(priorityName).toLowerCase()}` : '';
              } else if (field.name === 'type' && (value === 'Urgent' || value === 'Normal')) {
                displayClass = value === 'Urgent' ? 'urgent-text' : 'normal-text';
              }

              if (field.type === 'select' || field.type === 'ref') {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                  displayValue =
                    value.priorityName ||
                    value.departmentName ||
                    value.designationName ||
                    value.categoryName ||
                    value.uomName ||
                    value.siteName ||
                    value.siteType ||
                    value.vehicleType ||
                    value.name ||
                    value.empName ||
                    value.stationName ||
                    value.companyName ||
                    value.clientName ||
                    '—';
                }
              } else if (field.type === 'multiselect') {
                if (Array.isArray(value)) {
                  displayValue = value.map(v => {
                    if (v && typeof v === 'object') {
                      return v.siteType || v.siteName || v.departmentName || v.name || v.empName || v._id;
                    }
                    return String(v);
                  }).join(', ');
                }
              }

              if (displayValue === undefined || displayValue === null || displayValue === '' || (Array.isArray(value) && value.length === 0)) {
                displayValue = '—';
              }

              return (
                <div key={field.name} className="detail-item">
                  <span className="detail-label">{field.label}</span>
                  <span className={`detail-value ${displayClass}`}>{String(displayValue)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
