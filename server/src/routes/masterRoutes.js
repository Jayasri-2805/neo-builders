import { Router } from 'express';
import { ApiError, success } from '../utils/apiResponse.js';
import mongoose from 'mongoose';
import { createMasterController } from '../controllers/masterController.js';
import { authenticate, checkCompanyStatus, checkSubscription, authorize } from '../middleware/authenticate.js';
import { stripTenantFields } from '../middleware/validateRequest.js';
import { MASTER_REGISTRY } from '../models/masters/index.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });


const SEARCH_FIELDS = {
  departments: ['departmentName', 'description'],
  designations: ['designationName'],
  clients: ['projectName', 'clientName', 'contactName', 'emailId'],
  suppliers: ['companyName', 'contactName', 'emailId', 'gstin'],
  labourers: ['code', 'name', 'mobileNo'],
  employees: ['empCode', 'empName', 'personalMobNo', 'emailId'],
  expenses: ['expenseName'],
  'item-categories': ['code', 'categoryName'],
  'item-uoms': ['code', 'uomName'],
  items: ['code', 'itemName'],
  'labour-types': ['labourType'],
  'site-types': ['siteType'],
  sites: ['siteName', 'code'],
  'vehicle-types': ['vehicleType'],
  trucks: ['vehicleNo'],
  works: ['workName'],
  'purchase-status': ['status_name', 'status_no'],
  'tax-masters': ['tax_name'],
  'other-charges-master': ['other_charges_master'],
  'product-types': ['product_type'],
  'priority-masters': ['priority_name'],
  'payment-types': ['payment_type'],
  'material-requests': ['purpose', 'material', 'priority'],
  'purchase-orders': ['poNumber', 'indentNo', 'requestNo'],
  quotations: ['quoteRefNo', 'expectedDateOfDelivery', 'paymentTerms'],
};

const MODULE_KEY = {
  departments: 'departments',
  designations: 'designations',
  clients: 'clients',
  suppliers: 'suppliers',
  labourers: 'labourers',
  employees: 'employees',
  expenses: 'expenses',
  'item-categories': 'itemCategories',
  'item-uoms': 'itemUoms',
  items: 'items',
  'labour-types': 'labourTypes',
  'site-types': 'siteTypes',
  sites: 'sites',
  'vehicle-types': 'vehicleTypes',
  trucks: 'trucks',
  works: 'works',
  'purchase-status': 'purchaseStatus',
  'tax-masters': 'taxMasters',
  'other-charges-master': 'otherChargesMaster',
  'product-types': 'productTypes',
  'priority-masters': 'priorityMasters',
  'payment-types': 'paymentTypes',
  'material-requests': 'materialRequests',
  'purchase-orders': 'purchaseOrders',
  quotations: 'quotations',
};

const router = Router();

router.use(authenticate, checkCompanyStatus, checkSubscription);

router.post('/upload-attachment', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'No files uploaded' });
    }
    const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
    res.status(200).json({ status: 'success', data: { fileUrls } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const MaterialRequest = mongoose.model('MaterialRequest');
const Quotation = mongoose.model('Quotation');
const PurchaseOrder = mongoose.model('PurchaseOrder');

async function validateQuotationRates(body, existingQuotation, companyId) {
  const materialRequestId = body.materialRequestId || existingQuotation?.materialRequestId;
  if (!materialRequestId || !Array.isArray(body.quotationItems)) return;

  const materialRequest = await MaterialRequest.findOne({ _id: materialRequestId, companyId }).lean();
  if (!materialRequest) throw new ApiError(404, 'Material request not found');

  const requestItems = new Map();
  (materialRequest.purchaseItems || []).forEach((item) => {
    if (item._id) requestItems.set(String(item._id), item);
    if (item.itemId) requestItems.set(String(item.itemId), item);
  });
  for (const quotationItem of body.quotationItems) {
    const requestItem = requestItems.get(String(quotationItem.itemId));
    const boqRate = Number(requestItem?.boqRate);
    const supplierRate = Number(quotationItem.rate);
    if (Number.isFinite(boqRate) && Number.isFinite(supplierRate) && supplierRate > boqRate) {
      throw new ApiError(422, `Supplier rate for ${requestItem.itemName || 'an item'} cannot exceed the BOQ rate of ${boqRate}`);
    }
  }
}

router.post('/comparison/send-md-approval', authorize('materialRequests', 'edit'), async (req, res, next) => {
  try {
    const { materialRequestId } = req.body;
    if (!materialRequestId) {
      throw new ApiError(422, 'materialRequestId is required');
    }
    const mr = await MaterialRequest.findOne({ _id: materialRequestId, companyId: req.user.companyId });
    if (!mr) {
      throw new ApiError(404, 'Material request not found');
    }
    mr.comparisonStatus = 'Pending MD Approval';
    mr.mdApprovalStatus = 'Pending';
    mr.mdApproval = 'Pending';
    mr.mdApprovalUpdatedAt = null;
    if (!mr.comparisonNo) {
      mr.comparisonNo = `CMP-${mr.indentNo || mr._id}`;
    }
    await mr.save();
    return success(res, { data: mr });
  } catch (err) {
    next(err);
  }
});

router.post('/comparison/md-approve', authorize('materialRequests', 'edit'), async (req, res, next) => {
  try {
    const { materialRequestId, approvalRemarks = '' } = req.body;
    if (!materialRequestId) {
      throw new ApiError(422, 'materialRequestId is required');
    }
    const mr = await MaterialRequest.findOne({ _id: materialRequestId, companyId: req.user.companyId });
    if (!mr) {
      throw new ApiError(404, 'Material request not found');
    }
    mr.mdApprovalStatus = 'Approved';
    mr.mdApproval = 'Approved';
    mr.mdApprovalUpdatedAt = new Date();
    mr.comparisonStatus = 'Approved';
    mr.approvalRemarks = approvalRemarks;
    mr.approvedBy = req.user.name || '';
    mr.approvedDate = new Date();
    await mr.save();
    return success(res, { data: mr });
  } catch (err) {
    next(err);
  }
});

router.post('/comparison/md-reject', authorize('materialRequests', 'edit'), async (req, res, next) => {
  try {
    const { materialRequestId, approvalRemarks = '' } = req.body;
    if (!materialRequestId) {
      throw new ApiError(422, 'materialRequestId is required');
    }
    if (!approvalRemarks || !approvalRemarks.trim()) {
      throw new ApiError(422, 'Rejection remarks are required');
    }
    const mr = await MaterialRequest.findOne({ _id: materialRequestId, companyId: req.user.companyId });
    if (!mr) {
      throw new ApiError(404, 'Material request not found');
    }
    mr.mdApprovalStatus = 'Rejected';
    mr.mdApproval = 'Rejected';
    mr.mdApprovalUpdatedAt = new Date();
    mr.comparisonStatus = 'Rejected';
    mr.approvalRemarks = approvalRemarks;
    mr.approvedBy = req.user.name || '';
    mr.approvedDate = new Date();
    await mr.save();
    return success(res, { data: mr });
  } catch (err) {
    next(err);
  }
});

router.post('/purchase-orders/generate', authorize('purchaseOrders', 'create'), async (req, res, next) => {
  try {
    const { materialRequestId } = req.body;
    if (!materialRequestId) {
      throw new ApiError(422, 'materialRequestId is required');
    }
    const mr = await MaterialRequest.findOne({ _id: materialRequestId, companyId: req.user.companyId });
    if (!mr) {
      throw new ApiError(404, 'Material request not found');
    }
    if (mr.mdApprovalStatus !== 'Approved' && mr.mdApproval !== 'Approved') {
      throw new ApiError(422, 'MD approval is required before generating a purchase order');
    }
    const awardSelections = Array.isArray(req.body.awardSelections) ? req.body.awardSelections : [];
    let quote = mr.awardedQuotationId ? await Quotation.findOne({ _id: mr.awardedQuotationId, companyId: req.user.companyId }).lean() : null;
    let selectedQuotationItems = [];
    let selectedSupplierId = quote?.supplierId || null;
    let selectedFreight = Number(quote?.freight) || 0;
    let selectedLoading = Number(quote?.loading) || 0;
    let selectedUnloading = Number(quote?.unloading) || 0;

    if (awardSelections.length > 0) {
      const allQuotes = await Quotation.find({ materialRequestId: mr._id, companyId: req.user.companyId }).lean();
      const selectedQuoteMap = new Map();
      awardSelections.forEach((selection) => {
        const matchingQuote = allQuotes.find((candidate) => String(candidate._id) === String(selection.quoteId));
        if (!matchingQuote) return;
        const matchingItem = (matchingQuote.quotationItems || []).find((item) => String(item.itemId) === String(selection.itemId));
        if (!matchingItem) return;
        const normalizedQuote = { ...matchingQuote, supplierId: matchingQuote.supplierId };
        if (!selectedQuoteMap.has(String(matchingQuote._id))) {
          selectedQuoteMap.set(String(matchingQuote._id), normalizedQuote);
        }
        selectedQuotationItems.push({
          itemId: matchingItem.itemId,
          rate: Number(matchingItem.rate) || 0,
          taxPercent: Number(matchingItem.taxPercent) || 0,
          taxAmount: Number(matchingItem.taxAmount) || 0,
          total: Number(matchingItem.total) || 0,
          isSelected: true,
        });
      });

      const orderedQuotes = Array.from(selectedQuoteMap.values());
      if (orderedQuotes.length > 0) {
        const firstQuote = orderedQuotes[0];
        quote = { ...firstQuote, quotationItems: selectedQuotationItems, supplierId: firstQuote.supplierId };
        selectedSupplierId = firstQuote.supplierId || null;
        selectedFreight = Number(firstQuote.freight) || 0;
        selectedLoading = Number(firstQuote.loading) || 0;
        selectedUnloading = Number(firstQuote.unloading) || 0;
      }
    }

    if (!quote) {
      throw new ApiError(422, 'Approved quotation is required to generate a purchase order');
    }
    const itemTotal = Array.isArray(quote.quotationItems)
      ? quote.quotationItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
      : 0;
    const freight = selectedFreight;
    const loading = selectedLoading;
    const unloading = selectedUnloading;
    const grandTotal = itemTotal + freight + loading + unloading;
    const poPayload = {
      purchaseIndentId: mr._id,
      materialRequestId: mr._id,
      quotationId: quote._id,
      indentNo: mr.indentNo || '',
      requestNo: mr.indentNo || mr._id,
      siteId: mr.siteTypeId,
      supplierId: selectedSupplierId,
      requestedByName: mr.raisedByName || '',
      requestDate: mr.requiredDate || new Date().toISOString().split('T')[0],
      totalAmount: grandTotal,
      freight,
      loading,
      unloading,
      subTotal: itemTotal,
      grandTotal,
      orderStatus: 'Draft',
      indentSnapshot: mr.toObject(),
      quotationSnapshot: {
        ...quote,
        quotationItems: Array.isArray(quote.quotationItems) ? quote.quotationItems : [],
        freight,
        loading,
        unloading,
      },
    };
    let po = await PurchaseOrder.findOne({ materialRequestId: mr._id, companyId: req.user.companyId });
    if (po) {
      Object.assign(po, {
        ...poPayload,
        poNumber: po.poNumber || poPayload.poNumber,
        companyId: req.user.companyId,
        updatedBy: req.user.userId,
      });
      po = await po.save();
    } else {
      po = await PurchaseOrder.create({
        ...poPayload,
        companyId: req.user.companyId,
        createdBy: req.user.userId,
        updatedBy: req.user.userId,
      });
    }
    mr.poGenerated = true;
    mr.comparisonStatus = 'PO Generated';
    mr.poNumber = po.poNumber;
    mr.purchaseOrderId = po._id;
    await mr.save();
    return success(res, { message: 'Purchase order generated successfully', statusCode: 201, data: po });
  } catch (err) {
    next(err);
  }
});

router.get('/purchase-orders/:id/pdf', authorize('purchaseOrders', 'view'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!po) {
      throw new ApiError(404, 'Purchase order not found');
    }
    return success(res, { data: po });
  } catch (err) {
    next(err);
  }
});

router.get('/purchase-order/:id', authorize('purchaseOrders', 'view'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!po) {
      throw new ApiError(404, 'Purchase order not found');
    }
    return success(res, { data: po });
  } catch (err) {
    next(err);
  }
});

router.get('/purchase-order/:id/pdf', authorize('purchaseOrders', 'view'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!po) {
      throw new ApiError(404, 'Purchase order not found');
    }
    return success(res, { data: po });
  } catch (err) {
    next(err);
  }
});

for (const [slug, { model, label }] of Object.entries(MASTER_REGISTRY)) {
  const controller = createMasterController(model, label, SEARCH_FIELDS[slug] || []);
  const moduleKey = MODULE_KEY[slug];
  const base = `/${slug}`;

  router.get(`${base}/all`, authorize(moduleKey, 'view'), controller.listAll);
  router.get(base, authorize(moduleKey, 'view'), controller.list);
  router.get(`${base}/:id`, authorize(moduleKey, 'view'), controller.getOne);
  // Special-case: attempt to resolve supplier for purchase-orders before create
  if (slug === 'purchase-orders') {
    const originalCreate = controller.create;
    controller.create = async (req, res, next) => {
      try {
        // If supplierId missing but purchaseIndentId provided, attempt server-side resolution
        if ((!req.body.supplierId || req.body.supplierId === '') && req.body.purchaseIndentId) {
          try {
            const PurchaseIndent = mongoose.model('PurchaseIndent');
            const Quotation = mongoose.model('Quotation');
            const indent = await PurchaseIndent.findOne({ _id: req.body.purchaseIndentId, companyId: req.user.companyId }).lean();
            let resolvedSupplier = null;
            if (indent && indent.supplierId) resolvedSupplier = indent.supplierId;
            // Fallback: find material request by indentNo and look for awarded or any quotation
            if (!resolvedSupplier && indent && indent.indentNo) {
              const MaterialRequest = mongoose.model('MaterialRequest');
              const mr = await MaterialRequest.findOne({ indentNo: indent.indentNo, companyId: req.user.companyId }).lean();
              if (mr) {
                if (mr.awardedQuotationId) {
                  const q = await Quotation.findById(mr.awardedQuotationId).lean();
                  if (q && q.supplierId) resolvedSupplier = q.supplierId;
                }
                if (!resolvedSupplier) {
                  const q2 = await Quotation.findOne({ materialRequestId: mr._id, companyId: req.user.companyId }).lean();
                  if (q2 && q2.supplierId) resolvedSupplier = q2.supplierId;
                }
              }
            }
              if (resolvedSupplier) {
                req.body.supplierId = resolvedSupplier;
              } else {
                console.warn('purchase-orders: supplier could not be auto-resolved; proceeding without supplierId');
              }

              // Backfill other important fields from the indent to avoid validation failures
              try {
                if (indent) {
                  if (!req.body.siteId && indent.siteId) req.body.siteId = indent.siteId;
                  if (!req.body.indentNo && indent.indentNo) req.body.indentNo = indent.indentNo;
                  if (!req.body.requestNo && (indent.requestNo || indent.indentNo)) req.body.requestNo = indent.requestNo || indent.indentNo;
                  if (!req.body.requestedByName && indent.raisedByName) req.body.requestedByName = indent.raisedByName;
                  if (!req.body.requestDate && indent.indentDate) req.body.requestDate = (new Date(indent.indentDate)).toISOString().split('T')[0];
                  if (!req.body.totalAmount && indent.totalAmount) req.body.totalAmount = indent.totalAmount;
                  if (!req.body.indentSnapshot) req.body.indentSnapshot = indent;
                }
              } catch (err) {
                console.warn('purchase-orders: failed to backfill indent fields', err);
              }
          } catch (err) {
            console.warn('purchase-orders: failed to resolve supplierId automatically', err);
          }
        }
        try {
          await originalCreate(req, res, next);
        } catch (err) {
          console.error('[purchase-orders:create] request body:', JSON.stringify(req.body));
          console.error('[purchase-orders:create] error stack:', err.stack || err);
          return next(err);
        }
      } catch (err) {
        next(err);
      }
    };
  }
  if (slug === 'purchase-indents') {
    const originalList = controller.list;
    const originalCreate = controller.create;

    controller.list = async (req, res, next) => {
      try {
        const purchaseIndents = await model.find({ companyId: req.user.companyId })
          .select('_id indentNo materialRequestId')
          .lean();
        const materialRequestIds = purchaseIndents
          .flatMap((indent) => [indent.materialRequestId, indent.indentNo])
          .filter((value) => value && mongoose.Types.ObjectId.isValid(value))
          .map((value) => String(value));

        if (materialRequestIds.length > 0) {
          const MaterialRequest = mongoose.model('MaterialRequest');
          const materialRequests = await MaterialRequest.find({
            _id: { $in: [...new Set(materialRequestIds)] },
            companyId: req.user.companyId,
          }).select('_id indentNo').lean();
          const requestsById = new Map(materialRequests.map((request) => [String(request._id), request]));

          const repairs = purchaseIndents.flatMap((indent) => {
            const sourceRequest = requestsById.get(String(indent.materialRequestId || indent.indentNo));
            if (!sourceRequest?.indentNo) return [];
            if (indent.indentNo === sourceRequest.indentNo && String(indent.materialRequestId || '') === String(sourceRequest._id)) return [];
            return [{
              updateOne: {
                filter: { _id: indent._id, companyId: req.user.companyId },
                update: { $set: { indentNo: sourceRequest.indentNo, materialRequestId: sourceRequest._id } },
              },
            }];
          });

          if (repairs.length > 0) await model.bulkWrite(repairs);
        }
        return originalList(req, res, next);
      } catch (err) {
        return next(err);
      }
    };

    controller.create = async (req, res, next) => {
      try {
        if (req.body.materialRequestId) {
          const MaterialRequest = mongoose.model('MaterialRequest');
          const materialRequest = await MaterialRequest.findOne({
            _id: req.body.materialRequestId,
            companyId: req.user.companyId,
          }).lean();

          if (!materialRequest) {
            throw new ApiError(404, 'Material request not found');
          }
          if (!materialRequest.indentNo) {
            throw new ApiError(422, 'Material request does not have an indent number');
          }

          const existingIndent = await model.findOne({
            materialRequestId: materialRequest._id,
            companyId: req.user.companyId,
          }).lean();
          if (existingIndent) {
            throw new ApiError(409, 'A purchase indent already exists for this material request');
          }

          req.body.indentNo = materialRequest.indentNo;
        }
        return originalCreate(req, res, next);
      } catch (err) {
        return next(err);
      }
    };
  }
  if (slug === 'quotations') {
    const originalCreate = controller.create;
    const originalUpdate = controller.update;
    controller.create = async (req, res, next) => {
      try {
        await validateQuotationRates(req.body, null, req.user.companyId);
        return originalCreate(req, res, next);
      } catch (err) {
        return next(err);
      }
    };
    controller.update = async (req, res, next) => {
      try {
        const existing = await Quotation.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
        if (!existing) throw new ApiError(404, 'Quotation record not found');
        await validateQuotationRates(req.body, existing, req.user.companyId);
        return originalUpdate(req, res, next);
      } catch (err) {
        return next(err);
      }
    };
  }
  router.post(base, authorize(moduleKey, 'create'), stripTenantFields, controller.create);
  router.put(`${base}/:id`, authorize(moduleKey, 'edit'), stripTenantFields, controller.update);
  router.patch(`${base}/:id/status`, authorize(moduleKey, 'edit'), controller.updateStatus);
  router.delete(`${base}/:id`, authorize(moduleKey, 'delete'), controller.remove);
}

export default router;
