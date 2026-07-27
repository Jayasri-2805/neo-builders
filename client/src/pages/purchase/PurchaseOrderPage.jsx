import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Eye, Pencil, Trash2, Filter, CheckCircle, Clock, ArrowUp, Download } from 'lucide-react';
import { purchaseOrderApi } from '../../api/masterApi';
import MasterViewModal from '../../components/masters/MasterViewModal';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function renderRefLabel(value) {
  return value?.companyName || value?.productType || value?.priorityName || value?.siteType || value?.siteName || '—';
}

function renderPriorityBadge(priorityName) {
  if (!priorityName) return '—';
  return (
    <span className={`priority-badge priority-${String(priorityName).toLowerCase()}`}>
      <ArrowUp size={10} />
      {priorityName}
    </span>
  );
}

function renderStatusBadge(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  let icon = <Clock size={10} />;
  let background = 'rgba(249,115,22,0.12)';
  let color = '#92400e';

  if (normalized === 'ordered' || normalized === 'completed' || normalized === 'approved') {
    icon = <CheckCircle size={10} />;
    background = 'rgba(16,185,129,0.14)';
    color = '#065f46';
  }
  if (normalized === 'rejected') {
    icon = <X size={12} />;
    background = 'rgba(239,68,68,0.12)';
    color = '#991b1b';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '9999px',
      background,
      color,
      fontWeight: 600,
      fontSize: '0.68rem'
    }}>
      {icon}
      {status || 'Pending'}
    </span>
  );
}

export default function PurchaseOrderPage() {
  const [orders, setOrders] = useState([]);
  const [portalTarget, setPortalTarget] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState(null);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    setPortalTarget(document.getElementById('header-actions-target'));
  }, []);

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      try {
        const { data } = await purchaseOrderApi.list({ limit: 1000 });
        if (Array.isArray(data.data) && data.data.length > 0) {
          setOrders(data.data);
        }
      } catch (err) {
        console.error('Failed to load purchase orders', err);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const filterOptions = useMemo(() => {
    const options = {
      site: new Set(),
      supplier: new Set(),
      orderStatus: new Set(),
    };
    orders.forEach((order) => {
      if (order.siteId?.siteType) options.site.add(order.siteId.siteType);
      if (order.supplierId?.companyName) options.supplier.add(order.supplierId.companyName);
      if (order.orderStatus) options.orderStatus.add(order.orderStatus);
    });
    return {
      site: Array.from(options.site).sort(),
      supplier: Array.from(options.supplier).sort(),
      orderStatus: Array.from(options.orderStatus).sort(),
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (order.indentSnapshot?.indentStatus === 'Rejected' || order.purchaseIndentId?.indentStatus === 'Rejected') return false;
      if (filters.site && filters.site !== 'All' && order.siteId?.siteType !== filters.site) return false;
      if (filters.supplier && filters.supplier !== 'All' && order.supplierId?.companyName !== filters.supplier) return false;
      if (filters.orderStatus && filters.orderStatus !== 'All' && order.orderStatus !== filters.orderStatus) return false;
      if (!term) return true;
      const text = [
        order.indentNo,
        order.siteId?.siteType,
        order.productTypeId?.productType,
        order.type,
        order.priorityId?.priorityName,
        order.purposeOfIndent,
        order.material,
        order.raisedByName,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(term);
    });
  }, [orders, search, filters]);

  const handleViewOrder = (order) => setViewingOrder(order);

  const handleDownloadPdf = async (order) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 18;
      const quotation = order.quotationSnapshot || {};
      const items = Array.isArray(quotation.quotationItems) ? quotation.quotationItems : [];

      doc.setFontSize(14);
      doc.text('PURCHASE ORDER', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(10);
      doc.text(`PO Number: ${order.poNumber || '-'}`, 14, y);
      doc.text(`PO Date: ${formatDate(order.createdAt)}`, pageWidth - 14, y, { align: 'right' });
      y += 8;
      doc.text(`Indent No: ${order.indentNo || '-'}`, 14, y);
      doc.text(`Supplier: ${renderRefLabel(order.supplierId)}`, pageWidth - 14, y, { align: 'right' });
      y += 12;
      doc.setFontSize(11);
      doc.text('Order Details', 14, y);
      y += 7;
      doc.setFontSize(9);
      const headers = ['S.No', 'Item', 'Qty', 'Rate', 'GST', 'Amount'];
      const widths = [14, 82, 20, 24, 20, 28];
      let x = 14;
      headers.forEach((header, index) => {
        doc.text(header, x, y);
        x += widths[index];
      });
      y += 6;

      items.forEach((item, index) => {
        if (y > 270) {
          doc.addPage();
          y = 18;
        }
        x = 14;
        const quantity = Number(item.quantity || item.approvedQty || 0);
        const amount = Number(item.total || 0);
        const row = [String(index + 1), String(item.itemName || item.itemId || '-'), String(quantity), Number(item.rate || 0).toFixed(2), `${Number(item.taxPercent || 0)}%`, amount.toFixed(2)];
        row.forEach((value, valueIndex) => {
          doc.text(value, x, y);
          x += widths[valueIndex];
        });
        y += 6;
      });

      y += 8;
      doc.text(`Subtotal: ${Number(order.subTotal || 0).toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
      y += 6;
      doc.text(`Grand Total: ${Number(order.grandTotal || order.totalAmount || 0).toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
      const terms = order.quotationSnapshot?.termsAndConditions;
      if (terms && (Array.isArray(terms) ? terms.length : String(terms).trim())) {
        y += 12;
        doc.text('Terms & Conditions:', 14, y);
        y += 6;
        const termText = Array.isArray(terms) ? terms.join('\n') : String(terms);
        doc.text(doc.splitTextToSize(termText, pageWidth - 28), 14, y);
      }
      doc.save(`${order.poNumber || 'purchase-order'}.pdf`);
      toast.success('Purchase order PDF downloaded.');
    } catch (error) {
      console.error('Purchase order PDF generation failed', error);
      toast.error('Failed to generate purchase order PDF.');
    }
  };

  const handleDeleteOrder = async (order) => {
    const confirmed = await confirm({
      title: 'Delete Purchase Order',
      message: 'Are you sure you want to delete this purchase order? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await purchaseOrderApi.remove(order._id);
      setOrders((prev) => prev.filter((item) => item._id !== order._id));
      toast.success('Purchase order deleted successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete purchase order.');
    }
  };

  const viewConfig = {
    title: 'Purchase Order',
    fields: [
      { name: 'poNumber', label: 'PO No' },
      { name: 'indentNo', label: 'Indent No' },
      { name: 'requestNo', label: 'Request No' },
      { name: 'siteId', label: 'Site', type: 'ref' },
      { name: 'supplierId', label: 'Supplier', type: 'ref' },
      { name: 'requestedByName', label: 'Requested By' },
      { name: 'requestDate', label: 'Request Date' },
      { name: 'totalAmount', label: 'Total Amount' },
      { name: 'orderStatus', label: 'Status' },
    ],
  };

  return (
    <div className="purchase-page" style={{ padding: '24px' }}>
      {portalTarget && createPortal(
        <div className="purchase-page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          {showSearch ? (
            <div className="search-input header-search" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <Search size={15} />
              <input
                autoFocus
                placeholder="Search purchase orders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '180px' }}
              />
              <button
                onClick={() => { setShowSearch(false); setSearch(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              className="icon-btn"
              onClick={() => setShowSearch(true)}
              title="Search"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <Search size={15} />
            </button>
          )}

          <button
            className="icon-btn"
            onClick={() => setShowFilters(prev => {
              const next = !prev;
              if (!next) setFilters({});
              return next;
            })}
            title="Filters"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
          >
            <Filter size={15} />
          </button>
        </div>,
        portalTarget
      )}

      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Sno</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>PO No</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Indent No</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Request No</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Site</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Supplier</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Requested By</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Request Date</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Total Amount</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Priority</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Order Status</th>
                <th className="col-actions" style={{ padding: '10px 16px', textAlign: 'left', width: '1%' }}>Actions</th>
              </tr>
              {showFilters && (
                <tr className="filters-row">
                <th />
                <th />
                <th />
                <th />
                <th>
                  <select className="table-filter" value={filters.site || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, site: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.site.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <select className="table-filter" value={filters.supplier || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, supplier: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.supplier.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th />
                <th />
                <th>
                  <select className="table-filter" value={filters.orderStatus || 'All'} onChange={(e) => setFilters((prev) => ({ ...prev, orderStatus: e.target.value }))}>
                    <option value="All">All</option>
                    {filterOptions.orderStatus.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th />
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading purchase orders…</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No purchase orders found</td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => (
                  <tr key={order._id || index}>
                    <td style={{ padding: '10px 16px' }}>{index + 1}</td>
                    <td style={{ padding: '10px 16px' }}>{order.poNumber || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{order.indentNo || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{order.requestNo || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{renderRefLabel(order.siteId)}</td>
                    <td style={{ padding: '10px 16px' }}>{renderRefLabel(order.supplierId)}</td>
                    <td style={{ padding: '10px 16px' }}>{order.requestedByName || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{formatDate(order.requestDate)}</td>
                    <td style={{ padding: '10px 16px' }}>{order.totalAmount != null ? order.totalAmount : '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{renderPriorityBadge(order.priorityId?.priorityName)}</td>
                    <td style={{ padding: '10px 16px' }}>{renderStatusBadge(order.orderStatus)}</td>
                    <td className="col-actions" data-label="Actions" style={{ padding: '10px 16px' }}>
                      <div className="purchase-page-action-group" style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="icon-btn" title="View" onClick={() => handleViewOrder(order)}><Eye size={15} /></button>
                        <button className="icon-btn" title="Download PDF" onClick={() => handleDownloadPdf(order)}><Download size={15} /></button>
                        <button className="icon-btn" title="Edit" onClick={() => handleViewOrder(order)}><Pencil size={15} /></button>
                        <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteOrder(order)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingOrder && (
        <MasterViewModal
          config={viewConfig}
          data={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  );
}

