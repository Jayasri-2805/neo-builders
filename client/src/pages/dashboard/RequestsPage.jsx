import { Fragment, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Eye, CheckCircle, ArrowLeft, Plus, FileText, FileUp, X, Edit, Trash2 } from 'lucide-react';
import { materialRequestApi, productTypeApi, itemCategoryApi, itemUomApi, taxApi, itemApi, supplierApi, quotationApi, comparisonApi, uploadAttachment } from '../../api/masterApi';

const normalizeTaxValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;

  const cleanedValue = String(value).trim().replace(/%/g, '').replace(/,/g, '');
  const parsedValue = Number(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const isSameId = (a, b) => {
  if (!a || !b) return false;
  const normalize = (value) => {
    if (typeof value === 'object') {
      return String(value._id || value.id || value).trim();
    }
    return String(value).trim();
  };
  return normalize(a) === normalize(b);
};

const getItemUomName = (item, uomList = []) => {
  if (!item) return '—';
  if (typeof item.itemUomId === 'object' && item.itemUomId !== null) {
    return item.itemUomId.uomName || item.itemUomId.code || item.itemUomId.name || '—';
  }
  if (typeof item.itemUomId === 'string' && item.itemUomId) {
    const matchedUom = uomList.find((uom) => String(uom._id) === String(item.itemUomId));
    return matchedUom?.uomName || matchedUom?.code || item.itemUomId;
  }
  return '—';
};

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [productTypes, setProductTypes] = useState([]);
  
  const [itemCategories, setItemCategories] = useState([]);
  const [itemUOMs, setItemUOMs] = useState([]);
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  
  const [formData, setFormData] = useState({
    categoryId: '',
    itemCode: '',
    itemName: '',
    uomId: '',
    taxValue: '',
    specification: '',
    quantity: '',
    boqRate: '',
    approvedQty: '',
    remarks: '',
    selectedItemId: ''
  });
  
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [isAddTenderedItemPopupOpen, setIsAddTenderedItemPopupOpen] = useState(false);
  const [editingTenderedItemIndex, setEditingTenderedItemIndex] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [isQuotationPanelOpen, setIsQuotationPanelOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [dateInputType, setDateInputType] = useState('date');
  const [isTablet, setIsTablet] = useState(window.innerWidth > 900 && window.innerWidth <= 1200);
  const [suppliers, setSuppliers] = useState([]);
  const [quotationList, setQuotationList] = useState([]);
  const [editingQuotationId, setEditingQuotationId] = useState(null);
  const [quotationToDelete, setQuotationToDelete] = useState(null);
  const [isSubmittingQuotation, setIsSubmittingQuotation] = useState(false);
  const fileInputRef = useRef(null);
  const comparisonLoadedRequestId = useRef(null);
  const comparisonRef = useRef(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [filterText, setFilterText] = useState('');
  const [imageViewerUrl, setImageViewerUrl] = useState(null);
  const [qFormData, setQFormData] = useState({
    supplierId: '',
    quoteRefNo: '',
    expectedDateOfDelivery: '',
    paymentTerms: '',
    freight: '',
    loading: '',
    unloading: '',
    file: [],
    existingFileUrls: [],
    acceptedTerms: [],
    termsAndConditions: '',
    quotationItems: []
  });
  const [showComparison, setShowComparison] = useState(false);
  const [isSavingComparison, setIsSavingComparison] = useState(false);
  const [isSendingForMdApproval, setIsSendingForMdApproval] = useState(false);
  const navigate = useNavigate();

  const TERMS = [
    "The Total Amount is inclusive of GST & Transport.",
    "Delivery Type : Delivery to our project site end.",
    "Quality : Quality is a main criteria. If there is any defect/rejection, the same should be replaced immediately at free of cost.",
    "Sign and return the duplicate copy of this order to us immediately as a token of your acceptance.",
    "Send one copy of your invoice to our Head Office and a duplicate invoice copy to our site address. Mention our Purchase Order Number in your invoice.",
    "Mention your GST No. and AID GST No. in your invoice."
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleFilterText = (e) => setFilterText(e.detail || '');
    window.addEventListener('filter-text', handleFilterText);
    return () => window.removeEventListener('filter-text', handleFilterText);
  }, []);

  const openPanel = (request) => {
    setActiveRequest(request);
    setSearchParams({ requestId: request._id });
    setTimeout(() => setIsPanelOpen(true), 10);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSearchParams({});
    setTimeout(() => setActiveRequest(null), 400);
  };

  const openQuotationPanel = () => {
    setSearchParams(prev => {
      prev.set('quotation', 'true');
      return prev;
    });
    setIsQuotationPanelOpen(true);
  };

  const closeQuotationPanel = () => {
    setSearchParams(prev => {
      prev.delete('quotation');
      return prev;
    });
    setIsQuotationPanelOpen(false);
  };

  const filteredRequests = useMemo(() => {
    const search = filterText.trim().toLowerCase();
    if (!search) return requests;
    return requests.filter((item) => {
      const site = getSiteName(item).toLowerCase();
      const material = (item.material || '').toLowerCase();
      const raisedBy = getEmployeeName(item).toLowerCase();
      const indent = (item.indentNo || '').toLowerCase();
      return site.includes(search) || material.includes(search) || raisedBy.includes(search) || indent.includes(search);
    });
  }, [requests, filterText]);

  const clearQuotationForm = () => {
    setEditingQuotationId(null);
    setQFormData({
      supplierId: '', quoteRefNo: '', expectedDateOfDelivery: '', paymentTerms: '',
      freight: '', loading: '', unloading: '', file: [], existingFileUrls: [], acceptedTerms: [], termsAndConditions: '', quotationItems: []
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    const isQuot = searchParams.get('quotation') === 'true';
    if (!requestId || requests.length === 0) return;

    const req = requests.find(r => r._id === requestId);
    if (!req) return;

    const mergedRequest = { ...req };
    if (activeRequest && activeRequest._id === req._id && Array.isArray(activeRequest.purchaseItems) && activeRequest.purchaseItems.length > 0) {
      const incomingItems = Array.isArray(req.purchaseItems) ? req.purchaseItems : [];
      const activeHasMetadata = activeRequest.purchaseItems.some((item) => item && typeof item === 'object' && (item.quantity !== undefined || item.boqRate !== undefined));
      const incomingHasMetadata = incomingItems.some((item) => item && typeof item === 'object' && (item.quantity !== undefined || item.boqRate !== undefined));
      if (activeHasMetadata && !incomingHasMetadata) {
        mergedRequest.purchaseItems = activeRequest.purchaseItems;
      }
    }

    setActiveRequest(mergedRequest);
    setIsPanelOpen(!isQuot);
    setIsQuotationPanelOpen(isQuot);
  }, [searchParams, requests]);

  const fetchRequests = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    try {
      const [res, ptRes, catRes, uomRes, taxRes, itemRes, suppRes] = await Promise.all([
        materialRequestApi.listAll(),
        productTypeApi.listAll(),
        itemCategoryApi.listAll(),
        itemUomApi.listAll(),
        taxApi.listAll(),
        itemApi.listAll(),
        supplierApi.listAll()
      ]);
      
      if (ptRes.data.success) setProductTypes(ptRes.data.data || []);
      if (catRes.data.success) setItemCategories(catRes.data.data || []);
      if (uomRes.data.success) setItemUOMs(uomRes.data.data || []);
      if (taxRes.data.success) setTaxes(taxRes.data.data || []);
      if (itemRes?.data?.success) setItems(itemRes.data.data || []);
      if (suppRes.data.success) setSuppliers(suppRes.data.data || []);
      
      if (res.data.success) {
        const sortedData = (res.data.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRequests(sortedData);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      if (isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const normalizePurchaseItem = (item) => {
    if (typeof item === 'object') return item;
    const refItem = items.find((it) => String(it._id) === String(item));
    return refItem ? { ...refItem, itemCategoryId: refItem.itemCategoryId, itemUomId: refItem.itemUomId } : { _id: item };
  };

  const buildQuotationItemsFromRequest = () => {
    if (!activeRequest || !Array.isArray(activeRequest.purchaseItems)) return [];
    return activeRequest.purchaseItems.map((item) => {
      const normalized = normalizePurchaseItem(item);
      return {
        itemId: getRequestItemId(normalized) || item,
        rate: '',
        taxPercent: normalized.tax !== undefined ? String(normalizeTaxValue(normalized.tax)) : '18',
        taxAmount: '',
        total: '',
        isSelected: false
      };
    });
  };

  const handleAddTenderedItem = async () => {
    if (!formData.selectedItemId || !formData.quantity || !formData.boqRate) {
      alert('Please select an item from the master list and enter Quantity and BOQ Rate.');
      return;
    }

    try {
      const createdItem = items.find((it) => String(it._id) === String(formData.selectedItemId));
      if (!createdItem) {
        showToast('Selected item was not found in the master list.', 'error');
        return;
      }

      if (createdItem && activeRequest) {
        const tenderItem = {
          ...createdItem,
          itemCategoryId: formData.categoryId,
          itemUomId: formData.uomId,
          itemCode: formData.itemCode,
          itemName: formData.itemName,
          specification: formData.specification,
          quantity: Number(formData.quantity),
          boqRate: formData.boqRate,
          approvedQty: formData.approvedQty || formData.quantity,
          remarks: formData.remarks || ''
        };

        const existingItems = Array.isArray(activeRequest.purchaseItems)
          ? activeRequest.purchaseItems.map(normalizePurchaseItem)
          : [];

        let updatedItems = [...existingItems];
        if (editingTenderedItemIndex !== null && editingTenderedItemIndex >= 0 && editingTenderedItemIndex < updatedItems.length) {
          updatedItems[editingTenderedItemIndex] = tenderItem;
        } else {
          updatedItems.push(tenderItem);
        }

        await materialRequestApi.update(activeRequest._id, {
          purchaseItems: updatedItems
        });

        const updatedRequest = {
          ...activeRequest,
          purchaseItems: updatedItems
        };
        setActiveRequest(updatedRequest);
        setRequests((prevRequests) => prevRequests.map((req) => (req._id === activeRequest._id ? updatedRequest : req)));
      }

      setEditingTenderedItemIndex(null);
      setFormData({
        categoryId: '',
        itemCode: '',
        itemName: '',
        uomId: '',
        taxValue: '',
        specification: '',
        quantity: '',
        boqRate: '',
        approvedQty: '',
        remarks: '',
        selectedItemId: ''
      });
      showToast('Tender item added successfully!', 'success');
    } catch (error) {
      console.error('Failed to add tendered item:', error);
      showToast('Failed to add item. Ensure code is unique.', 'error');
    }
  };

  const handleRemoveTenderedItem = async (itemIdOrIndex) => {
    if (!activeRequest) return;
    const existingItems = Array.isArray(activeRequest.purchaseItems)
      ? activeRequest.purchaseItems.map(normalizePurchaseItem)
      : [];

    const updatedItems = existingItems.filter((item, index) => {
      if (typeof itemIdOrIndex === 'number') {
        return index !== itemIdOrIndex;
      }
      return String(item._id || item).trim() !== String(itemIdOrIndex).trim();
    });

    try {
      await materialRequestApi.update(activeRequest._id, {
        purchaseItems: updatedItems
      });
    } catch (updateError) {
      console.error('Failed to remove tendered item from request:', updateError);
    }

    const updatedRequest = { ...activeRequest, purchaseItems: updatedItems };
    setActiveRequest(updatedRequest);
    setRequests((prevRequests) => prevRequests.map((req) => (req._id === activeRequest._id ? updatedRequest : req)));
  };

  const handlePurchaseItemFieldChange = (index, field, value) => {
    if (!activeRequest) return;
    const existingItems = Array.isArray(activeRequest.purchaseItems)
      ? activeRequest.purchaseItems.map(normalizePurchaseItem)
      : [];

    const updatedItems = existingItems.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item };
      if (field === 'approvedQty') {
        updated.approvedQty = value === '' ? undefined : Number(value);
      } else if (field === 'remarks') {
        updated.remarks = value;
      }
      return updated;
    });

    const updatedRequest = { ...activeRequest, purchaseItems: updatedItems };
    setActiveRequest(updatedRequest);
    setRequests((prevRequests) => prevRequests.map((req) => (req._id === activeRequest._id ? updatedRequest : req)));
  };

  const handlePurchaseItemFieldBlur = async () => {
    if (!activeRequest) return;
    const updatedItems = Array.isArray(activeRequest.purchaseItems)
      ? activeRequest.purchaseItems.map(normalizePurchaseItem)
      : [];

    try {
      await materialRequestApi.update(activeRequest._id, { purchaseItems: updatedItems });
    } catch (error) {
      console.error('Failed to save purchase item changes:', error);
      showToast('Failed to save item changes. Please try again.', 'error');
    }
  };

  const handleEditTenderedItem = (item, index) => {
    if (!item) return;

    setFormData({
      selectedItemId: item._id || item.selectedItemId || '',
      categoryId: typeof item.itemCategoryId === 'object' ? (item.itemCategoryId?._id || item.itemCategoryId) : item.itemCategoryId || '',
      itemCode: item.code || item.itemCode || '',
      itemName: item.itemName || '',
      uomId: typeof item.itemUomId === 'object' ? (item.itemUomId?._id || item.itemUomId) : item.itemUomId || '',
      taxValue: item.tax !== undefined ? String(item.tax) : '',
      specification: item.specification || '',
      quantity: item.quantity !== undefined ? String(item.quantity) : '',
      boqRate: item.boqRate || '',
      approvedQty: item.approvedQty !== undefined ? String(item.approvedQty) : '',
      remarks: item.remarks || ''
    });
    setEditingTenderedItemIndex(index);
    setIsAddTenderedItemPopupOpen(true);
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const buildQuotationPayload = (formData, fileUrls = []) => {
    const normalizedTerms = [
      ...(Array.isArray(formData.acceptedTerms) ? formData.acceptedTerms : []),
      ...(typeof formData.termsAndConditions === 'string' ? formData.termsAndConditions.split(/\r?\n/) : []),
    ]
      .map((term) => String(term).trim())
      .filter(Boolean)
      .filter((term, index, arr) => arr.indexOf(term) === index);

    const normalizedQuotationItems = Array.isArray(formData.quotationItems)
      ? formData.quotationItems.map((item, index) => {
          const rate = parseNumericField(item.rate);
          const taxPercent = parseNumericField(item.taxPercent);
          const requestItem = getRequestItemById(item.itemId) || activeRequest?.purchaseItems?.[index];
          const quantity = getRequestItemQuantity(requestItem);
          const boqRate = getBoqRate(requestItem);
          if (boqRate !== null && rate > boqRate) {
            throw new Error(`Supplier rate for ${requestItem?.itemName || 'an item'} cannot exceed the BOQ rate of ${boqRate}.`);
          }
          const amount = rate * quantity;
          const taxAmount = amount * taxPercent / 100;
          const total = amount + taxAmount;
          return {
            itemId: item.itemId,
            rate,
            taxPercent,
            taxAmount,
            total,
            isSelected: item.isSelected === true,
          };
        })
      : [];

    return {
      materialRequestId: activeRequest?._id,
      supplierId: formData.supplierId,
      quoteRefNo: formData.quoteRefNo,
      expectedDateOfDelivery: formData.expectedDateOfDelivery,
      paymentTerms: formData.paymentTerms,
      freight: formData.freight,
      loading: formData.loading,
      unloading: formData.unloading,
      fileUrl: fileUrls,
      termsAndConditions: normalizedTerms,
      quotationItems: normalizedQuotationItems,
    };
  };

  const handleQuotationSubmit = async () => {
    if (isSubmittingQuotation) return;
    setIsSubmittingQuotation(true);
    if (!qFormData.supplierId || !qFormData.quoteRefNo || !qFormData.expectedDateOfDelivery || !qFormData.paymentTerms || qFormData.freight === '' || qFormData.loading === '' || qFormData.unloading === '') {
      showToast('Please fill all fields', 'error');
      setIsSubmittingQuotation(false);
      return;
    }

    try {
      let finalFileUrls = qFormData.existingFileUrls || [];
      if (qFormData.file && qFormData.file.length > 0) {
        const formPayload = new FormData();
        qFormData.file.forEach(f => formPayload.append('files', f));
        const uploadRes = await uploadAttachment(formPayload);
        if (uploadRes.data.status === 'success' && uploadRes.data.data.fileUrls && uploadRes.data.data.fileUrls.length > 0) {
          finalFileUrls = [...uploadRes.data.data.fileUrls, ...finalFileUrls];
        }
      }

      const payload = buildQuotationPayload(qFormData, finalFileUrls);

      console.debug('Quotation payload', payload);
      const normalizeQuotationData = (quote) => ({
        ...quote,
        quotationItems: normalizeQuotationItems(quote.quotationItems)
      });

      if (editingQuotationId) {
        await quotationApi.update(editingQuotationId, payload);
        showToast('Quotation updated successfully!', 'success');
        setQuotationList((prev) => prev.map((q) => (String(q._id) === String(editingQuotationId) ? normalizeQuotationData({ ...q, ...payload }) : q)));
        setEditingQuotationId(null);
      } else {
        const res = await quotationApi.create(payload);
        showToast('Quotation submitted successfully!', 'success');
        if (res.data.success && res.data.data) {
          setQuotationList((prev) => [...prev, normalizeQuotationData(res.data.data)]);
        } else {
          fetchQuotations();
        }
      }
      
      setQFormData({
        supplierId: '', quoteRefNo: '', expectedDateOfDelivery: '', paymentTerms: '',
        freight: '', loading: '', unloading: '', file: [], existingFileUrls: [], acceptedTerms: [], termsAndConditions: '', quotationItems: buildQuotationItemsFromRequest()
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to submit quotation:', error);
      const resp = error?.response?.data;
      let serverMsg = resp?.message || error?.message || 'Failed to save quotation. Please try again.';
      if (resp && resp.errors && typeof resp.errors === 'object') {
        const details = Object.entries(resp.errors).map(([k, v]) => (typeof v === 'string' ? v : (v?.message || JSON.stringify(v)))).join('; ');
        serverMsg = `${serverMsg}: ${details}`;
      }
      showToast(serverMsg, 'error');
    } finally {
      setIsSubmittingQuotation(false);
    }
  };

  const handleEditClick = (q) => {
    setEditingQuotationId(q._id);
    setQFormData({
      supplierId: q.supplierId?._id || q.supplierId || '',
      quoteRefNo: q.quoteRefNo || '',
      expectedDateOfDelivery: q.expectedDateOfDelivery || '',
      paymentTerms: q.paymentTerms || '',
      freight: q.freight || '',
      loading: q.loading || '',
      unloading: q.unloading || '',
      file: [], // Keep file empty unless they want to upload new ones
      existingFileUrls: Array.isArray(q.fileUrl) ? q.fileUrl : (q.fileUrl ? [q.fileUrl] : []),
      acceptedTerms: Array.isArray(q.termsAndConditions) ? q.termsAndConditions : [],
      termsAndConditions: Array.isArray(q.termsAndConditions) ? q.termsAndConditions.join('\n') : (q.termsAndConditions || ''),
      quotationItems: Array.isArray(q.quotationItems)
        ? q.quotationItems.map((item) => ({
            itemId: item.itemId,
            rate: item.rate != null ? String(item.rate) : '',
            taxPercent: item.taxPercent != null ? String(item.taxPercent) : '',
            taxAmount: item.taxAmount != null ? String(item.taxAmount) : '',
            total: item.total != null ? String(item.total) : '',
            isSelected: item.isSelected === true
          }))
        : (activeRequest?.purchaseItems || []).map((item) => ({
            itemId: item.itemId?._id || item._id || item,
            rate: '',
            taxPercent: item.tax !== undefined ? String(item.tax) : '18',
            taxAmount: '',
            total: ''
          }))
    });
  };

  const handleAwardQuotation = async (quotationId) => {
    if (!activeRequest || !quotationId) return;
    try {
      await materialRequestApi.update(activeRequest._id, { awardedQuotationId: quotationId });
      const updatedRequest = {
        ...activeRequest,
        awardedQuotationId: quotationId,
        status: activeRequest.status,
        indentStatus: activeRequest.indentStatus,
        pmPdApproval: activeRequest.pmPdApproval,
        pmPdApprovalUpdatedAt: activeRequest.pmPdApprovalUpdatedAt
      };
      setActiveRequest(updatedRequest);
      setRequests((prevRequests) => prevRequests.map((req) => isSameId(req._id, activeRequest._id) ? updatedRequest : req));
      showToast('Quotation awarded successfully.', 'success');
    } catch (error) {
      console.error('Failed to award quotation:', error);
      showToast('Failed to award quotation.', 'error');
    }
  };

  const parseNumericField = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const normalizedValue = String(value).replace(/[^0-9.-]/g, '');
    if (!normalizedValue) return 0;

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  };

  const handleQuotationItemChange = (index, field, value) => {
    setQFormData((prev) => {
      const items = Array.isArray(prev.quotationItems) ? [...prev.quotationItems] : [];
      items[index] = {
        ...items[index],
        [field]: value
      };
      return { ...prev, quotationItems: items };
    });
  };

  const getRequestItemQuantity = (item) => {
    const normalized = normalizePurchaseItem(item);
    const qty = normalized.approvedQty !== undefined && normalized.approvedQty !== null
      ? normalized.approvedQty
      : normalized.quantity;
    return parseNumericField(qty);
  };

  const computeQuotationItemTotals = (quotationItem, requestItem) => {
    const rate = parseNumericField(quotationItem?.rate);
    const taxPercent = parseNumericField(quotationItem?.taxPercent);
    const quantity = getRequestItemQuantity(requestItem);
    const amount = rate * quantity;
    const taxAmount = amount * taxPercent / 100;
    const total = amount + taxAmount;
    return { rate, taxPercent, amount, taxAmount, total };
  };

  const getQuotationSummary = (quote) => {
    const requestItems = Array.isArray(activeRequest?.purchaseItems) ? activeRequest.purchaseItems : [];
    const summary = requestItems.reduce((acc, item) => {
      const normalizedItem = normalizePurchaseItem(item);
      const quoteItem = findQuotationItem(quote, normalizedItem);
      if (!quoteItem) return acc;
      const { amount, taxAmount } = computeQuotationItemTotals(quoteItem, normalizedItem);
      return {
        subTotal: acc.subTotal + amount,
        totalTax: acc.totalTax + taxAmount,
      };
    }, { subTotal: 0, totalTax: 0 });

    const freight = parseNumericField(quote?.freight);
    const loading = parseNumericField(quote?.loading);
    const unloading = parseNumericField(quote?.unloading);
    const grandTotal = summary.subTotal + summary.totalTax + freight + loading + unloading;

    return {
      ...summary,
      freight,
      loading,
      unloading,
      grandTotal,
    };
  };

  const normalizeItemId = (value) => {
    if (typeof value === 'object' && value !== null) {
      return String(value._id || value.id || value).trim();
    }
    return String(value || '').trim();
  };

  const normalizeQuotationItem = (item) => {
    if (!item) return item;
    const normalizedTaxPercent = item.taxPercent !== undefined && item.taxPercent !== null ? item.taxPercent : 0;
    return {
      ...item,
      itemId: normalizeItemId(item.itemId),
      rate: item.rate !== undefined && item.rate !== null ? item.rate : '',
      taxPercent: normalizedTaxPercent,
      taxAmount: item.taxAmount !== undefined && item.taxAmount !== null ? item.taxAmount : 0,
      total: item.total !== undefined && item.total !== null ? item.total : 0,
      isSelected: item.isSelected === true,
    };
  };

  const normalizeQuotationItems = (items = []) => {
    return Array.isArray(items) ? items.map(normalizeQuotationItem) : [];
  };

  const getRequestItemById = (itemId) => {
    if (!activeRequest || !Array.isArray(activeRequest.purchaseItems)) return null;
    return activeRequest.purchaseItems
      .map(normalizePurchaseItem)
      .find((item) => isSameId(getRequestItemId(item), itemId)) || null;
  };

  const getBoqRate = (requestItem) => {
    if (!requestItem || requestItem.boqRate === undefined || requestItem.boqRate === null || requestItem.boqRate === '') return null;
    const boqRate = parseNumericField(requestItem.boqRate);
    return Number.isFinite(boqRate) ? boqRate : null;
  };

  const validateQuotationRates = () => {
    for (const quote of quotationList) {
      for (const quotationItem of quote.quotationItems || []) {
        const requestItem = getRequestItemById(quotationItem.itemId);
        const boqRate = getBoqRate(requestItem);
        const supplierRate = parseNumericField(quotationItem.rate);
        if (boqRate !== null && supplierRate > boqRate) {
          showToast(`Supplier rate for ${requestItem?.itemName || 'an item'} cannot exceed the BOQ rate of ${boqRate}.`, 'error');
          return false;
        }
      }
    }
    return true;
  };

  const validateAwardSelections = () => {
    if (!Array.isArray(activeRequest?.purchaseItems) || activeRequest.purchaseItems.length === 0) {
      showToast('No purchase items are available for award.', 'error');
      return false;
    }

    const missingSelections = [];
    const missingRates = [];
    const overBudget = [];

    activeRequest.purchaseItems.forEach((item, index) => {
      const displayItem = normalizePurchaseItem(item);
      const itemId = getRequestItemId(displayItem);
      const boqRate = getBoqRate(displayItem);
      const selectedQuoteItem = quotationList.find((quote) => (quote.quotationItems || []).some((quotationItem) => isSameId(quotationItem.itemId, itemId) && quotationItem.isSelected));
      if (!selectedQuoteItem) {
        missingSelections.push(displayItem.itemName || `Item ${index + 1}`);
        return;
      }
      const quoteItem = selectedQuoteItem.quotationItems?.find((quotationItem) => isSameId(quotationItem.itemId, itemId));
      const supplierRate = parseNumericField(quoteItem?.rate);
      if (supplierRate <= 0) {
        missingRates.push(displayItem.itemName || `Item ${index + 1}`);
        return;
      }
      if (boqRate !== null && supplierRate > boqRate) {
        overBudget.push(displayItem.itemName || `Item ${index + 1}`);
      }
    });

    if (missingSelections.length > 0) {
      showToast(`Please select a supplier for: ${missingSelections.join(', ')}`, 'error');
      return false;
    }
    if (missingRates.length > 0) {
      showToast(`Please enter a rate for: ${missingRates.join(', ')}`, 'error');
      return false;
    }
    if (overBudget.length > 0) {
      showToast(`Supplier rate exceeds BOQ rate for: ${overBudget.join(', ')}`, 'error');
      return false;
    }

    return true;
  };

  const computeComparisonTotals = (rate, taxPercent, requestItem) => {
    const quantity = getRequestItemQuantity(requestItem);
    const parsedRate = rate === '' ? 0 : parseNumericField(rate);
    const parsedTaxPercent = taxPercent === '' ? 0 : parseNumericField(taxPercent);
    const amount = parsedRate * quantity;
    const taxAmount = amount * parsedTaxPercent / 100;
    const total = amount + taxAmount;
    return { taxAmount, total };
  };

  const updateQuotationItemInState = (quoteId, itemId, changes) => {
    const normalizedItemId = normalizeItemId(itemId);
    const requestItem = getRequestItemById(normalizedItemId);

    setQuotationList((prev) => prev.map((quote) => {
      if (!isSameId(quote._id, quoteId)) return quote;
      const items = Array.isArray(quote.quotationItems) ? [...quote.quotationItems] : [];
      const existingIndex = items.findIndex((qi) => isSameId(qi.itemId, normalizedItemId));
      const existingItem = items[existingIndex] || {
        itemId: normalizedItemId,
        rate: '',
        taxPercent: 0,
        taxAmount: 0,
        total: 0,
        isSelected: false,
      };
      const updatedItem = {
        ...existingItem,
        ...changes,
      };

      if (changes.rate !== undefined || changes.taxPercent !== undefined) {
        const totals = computeComparisonTotals(updatedItem.rate, updatedItem.taxPercent, requestItem);
        updatedItem.taxAmount = totals.taxAmount;
        updatedItem.total = totals.total;
      }

      if (existingIndex >= 0) {
        items[existingIndex] = updatedItem;
      } else {
        items.push(updatedItem);
      }
      return { ...quote, quotationItems: items };
    }));
  };

  const handleComparisonFieldChange = (quoteId, itemId, field, value) => {
    if (field === 'rate' || field === 'taxPercent') {
      const normalizedValue = value === '' ? '' : value;
      if (field === 'rate' && normalizedValue !== '') {
        const requestItem = getRequestItemById(itemId);
        const boqRate = getBoqRate(requestItem);
        if (boqRate !== null && parseNumericField(normalizedValue) > boqRate) {
          showToast(`Supplier rate cannot exceed the BOQ rate of ${boqRate}.`, 'error');
          return;
        }
      }
      updateQuotationItemInState(quoteId, itemId, { [field]: normalizedValue });
      return;
    }
    updateQuotationItemInState(quoteId, itemId, { [field]: value });
  };

  const handleComparisonToggleGST = (quoteId, itemId, enabled) => {
    const quote = quotationList.find((q) => isSameId(q._id, quoteId));
    if (!quote) return;
    const quoteItem = quote.quotationItems?.find((qi) => isSameId(qi.itemId, itemId));
    const nextTaxPercent = enabled ? (parseNumericField(quoteItem?.taxPercent) > 0 ? parseNumericField(quoteItem.taxPercent) : 18) : 0;
    updateQuotationItemInState(quoteId, itemId, { taxPercent: nextTaxPercent });
  };

  const handleMaterialSelectionChange = (quoteId, itemId, isSelected) => {
    const normalizedItemId = normalizeItemId(itemId);
    setQuotationList((prev) => prev.map((quote) => {
      const items = Array.isArray(quote.quotationItems) ? [...quote.quotationItems] : [];
      return {
        ...quote,
        quotationItems: items.map((quotationItem) => {
          if (!isSameId(quotationItem.itemId, normalizedItemId)) return quotationItem;
          return {
            ...quotationItem,
            isSelected: isSameId(quote._id, quoteId) && isSelected,
          };
        }),
      };
    }));

    setQuotationList((prev) => prev.map((quote) => {
      const items = Array.isArray(quote.quotationItems) ? [...quote.quotationItems] : [];
      return {
        ...quote,
        quotationItems: items.map((quotationItem) => {
          if (!isSameId(quotationItem.itemId, normalizedItemId)) return quotationItem;
          if (isSameId(quote._id, quoteId)) return quotationItem;
          return {
            ...quotationItem,
            isSelected: false,
          };
        }),
      };
    }));
  };

  const prepareQuotationPayload = (quote) => {
    const quotationItems = Array.isArray(quote.quotationItems) ? quote.quotationItems.map((item) => {
      const parsedRate = parseNumericField(item.rate);
      const parsedTaxPercent = parseNumericField(item.taxPercent);
      const requestItem = normalizePurchaseItem(activeRequest?.purchaseItems?.find((reqItem) => isSameId(normalizePurchaseItem(reqItem)._id, item.itemId)));
      const quantity = getRequestItemQuantity(requestItem);
      const amount = parsedRate * quantity;
      const taxAmount = amount * parsedTaxPercent / 100;
      const total = amount + taxAmount;
      return {
        itemId: item.itemId,
        rate: parsedRate,
        taxPercent: parsedTaxPercent,
        taxAmount,
        total,
        isSelected: item.isSelected === true,
      };
    }) : [];

    const normalizedTerms = [
      ...(Array.isArray(quote.acceptedTerms) ? quote.acceptedTerms : []),
      ...(Array.isArray(quote.termsAndConditions) ? quote.termsAndConditions : []),
      ...(typeof quote.termsAndConditions === 'string' ? quote.termsAndConditions.split(/\r?\n/) : []),
    ]
      .map((term) => String(term).trim())
      .filter(Boolean)
      .filter((term, index, arr) => arr.indexOf(term) === index);

    return {
      supplierId: quote.supplierId?._id || quote.supplierId,
      quoteRefNo: quote.quoteRefNo || '',
      expectedDateOfDelivery: quote.expectedDateOfDelivery || '',
      paymentTerms: quote.paymentTerms || '',
      freight: quote.freight || '',
      loading: quote.loading || '',
      unloading: quote.unloading || '',
      fileUrl: Array.isArray(quote.fileUrl) ? quote.fileUrl : (quote.fileUrl ? [quote.fileUrl] : []),
      termsAndConditions: normalizedTerms,
      quotationItems,
    };
  };

  const saveComparisonChart = async ({ generatePo = false } = {}) => {
    if (!quotationList || quotationList.length === 0) return false;
    if (!validateQuotationRates()) return false;
    if (generatePo && !validateAwardSelections()) return false;
    setIsSavingComparison(true);
    try {
      const savedQuotationResponses = await Promise.all(quotationList.map((quote) => {
        const payload = prepareQuotationPayload(quote);
        return quotationApi.update(quote._id, payload);
      }));

      if (activeRequest) {
        const savedQuotations = savedQuotationResponses
          .map((response) => response?.data?.data)
          .filter(Boolean);
        const quotationsForAward = savedQuotations.length === quotationList.length
          ? savedQuotations
          : quotationList;
        const selectedQuotation = quotationsForAward.find((quote) => (quote.quotationItems || []).some((item) => item.isSelected));
        const selectedQuotationId = activeRequest.awardedQuotationId || selectedQuotation?._id || null;
        const comparisonPayload = {
          comparisonStatus: activeRequest.comparisonStatus === 'Pending' ? 'Compared' : activeRequest.comparisonStatus || 'Compared',
          comparisonNo: activeRequest.comparisonNo || `CMP-${activeRequest.indentNo || activeRequest._id}`,
          ...(selectedQuotationId ? { awardedQuotationId: selectedQuotationId } : {}),
        };
        const updatedRequestResponse = await materialRequestApi.update(activeRequest._id, comparisonPayload);
        const updatedRequestData = updatedRequestResponse?.data?.data;
        if (updatedRequestData) {
          setActiveRequest(updatedRequestData);
          setRequests((prev) => prev.map((req) => isSameId(req._id, updatedRequestData._id) ? updatedRequestData : req));
        }
      }

      if (generatePo) {
        const awardSelections = quotationList.flatMap((quote) => (quote.quotationItems || []).filter((item) => item.isSelected).map((item) => ({ quoteId: quote._id, itemId: item.itemId })));
        const poResponse = await purchaseOrderApi.generate({ materialRequestId: activeRequest?._id, awardSelections });
        const poData = poResponse?.data?.data;
        if (poData?._id) {
          showToast('Quote saved and purchase order updated successfully.', 'success');
          navigate('/purchase/orders');
          return true;
        }
      }

      showToast('Quotation comparison saved successfully.', 'success');
      return true;
    } catch (error) {
      console.error('Failed to save comparison chart:', error);
      showToast('Failed to save comparison chart. Please try again.', 'error');
      return false;
    } finally {
      setIsSavingComparison(false);
    }
  };

  const handleSaveQuote = async () => {
    await saveComparisonChart({ generatePo: false });
  };

  const handlePrintComparison = () => {
    document.body.classList.add('print-comparison-mode');
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove('print-comparison-mode');
    }, 250);
  };

  const handleSendForMdApproval = async () => {
    if (!activeRequest) return;

    const selectedItems = quotationList.flatMap((quote) => (quote.quotationItems || [])
      .filter((item) => item.isSelected)
      .map((item) => ({ quoteId: quote._id, itemId: item.itemId, rate: item.rate })));

    if (selectedItems.length === 0) {
      showToast('Please select supplier items before sending for MD approval.', 'error');
      return;
    }

    const missingSelections = Array.isArray(activeRequest.purchaseItems) && activeRequest.purchaseItems.some((item) => {
      const normalized = normalizePurchaseItem(item);
      const itemId = getRequestItemId(normalized);
      return !selectedItems.some((selected) => isSameId(selected.itemId, itemId));
    });
    if (missingSelections) {
      showToast('Please select a supplier for every requested item before sending for MD approval.', 'error');
      return;
    }

    const invalidRates = selectedItems.some((selected) => Number.isNaN(parseNumericField(selected.rate)) || parseNumericField(selected.rate) <= 0);
    if (invalidRates) {
      showToast('Please enter valid rates for all selected supplier items before sending for MD approval.', 'error');
      return;
    }

    setIsSendingForMdApproval(true);
    try {
      await saveComparisonChart({ generatePo: false });
      const response = await comparisonApi.sendForMdApproval(activeRequest._id);
      const updatedRequest = response?.data?.data;
      if (updatedRequest) {
        setActiveRequest(updatedRequest);
        setRequests((prev) => prev.map((req) => isSameId(req._id, updatedRequest._id) ? updatedRequest : req));
      }
      showToast('Comparison sent for MD approval.', 'success');
    } catch (error) {
      console.error('Failed to send for MD approval:', error);
      showToast('Failed to send for MD approval. Please try again.', 'error');
    } finally {
      setIsSendingForMdApproval(false);
    }
  };

  const handleDownloadComparisonPdf = async () => {
    if (!quotationList || quotationList.length === 0 || !activeRequest) return;
    if (activeRequest.mdApprovalStatus !== 'Approved' && activeRequest.mdApproval !== 'Approved') {
      showToast('PDF download is available only after MD approval.', 'error');
      return;
    }

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `Quotation Comparison${activeRequest.indentNo ? ` - ${activeRequest.indentNo}` : ''}`;
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(11);

    const requestDetails = [
      `Request ID: ${activeRequest._id}`,
      `Indent No: ${activeRequest.indentNo || 'N/A'}`,
      `Site: ${getSiteName(activeRequest)}`,
      `Material: ${activeRequest.material || 'N/A'}`,
      `Created: ${activeRequest.createdAt ? new Date(activeRequest.createdAt).toLocaleString('en-GB') : 'N/A'}`,
    ];

    requestDetails.forEach((line, index) => {
      doc.text(line, 14, 30 + index * 7);
    });

    let y = 30 + requestDetails.length * 7 + 10;
    const sectionSpacing = 8;

    quotationList.forEach((quote, quoteIndex) => {
      if (y > 180) {
        doc.addPage();
        y = 20;
      }

      const supplierName = getSupplierName(quote);
      const totalValue = getQuotationTotal(quote);

      doc.setFontSize(12);
      doc.text(`Quote ${quoteIndex + 1}: ${supplierName}`, 14, y);
      y += sectionSpacing;
      doc.setFontSize(10);
      doc.text(`Quote Ref No: ${quote.quoteRefNo || 'N/A'}`, 14, y);
      doc.text(`Delivery Date: ${quote.expectedDateOfDelivery || 'N/A'}`, 100, y);
      y += sectionSpacing;
      doc.text(`Payment Terms: ${quote.paymentTerms || 'N/A'}`, 14, y);
      doc.text(`Freight: ${quote.freight || 'N/A'}`, 100, y);
      y += sectionSpacing;
      doc.text(`Loading: ${quote.loading || 'N/A'}`, 14, y);
      doc.text(`Unloading: ${quote.unloading || 'N/A'}`, 100, y);
      y += sectionSpacing;
      doc.text(`Total Estimate: ${Number.isFinite(totalValue) ? totalValue.toFixed(2) : '0.00'}`, 14, y);
      y += sectionSpacing + 4;

      const terms = Array.isArray(quote.termsAndConditions) ? quote.termsAndConditions : [];
      if (terms.length > 0) {
        doc.setFontSize(10);
        doc.text('Terms & Conditions:', 14, y);
        y += sectionSpacing;
        terms.forEach((term) => {
          if (y > 180) {
            doc.addPage();
            y = 20;
          }
          const lines = doc.splitTextToSize(term, 180);
          doc.text(lines, 18, y);
          y += lines.length * 6;
        });
        y += 4;
      }

      if (y > 180 && quoteIndex < quotationList.length - 1) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`${activeRequest.indentNo || activeRequest._id}-comparison.pdf`);
  };

  const getSupplierName = (quote) => {
    if (!quote || quote.supplierId == null) return 'Supplier';
    if (typeof quote.supplierId === 'string') {
      return suppliers.find((sup) => String(sup._id) === String(quote.supplierId))?.companyName || 'Supplier';
    }
    return quote.supplierId.companyName || quote.supplierId.name || 'Supplier';
  };

  const getRequestItemId = (item) => {
    if (!item) return '';
    return normalizeItemId(item.itemId?._id || item.itemId || item._id || item);
  };

  const findQuotationItem = (quote, requestItem) => {
    if (!quote || !Array.isArray(quote.quotationItems) || !requestItem) return null;
    const itemId = getRequestItemId(requestItem);
    return quote.quotationItems.find((qi) => isSameId(qi.itemId, itemId));
  };

  const getQuotationTotal = (q) => {
    const requestItems = Array.isArray(activeRequest?.purchaseItems) ? activeRequest.purchaseItems : [];
    const itemTotal = requestItems.reduce((sum, item) => {
      const normalizedItem = normalizePurchaseItem(item);
      const quoteItem = findQuotationItem(q, normalizedItem);
      if (!quoteItem) return sum;
      const { total } = computeQuotationItemTotals(quoteItem, normalizedItem);
      return sum + total;
    }, 0);
    return itemTotal;
  };

  const getLowestQuotation = () => {
    if (!quotationList || quotationList.length === 0) return null;
    return quotationList.reduce((best, current) => {
      if (!best) return current;
      const bestTotal = getQuotationTotal(best);
      const currentTotal = getQuotationTotal(current);
      if (currentTotal < bestTotal) return current;
      if (currentTotal > bestTotal) return best;

      const bestCreated = best.createdAt ? new Date(best.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      const currentCreated = current.createdAt ? new Date(current.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      return currentCreated < bestCreated ? current : best;
    }, null);
  };

  const handleTermToggle = (term) => {
    setQFormData(prev => {
      const isChecked = prev.acceptedTerms.includes(term);
      if (isChecked) {
        return { ...prev, acceptedTerms: prev.acceptedTerms.filter(t => t !== term) };
      } else {
        return { ...prev, acceptedTerms: [...prev.acceptedTerms, term] };
      }
    });
  };

  const handleShowComparison = () => {
    setShowComparison(true);
    window.requestAnimationFrame(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const fetchQuotations = useCallback(async (requestId) => {
    if (!requestId) return;
    try {
      const res = await quotationApi.list({ materialRequestId: requestId, limit: 1000 });
      if (res.data.success) {
        const normalizedData = (res.data.data || []).map((quote) => ({
          ...quote,
          quotationItems: normalizeQuotationItems(quote.quotationItems)
        }));
        setQuotationList(normalizedData);
      }
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
    }
  }, []);

  const handleDeleteClick = (id) => {
    setQuotationToDelete(id);
  };

  const confirmDeleteQuotation = async () => {
    if (!quotationToDelete) return;
    try {
      await quotationApi.remove(quotationToDelete);
      setQuotationList((prev) => prev.filter((q) => String(q._id) !== String(quotationToDelete)));
      showToast('Quotation deleted successfully', 'success');
    } catch (err) {
      console.error('Failed to delete quotation:', err);
      showToast('Failed to delete quotation.', 'error');
    }
    setQuotationToDelete(null);
  };

  useEffect(() => {
    if (!isQuotationPanelOpen || !activeRequest) return;
    if (comparisonLoadedRequestId.current === activeRequest._id) return;
    fetchQuotations(activeRequest._id);
    comparisonLoadedRequestId.current = activeRequest._id;
  }, [isQuotationPanelOpen, activeRequest, fetchQuotations]);

  useEffect(() => {
    if (!showComparison || !activeRequest) return;
    if (comparisonLoadedRequestId.current === activeRequest._id && quotationList.length > 0) return;
    fetchQuotations(activeRequest._id);
    comparisonLoadedRequestId.current = activeRequest._id;
  }, [showComparison, activeRequest, fetchQuotations, quotationList.length]);

  useEffect(() => {
    if (showComparison && quotationList.length > 0) {
      window.requestAnimationFrame(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [showComparison, quotationList.length]);

  const getSiteName = (item) => {
    if (item.siteTypeId && item.siteTypeId.siteType) {
      return item.siteTypeId.siteType;
    }
    return item.siteTypeId || 'Unknown Site';
  };

  const getProductTypeName = (item) => {
    if (!item.productTypeId) {
      const noneType = productTypes.find(pt => pt.productType?.toLowerCase() === 'none');
      return noneType ? noneType.productType : 'None';
    }
    if (typeof item.productTypeId === 'object' && item.productTypeId.productType) {
      return item.productTypeId.productType;
    }
    const found = productTypes.find(pt => pt._id === item.productTypeId);
    return found ? found.productType : 'None';
  };

  const typeOptions = ['None', 'Asset', 'Consumables'].map((label) => {
    const found = productTypes.find(pt => pt.productType?.toLowerCase() === label.toLowerCase());
    return {
      label,
      value: found?._id || label.toLowerCase(),
    };
  });

  const getEmployeeName = (item) => {
    return item.raisedByName || 'Unknown';
  };

  const getRaisedByDisplay = (item) => {
    const name = getEmployeeName(item).trim();
    const parts = name.split(/\s+/);
    return parts.length > 1 ? `${parts[0]}...` : name;
  };

  const getApprovalTimestamp = (item, approvalField = 'pmPdApproval') => {
    if (!item) return '';
    const status = item[approvalField] || 'Pending';
    if (status === 'Pending') return '';
    const timestamp = item[`${approvalField}UpdatedAt`] || item.updatedAt || item.createdAt || null;
    return timestamp ? new Date(timestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  };

  const getStatusClass = (status) => {
    if (status === 'Approved') return 'badge-success';
    if (status === 'Rejected') return 'badge-danger';
    return 'badge-muted'; // Pending
  };

  const getPriorityClass = (priority) => {
    if (priority === 'High') return 'badge-danger';
    if (priority === 'Medium') return 'badge-success';
    return 'badge-muted'; // Low
  };

  const handleApprovalToggle = async (id, approvalField, e) => {
    if (e) e.stopPropagation();
    const requestIndex = requests.findIndex(r => r._id === id);
    if (requestIndex === -1) return;

    const currentStatus = requests[requestIndex][approvalField] || 'Pending';
    const newStatus = currentStatus === 'Approved' ? 'Pending' : 'Approved';
    const approvalTimestamp = new Date().toISOString();

    const updatedRequests = [...requests];
    const approvalFields = approvalField === 'mdApproval'
      ? { mdApproval: newStatus, mdApprovalStatus: newStatus, comparisonStatus: newStatus === 'Approved' ? 'Approved' : 'Compared' }
      : { [approvalField]: newStatus };
    updatedRequests[requestIndex] = {
      ...updatedRequests[requestIndex],
      ...approvalFields,
      [`${approvalField}UpdatedAt`]: approvalTimestamp,
    };
    setRequests(updatedRequests);

    if (activeRequest && activeRequest._id === id) {
      setActiveRequest({
        ...activeRequest,
        ...approvalFields,
        [`${approvalField}UpdatedAt`]: approvalTimestamp,
      });
    }

    try {
      await materialRequestApi.update(id, { ...approvalFields, [`${approvalField}UpdatedAt`]: approvalTimestamp });
    } catch (err) {
      console.error(`Failed to update ${approvalField}`, err);
      const revertRequests = [...requests];
      revertRequests[requestIndex] = {
        ...revertRequests[requestIndex],
        [approvalField]: currentStatus,
        [`${approvalField}UpdatedAt`]: requests[requestIndex][`${approvalField}UpdatedAt`],
      };
      setRequests(revertRequests);

      if (activeRequest && activeRequest._id === id) {
        setActiveRequest({
          ...activeRequest,
          [approvalField]: currentStatus,
          [`${approvalField}UpdatedAt`]: requests[requestIndex][`${approvalField}UpdatedAt`],
        });
      }
    }
  };

  const handlePmToggle = async (id, e) => handleApprovalToggle(id, 'pmPdApproval', e);
  const handleMdToggle = async (id, e) => handleApprovalToggle(id, 'mdApproval', e);

  const handleProductTypeChange = async (id, e) => {
    e.stopPropagation();
    const newTypeId = e.target.value;
    
    const requestIndex = requests.findIndex(r => r._id === id);
    if (requestIndex === -1) return;
    
    const currentTypeId = requests[requestIndex].productTypeId;
    
    const updatedRequests = [...requests];
    updatedRequests[requestIndex] = { ...updatedRequests[requestIndex], productTypeId: newTypeId || null };
    setRequests(updatedRequests);
    
    if (activeRequest && activeRequest._id === id) {
      setActiveRequest({ ...activeRequest, productTypeId: newTypeId || null });
    }

    try {
      await materialRequestApi.update(id, { productTypeId: newTypeId || null });
    } catch (err) {
      console.error('Failed to update product type', err);
      const revertRequests = [...requests];
      revertRequests[requestIndex] = { ...revertRequests[requestIndex], productTypeId: currentTypeId };
      setRequests(revertRequests);
      
      if (activeRequest && activeRequest._id === id) {
        setActiveRequest({ ...activeRequest, productTypeId: currentTypeId });
      }
    }
  };

  const titleTarget = document.getElementById('header-title-target');
  const appMainTarget = document.getElementById('app-main-target');
  const detailTitle = isPanelOpen && activeRequest ? 'Add Purchased Item' : isQuotationPanelOpen && activeRequest ? 'Quotation Details' : 'Material Requests';

  return (
    <div className="page" style={{ position: 'relative', overflowX: 'hidden', minHeight: 'calc(100vh - 110px)' }}>
      {titleTarget && !isPanelOpen && !isQuotationPanelOpen && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{detailTitle}</h1>
        </div>,
        titleTarget
      )}

      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="table-loading">No material requests found.</div>
        ) : (
          <>
            {isMobile ? (
              <div className="mobile-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
                {requests.map((item, index) => (
                  <div key={item._id} className="mobile-card" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-primary)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{item.indentNo || `REQ-${index+1}`}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Site</span>
                        <span className="cell-truncate" style={{ fontWeight: 500 }}>{getSiteName(item)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Type</span>
                        <span className="cell-truncate badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '2px 4px', fontSize: '9px', background: getProductTypeName(item) !== '-' ? 'var(--bg-elevated)' : '' }}>{getProductTypeName(item)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Material</span>
                        <span className="cell-truncate" style={{ fontWeight: 500 }}>{item.material || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Raised By</span>
                        <span className="cell-truncate" title={getEmployeeName(item)} style={{ fontWeight: 500 }}>{getRaisedByDisplay(item)}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '9px', marginTop: '2px' }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '4px' }}>PM/PD Approval</span>
                        {item.pmPdApproval === 'Approved' ? (
                          <span className="badge badge-success" style={{ width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Approved</span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Pending</span>
                        )}
                        <span style={{ color: 'var(--text-secondary)', fontSize: '9px', marginTop: '2px' }}>{getApprovalTimestamp(item)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>MD Approval</span>
                        {item.mdApproval === 'Approved' ? (
                          <span className="badge badge-success" style={{ width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Approved</span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Pending</span>
                        )}
                        <span style={{ color: 'var(--text-secondary)', fontSize: '9px', marginTop: '2px' }}>{getApprovalTimestamp(item, 'mdApproval')}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className={`badge ${getPriorityClass(item.priority)}`} style={{ fontSize: '10px', padding: '2px 6px' }}>{item.priority || 'Medium'}</span>
                        <span className={`badge ${getStatusClass(item.status)}`} style={{ fontSize: '10px', padding: '2px 6px' }}>{item.status || 'Pending'}</span>
                      </div>
                      <button className="badge-btn" title="Add Purchased Item" style={{ padding: '4px' }} onClick={() => openPanel(item)}>
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-wrapper" style={{ overflow: 'visible' }}>
                <table className="data-table material-requests-table">
                  <thead>
                    <tr>
                      <th style={{ width: '56px', whiteSpace: 'nowrap' }}>S. No</th>
                      <th>Date</th>
                      <th>Indent No</th>
                      <th>Site</th>
                      <th>Type</th>
                      <th>Priority</th>
                      <th>Material</th>
                      <th>Status</th>
                      <th>Raised By</th>
                      <th style={{ textAlign: 'center', minWidth: '120px' }}>PM/PD Approval</th>
                      <th style={{ minWidth: '110px' }}>MD Approval</th>
                      <th style={{ width: '56px', minWidth: '56px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item, index) => (
                      <tr key={item._id}>
                        <td>{index + 1}</td>
                        <td className="col-small-text">{new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td className="col-small-text">{item.indentNo || '-'}</td>
                        <td className="col-small-text">{getSiteName(item)}</td>
                        <td className="type-cell"><span className="badge badge-muted" title={getProductTypeName(item)} style={{ fontSize: '10px', background: getProductTypeName(item) !== '-' ? 'var(--bg-elevated)' : '', maxWidth: '120px', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getProductTypeName(item)}</span></td>
                        <td>
                          <span className={`badge ${getPriorityClass(item.priority)}`}>{item.priority || 'Medium'}</span>
                        </td>
                        <td className="cell-truncate material-cell"><div title={item.material || 'N/A'}>{item.material || 'N/A'}</div></td>
                        <td>
                          <span className={`badge ${getStatusClass(item.status)}`}>{item.status || 'Pending'}</span>
                        </td>
                        <td className="cell-truncate">
                          <div title={getEmployeeName(item)}>{getRaisedByDisplay(item)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                        </td>
                        <td style={{ textAlign: 'center', minWidth: '120px' }}>
                          {item.pmPdApproval === 'Approved' ? (
                            <span className="badge badge-success" style={{ fontSize: '10px' }}>Approved</span>
                          ) : (
                            <span className="badge badge-muted" style={{ fontSize: '10px' }}>Pending</span>
                          )}
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{getApprovalTimestamp(item)}</div>
                        </td>
                        <td style={{ minWidth: '110px' }}>
                          {item.mdApproval === 'Approved' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="badge badge-success" style={{ fontSize: '10px', padding: '4px 10px', minWidth: '90px' }}>Approved</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{getApprovalTimestamp(item, 'mdApproval')}</div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="badge badge-muted" style={{ fontSize: '10px', padding: '4px 10px', minWidth: '90px' }}>Pending</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{getApprovalTimestamp(item, 'mdApproval')}</div>
                            </div>
                          )}
                        </td>
                        <td style={{ width: '56px', minWidth: '56px' }}>
                          <button className="badge-btn" title="Add Purchased Item" onClick={() => openPanel(item)}>
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Book Paper Swipe Screen for "Add Purchased Item" */}
      {appMainTarget ? createPortal(
        <div 
          style={{
            position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-elevated)',
          zIndex: 100,
          transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), visibility 0s linear ${isPanelOpen ? '0s' : '0.4s'}`,
          boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
          overflowY: 'auto',
          visibility: isPanelOpen ? 'visible' : 'hidden'
        }}
        className="slide-over-page"
      >
        {activeRequest && (
          <div style={{ padding: isMobile ? '16px' : '24px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={closePanel}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', color: 'var(--primary-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  title="Close"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Add Purchase Item</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '6px' }}>
                  Indent No: {activeRequest.indentNo}
                </span>
                <button
                  onClick={openQuotationPanel}
                  className="btn btn-primary"
                >
                  Quotation
                </button>
              </div>
            </div>
            
            {isMobile ? (
              <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Date</span>
                    <span style={{ fontWeight: 500 }}>{new Date(activeRequest.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Site</span>
                    <span style={{ fontWeight: 500 }}>{getSiteName(activeRequest)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Type</span>
                    <select 
                      value={(typeof activeRequest.productTypeId === 'object' ? activeRequest.productTypeId?._id : activeRequest.productTypeId) || typeOptions.find(opt => opt.label.toLowerCase() === 'none')?.value || ''} 
                      onChange={(e) => handleProductTypeChange(activeRequest._id, e)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: '#000', WebkitTextFillColor: '#000', fontSize: '12px', minWidth: '150px', maxWidth: '220px', width: '100%', boxSizing: 'border-box' }}
                    >
                      {typeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ color: '#000' }}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Priority</span>
                    <span className={`badge ${getPriorityClass(activeRequest.priority)}`} style={{ width: 'fit-content', padding: '2px 6px' }}>{activeRequest.priority || 'Medium'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Material</span>
                    <span style={{ fontWeight: 500 }}>{activeRequest.material || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Status</span>
                    <span className={`badge ${getStatusClass(activeRequest.status)}`} style={{ width: 'fit-content', padding: '2px 6px' }}>{activeRequest.status || 'Pending'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Raised By</span>
                    <span style={{ fontWeight: 500 }}>{getEmployeeName(activeRequest)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '8px', fontWeight: 600 }}>PM/PD Approval</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <button onClick={(e) => handlePmToggle(activeRequest._id, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeRequest.pmPdApproval === 'Approved' ? 'var(--success)' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 0 }} title={activeRequest.pmPdApproval === 'Approved' ? 'Approved' : 'Click to Approve'}>
                        <CheckCircle size={24} strokeWidth={activeRequest.pmPdApproval === 'Approved' ? 2.5 : 2} />
                        {activeRequest.pmPdApproval === 'Approved' && <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>Approved</span>}
                      </button>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{getApprovalTimestamp(activeRequest, 'pmPdApproval')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '8px', fontWeight: 600 }}>MD Approval</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <button onClick={(e) => handleMdToggle(activeRequest._id, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeRequest.mdApproval === 'Approved' ? 'var(--success)' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 0 }} title={activeRequest.mdApproval === 'Approved' ? 'Approved' : 'Click to Approve'}>
                        <CheckCircle size={24} strokeWidth={activeRequest.mdApproval === 'Approved' ? 2.5 : 2} />
                        {activeRequest.mdApproval === 'Approved' && <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>Approved</span>}
                      </button>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{getApprovalTimestamp(activeRequest, 'mdApproval')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table className="data-table" style={{ fontSize: '13px', margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Indent No</th>
                      <th>Site</th>
                      <th>Type</th>
                      <th>Priority</th>
                      <th>Material</th>
                      <th>Status</th>
                      <th>Raised By</th>
                      <th style={{ textAlign: 'center' }}>PM/PD Approval</th>
                      <th>MD Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{new Date(activeRequest.createdAt).toLocaleDateString('en-GB')}</td>
                      <td>{activeRequest.indentNo || '-'}</td>
                      <td>{getSiteName(activeRequest)}</td>
                      <td>
                        <select 
                        value={(typeof activeRequest.productTypeId === 'object' ? activeRequest.productTypeId?._id : activeRequest.productTypeId) || typeOptions.find(opt => opt.label.toLowerCase() === 'none')?.value || ''} 
                        onChange={(e) => handleProductTypeChange(activeRequest._id, e)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: '#000', WebkitTextFillColor: '#000', fontSize: '12px', minWidth: '150px', maxWidth: '220px', width: '100%', boxSizing: 'border-box' }}
                      >
                        {typeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} style={{ color: '#000' }}>{opt.label}</option>
                        ))}
                      </select>
                      </td>
                      <td>
                        <span className={`badge ${getPriorityClass(activeRequest.priority)}`}>{activeRequest.priority || 'Medium'}</span>
                      </td>
                      <td>{activeRequest.material || 'N/A'}</td>
                      <td>
                        <span className={`badge ${getStatusClass(activeRequest.status)}`}>{activeRequest.status || 'Pending'}</span>
                      </td>
                      <td>{getEmployeeName(activeRequest)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={(e) => handlePmToggle(activeRequest._id, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeRequest.pmPdApproval === 'Approved' ? 'var(--success)' : 'var(--border-color)' }} title={activeRequest.pmPdApproval === 'Approved' ? 'Approved' : 'Click to Approve'}>
                          <CheckCircle size={20} strokeWidth={activeRequest.pmPdApproval === 'Approved' ? 2.5 : 2} />
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={(e) => handleMdToggle(activeRequest._id, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeRequest.mdApproval === 'Approved' ? 'var(--success)' : 'var(--border-color)' }} title={activeRequest.mdApproval === 'Approved' ? 'Approved' : 'Click to Approve'}>
                          <CheckCircle size={20} strokeWidth={activeRequest.mdApproval === 'Approved' ? 2.5 : 2} />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <br /><br />

            {/* Purchase Items Section */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Purchase Items</h3>
                <button 
                  title="Add New Tender Item"
                  onClick={() => setIsAddTenderedItemPopupOpen(true)}
                  style={{ 
                    background: '#5a55d2', // matches the purple/blue in the image
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px', // rounded corners like in the image
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Add New Item</span>
                </button>
              </div>
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table className="data-table" style={{ fontSize: '13px', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '56px', whiteSpace: 'nowrap' }}>Sno</th>
                      <th>Category</th>
                      <th>Name</th>
                      <th>BOQ Rate</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Approved Qty</th>
                      <th>Remarks</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRequest?.purchaseItems && activeRequest.purchaseItems.length > 0 ? (
                      activeRequest.purchaseItems.map((item, index) => {
                        const displayItem = normalizePurchaseItem(item);
                        const cat = typeof displayItem.itemCategoryId === 'object' ? (displayItem.itemCategoryId?.categoryName || displayItem.itemCategoryId?.code) : (itemCategories.find(c => c._id === displayItem.itemCategoryId)?.categoryName || displayItem.itemCategoryId);
                        const uom = typeof displayItem.itemUomId === 'object' ? (displayItem.itemUomId?.uomName || displayItem.itemUomId?.code) : (itemUOMs.find(u => u._id === displayItem.itemUomId)?.uomName || displayItem.itemUomId);
                        const boqRate = displayItem.boqRate !== undefined ? displayItem.boqRate : '-';
                        const quantity = displayItem.quantity !== undefined ? displayItem.quantity : '-';
                        const approvedQty = displayItem.approvedQty !== undefined ? displayItem.approvedQty : '';
                        const remarks = displayItem.remarks || '';

                        return (
                          <tr key={`${displayItem._id || 'item'}-${index}`}>
                            <td style={{ padding: '10px 16px' }}>{index + 1}</td>
                            <td style={{ padding: '10px 16px' }}>{cat || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>{item.itemName || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>{boqRate}</td>
                            <td style={{ padding: '10px 16px' }}>{quantity}</td>
                            <td style={{ padding: '10px 16px' }}>{uom || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>
                              <input
                                type="number"
                                min="0"
                                value={approvedQty}
                                onChange={(e) => handlePurchaseItemFieldChange(index, 'approvedQty', e.target.value)}
                                onBlur={handlePurchaseItemFieldBlur}
                                placeholder="Approved Qty"
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                              />
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <input
                                type="text"
                                value={remarks}
                                onChange={(e) => handlePurchaseItemFieldChange(index, 'remarks', e.target.value)}
                                onBlur={handlePurchaseItemFieldBlur}
                                placeholder="Remarks"
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                              />
                            </td>
                            <td style={{ width: '110px', padding: '8px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '32px' }}>
                                <button
                                  onClick={() => handleEditTenderedItem(item, index)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemoveTenderedItem(index)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger, #ef4444)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>No items added yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Uploaded Assets Section */}
            {activeRequest?.photos && activeRequest.photos.length > 0 && (
              <>
                <br /><br />
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Uploaded Assets</h3>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {activeRequest.photos.map((photoUrl, idx) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(photoUrl);
                      const baseURL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:8001';
                      const fullUrl = photoUrl.startsWith('http') ? photoUrl : `${baseURL}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
                      
                      return (
                        isImage ? (
                          <button
                            key={idx}
                            onClick={() => setImageViewerUrl(fullUrl)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100px',
                              height: '100px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-elevated)',
                              textDecoration: 'none',
                              color: 'var(--text-primary)',
                              padding: '8px',
                              boxSizing: 'border-box',
                              cursor: 'pointer'
                            }}
                          >
                            <img src={fullUrl} alt={`Attachment ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                          </button>
                        ) : (
                          <a
                            key={idx}
                            href={fullUrl}
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100px',
                              height: '100px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-elevated)',
                              textDecoration: 'none',
                              color: 'var(--text-primary)',
                              padding: '8px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <>
                              <FileText size={32} color="var(--primary-color)" style={{ marginBottom: '8px' }} />
                              <span style={{ fontSize: '10px', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {photoUrl.split('/').pop() || `File ${idx + 1}`}
                              </span>
                            </>
                          </a>
                        )
                      );
                    })}
                  </div>
                </div>
              </>
            )}

                {imageViewerUrl && (
                  <div
                    onClick={() => setImageViewerUrl(null)}
                    style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', zIndex: 1200, padding: '16px' }}
                  >
                    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '820px', maxHeight: '76vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={imageViewerUrl} alt="Preview" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}

            <br /><br />
            {/* Add Tendered Items Section Popup */}
            {isAddTenderedItemPopupOpen && createPortal(
              <div onClick={() => setIsAddTenderedItemPopupOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '920px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 18px 50px rgba(0,0,0,0.18)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: isMobile ? '22px' : '24px', fontWeight: 700 }}>Add Tendered Items</h3>
                      <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>Enter tender item details below.</p>
                    </div>
                    <button onClick={() => setIsAddTenderedItemPopupOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '24px', color: 'var(--text-secondary)', lineHeight: 1 }}>&times;</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Choose Item</label>
                      <select
                        value={formData.selectedItemId || ''}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) {
                            setFormData({ ...formData, selectedItemId: '', itemCode: '', itemName: '' });
                          } else {
                            const selected = items.find(it => it._id === id);
                            if (selected) {
                              setFormData({
                                ...formData,
                                selectedItemId: id,
                                itemCode: selected.code || '',
                                itemName: selected.itemName || '',
                                uomId: selected.itemUomId?._id || selected.itemUomId || '',
                                taxValue: selected.tax !== undefined ? String(selected.tax) : '',
                                categoryId: selected.itemCategoryId?._id || selected.itemCategoryId || formData.categoryId
                              });
                            }
                          }
                        }}
                        style={{ padding: '12px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '44px', fontSize: '14px' }}
                      >
                        <option value="">Choose Item</option>
                        {items.map((it) => (
                          <option key={it._id} value={it._id}>{it.itemName || it.code || it._id}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Specification</label>
                      <input
                        type="text"
                        value={formData.specification}
                        onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                        placeholder="Specification"
                        style={{ padding: '12px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="Quantity"
                        style={{ padding: '12px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>BOQ Rate</label>
                      <input
                        type="text"
                        value={formData.boqRate}
                        onChange={(e) => setFormData({ ...formData, boqRate: e.target.value })}
                        placeholder="BOQ Rate"
                        style={{ padding: '12px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn-primary" onClick={handleAddTenderedItem} style={{ width: '100%', padding: '12px 18px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', minHeight: '44px' }}>{editingTenderedItemIndex !== null ? 'Update' : 'Save'}</button>
                    </div>
                  </div>
                </div>
              </div>, document.body
            )}

          </div>
        )}
      </div>,
      appMainTarget
    ) : null}

    {/* Quotation Slide-Over Screen */}
    {appMainTarget ? createPortal(
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-elevated)',
          zIndex: 110,
          transform: isQuotationPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), visibility 0s linear ${isQuotationPanelOpen ? '0s' : '0.4s'}`,
          boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
          overflowY: 'auto',
          visibility: isQuotationPanelOpen ? 'visible' : 'hidden'
        }}
        className="slide-over-page"
      >
        {activeRequest && (
          <div style={{ padding: isMobile ? '16px 16px 60px 16px' : '24px 24px 60px 24px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={closeQuotationPanel}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', color: 'var(--primary-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}
                  title="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 style={{ margin: 0, fontSize: isMobile ? '15px' : '17px', fontWeight: '600' }}>Quotation</h2>
              </div>
              <div 
                onClick={() => setIsTermsOpen(!isTermsOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                <span style={{ fontSize: '13px', fontWeight: '600' }}>View Terms & Conditions</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{isTermsOpen ? '-' : '+'}</span>
              </div>
            </div>
            
            {isTermsOpen && (
              <div style={{ padding: '16px', marginBottom: '20px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={qFormData.termsAndConditions}
                  onChange={(e) => setQFormData((prev) => ({ ...prev, termsAndConditions: e.target.value }))}
                  placeholder="Enter terms and conditions here..."
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Supplier <span className="required-mark">*</span>
                </label>
                <select
                  value={qFormData.supplierId}
                  onChange={(e) => setQFormData({ ...qFormData, supplierId: e.target.value })}
                  className="form-select"
                >
                  <option value="" disabled>Select Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup._id} value={sup._id}>{sup.companyName} ({sup.contactName})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Quote Reference No <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Quote Reference No"
                  value={qFormData.quoteRefNo}
                  onChange={(e) => setQFormData({ ...qFormData, quoteRefNo: e.target.value })}
                  className="form-input"
                  style={{
                    height: '36px',
                    borderRadius: '10px',
                    border: '1px solid #D9DCE3',
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    padding: '0 16px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Expected Delivery Date <span className="required-mark">*</span>
                </label>
                <input
                  type="date"
                  value={qFormData.expectedDateOfDelivery}
                  onChange={(e) => setQFormData({ ...qFormData, expectedDateOfDelivery: e.target.value })}
                  className="form-input"
                  style={{
                    height: '36px',
                    borderRadius: '10px',
                    border: '1px solid #D9DCE3',
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    padding: '0 16px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Payment Terms
                </label>
                <input
                  type="text"
                  placeholder="Enter Payment Terms"
                  value={qFormData.paymentTerms}
                  onChange={(e) => setQFormData({ ...qFormData, paymentTerms: e.target.value })}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Freight Charges
                </label>
                <input
                  type="text"
                  placeholder="Enter Freight Charges"
                  value={qFormData.freight}
                  onChange={(e) => setQFormData({ ...qFormData, freight: e.target.value })}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Loading Charges
                </label>
                <input
                  type="text"
                  placeholder="Enter Loading Charges"
                  value={qFormData.loading}
                  onChange={(e) => setQFormData({ ...qFormData, loading: e.target.value })}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Unloading Charges
                </label>
                <input
                  type="text"
                  placeholder="Enter Unloading Charges"
                  value={qFormData.unloading}
                  onChange={(e) => setQFormData({ ...qFormData, unloading: e.target.value })}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Upload Quotation Document
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => setQFormData({ ...qFormData, file: e.target.files ? Array.from(e.target.files) : [] })}
                  className="form-input"
                />
                {qFormData.existingFileUrls && qFormData.existingFileUrls.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Uploaded file{qFormData.existingFileUrls.length > 1 ? 's' : ''}:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {qFormData.existingFileUrls.slice().reverse().map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '13px', color: 'var(--primary-color)', textDecoration: 'underline', wordBreak: 'break-all' }}
                        >
                          {url?.split?.('/')?.pop() || `File ${idx + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={handleQuotationSubmit}
                  disabled={isSubmittingQuotation}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  <CheckCircle size={16} />
                  {isSubmittingQuotation ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ gridColumn: isMobile ? 'auto' : 'span 4', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Enter Terms & Conditions manually above
                </label>
              </div>
            </div>

            {/* Submitted Quotations Table */}
            <div style={{ marginTop: '32px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Submitted Quotations</h3>
                <button
                  onClick={showComparison ? () => setShowComparison(false) : handleShowComparison}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', borderRadius: '6px' }}
                  disabled={quotationList.length === 0}
                >
                  {showComparison ? 'Hide Comparison' : 'Compare'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Sno</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Supplier</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Delivery Date</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Quote Ref No</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Payment Terms</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Freight</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Loading</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Unloading</th>
                      {/* Total column removed per requirement */}
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>File</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotationList.length === 0 ? (
                      <tr><td colSpan="10" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No quotations submitted yet.</td></tr>
                    ) : (
                      quotationList.map((q, idx) => (
                        <tr key={q._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 16px' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 16px' }}>{q.supplierId?.companyName || (typeof q.supplierId === 'string' ? (suppliers.find((sup) => String(sup._id) === String(q.supplierId))?.companyName || 'Unknown') : 'Unknown')}</td>
                          <td style={{ padding: '10px 16px' }}>{q.expectedDateOfDelivery}</td>
                          <td style={{ padding: '10px 16px' }}>{q.quoteRefNo}</td>
                          <td style={{ padding: '10px 16px' }}>{q.paymentTerms}</td>
                          <td style={{ padding: '10px 16px' }}>{q.freight}</td>
                          <td style={{ padding: '10px 16px' }}>{q.loading}</td>
                          <td style={{ padding: '10px 16px' }}>{q.unloading}</td>
                          {/* Total column removed per requirement */}
                          <td style={{ padding: '10px 16px' }}>
                            {q.fileUrl && q.fileUrl.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <a href={`${window.location.origin}${Array.isArray(q.fileUrl) ? q.fileUrl[q.fileUrl.length - 1] : q.fileUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FileText size={16} /> View
                                </a>
                                {Array.isArray(q.fileUrl) && q.fileUrl.length > 1 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>+{q.fileUrl.length - 1} more</span>}
                              </div>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            {isSameId(activeRequest?.awardedQuotationId, q._id) ? (
                              <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '9999px', fontWeight: 600 }}>Awarded</span>
                            ) : isSameId(getLowestQuotation()?._id, q._id) ? (
                              <button
                                onClick={() => handleAwardQuotation(q._id)}
                                style={{ background: '#2563eb', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}
                                title="Award this lowest quote"
                              >
                                Award Lowest
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button onClick={() => handleEditClick(q)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Edit">
                                <Edit size={16} />
                              </button>
                              <button onClick={() => handleDeleteClick(q._id)} style={{ background: 'none', border: 'none', color: 'var(--danger, red)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {quotationList.length > 0 && (
              <section ref={comparisonRef} className="quotation-comparison-section" aria-label="Quotation comparison">
                <div className="compare-modal-content">
                  <div className="compare-modal-header">
                    <div>
                      <h3>Quotation Items</h3>
                      <div className="compare-modal-subtitle">Tendered Materials</div>
                    </div>
                    <div className="compare-modal-actions">
                      <button onClick={handleSaveQuote} disabled={isSavingComparison} className="btn btn-primary compare-modal-action-btn">
                        {isSavingComparison ? 'Saving...' : 'Save Quote'}
                      </button>
                      <button onClick={handleSendForMdApproval} disabled={isSavingComparison} className="btn btn-primary compare-modal-action-btn">
                        {isSavingComparison ? 'Sending...' : 'Send for MD Approval'}
                      </button>
                      <button onClick={handlePrintComparison} className="btn btn-secondary compare-modal-action-btn">
                        Print Comparison Chart
                      </button>
                      <button
                        onClick={handleDownloadComparisonPdf}
                        disabled={activeRequest?.mdApprovalStatus !== 'Approved' && activeRequest?.mdApproval !== 'Approved'}
                        className="btn btn-secondary compare-modal-action-btn"
                        title={activeRequest?.mdApprovalStatus === 'Approved' || activeRequest?.mdApproval === 'Approved' ? 'Download comparison PDF' : 'Available after MD approval'}
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>
                  <div className="compare-modal-body">
                    <table className="data-table compare-modal-table">
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Sno</th>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Schedule</th>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Category</th>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Name</th>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>Approved Qty</th>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>UOM</th>
                          <th rowSpan={2} style={{ padding: '10px 16px', textAlign: 'right', background: 'var(--bg-primary)' }}>BOQ Rate</th>
                          {quotationList.map((q) => (
                            <th key={q._id} colSpan={4} style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <strong>{getSupplierName(q)}</strong>
                              </div>
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {quotationList.map((q) => (
                            <Fragment key={`${q._id}-sub`}>
                              <th style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>GST</th>
                              <th style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>Rate</th>
                              <th style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>Tax</th>
                              <th style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-primary)' }}>Total</th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(activeRequest?.purchaseItems) && activeRequest.purchaseItems.length > 0 ? (
                          activeRequest.purchaseItems.map((item, index) => {
                            const displayItem = normalizePurchaseItem(item);
                            const schedule = displayItem.schedule || displayItem.scheduleName || '-';
                            const cat = typeof displayItem.itemCategoryId === 'object' ? (displayItem.itemCategoryId?.categoryName || displayItem.itemCategoryId?.code) : (itemCategories.find(c => c._id === displayItem.itemCategoryId)?.categoryName || displayItem.itemCategoryId);
                            const approvedQty = displayItem.approvedQty !== undefined && displayItem.approvedQty !== null ? displayItem.approvedQty : (displayItem.quantity || 0);
                            const boqRate = displayItem.boqRate !== undefined && displayItem.boqRate !== null ? displayItem.boqRate : '-';
                            const uomName = getItemUomName(displayItem, itemUOMs);

                            return (
                              <tr key={`compare-row-${index}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '6px 10px' }}>{index + 1}</td>
                                <td style={{ padding: '6px 10px' }}>{schedule}</td>
                                <td style={{ padding: '6px 10px' }}>{cat || '-'}</td>
                                <td style={{ padding: '6px 10px' }}>{displayItem.itemName || '-'}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{approvedQty}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>{uomName}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{boqRate}</td>
                                {quotationList.map((q) => {
                                  const currentItemId = getRequestItemId(displayItem);
                                  const quotationItem = findQuotationItem(q, displayItem) || { itemId: currentItemId, rate: '', taxPercent: 0, isSelected: false };
                                  const rateValue = quotationItem?.rate ?? '';
                                  const taxPercentValue = quotationItem?.taxPercent ?? 0;
                                  const { taxAmount, total } = computeQuotationItemTotals(quotationItem, displayItem);
                                  const gstEnabled = parseNumericField(taxPercentValue) > 0;
                                  const isSelected = quotationItem?.isSelected === true;
                                  return (
                                    <Fragment key={`${q._id}-cells-${index}`}>
                                      <td style={{ padding: '6px 10px', background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="checkbox"
                                            checked={gstEnabled}
                                            onChange={(e) => handleComparisonToggleGST(q._id, currentItemId, e.target.checked)}
                                            aria-label="Enable GST"
                                          />
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            value={taxPercentValue ?? ''}
                                            onChange={(e) => handleComparisonFieldChange(q._id, currentItemId, 'taxPercent', e.target.value)}
                                            style={{ width: '72px', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
                                          />
                                        </div>
                                      </td>
                                      <td style={{ padding: '6px 10px', background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => handleMaterialSelectionChange(q._id, currentItemId, e.target.checked)}
                                            aria-label="Award item to supplier"
                                          />
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            value={rateValue ?? ''}
                                            max={getBoqRate(displayItem) ?? undefined}
                                            title={getBoqRate(displayItem) !== null ? `Maximum supplier rate: ${getBoqRate(displayItem)}` : undefined}
                                            onChange={(e) => handleComparisonFieldChange(q._id, currentItemId, 'rate', e.target.value)}
                                            style={{ width: '84px', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
                                          />
                                        </div>
                                      </td>
                                      <td style={{ padding: '6px 10px', textAlign: 'right', background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent' }}>{taxAmount.toFixed(2)}</td>
                                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent' }}>{total.toFixed(2)}</td>
                                    </Fragment>
                                  );
                                })}
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan={7 + quotationList.length * 4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No purchase items available for comparison.</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                          <td colSpan={7} style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Sub Total</td>
                          {quotationList.map((q) => {
                            const { subTotal } = getQuotationSummary(q);
                            return (
                              <td key={`${q._id}-sub-total`} colSpan={4} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{subTotal.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td colSpan={7} style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Freight</td>
                          {quotationList.map((q) => {
                            const { freight } = getQuotationSummary(q);
                            return (
                              <td key={`${q._id}-freight`} colSpan={4} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{freight.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td colSpan={7} style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Loading</td>
                          {quotationList.map((q) => {
                            const { loading } = getQuotationSummary(q);
                            return (
                              <td key={`${q._id}-loading`} colSpan={4} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{loading.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td colSpan={7} style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Unloading</td>
                          {quotationList.map((q) => {
                            const { unloading } = getQuotationSummary(q);
                            return (
                              <td key={`${q._id}-unloading`} colSpan={4} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{unloading.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                        <tr style={{ background: 'rgba(15, 23, 42, 0.04)' }}>
                          <td colSpan={7} style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Total</td>
                          {quotationList.map((q) => {
                            const { grandTotal } = getQuotationSummary(q);
                            return (
                              <td key={`${q._id}-grand-total`} colSpan={4} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>{grandTotal.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

          </div>
        )}
      </div>,
      appMainTarget
    ) : null}

      {/* Delete Confirmation Modal */}
      {quotationToDelete && createPortal(
        <div onClick={() => setQuotationToDelete(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Confirm Deletion</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Are you sure you want to delete this quotation? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setQuotationToDelete(null)}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteQuotation}
                style={{ background: 'var(--danger, #ef4444)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Custom Toast Notification */}
      {toastMessage && createPortal(
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toastType === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: 500,
          animation: 'slideUp 0.3s ease-out'
        }}>
          {toastType === 'success' ? <CheckCircle size={20} /> : <X size={20} />}
          <span>{toastMessage}</span>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>,
        document.body
      )}

    </div>
  );
}
