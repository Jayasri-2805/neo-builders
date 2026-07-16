import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Eye, CheckCircle, ArrowLeft, Plus, FileText, FileUp, X, Edit, Trash2 } from 'lucide-react';
import { materialRequestApi, productTypeApi, itemCategoryApi, itemUomApi, taxApi, itemApi, supplierApi, quotationApi, uploadAttachment } from '../../api/masterApi';

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
    selectedItemId: ''
  });
  
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [isAddTenderedItemPopupOpen, setIsAddTenderedItemPopupOpen] = useState(false);
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
    acceptedTerms: []
  });
  const [showComparison, setShowComparison] = useState(false);

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
      freight: '', loading: '', unloading: '', file: [], existingFileUrls: [], acceptedTerms: []
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    const isQuot = searchParams.get('quotation') === 'true';
    if (!requestId || requests.length === 0) return;

    const req = requests.find(r => r._id === requestId);
    if (!req) return;

    setActiveRequest(req);
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

  const handleAddTenderedItem = async () => {
    if (!formData.categoryId || !formData.itemCode || !formData.itemName || !formData.uomId) {
      alert('Please fill in all required fields (Category, Code, Name, Unit).');
      return;
    }
    
    try {
      let createdItem = null;
      // If user selected an existing item, reuse it
      if (formData.selectedItemId) {
        createdItem = items.find(it => it._id === formData.selectedItemId) || { _id: formData.selectedItemId, code: formData.itemCode, itemName: formData.itemName };
      } else {
        // 1. Create the Item in Master
        const newItemPayload = {
          code: formData.itemCode,
          itemName: formData.itemName,
          itemCategoryId: formData.categoryId,
          itemUomId: formData.uomId,
          tax: formData.taxValue ? Number(formData.taxValue) : 0
        };
        const itemRes = await itemApi.create(newItemPayload);
        if (itemRes.data.success && itemRes.data.data) {
          createdItem = itemRes.data.data;
        }
      }

      if (createdItem) {
        // 2. Add to Material Request
        if (activeRequest) {
          await materialRequestApi.update(activeRequest._id, {
            purchaseItems: [...(activeRequest.purchaseItems || []).map(i => typeof i === 'object' ? i._id : i), createdItem._id]
          });
          // Optimistically update UI
          const updatedRequest = { 
            ...activeRequest, 
            purchaseItems: [...(activeRequest.purchaseItems || []), createdItem]
          };
          setActiveRequest(updatedRequest);
          // Update in requests list
          const updatedRequests = requests.map(r => r._id === activeRequest._id ? updatedRequest : r);
          setRequests(updatedRequests);
        }
        // Reset form & close
        setFormData({ categoryId: '', itemCode: '', itemName: '', uomId: '', taxValue: '', selectedItemId: '' });
        setIsAddTenderedItemPopupOpen(false);
        showToast('Item added successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to add tendered item:', error);
      showToast('Failed to add item. Ensure code is unique.', 'error');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
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
          finalFileUrls = [...finalFileUrls, ...uploadRes.data.data.fileUrls];
        }
      }

      const payload = {
        materialRequestId: activeRequest._id,
        supplierId: qFormData.supplierId,
        quoteRefNo: qFormData.quoteRefNo,
        expectedDateOfDelivery: qFormData.expectedDateOfDelivery,
        paymentTerms: qFormData.paymentTerms,
        freight: qFormData.freight,
        loading: qFormData.loading,
        unloading: qFormData.unloading,
        fileUrl: finalFileUrls,
        termsAndConditions: qFormData.acceptedTerms
      };

      console.debug('Quotation payload', payload);
      if (editingQuotationId) {
        await quotationApi.update(editingQuotationId, payload);
        showToast('Quotation updated successfully!', 'success');
        setEditingQuotationId(null);
      } else {
        await quotationApi.create(payload);
        showToast('Quotation submitted successfully!', 'success');
      }
      
      setQFormData({
        supplierId: '', quoteRefNo: '', expectedDateOfDelivery: '', paymentTerms: '',
        freight: '', loading: '', unloading: '', file: [], existingFileUrls: [], acceptedTerms: []
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchQuotations();
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
      acceptedTerms: q.termsAndConditions || []
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
      setRequests(requests.map((req) => req._id === activeRequest._id ? updatedRequest : req));
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

  const getQuotationTotal = (q) => {
    const freight = parseNumericField(q?.freight);
    const loading = parseNumericField(q?.loading);
    const unloading = parseNumericField(q?.unloading);
    // Debug logging to help trace miscalculations
    try {
      console.debug('[getQuotationTotal] id:', q?._id, 'raw:', { freight: q?.freight, loading: q?.loading, unloading: q?.unloading }, 'parsed:', { freight, loading, unloading });
    } catch (err) {
      // ignore
    }
    return freight + loading + unloading;
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

  useEffect(() => {
    const assignLowestQuote = async () => {
      if (!activeRequest || !quotationList || quotationList.length === 0) return;
      const lowest = getLowestQuotation();
      if (!lowest) return;

      const awardedId = activeRequest.awardedQuotationId;

      console.debug('[assignLowestQuote] activeRequestId:', activeRequest?._id, 'awardedId:', awardedId, 'lowestId:', lowest?._id);

      // If no award set yet, assign the lowest
      if (!awardedId) {
        await handleAwardQuotation(lowest._id);
        return;
      }

      // If there's an awarded quotation, check if someone reduced their total
      const currentAwarded = quotationList.find(q => q._id === awardedId || String(q._id) === String(awardedId));
      if (!currentAwarded) {
        // awarded quotation not present in current list (maybe deleted) -> assign lowest
        await handleAwardQuotation(lowest._id);
        return;
      }

      const lowestTotal = getQuotationTotal(lowest);
      const currentTotal = getQuotationTotal(currentAwarded);

      // Reassign only when a different quotation now has a strictly lower total
      if (String(lowest._id) !== String(currentAwarded._id) && lowestTotal < currentTotal) {
        await handleAwardQuotation(lowest._id);
      }
    };

    assignLowestQuote();
  }, [activeRequest, quotationList]);

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

  const fetchQuotations = async () => {
    if (!activeRequest) return;
    try {
      const res = await quotationApi.listAll();
      if (res.data.success) {
        const filtered = (res.data.data || []).filter(q => 
          q.materialRequestId === activeRequest._id || 
          (q.materialRequestId && q.materialRequestId._id === activeRequest._id)
        );
        setQuotationList(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
    }
  };

  const handleDeleteClick = (id) => {
    setQuotationToDelete(id);
  };

  const confirmDeleteQuotation = async () => {
    if (!quotationToDelete) return;
    try {
      await quotationApi.remove(quotationToDelete);
      fetchQuotations();
      showToast('Quotation deleted successfully', 'success');
    } catch (err) {
      console.error('Failed to delete quotation:', err);
      showToast('Failed to delete quotation.', 'error');
    }
    setQuotationToDelete(null);
  };

  useEffect(() => {
    if (isQuotationPanelOpen && activeRequest) {
      fetchQuotations();
    }
  }, [isQuotationPanelOpen, activeRequest]);

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

  const getApprovalTimestamp = (item) => {
    const timestamp = item.pmPdApprovalUpdatedAt || item.updatedAt || item.createdAt || null;
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

  const handlePmToggle = async (id, e) => {
    e.stopPropagation();
    
    // Find the current request
    const requestIndex = requests.findIndex(r => r._id === id);
    if (requestIndex === -1) return;
    
    const currentStatus = requests[requestIndex].pmPdApproval;
    const newStatus = currentStatus === 'Approved' ? 'Pending' : 'Approved';
    const approvalTimestamp = new Date().toISOString();
    
    // Optimistic update
    const updatedRequests = [...requests];
    updatedRequests[requestIndex] = { ...updatedRequests[requestIndex], pmPdApproval: newStatus, pmPdApprovalUpdatedAt: approvalTimestamp };
    setRequests(updatedRequests);
    
    if (activeRequest && activeRequest._id === id) {
      setActiveRequest({ ...activeRequest, pmPdApproval: newStatus, pmPdApprovalUpdatedAt: approvalTimestamp });
    }

    try {
      await materialRequestApi.update(id, { pmPdApproval: newStatus, pmPdApprovalUpdatedAt: approvalTimestamp });
    } catch (err) {
      console.error('Failed to update PM/PD approval', err);
      // Revert on failure
      const revertRequests = [...requests];
      revertRequests[requestIndex] = { ...revertRequests[requestIndex], pmPdApproval: currentStatus, pmPdApprovalUpdatedAt: requests[requestIndex].pmPdApprovalUpdatedAt };
      setRequests(revertRequests);
      
      if (activeRequest && activeRequest._id === id) {
        setActiveRequest({ ...activeRequest, pmPdApproval: currentStatus, pmPdApprovalUpdatedAt: requests[requestIndex].pmPdApprovalUpdatedAt });
      }
    }
  };

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
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Admin Approval</span>
                        <span className="badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '4px 10px', fontSize: '9px', whiteSpace: 'nowrap', minWidth: '90px' }}>Coming Soon</span>
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
                      <th style={{ minWidth: '110px' }}>Admin Approval</th>
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
                        <td style={{ minWidth: '110px' }}><span className="badge badge-muted" style={{ fontSize: '10px', padding: '4px 10px', minWidth: '90px', whiteSpace: 'nowrap' }}>Coming Soon</span></td>
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
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', fontWeight: 600 }}>Admin Approval</span>
                    <span className="badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Coming Soon</span>
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
                      <th>Admin Approval</th>
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
                      <td><span className="badge badge-muted" style={{ fontSize: '10px' }}>Coming Soon</span></td>
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
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Add New Tender Item</span>
                </button>
              </div>
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table className="data-table" style={{ fontSize: '13px', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '56px', whiteSpace: 'nowrap' }}>S. No</th>
                      <th>Item Category</th>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Unit</th>
                      <th>Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRequest?.purchaseItems && activeRequest.purchaseItems.length > 0 ? (
                      activeRequest.purchaseItems.map((item, index) => {
                        // Attempt to resolve populated names if they are objects, else fallback or show ID
                        const cat = typeof item.itemCategoryId === 'object' ? (item.itemCategoryId?.categoryName || item.itemCategoryId?.code) : (itemCategories.find(c => c._id === item.itemCategoryId)?.categoryName || item.itemCategoryId);
                        const uom = typeof item.itemUomId === 'object' ? (item.itemUomId?.uomName || item.itemUomId?.code) : (itemUOMs.find(u => u._id === item.itemUomId)?.uomName || item.itemUomId);
                        
                        return (
                          <tr key={item._id || index}>
                            <td style={{ padding: '10px 16px' }}>{index + 1}</td>
                            <td style={{ padding: '10px 16px' }}>{cat || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>{item.code || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>{item.itemName || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>{uom || '-'}</td>
                            <td style={{ padding: '10px 16px' }}>{item.tax !== undefined ? item.tax + '%' : '-'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>No items added yet.</td>
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

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Item Category</label>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, selectedItemId: '' })}
                        style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                      >
                        <option value="">Select category</option>
                        {itemCategories.map((c) => (
                          <option key={c._id} value={c._id}>{c.categoryName || c.code || c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Item Code</label>
                      <select
                        value={formData.selectedItemId || ''}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) {
                            setFormData({ ...formData, selectedItemId: '', itemCode: '', itemName: '', uomId: '', taxValue: '' });
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
                        style={{ padding: '12px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                      >
                        <option value="">Select item</option>
                        {items.map((it) => (
                          <option key={it._id} value={it._id}>{it.code || it.itemName || it._id}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Item Name</label>
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
                        style={{ padding: '12px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                      >
                        <option value="">Select item</option>
                        {items.map((it) => (
                          <option key={it._id} value={it._id}>{it.itemName || it.code || it._id}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: isMobile ? '1 / -1' : 'span 1' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Unit</label>
                      <select
                        value={formData.uomId}
                        onChange={(e) => setFormData({ ...formData, uomId: e.target.value })}
                        style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                      >
                        <option value="">Select unit</option>
                        {itemUOMs.map((u) => (
                          <option key={u._id} value={u._id}>{u.uomName || u.code || u.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: isMobile ? '1 / -1' : 'span 1' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tax</label>
                      <input
                        type="text"
                        placeholder="Enter tax (e.g. 18%)"
                        value={formData.taxValue}
                        onChange={(e) => setFormData({ ...formData, taxValue: e.target.value })}
                        style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                      <button className="btn-primary" onClick={handleAddTenderedItem} style={{ width: isMobile ? '100%' : '230px', padding: '12px 18px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '15px', minHeight: '44px' }}>Add New Tender Item</button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', marginBottom: '20px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                {TERMS.map((term, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={qFormData.acceptedTerms.includes(term)}
                      onChange={() => handleTermToggle(term)}
                      style={{ marginTop: '3px' }}
                    />
                    <span style={{ lineHeight: '1.4' }}>{idx + 1}) {term}</span>
                  </label>
                ))}
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
                  Loading Location
                </label>
                <input
                  type="text"
                  placeholder="Enter Loading Location"
                  value={qFormData.loading}
                  onChange={(e) => setQFormData({ ...qFormData, loading: e.target.value })}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Unloading Location
                </label>
                <input
                  type="text"
                  placeholder="Enter Unloading Location"
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
                      {qFormData.existingFileUrls.map((url, idx) => (
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
                  disabled={isSubmittingQuotation || qFormData.acceptedTerms.length !== TERMS.length}
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
                <input
                  type="checkbox"
                  checked={qFormData.acceptedTerms.length === TERMS.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setQFormData(prev => ({ ...prev, acceptedTerms: [...TERMS] }));
                    } else {
                      setQFormData(prev => ({ ...prev, acceptedTerms: [] }));
                    }
                  }}
                />
                <label style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Accept All Terms & Conditions
                </label>
              </div>
            </div>

            {/* Submitted Quotations Table */}
            <div style={{ marginTop: '32px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Submitted Quotations</h3>
                <button
                  onClick={() => setShowComparison(prev => !prev)}
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
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Total</th>
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
                          <td style={{ padding: '10px 16px' }}>{q.supplierId?.companyName || 'Unknown'}</td>
                          <td style={{ padding: '10px 16px' }}>{q.expectedDateOfDelivery}</td>
                          <td style={{ padding: '10px 16px' }}>{q.quoteRefNo}</td>
                          <td style={{ padding: '10px 16px' }}>{q.paymentTerms}</td>
                          <td style={{ padding: '10px 16px' }}>{q.freight}</td>
                          <td style={{ padding: '10px 16px' }}>{q.loading}</td>
                          <td style={{ padding: '10px 16px' }}>{q.unloading}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{getQuotationTotal(q).toFixed(2)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            {q.fileUrl && q.fileUrl.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <a href={`${window.location.origin}${q.fileUrl[0]}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FileText size={16} /> View
                                </a>
                                {q.fileUrl.length > 1 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>+{q.fileUrl.length - 1} more</span>}
                              </div>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            {activeRequest?.awardedQuotationId === q._id ? (
                              <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '9999px', fontWeight: 600 }}>Awarded</span>
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

            {showComparison && quotationList.length > 0 && (
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Full Comparison</h3>
                    <button
                      onClick={() => setShowComparison(false)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', borderRadius: '6px' }}
                    >
                      Hide Comparison
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Field</th>
                          {quotationList.map((q) => (
                            <th key={q._id} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span>{q.supplierId?.companyName || 'Supplier'}</span>
                                <button
                                  onClick={() => handleAwardQuotation(q._id)}
                                  style={{ background: activeRequest?.awardedQuotationId === q._id ? '#d1fae5' : 'var(--primary-color)', color: activeRequest?.awardedQuotationId === q._id ? '#065f46' : '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {activeRequest?.awardedQuotationId === q._id ? 'Approved' : 'Approve'}
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Quote Reference', value: (q) => q.quoteRefNo },
                          { label: 'Delivery Date', value: (q) => q.expectedDateOfDelivery },
                          { label: 'Payment Terms', value: (q) => q.paymentTerms },
                          { label: 'Freight', value: (q) => q.freight },
                          { label: 'Loading', value: (q) => q.loading },
                          { label: 'Unloading', value: (q) => q.unloading },
                          { label: 'Total', value: (q) => {
                              const freight = parseNumericField(q?.freight);
                              const loading = parseNumericField(q?.loading);
                              const unloading = parseNumericField(q?.unloading);
                              return freight + loading + unloading;
                            }
                          }
                        ].map((row) => (
                          <tr key={row.label} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600, background: 'var(--bg-primary)' }}>{row.label}</td>
                            {quotationList.map((q) => (
                              <td key={`${q._id}-${row.label}`} style={{ padding: '10px 16px' }}>{row.label === 'Total' ? row.value(q).toFixed(2) : row.value(q) || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {quotationList.length > 2 && (
                  <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Split Comparison (2 at a time)</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                      {Array.from({ length: Math.ceil(quotationList.length / 2) }, (_, index) => {
                        const group = quotationList.slice(index * 2, index * 2 + 2);
                        return (
                          <div key={`group-${index}`} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', fontWeight: 600, fontSize: '13px' }}>
                              Group {index + 1}: {group.map((q) => q.supplierId?.companyName || 'Supplier').join(' vs ')}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="data-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Field</th>
                                    {group.map((q) => (
                                      <th key={`${q._id}-pair`} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                          <span>{q.supplierId?.companyName || 'Supplier'}</span>
                                          <button
                                            onClick={() => handleAwardQuotation(q._id)}
                                            style={{ background: activeRequest?.awardedQuotationId === q._id ? '#d1fae5' : 'var(--primary-color)', color: activeRequest?.awardedQuotationId === q._id ? '#065f46' : '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                          >
                                            {activeRequest?.awardedQuotationId === q._id ? 'Approved' : 'Approve'}
                                          </button>
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { label: 'Quote Reference', value: (q) => q.quoteRefNo },
                                    { label: 'Delivery Date', value: (q) => q.expectedDateOfDelivery },
                                    { label: 'Payment Terms', value: (q) => q.paymentTerms },
                                    { label: 'Freight', value: (q) => q.freight },
                                    { label: 'Loading', value: (q) => q.loading },
                                    { label: 'Unloading', value: (q) => q.unloading },
                                    { label: 'Total', value: (q) => {
                                        const freight = parseNumericField(q?.freight);
                                        const loading = parseNumericField(q?.loading);
                                        const unloading = parseNumericField(q?.unloading);
                                        return freight + loading + unloading;
                                      }
                                    }
                                  ].map((row) => (
                                    <tr key={`${row.label}-${index}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                                      <td style={{ padding: '10px 16px', fontWeight: 600, background: 'var(--bg-primary)' }}>{row.label}</td>
                                      {group.map((q) => (
                                        <td key={`${q._id}-${row.label}-${index}`} style={{ padding: '10px 16px' }}>{row.label === 'Total' ? row.value(q).toFixed(2) : row.value(q) || '-'}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {quotationList.length > 3 && (
                  <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Triple Comparison (3 at a time)</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                      {Array.from({ length: Math.ceil(quotationList.length / 3) }, (_, index) => {
                        const group = quotationList.slice(index * 3, index * 3 + 3);
                        return (
                          <div key={`triple-group-${index}`} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', fontWeight: 600, fontSize: '13px' }}>
                              Group {index + 1}: {group.map((q) => q.supplierId?.companyName || 'Supplier').join(' | ')}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="data-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>Field</th>
                                    {group.map((q) => (
                                      <th key={`${q._id}-triple`} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--bg-primary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                          <span>{q.supplierId?.companyName || 'Supplier'}</span>
                                          <button
                                            onClick={() => handleAwardQuotation(q._id)}
                                            style={{ background: activeRequest?.awardedQuotationId === q._id ? '#d1fae5' : 'var(--primary-color)', color: activeRequest?.awardedQuotationId === q._id ? '#065f46' : '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                          >
                                            {activeRequest?.awardedQuotationId === q._id ? 'Approved' : 'Approve'}
                                          </button>
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { label: 'Quote Reference', value: (q) => q.quoteRefNo },
                                    { label: 'Delivery Date', value: (q) => q.expectedDateOfDelivery },
                                    { label: 'Payment Terms', value: (q) => q.paymentTerms },
                                    { label: 'Freight', value: (q) => q.freight },
                                    { label: 'Loading', value: (q) => q.loading },
                                    { label: 'Unloading', value: (q) => q.unloading },
                                    { label: 'Total', value: (q) => {
                                        const freight = parseNumericField(q?.freight);
                                        const loading = parseNumericField(q?.loading);
                                        const unloading = parseNumericField(q?.unloading);
                                        return freight + loading + unloading;
                                      }
                                    }
                                  ].map((row) => (
                                    <tr key={`${row.label}-${index}-triple`} style={{ borderTop: '1px solid var(--border-color)' }}>
                                      <td style={{ padding: '10px 16px', fontWeight: 600, background: 'var(--bg-primary)' }}>{row.label}</td>
                                      {group.map((q) => (
                                        <td key={`${q._id}-${row.label}-${index}-triple`} style={{ padding: '10px 16px' }}>{row.label === 'Total' ? row.value(q).toFixed(2) : row.value(q) || '-'}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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
