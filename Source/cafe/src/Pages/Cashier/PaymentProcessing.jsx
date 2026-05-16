import React, { useState, useEffect, useCallback } from 'react';
import OrderListSkeleton from '../../components/skeletons/OrderListSkeleton';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { useSearchParams } from 'react-router-dom';
import { FaSync, FaUtensils, FaShoppingBag, FaMoneyBillWave, FaCreditCard, FaMobileAlt, FaQrcode, FaPrint, FaCheckCircle, FaTimes, FaChevronLeft, FaChevronRight, FaExclamationTriangle, FaHistory, FaFilter, FaSearch } from 'react-icons/fa';
import { getJson, postJson, getImageUrl } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './PaymentProcessing.css';

export default function PaymentProcessing() {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [mobilePaymentApp, setMobilePaymentApp] = useState('esewa');
  const [splitBill, setSplitBill] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitAmounts, setSplitAmounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Payment methods from settings
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Cafe Settings for receipt
  const [cafeSettings, setCafeSettings] = useState({
    cafeName: 'Cafe System',
    cafeAddress: '',
    contactPhone: '',
    cafePan: '',
    vatPercentage: 13,
  });

  // History tab
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRange, setHistoryRange] = useState('all');
  const [historyCustomStart, setHistoryCustomStart] = useState('');
  const [historyCustomEnd, setHistoryCustomEnd] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  const { socketRef } = useSocket();

  const selectOrder = useCallback((order) => {
    setSelectedOrder(order);
    setSplitBill(false);
    setSplitCount(2);
    setError('');
    setSuccessInfo(null);
    setShowQR(false);
    setHasViewedQR(false);
    setQrPersonIndex(0);
  }, []);

  const [hasViewedQR, setHasViewedQR] = useState(false);
  const [qrPersonIndex, setQrPersonIndex] = useState(0);

  const calculateSplitAmounts = useCallback(() => {
    if (!selectedOrder || !splitBill) return;
    const total = selectedOrder.total;
    const amountPerPerson = total / splitCount;
    const amounts = [];
    for (let i = 0; i < splitCount; i++) {
      amounts.push({
        person: i + 1,
        amount: i === splitCount - 1
          ? parseFloat((total - (amountPerPerson * (splitCount - 1))).toFixed(2))
          : parseFloat(amountPerPerson.toFixed(2))
      });
    }
    setSplitAmounts(amounts);
  }, [selectedOrder, splitBill, splitCount]);

  const handleSplitAmountChange = (index, newAmount) => {
    const updated = [...splitAmounts];
    updated[index].amount = parseFloat(newAmount) || 0;
    setSplitAmounts(updated);
  };

  const getSplitTotal = () => splitAmounts.reduce((sum, item) => sum + item.amount, 0);

  const isSplitValid = () => {
    if (!splitBill || !selectedOrder) return true;
    return Math.abs(getSplitTotal() - selectedOrder.total) < 0.1;
  };

  useEffect(() => {
    loadPendingOrders();
    loadPaymentMethods();
    loadCafeSettings();
  }, []);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;
    conn.on('PaymentUpdate', loadPendingOrders);
    conn.on('OrderUpdated', loadPendingOrders);
    return () => {
      conn.off('PaymentUpdate', loadPendingOrders);
      conn.off('OrderUpdated', loadPendingOrders);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef]);

  // Auto-select order from URL param
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (successInfo) return;
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam && pendingOrders.length > 0) {
      const orderId = parseInt(orderIdParam);
      const orderToSelect = pendingOrders.find(o => o.id === orderId);
      if (orderToSelect && (!selectedOrder || selectedOrder.id !== orderId)) {
        selectOrder(orderToSelect);
      }
    }
  }, [searchParams, pendingOrders, selectOrder, selectedOrder, successInfo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedOrder && splitBill) {
      calculateSplitAmounts();
    }
  }, [selectedOrder, splitBill, splitCount, calculateSplitAmounts]);

  // Load history when tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyRange, historyCustomStart, historyCustomEnd]);

  async function loadPendingOrders() {
    try {
      setLoading(true);
      const data = await getJson('/api/cashier/orders/pending');
      setPendingOrders(data || []);
    } catch (err) {
      setError('Failed to load pending orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCafeSettings() {
    try {
      const data = await getJson('/api/manager/settings');
      if (data) {
        console.log("DEBUG: Receipt Cafe Settings Data received:", data);
        setCafeSettings({
          cafeName: data.cafeName || data.CafeName || 'Cafe System',
          cafeAddress: data.cafeOutletAddress ?? data.cafeAddress ?? data.CafeAddress ?? '',
          contactPhone: data.cafeContactPhone ?? data.cafePhone ?? data.CafePhone ?? '',
          cafePan: data.cafePan ?? data.CafePan ?? '',
          vatPercentage: data.vatPercentage ?? data.VatPercentage ?? 13,
        });
      }
    } catch (err) {
      console.error('Failed to load cafe settings:', err);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      let url = `/api/cashier/payments/history?range=${historyRange}`;
      if (historyRange === 'custom' && historyCustomStart && historyCustomEnd) {
        url += `&customStartDate=${historyCustomStart}&customEndDate=${historyCustomEnd}`;
      }
      const data = await getJson(url);
      setHistoryOrders(data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadPaymentMethods() {
    try {
      const data = await getJson('/api/manager/settings?includePaymentMethods=true');
      if (data && data.paymentMethods) {
        const methods = typeof data.paymentMethods === 'string'
          ? JSON.parse(data.paymentMethods)
          : data.paymentMethods;
        const enabledMethods = methods.filter(m => m.enabled);
        setPaymentMethods(enabledMethods);
        if (enabledMethods.length > 0) {
          setSelectedPaymentMethod(enabledMethods[0]);
          setMobilePaymentApp(enabledMethods[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    }
  }

  function handleMobilePayment() {
    setShowQR(true);
    setHasViewedQR(true);
  }

  async function processPayment() {
    if (!selectedOrder) { setError('Please select an order'); return; }
    if (splitBill && splitCount < 2) { setError('Split count must be at least 2'); return; }
    if (splitBill && !isSplitValid()) {
      setError(`Split total (${getSplitTotal().toFixed(2)}) must match Order Total (${selectedOrder.total.toFixed(2)})`);
      return;
    }
    if (paymentMethod === 'mobile' && !hasViewedQR) {
      handleMobilePayment();
      return;
    }

    try {
      setLoading(true);
      setError('');
      const paymentData = {
        orderId: selectedOrder.id,
        paymentMethod,
        mobilePaymentApp: paymentMethod === 'mobile' ? mobilePaymentApp : null,
        splitBill,
        splitCount: splitBill ? splitCount : 1,
        totalAmount: selectedOrder.total,
      };
      await postJson('/api/cashier/payments', paymentData);

      const now = new Date();
      const lastOrderData = {
        ...selectedOrder,
        paymentMethod,
        date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        finalSplit: splitBill ? splitAmounts : null,
        splitBill,
      };
      setSuccessInfo({ ...lastOrderData, message: 'Payment processed successfully!' });
      setSelectedOrder(null);
      setShowQR(false);

      if (searchParams.has('orderId')) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('orderId');
        setSearchParams(newParams, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  }

  // ─── Print Engine ────────────────────────────────────────────────────────────

  const printContent = (htmlContent) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();
    iframe.contentWindow.focus();
    // Small delay for images/fonts to load
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 300);
  };

  const getThermalStyles = () => `
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 100%;
      margin: 0;
      padding: 2mm 2mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.25;
    }
    .receipt-section, .kot-section { page-break-after: avoid; }
    .header { text-align: center; margin-bottom: 6px; }
    .cafe-name { font-size: 15px; font-weight: bold; letter-spacing: 1px; margin: 0; }
    .cafe-sub { font-size: 10px; color: #333; margin: 0; }
    .divider-dashed { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .divider-solid  { border: none; border-top: 1px solid  #000; margin: 5px 0; }
    .info-block { font-size: 10px; margin-bottom: 4px; }
    .info-block div { display: flex; justify-content: space-between; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .items-table td { padding: 2px 0; vertical-align: top; }
    .items-table .qty { white-space: nowrap; }
    .items-table .name { padding: 0 4px; word-break: break-word; }
    .items-table .price { text-align: right; white-space: nowrap; }
    .totals { margin-top: 4px; }
    .total-row { display: flex; justify-content: space-between; font-size: 11px; }
    .total-row.grand { font-size: 13px; font-weight: bold; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px; }
    .vat-note { font-size: 9px; text-align: center; margin-top: 2px; }
    .footer { text-align: center; font-size: 10px; margin-top: 8px; }
    .cut-line { text-align: center; margin: 8px 0; letter-spacing: 3px; font-size: 10px; }
    /* KOT */
    .kot-header { text-align: center; }
    .kot-title { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
    .kot-meta { font-size: 12px; font-weight: bold; }
    .kot-items { margin-top: 6px; }
    .kot-item { display: flex; gap: 6px; padding: 3px 0; border-bottom: 1px dotted #555; font-size: 14px; font-weight: bold; }
    .kot-item .kot-qty { min-width: 20px; font-size: 16px; }
    .kot-item .kot-name { flex: 1; font-size: 13px; line-height: 1.3; }
    .kot-item .kot-note { font-size: 10px; font-weight: normal; color: #555; display: block; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;

  const buildReceiptBody = (order, splitItem = null, showSplitSummary = false) => {
    const vatLabel = `VAT (${cafeSettings.vatPercentage}%):`;
    return `
      <div class="receipt-section">
        <div class="header">
          <p class="cafe-name">${cafeSettings.cafeName.toUpperCase()}</p>
          ${cafeSettings.cafeAddress ? `<p class="cafe-sub">${cafeSettings.cafeAddress}</p>` : ''}
          ${cafeSettings.contactPhone ? `<p class="cafe-sub">Tel: ${cafeSettings.contactPhone}</p>` : ''}
          ${cafeSettings.cafePan ? `<p class="cafe-sub">PAN: ${cafeSettings.cafePan}</p>` : ''}
        </div>
        <hr class="divider-dashed"/>
        <div class="info-block">
          <div><span>Date:</span><span>${order.date}</span></div>
          <div><span>Time:</span><span>${order.time}</span></div>
          <div><span>Order #:</span><span>${order.id}</span></div>
          <div><span>Type:</span><span>${order.orderType.toUpperCase()}</span></div>
          ${order.tableNumber ? `<div><span>Table:</span><span>${order.floorName ? order.floorName + ' - ' : ''}${order.tableNumber}${order.seatNumbers?.length > 0 ? ' (Seat ' + order.seatNumbers.join(', ') + ')' : ''}</span></div>` : ''}
          ${splitItem ? `<div><span><b>Split Bill:</b></span><span><b>Person ${splitItem.person}</b></span></div>` : ''}
        </div>
        <hr class="divider-dashed"/>
        <table class="items-table">
          ${order.items.map(item => `
            <tr>
              <td class="qty">${item.quantity}x</td>
              <td class="name">${item.name}${item.specialRequest ? `<br/><small>(${item.specialRequest})</small>` : ''}</td>
              <td class="price">NRP ${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        <hr class="divider-dashed"/>
        <div class="totals">
          <div class="total-row"><span>Subtotal:</span><span>NRP ${parseFloat(order.subtotal).toFixed(2)}</span></div>
          <div class="total-row"><span>${vatLabel}</span><span>NRP ${parseFloat(order.tax).toFixed(2)}</span></div>
          ${(order.serviceCharge > 0) ? `<div class="total-row"><span>Service Charge:</span><span>NRP ${parseFloat(order.serviceCharge).toFixed(2)}</span></div>` : ''}
          ${(order.bookingCharge > 0) ? `<div class="total-row"><span>Table Booking:</span><span>NRP ${parseFloat(order.bookingCharge).toFixed(2)}</span></div>` : ''}
          ${splitItem
            ? `<div class="total-row grand"><span>AMOUNT DUE:</span><span>NRP ${splitItem.amount.toFixed(2)}</span></div>
               <div class="total-row" style="font-size:9px"><span>(Order Total: NRP ${parseFloat(order.total).toFixed(2)})</span></div>`
            : `<div class="total-row grand"><span>TOTAL:</span><span>NRP ${parseFloat(order.total).toFixed(2)}</span></div>
               ${showSplitSummary && order.finalSplit ? `
                 <div style="margin-top:4px;border-top:1px dotted #000;padding-top:4px;font-size:10px">
                   <div><b>Payment Breakdown:</b></div>
                   ${order.finalSplit.map(s => `<div class="total-row"><span>Person ${s.person}</span><span>NRP ${s.amount.toFixed(2)}</span></div>`).join('')}
                 </div>
               ` : ''}`
          }
          <div class="total-row" style="margin-top:3px;font-style:italic;font-size:10px"><span>Paid via:</span><span>${(order.paymentMethod || 'CASH').toUpperCase()}</span></div>
        </div>
        <p class="vat-note">VAT INVOICE ${cafeSettings.cafePan ? `— PAN: ${cafeSettings.cafePan}` : ''}</p>
        <div class="footer"><p>Thank you for visiting!<br/>Please come again.</p></div>
      </div>`;
  };

  const buildKOTBody = (order) => `
    <div class="kot-section">
      <div class="kot-header">
        <div class="kot-title">** KOT **</div>
        <hr class="divider-solid"/>
      </div>
      <div class="info-block kot-meta">
        <div><span>Order #:</span><span>${order.id}</span></div>
        <div><span>Time:</span><span>${order.time}</span></div>
        ${order.tableNumber ? `<div><span>Table:</span><span>${order.floorName ? order.floorName + ' - ' : ''}${order.tableNumber}${order.seatNumbers?.length > 0 ? ' (Seat ' + order.seatNumbers.join(', ') + ')' : ''}</span></div>` : ''}
        <div><span>Type:</span><span>${order.orderType.toUpperCase()}</span></div>
      </div>
      <hr class="divider-solid"/>
      <div class="kot-items">
        ${order.items.map(item => `
          <div class="kot-item">
            <span class="kot-qty">${item.quantity}</span>
            <span class="kot-name">${item.name}${item.specialRequest ? `<span class="kot-note">Note: ${item.specialRequest}</span>` : ''}</span>
          </div>
        `).join('')}
      </div>
    </div>`;

  const wrapHTML = (title, content) => `<!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8"/>
      <title>${title}</title>
      <style>${getThermalStyles()}</style>
    </head><body>${content}</body></html>`;

  const handlePrintCombined = (order = successInfo) => {
    if (!order) return;
    let content = '';
    if (order.splitBill && order.finalSplit) {
      content += buildReceiptBody(order, null, true);
    } else {
      content += buildReceiptBody(order);
    }
    content += `<div class="cut-line">- - - ✂ - - -</div>`;
    content += buildKOTBody(order);
    printContent(wrapHTML('Bill & KOT', content));
  };

  const handlePrintSeparateReceipts = (order = successInfo) => {
    if (!order) return;
    let content = '';
    if (order.splitBill && order.finalSplit) {
      order.finalSplit.forEach((split, idx) => {
        content += buildReceiptBody(order, split);
        if (idx < order.finalSplit.length - 1) content += `<div class="cut-line">- - - ✂ - - -</div>`;
      });
    } else {
      content += buildReceiptBody(order);
    }
    printContent(wrapHTML('Receipt', content));
  };

  const handlePrintKOT = (order = successInfo) => {
    if (!order) return;
    printContent(wrapHTML('KOT', buildKOTBody(order)));
  };

  const handlePaymentComplete = () => {
    setSuccessInfo(null);
    loadPendingOrders();
  };

  // Convert a history order to a format printable by the receipt functions
  const historyOrderForPrint = (order) => ({
    ...order,
    date: new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    paymentMethod: order.paymentMethod,
    splitBill: order.isSplit,
    finalSplit: null, // history orders don't store split breakdown currently
  });

  // Filter history
  const filteredHistory = historyOrders.filter(o => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return String(o.id).includes(q) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(q)) ||
      (o.orderType && o.orderType.toLowerCase().includes(q)) ||
      (o.paymentMethod && o.paymentMethod.toLowerCase().includes(q));
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="cashier-payment-processing">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaCreditCard style={{marginRight: '8px'}} /> Process Payments</h1>
          <p className="standard-page-subtitle">Select pending orders and process payments</p>
        </div>
        <div className="standard-page-header-actions">
          {!successInfo && (
            <>
              <div className="pp-tab-switcher">
                <button
                  className={`pp-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pending')}
                >
                  <FaCreditCard /> Pending
                </button>
                <button
                  className={`pp-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <FaHistory /> History
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {error && <div className="cashier-error-message">{error}</div>}

      {/* Success / Print View */}
      {successInfo && (
        <div className="cashier-success-container">
          <div className="cashier-success-content">
            <FaCheckCircle className="cashier-success-icon" />
            <h3>{successInfo.message || 'Payment Successful!'}</h3>
            <p>Order #{successInfo.id} — {successInfo.date} {successInfo.time}</p>

            <div className="cashier-pp-actions-container">
              {successInfo.splitBill ? (
                <>
                  <button className="cashier-pp-btn cashier-pp-btn-primary" onClick={() => handlePrintCombined()}>
                    <FaPrint /> Print Consolidated Receipt + KOT
                  </button>
                  <button className="cashier-pp-btn cashier-pp-btn-secondary" onClick={() => handlePrintSeparateReceipts()}>
                    <FaPrint /> Print Separate Receipts (per person)
                  </button>
                  <button className="cashier-pp-btn cashier-pp-btn-secondary" onClick={() => handlePrintKOT()}>
                    <FaPrint /> Print KOT Only
                  </button>
                </>
              ) : (
                <>
                  <button className="cashier-pp-btn cashier-pp-btn-primary" onClick={() => handlePrintCombined()}>
                    <FaPrint /> Print Bill &amp; KOT
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
                    <button className="cashier-pp-btn cashier-pp-btn-secondary" onClick={() => handlePrintSeparateReceipts()}>
                      <FaPrint /> Print Bill Only
                    </button>
                    <button className="cashier-pp-btn cashier-pp-btn-secondary" onClick={() => handlePrintKOT()}>
                      <FaPrint /> Print KOT Only
                    </button>
                  </div>
                </>
              )}
            </div>

            <button className="cashier-pp-btn cashier-pp-btn-success" onClick={handlePaymentComplete}>
              Done &amp; Process Next <FaSync />
            </button>
          </div>
        </div>
      )}

      {/* ─── PENDING TAB ──────────────────────────────────── */}
      {!successInfo && activeTab === 'pending' && (
        <div className="cashier-payment-layout">
          <div className="cashier-orders-section">
            <h3>Pending Payments</h3>
            <div className="cashier-payment-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '400px', height: '100%' }}>
              {loading ? (
                <OrderListSkeleton count={5} />
              ) : pendingOrders.length === 0 ? (
                <div className="cashier-empty-orders-card" style={{ margin: 'auto', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                  <div className="pp-empty-content">
                    <div className="pp-empty-icon"><FaShoppingBag /></div>
                    <h3>No Pending Payments</h3>
                    <p>All orders have been processed. New orders will appear here.</p>
                  </div>
                </div>
              ) : (
                <div className="cashier-orders-list" style={{ flex: 1, padding: '0.25rem' }}>
                  {pendingOrders.map(order => (
                    <div
                      key={order.id}
                      className={`cashier-order-card ${selectedOrder?.id === order.id ? 'cashier-selected' : ''}`}
                      onClick={() => selectOrder(order)}
                    >
                      <div className="cashier-order-card-header">
                        <div>
                          <strong>Order #{order.id}</strong>
                          <span className={`cashier-order-type-badge ${order.orderType}`}>
                            {order.orderType === 'dine-in' ? <><FaUtensils /> Dine-in</> : <><FaShoppingBag /> Takeaway</>}
                          </span>
                        </div>
                        {order.tableNumber && (
                          <span className="cashier-table-badge">
                            {order.floorName ? `${order.floorName} — ` : ''}Table {order.tableNumber}
                            {order.seatNumbers?.length > 0 && ` (Seat ${order.seatNumbers.join(', ')})`}
                          </span>
                        )}
                      </div>
                      <div className="cashier-order-card-body">
                        <div className="cashier-order-items-preview">
                          {order.items?.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="cashier-item-preview">{item.quantity}x {item.name}</span>
                          ))}
                          {order.items?.length > 2 && (
                            <span className="cashier-more-items">+{order.items.length - 2} more</span>
                          )}
                        </div>
                        <div className="cashier-order-total">NRP {parseFloat(order.total).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="cashier-payment-section">
            {selectedOrder ? (
              <>
                <h3>Payment Details</h3>
                <div className="cashier-payment-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '400px', height: '100%', position: 'relative' }}>
                  <button className="cashier-btn-close-selection" onClick={() => setSelectedOrder(null)} title="Cancel Selection">
                    <FaTimes />
                  </button>

                  <div className="cashier-order-summary">
                    <h4>Order Summary</h4>
                    <div className="cashier-summary-details">
                      <div className="cashier-summary-row"><span>Subtotal:</span><span>NRP {parseFloat(selectedOrder.subtotal).toFixed(2)}</span></div>
                      <div className="cashier-summary-row"><span>Tax/VAT:</span><span>NRP {parseFloat(selectedOrder.tax).toFixed(2)}</span></div>
                      {selectedOrder.serviceCharge > 0 && (
                        <div className="cashier-summary-row"><span>Service Charge:</span><span>NRP {parseFloat(selectedOrder.serviceCharge).toFixed(2)}</span></div>
                      )}
                      {selectedOrder.bookingCharge > 0 && (
                        <div className="cashier-summary-row" style={{ color: '#0369a1', fontWeight: '500' }}>
                          <span>Table Booking Charge:</span><span>NRP {parseFloat(selectedOrder.bookingCharge).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="cashier-summary-row"><span>Total:</span><span>NRP {parseFloat(selectedOrder.total).toFixed(2)}</span></div>
                    </div>
                  </div>

                  {/* Split Bill Section */}
                  <div className="cashier-split-section">
                    <div className="cashier-split-header">
                      <span>Split Bill</span>
                      <label className="pp-toggle-switch">
                        <input type="checkbox" checked={splitBill} onChange={e => setSplitBill(e.target.checked)} />
                        <span className="pp-slider round"></span>
                      </label>
                    </div>

                    {splitBill && (
                      <div className="cashier-split-controls">
                        <div className="pp-split-count-control">
                          <label>Number of People:</label>
                          <div className="pp-split-input-group">
                            <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} disabled={splitCount <= 2}>−</button>
                            <input
                              type="number"
                              value={splitCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 2;
                                setSplitCount(Math.min(Math.max(2, val), 10));
                              }}
                              min="2" max="10"
                            />
                            <button onClick={() => setSplitCount(Math.min(10, splitCount + 1))} disabled={splitCount >= 10}>+</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {splitBill && splitAmounts.length > 0 && (
                      <div className="cashier-split-amounts">
                        {!isSplitValid() && (
                          <div className="pp-split-warning">
                            <FaExclamationTriangle /> Total mismatch: {getSplitTotal().toFixed(2)} / {selectedOrder.total.toFixed(2)}
                          </div>
                        )}
                        {splitAmounts.map((split, idx) => (
                          <div key={idx} className="cashier-split-item">
                            <span className="pp-split-person">Person {split.person}</span>
                            <div className="pp-split-amount-wrapper">
                              <span>NRP</span>
                              <input
                                type="number"
                                className="pp-split-amount-input"
                                value={split.amount}
                                onChange={(e) => handleSplitAmountChange(idx, e.target.value)}
                                step="0.01"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Method Section */}
                  <div className="cashier-payment-method-section">
                    <h4>Select Payment Method</h4>
                    <div className="cashier-payment-methods">
                      <label className={`cashier-payment-method ${paymentMethod === 'cash' ? 'active' : ''}`}>
                        <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={e => { setPaymentMethod(e.target.value); setShowQR(false); }} />
                        <FaMoneyBillWave className="pp-payment-icon" />
                        <span>Cash</span>
                      </label>
                      <label className={`cashier-payment-method ${paymentMethod === 'card' ? 'active' : ''}`}>
                        <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={e => { setPaymentMethod(e.target.value); setShowQR(false); }} />
                        <FaCreditCard className="pp-payment-icon" />
                        <span>Card</span>
                      </label>
                      <label className={`cashier-payment-method ${paymentMethod === 'mobile' ? 'active' : ''}`}>
                        <input type="radio" name="paymentMethod" value="mobile" checked={paymentMethod === 'mobile'} onChange={e => { setPaymentMethod(e.target.value); setShowQR(false); }} />
                        <FaMobileAlt className="pp-payment-icon" />
                        <span>Mobile / QR</span>
                      </label>
                    </div>

                    {paymentMethod === 'mobile' && (
                      <div className="cashier-mobile-app-section">
                        <label>Select Payment App:</label>
                        {paymentMethods.length > 0 ? (
                          <>
                            <select
                              value={mobilePaymentApp}
                              onChange={e => {
                                const selected = paymentMethods.find(m => m.id === e.target.value);
                                setMobilePaymentApp(e.target.value);
                                setSelectedPaymentMethod(selected);
                                setShowQR(false);
                              }}
                              className="cashier-mobile-app-select"
                            >
                              {paymentMethods.map(method => (
                                <option key={method.id} value={method.id}>{method.name}</option>
                              ))}
                            </select>
                            <button type="button" className="cashier-btn-show-qr" onClick={handleMobilePayment}>
                              <FaQrcode /> Show QR Code
                            </button>
                          </>
                        ) : (
                          <p style={{ marginTop: '0.5rem', color: '#666' }}>
                            No payment methods enabled. Contact manager to configure payment methods.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="cashier-final-total">
                    <div className="cashier-total-row">
                      <span>Final Total:</span>
                      <span className="cashier-total-amount">NRP {selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    className="cashier-btn-process-payment"
                    onClick={processPayment}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Process Payment'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Payment Details</h3>
                <div className="cashier-payment-card empty-payment-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '400px', height: '100%' }}>
                  <div className="pp-empty-content" style={{ margin: 'auto' }}>
                    <div className="pp-empty-icon"><FaMoneyBillWave /></div>
                    <h3>No Order Selected</h3>
                    <p>Select an order from the left to process payment.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── HISTORY TAB ──────────────────────────────────── */}
      {!successInfo && activeTab === 'history' && (
        <div className="pp-history-container">
          {/* Filters */}
          <div className="pp-history-filters">
            <div className="pp-history-filter-group">
              <FaFilter className="pp-filter-icon" />
              <select value={historyRange} onChange={e => setHistoryRange(e.target.value)} className="pp-history-select">
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {historyRange === 'custom' && (
              <div className="pp-history-filter-group">
                <input type="date" value={historyCustomStart} onChange={e => setHistoryCustomStart(e.target.value)} className="pp-history-date-input" max={historyCustomEnd || undefined} />
                <span className="pp-history-date-sep">to</span>
                <input type="date" value={historyCustomEnd} onChange={e => setHistoryCustomEnd(e.target.value)} className="pp-history-date-input" min={historyCustomStart || undefined} />
              </div>
            )}

            <div className="pp-history-search-group">
              <FaSearch className="pp-filter-icon" />
              <input
                type="text"
                placeholder="Search by order #, table, or payment..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="pp-history-search-input"
              />
            </div>
          </div>

          {/* History Table */}
          {historyLoading ? (
            <TableSkeleton cols={8} rows={5} />
          ) : filteredHistory.length === 0 ? (
            <div className="pp-empty-content" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
              <div className="pp-empty-icon"><FaHistory /></div>
              <h3>No Records Found</h3>
              <p>No paid orders match your filters.</p>
            </div>
          ) : (
            <div className="pp-history-table-wrapper">
              <table className="pp-history-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Table</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(order => {
                    const printable = historyOrderForPrint(order);
                    return (
                      <tr key={order.id}>
                        <td className="pp-history-id">#{order.id}</td>
                        <td className="pp-history-date">
                          <div>{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="pp-history-time">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>
                          <span className={`cashier-order-type-badge ${order.orderType}`}>
                            {order.orderType === 'dine-in' ? <><FaUtensils /> Dine-in</> : <><FaShoppingBag /> Takeaway</>}
                          </span>
                        </td>
                        <td>{order.tableNumber ? `${order.floorName ? order.floorName + ' — ' : ''}T-${order.tableNumber}${order.seatNumbers?.length > 0 ? ' (S-' + order.seatNumbers.join(',') + ')' : ''}` : '—'}</td>
                        <td>
                          <div className="pp-history-items" title={order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                            {order.items?.slice(0, 2).map((it, idx) => <div key={idx}>{it.quantity}x {it.name}</div>)}
                            {order.items?.length > 2 && <div className="cashier-more-items">+{order.items.length - 2} more</div>}
                          </div>
                        </td>
                        <td>
                          <span className="pp-history-method">
                            {order.paymentMethod === 'cash' ? <FaMoneyBillWave /> : order.paymentMethod === 'card' ? <FaCreditCard /> : <FaMobileAlt />}
                            {' '}{order.paymentMethod?.toUpperCase()}
                            {order.mobilePaymentApp ? ` (${order.mobilePaymentApp})` : ''}
                          </span>
                        </td>
                        <td className="pp-history-total">NRP {parseFloat(order.total).toFixed(2)}</td>
                        <td>
                          <div className="pp-history-actions">
                            <button className="pp-history-reprint-btn" onClick={() => handlePrintCombined(printable)} title="Reprint Bill & KOT">
                              <FaPrint /> Bill+KOT
                            </button>
                            <button className="pp-history-reprint-btn pp-reprint-secondary" onClick={() => handlePrintSeparateReceipts(printable)} title="Reprint Bill">
                              <FaPrint /> Bill
                            </button>
                            <button className="pp-history-reprint-btn pp-reprint-secondary" onClick={() => handlePrintKOT(printable)} title="Reprint KOT">
                              <FaPrint /> KOT
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && selectedPaymentMethod && selectedPaymentMethod.qrCodeImage && (
        <div className="pp-qr-modal-backdrop" onClick={() => setShowQR(false)}>
          <div className="pp-qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="pp-qr-modal-close" onClick={() => setShowQR(false)}><FaTimes /></button>
            <h2>Scan to Pay — {selectedPaymentMethod.name}</h2>

            {splitBill && splitAmounts.length > 0 ? (
              <div className="pp-qr-split-nav">
                <button className="pp-qr-nav-btn" disabled={qrPersonIndex === 0} onClick={() => setQrPersonIndex(curr => curr - 1)}><FaChevronLeft /></button>
                <div className="pp-qr-person-info">
                  <span className="pp-qr-person-label">Person {splitAmounts[qrPersonIndex]?.person}</span>
                  <span className="pp-qr-person-amount">NRP {splitAmounts[qrPersonIndex]?.amount.toFixed(2)}</span>
                </div>
                <button className="pp-qr-nav-btn" disabled={qrPersonIndex === splitAmounts.length - 1} onClick={() => setQrPersonIndex(curr => curr + 1)}><FaChevronRight /></button>
              </div>
            ) : (
              <p className="pp-qr-modal-amount">Amount: NRP {selectedOrder?.total.toFixed(2)}</p>
            )}

            <div className="pp-qr-modal-image-container">
              <img src={getImageUrl(selectedPaymentMethod.qrCodeImage)} alt={`${selectedPaymentMethod.name} QR Code`} className="pp-qr-modal-image" />
            </div>

            <button className="pp-qr-modal-confirm" onClick={() => setShowQR(false)}>
              <FaCheckCircle /> Done (scanned)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
