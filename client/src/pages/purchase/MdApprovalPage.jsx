import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileText, Printer, Download, CheckCircle, XCircle } from 'lucide-react';
import { materialRequestApi, quotationApi, purchaseOrderApi, comparisonApi } from '../../api/masterApi';
import { useToast } from '../../contexts/ToastContext';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function getSupplierName(quote) {
  if (!quote || !quote.supplierId) return 'Unknown Supplier';
  if (typeof quote.supplierId === 'string') {
    return quote.supplierId;
  }
  return quote.supplierId.companyName || quote.supplierId.name || 'Unknown Supplier';
}

function getSiteName(item) {
  if (item.siteTypeId && item.siteTypeId.siteType) return item.siteTypeId.siteType;
  return item.siteTypeId || 'Unknown Site';
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default function MdApprovalPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [requestData, setRequestData] = useState(null);
  const [quotationList, setQuotationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [poData, setPoData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [{ data: requestRes }, { data: quotationRes }] = await Promise.all([
          materialRequestApi.getOne(id),
          quotationApi.list({ materialRequestId: id, limit: 1000 }),
        ]);
        if (requestRes?.data) {
          setRequestData(requestRes.data);
        }
        if (quotationRes?.data) {
          setQuotationList(quotationRes.data.data || []);
        }
      } catch (error) {
        console.error('Failed to load MD approval data', error);
        toast.error('Failed to load MD approval details.');
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id, toast]);

  const awardedQuote = useMemo(() => {
    if (!requestData || !quotationList.length) return null;
    return quotationList.find((quote) => String(quote._id) === String(requestData.awardedQuotationId)) || null;
  }, [requestData, quotationList]);

  const selectedSupplier = awardedQuote ? getSupplierName(awardedQuote) : 'Not selected';

  const itemRows = useMemo(() => {
    if (!requestData || !Array.isArray(requestData.purchaseItems)) return [];
    return requestData.purchaseItems.map((item) => {
      const idValue = item._id || item.itemId || item.id || '';
      const quoteItem = awardedQuote?.quotationItems?.find((qi) => String(qi.itemId) === String(idValue));
      const qty = parseNumber(item.quantity || item.approvedQty || 0);
      const rate = quoteItem ? parseNumber(quoteItem.rate) : 0;
      const taxPercent = quoteItem ? parseNumber(quoteItem.taxPercent) : 0;
      const amount = qty * rate;
      const taxAmount = amount * (taxPercent / 100);
      const total = amount + taxAmount;
      return {
        reference: item.itemName || (item.itemId?.itemName || item.itemId?.code) || idValue,
        description: item.specification || item.itemName || '-',
        qty,
        unit: item.uomId?.uomName || item.unit || 'NOS',
        rate,
        gst: `${taxPercent}%`,
        taxAmount,
        amount,
        total,
      };
    });
  }, [requestData, awardedQuote]);

  const grandTotal = useMemo(() => itemRows.reduce((sum, row) => sum + row.total, 0), [itemRows]);

  const handleBack = () => navigate(-1);

  const handleApprove = async () => {
    if (!requestData) return;
    setProcessing(true);
    try {
      const response = await comparisonApi.mdApprove(requestData._id, { approvalRemarks: requestData.approvalRemarks || '' });
      const updated = response?.data?.data;
      if (updated) {
        setRequestData(updated);
      }
      toast.success('Comparison approved by MD. Purchase order can now be generated.');
    } catch (error) {
      console.error('MD approve failed', error);
      toast.error(error?.response?.data?.message || 'Failed to approve comparison.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!requestData) return;
    if (!rejectionRemarks.trim()) {
      toast.error('Please enter rejection remarks.');
      return;
    }
    setProcessing(true);
    try {
      const response = await comparisonApi.mdReject(requestData._id, { approvalRemarks: rejectionRemarks });
      const updated = response?.data?.data;
      if (updated) {
        setRequestData(updated);
      }
      toast.success('Comparison rejected and remarks saved.');
    } catch (error) {
      console.error('MD reject failed', error);
      toast.error(error?.response?.data?.message || 'Failed to reject comparison.');
    } finally {
      setProcessing(false);
    }
  };

  const handleGeneratePo = async () => {
    if (!requestData) return;
    setGenerateLoading(true);
    try {
      const { data } = await purchaseOrderApi.generate({ materialRequestId: requestData._id });
      setPoData(data.data);
      setRequestData((prev) => ({ ...prev, poGenerated: true, poNumber: data.data.poNumber, comparisonStatus: 'PO Generated' }));
      toast.success('Purchase order generated successfully.');
    } catch (error) {
      console.error('PO generation failed', error);
      toast.error(error?.response?.data?.message || 'Failed to generate purchase order.');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    const isMdApproved = requestData?.mdApprovalStatus === 'Approved' || requestData?.mdApproval === 'Approved';
    if (!requestData || !isMdApproved) {
      toast.error('PDF download is available only after MD approval.');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ format: 'a4' });
      const pdfData = poData || requestData;
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 18;
      doc.setFontSize(14);
      doc.text(poData ? 'PURCHASE ORDER' : 'APPROVED COMPARISON', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(10);
      doc.text(`${poData ? 'PO Number' : 'Comparison No'}: ${poData?.poNumber || requestData.comparisonNo || '-'}`, 14, y);
      doc.text(`Date: ${formatDate(pdfData.createdAt)}`, pageWidth - 14, y, { align: 'right' });
      y += 8;
      doc.text(`Comparison No: ${requestData.comparisonNo || '-'}`, 14, y);
      doc.text(`Project: ${getSiteName(requestData)}`, pageWidth - 14, y, { align: 'right' });
      y += 10;
      doc.setFontSize(11);
      doc.text('Supplier Details', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(selectedSupplier, 14, y);
      y += 5;
      if (awardedQuote?.paymentTerms) doc.text(`Payment Terms: ${awardedQuote.paymentTerms}`, 14, y), y += 5;
      if (awardedQuote?.expectedDateOfDelivery) doc.text(`Delivery Date: ${awardedQuote.expectedDateOfDelivery}`, 14, y), y += 5;
      y += 6;
      doc.text('Material Comparison', 14, y);
      y += 6;

      const headers = ['S.No', 'Item', 'Qty', 'Unit', 'Rate', 'GST', 'Tax', 'Amount'];
      const cellWidth = [12, 56, 16, 18, 20, 15, 16, 25];
      const startX = 14;
      let x = startX;
      doc.setFontSize(9);
      headers.forEach((header, index) => {
        doc.text(header, x, y);
        x += cellWidth[index];
      });
      y += 6;

      itemRows.forEach((row, index) => {
        if (y > 270) {
          doc.addPage();
          y = 18;
        }
        x = startX;
        const rowData = [String(index + 1), row.reference, String(row.qty), row.unit, row.rate.toFixed(2), row.gst, row.taxAmount.toFixed(2), row.total.toFixed(2)];
        rowData.forEach((value, idx) => {
          doc.text(value, x, y);
          x += cellWidth[idx];
        });
        y += 6;
      });
      y += 8;
      doc.text(`Subtotal: ₹${grandTotal.toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
      y += 6;
      doc.text(`Grand Total: ₹${grandTotal.toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
      y += 10;
      doc.text('Terms & Conditions', 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.text('1. Prices are inclusive of applicable GST.\n2. Delivery at site and acceptance subject to inspection.\n3. Invoice should mention this PO number.', 14, y, { maxWidth: pageWidth - 28 });

      doc.save(`${poData?.poNumber || requestData.comparisonNo || 'approved-comparison'}.pdf`);
      toast.success('PDF downloaded.');
    } catch (error) {
      console.error('PDF generation failed', error);
      toast.error('Failed to generate PDF.');
    }
  };

  const titleTarget = document.getElementById('header-title-target');

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 110px)', padding: '24px' }}>
      {titleTarget && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>MD Approval</h1>
        </div>,
        titleTarget
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={handleBack} className="btn btn-secondary" style={{ padding: '8px 12px', borderRadius: '8px' }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {loading ? (
        <div className="table-loading">Loading MD approval data…</div>
      ) : !requestData ? (
        <div className="table-loading">Material request not found.</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Purchase Indent No</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{requestData.indentNo || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Comparison No</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{requestData.comparisonNo || `CMP-${requestData.indentNo || requestData._id}`}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Date</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{formatDate(requestData.createdAt)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Project</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{getSiteName(requestData)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Requested By</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{requestData.raisedByName || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Status</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{requestData.comparisonStatus || 'Pending'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ marginBottom: '12px', fontWeight: 600 }}>Supplier Details</div>
              <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                <div><strong>Supplier:</strong> {selectedSupplier}</div>
                <div><strong>Quotation:</strong> {awardedQuote?.quoteRefNo || 'Not selected'}</div>
                <div><strong>Payment Terms:</strong> {awardedQuote?.paymentTerms || '—'}</div>
                <div><strong>Freight:</strong> {awardedQuote?.freight || '—'}</div>
                <div><strong>Loading:</strong> {awardedQuote?.loading || '—'}</div>
                <div><strong>Unloading:</strong> {awardedQuote?.unloading || '—'}</div>
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ marginBottom: '12px', fontWeight: 600 }}>Selected Supplier</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Grand Total</div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>₹{grandTotal.toFixed(2)}</div>
              <div style={{ marginTop: '20px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>Remarks</div>
                <textarea
                  value={requestData.approvalRemarks || ''}
                  rows={4}
                  disabled={requestData.mdApprovalStatus === 'Approved' || requestData.mdApprovalStatus === 'Rejected'}
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  onChange={(e) => setRequestData((prev) => ({ ...prev, approvalRemarks: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
            <div style={{ marginBottom: '14px', fontWeight: 600 }}>Material Comparison</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Rate</th>
                    <th>GST</th>
                    <th>Tax</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{row.reference}</td>
                      <td>{row.description}</td>
                      <td>{row.qty}</td>
                      <td>{row.unit}</td>
                      <td>₹{row.rate.toFixed(2)}</td>
                      <td>{row.gst}</td>
                      <td>₹{row.taxAmount.toFixed(2)}</td>
                      <td>₹{row.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button
              onClick={handleApprove}
              disabled={processing || requestData.mdApprovalStatus === 'Approved' || requestData.comparisonStatus === 'Rejected'}
              className="btn btn-primary"
            >
              <CheckCircle size={16} /> {requestData.mdApprovalStatus === 'Approved' ? 'Approved' : 'Approve'}
            </button>
            <button
              onClick={handleReject}
              disabled={processing || requestData.mdApprovalStatus === 'Rejected'}
              className="btn btn-secondary"
            >
              <XCircle size={16} /> {requestData.mdApprovalStatus === 'Rejected' ? 'Rejected' : 'Reject'}
            </button>
            <button
              onClick={handleGeneratePo}
              disabled={generateLoading || (requestData.mdApprovalStatus !== 'Approved' && requestData.mdApproval !== 'Approved') || requestData.poGenerated}
              className="btn btn-primary"
            >
              {requestData.poGenerated ? 'PO Generated' : (generateLoading ? 'Generating PO...' : 'Generate Purchase Order')}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={requestData.mdApprovalStatus !== 'Approved' && requestData.mdApproval !== 'Approved'}
              className="btn btn-secondary"
              title={requestData.mdApprovalStatus === 'Approved' || requestData.mdApproval === 'Approved' ? 'Download approved PDF' : 'Available after MD approval'}
            >
              <Download size={16} /> Download PDF
            </button>
            <button onClick={() => window.print()} className="btn btn-secondary">
              <Printer size={16} /> Print PO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
