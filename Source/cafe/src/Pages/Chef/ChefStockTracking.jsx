import { useState, useEffect, useCallback } from 'react';
import StockSkeleton from '../../components/skeletons/StockSkeleton';
import ReactDOM from 'react-dom';
import {
  FaExclamationTriangle, FaTimes, FaPlus, FaMinus,
  FaSearch, FaFilter, FaSort, FaBox, FaExclamationCircle,
  FaCalendarTimes, FaChevronLeft, FaChevronRight,
  FaPlayCircle, FaClock, FaMoneyBillWave, FaArchive, FaUndo,
  FaPencilAlt, FaInfoCircle
} from 'react-icons/fa';
import { getJson, putJson, postJson, deleteJson } from '../../utils/api';
import Modal from '../../components/Modal';
import StockDetailDrawer from './StockDetailDrawer';
import { useSocket } from '../../SocketContext';
import './ChefStockTracking.css';

// ─── Category Color Map ───────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Dairy: 'cat-dairy',
  Produce: 'cat-produce',
  Meat: 'cat-meat',
  'Dry Goods': 'cat-dry',
  Spices: 'cat-spices',
  Alcohol: 'cat-alcohol',
  Beverages: 'cat-beverages',
  Packaging: 'cat-packaging',
  Other: 'cat-other',
};

// ─── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, addToast };
}

function ToastContainer({ toasts }) {
  return ReactDOM.createPortal(
    <div className="st-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`st-toast st-toast-${t.type}`}>
          <span className="st-toast-icon">{t.type === 'success' ? '✓' : '✕'}</span>
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── Modal Wrapper ─────────────────────────────────────────────────────────────

function ModalWrapper({ title, onCancel, children }) {
  return ReactDOM.createPortal(
    <div className="st-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="st-modal-wrapper">
        <div className="st-modal-header">
          <h3 className="st-modal-title">{title}</h3>
          <button className="st-btn-icon" onClick={onCancel} type="button"><FaTimes /></button>
        </div>
        <div className="st-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─── Days Remaining Badge ──────────────────────────────────────────────────────

function DaysRemainingBadge({ daysRemaining, outOfStock }) {
  if (outOfStock) return <span className="st-days-badge st-days-out">Out of Stock</span>;
  if (daysRemaining == null) return null;
  if (daysRemaining <= 1) return <span className="st-days-badge st-days-critical">≈ {daysRemaining}d left</span>;
  if (daysRemaining <= 3) return <span className="st-days-badge st-days-warning">≈ {daysRemaining}d left</span>;
  return <span className="st-days-badge st-days-ok">≈ {daysRemaining}d left</span>;
}

const PAGE_SIZE = 15;

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ChefStockTracking() {
  const { socketRef } = useSocket();
  const [stockItems, setStockItems] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { toasts, addToast } = useToast();

  // Filter / Sort / Pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);

  // Reorder alert expand state
  const [alertExpanded, setAlertExpanded] = useState(true);

  // Product Form Modal
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', minStock: '', unit: '', category: '',
    estimatedDurationDays: '', currentStock: '',
    supplier: '', dailyUsageRate: '', reorderDays: '3', price: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  // Action Modals
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionData, setActionData] = useState({
    quantity: '', reason: 'Spoilage', expiryDate: '', costPerUnit: '', supplier: '', notes: '', batchId: ''
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [batchesForAdjust, setBatchesForAdjust] = useState([]);

  // Drawer
  const [drawerItem, setDrawerItem] = useState(null);

  // Apply usage
  const [applyingUsage, setApplyingUsage] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', type: 'primary', onConfirm: null
  });

  // ─── Load Data ──────────────────────────────────────────────

  const loadStockItems = useCallback(async () => {
    try {
      setLoading(true);
      const [items, summary] = await Promise.all([
        getJson(`/api/stock?includeArchived=${showArchived}`),
        getJson('/api/stock/summary')
      ]);
      setStockItems(items || []);
      setGlobalSummary(summary || null);
    } catch (err) {
      addToast(err.message || 'Failed to load stock', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, showArchived]);

  async function refreshSummary() {
    try {
      const summary = await getJson('/api/stock/summary');
      if (summary) setGlobalSummary(summary);
    } catch (e) {
      console.error('Failed to refresh summary', e);
    }
  }

  useEffect(() => { loadStockItems(); }, [loadStockItems]);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
      loadStockItems();
    };

    conn.on('NewOrder', handleUpdate);
    conn.on('OrderUpdated', handleUpdate);
    conn.on('PaymentUpdate', handleUpdate);

    return () => {
      conn.off('NewOrder', handleUpdate);
      conn.off('OrderUpdated', handleUpdate);
      conn.off('PaymentUpdate', handleUpdate);
    };
  }, [socketRef, loadStockItems]);

  // ─── Derived State ────────────────────────────────────────────

  const categories = ['All', ...Array.from(new Set(stockItems.map(i => i.category).filter(Boolean))).sort()];

  const filteredItems = stockItems
    .filter(item => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'days-asc') return (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999);
      if (sortBy === 'stock-desc') return b.currentStock - a.currentStock;
      if (sortBy === 'reorder') return (a.needsReorder === b.needsReorder ? 0 : a.needsReorder ? -1 : 1);
      if (sortBy === 'value-desc') return b.totalValue - a.totalValue;
      return 0;
    });

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pagedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search, categoryFilter, sortBy]);

  const needsReorderItems = stockItems.filter(i => i.needsReorder || i.outOfStock);

  // ─── Apply Daily Usage ─────────────────────────────────────────

  async function handleApplyDailyUsage() {
    setApplyingUsage(true);
    try {
      const res = await postJson('/api/stock/apply-daily-usage', {});
      if (res.newlyBreachedCount > 0) {
        addToast(`Daily usage applied. ${res.newlyBreachedCount} product(s) now need reorder!`, 'error');
      } else {
        addToast('Daily usage applied for all products');
      }
      await loadStockItems();
    } catch (err) {
      addToast(err.message || 'Failed to apply daily usage', 'error');
    } finally {
      setApplyingUsage(false);
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────

  function handleEdit(item) {
    setEditingItem(item);
    setFormData({
      name: item.name || '', minStock: item.minStock || '',
      unit: item.unit || '', category: item.category || '',
      estimatedDurationDays: item.shelfLifeDays || '', currentStock: '',
      supplier: item.supplier || '', dailyUsageRate: item.dailyUsageRate || '',
      reorderDays: item.reorderDays ?? 3, price: item.price || ''
    });
    setShowForm(true);
  }

  function handleDeleteClick(id) {
    setConfirmModal({
      show: true,
      title: 'Archive Product',
      message: 'This product will be archived (hidden from stock). All batches and history are preserved. You can restore it later.',
      type: 'warning',
      onConfirm: () => performArchive(id)
    });
  }

  async function performArchive(id) {
    setConfirmModal(prev => ({ ...prev, show: false }));
    try {
      await deleteJson(`/api/stock/${id}`);
      setStockItems(prev => prev.filter(i => i.id !== id));
      addToast('Product archived');
      refreshSummary();
    } catch (err) {
      addToast(err.message || 'Failed to archive product', 'error');
    }
  }

  async function handleRestore(id) {
    try {
      const result = await postJson(`/api/stock/${id}/restore`, {});
      setStockItems(prev => prev.map(i => i.id === id ? result : i));
      addToast('Product restored');
      refreshSummary();
    } catch (err) {
      addToast(err.message || 'Failed to restore', 'error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        name: formData.name,
        minStock: parseFloat(formData.minStock) || 0,
        unit: formData.unit,
        category: formData.category,
        estimatedDurationDays: formData.estimatedDurationDays ? parseInt(formData.estimatedDurationDays) : null,
        supplier: formData.supplier || null,
        dailyUsageRate: formData.dailyUsageRate ? parseFloat(formData.dailyUsageRate) : 0,
        reorderDays: parseInt(formData.reorderDays) || 3,
        price: parseFloat(formData.price) || 0,
        currentStock: (!editingItem && formData.currentStock) ? parseFloat(formData.currentStock) : 0
      };

      let result;
      if (editingItem) {
        result = await putJson(`/api/stock/${editingItem.id}`, payload);
        setStockItems(prev => prev.map(i => i.id === editingItem.id ? result : i));
        addToast('Product updated');
      } else {
        result = await postJson('/api/stock', payload);
        setStockItems(prev => [...prev, result]);
        addToast('Product created');
      }
      refreshSummary();
      cancelForm();
    } catch (err) {
      addToast(err.message || 'Failed to save product', 'error');
    } finally {
      setFormLoading(false);
    }
  }

  function cancelForm() {
    setShowForm(false);
    setEditingItem(null);
    setFormData({ name: '', currentStock: '', minStock: '', unit: '', category: '', estimatedDurationDays: '', supplier: '', dailyUsageRate: '', reorderDays: '3', price: '' });
  }

  // ─── Stock Actions ─────────────────────────────────────────────

  function openAddStock(item) {
    setSelectedItem(item);
    const suggestedQty = item.dailyUsageRate > 0
      ? (item.dailyUsageRate * item.reorderDays * 2).toFixed(2)
      : '';
    setActionData({ quantity: suggestedQty, expiryDate: '', costPerUnit: '', supplier: item.supplier || '', notes: '', reason: '' });
    setShowAddStock(true);
  }

  async function openAdjustStock(item, preselectedBatchId = null, preselectedQuantity = '') {
    setSelectedItem(item);
    setActionData({ 
      quantity: preselectedQuantity, 
      reason: 'Spoilage', 
      expiryDate: '', 
      costPerUnit: '', 
      supplier: '', 
      notes: '', 
      batchId: preselectedBatchId ? preselectedBatchId.toString() : '' 
    });
    setBatchesForAdjust([]);
    setShowAdjustStock(true);
    
    // Fetch active batches for this item
    try {
      const batches = await getJson(`/api/stock/${item.id}/batches`);
      if (batches) setBatchesForAdjust(batches);
    } catch (err) {
      console.error("Failed to fetch batches for adjustment", err);
    }
  }

  function applyStockSummary(id, summary) {
    setStockItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, currentStock: summary.currentStock, needsReorder: summary.needsReorder, outOfStock: summary.outOfStock, daysRemaining: summary.daysRemaining, expiringBatchCount: summary.expiringBatchCount, earliestExpiry: summary.earliestExpiry }
        : item
    ));
  }

  async function handleAddStockSubmit(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const summary = await postJson(`/api/stock/${selectedItem.id}/add`, {
        quantity: parseFloat(actionData.quantity),
        expiryDate: actionData.expiryDate ? new Date(actionData.expiryDate) : null,
        costPerUnit: actionData.costPerUnit ? parseFloat(actionData.costPerUnit) : 0,
        supplier: actionData.supplier || null,
        notes: actionData.notes || null
      });
      applyStockSummary(selectedItem.id, summary);
      setShowAddStock(false);
      addToast(`Stock added to ${selectedItem.name}`);
      refreshSummary();
    } catch (err) {
      addToast(err.message || 'Failed to add stock', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    const qtyToRemove = parseFloat(actionData.quantity);
    
    // Explicit Validation
    if (isNaN(qtyToRemove) || qtyToRemove <= 0) {
      addToast('Please enter a valid quantity greater than zero.', 'error');
      return;
    }

    if (actionData.batchId) {
      const selectedBatch = batchesForAdjust.find(b => b.id.toString() === actionData.batchId);
      if (!selectedBatch) {
        addToast('Selected batch no longer exists. Please refresh.', 'error');
        return;
      }
      if (qtyToRemove > selectedBatch.quantity) {
        addToast(`Cannot remove ${qtyToRemove} ${selectedItem.unit}. This batch only has ${selectedBatch.quantity} ${selectedItem.unit}.`, 'error');
        return;
      }
    } else {
      if (qtyToRemove > selectedItem.currentStock) {
        addToast(`Cannot remove ${qtyToRemove} ${selectedItem.unit}. Total stock is only ${selectedItem.currentStock} ${selectedItem.unit}.`, 'error');
        return;
      }
    }

    setActionLoading(true);
    try {
      const payload = {
        quantity: -qtyToRemove,
        reason: actionData.reason
      };
      if (actionData.batchId) {
        payload.batchId = parseInt(actionData.batchId);
      }
      const summary = await postJson(`/api/stock/${selectedItem.id}/adjust`, payload);
      applyStockSummary(selectedItem.id, summary);
      setShowAdjustStock(false);
      addToast(`Stock updated for ${selectedItem.name}`);
      refreshSummary();
    } catch (err) {
      addToast(err.message || 'Failed to adjust stock', 'error');
    } finally {
      setActionLoading(false);
    }
  }


  // ─── Render ───────────────────────────────────────────────────────

  const itemsWithUsage = stockItems.filter(i => i.dailyUsageRate > 0);

  return (
    <div className="stock-tracking">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="standard-page-header">
        <div className="standard-page-header-text">
            <h1 className="standard-page-title"><FaBox style={{marginRight: '8px'}} /> Stock Tracking</h1>
            <p className="standard-page-subtitle">Track and manage kitchen inventory</p>
        </div>
        <div className="standard-page-header-actions">
          {itemsWithUsage.length > 0 && (
            <button className="st-btn-apply-usage" onClick={handleApplyDailyUsage} disabled={applyingUsage}>
              {applyingUsage ? <><div className="st-spinner-inline" /> Applying…</> : <><FaPlayCircle /> Apply Today's Usage</>}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(true)}><FaPlus /> New Product</button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="st-kpi-row">
        <div className="st-kpi-card st-kpi-card--blue">
          <div className="st-kpi-icon st-kpi-blue"><FaBox /></div>
          <div className="st-kpi-content">
            <div className="st-kpi-value">{globalSummary?.totalProducts ?? stockItems.length}</div>
            <div className="st-kpi-label">Total Products</div>
          </div>
        </div>
        <div className="st-kpi-card st-kpi-card--green">
          <div className="st-kpi-icon st-kpi-green"><FaMoneyBillWave /></div>
          <div className="st-kpi-content">
            <div className="st-kpi-value">Rs. {(globalSummary?.totalInventoryValue ?? 0).toFixed(0)}</div>
            <div className="st-kpi-label">Inventory Value</div>
          </div>
        </div>
        <div className={`st-kpi-card ${(globalSummary?.needsReorderCount ?? 0) > 0 ? 'st-kpi-card--warning' : 'st-kpi-card--blue'}`}>
          <div className="st-kpi-icon st-kpi-orange"><FaExclamationCircle /></div>
          <div className="st-kpi-content">
            <div className="st-kpi-value">{globalSummary?.needsReorderCount ?? 0}</div>
            <div className="st-kpi-label">Need Reorder</div>
          </div>
        </div>
        <div className={`st-kpi-card ${(globalSummary?.expiringCount ?? 0) > 0 ? 'st-kpi-card--danger' : 'st-kpi-card--blue'}`}>
          <div className="st-kpi-icon st-kpi-red"><FaCalendarTimes /></div>
          <div className="st-kpi-content">
            <div className="st-kpi-value">{globalSummary?.expiringCount ?? 0}</div>
            <div className="st-kpi-label">Expiring This Week</div>
          </div>
        </div>
      </div>

      {/* Reorder Alert Banner */}
      {needsReorderItems.length > 0 && (
        <div className="st-reorder-banner">
          <div className="st-reorder-banner-head">
            <span className="st-reorder-banner-title">
              <FaExclamationTriangle />
              {needsReorderItems.length} item{needsReorderItems.length !== 1 ? 's' : ''} need attention
            </span>
            <button className="st-reorder-toggle" onClick={() => setAlertExpanded(e => !e)}>
              {alertExpanded ? 'Hide' : 'Show all'}
            </button>
          </div>
          {alertExpanded && (
            <div className="st-reorder-chips">
              {needsReorderItems.map(item => (
                <span key={item.id} className={`st-reorder-chip ${item.outOfStock ? 'chip-out' : 'chip-low'}`}>
                  <span className="chip-dot" />
                  {item.name}
                  {!item.outOfStock && (
                    <span className="chip-stock">{item.currentStock} {item.unit}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="st-filter-bar">
        <div className="st-search-wrap">
          <FaSearch className="st-search-icon" />
          <input type="text" className="st-search-input" placeholder="Search products…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="st-filter-wrap">
          <FaFilter className="st-filter-icon" />
          <select className="st-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="st-filter-wrap">
          <FaSort className="st-filter-icon" />
          <select className="st-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Name A–Z</option>
            <option value="days-asc">Days Remaining (urgent first)</option>
            <option value="stock-desc">Stock High→Low</option>
            <option value="value-desc">Value High→Low</option>
            <option value="reorder">Needs Reorder First</option>
          </select>
        </div>
        <label className="st-toggle-label">
          <span>Archived</span>
          <span
            className={`st-toggle-switch ${showArchived ? 'on' : ''}`}
            onClick={() => setShowArchived(v => !v)}
            role="switch"
            aria-checked={showArchived}
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowArchived(v => !v)}
          />
        </label>
      </div>

      {/* Table */}
      {loading && !stockItems.length ? (
        <StockSkeleton />
      ) : pagedItems.length === 0 ? (
        <div className="empty-state">
          <FaBox className="empty-state-icon" />
          <p>{stockItems.length === 0 ? 'No products yet. Add your first product.' : 'No products match your filters.'}</p>
          {stockItems.length === 0 && (
            <button className="empty-state-cta" onClick={() => setShowForm(true)}>
              <FaPlus /> Add First Product
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="stock-table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock / Value</th>
                  <th>Usage &amp; Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => {
                  const expiryDate = item.earliestExpiry ? new Date(item.earliestExpiry) : null;
                  const daysToExpiry = expiryDate
                    ? Math.ceil((expiryDate - new Date()) / 86400000)
                    : null;
                  const rowClass = item.isArchived
                    ? 'archived-row'
                    : item.outOfStock
                      ? 'out-of-stock-row'
                      : item.needsReorder
                        ? 'low-stock-row'
                        : '';

                  const hasBatchPills = item.expiringBatchCount > 0;
                  const catClass = CATEGORY_COLORS[item.category] || 'cat-other';

                  return (
                    <tr key={item.id} className={rowClass}>
                      {/* Product */}
                      <td>
                        <button className="st-product-name-btn" onClick={() => setDrawerItem(item)}>
                          {item.name}
                          {item.isArchived && <span className="st-archived-tag">Archived</span>}
                        </button>
                        {item.supplier && <div className="st-supplier-tag">{item.supplier}</div>}
                        {hasBatchPills && (
                          <div className="st-batch-pills">
                            <span className={`st-batch-pill ${daysToExpiry != null && daysToExpiry <= 0 ? 'pill-expired' : daysToExpiry != null && daysToExpiry <= 3 ? 'pill-critical' : 'pill-warning'}`}>
                              <FaCalendarTimes />
                              {daysToExpiry != null
                                ? daysToExpiry <= 0 ? 'Expired!' : `Expires in ${daysToExpiry}d`
                                : `${item.expiringBatchCount} expiring`}
                            </span>
                          </div>
                        )}
                        {item.lastAutoDeductionDate && (
                          <div className="st-last-deducted">
                            <FaClock /> Last auto: {new Date(item.lastAutoDeductionDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td><span className={`category-badge ${catClass}`}>{item.category}</span></td>

                      {/* Stock + Value */}
                      <td>
                        <div className="st-stock-display">
                          <span className="st-stock-number">{item.currentStock}</span>
                          <span className="st-stock-unit">{item.unit}</span>
                        </div>
                        {item.totalValue > 0 && (
                          <div className="st-stock-value">Rs. {item.totalValue.toFixed(2)}</div>
                        )}
                        {item.averageCostPerUnit > 0 && (
                          <div className="st-avg-cost">avg Rs. {item.averageCostPerUnit.toFixed(2)}/{item.unit}</div>
                        )}
                      </td>

                      {/* Daily Usage / Days Left */}
                      <td>
                        {item.dailyUsageRate > 0 ? (
                          <div className="st-usage-cell">
                            <div className="st-usage-rate">{item.dailyUsageRate} {item.unit}/day</div>
                            <DaysRemainingBadge daysRemaining={item.daysRemaining} outOfStock={item.outOfStock} />
                          </div>
                        ) : (
                          <span className="st-no-usage">Manual tracking</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {item.isArchived
                          ? <span className="status-badge archived">Archived</span>
                          : item.outOfStock
                            ? <span className="status-badge out">Out of Stock</span>
                            : item.needsReorder
                              ? <span className="status-badge low">Reorder Now</span>
                              : <span className="status-badge ok">OK</span>}
                      </td>

                      {/* Merged Actions */}
                      <td>
                        <div className="st-icon-actions">
                          {!item.isArchived && (
                            <>
                              <button
                                className="st-icon-btn st-icon-btn--add"
                                onClick={() => openAddStock(item)}
                                title="Add stock / Record delivery"
                              ><FaPlus /></button>
                              <button
                                className="st-icon-btn st-icon-btn--use"
                                onClick={() => openAdjustStock(item)}
                                title="Record manual removal"
                              ><FaMinus /></button>
                              <button
                                className="st-icon-btn st-icon-btn--edit"
                                onClick={() => handleEdit(item)}
                                title="Edit product"
                              ><FaPencilAlt /></button>
                              <button
                                className="st-icon-btn st-icon-btn--archive"
                                onClick={() => handleDeleteClick(item.id)}
                                title="Archive product"
                              ><FaArchive /></button>
                            </>
                          )}
                          {item.isArchived && (
                            <button
                              className="st-icon-btn st-icon-btn--restore"
                              onClick={() => handleRestore(item.id)}
                              title="Restore product"
                            ><FaUndo /></button>
                          )}
                          <button
                            className="st-icon-btn st-icon-btn--detail"
                            onClick={() => setDrawerItem(item)}
                            title="View details"
                          ><FaInfoCircle /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="st-pagination">
              <button className="st-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                <FaChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`st-page-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >{page}</button>
              ))}
              <button className="st-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <FaChevronRight />
              </button>
              <span className="st-page-info">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {drawerItem && (
        <StockDetailDrawer
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          onEdit={item => { setDrawerItem(null); handleEdit(item); }}
          onAddStock={item => { setDrawerItem(null); openAddStock(item); }}
          onAdjustStock={(item, batchId, qty) => { setDrawerItem(null); openAdjustStock(item, batchId, qty); }}
        />
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductFormModal
          editingItem={editingItem}
          formData={formData}
          setFormData={setFormData}
          loading={formLoading}
          onCancel={cancelForm}
          onSubmit={handleSubmit}
        />
      )}

      {/* Add Stock Modal */}
      {showAddStock && selectedItem && (
        <ModalWrapper title={`Add Delivery — ${selectedItem.name}`} onCancel={() => setShowAddStock(false)}>
          <form onSubmit={handleAddStockSubmit}>
            {selectedItem.dailyUsageRate > 0 && (
              <div className="st-info-note">
                Daily usage: <strong>{selectedItem.dailyUsageRate} {selectedItem.unit}/day</strong>.
                Current stock lasts ≈ <strong>{selectedItem.daysRemaining ?? 0} days</strong>.
              </div>
            )}
            <div className="st-form-row">
              <div className="st-form-group">
                <label>Quantity ({selectedItem.unit}) *</label>
                <input type="number" step="0.01" min="0.01" required autoFocus
                  value={actionData.quantity}
                  onChange={e => setActionData({ ...actionData, quantity: e.target.value })}
                />
                {selectedItem.dailyUsageRate > 0 && actionData.quantity > 0 && (
                  <small className="st-form-hint">
                    This delivery will last ≈ {(parseFloat(actionData.quantity) / selectedItem.dailyUsageRate).toFixed(1)} days
                  </small>
                )}
              </div>
              <div className="st-form-group">
                <label>Cost per {selectedItem.unit} (Rs.)</label>
                <input type="number" step="0.01" min="0" placeholder="0.00"
                  value={actionData.costPerUnit}
                  onChange={e => setActionData({ ...actionData, costPerUnit: e.target.value })}
                />
              </div>
            </div>
            <div className="st-form-group">
              <label>Expiry date (from label)</label>
              <input type="date" min={new Date().toISOString().split('T')[0]}
                value={actionData.expiryDate}
                onChange={e => setActionData({ ...actionData, expiryDate: e.target.value })}
              />
              {selectedItem.shelfLifeDays > 0 && !actionData.expiryDate && (
                <small className="st-form-hint">Default: today + {selectedItem.shelfLifeDays} days</small>
              )}
            </div>
            <div className="st-form-row">
              <div className="st-form-group">
                <label>Supplier</label>
                <input type="text" placeholder={selectedItem.supplier || ''}
                  value={actionData.supplier}
                  onChange={e => setActionData({ ...actionData, supplier: e.target.value })}
                />
              </div>
              <div className="st-form-group">
                <label>Notes</label>
                <input type="text" placeholder="Batch #, invoice…"
                  value={actionData.notes}
                  onChange={e => setActionData({ ...actionData, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="st-modal-footer">
              <button type="button" className="st-btn-secondary" onClick={() => setShowAddStock(false)}>Cancel</button>
              <button type="submit" className="st-btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Adding…' : 'Add Delivery'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustStock && selectedItem && (
        <ModalWrapper title={`Manual Adjustment — ${selectedItem.name}`} onCancel={() => setShowAdjustStock(false)}>
          <form onSubmit={handleAdjustSubmit}>
            <div className="st-info-note">
              Current stock: <strong>{selectedItem.currentStock} {selectedItem.unit}</strong>
              {selectedItem.dailyUsageRate > 0 && <> · Auto-deduction: <strong>{selectedItem.dailyUsageRate} {selectedItem.unit}/day</strong></>}
            </div>
            <div className="st-form-group">
              <label>Target Batch (Optional)</label>
              <select value={actionData.batchId} onChange={e => setActionData({ ...actionData, batchId: e.target.value })}>
                <option value="">Auto (FIFO - Oldest First)</option>
                {batchesForAdjust.map(b => (
                  <option key={b.id} value={b.id}>
                    Batch #{b.id} — Qty: {b.quantity} (Exp: {new Date(b.expiryDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            <div className="st-form-group">
              <div className="st-label-row">
                <label>Quantity to remove ({selectedItem.unit}) *</label>
                {actionData.batchId && (
                  <button 
                    type="button" 
                    className="st-btn-shortcut"
                    onClick={() => {
                      const batch = batchesForAdjust.find(b => b.id.toString() === actionData.batchId);
                      if (batch) setActionData({ ...actionData, quantity: batch.quantity.toString() });
                    }}
                  >
                    Remove full batch
                  </button>
                )}
              </div>
              <input type="number" step="0.01" min="0.01" max={actionData.batchId ? (batchesForAdjust.find(b => b.id.toString() === actionData.batchId)?.quantity || selectedItem.currentStock) : selectedItem.currentStock} required autoFocus
                value={actionData.quantity}
                onChange={e => setActionData({ ...actionData, quantity: e.target.value })}
              />
            </div>
            <div className="st-form-group">
              <label>Reason *</label>
              <select required value={actionData.reason} onChange={e => setActionData({ ...actionData, reason: e.target.value })}>
                <option value="Spoilage">Spoilage (Expired / Rotten)</option>
                <option value="Usage">Extra Usage (special event)</option>
                <option value="Damaged">Damaged</option>
                <option value="Theft">Theft / Loss</option>
                <option value="Correction">Inventory Correction</option>
              </select>
            </div>
            <div className="st-modal-footer">
              <button type="button" className="st-btn-secondary" onClick={() => setShowAdjustStock(false)}>Cancel</button>
              <button type="submit" className="st-btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Saving…' : 'Record Removal'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* Confirm Modal */}
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

// ─── Product Form Modal Component ──────────────────────────────────────────────

function ProductFormModal({ editingItem, formData, setFormData, loading, onCancel, onSubmit }) {
  const unit = formData.unit || 'unit';
  const dailyUsage = parseFloat(formData.dailyUsageRate);

  return (
    <ModalWrapper title={editingItem ? 'Edit Product' : 'New Product'} onCancel={onCancel}>
      <form onSubmit={onSubmit}>
        <div className="st-form-group">
          <label>Product name *</label>
          <input type="text" required autoFocus value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="st-form-row">
          <div className="st-form-group">
            <label>Unit *</label>
            <select required value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
              <option value="">Select unit</option>
              {['kg', 'g', 'L', 'ml', 'pieces', 'can', 'bottle'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="st-form-group">
            <label>Category *</label>
            <select required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              <option value="">Select category</option>
              {['Dairy', 'Produce', 'Meat', 'Dry Goods', 'Spices', 'Alcohol', 'Beverages', 'Packaging', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="st-form-group">
          <label>Price / Cost per Unit (Rs.)</label>
          <input type="number" step="0.01" min="0" placeholder="0.00"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })}
          />
        </div>

        {/* Daily usage config */}
        <div className="st-usage-config-box">
          <div className="st-usage-config-title">⚡ Auto Daily Usage</div>
          <div className="st-form-row">
            <div className="st-form-group">
              <label>Daily consumption rate ({unit})</label>
              <input type="number" step="0.01" min="0" placeholder="0 = manual"
                value={formData.dailyUsageRate}
                onChange={e => setFormData({ ...formData, dailyUsageRate: e.target.value })}
              />
              {dailyUsage > 0 && (
                <small className="st-form-hint">Auto-deducted {dailyUsage} {unit}/day nightly</small>
              )}
            </div>
            <div className="st-form-group">
              <label>Reorder alert (days)</label>
              <input type="number" min="1" max="30" placeholder="3"
                value={formData.reorderDays}
                onChange={e => setFormData({ ...formData, reorderDays: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="st-form-row">
          <div className="st-form-group">
            <label>Shelf life (days)</label>
            <input type="number" min="1" placeholder="e.g. 7"
              value={formData.estimatedDurationDays}
              onChange={e => setFormData({ ...formData, estimatedDurationDays: e.target.value })}
            />
          </div>
          <div className="st-form-group">
            <label>Default supplier</label>
            <input type="text" placeholder="e.g. ABC Distributors"
              value={formData.supplier}
              onChange={e => setFormData({ ...formData, supplier: e.target.value })}
            />
          </div>
        </div>
        <div className="st-form-group">
          <label>Min stock level ({unit})</label>
          <input type="number" step="0.01" min="0"
            value={formData.minStock}
            onChange={e => setFormData({ ...formData, minStock: e.target.value })}
          />
        </div>
        {!editingItem && (
          <div className="st-form-group st-initial-stock-box">
            <label>Opening stock ({unit})</label>
            <input type="number" step="0.01" min="0" placeholder="0.00"
              value={formData.currentStock}
              onChange={e => setFormData({ ...formData, currentStock: e.target.value })}
            />
            <small className="st-form-hint">Creates an opening balance batch.</small>
          </div>
        )}
        <div className="st-modal-footer">
          <button type="button" className="st-btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="st-btn-primary" disabled={loading}>
            {loading ? 'Saving…' : editingItem ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
