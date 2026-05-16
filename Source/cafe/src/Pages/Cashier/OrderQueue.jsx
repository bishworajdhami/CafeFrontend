import { useState, useEffect, useCallback } from 'react';
import OrderCardsSkeleton from '../../components/skeletons/OrderCardsSkeleton';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaUserTie, FaCheckCircle, FaCheck, FaTimes, FaUtensils, FaShoppingBag, FaComment, FaTrash, FaLock } from 'react-icons/fa';
import { getJson, putJson, deleteJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import Modal from '../../components/Modal';
import EmptyState from '../../components/common/EmptyState';
import './OrderQueue.css';

export default function OrderQueue() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'preparing', 'ready', 'completed', 'history'
  const [payFirst, setPayFirst] = useState(false);
  const { connection } = useSocket();

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: null,
    showCancel: true // Default true
  });

  // Default history date to yesterday
  const getYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [historyDate, setHistoryDate] = useState(getYesterdayDate());

  const loadSettings = useCallback(async () => {
    try {
      const data = await getJson('/api/manager/settings');
      if (data) {
        const toBool = (val) => {
          if (typeof val === 'string') return val.toLowerCase() === 'true';
          return val === true || val === 1;
        };
        setPayFirst(toBool(data.payFirst ?? data.PayFirst ?? false));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      let endpoint;
      if (filter === 'history') {
        const [y, m, d] = historyDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        endpoint = `/api/cashier/orders?history=true&fromDate=${start.toISOString()}&toDate=${end.toISOString()}`;
      } else {
        const fromDateParam = startOfToday.toISOString();
        endpoint = `/api/cashier/orders?fromDate=${fromDateParam}`;
      }

      const data = await getJson(endpoint);
      setOrders(data || []);
    } catch (err) {
      setError('Failed to load orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, historyDate]);

  useEffect(() => {
    loadOrders();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, historyDate, loadOrders, loadSettings]); // Refetch when filter or history date changes

  // Subscribe to real-time order events via the single shared socket
  useEffect(() => {
    if (!connection) return;

    connection.on('OrderUpdated', loadOrders);
    connection.on('NewOrder', loadOrders);
    connection.on('PaymentUpdate', loadOrders);
    connection.on('order.statusChanged', loadOrders);
    connection.on('order.created', loadOrders);
    connection.on('order.itemsAdded', loadOrders);

    return () => {
      connection.off('OrderUpdated', loadOrders);
      connection.off('NewOrder', loadOrders);
      connection.off('PaymentUpdate', loadOrders);
      connection.off('order.statusChanged', loadOrders);
      connection.off('order.created', loadOrders);
      connection.off('order.itemsAdded', loadOrders);
    };
  }, [connection, loadOrders]);

  const getNextStatus = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'Preparing';
      case 'preparing': return 'Ready';
      case 'ready': return 'Completed';
      default: return null;
    }
  };

  const getActionConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return { label: 'Start Preparing', icon: FaUtensils, style: 'primary' };
      case 'preparing': return { label: 'Mark Ready', icon: FaCheckCircle, style: 'success' };
      case 'ready': return { label: 'Complete Order', icon: FaCheck, style: 'secondary' };
      default: return null;
    }
  };

  async function updateOrderStatus(orderId, newStatus) {
    try {
      setError('');
      await putJson(`/api/cashier/orders/${orderId}/status`, { status: newStatus });
      // Refresh orders after update
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to update order status');
      console.error(err);
    }
  }


  async function deleteOrder(orderId, e) {
    if (e) e.stopPropagation();
    setConfirmModal({
      show: true,
      title: 'Delete Order',
      message: 'Are you sure you want to delete this order? This action cannot be undone.',
      type: 'danger',
      showCancel: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
          setError('');
          await deleteJson(`/api/cashier/orders/${orderId}`);
          // Refresh orders after deletion
          await loadOrders();
        } catch (err) {
          setError(err.message || 'Failed to delete order');
          console.error(err);
        }
      }
    });
  }

  // Handle Card Click for Payment
  function handleCardClick(order) {
    if (order.paymentStatus !== 'paid') {
      setConfirmModal({
        show: true,
        title: 'Process Payment',
        message: `Proceed to payment for Order #${order.id} (NRP ${parseFloat(order.total).toFixed(2)})?`,
        type: 'info',
        showCancel: true,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, show: false }));
          // Navigate to Payment Processing (Dashboard uses tabs)
          navigate(`/cashier?tab=payments&orderId=${order.id}`);
        }
      });
    }
  }

  function getStatusLabel(status) {
    const labels = {
      'pending': <><FaClock /> Pending</>,
      'preparing': <><FaUserTie /> In Kitchen</>,
      'ready': <><FaCheckCircle /> Ready for Pickup</>,
      'completed': <><FaCheck /> Completed</>,
      'cancelled': <><FaTimes /> Cancelled</>,
    };
    return labels[status?.toLowerCase()] || status;
  }

  function formatTime(dateString) {
    if (!dateString) return 'N/A';
    // Ensure date is treated as UTC if no timezone is specified
    const timeString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const filteredOrders = (() => {
    let result = orders;
    
    // Filter
    if (filter !== 'all' && filter !== 'history') {
      result = orders.filter(order => order.status?.toLowerCase() === filter);
    }
    
    // Sort: Uncompleted first in 'All' tab
    if (filter === 'all') {
      const statusWeight = { pending: 1, preparing: 2, ready: 3, completed: 4, cancelled: 5 };
      result = [...result].sort((a, b) => {
        const wA = statusWeight[a.status?.toLowerCase()] || 99;
        const wB = statusWeight[b.status?.toLowerCase()] || 99;
        if (wA !== wB) return wA - wB;
        // If same status, sort by date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }
    
    return result;
  })();

  const ordersByStatus = {
    pending: orders.filter(o => o.status?.toLowerCase() === 'pending'),
    preparing: orders.filter(o => o.status?.toLowerCase() === 'preparing'),
    ready: orders.filter(o => o.status?.toLowerCase() === 'ready'),
    completed: orders.filter(o => o.status?.toLowerCase() === 'completed'),
  };

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, historyDate, orders]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  return (
    <div className="order-queue">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaUtensils style={{marginRight: '8px'}} /> Order Queue</h1>
          <p className="standard-page-subtitle">Manage and track live customer orders</p>
        </div>
        <div className="standard-page-header-actions">
          {filter === 'history' && (
            <div className="history-date-filter">
              <span>Filter by Date:</span>
              <input
                type="date"
                value={historyDate}
                max={(() => {
                  const d = new Date();
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })()}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="date-picker-history"
              />
            </div>
          )}
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {filter !== 'history' && (
        <div className="queue-stats">
          <div className="stat-card pending">
            <div className="stat-header">
              <div className="stat-icon"><FaClock /></div>
            </div>
            <div className="stat-content">
              <span className="stat-label">Pending</span>
              <p className="stat-value">{ordersByStatus.pending.length}</p>
            </div>
          </div>

          <div className="stat-card preparing">
            <div className="stat-header">
              <div className="stat-icon"><FaUserTie /></div>
            </div>
            <div className="stat-content">
              <span className="stat-label">In Kitchen</span>
              <p className="stat-value">{ordersByStatus.preparing.length}</p>
            </div>
          </div>

          <div className="stat-card ready">
            <div className="stat-header">
              <div className="stat-icon"><FaCheckCircle /></div>
            </div>
            <div className="stat-content">
              <span className="stat-label">Ready</span>
              <p className="stat-value">{ordersByStatus.ready.length}</p>
            </div>
          </div>

          <div className="stat-card completed">
            <div className="stat-header">
              <div className="stat-icon"><FaCheck /></div>
            </div>
            <div className="stat-content">
              <span className="stat-label">Completed</span>
              <p className="stat-value">{ordersByStatus.completed.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Orders
        </button>
        <button
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`filter-tab ${filter === 'preparing' ? 'active' : ''}`}
          onClick={() => setFilter('preparing')}
        >
          In Kitchen
        </button>
        <button
          className={`filter-tab ${filter === 'ready' ? 'active' : ''}`}
          onClick={() => setFilter('ready')}
        >
          Ready
        </button>
        <button
          className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
        <button
          className={`filter-tab ${filter === 'history' ? 'active' : ''}`}
          onClick={() => setFilter('history')}
        >
          History
        </button>
      </div>

      {/* Pagination & Grid */}
      {loading ? (
        <OrderCardsSkeleton showStats />
      ) : filteredOrders.length === 0 ? (
        <EmptyState message="No orders found" />
      ) : (
        <>
          <div className="orders-grid">
            {currentOrders.map(order => (
              <div
                key={order.id}
                className="order-card"
                onClick={() => handleCardClick(order)}
                style={{ cursor: (order.paymentStatus !== 'paid' && filter !== 'history') ? 'pointer' : 'default' }}
              >

                {/* 1. Header: ID & Status */}
                <div className="card-header-row">
                  <div className="order-id-group">
                    <span className="order-id-label">Order</span>
                    <span className="order-id-val">#{order.id}</span>
                  </div>
                  <div className={`status-badge-modern ${order.status?.toLowerCase()}`}>
                    {getStatusLabel(order.status)}
                  </div>
                </div>

                {/* 2. Meta Info: Type, Table, Time */}
                <div className="card-meta-row">
                  <div className="meta-left">
                    <span className={`type-pill ${order.orderType}`}>
                      {order.orderType === 'dine-in' ? <FaUtensils size={10} /> : <FaShoppingBag size={10} />}
                      {order.orderType === 'dine-in' ? 'Dine-in' : 'Takeaway'}
                    </span>
                    {order.tableNumber && (
                      <span className="table-pill">
                        {order.floorName && `${order.floorName} • `}Table {order.tableNumber}
                        {order.seatNumber && <span className="seat-sub"> (Seat {order.seatNumber})</span>}
                      </span>
                    )}
                  </div>
                  <div className="meta-time">
                    <FaClock size={10} /> {formatTime(order.createdAt)}
                  </div>
                </div>

                {/* 3. Items List */}
                <div className="card-items-section">
                  <div className="items-scroll-area">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="item-row-modern">
                        <div className="item-qty-badge">{item.quantity}x</div>
                        <div className="item-details-col">
                          <span className="item-name-text">{item.name}</span>
                          {item.specialRequest && (
                            <div className="special-req-text">
                              <FaComment size={8} /> {item.specialRequest}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Footer: Total & Payment */}
                <div className="card-footer-modern">
                  <div className="footer-total-group">
                    <span className="total-label">Total Amount</span>
                    <span className="total-amount">NRP {parseFloat(order.total).toFixed(2)}</span>
                  </div>
                  <div className={`payment-status-pill ${order.paymentStatus}`}>
                    {order.paymentStatus === 'paid' ? <FaCheck size={10} /> : <FaClock size={10} />}
                    {order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                  </div>
                </div>

                {/* 5. Actions */}
                <div className="card-actions-modern">
                  {/* Status Action Button (Strict Workflow) — locked when payFirst is ON and order is unpaid */}
                  {(() => {
                    const nextStatus = getNextStatus(order.status);
                    const actionConfig = getActionConfig(order.status);
                    const isPayFirstLocked = payFirst && order.paymentStatus !== 'paid';

                    if (nextStatus && actionConfig) {
                      return (
                        <button
                          className={`btn-status-action ${isPayFirstLocked ? 'disabled' : actionConfig.style}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPayFirstLocked) updateOrderStatus(order.id, nextStatus);
                          }}
                          title={isPayFirstLocked ? 'Order must be paid first (Pay First mode is ON)' : `Move to ${nextStatus}`}
                          disabled={isPayFirstLocked}
                        >
                          {isPayFirstLocked ? <><FaLock /> Pay First</> : <><actionConfig.icon /> {actionConfig.label}</>}
                        </button>
                      );
                    }
                    return <div className="status-placeholder"></div>;
                  })()}

                  <div className="action-buttons-group">
                    {order.paymentStatus !== 'paid' && (
                      <button
                        className="btn-icon-action delete"
                        onClick={(e) => deleteOrder(order.id, e)}
                        title="Delete Order"
                      >
                        <FaTrash size={12} />
                      </button>
                    )}
                  </div>
                </div>


              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn-page"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                className="btn-page"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      <Modal
        isOpen={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}

