import mongoose from 'mongoose';

const baseFields = {
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
};

/**
 * Creates a tenant-scoped Mongoose model following the common master schema standard.
 *
 * @param {string} modelName - Mongoose model name (e.g. "Department")
 * @param {object} fields - Schema definition specific to this master (excluding base fields)
 * @param {object} [options]
 * @param {string[]} [options.uniqueWith] - Field name that must be unique per company
 * @param {object[]} [options.refs] - [{ path, ref }] reference fields validated for tenant isolation
 */
export function createMasterModel(modelName, fields, options = {}) {
  const schema = new mongoose.Schema(
    { ...baseFields, ...fields },
    { timestamps: true }
  );

  if (options.uniqueWith) {
    schema.index({ companyId: 1, [options.uniqueWith]: 1 }, { unique: true });
  }

  if (options.hooks && typeof options.hooks.preSave === 'function') {
    // Run preSave hook prior to validation so generated fields (eg. poNumber)
    // are available for required-field validation.
    schema.pre('validate', options.hooks.preSave);
  }

  schema.set('toJSON', {
    getters: true,
    transform: (_doc, ret) => {
      ret.id = ret._id;
      return ret;
    },
  });

  const model = mongoose.model(modelName, schema);
  model.refs = options.refs || [];
  return model;
}
