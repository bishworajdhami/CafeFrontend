import React, { useState, useEffect } from 'react';
import OrderCardsSkeleton from '../../components/skeletons/OrderCardsSkeleton';
import { FaClock, FaCheck, FaShoppingBag, FaChair, FaExclamationTriangle, FaBell, FaLock, FaTv } from 'react-icons/fa';
import { getJson, putJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import Modal from '../../components/Modal';
import EmptyState from '../../components/common/EmptyState';
import './KitchenDisplay.css';

export default function KitchenDisplay() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('pending');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [payFirst, setPayFirst] = useState(false);
    const { connection, isConnected, reconnectCount } = useSocket();

    const hasPermission = (perm) => {
        const permissions = (localStorage.getItem('permissions') || '').split(',');
        return permissions.includes(perm);
    };

    const canViewKOT = hasPermission('kitchen.view_kot');

    const knownOrderIds = React.useRef(new Set());
    const isInitialLoad = React.useRef(true);
    const audioContextRef = React.useRef(null);

    // Modal State
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        type: 'primary',
        onConfirm: null
    });

    const loadOrders = React.useCallback(async (isBackgroundRefresh = false) => {
        try {
            // Fetch real data from the backend
            if (!isBackgroundRefresh) {
               setLoading(true);
            }
            // Add a cache-buster query param to ensure we get fresh data from the server
            const cacheBuster = `t=${Date.now()}`;
            const data = await getJson(`/api/kitchen/orders?${cacheBuster}`);
            if (data) {
                // Ensure dates are parsed
                const parsedData = data.map(o => {
                    let timestamp;
                    try {
                        const raw = o.createdAt || "";
                        // ISO 8601 compliant T and Z normalization
                        let iso = raw.replace(" ", "T");
                        if (!iso.includes("Z") && !iso.includes("+")) iso += "Z";
                        timestamp = new Date(iso);
                        if (isNaN(timestamp.getTime())) timestamp = new Date();
                    } catch (e) {
                        timestamp = new Date();
                    }

                    return {
                        ...o,
                        timestamp,
                        priority: detectPriority(o, timestamp)
                    };
                });

                setOrders(currentOrders => {
                    // Detect if there are any TRULY new orders (ID not seen before)
                    const newIds = parsedData.map(o => o.id);
                    const hasNewArrival = newIds.some(id => !knownOrderIds.current.has(id));

                    // Update the "known" set for next time
                    newIds.forEach(id => knownOrderIds.current.add(id));

                    // Only play sound if: 
                    // 1. Sound is toggled ON
                    // 2. We found a new ID
                    // 3. This is NOT the very first load of the page
                    if (soundEnabled && hasNewArrival && !isInitialLoad.current) {
                        console.log('[KitchenDisplay] New order(s) detected! Triggering notification sound.');
                        playNotificationSound();
                    } else if (hasNewArrival && isInitialLoad.current) {
                        console.log('[KitchenDisplay] Initial load: suppression sound for existing orders.');
                    }

                    // After first data fetch, we are no longer in "initial load"
                    isInitialLoad.current = false;

                    return parsedData;
                });
            }
        } catch (err) {
            console.error('Failed to load kitchen orders', err);
        } finally {
            if (!isBackgroundRefresh) {
                 setLoading(false);
            }
        }
    }, [soundEnabled]);

    useEffect(() => {
        loadOrders();
        loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadOrders]);

    // Separate useEffect for socket subscription to ensure it setup correctly
    useEffect(() => {
        if (!connection) return;

        const handleUpdate = () => {
            console.log('[KitchenDisplay] SignalR Update Event: Fetching fresh orders...');
            loadOrders(true);
        };

        connection.on('OrderUpdated', handleUpdate);
        connection.on('NewOrder', handleUpdate);
        connection.on('PaymentUpdate', handleUpdate);
        connection.on('order.statusChanged', handleUpdate);
        connection.on('order.created', handleUpdate);
        connection.on('order.itemsAdded', handleUpdate);

        return () => {
            connection.off('OrderUpdated', handleUpdate);
            connection.off('NewOrder', handleUpdate);
            connection.off('PaymentUpdate', handleUpdate);
            connection.off('order.statusChanged', handleUpdate);
            connection.off('order.created', handleUpdate);
            connection.off('order.itemsAdded', handleUpdate);
        };
    }, [connection, loadOrders, reconnectCount]);

    async function loadSettings() {
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
    }

    function detectPriority(order, timestamp) {
        if (!timestamp || isNaN(timestamp.getTime())) return 'standard';
        const now = Date.now();
        let elapsedMins = (now - timestamp.getTime()) / 60000;
        
        if (isNaN(elapsedMins) || elapsedMins < -5 || elapsedMins > 720) {
            elapsedMins = 0;
        }

        if (elapsedMins > 20) return 'high';
        if (elapsedMins > 10) return 'warning';
        if (elapsedMins < 1) return 'fresh';
        return 'standard';
    }

    async function playNotificationSound() {
        try {
            console.log('[KitchenDisplay] Attempting to play notification sound...');
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }
            const ctx = audioContextRef.current;

            // Resume context if suspended
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
            masterGain.connect(ctx.destination);

            const pulses = [
                { freq: 880, start: 0, dur: 0.15 },
                { freq: 880, start: 0.12, dur: 0.15 },
                { freq: 1174.66, start: 0.35, dur: 0.25 },
                { freq: 1396.91, start: 0.65, dur: 0.5 },
            ];

            pulses.forEach(({ freq, start, dur }) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                
                // Attack
                gain.gain.setValueAtTime(0, ctx.currentTime + start);
                gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + start + 0.05); 
                // Decay
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);

                osc.connect(gain);
                gain.connect(masterGain); 

                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur + 0.1);
            });
        } catch (err) {
            console.error('Notification sound failed', err);
        }
    }

    function handleStartPreparing(order) {
        // Block if Pay First is ON and order is not yet paid
        if (payFirst && order.paymentStatus !== 'paid') {
            setConfirmModal({
                show: true,
                title: 'Payment Required',
                message: `Order #${order.id} must be paid before it can be prepared. Pay First mode is ON.`,
                type: 'warning',
                onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
            });
            return;
        }

        setConfirmModal({
            show: true,
            title: 'Prepare Order',
            message: `Are you sure you want to start preparing order #${order.id}?`,
            type: 'primary',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, show: false }));
                try {
                    await putJson(`/api/kitchen/orders/${order.id}/status`, { status: "Preparing" });
                    loadOrders();
                } catch (err) {
                    console.error("Failed to start preparing", err);
                }
            }
        });
    }

    function handleMarkReady(orderId) {
        setConfirmModal({
            show: true,
            title: 'Complete Order',
            message: `Is order #${orderId} ready for pickup?`,
            type: 'success',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, show: false }));
                try {
                    await putJson(`/api/kitchen/orders/${orderId}/status`, { status: "Ready" });
                    loadOrders(); // Refresh immediately
                } catch (err) {
                    console.error("Failed to mark ready", err);
                    setConfirmModal({
                        show: true,
                        title: 'Update Failed',
                        message: 'Failed to update order status. Please check your connection and try again.',
                        type: 'danger',
                        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
                    });
                }
            }
        });
    }

    const getTimeElapsed = (timestamp) => {
        const minutes = Math.floor((Date.now() - timestamp) / 60000);
        return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    };

    const filteredOrders = orders
        .filter(order => {
            const status = order.status?.toLowerCase();
            if (filter === 'completed') return status === 'completed' || status === 'served';
            return status === filter;
        })
        .sort((a, b) => a.timestamp - b.timestamp);

    return (
        <div className="kitchen-display-container">
            <header className="standard-page-header">
                <div className="standard-page-header-text">
                    <h1 className="standard-page-title">
                        <FaTv style={{marginRight: '8px'}} /> Kitchen Queue
                        {!isConnected && (
                            <span className="connection-status-dot offline" title="Connecting for live updates...">
                                AUTO-CONNECTING...
                            </span>
                        )}
                    </h1>
                    <p className="standard-page-subtitle">Manage incoming kitchen orders</p>
                </div>
                <div className="standard-page-header-actions">

                    <button
                        className={`btn-sound ${soundEnabled ? 'active' : ''}`}
                        onClick={() => {
                            const newState = !soundEnabled;
                            setSoundEnabled(newState);
                            if (newState) {
                                // Play a brief test sound to 'unlock' audio in browsers
                                playNotificationSound();
                            }
                        }}
                    >
                        <FaBell /> {soundEnabled ? 'Sound On' : 'Sound Off'}
                    </button>
                </div>
            </header>

            <div className="filter-tabs">

                <button className={`filter-tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
                    Pending ({orders.filter(o => o.status?.toLowerCase() === 'pending').length})
                </button>
                <button className={`filter-tab ${filter === 'preparing' ? 'active' : ''}`} onClick={() => setFilter('preparing')}>
                    Preparing ({orders.filter(o => o.status?.toLowerCase() === 'preparing').length})
                </button>
                <button className={`filter-tab ${filter === 'ready' ? 'active' : ''}`} onClick={() => setFilter('ready')}>
                    Ready ({orders.filter(o => o.status?.toLowerCase() === 'ready').length})
                </button>
                <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
                    Completed ({orders.filter(o => {
                        const s = o.status?.toLowerCase();
                        return s === 'completed' || s === 'served';
                    }).length})
                </button>
            </div>

            {loading ? (
                <OrderCardsSkeleton />
            ) : orders.length === 0 ? (
                <EmptyState message="No active orders" />
            ) : (
                <div className="orders-grid">
                    {filteredOrders.map(order => {
                        const status = order.status?.toLowerCase();
                        const isActive = status === 'pending' || status === 'preparing';
                        return (
                            <div key={order.id} className={`order-card ${status} ${isActive ? `priority-${order.priority}` : ''}`}>
                            
                            {/* 1. Header: ID & Priority Badge */}
                            <div className="card-header-row">
                                <div className="order-id-group">
                                    <span className="order-id-label">Order</span>
                                    <span className="order-id-val">#{order.id}</span>
                                </div>
                                
                                <div className="priority-container">
                                    {isActive ? (
                                        <>
                                            {order.priority === 'fresh' && (
                                                <div className="priority-badge fresh">
                                                    <FaBell /> Just Now
                                                </div>
                                            )}
                                            {order.priority === 'standard' && (
                                                <div className="priority-badge standard">
                                                    <FaClock /> On Time
                                                </div>
                                            )}
                                            {order.priority === 'warning' && (
                                                <div className="priority-badge warning">
                                                    <FaClock /> Delayed
                                                </div>
                                            )}
                                            {order.priority === 'high' && (
                                                <div className="priority-badge high">
                                                    <FaExclamationTriangle /> Urgent
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className={`priority-badge ${status}`}>
                                            <FaCheck /> {order.status}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Meta Info: Type, Table, Time */}
                            <div className="card-meta-row">
                                <div className="meta-left">
                                    <span className={`type-pill ${order.orderType}`}>
                                        {order.orderType === 'dine-in' ? <FaChair size={10} /> : <FaShoppingBag size={10} />}
                                        {order.orderType === 'dine-in' ? ' Dine-in' : ' Takeaway'}
                                    </span>
                                    {order.orderType === 'dine-in' && (
                                        <span className="table-pill">
                                            Table {order.tableNumber}
                                        </span>
                                    )}
                                </div>
                                <div className="order-time">
                                    <FaClock size={10} /> {getTimeElapsed(order.timestamp)}
                                </div>
                            </div>

                            {/* 3. Items Section */}
                            <div className="order-items-section">
                                {canViewKOT ? (
                                    <div className="items-scroll-area">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="item-row-modern">
                                                <div className="item-qty-badge">{item.quantity}x</div>
                                                <div className="item-details-col">
                                                    <span className="item-name-text">{item.name}</span>
                                                    {item.specialRequest && (
                                                        <div className="special-req-text">
                                                            <FaExclamationTriangle size={8} /> {item.specialRequest}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="permission-denied-kot" style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: '#fee2e2', borderRadius: '0', color: '#b91c1c', fontSize: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                        <FaLock style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }} />
                                        <span>View KOT Permission Required</span>
                                    </div>
                                )}
                            </div>

                            {/* 4. Actions Section */}
                            <div className="order-actions-modern">
                                {order.status?.toLowerCase() === 'pending' && (() => {
                                    const isPayFirstLocked = payFirst && order.paymentStatus !== 'paid';
                                    return (
                                        <button
                                            className="btn-action-modern preparing"
                                            onClick={() => handleStartPreparing(order)}
                                            title={isPayFirstLocked ? 'Order must be paid first (Pay First mode is ON)' : 'Start Preparing'}
                                            disabled={isPayFirstLocked}
                                            style={isPayFirstLocked ? { opacity: 0.7, cursor: 'not-allowed', backgroundColor: '#64748b' } : {}}
                                        >
                                            {isPayFirstLocked ? <><FaLock /> Pay First</> : <><FaClock /> Start Preparing</>}
                                        </button>
                                    );
                                })()}

                                {order.status?.toLowerCase() === 'preparing' && (
                                    <button className="btn-action-modern ready" onClick={() => handleMarkReady(order.id)}>
                                        <FaCheck /> Mark Ready
                                    </button>
                                )}
                                
                                {order.status?.toLowerCase() === 'ready' && (
                                    <div className="ready-status">
                                        <FaCheck /> Order is Ready
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                </div>
            )}

            <Modal
                isOpen={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                confirmText="Yes, Proceed"
                cancelText="Not yet"
            />
        </div>
    );
}

