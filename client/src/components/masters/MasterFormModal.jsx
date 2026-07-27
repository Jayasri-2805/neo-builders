import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getPath, setPath, formatDateForInput } from '../../utils/objectPath';
import { createMasterApi } from '../../api/masterApi';

function useRefOptions(field, moduleKey) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (!field.refEndpoint) return;
    const api = createMasterApi(field.refEndpoint);
    api.listAll()
      .then(({ data }) => {
        let items = data.data || [];
        if (moduleKey === 'purchaseIndents' && field.name === 'indentNo') {
          items = items.filter((item) => item.pmPdApproval === 'Approved');
        }
        setOptions(items);
      })
      .catch(() => setOptions([]));
  }, [field.refEndpoint, field.name, moduleKey]);

  return options;
}

function MultiselectDropdown({ options, selectedValues, onChange, fieldLabel }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (optId) => {
    let newSelected;
    if (selectedValues.includes(optId)) {
      newSelected = selectedValues.filter(id => id !== optId);
    } else {
      newSelected = [...selectedValues, optId];
    }
    onChange(newSelected);
  };

  const selectedLabels = options
    .filter(opt => selectedValues.includes(opt._id))
    .map(opt => String(opt.label))
    .join(', ');

  return (
    <div className="multiselect-dropdown" style={{ position: 'relative' }}>
      <div 
        className="form-select"
        style={{ cursor: 'pointer', minHeight: '38px', display: 'flex', alignItems: 'center' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedLabels || <span style={{ color: '#9ca3af' }}>Select {fieldLabel}...</span>}
      </div>
      
      {isOpen && (
        <div 
          style={{ 
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            marginTop: '0.25rem',
            border: '1px solid #e2e8f0', 
            borderRadius: '0.375rem', 
            padding: '0.5rem', 
            maxHeight: '200px', 
            overflowY: 'auto',
            backgroundColor: '#fff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          {options.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No options available</span>}
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt._id);
            return (
              <label key={String(opt._id)} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155' }}>
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  onChange={() => toggleOption(opt._id)}
                  style={{ marginRight: '0.5rem', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {String(opt.label)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FieldInput({ field, value, onChange, formData, moduleKey }) {
  const refOptions = (field.type === 'select' || field.type === 'multiselect') && field.refEndpoint ? useRefOptions(field, moduleKey) : null;

  if (field.type === 'textarea') {
    return (
      <textarea
        className="form-textarea"
        rows={3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    let rawOptions = field.refEndpoint ? refOptions : field.options || [];

    if (field.dependsOn && formData) {
      const dependentValues = getPath(formData, field.dependsOn);
      if (Array.isArray(dependentValues) && dependentValues.length > 0) {
        const dependentIds = dependentValues.map(v => typeof v === 'object' && v !== null ? (v._id || v.id) : v);
        rawOptions = rawOptions.filter(opt => {
          const optFilterValue = opt[field.filterKey];
          const optFilterId = optFilterValue && typeof optFilterValue === 'object' ? (optFilterValue._id || optFilterValue.id) : optFilterValue;
          return dependentIds.includes(optFilterId);
        });
      } else if (dependentValues && !Array.isArray(dependentValues)) {
        const dependentId = typeof dependentValues === 'object' && dependentValues !== null ? (dependentValues._id || dependentValues.id) : dependentValues;
        rawOptions = rawOptions.filter(opt => {
          const optFilterValue = opt[field.filterKey];
          const optFilterId = optFilterValue && typeof optFilterValue === 'object' ? (optFilterValue._id || optFilterValue.id) : optFilterValue;
          return dependentId === optFilterId;
        });
      } else {
        rawOptions = [];
      }
    }

    const options = (rawOptions || []).map((opt) => {
      if (opt && typeof opt === 'object') {
        const id = opt._id ?? opt.id ?? opt.value ?? opt;
        const label = opt[field.refLabel || 'label'] ?? opt.label ?? opt.name ?? id;
        return { _id: id, label };
      }
      return { _id: opt, label: String(opt) };
    });

    // Debug: log options to help identify unexpected shapes
    try {
      // eslint-disable-next-line no-console
      console.debug('[MasterFormModal] select options', field.name, { rawOptions, options });
    } catch (e) {}

    const selectedValueRaw = (() => {
      if (value === undefined || value === null || value === '') return '';
      if (field.refEndpoint && value && typeof value === 'object') return value._id ?? '';
      return value;
    })();
    const selectedOption = options.find((opt) => String(opt._id) === String(selectedValueRaw));
    const priorityClass = field.name === 'priorityId' && selectedOption?.label
      ? ` priority-${String(selectedOption.label).toLowerCase()}`
      : '';

    return (
      <select
        className={`form-select${priorityClass}`}
        value={selectedValueRaw === '' ? '' : JSON.stringify(selectedValueRaw)}
        onChange={(e) => {
          const v = e.target.value;
              try {
                const parsed = v === '' ? '' : JSON.parse(v);
                onChange(parsed);
              } catch (err) {
                onChange(v);
              }
        }}
      >
        <option value="">Select {field.label}</option>
        {options.map((opt) => (
          <option key={String(opt._id)} value={JSON.stringify(opt._id)}>
            {String(opt.label)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'multiselect') {
    let rawOptions = field.refEndpoint ? refOptions : field.options || [];

    if (field.dependsOn && formData) {
      const dependentValues = getPath(formData, field.dependsOn);
      if (Array.isArray(dependentValues) && dependentValues.length > 0) {
        const dependentIds = dependentValues.map(v => typeof v === 'object' && v !== null ? (v._id || v.id) : v);
        rawOptions = rawOptions.filter(opt => {
          const optFilterValue = opt[field.filterKey];
          const optFilterId = optFilterValue && typeof optFilterValue === 'object' ? (optFilterValue._id || optFilterValue.id) : optFilterValue;
          return dependentIds.includes(optFilterId);
        });
      } else if (dependentValues && !Array.isArray(dependentValues)) {
        const dependentId = typeof dependentValues === 'object' && dependentValues !== null ? (dependentValues._id || dependentValues.id) : dependentValues;
        rawOptions = rawOptions.filter(opt => {
          const optFilterValue = opt[field.filterKey];
          const optFilterId = optFilterValue && typeof optFilterValue === 'object' ? (optFilterValue._id || optFilterValue.id) : optFilterValue;
          return dependentId === optFilterId;
        });
      } else {
        rawOptions = [];
      }
    }

    const options = (rawOptions || []).map((opt) => {
      if (opt && typeof opt === 'object') {
        const id = opt._id ?? opt.id ?? opt.value ?? opt;
        const label = opt[field.refLabel || 'label'] ?? opt.label ?? opt.name ?? id;
        return { _id: id, label };
      }
      return { _id: opt, label: String(opt) };
    });

    const selectedValues = Array.isArray(value) ? value.map(v => {
      if (v && typeof v === 'object') return v._id ?? v;
      return v;
    }) : [];

    return <MultiselectDropdown options={options} selectedValues={selectedValues} onChange={onChange} fieldLabel={field.label} />;
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        className="form-input"
        value={formatDateForInput(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
      className="form-input"
      value={value ?? ''}
      onChange={(e) => onChange(field.type === 'number' ? e.target.valueAsNumber || '' : e.target.value)}
    />
  );
}

export default function MasterFormModal({ config, initialData, onClose, onSaved, toast }) {
  const isEdit = Boolean(initialData?._id);
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const api = useMemo(() => createMasterApi(config.endpoint), [config.endpoint]);

  useEffect(() => {
    setFormData(initialData || {});
  }, [initialData]);

  const sections = useMemo(() => {
    const map = new Map();
    config.fields.forEach((f) => {
      const section = f.section || 'Details';
      if (!map.has(section)) map.set(section, []);
      map.get(section).push(f);
    });
    return Array.from(map.entries());
  }, [config.fields]);

  const handleChange = (name, value) => {
    setFormData((prev) => setPath(prev, name, value));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const newErrors = {};
    config.fields.forEach((f) => {
      if (f.required) {
        const value = getPath(formData, f.name);
        if (value === undefined || value === null || value === '') {
          newErrors[f.name] = `${f.label} is required`;
        }
      }
      if (f.pattern && !newErrors[f.name]) {
        const value = getPath(formData, f.name);
        if (value && !f.pattern.test(value)) {
          newErrors[f.name] = f.patternMessage || `Invalid ${f.label} format`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.update(initialData._id, formData);
        toast.success(`${config.title} updated successfully`);
      } else {
        await api.create(formData);
        toast.success(`${config.title} created successfully`);
      }
      onSaved();
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong';
      toast.error(message);
      const errs = err.response?.data?.errors;
      if (Array.isArray(errs)) {
        const fieldErrors = {};
        errs.forEach((fe) => {
          fieldErrors[fe.field] = fe.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel ${config.fields && config.fields.length <= 2 ? 'modal-narrow' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ margin: 0 }}>{isEdit ? `Edit ${config.title}` : `Add ${config.title}`}</h3>
            {config.moduleKey === 'purchaseIndents' && (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
                Date: {isEdit && initialData.indentDate ? new Date(initialData.indentDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
              </span>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {sections.map(([sectionName, fields]) => (
              <div key={sectionName} className="form-section">
                {sections.length > 1 && <div className="form-section-title">{sectionName}</div>}
                <div className="form-grid">
                  {fields.map((field) => (
                    <div key={field.name} className={`form-group ${field.type === 'textarea' || config.fields.length === 1 ? 'span-2' : ''}`}>
                      <label>
                        {field.label}
                        {field.required && <span className="required-mark">*</span>}
                      </label>
                      <FieldInput
                        field={field}
                        value={getPath(formData, field.name)}
                        onChange={(value) => handleChange(field.name, value)}
                        formData={formData}
                        moduleKey={config.moduleKey}
                      />
                      {errors[field.name] && <span className="field-error">{errors[field.name]}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
