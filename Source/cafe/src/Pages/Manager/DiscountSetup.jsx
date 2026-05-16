import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import DiscountSkeleton from '../../components/skeletons/DiscountSkeleton';
import { getJson, putJson, postJson, deleteJson } from '../../utils/api';
import Modal from '../../components/Modal';
import { FaTimes, FaPlus, FaEdit, FaTrash, FaPowerOff, FaToggleOn, FaToggleOff, FaTags, FaGift, FaPercentage, FaLayerGroup, FaInfoCircle, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'; // Added Icons
import { useSocket } from '../../SocketContext';
import './DiscountSetup.css';

export default function DiscountSetup() {
  const { socketRef } = useSocket();
  const [discounts, setDiscounts] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: null
  });
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discountType: 'percentage',
    offerType: 'individual',
    value: '',
    startDate: '',
    endDate: '',
    selectedMenuItems: [],
    active: true,
  });

  const [conflictWarning, setConflictWarning] = useState('');


  useEffect(() => {
    loadDiscounts();
    loadMenuItems();
  }, []);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
      loadDiscounts();
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

  async function loadDiscounts() {
    try {
      setLoading(true);
      setError('');
      const data = await getJson('/api/manager/discounts');
      setDiscounts(data || []);
    } catch (err) {
      console.error('Failed to load discounts:', err);
      setError(err.message || 'Failed to load discounts');
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMenuItems() {
    try {
      const data = await getJson('/api/manager/menu');
      setMenuItems(data || []);
    } catch (err) {
      console.error('Failed to load menu items:', err);
      setMenuItems([]);
    }
  }

  function handleEdit(discount) {
    setEditingDiscount(discount);
    const menuItemIds = discount.menuItems?.map(item => item.id) || [];
    setFormData({
      name: discount.name || '',
      description: discount.description || '',
      discountType: discount.discountType || 'percentage',
      offerType: discount.offerType || 'individual',
      value: discount.value || '',
      startDate: discount.startDate ? discount.startDate.split('T')[0] : '',
      endDate: discount.endDate ? discount.endDate.split('T')[0] : '',
      selectedMenuItems: menuItemIds,
      active: discount.active !== false,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  async function handleDeleteClick(id) {
    setConfirmModal({
      show: true,
      title: 'Delete Discount',
      message: 'Are you sure you want to delete this discount? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
          setLoading(true);
          setError('');
          await deleteJson(`/api/manager/discounts/${id}`);
          setSuccess('Discount deleted successfully!');
          setTimeout(() => setSuccess(''), 3000);
          await loadDiscounts();
        } catch (err) {
          setError(err.message || 'Failed to delete discount');
        } finally {
          setLoading(false);
        }
      }
    });
  }

  async function toggleActive(id) {
    try {
      setLoading(true);
      setError('');
      await putJson(`/api/manager/discounts/${id}/toggle`, {});
      await loadDiscounts();
      setSuccess('Discount status updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Failed to toggle discount');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.selectedMenuItems || formData.selectedMenuItems.length === 0) {
      setError('Please select at least one menu item');
      return;
    }

    // Validate combo offers have at least 2 items
    if (formData.offerType === 'combo' && formData.selectedMenuItems.length < 2) {
      setError('Combo offers must include at least 2 menu items');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        discountType: formData.discountType,
        offerType: formData.offerType,
        value: parseFloat(formData.value),
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        active: formData.active,
        menuItemIds: formData.selectedMenuItems,
      };

      if (editingDiscount) {
        await putJson(`/api/manager/discounts/${editingDiscount.id}`, requestData);
      } else {
        await postJson('/api/manager/discounts', requestData);
      }
      setSuccess(editingDiscount ? 'Discount updated successfully!' : 'Discount created successfully!');

      setTimeout(() => setSuccess(''), 3000);
      await loadDiscounts();
      setShowForm(false);
      setEditingDiscount(null);
      setFormData({
        name: '',
        description: '',
        discountType: 'percentage',
        offerType: 'individual',
        value: '',
        startDate: '',
        endDate: '',
        selectedMenuItems: [],
        active: true,
      });
    } catch (err) {
      console.error('Error saving discount:', err);
      setError(err.message || 'Failed to save discount');
    } finally {
      setLoading(false);
    }
  }

  function cancelForm() {
    setShowForm(false);
    setEditingDiscount(null);
    setFormData({
      name: '',
      description: '',
      discountType: 'percentage',
      offerType: 'individual',
      value: '',
      startDate: '',
      endDate: '',
      selectedMenuItems: [],
      active: true,
    });
    setError('');
    setSuccess('');
  }

  function toggleMenuItem(itemId) {
    setFormData(prev => {
      const selected = prev.selectedMenuItems || [];
      const isIndividual = prev.offerType === 'individual';
      let newSelected;

      if (selected.includes(itemId)) {
        newSelected = selected.filter(id => id !== itemId);
      } else {
        // If individual, replace selection (radio behavior). If combo, add to selection.
        newSelected = isIndividual ? [itemId] : [...selected, itemId];
      }
      return { ...prev, selectedMenuItems: newSelected };
    });
    // Check conflicts after state update
    setTimeout(() => checkConflicts(), 100);
  }

  // Check for discount conflicts
  function checkConflicts() {
    setConflictWarning('');

    if (!formData.selectedMenuItems || formData.selectedMenuItems.length === 0) {
      return;
    }

    const activeDiscounts = discounts.filter(d => {
      if (!d.active) return false;
      if (editingDiscount && d.id === editingDiscount.id) return false; // Exclude current discount when editing
      return true;
    });

    if (formData.offerType === 'individual') {
      // Check if any selected item already has an individual discount
      for (const itemId of formData.selectedMenuItems) {
        const hasConflict = activeDiscounts.some(d =>
          d.offerType === 'individual' &&
          d.menuItems?.some(mi => mi.id === itemId)
        );

        if (hasConflict) {
          const item = menuItems.find(m => m.id === itemId);
          setConflictWarning(`⚠️ Item "${item?.name}" already has an active individual discount. This will be rejected by the server.`);
          return;
        }
      }
    } else if (formData.offerType === 'combo') {
      // Check if exact same combo exists
      const sortedNew = [...formData.selectedMenuItems].sort((a, b) => a - b);

      for (const existingCombo of activeDiscounts.filter(d => d.offerType === 'combo')) {
        const sortedExisting = existingCombo.menuItems?.map(mi => mi.id).sort((a, b) => a - b) || [];

        if (JSON.stringify(sortedNew) === JSON.stringify(sortedExisting)) {
          setConflictWarning(`⚠️ A combo offer with this exact combination already exists: "${existingCombo.name}". This will be rejected by the server.`);
          return;
        }
      }
    }
  }

  // Check if a discount has conflicts with other active discounts
  function hasConflictWarning(discount) {
    const otherActiveDiscounts = discounts.filter(d =>
      d.active && d.id !== discount.id
    );

    if (discount.offerType === 'individual') {
      // Check if any item in this discount has another individual discount
      for (const item of discount.menuItems || []) {
        const hasConflict = otherActiveDiscounts.some(d =>
          d.offerType === 'individual' &&
          d.menuItems?.some(mi => mi.id === item.id)
        );
        if (hasConflict) {
          return `Item "${item.name}" has multiple individual discounts`;
        }
      }
    } else if (discount.offerType === 'combo') {
      // Check if exact same combo exists
      const sortedThis = discount.menuItems?.map(mi => mi.id).sort((a, b) => a - b) || [];

      for (const other of otherActiveDiscounts.filter(d => d.offerType === 'combo')) {
        const sortedOther = other.menuItems?.map(mi => mi.id).sort((a, b) => a - b) || [];

        if (JSON.stringify(sortedThis) === JSON.stringify(sortedOther)) {
          return `Duplicate combo: "${other.name}"`;
        }
      }
    }

    return null;
  }



  return (
    <div className="ds-container">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaTags style={{ marginRight: '8px' }} /> Discount Setup</h1>
          <p className="standard-page-subtitle">Configure promotional offers and menu item deals</p>
        </div>
        <div className="standard-page-header-actions">
          <button className="ds-btn-primary" onClick={() => setShowForm(true)}>
            <FaPlus /> Create Discount
          </button>
        </div>
      </header>

      {success && <div className="ds-success-message" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#34d399', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid' }}>✓ {success}</div>}

      {/* Render Portal Form */}
      {showForm && (
        <DiscountFormModal
          editingDiscount={editingDiscount}
          formData={formData}
          setFormData={setFormData}
          error={error}
          conflictWarning={conflictWarning}
          menuItems={menuItems}
          toggleMenuItem={toggleMenuItem}
          loading={loading}
          onCancel={cancelForm}
          onSubmit={handleSubmit}
        />
      )}

      <div className="ds-master-card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', padding: '1.5rem', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        {loading && !showForm ? (
          <DiscountSkeleton />
        ) : discounts.length === 0 ? (
          <div className="ds-empty-state fade-in">
            <div className="ds-empty-illustration">
              <div className="ds-empty-circle large"></div>
              <div className="ds-empty-circle medium"></div>
              <div className="ds-empty-circle small"></div>
              <FaTags className="ds-empty-icon-main" />
            </div>
            <h3>Boost Your Sales!</h3>
            <p>You haven't configured any discounts or combo offers yet. Create your first promotional deal to attract more customers and increase your revenue.</p>
            <button className="ds-btn-primary premium" onClick={() => setShowForm(true)}>
              <FaPlus /> Launch Your First Offer
            </button>
          </div>
        ) : (
          <div className="ds-grid">
            {discounts.map(discount => {
              const conflictMsg = hasConflictWarning(discount);
              return (
                <div key={discount.id} className={`ds-card ${!discount.active ? 'inactive' : ''}`}>
                  {/* 1. Header: Name & Status */}
                  <div className="ds-card-header-row">
                    <div className="ds-name-group">
                      <span className="ds-name-label">Promotion Name</span>
                      <h3 className="ds-name-val">{discount.name}</h3>
                    </div>
                    <div className={`ds-status-badge ${discount.active ? 'active' : 'inactive'}`}>
                      {discount.active ? <><FaCheckCircle /> Active</> : <><FaPowerOff /> Inactive</>}
                    </div>
                  </div>

                  {/* 2. Meta Row: Type & Value */}
                  <div className="ds-card-meta-row">
                    <div className="ds-meta-left">
                      <span className={`ds-type-pill ${discount.offerType}`}>
                        {discount.offerType === 'combo' ? <FaGift size={10} /> : <FaTags size={10} />}
                        {discount.offerType === 'combo' ? 'Combo Offer' : 'Individual Item'}
                      </span>
                      {conflictMsg && discount.active && (
                        <span className="ds-alert-pill conflict" title={conflictMsg}>
                          <FaExclamationTriangle size={10} /> Conflict Detected
                        </span>
                      )}
                    </div>
                    <div className="ds-value-pill">
                      {discount.discountType === 'percentage' ? <FaPercentage size={10} /> : 'NRP'}
                      <strong>{discount.discountType === 'percentage' ? `${discount.value}%` : discount.value.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* 3. Items Section/Body */}
                  <div className="ds-card-body">
                    {discount.description && (
                      <div className="ds-description-box">
                        <FaInfoCircle size={10} /> 
                        <p>{discount.description}</p>
                      </div>
                    )}

                    <div className="ds-items-section">
                      <div className="ds-section-mini-title">
                        <FaLayerGroup /> Applicable Items ({discount.menuItems?.length || 0})
                      </div>
                      <div className="ds-items-scroll">
                        {discount.menuItems && discount.menuItems.length > 0 ? (
                          discount.menuItems.map(item => (
                            <span key={item.id} className="ds-item-tag-pill">
                              {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="ds-items-empty">All menu items or deleted items</span>
                        )}
                      </div>
                    </div>

                    {discount.startDate && (
                      <div className="ds-date-info">
                        <FaCalendarAlt /> Valid from: <strong>{new Date(discount.startDate).toLocaleDateString()}</strong>
                      </div>
                    )}
                  </div>

                  {/* 4. Actions Footer */}
                  <div className="ds-card-footer">
                    <button 
                      className={`ds-footer-btn toggle ${discount.active ? 'deactivate' : 'activate'}`} 
                      onClick={() => toggleActive(discount.id)}
                      title={discount.active ? 'Deactivate Discount' : 'Activate Discount'}
                    >
                      <FaPowerOff />
                    </button>
                    <div className="ds-footer-actions-group">
                      <button className="ds-footer-btn edit" onClick={() => handleEdit(discount)} title="Edit Configuration">
                        <FaEdit /> <span>Edit</span>
                      </button>
                      <button className="ds-footer-btn delete" onClick={() => handleDeleteClick(discount.id)} title="Remove Discount">
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

function DiscountFormModal({
  editingDiscount,
  formData,
  setFormData,
  error,
  conflictWarning,
  menuItems,
  toggleMenuItem,
  loading,
  onCancel,
  onSubmit
}) {
  return ReactDOM.createPortal(
    <div className="ds-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="ds-modal-wrapper">
        <div className="ds-modal-header">
          <h3 className="ds-modal-title">
            {editingDiscount ? 'Edit Discount' : 'Create New Discount'}
          </h3>
          <button className="ds-modal-close" onClick={onCancel} type="button">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={onSubmit} className="ds-modal-content-form" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="ds-modal-body">
            {error && (
              <div className="ds-alert error">
                <span>⚠️</span> <span>{error}</span>
              </div>
            )}

            {conflictWarning && (
              <div className="ds-alert warning">
                <span>⚠️</span> <span>{conflictWarning}</span>
              </div>
            )}

            <div className="ds-form-group">
              <label>Discount Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Happy Hour Special"
                autoFocus
              />
            </div>

            <div className="ds-form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows="2"
                placeholder="Optional description..."
              />
            </div>

            <div className="ds-form-row">
              <div className="ds-form-group">
                <label>Offer Type *</label>
                <select
                  required
                  value={formData.offerType}
                  onChange={e => setFormData({ ...formData, offerType: e.target.value })}
                >
                  <option value="individual">Individual Item</option>
                  <option value="combo">Combo Offer</option>
                </select>
              </div>

              <div className="ds-form-group">
                <label>Discount Type *</label>
                <select
                  required
                  value={formData.discountType}
                  onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (NRP)</option>
                </select>
              </div>
            </div>

            <div className="ds-form-group">
              <label>Discount Value *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                placeholder={formData.discountType === 'percentage' ? 'e.g., 10' : 'e.g., 100'}
              />
            </div>

            <div className="ds-form-row">
              <div className="ds-form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="ds-form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="ds-form-group">
              <label>Select Menu Items *</label>
              {formData.offerType === 'combo' && (
                <span className="ds-form-hint" style={{ color: '#f59e0b' }}>
                  Combo offers require at least 2 items
                </span>
              )}
              <div className="ds-menu-items-selector">
                {menuItems.length === 0 ? (
                  <p className="ds-no-items-text">No menu items available</p>
                ) : (
                  menuItems.map(item => (
                    <div
                      key={item.id}
                      className={`ds-menu-item-checkbox ${formData.selectedMenuItems?.includes(item.id) ? 'selected' : ''} ${!item.isAvailable ? 'out-of-stock' : ''}`}
                      onClick={() => toggleMenuItem(item.id)}
                      style={!item.isAvailable ? { opacity: 0.8, background: '#f8fafc' } : {}}
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedMenuItems?.includes(item.id) || false}
                        readOnly
                      />
                      <span className="ds-item-name" style={!item.isAvailable ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}>
                        {item.name}
                      </span>
                      {!item.isAvailable && (
                        <span className="ds-out-badge" style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
                          OUT
                        </span>
                      )}
                      <span className="ds-item-category">{item.category}</span>
                      <span className="ds-item-price">NRP {parseFloat(item.price).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
              <small className="ds-form-hint">
                {formData.selectedMenuItems?.length || 0} item(s) selected
              </small>
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Status</label>
              <button
                type="button"
                className={`ds-status-toggle-btn ${formData.active ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFormData(prev => ({ ...prev, active: !prev.active }));
                }}
              >
                {formData.active ? <FaToggleOn size={22} className="ds-toggle-icon on" /> : <FaToggleOff size={22} className="ds-toggle-icon off" />}
                <span className="ds-toggle-text">{formData.active ? 'Active' : 'Inactive'}</span>
              </button>
            </div>

          </div>

          <div className="ds-modal-footer">
            <button type="button" className="ds-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="ds-btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingDiscount ? 'Update Discount' : 'Create Discount'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
