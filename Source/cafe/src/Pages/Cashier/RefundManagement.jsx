import React, { useState, useEffect } from 'react';
import OrderListSkeleton from '../../components/skeletons/OrderListSkeleton';
import { FaUtensils, FaShoppingBag, FaExclamationTriangle, FaUndo } from 'react-icons/fa';
import { getJson, postJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './RefundManagement.css';

export default function RefundManagement() {
  const { socketRef } = useSocket();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundItems, setRefundItems] = useState([]);
  const [refundReason, setRefundReason] = useState('');
  const [refundType, setRefundType] = useState('full'); // 'full' or 'partial'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
       loadOrders();
    };

    conn.on('NewOrder', handleUpdate);
    conn.on('OrderUpdated', handleUpdate);
    conn.on('PaymentUpdate', handleUpdate);

    return () => {
       conn.off('NewOrder', handleUpdate);
       conn.off('OrderUpdated', handleUpdate);
       conn.off('PaymentUpdate', handleUpdate);
    };
  }, [socketRef]);

  async function loadOrders() {
    try {
      setLoading(true);
      setError('');

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const fromDateParam = startOfToday.toISOString();

      const data = await getJson(`/api/cashier/orders/refundable?fromDate=${fromDateParam}`);
      setOrders(data || []);
    } catch (err) {
      setError('Failed to load orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function selectOrder(order) {
    setSelectedOrder(order);
    setRefundItems([]);
    setRefundReason('');
    setRefundType('full');
    setError('');
    setSuccess('');
  }

  function toggleItemRefund(item) {
    const exists = refundItems.find(ri => ri.id === item.id);
    if (exists) {
      setRefundItems(refundItems.filter(ri => ri.id !== item.id));
    } else {
      setRefundItems([...refundItems, { ...item, refundQuantity: item.quantity }]);
    }
  }

  function updateRefundQuantity(itemId, quantity) {
    setRefundItems(refundItems.map(item => {
      if (item.id === itemId) {
        const originalItem = selectedOrder.items.find(i => i.id === itemId);
        const maxQuantity = originalItem?.quantity || 1;
        return { ...item, refundQuantity: Math.min(Math.max(1, quantity), maxQuantity) };
      }
      return item;
    }));
  }

  function calculateRefundAmount() {
    if (!selectedOrder) return 0;

    if (refundType === 'full') {
      return selectedOrder.total;
    } else {
      return refundItems.reduce((sum, item) => {
        const itemTotal = item.price * item.refundQuantity;
        return sum + itemTotal;
      }, 0);
    }
  }

  async function processRefund() {
    if (!selectedOrder) {
      setError('Please select an order');
      return;
    }

    if (refundType === 'partial' && refundItems.length === 0) {
      setError('Please select items to refund');
      return;
    }

    if (!refundReason.trim()) {
      setError('Please provide a reason for the refund');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const refundData = {
        orderId: selectedOrder.id,
        refundType: refundType,
        reason: refundReason.trim(),
        items: refundType === 'partial' ? refundItems.map(item => ({
          itemId: item.id,
          quantity: item.refundQuantity,
        })) : null,
        refundAmount: calculateRefundAmount(),
      };

      await postJson('/api/cashier/refunds', refundData);

      setSuccess('Refund processed successfully!');
      setSelectedOrder(null);
      setRefundItems([]);
      setRefundReason('');
      setTimeout(() => {
        setSuccess('');
        loadOrders();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to process refund');
    } finally {
      setLoading(false);
    }
  }

  const refundAmount = calculateRefundAmount();

  return (
    <div className="refund-management">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaUndo style={{marginRight: '8px'}} /> Refund Management</h1>
          <p className="standard-page-subtitle">Process full or partial order refunds</p>
        </div>

      </header>

      {error && <div className="rm-error-message">{error}</div>}
      {success && <div className="rm-success-message">{success}</div>}

      <div className="rm-refund-layout">
        <div className="rm-orders-section">
          <h3>Recent Orders</h3>
          {loading ? (
            <OrderListSkeleton count={6} />
          ) : orders.length === 0 ? (
            <div className="rm-empty-state">No refundable orders found</div>
          ) : (
            <div className="rm-orders-list">
              {orders.map(order => (
                <div
                  key={order.id}
                  className={`rm-order-card ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                  onClick={() => selectOrder(order)}
                >
                  <div className="rm-order-card-header">
                    <div>
                      <strong>Order #{order.id}</strong>
                      <span className={`rm-order-type-badge ${order.orderType}`}>
                        {order.orderType === 'dine-in' ? <><FaUtensils /> Dine-in</> : <><FaShoppingBag /> Takeaway</>}
                      </span>
                    </div>
                    {order.tableNumber && (
                      <span className="rm-table-badge">Table {order.tableNumber}</span>
                    )}
                  </div>
                  <div className="rm-order-card-body">
                    <div className="rm-order-info">
                      <div className="rm-order-items-count">
                        {order.items?.length || 0} items
                      </div>
                      <div className="rm-order-total">NRP {parseFloat(order.total).toFixed(2)}</div>
                    </div>
                    <div className="rm-order-date">
                      {new Date(order.createdAt.endsWith('Z') ? order.createdAt : order.createdAt + 'Z').toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rm-refund-section">
          {selectedOrder ? (
            <>
              <h3>Process Refund</h3>

              <div className="rm-refund-card">
                <div className="rm-order-details">
                  <h4>Order Details</h4>
                  <div className="rm-order-summary">
                    <div className="rm-summary-row">
                      <span>Order #:</span>
                      <span>{selectedOrder.id}</span>
                    </div>
                    <div className="rm-summary-row">
                      <span>Total:</span>
                      <span>NRP {parseFloat(selectedOrder.total).toFixed(2)}</span>
                    </div>
                    {selectedOrder.serviceCharge > 0 && (
                      <div className="rm-summary-row" style={{ color: 'var(--color-primary-dark)' }}>
                        <span>Service Charge:</span>
                        <span>NRP {parseFloat(selectedOrder.serviceCharge).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="rm-summary-row">
                      <span>Payment Method:</span>
                      <span>{selectedOrder.paymentMethod || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="rm-refund-type-section">
                  <h4>Refund Type</h4>

                  {/* Status-based limitations info */}
                  {selectedOrder.status?.toLowerCase() === 'preparing' && (
                    <div className="rm-refund-limit-alert" style={{ marginBottom: '10px', fontSize: '0.9em', color: '#d97706', backgroundColor: '#fffbeb', padding: '8px', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                      <FaExclamationTriangle /> Order is in kitchen. Maximum refund allowed is 50%.
                    </div>
                  )}
                  {['ready', 'completed'].includes(selectedOrder.status?.toLowerCase()) && (
                    <div className="rm-refund-limit-alert" style={{ marginBottom: '10px', fontSize: '0.9em', color: '#dc2626', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                      <FaExclamationTriangle /> Order is {selectedOrder.status}. Refunds are not allowed.
                    </div>
                  )}

                  <div className="rm-refund-type-options">
                    <label className={`rm-refund-type-option ${selectedOrder.status?.toLowerCase() !== 'pending' ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name="refundType"
                        value="full"
                        checked={refundType === 'full'}
                        onChange={e => {
                          setRefundType(e.target.value);
                          setRefundItems([]);
                        }}
                        disabled={selectedOrder.status?.toLowerCase() !== 'pending'}
                      />
                      Full Refund
                      {selectedOrder.status?.toLowerCase() === 'pending' && <span className="rm-badge-recommend">Recommended for Pending</span>}
                    </label>
                    <label className={`rm-refund-type-option ${['ready', 'completed'].includes(selectedOrder.status?.toLowerCase()) ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name="refundType"
                        value="partial"
                        checked={refundType === 'partial'}
                        onChange={e => setRefundType(e.target.value)}
                        disabled={['ready', 'completed'].includes(selectedOrder.status?.toLowerCase())}
                      />
                      Partial Refund
                      {selectedOrder.status?.toLowerCase() === 'preparing' && <span className="rm-badge-limit">Max 50%</span>}
                    </label>
                  </div>
                </div>

                {refundType === 'partial' && (
                  <div className="rm-items-section">
                    <h4>Select Items to Refund</h4>
                    <div className="rm-items-list">
                      {selectedOrder.items?.map(item => {
                        const isSelected = refundItems.find(ri => ri.id === item.id);
                        return (
                          <div
                            key={item.id}
                            className={`rm-item-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleItemRefund(item)}
                          >
                            <div className="rm-item-checkbox">
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => toggleItemRefund(item)}
                              />
                            </div>
                            <div className="rm-item-info">
                              <div className="rm-item-name">{item.name}</div>
                              <div className="rm-item-details">
                                <span>Qty: {item.quantity}</span>
                                <span>Price: NRP {parseFloat(item.price).toFixed(2)}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="rm-refund-quantity">
                                <label>Refund Qty:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={isSelected.refundQuantity}
                                  onChange={e => updateRefundQuantity(item.id, parseInt(e.target.value) || 1)}
                                  onClick={e => e.stopPropagation()}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rm-refund-reason-section">
                  <h4>Refund Reason *</h4>
                  <textarea
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                    placeholder="Enter reason for refund (e.g., customer request, wrong item, etc.)"
                    rows="3"
                  />
                </div>

                <div className="rm-refund-amount-section">
                  <div className="rm-amount-display">
                    <span>Refund Amount:</span>
                    <span className="rm-amount-value">NRP {refundAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  className="rm-btn-process-refund"
                  onClick={processRefund}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Process Refund'}
                </button>
              </div>
            </>
          ) : (
            <div className="rm-no-selection">
              <p>Select an order to process refund</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

