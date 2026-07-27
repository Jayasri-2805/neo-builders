import mongoose from 'mongoose';
import { createMasterModel } from '../masterFactory.js';

export const Department = createMasterModel(
  'Department',
  {
    departmentName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
  },
  { uniqueWith: 'departmentName' }
);

export const Designation = createMasterModel(
  'Designation',
  {
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    designationName: { type: String, required: true, trim: true },
  },
  { uniqueWith: 'designationName', refs: [{ path: 'departmentId', ref: 'Department' }] }
);

export const Client = createMasterModel('Client', {
  projectName: { type: String, required: true, trim: true },
  clientName: { type: String, required: true, trim: true },
  ongoingProjects: { type: String, default: '' },
  location: { type: String, default: '' },
  gstin: { type: String, default: '' },
  contactName: { type: String, default: '' },
  mobileNo: { type: String, default: '' },
  emailId: { type: String, default: '' },
  address: { type: String, default: '' },
});

export const Supplier = createMasterModel('Supplier', {
  companyName: { type: String, required: true, trim: true },
  contactName: { type: String, required: true, trim: true },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  mobileNo: { type: String, default: '' },
  mobileNo2: { type: String, default: '' },
  emailId: { type: String, default: '' },
  panNo: { type: String, default: '' },
  gstin: { type: String, default: '' },
  bankDetails: {
    accountHolderName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    branchName: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
  },
  remarks: { type: String, default: '' },
});

export const Labourer = createMasterModel('Labourer', {
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  mobileNo: { type: String, default: '' },
  referredBy: { type: String, default: '' },
  address: { type: String, default: '' },
  pan: { type: String, default: '' },
  gst: { type: String, default: '' },
  bankDetails: {
    accountHolderName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    branchName: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
  },
}, { uniqueWith: 'code' });

export const Employee = createMasterModel(
  'Employee',
  {
    empCode: { type: String, required: true, trim: true },
    empName: { type: String, required: true, trim: true },
    personalMobNo: { type: String, required: true },
    officeMobNo: { type: String, required: true },
    siteTypeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SiteType' }],
    siteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Site' }],
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    dateOfBirth: { type: Date, required: true },
    dateOfJoining: { type: Date, required: true },
    emailId: { type: String, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    aadhaarNo: { type: String, required: true },
    panNo: { type: String, default: '' },
    pfNo: { type: String, default: '' },
    fatherSpouseName: { type: String, required: true },
    fatherSpouseMobNo: { type: String, required: true },
    basicPay: { type: Number, required: true },
    bankAccountNo: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    uniformIssuedOn: { type: Date },
    remarks1: { type: String, default: '' },
    remarks2: { type: String, default: '' },
  },
  {
    uniqueWith: 'empCode',
    refs: [
      { path: 'siteTypeIds', ref: 'SiteType' },
      { path: 'siteIds', ref: 'Site' },
      { path: 'departmentId', ref: 'Department' },
      { path: 'designationId', ref: 'Designation' },
    ],
  }
);

export const Expense = createMasterModel(
  'Expense',
  { expenseName: { type: String, required: true, trim: true } },
  { uniqueWith: 'expenseName' }
);

export const ItemCategory = createMasterModel(
  'ItemCategory',
  {
    code: { type: String, required: true, trim: true },
    categoryName: { type: String, required: true, trim: true },
  },
  { uniqueWith: 'code' }
);

export const ItemUOM = createMasterModel(
  'ItemUOM',
  {
    code: { type: String, required: true, trim: true },
    uomName: { type: String, required: true, trim: true },
  },
  { uniqueWith: 'code' }
);

export const Item = createMasterModel(
  'Item',
  {
    code: { type: String, required: true, trim: true },
    tax: { type: Number, default: 0 },
    itemName: { type: String, required: true, trim: true },
    itemCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemCategory', required: true },
    itemUomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemUOM', required: true },
  },
  {
    uniqueWith: 'code',
    refs: [
      { path: 'itemCategoryId', ref: 'ItemCategory' },
      { path: 'itemUomId', ref: 'ItemUOM' },
    ],
  }
);

export const LabourType = createMasterModel(
  'LabourType',
  { labourType: { type: String, required: true, trim: true } },
  { uniqueWith: 'labourType' }
);

export const SiteType = createMasterModel(
  'SiteType',
  { siteType: { type: String, required: true, trim: true } },
  { uniqueWith: 'siteType' }
);

export const Site = createMasterModel(
  'Site',
  {
    siteTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteType', required: true },
    siteName: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    projectManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    siteInchargeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    qsDataEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    schedules: [
      {
        date: Date,
        workId: { type: mongoose.Schema.Types.ObjectId, ref: 'Work' },
        notes: String,
      },
    ],
  },
  {
    uniqueWith: 'code',
    refs: [
      { path: 'siteTypeId', ref: 'SiteType' },
      { path: 'projectManagerId', ref: 'Employee' },
      { path: 'siteInchargeId', ref: 'Employee' },
      { path: 'qsDataEntryId', ref: 'Employee' },
    ],
  }
);

export const VehicleType = createMasterModel(
  'VehicleType',
  { vehicleType: { type: String, required: true, trim: true } },
  { uniqueWith: 'vehicleType' }
);

export const Purchase = createMasterModel(
  'Purchase',
  {
    statusName: { type: String, required: true, trim: true },
    statusNo: { type: String, trim: true },
    sortOrder: { type: Number },
  },
  { uniqueWith: 'statusName' }
);

export const Tax = createMasterModel(
  'Tax',
  {
    taxName: { type: String, required: true, trim: true },
    taxPercentage: { type: Number, required: true },
  },
  { uniqueWith: 'taxName' }
);

export const Charge = createMasterModel(
  'Charge',
  {
    chargeName: { type: String, required: true, trim: true },
  },
  { uniqueWith: 'chargeName' }
);

export const ProductType = createMasterModel(
  'ProductType',
  {
    productType: { type: String, required: true, trim: true },
  },
  { uniqueWith: 'productType' }
);

export const Priority = createMasterModel(
  'Priority',
  {
    priorityName: { type: String, required: true, trim: true },
    color: { type: String, trim: true },
  },
  { uniqueWith: 'priorityName' }
);

export const PaymentType = createMasterModel(
  'PaymentType',
  {
    paymentWay: { type: String, required: true, trim: true },
  },
  { uniqueWith: 'paymentWay' }
);

export const PurchaseIndent = createMasterModel(
  'PurchaseIndent',
  {
    indentDate: { type: Date, default: Date.now },
    indentNo: { type: String, required: true, trim: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteType', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    requiredDate: { type: String, required: true },
    productTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType', required: true },
    type: { type: String, required: true },
    priorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Priority' },
    purposeOfIndent: { type: String, required: true },
    material: { type: String, trim: true },
    totalAmount: { type: Number, default: 0 },
    indentStatus: { type: String, enum: ['Raised', 'Approved', 'Rejected', 'Pending', 'Converted'], default: 'Pending' },
    raisedByName: { type: String, trim: true },
    pmPdApproval: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    pmPdApprovalUpdatedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    rejectedBy: { type: String, trim: true },
    rejectedDate: { type: Date },
    rejectionSnapshot: { type: mongoose.Schema.Types.Mixed },
    convertedAt: { type: Date },
  },
  {
    uniqueWith: 'indentNo',
    refs: [
      { path: 'siteId', ref: 'SiteType' },
      { path: 'supplierId', ref: 'Supplier' },
      { path: 'productTypeId', ref: 'ProductType' },
      { path: 'priorityId', ref: 'Priority' },
    ]
  }
);

export const PurchaseOrder = createMasterModel(
  'PurchaseOrder',
  {
    purchaseIndentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseIndent' },
    materialRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest' },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    poNumber: { type: String, required: true, trim: true },
    indentNo: { type: String, required: true, trim: true },
    requestNo: { type: String, required: true, trim: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteType', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    requestedByName: { type: String, trim: true },
    requestDate: { type: String, required: true },
    freight: { type: Number, default: 0 },
    loading: { type: Number, default: 0 },
    unloading: { type: Number, default: 0 },
    subTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    orderStatus: { type: String, enum: ['Draft', 'Ordered', 'Completed'], default: 'Draft' },
    indentSnapshot: { type: mongoose.Schema.Types.Mixed },
    quotationSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  {
    refs: [
      { path: 'purchaseIndentId', ref: 'PurchaseIndent' },
      { path: 'materialRequestId', ref: 'MaterialRequest' },
      { path: 'quotationId', ref: 'Quotation' },
      { path: 'siteId', ref: 'SiteType' },
      { path: 'supplierId', ref: 'Supplier' },
    ],
    hooks: {
      preSave: async function (next) {
        if (!this.poNumber) {
          try {
            const SiteType = mongoose.model('SiteType');
            const site = await SiteType.findById(this.siteId);
            let siteCode = 'UNK';
            if (site && site.siteType) {
              siteCode = site.siteType.substring(0, 3).toUpperCase();
            }

            const year = new Date().getFullYear().toString().slice(-2);
            const count = await mongoose.model('PurchaseOrder').countDocuments({
              companyId: this.companyId,
              createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
            });
            const seq = (count + 1).toString().padStart(3, '0');
            this.poNumber = `${siteCode}/PO/${year}/${seq}`;
          } catch (err) {
            console.error('Error generating PO number', err);
          }
        }
        next();
      }
    }
  }
);

export const Truck = createMasterModel(
  'Truck',
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    vehicleTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleType', required: true },
    vehicleNo: { type: String, required: true, trim: true },
  },
  {
    uniqueWith: 'vehicleNo',
    refs: [
      { path: 'siteId', ref: 'Site' },
      { path: 'vehicleTypeId', ref: 'VehicleType' },
    ],
  }
);

export const Work = createMasterModel(
  'Work',
  {
    workName: { type: String, required: true, trim: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemUOM', required: true },
  },
  { uniqueWith: 'workName', refs: [{ path: 'unitId', ref: 'ItemUOM' }] }
);

export const FillingStation = createMasterModel(
  'FillingStation',
  {
    stationName: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
  },
  { uniqueWith: 'stationName' }
);

export const MaterialRequest = createMasterModel(
  'MaterialRequest',
  {
    indentNo: { type: String },
    raisedByName: { type: String, default: '' },
    siteTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteType', required: true },
    priority: { type: String, required: true },
    requiredDate: { type: String, required: true },
    purpose: { type: String, required: true },
    material: { type: String, required: true },
    photos: [{ type: String }],
    pmPdApproval: { type: String, default: 'Pending' },
    pmPdApprovalUpdatedAt: { type: Date, default: null },
    mdApproval: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    mdApprovalUpdatedAt: { type: Date, default: null },
    mdApprovalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    comparisonStatus: { type: String, enum: ['Pending', 'Compared', 'Pending MD Approval', 'Approved', 'Rejected', 'PO Generated'], default: 'Pending' },
    comparisonNo: { type: String, trim: true, default: '' },
    approvedBy: { type: String, trim: true, default: '' },
    approvedDate: { type: Date, default: null },
    approvalRemarks: { type: String, trim: true, default: '' },
    poGenerated: { type: Boolean, default: false },
    pdfGenerated: { type: Boolean, default: false },
    poNumber: { type: String, trim: true, default: '' },
    productTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType' },
    purchaseItems: [{ type: mongoose.Schema.Types.Mixed }],
    awardedQuotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  },
  {
    refs: [
      { path: 'siteTypeId', ref: 'SiteType' },
      { path: 'productTypeId', ref: 'ProductType' },
      { path: 'awardedQuotationId', ref: 'Quotation' }
    ],
    hooks: {
      preSave: async function (next) {
        // Auto-fill raisedByName from the Employee who created this request
        if (!this.raisedByName && this.createdBy) {
          try {
            const Employee = mongoose.model('Employee');
            const emp = await Employee.findById(this.createdBy);
            if (emp && emp.empName) {
              this.raisedByName = emp.empName;
            } else {
              // Fallback: check User collection (for admin-created requests)
              const User = mongoose.model('User');
              const user = await User.findById(this.createdBy);
              if (user && user.name) {
                this.raisedByName = user.name;
              }
            }
          } catch (err) {
            console.error('Error fetching raisedByName', err);
          }
        }

        // Auto-generate indentNo
        if (!this.indentNo) {
          try {
            const SiteType = mongoose.model('SiteType');
            const site = await SiteType.findById(this.siteTypeId);
            let siteCode = 'UNK';
            if (site && site.siteType) {
              siteCode = site.siteType.substring(0, 3).toUpperCase();
            }

            const year = new Date().getFullYear().toString().slice(-2);

            const MaterialRequestModel = this.constructor;
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);

            const count = await MaterialRequestModel.countDocuments({
              companyId: this.companyId,
              createdAt: { $gte: startOfYear }
            });

            const seq = (count + 1).toString().padStart(2, '0');
            this.indentNo = `${siteCode}/${year}/${seq}`;
          } catch (err) {
            console.error('Error generating indentNo', err);
          }
        }
        next();
      }
    }
  }
);

// Propagate PM/PD approval changes to related PurchaseIndents
try {
  MaterialRequest.schema.post('save', async function (doc) {
    try {
      const PurchaseIndent = mongoose.model('PurchaseIndent');
      const filter = { $or: [{ indentNo: doc.indentNo }, { indentNo: doc._id }] };

      // Try to resolve supplierId from awarded quotation or any quotation linked to this material request
      let resolvedSupplierId = null;
      try {
        const Quotation = mongoose.model('Quotation');
        let q = null;
        if (doc.awardedQuotationId) {
          q = await Quotation.findById(doc.awardedQuotationId).lean();
        }
        if (!q) {
          q = await Quotation.findOne({ materialRequestId: doc._id }).lean();
        }
        if (q && q.supplierId) resolvedSupplierId = q.supplierId;
      } catch (err) {
        // ignore resolution errors
      }

      // Build update payload for existing indents
      const updatePayload = {
        pmPdApproval: doc.pmPdApproval,
        pmPdApprovalUpdatedAt: doc.pmPdApprovalUpdatedAt || new Date(),
      };
      if (resolvedSupplierId) updatePayload.supplierId = resolvedSupplierId;

      // Update existing indents with new approval status and supplier if available
      await PurchaseIndent.updateMany(filter, updatePayload);

      // If the material request was approved, create a PurchaseIndent snapshot if none exists
      if (doc.pmPdApproval === 'Approved') {
        try {
          const exists = await PurchaseIndent.findOne({ indentNo: doc.indentNo }).lean();
          if (!exists) {
            const payload = {
              indentDate: new Date(),
              indentNo: doc.indentNo || '',
              siteId: doc.siteTypeId || null,
              requiredDate: doc.requiredDate || null,
              productTypeId: doc.productTypeId || null,
              type: 'Regular',
              priorityId: null,
              purposeOfIndent: doc.purpose || '',
              material: doc.material || '',
              totalAmount: 0,
              indentStatus: 'Approved',
              raisedByName: doc.raisedByName || '',
              pmPdApproval: doc.pmPdApproval,
              pmPdApprovalUpdatedAt: doc.pmPdApprovalUpdatedAt || new Date(),
              companyId: doc.companyId,
              createdBy: doc.createdBy,
            };
            if (resolvedSupplierId) payload.supplierId = resolvedSupplierId;
            await PurchaseIndent.create(payload);
          }
        } catch (err) {
          // ignore create errors, log for debugging
          console.error('Failed to auto-create PurchaseIndent for approved MaterialRequest', err);
        }
      }
    } catch (err) {
      console.error('Failed to propagate pmPdApproval to PurchaseIndent', err);
    }
  });
} catch (e) {
  // ignore if attaching hook fails in some environments
}

export const Quotation = createMasterModel(
  'Quotation',
  {
    materialRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    quoteRefNo: { type: String, required: true },
    expectedDateOfDelivery: { type: String, required: true },
    paymentTerms: { type: String, required: true },
    freight: { type: String, required: true },
    loading: { type: String, required: true },
    unloading: { type: String, required: true },
    quotationItems: [{
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
      rate: { type: Number, default: 0 },
      taxPercent: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      isSelected: { type: Boolean, default: false }
    }],
    fileUrl: { type: [String] },
    termsAndConditions: [{ type: String }],
  },
  {
    refs: [
      { path: 'materialRequestId', ref: 'MaterialRequest' },
      { path: 'supplierId', ref: 'Supplier' }
    ]
  }
);

export const MASTER_REGISTRY = {
  departments: { model: Department, label: 'Department' },
  designations: { model: Designation, label: 'Designation' },
  clients: { model: Client, label: 'Client' },
  suppliers: { model: Supplier, label: 'Supplier' },
  labourers: { model: Labourer, label: 'Labourer' },
  employees: { model: Employee, label: 'Employee' },
  expenses: { model: Expense, label: 'Expense' },
  'item-categories': { model: ItemCategory, label: 'Item Category' },
  'item-uoms': { model: ItemUOM, label: 'Item UOM' },
  items: { model: Item, label: 'Item' },
  'labour-types': { model: LabourType, label: 'Labour Type' },
  'site-types': { model: SiteType, label: 'Site Type' },
  sites: { model: Site, label: 'Site' },
  'vehicle-types': { model: VehicleType, label: 'Vehicle Type' },
  trucks: { model: Truck, label: 'Truck' },
  works: { model: Work, label: 'Work' },
  'filling-stations': { model: FillingStation, label: 'Filling Station' },
  'material-requests': { model: MaterialRequest, label: 'Material Request' },
  'purchase-orders': { model: PurchaseOrder, label: 'Purchase Order' },
  purchases: { model: Purchase, label: 'Purchase' },
  taxes: { model: Tax, label: 'Tax' },
  charges: { model: Charge, label: 'Charge' },
  'product-types': { model: ProductType, label: 'Product Type' },
  priorities: { model: Priority, label: 'Priority' },
  'payment-types': { model: PaymentType, label: 'Payment Type' },
  'purchase-indents': { model: PurchaseIndent, label: 'Purchase Indent' },
  quotations: { model: Quotation, label: 'Quotation' },
};
