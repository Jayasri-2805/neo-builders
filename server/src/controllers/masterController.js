import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import { success, ApiError } from '../utils/apiResponse.js';

async function assertRefsBelongToCompany(model, companyId, body) {
  for (const ref of model.refs || []) {
    if (ref.path === 'createdBy' || ref.path === 'updatedBy') continue;
    const value = body[ref.path];
    if (!value) continue;
    const RefModel = mongoose.model(ref.ref);

    if (Array.isArray(value)) {
      for (const val of value) {
        if (!val) continue;
        const doc = await RefModel.findOne({ _id: val, companyId });
        if (!doc) {
          throw new ApiError(422, `Referenced ${ref.ref} record does not belong to your company or does not exist`, {
            [ref.path]: `Invalid ${ref.ref} reference for id ${val}`,
          });
        }
      }
    } else {
      const doc = await RefModel.findOne({ _id: value, companyId });
      if (!doc) {
        throw new ApiError(422, `Referenced ${ref.ref} record does not belong to your company or does not exist`, {
          [ref.path]: `Invalid ${ref.ref} reference`,
        });
      }
    }
  }
}

export function createMasterController(model, moduleName, searchableFields = []) {
  return {
    async list(req, res, next) {
      try {
        const { page = 1, limit = 20, search = '', status, sort = '-createdAt' } = req.query;
        const query = { companyId: req.user.companyId };

        if (status) query.status = status;

        // Allow additional query filters for faster client-side lookups
        const reservedKeys = ['page', 'limit', 'search', 'status', 'sort'];
        Object.keys(req.query).forEach((key) => {
          if (!reservedKeys.includes(key) && req.query[key] !== undefined && req.query[key] !== '') {
            query[key] = req.query[key];
          }
        });

        if (search && searchableFields.length) {
          query.$or = searchableFields.map((field) => ({
            [field]: { $regex: search, $options: 'i' },
          }));
        }

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);

        let queryObj = model.find(query);
        if (model.refs && model.refs.length) {
          model.refs.forEach(ref => {
            queryObj = queryObj.populate({ path: ref.path, model: ref.ref });
          });
        }

        const [items, total] = await Promise.all([
          queryObj
            .sort(sort)
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
          model.countDocuments(query),
        ]);

        return success(res, {
          data: items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        });
      } catch (err) {
        next(err);
      }
    },

    async listAll(req, res, next) {
      try {
        const query = { companyId: req.user.companyId, status: 'Active' };

        if (req.user.isEmployee) {
          if (model.modelName === 'Site') {
            query._id = { $in: req.user.siteIds || [] };
          } else if (model.modelName === 'SiteType') {
            query._id = { $in: req.user.siteTypeIds || [] };
          }
        }

        let queryObj = model.find(query).sort('-createdAt').limit(1000);
        if (model.refs && model.refs.length) {
          model.refs.forEach(ref => {
            queryObj = queryObj.populate({ path: ref.path, model: ref.ref });
          });
        }
        const items = await queryObj;
        return success(res, { data: items });
      } catch (err) {
        next(err);
      }
    },

    async getOne(req, res, next) {
      try {
        let queryObj = model.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (model.refs && model.refs.length) {
          model.refs.forEach(ref => {
            queryObj = queryObj.populate({ path: ref.path, model: ref.ref });
          });
        }
        const doc = await queryObj;
        if (!doc) throw new ApiError(404, `${moduleName} record not found`);
        return success(res, { data: doc });
      } catch (err) {
        next(err);
      }
    },

    async create(req, res, next) {
      try {
        await assertRefsBelongToCompany(model, req.user.companyId, req.body);
        const doc = await model.create({
          ...req.body,
          companyId: req.user.companyId,
          createdBy: req.user.userId,
          updatedBy: req.user.userId,
        });

        await AuditLog.create({
          companyId: req.user.companyId,
          userId: req.user.userId,
          userName: req.user.name,
          module: moduleName,
          action: 'create',
          entityId: doc._id,
          newData: doc.toObject(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });

        return success(res, { message: `${moduleName} created successfully`, statusCode: 201, data: doc });
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        await assertRefsBelongToCompany(model, req.user.companyId, req.body);
        const existing = await model.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!existing) throw new ApiError(404, `${moduleName} record not found`);
        const before = existing.toObject();

        Object.assign(existing, req.body, { updatedBy: req.user.userId });
        await existing.save();

        await AuditLog.create({
          companyId: req.user.companyId,
          userId: req.user.userId,
          userName: req.user.name,
          module: moduleName,
          action: 'update',
          entityId: existing._id,
          oldData: before,
          newData: existing.toObject(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });

        return success(res, { message: `${moduleName} updated successfully`, data: existing });
      } catch (err) {
        next(err);
      }
    },

    async updateStatus(req, res, next) {
      try {
        const { status } = req.body;
        if (!['Active', 'Inactive'].includes(status)) {
          throw new ApiError(422, 'Status must be Active or Inactive');
        }
        const doc = await model.findOneAndUpdate(
          { _id: req.params.id, companyId: req.user.companyId },
          { status, updatedBy: req.user.userId },
          { new: true }
        );
        if (!doc) throw new ApiError(404, `${moduleName} record not found`);

        await AuditLog.create({
          companyId: req.user.companyId,
          userId: req.user.userId,
          userName: req.user.name,
          module: moduleName,
          action: 'status_change',
          entityId: doc._id,
          newData: { status },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });

        return success(res, { message: 'Status updated successfully', data: doc });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        const doc = await model.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (!doc) throw new ApiError(404, `${moduleName} record not found`);

        await AuditLog.create({
          companyId: req.user.companyId,
          userId: req.user.userId,
          userName: req.user.name,
          module: moduleName,
          action: 'delete',
          entityId: doc._id,
          oldData: doc.toObject(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });

        return success(res, { message: `${moduleName} deleted successfully` });
      } catch (err) {
        next(err);
      }
    },
  };
}
