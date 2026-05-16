import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    FaTimes, FaHistory, FaBox, FaCog, FaCalendarTimes,
    FaPlus, FaMinus, FaChevronLeft, FaChevronRight,
    FaEdit, FaExclamationTriangle, FaCheckCircle, FaTrash
} from 'react-icons/fa';
import { getJson } from '../../utils/api';
import './StockDetailDrawer.css';

const PAGE_SIZE = 15;

export default function StockDetailDrawer({ item, onClose, onEdit, onAddStock, onAdjustStock }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [batches, setBatches] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyHasMore, setHistoryHasMore] = useState(true);

    const loadBatches = useCallback(async () => {
        setBatchesLoading(true);
        try {
            const data = await getJson(`/api/stock/${item.id}/batches`);
            setBatches(data || []);
        } catch { setBatches([]); }
        finally { setBatchesLoading(false); }
    }, [item.id]);

    const loadHistory = useCallback(async (page = 1) => {
        setHistoryLoading(true);
        try {
            const data = await getJson(`/api/stock/${item.id}/history?page=${page}&pageSize=${PAGE_SIZE}`);
            setHistory(data || []);
            setHistoryHasMore((data || []).length === PAGE_SIZE);
        } catch { setHistory([]); }
        finally { setHistoryLoading(false); }
    }, [item.id]);

    useEffect(() => { loadBatches(); }, [loadBatches]);
    useEffect(() => {
        if (activeTab === 'history') loadHistory(historyPage);
    }, [activeTab, historyPage, loadHistory]);

    // Reset tab when item changes
    useEffect(() => { setActiveTab('overview'); setHistoryPage(1); }, [item.id]);

    const now = new Date();

    function getBatchStatus(expiryDate) {
        const days = Math.ceil((new Date(expiryDate) - now) / 86400000);
        if (days <= 0) return { label: 'EXPIRED', cls: 'batch-expired' };
        if (days <= 3) return { label: `${days}d`, cls: 'batch-critical' };
        if (days <= 7) return { label: `${days}d`, cls: 'batch-warning' };
        return { label: `${days}d`, cls: 'batch-ok' };
    }

    const headerClass = item.outOfStock
        ? 'sdp-header sdp-header--danger'
        : item.needsReorder
            ? 'sdp-header sdp-header--warning'
            : 'sdp-header sdp-header--ok';

    const statusLabel = item.outOfStock
        ? 'Out of Stock'
        : item.needsReorder
            ? 'Needs Reorder'
            : item.isArchived
                ? 'Archived'
                : 'In Stock';

    // Close on Escape key
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return ReactDOM.createPortal(
        <div
            className="sdp-overlay"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="sdp-modal-shell">
                <div className="sdp-panel">
                    {/* ── Header ─────────────────────────────────────────── */}
                    <div className={headerClass}>
                        <div className="sdp-header-left">
                            <div className="sdp-header-meta">
                                <span className="sdp-category-tag">{item.category}</span>
                                <span className="sdp-status-pill">
                                    {item.outOfStock
                                        ? <><FaExclamationTriangle /> {statusLabel}</>
                                        : item.needsReorder
                                            ? <><FaExclamationTriangle /> {statusLabel}</>
                                            : <><FaCheckCircle /> {statusLabel}</>}
                                </span>
                            </div>
                            <h2 className="sdp-title">{item.name}</h2>
                            {item.supplier && <p className="sdp-supplier">Supplier: {item.supplier}</p>}
                        </div>

                        <div className="sdp-header-right">
                            <button
                                className="sdp-action-btn sdp-action-add"
                                onClick={() => { onClose(); onAddStock(item); }}
                            >
                                <FaPlus /> Add Delivery
                            </button>
                            <button
                                className="sdp-action-btn sdp-action-use"
                                onClick={() => { onClose(); onAdjustStock(item); }}
                            >
                                <FaMinus /> Record Usage
                            </button>
                            <button
                                className="sdp-action-btn sdp-action-edit"
                                onClick={() => { onClose(); onEdit(item); }}
                            >
                                <FaEdit /> Edit
                            </button>
                            <button className="sdp-close-btn" onClick={onClose} title="Close">
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    {/* ── Stat Strip ──────────────────────────────────────── */}
                    <div className="sdp-stat-strip">
                        <div className="sdp-stat">
                            <div className="sdp-stat-value">
                                {item.currentStock}
                                <span>{item.unit}</span>
                            </div>
                            <div className="sdp-stat-label">Current Stock</div>
                        </div>

                        {item.daysRemaining != null && (
                            <div className={`sdp-stat ${item.needsReorder ? 'sdp-stat--alert' : ''}`}>
                                <div className="sdp-stat-value">
                                    ≈{item.daysRemaining}<span>d</span>
                                </div>
                                <div className="sdp-stat-label">Days Remaining</div>
                            </div>
                        )}

                        {item.totalValue > 0 && (
                            <div className="sdp-stat">
                                <div className="sdp-stat-value">
                                    Rs.{item.totalValue.toFixed(0)}
                                </div>
                                <div className="sdp-stat-label">Stock Value</div>
                            </div>
                        )}

                        {item.averageCostPerUnit > 0 && (
                            <div className="sdp-stat">
                                <div className="sdp-stat-value">
                                    Rs.{item.averageCostPerUnit.toFixed(2)}
                                </div>
                                <div className="sdp-stat-label">Avg Cost / {item.unit}</div>
                            </div>
                        )}

                        {item.dailyUsageRate > 0 && (
                            <div className="sdp-stat">
                                <div className="sdp-stat-value">
                                    {item.dailyUsageRate}<span>{item.unit}/d</span>
                                </div>
                                <div className="sdp-stat-label">Daily Usage</div>
                            </div>
                        )}

                        <div className="sdp-stat">
                            <div className="sdp-stat-value">{item.reorderDays}<span>d</span></div>
                            <div className="sdp-stat-label">Reorder Alert</div>
                        </div>

                        <div className="sdp-stat">
                            <div className="sdp-stat-value">{item.minStock}<span>{item.unit}</span></div>
                            <div className="sdp-stat-label">Min Level</div>
                        </div>
                    </div>

                    {/* ── Tabs ────────────────────────────────────────────── */}
                    <div className="sdp-tabs">
                        {[
                            { key: 'overview', icon: <FaBox />, label: 'Overview' },
                            { key: 'history', icon: <FaHistory />, label: 'History' },
                            { key: 'settings', icon: <FaCog />, label: 'Settings' },
                        ].map(({ key, icon, label }) => (
                            <button
                                key={key}
                                className={`sdp-tab ${activeTab === key ? 'active' : ''}`}
                                onClick={() => setActiveTab(key)}
                            >
                                {icon} {label}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab Body ────────────────────────────────────────── */}
                    <div className="sdp-body">

                        {/* Overview */}
                        {activeTab === 'overview' && (
                            <div className="sdp-overview-grid">
                                {/* Left: Product Info */}
                                <div className="sdp-overview-left">
                                    <h4 className="sdp-section-label">Product Info</h4>
                                    <div className="sdp-info-grid">
                                        <div className="sdp-info-item">
                                            <span>Unit</span>
                                            <strong>{item.unit}</strong>
                                        </div>
                                        <div className="sdp-info-item">
                                            <span>Category</span>
                                            <strong>{item.category}</strong>
                                        </div>
                                        <div className="sdp-info-item">
                                            <span>Shelf Life</span>
                                            <strong>{item.shelfLifeDays > 0 ? `${item.shelfLifeDays} days` : 'Not set'}</strong>
                                        </div>
                                        <div className="sdp-info-item">
                                            <span>Min Stock</span>
                                            <strong>{item.minStock} {item.unit}</strong>
                                        </div>
                                        <div className="sdp-info-item">
                                            <span>Daily Usage</span>
                                            <strong>{item.dailyUsageRate > 0 ? `${item.dailyUsageRate} ${item.unit}/day` : 'Manual'}</strong>
                                        </div>
                                        <div className="sdp-info-item">
                                            <span>Last Auto-Deduct</span>
                                            <strong>
                                                {item.lastAutoDeductionDate
                                                    ? new Date(item.lastAutoDeductionDate).toLocaleDateString()
                                                    : 'Never'}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Active Batches */}
                                <div className="sdp-overview-right">
                                    <h4 className="sdp-section-label">
                                        <FaCalendarTimes /> Active Batches
                                        {batches.length > 0 && (
                                            <span className="sdp-batch-count">{batches.length}</span>
                                        )}
                                    </h4>
                                    {batchesLoading ? (
                                        <div className="sdp-loading"><div className="sdp-spinner" /></div>
                                    ) : batches.length === 0 ? (
                                        <div className="sdp-empty">
                                            No active batches. Record a delivery to add stock.
                                        </div>
                                    ) : (
                                        <div className="sdp-batch-grid">
                                            {batches.map(b => {
                                                const status = getBatchStatus(b.expiryDate);
                                                const pct = item.currentStock > 0
                                                    ? Math.min(100, (b.quantity / item.currentStock) * 100)
                                                    : 0;
                                                return (
                                                    <div key={b.id} className={`sdp-batch-card ${status.cls}`}>
                                                        <div className="sdp-batch-top">
                                                            <div className="sdp-batch-qty">
                                                                <strong>{b.quantity}</strong> {item.unit}
                                                                {b.supplier && (
                                                                    <span className="sdp-batch-supplier">{b.supplier}</span>
                                                                )}
                                                            </div>
                                                            <div className="sdp-batch-actions">
                                                                <button 
                                                                    className="sdp-batch-remove-btn"
                                                                    onClick={() => { onClose(); onAdjustStock(item, b.id); }}
                                                                    title="Manual adjustment for this batch"
                                                                >
                                                                    <FaMinus />
                                                                </button>
                                                                <button 
                                                                    className="sdp-batch-remove-btn sdp-batch-trash-btn"
                                                                    onClick={() => { onClose(); onAdjustStock(item, b.id, b.quantity.toString()); }}
                                                                    title="Remove entire batch"
                                                                >
                                                                    <FaTrash />
                                                                </button>
                                                                <span className={`sdp-expiry-pill ${status.cls}`}>
                                                                    {status.label === 'EXPIRED'
                                                                        ? '⚠ Expired'
                                                                        : `Expires in ${status.label}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="sdp-batch-bar-wrap">
                                                            <div
                                                                className="sdp-batch-bar"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <div className="sdp-batch-meta">
                                                            <span>Received {new Date(b.receivedDate).toLocaleDateString()}</span>
                                                            {b.costPerUnit > 0 && (
                                                                <span>Rs.{b.costPerUnit}/{item.unit}</span>
                                                            )}
                                                            {b.notes && <span>{b.notes}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* History */}
                        {activeTab === 'history' && (
                            <div className="sdp-section-fade">
                                {historyLoading ? (
                                    <div className="sdp-loading"><div className="sdp-spinner" /></div>
                                ) : history.length === 0 ? (
                                    <div className="sdp-empty">No transactions recorded yet.</div>
                                ) : (
                                    <>
                                        <table className="sdp-history-table">
                                            <thead>
                                                <tr>
                                                    <th>Date & Time</th>
                                                    <th>Type</th>
                                                    <th>Change</th>
                                                    <th>Reason / Note</th>
                                                    <th>By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map(h => (
                                                    <tr key={h.id}>
                                                        <td className="sdp-hist-date">
                                                            {new Date(h.date).toLocaleString('en-US', {
                                                                month: 'short', day: 'numeric',
                                                                hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td>
                                                            <span className={`sdp-type-badge ${h.change >= 0 ? 'type-in' : 'type-out'}`}>
                                                                {h.type}
                                                            </span>
                                                        </td>
                                                        <td className={h.change >= 0 ? 'hist-pos' : 'hist-neg'}>
                                                            {h.change >= 0 ? '+' : ''}{h.change} {item.unit}
                                                        </td>
                                                        <td className="hist-reason">{h.reason || '—'}</td>
                                                        <td className="hist-by">{h.performedBy || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="sdp-pagination">
                                            <button
                                                className="sdp-page-btn"
                                                disabled={historyPage === 1}
                                                onClick={() => setHistoryPage(p => p - 1)}
                                            >
                                                <FaChevronLeft />
                                            </button>
                                            <span>Page {historyPage}</span>
                                            <button
                                                className="sdp-page-btn"
                                                disabled={!historyHasMore}
                                                onClick={() => setHistoryPage(p => p + 1)}
                                            >
                                                <FaChevronRight />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Settings */}
                        {activeTab === 'settings' && (
                            <div className="sdp-section-fade">
                                <div className="sdp-settings-grid">
                                    <div className="sdp-setting-card">
                                        <span>Unit</span>
                                        <strong>{item.unit}</strong>
                                    </div>
                                    <div className="sdp-setting-card">
                                        <span>Shelf life</span>
                                        <strong>{item.shelfLifeDays > 0 ? `${item.shelfLifeDays} days` : 'Not set'}</strong>
                                    </div>
                                    <div className="sdp-setting-card">
                                        <span>Min. stock level</span>
                                        <strong>{item.minStock} {item.unit}</strong>
                                    </div>
                                    <div className="sdp-setting-card">
                                        <span>Daily auto-deduction</span>
                                        <strong>
                                            {item.dailyUsageRate > 0
                                                ? `${item.dailyUsageRate} ${item.unit}/day`
                                                : 'Manual only'}
                                        </strong>
                                    </div>
                                    <div className="sdp-setting-card">
                                        <span>Reorder alert</span>
                                        <strong>{item.reorderDays} days remaining</strong>
                                    </div>
                                    <div className="sdp-setting-card">
                                        <span>Default supplier</span>
                                        <strong>{item.supplier || '—'}</strong>
                                    </div>
                                </div>
                                <div className="sdp-settings-actions">
                                    <button
                                        className="sdp-btn-edit-product"
                                        onClick={() => { onClose(); onEdit(item); }}
                                    >
                                        <FaEdit /> Edit Product Settings
                                    </button>
                                    {item.isArchived && (
                                        <div className="sdp-archive-notice">
                                            ⚠ This product is archived. Restore it first to make changes.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
