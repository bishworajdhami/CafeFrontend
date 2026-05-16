import React, { useState } from 'react';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { FaFilter, FaClock, FaHistory } from 'react-icons/fa';
import { getJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './OrderHistory.css';

export default function OrderHistory() {
    const { connection } = useSocket();
    const [dateFilter, setDateFilter] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadHistory = React.useCallback(async () => {
        try {
            setLoading(true);
            let url = `/api/kitchen/history?range=${dateFilter}`;
            if (dateFilter === 'custom') {
                if (!customStartDate || !customEndDate) {
                    setOrders([]); // Don't fetch if dates invalid
                    return;
                }
                url += `&customStartDate=${customStartDate}&customEndDate=${customEndDate}`;
            }

            const data = await getJson(url);
            if (data) {
                setOrders(data);
            }
        } catch (err) {
            console.error("Failed to load history", err);
        } finally {
            setLoading(false);
        }
    }, [dateFilter, customStartDate, customEndDate]);

    React.useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    React.useEffect(() => {
        if (!connection) return;

        const handleUpdate = () => {
            loadHistory();
        };

        connection.on('NewOrder', handleUpdate);
        connection.on('OrderUpdated', handleUpdate);
        connection.on('PaymentUpdate', handleUpdate);

        return () => {
            connection.off('NewOrder', handleUpdate);
            connection.off('OrderUpdated', handleUpdate);
            connection.off('PaymentUpdate', handleUpdate);
        };
    }, [connection, loadHistory]);

    const avgPrepTime = orders.length > 0
        ? Math.round(orders.reduce((sum, o) => sum + (o.prepTimeMinutes || 0), 0) / orders.length)
        : 0;

    function formatTime(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div className="order-history-page">
            <header className="standard-page-header">
                <div className="standard-page-header-text">
                    <h1 className="standard-page-title"><FaHistory style={{marginRight: '8px'}} /> Order History</h1>
                    <p className="standard-page-subtitle">Review past kitchen performance</p>
                </div>

            </header>

            <div className="history-stats">
                <div className="stat-box">
                    <div className="stat-icon-bg orders">
                        <FaFilter />
                    </div>
                    <div>
                        <div className="stat-value">{orders.length}</div>
                        <div className="stat-label">Total Orders</div>
                    </div>
                </div>
                <div className="stat-box">
                    <div className="stat-icon-bg time">
                        <FaClock />
                    </div>
                    <div>
                        <div className="stat-value">{avgPrepTime} min</div>
                        <div className="stat-label">Avg Prep Time</div>
                    </div>
                </div>
            </div>

            <div className="filter-section">
                <div className="filter-group">
                    <FaFilter className="filter-icon" />
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                {dateFilter === 'custom' && (
                    <div className="filter-group" style={{ marginLeft: '1rem' }}>
                        <input
                            type="date"
                            className="date-input"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            max={customEndDate || undefined}
                        />
                        <span style={{ color: '#64748b' }}>to</span>
                        <input
                            type="date"
                            className="date-input"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            min={customStartDate || undefined}
                        />
                    </div>
                )}
            </div>

            <div className="history-table-container">
                {loading ? (
                    <TableSkeleton cols={6} rows={8} />
                ) : orders.length === 0 ? (
                    <div className="empty-state">No orders found for this period.</div>
                ) : (
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Received</th>
                                <th>Completed</th>
                                <th>Type</th>
                                <th>Items</th>
                                <th>Prep Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td className="order-id-cell">#{order.id}</td>
                                    <td>{formatTime(order.createdAt)}</td>
                                    <td>{formatTime(order.readyAt)}</td>
                                    <td>
                                        <span className={`type-badge ${order.orderType?.toLowerCase() || 'dine-in'}`}>
                                            {order.orderType === 'dine-in'
                                                ? `${order.floorName || ''} T-${order.tableNumber}`
                                                : 'Takeaway'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="items-cell" title={order.items?.map(i => `${i.quantity}x ${i.name}`).join('\n')}>
                                            {order.itemsCount} items
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`time-badge ${order.prepTimeMinutes > 20 ? 'slow' : order.prepTimeMinutes < 10 ? 'fast' : 'normal'}`}>
                                            {order.prepTimeMinutes} min
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
