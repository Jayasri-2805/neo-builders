import { useEffect, useState, useRef, useCallback } from 'react';
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
  const [taxes, setTaxes] = useState([]);
  
  const [formData, setFormData] = useState({
    categoryId: '',
    itemCode: '',
    itemName: '',
    uomId: '',
    taxValue: ''
  });
  
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [isAddTenderedItemPopupOpen, setIsAddTenderedItemPopupOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [isQuotationPanelOpen, setIsQuotationPanelOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [quotationList, setQuotationList] = useState([]);
  const [editingQuotationId, setEditingQuotationId] = useState(null);
  const [quotationToDelete, setQuotationToDelete] = useState(null);
  const [isSubmittingQuotation, setIsSubmittingQuotation] = useState(false);
  const fileInputRef = useRef(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [qFormData, setQFormData] = useState({
    supplierId: '',
    quoteRefNo: '',
    expectedDateOfDelivery: '',
    paymentTerms: '',
    freight: '',
    loading: '',
    unloading: '',
    file: null,
    existingFileUrl: '',
    acceptedTerms: []
  });

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

  const clearQuotationForm = () => {
    setEditingQuotationId(null);
    setQFormData({
      supplierId: '', quoteRefNo: '', expectedDateOfDelivery: '', paymentTerms: '',
      freight: '', loading: '', unloading: '', file: null, existingFileUrl: '', acceptedTerms: []
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    const isQuot = searchParams.get('quotation') === 'true';
    if (requestId && requests.length > 0 && !isPanelOpen && !activeRequest) {
      const req = requests.find(r => r._id === requestId);
      if (req) {
        setActiveRequest(req);
        setTimeout(() => {
          setIsPanelOpen(true);
          if (isQuot) {
            setIsQuotationPanelOpen(true);
          }
        }, 10);
      }
    }
  }, [searchParams, requests, isPanelOpen, activeRequest]);

  const fetchRequests = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    try {
      const [res, ptRes, catRes, uomRes, taxRes, suppRes] = await Promise.all([
        materialRequestApi.listAll(),
        productTypeApi.listAll(),
        itemCategoryApi.listAll(),
        itemUomApi.listAll(),
        taxApi.listAll(),
        supplierApi.listAll()
      ]);
      
      if (ptRes.data.success) setProductTypes(ptRes.data.data || []);
      if (catRes.data.success) setItemCategories(catRes.data.data || []);
      if (uomRes.data.success) setItemUOMs(uomRes.data.data || []);
      if (taxRes.data.success) setTaxes(taxRes.data.data || []);
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
        const createdItem = itemRes.data.data;
        
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
        setFormData({ categoryId: '', itemCode: '', itemName: '', uomId: '', taxValue: '' });
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
    if (!qFormData.supplierId || !qFormData.quoteRefNo || !qFormData.expectedDateOfDelivery || !qFormData.paymentTerms || !qFormData.freight || !qFormData.loading || !qFormData.unloading) {
      showToast('Please fill all fields', 'error');
      setIsSubmittingQuotation(false);
      return;
    }

    try {
      let finalFileUrl = qFormData.existingFileUrl || '';
      if (qFormData.file) {
        const formPayload = new FormData();
        formPayload.append('files', qFormData.file);
        const uploadRes = await uploadAttachment(formPayload);
        if (uploadRes.data.status === 'success' && uploadRes.data.data.fileUrls.length > 0) {
          finalFileUrl = uploadRes.data.data.fileUrls[0];
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
        fileUrl: finalFileUrl,
        termsAndConditions: qFormData.acceptedTerms
      };

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
        freight: '', loading: '', unloading: '', file: null, existingFileUrl: '', acceptedTerms: []
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchQuotations();
    } catch (error) {
      console.error('Failed to submit quotation:', error);
      showToast('Failed to save quotation. Please try again.', 'error');
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
      file: null, // Keep file null unless they want to upload a new one
      existingFileUrl: q.fileUrl || '',
      acceptedTerms: q.termsAndConditions || []
    });
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

  const getEmployeeName = (item) => {
    return item.raisedByName || 'Unknown';
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
    
    // Optimistic update
    const updatedRequests = [...requests];
    updatedRequests[requestIndex] = { ...updatedRequests[requestIndex], pmPdApproval: newStatus };
    setRequests(updatedRequests);
    
    if (activeRequest && activeRequest._id === id) {
      setActiveRequest({ ...activeRequest, pmPdApproval: newStatus });
    }

    try {
      await materialRequestApi.update(id, { pmPdApproval: newStatus });
    } catch (err) {
      console.error('Failed to update PM/PD approval', err);
      // Revert on failure
      const revertRequests = [...requests];
      revertRequests[requestIndex] = { ...revertRequests[requestIndex], pmPdApproval: currentStatus };
      setRequests(revertRequests);
      
      if (activeRequest && activeRequest._id === id) {
        setActiveRequest({ ...activeRequest, pmPdApproval: currentStatus });
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

  const portalTarget = document.getElementById('header-actions-target');
  const titleTarget = document.getElementById('header-title-target');
  const appMainTarget = document.getElementById('app-main-target');

  return (
    <div className="page" style={{ position: 'relative', overflowX: 'hidden', minHeight: 'calc(100vh - 110px)' }}>
      {titleTarget && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Material Requests</h1>
        </div>,
        titleTarget
      )}

      {portalTarget && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        </div>,
        portalTarget
      )}

      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading requestsΓÇª</div>
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
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(item.createdAt).toLocaleDateString('en-GB')}</span>
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
                        <span className="cell-truncate" style={{ fontWeight: 500 }}>{getEmployeeName(item)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '4px' }}>PM/PD Approval</span>
                        {item.pmPdApproval === 'Approved' ? (
                          <span className="badge badge-success" style={{ width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Approved</span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Pending</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Admin Approval</span>
                        <span className="badge badge-muted" style={{ fontWeight: 500, width: 'fit-content', padding: '2px 4px', fontSize: '9px' }}>Coming Soon</span>
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
              <div className="table-wrapper">
                <table className="data-table">
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
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((item) => (
                      <tr key={item._id}>
                        <td>{new Date(item.createdAt).toLocaleDateString('en-GB')}</td>
                        <td>{item.indentNo || '-'}</td>
                        <td>{getSiteName(item)}</td>
                        <td><span className="badge badge-muted" style={{ fontSize: '10px', background: getProductTypeName(item) !== '-' ? 'var(--bg-elevated)' : '' }}>{getProductTypeName(item)}</span></td>
                        <td>
                          <span className={`badge ${getPriorityClass(item.priority)}`}>{item.priority || 'Medium'}</span>
                        </td>
                        <td className="cell-truncate"><div title={item.material || 'N/A'}>{item.material || 'N/A'}</div></td>
                        <td>
                          <span className={`badge ${getStatusClass(item.status)}`}>{item.status || 'Pending'}</span>
                        </td>
                        <td className="cell-truncate"><div title={getEmployeeName(item)}>{getEmployeeName(item)}</div></td>
                        <td style={{ textAlign: 'center' }}>
                          {item.pmPdApproval === 'Approved' ? (
                            <span className="badge badge-success" style={{ fontSize: '10px' }}>Approved</span>
                          ) : (
                            <span className="badge badge-muted" style={{ fontSize: '10px' }}>Pending</span>
                          )}
                        </td>
                        <td><span className="badge badge-muted" style={{ fontSize: '10px' }}>Coming Soon</span></td>
                        <td>
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
            top: '52px',
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
                <h2 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px' }}>Add Purchased Item</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={openQuotationPanel}
                  className="btn-primary" 
                  style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: 'none', color: 'white' }}
                >
                  <FileText size={14} />
                  Quotation
                </button>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '6px' }}>
                  Indent No: {activeRequest.indentNo}
                </span>
              </div>
            </div>
            
            {isMobile ? (
              <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Date</span>
                    <span style={{ fontWeight: 500 }}>{new Date(activeRequest.createdAt).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Site</span>
                    <span style={{ fontWeight: 500 }}>{getSiteName(activeRequest)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Type</span>
                    <select 
                      value={(typeof activeRequest.productTypeId === 'object' ? activeRequest.productTypeId?._id : activeRequest.productTypeId) || productTypes.find(pt => pt.productType?.toLowerCase() === 'none')?._id || ''} 
                      onChange={(e) => handleProductTypeChange(activeRequest._id, e)}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }}
                    >
                      {productTypes.map(pt => (
                        <option key={pt._id} value={pt._id}>{pt.productType}</option>
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
                    <button onClick={(e) => handlePmToggle(activeRequest._id, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeRequest.pmPdApproval === 'Approved' ? 'var(--success)' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 0 }} title={activeRequest.pmPdApproval === 'Approved' ? 'Approved' : 'Click to Approve'}>
                      <CheckCircle size={24} strokeWidth={activeRequest.pmPdApproval === 'Approved' ? 2.5 : 2} />
                      {activeRequest.pmPdApproval === 'Approved' && <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>Approved</span>}
                    </button>
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
                        value={(typeof activeRequest.productTypeId === 'object' ? activeRequest.productTypeId?._id : activeRequest.productTypeId) || productTypes.find(pt => pt.productType?.toLowerCase() === 'none')?._id || ''} 
                        onChange={(e) => handleProductTypeChange(activeRequest._id, e)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', minWidth: '100px' }}
                      >
                        {productTypes.map(pt => (
                          <option key={pt._id} value={pt._id}>{pt.productType}</option>
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
                  title="Add Tendered Item"
                  onClick={() => setIsAddTenderedItemPopupOpen(true)}
                  style={{ 
                    background: '#5a55d2', // matches the purple/blue in the image
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px', // rounded corners like in the image
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              </div>
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table className="data-table" style={{ fontSize: '13px', margin: 0 }}>
                  <thead>
                    <tr>
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
                            <td>{cat || '-'}</td>
                            <td>{item.code || '-'}</td>
                            <td>{item.itemName || '-'}</td>
                            <td>{uom || '-'}</td>
                            <td>{item.tax !== undefined ? item.tax + '%' : '-'}</td>
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
                        <a 
                          key={idx} 
                          href={fullUrl} 
                          target="_blank" 
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
                          {isImage ? (
                            <img src={fullUrl} alt={`Attachment ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                          ) : (
                            <>
                              <FileText size={32} color="var(--primary-color)" style={{ marginBottom: '8px' }} />
                              <span style={{ fontSize: '10px', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {photoUrl.split('/').pop() || `File ${idx + 1}`}
                              </span>
                            </>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <br /><br />
            {/* Add Tendered Items Section Popup */}
            {isAddTenderedItemPopupOpen && createPortal(
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Add Tendered Items</h3>
                    <button onClick={() => setIsAddTenderedItemPopupOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-secondary)' }}>&times;</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Item Category</label>
                      <select value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
                        <option value="">Choose...</option>
                        {itemCategories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.categoryName || cat.code}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Item Code</label>
                      <input type="text" placeholder="Enter Code" value={formData.itemCode} onChange={(e) => setFormData({...formData, itemCode: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Item Name</label>
                      <input type="text" placeholder="Enter Name" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Unit</label>
                      <select value={formData.uomId} onChange={(e) => setFormData({...formData, uomId: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
                        <option value="">UOM</option>
                        {itemUOMs.map(uom => (
                          <option key={uom._id} value={uom._id}>{uom.uomName || uom.code}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tax</label>
                      <select value={formData.taxValue} onChange={(e) => setFormData({...formData, taxValue: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
                        <option value="">Choose Tax...</option>
                        {taxes.map(tax => (
                          <option key={tax._id} value={tax.taxPercentage}>{tax.taxName} ({tax.taxPercentage}%)</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                      <button className="btn-primary" onClick={handleAddTenderedItem} style={{ width: '100%', padding: '8px 16px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Add</button>
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
          top: '52px',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? '16px' : '20px', fontWeight: '600' }}>Quotation Details</h2>
                <div 
                  onClick={() => setIsTermsOpen(!isTermsOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                >
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>View Terms & Conditions</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{isTermsOpen ? '-' : '+'}</span>
                </div>
              </div>
              <button 
                onClick={closeQuotationPanel}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', color: 'var(--primary-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                title="Close"
              >
                <X size={20} />
              </button>
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

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', gap: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Supplier</label>
                <select 
                  value={qFormData.supplierId} 
                  onChange={(e) => setQFormData({...qFormData, supplierId: e.target.value})} 
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(sup => (
                    <option key={sup._id} value={sup._id}>{sup.companyName} ({sup.contactName})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Quote Ref No</label>
                <input type="text" placeholder="Enter Reference No" value={qFormData.quoteRefNo} onChange={(e) => setQFormData({...qFormData, quoteRefNo: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expected Date of Delivery</label>
                <input type="date" value={qFormData.expectedDateOfDelivery} onChange={(e) => setQFormData({...qFormData, expectedDateOfDelivery: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Payment Terms</label>
                <input type="text" placeholder="Enter Payment Terms" value={qFormData.paymentTerms} onChange={(e) => setQFormData({...qFormData, paymentTerms: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Freight</label>
                <input type="text" placeholder="Enter Freight" value={qFormData.freight} onChange={(e) => setQFormData({...qFormData, freight: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Loading</label>
                <input type="text" placeholder="Enter Loading" value={qFormData.loading} onChange={(e) => setQFormData({...qFormData, loading: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Unloading</label>
                <input type="text" placeholder="Enter Unloading" value={qFormData.unloading} onChange={(e) => setQFormData({...qFormData, unloading: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>File Upload</label>
                <input type="file" onChange={(e) => setQFormData({...qFormData, file: e.target.files[0]})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <button 
                  onClick={handleQuotationSubmit}
                  disabled={isSubmittingQuotation}
                  className="btn-primary"
                  style={{ padding: '8px 24px', height: '35px', borderRadius: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isSubmittingQuotation ? 0.7 : 1, cursor: isSubmittingQuotation ? 'not-allowed' : 'pointer', border: 'none', color: 'white' }}
                >
                  <CheckCircle size={16} />
                  {isSubmittingQuotation ? 'Saving...' : (editingQuotationId ? 'Update' : 'Submit')}
                </button>
                {editingQuotationId && (
                  <button 
                    onClick={clearQuotationForm}
                    disabled={isSubmittingQuotation}
                    style={{ padding: '8px 16px', height: '35px', borderRadius: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: isSubmittingQuotation ? 'not-allowed' : 'pointer' }}
                    title="Cancel Edit & Clear Form"
                  >
                    <X size={16} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--accent)', background: 'var(--bg-primary)', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <input 
                  type="checkbox" 
                  checked={qFormData.acceptedTerms.length === TERMS.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setQFormData({...qFormData, acceptedTerms: [...TERMS]});
                    } else {
                      setQFormData({...qFormData, acceptedTerms: []});
                    }
                  }}
                  style={{ margin: 0 }}
                />
                <span>Accept All Terms & Conditions</span>
              </label>
            </div>

            {/* Submitted Quotations Table */}
            <div style={{ marginTop: '32px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Submitted Quotations</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Sno</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Supplier</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Delivery Date</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Quote Ref No</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Payment Terms</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Freight</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Loading</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Unloading</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>File</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotationList.length === 0 ? (
                      <tr><td colSpan="10" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No quotations submitted yet.</td></tr>
                    ) : (
                      quotationList.map((q, idx) => (
                        <tr key={q._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.supplierId?.companyName || 'Unknown'}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.expectedDateOfDelivery}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.quoteRefNo}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.paymentTerms}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.freight}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.loading}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>{q.unloading}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>
                            {q.fileUrl ? (
                              <a href={`${window.location.origin}${q.fileUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FileText size={16} /> View File
                              </a>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '13px' }}>
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

          </div>
        )}
      </div>,
      appMainTarget
    ) : null}

      {/* Delete Confirmation Modal */}
      {quotationToDelete && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
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
