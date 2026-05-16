import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FaGift, FaTimes, FaToggleOn, FaToggleOff, FaThLarge, FaList, FaUtensils, FaPlus, FaTrash, FaLayerGroup, FaPlusSquare, FaEdit, FaSearch, FaCheck, FaSpinner } from 'react-icons/fa';

import { getJson, putJson, postJson, deleteJson } from '../../utils/api';
import Modal from '../../components/Modal';
import MenuSkeleton from '../../components/skeletons/MenuSkeleton';
import { useSocket } from '../../SocketContext';
import './MenuManagement.css';

export default function MenuManagement({ isChefView = false, onTabChange }) {
  const { socketRef } = useSocket();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24; // Increased for a larger grid

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: null
  });
  const [showForm, setShowForm] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    isAvailable: true,
    hasDiscount: false,
    discountType: 'percentage',
    discountValue: '',
    startDate: '',
    endDate: '',
  });

  const [originalDiscountId, setOriginalDiscountId] = useState(null);
  const [settings, setSettings] = useState({
    vatPercentage: 13,
    vatIncluded: false
  });
  const [categories, setCategories] = useState([]);
  const [discounts, setDiscounts] = useState([]);

  useEffect(() => {
    loadMenuItems();
    loadSettings();
    loadCategories();
    loadDiscounts();
  }, []);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
      loadMenuItems();
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

  async function loadMenuItems() {
    try {
      setLoading(true);
      setError('');
      const data = await getJson('/api/manager/menu');
      setMenuItems(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load menu items');
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const data = await getJson('/api/manager/settings');
      if (data) {
        setSettings({
          vatPercentage: data.vatPercentage ?? data.VatPercentage ?? 13,
          vatIncluded: data.vatIncluded ?? data.VatIncluded ?? false
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      // Use defaults if API fails
    }
  }

  async function loadCategories() {
    try {
      const data = await getJson('/api/manager/categories');
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([]);
    }
  }

  async function loadDiscounts() {
    try {
      const data = await getJson('/api/manager/discounts');
      setDiscounts(data || []);
    } catch (err) {
      console.error('Failed to load discounts:', err);
      setDiscounts([]);
    }
  }

  // Calculate discounted price for a menu item
  function getDiscountedPrice(item) {
    const now = new Date();

    // Find active individual discounts for this item (not combo offers)
    const activeDiscounts = discounts.filter(discount => {
      if (!discount.active) return false;
      if (discount.offerType === 'combo') return false; // Skip combo offers
      if (discount.startDate && new Date(discount.startDate) > now) return false;
      if (discount.endDate && new Date(discount.endDate) < now) return false;

      // Check if this item is in the discount's menu items
      return discount.menuItems?.some(menuItem => menuItem.id === item.id);
    });

    if (activeDiscounts.length === 0) return null;

    // Apply the first active discount (or you could apply all and take the best one)
    const discount = activeDiscounts[0];
    const itemPrice = parseFloat(item.price);

    if (discount.discountType === 'percentage') {
      return itemPrice * (1 - discount.value / 100);
    } else if (discount.discountType === 'fixed') {
      return Math.max(0, itemPrice - discount.value);
    }

    return null;
  }

  function handleEdit(item) {
    setEditingItem(item);

    // Check for active individual discount for this item
    const activeDiscount = discounts.find(d =>
      d.active &&
      d.offerType === 'individual' &&
      d.menuItems?.some(mi => mi.id === item.id)
    );

    setFormData({
      name: item.name || '',
      price: item.price || '',
      category: item.category || '',
      isAvailable: item.isAvailable !== false,
      hasDiscount: !!activeDiscount,
      discountType: activeDiscount ? activeDiscount.discountType : 'percentage',
      discountValue: activeDiscount ? activeDiscount.value : '',
      startDate: activeDiscount && activeDiscount.startDate ? activeDiscount.startDate.split('T')[0] : '',
      endDate: activeDiscount && activeDiscount.endDate ? activeDiscount.endDate.split('T')[0] : '',
    });
    setOriginalDiscountId(activeDiscount ? activeDiscount.id : null);
    setShowForm(true);
    setError('');
  }

  function handleDelete(id) {
    setConfirmModal({
      show: true,
      title: 'Delete Item',
      message: 'Are you sure you want to delete this menu item? This action cannot be undone.',
      type: 'danger',
      onConfirm: () => performDelete(id)
    });
  }

  async function performDelete(id) {
    setConfirmModal(prev => ({ ...prev, show: false }));
    try {
      setLoading(true);
      setError('');
      await deleteJson(`/api/manager/menu/${id}`);
      await loadMenuItems();
    } catch (err) {
      setError(err.message || 'Failed to delete menu item');
      console.error('Error deleting menu item:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (parseFloat(formData.price) < 0) {
      setError('Price cannot be negative');
      return;
    }
    if (formData.hasDiscount && !formData.discountValue) {
      setError('Please enter a discount value');
      return;
    }
    if (formData.hasDiscount && (parseFloat(formData.discountValue) < 0)) {
      setError('Discount value cannot be negative');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        category: formData.category.trim() || null,
        isAvailable: formData.isAvailable,
      };

      let savedItemId;

      // 1. Save Menu Item
      if (editingItem) {
        // Update existing item
        await putJson(`/api/manager/menu/${editingItem.id}`, requestData);
        savedItemId = editingItem.id;
      } else {
        // Create new item
        const newItem = await postJson('/api/manager/menu', requestData);
        // Handle different response formats (some APIs return the item, some return a wrapper)
        savedItemId = newItem?.id || newItem?.Id || newItem?.Item?.id || newItem?.value?.id;

        if (!savedItemId) {
          // Fallback: If server doesn't return ID (common in some legacy APIs), fetch all items to find the new one
          console.log('New item ID not returned. Fetching list to find it...');
          const freshItems = await getJson('/api/manager/menu');
          const match = freshItems.find(i => i.name === requestData.name);
          if (match) {
            savedItemId = match.id;
          }
        }

        if (!savedItemId && formData.hasDiscount) {
          throw new Error('Item created but failed to retrieve ID. Please add the discount manually via Edit.');
        }
      }

      // 2. Handle Discount
      if (formData.hasDiscount && formData.discountValue) {
        const discountData = {
          name: `${formData.name} Discount`,
          description: `Individual discount for ${formData.name}`,
          discountType: formData.discountType,
          offerType: 'individual',
          value: parseFloat(formData.discountValue),
          active: true,
          menuItemIds: [savedItemId],
          startDate: formData.startDate || new Date().toISOString().split('T')[0],
          endDate: formData.endDate || null
        };

        if (originalDiscountId) {
          // Update existing discount
          await putJson(`/api/manager/discounts/${originalDiscountId}`, discountData);
        } else {
          // Create new discount
          // First check (backend will also check) but good to try-catch specifically if we want
          await postJson('/api/manager/discounts', discountData);
        }
      } else if (originalDiscountId && !formData.hasDiscount) {
        // Deactivate existing discount if checkbox unchecked
        await putJson(`/api/manager/discounts/${originalDiscountId}/toggle`, {});
      }

      setSuccess(editingItem ? 'Menu item updated successfully!' : 'Menu item created successfully!');
      setTimeout(() => setSuccess(''), 3000);

      await loadMenuItems();
      await loadDiscounts();

      setShowForm(false);
      setEditingItem(null);
      setOriginalDiscountId(null);
      setFormData({
        name: '',
        price: '',
        category: '',
        isAvailable: true,
        hasDiscount: false,
        discountType: 'percentage',
        discountValue: '',
        startDate: '',
        endDate: '',
      });
      setError('');

    } catch (err) {
      console.error('Failed to save item or discount:', err);
      // If menu item was saved but discount failed, we might want to warn user, 
      // but for now just show the error.
      setError(err.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkSubmit(items) {
    try {
      setLoading(true);
      setError('');

      const payload = items.map(item => ({
        name: item.name.trim(),
        price: parseFloat(item.price),
        category: item.category.trim() || null,
        isAvailable: true
      }));

      await postJson('/api/manager/menu/bulk', payload);

      setSuccess(`Successfully added ${items.length} menu items!`);
      setTimeout(() => setSuccess(''), 3000);

      await loadMenuItems();
      setShowBulkForm(false);
    } catch (err) {
      console.error('Failed to bulk add items:', err);
      setError(err.message || 'Failed to add items');
    } finally {
      setLoading(false);
    }
  }

  async function handleCategoryAdd(categoryName) {
    await postJson('/api/manager/categories', { name: categoryName });
    await loadCategories();
  }

  async function handleCategoryUpdate(id, newName) {
    await putJson(`/api/manager/categories/${id}`, { name: newName });
    await loadCategories();
    await loadMenuItems(); // category rename cascades to menu items
  }

  async function handleCategoryDelete(id) {
    await deleteJson(`/api/manager/categories/${id}`);
    await loadCategories();
    await loadMenuItems(); // deleted category nullifies menu item categories
  }

  function cancelForm() {
    setShowForm(false);
    setShowBulkForm(false);
    setShowAddOptions(false);
    setEditingItem(null);
    setOriginalDiscountId(null);
    setFormData({
      name: '',
      price: '',
      category: '',
      isAvailable: true,
      hasDiscount: false,
      discountType: 'percentage',
      discountValue: '',
      startDate: '',
      endDate: '',
    });
    setError('');
  }




  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetPage = () => setCurrentPage(1);

  // Prepare items based on active category
  let displayItems = [];
  if (activeCategory === 'All') {
    displayItems = [...filteredItems].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    displayItems = filteredItems.filter(item => item.category === activeCategory);
  }

  const totalPages = Math.ceil(displayItems.length / ITEMS_PER_PAGE);
  const pagedItems = displayItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Get active combo offers
  const now = new Date();
  const activeComboOffers = discounts.filter(discount => {
    if (!discount.active || discount.offerType !== 'combo') return false;
    if (discount.startDate && new Date(discount.startDate) > now) return false;
    if (discount.endDate && new Date(discount.endDate) < now) return false;
    return true;
  });

  // Calculate combo offer pricing
  function getComboPrice(combo) {
    const originalTotal = combo.menuItems?.reduce((sum, item) => sum + parseFloat(item.price), 0) || 0;
    if (combo.discountType === 'percentage') {
      return originalTotal * (1 - combo.value / 100);
    } else if (combo.discountType === 'fixed') {
      return Math.max(0, originalTotal - combo.value);
    }
    return originalTotal;
  }

  function getComboOriginalPrice(combo) {
    return combo.menuItems?.reduce((sum, item) => sum + parseFloat(item.price), 0) || 0;
  }

  const isComboAvailable = (combo) => {
    if (!combo || !combo.menuItems) return false;
    return combo.menuItems.every(mi => {
      const fullItem = menuItems.find(m => m.id === mi.id);
      return fullItem ? fullItem.isAvailable : false;
    });
  };



  return (
    <div className="mm-container">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaUtensils style={{ marginRight: '8px' }} /> Menu Management</h1>
          <p className="standard-page-subtitle">Manage products, pricing, and availability</p>
        </div>
        <div className="standard-page-header-actions">
          <button className="mm-btn-primary" onClick={() => setShowAddOptions(true)}>
            <FaPlus /> Add Menu / Category
          </button>
        </div>
      </header>

      {/* Only show page-level banners when no modal is open */}
      {error && !showForm && !showBulkForm && <div className="mm-error-message">{error}</div>}
      {success && <div className="mm-error-message" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#34d399' }}>✓ {success}</div>}

      {showAddOptions && (
        <AddMenuOptionsModal
          onSelectSingle={() => {
            setShowAddOptions(false);
            setShowForm(true);
          }}
          onSelectBulk={() => {
            setShowAddOptions(false);
            setShowBulkForm(true);
          }}
          onSelectCategory={() => {
            setShowAddOptions(false);
            setShowCategoryForm(true);
          }}
          onCancel={() => setShowAddOptions(false)}
        />
      )}

      {showCategoryForm && (
        <ManageCategoriesModal
          categories={categories}
          menuItems={menuItems}
          onCancel={() => setShowCategoryForm(false)}
          onAdd={handleCategoryAdd}
          onUpdate={handleCategoryUpdate}
          onDelete={handleCategoryDelete}
        />
      )}

      {showBulkForm && (
        <BulkAddMenuModal
          categories={categories}
          loading={loading}
          error={error}
          onCancel={cancelForm}
          onSubmit={handleBulkSubmit}
        />
      )}

      {showForm && (
        <MenuItemFormModal
          editingItem={editingItem}
          formData={formData}
          setFormData={setFormData}
          settings={settings}
          categories={categories}
          loading={loading}
          error={error}
          onCancel={cancelForm}
          onSubmit={handleSubmit}
          isChefView={isChefView}
        />
      )}

      {loading && !showForm ? (
        <MenuSkeleton />
      ) : (
        <div className="mm-menu-section">
          <div className="mm-menu-header">
            <div className="mm-menu-header-main">
              <h3 className="mm-menu-title">Menu Items</h3>

              <div className="mm-menu-controls">
                <div className="mm-search-wrapper">
                  <FaSearch className="mm-search-icon" />
                  <input
                    type="text"
                    className="mm-search-input"
                    placeholder="Search menu items or categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="mm-search-clear" onClick={() => setSearchTerm('')}>
                      <FaTimes />
                    </button>
                  )}
                </div>

                <div className="mm-view-toggle">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`mm-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    title="Grid View"
                  >
                    <FaThLarge />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`mm-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    title="List View"
                  >
                    <FaList />
                  </button>
                </div>
              </div>
            </div>
            {/* Category chips */}
            <div className="mm-category-chips">
              <button
                className={`mm-chip ${activeCategory === 'All' ? 'active' : ''}`}
                onClick={() => { setActiveCategory('All'); resetPage(); }}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`mm-chip ${activeCategory === cat.name ? 'active' : ''}`}
                  onClick={() => { setActiveCategory(cat.name); resetPage(); }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {menuItems.length === 0 ? (
            <div className="mm-empty-state">
              <p>No menu items yet. Click "Add Menu / Category" to get started.</p>
            </div>
          ) : (
            <div className="mm-categories-list">
              {/* 1. Integrated Combo Offers (at the top) - Hidden in Chef View */}
              {!isChefView && (() => {
                const relevantCombos = activeCategory === 'All'
                  ? activeComboOffers
                  : activeComboOffers.filter(c => c.menuItems?.some(mi => mi.category === activeCategory));

                if (relevantCombos.length > 0) {
                  return (
                    <div className="mm-category-section mm-combo-section" style={{ marginBottom: '2.5rem' }}>

                      <div className={`mm-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
                        {relevantCombos.map(combo => {
                          const originalPrice = getComboOriginalPrice(combo);
                          const comboPrice = getComboPrice(combo);
                          const savings = originalPrice - comboPrice;
                          const isAvail = isComboAvailable(combo);
                          
                          return (
                            <div 
                              key={combo.id} 
                              className={`mm-card mm-combo-card ${!isAvail ? 'unavailable' : ''}`}
                              onClick={() => !isChefView && onTabChange && onTabChange('discount')}
                              style={!isAvail ? { opacity: 0.7, filter: 'grayscale(100%)' } : {}}
                            >
                              <div className="mm-card-header">
                                <h3 style={!isAvail ? { textDecoration: 'line-through' } : {}}>{combo.name}</h3>
                                {!isAvail && <span className="mm-unavailable-badge" style={{ backgroundColor: '#ef4444' }}>Sold Out</span>}
                                <span className="mm-combo-badge">Combo</span>
                              </div>

                              {combo.description && (
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0' }}>{combo.description}</p>
                              )}

                              <div className="mm-combo-includes">
                                <div className="mm-combo-includes-title">
                                  <FaUtensils size={10} /> Items Included
                                </div>
                                <div className="mm-combo-items-list">
                                  {combo.menuItems?.map(item => {
                                    const fullItem = menuItems.find(m => m.id === item.id);
                                    const itemAvail = fullItem ? fullItem.isAvailable : false;
                                    return (
                                      <span 
                                        key={item.id} 
                                        className="mm-combo-item-tag"
                                        style={!itemAvail ? { textDecoration: 'line-through', opacity: 0.6 } : {}}
                                      >
                                        {item.name} {!itemAvail && '(Out)'}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="mm-card-footer">
                                <div className="mm-price-container">
                                  <span className="mm-price-original">NRP {originalPrice.toFixed(2)}</span>
                                  <span className="mm-price-discounted">NRP {comboPrice.toFixed(2)}</span>
                                  {isAvail && <span className="mm-savings-badge">Save NRP {savings.toFixed(2)}</span>}
                                </div>
                                <div className="mm-card-action-hint">
                                  <FaGift />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* 2. Standard Items (Flat or Category Filtered) */}
              <div className="mm-category-section">
                <div className={`mm-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
                  {pagedItems.map(item => {
                    const discountedPrice = getDiscountedPrice(item);
                    return (
                      <div
                        key={item.id}
                        className={`mm-card ${!item.isAvailable ? 'unavailable' : ''}`}
                        onClick={() => handleEdit(item)}
                      >
                        <button
                          className="mm-btn-delete-floating"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          title="Delete Item"
                        >
                          <FaTrash />
                        </button>

                        <div className="mm-card-header">
                          <h3>{item.name}</h3>
                          {!isChefView && discountedPrice !== null && (
                            <span className="mm-discount-badge">Discount</span>
                          )}
                        </div>

                        <div className="mm-card-info">
                          {!item.isAvailable && <span className="mm-unavailable-badge">Unavailable</span>}
                        </div>

                        <div className="mm-card-footer">
                          <div className="mm-price-container">
                            {!isChefView && discountedPrice !== null ? (
                              <>
                                <span className="mm-price-original">NRP {parseFloat(item.price).toFixed(2)}</span>
                                <span className="mm-price-discounted">NRP {discountedPrice.toFixed(2)}</span>
                              </>
                            ) : (
                              <span className="mm-price">NRP {parseFloat(item.price).toFixed(2)}</span>
                            )}
                          </div>
                          <div className="mm-card-action-hint">
                            <FaEdit />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination Controls (inside categories-list but after all items) */}
              {totalPages > 1 && (
                <div className="mm-pagination">
                  <button
                    className="mm-page-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`mm-page-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="mm-page-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next ›
                  </button>
                  <span className="mm-page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
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

function MenuItemFormModal({
  editingItem,
  formData,
  setFormData,
  settings,
  categories,
  loading,
  error,
  onCancel,
  onSubmit,
  isChefView
}) {
  return ReactDOM.createPortal(
    <div className="mm-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="mm-modal-wrapper">
        <div className="mm-modal-header">
          <h3 className="mm-modal-title">
            {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
          </h3>
          <button className="mm-btn-icon" onClick={onCancel} type="button">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="mm-modal-body">
            {error && (
              <div className="mm-modal-alert mm-modal-alert--error">{error}</div>
            )}
            <div className="mm-form-group">
              <label>Item Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Spicy Chicken Burger"
                autoFocus
              />
            </div>

            <div className="mm-form-row">
              <div className="mm-form-group">
                <label>Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
                <small className="mm-form-hint">
                  {settings.vatIncluded
                    ? `Includes ${settings.vatPercentage}% VAT.`
                    : `Excludes ${settings.vatPercentage}% VAT.`}
                </small>
              </div>

              <div className="mm-form-group">
                <label>Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mm-form-group">
              <label>Status</label>
              <button
                type="button"
                className={`mm-status-toggle-btn ${formData.isAvailable ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFormData({ ...formData, isAvailable: !formData.isAvailable });
                }}
              >
                {formData.isAvailable ? <FaToggleOn size={22} className="mm-toggle-icon on" /> : <FaToggleOff size={22} className="mm-toggle-icon off" />}
                <span className="mm-toggle-text">{formData.isAvailable ? 'Available' : 'Unavailable'}</span>
              </button>
            </div>

            {/* Discount Section */}
            <div className="mm-discount-section">
              <h4 className="mm-section-title"><FaGift className="mm-icon" /> Individual Discount</h4>
              {!isChefView && (
                <>
                  <div className="mm-form-group mm-form-group-flex">
                    <label style={{ marginBottom: 0 }}>Individual Discount</label>
                    <button
                      type="button"
                      className={`mm-status-toggle-btn ${formData.hasDiscount ? 'active' : ''}`}
                      onClick={() => {
                        setFormData({ ...formData, hasDiscount: !formData.hasDiscount });
                      }}
                    >
                      {formData.hasDiscount ? <FaToggleOn size={22} className="mm-toggle-icon on" /> : <FaToggleOff size={22} className="mm-toggle-icon off" />}
                      <span className="mm-toggle-text">{formData.hasDiscount ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </div>

                  {formData.hasDiscount && (
                    <div className="mm-form-row mm-fade-in">
                      <div className="mm-form-group">
                        <label>Type</label>
                        <select
                          value={formData.discountType}
                          onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (NRP)</option>
                        </select>
                      </div>
                      <div className="mm-form-group">
                        <label>Value *</label>
                        <input
                          type="number"
                          min="0"
                          step={formData.discountType === 'percentage' ? '1' : '0.01'}
                          required={formData.hasDiscount}
                          value={formData.discountValue}
                          onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                          placeholder={formData.discountType === 'percentage' ? '10' : '100'}
                        />
                      </div>
                    </div>
                  )}

                  {formData.hasDiscount && (
                    <div className="mm-form-row mm-fade-in">
                      <div className="mm-form-group">
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                      <div className="mm-form-group">
                        <label>End Date</label>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mm-modal-footer">
            <button type="button" className="mm-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="mm-btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function AddMenuOptionsModal({ onSelectSingle, onSelectBulk, onSelectCategory, onCancel }) {
  return ReactDOM.createPortal(
    <div className="mm-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="mm-modal-wrapper" style={{ maxWidth: '450px' }}>
        <div className="mm-modal-header">
          <h3 className="mm-modal-title">Choose Addition Method</h3>
          <button className="mm-btn-icon" onClick={onCancel} type="button">
            <FaTimes />
          </button>
        </div>
        <div className="mm-modal-body" style={{ padding: '2rem' }}>
          <div className="mm-options-container">
            <button className="mm-option-card" onClick={onSelectSingle}>
              <div className="mm-option-icon single">
                <FaUtensils />
              </div>
              <div className="mm-option-text">
                <h4>Single Item</h4>
                <p>Add one menu item with full details like discounts and availability.</p>
              </div>
            </button>

            <button className="mm-option-card" onClick={onSelectBulk}>
              <div className="mm-option-icon multiple">
                <FaLayerGroup />
              </div>
              <div className="mm-option-text">
                <h4>Multiple Items</h4>
                <p>Quickly add multiple menu items at once in a table format.</p>
              </div>
            </button>

            <button className="mm-option-card" onClick={onSelectCategory}>
              <div className="mm-option-icon category">
                <FaPlusSquare />
              </div>
              <div className="mm-option-text">
                <h4>Add Category</h4>
                <p>Create a new category to group your menu items.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ManageCategoriesModal({ categories, menuItems, onCancel, onAdd, onUpdate, onDelete }) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);


  function showError(msg) {
    setModalError(msg);
    setModalSuccess('');
  }

  function showSuccess(msg) {
    setModalSuccess(msg);
    setModalError('');
    setTimeout(() => setModalSuccess(''), 2500);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showError('A category with this name already exists.');
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      await onAdd(name);
      setNewCategoryName('');
      showSuccess(`Category "${name}" created!`);
    } catch (err) {
      showError(err.message || 'Failed to create category.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setModalError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
    setModalError('');
  }

  async function saveEdit(cat) {
    const name = editingName.trim();
    if (!name) { showError('Category name cannot be empty.'); return; }
    if (name.toLowerCase() === cat.name.toLowerCase()) { cancelEdit(); return; }
    if (categories.some(c => c.id !== cat.id && c.name.toLowerCase() === name.toLowerCase())) {
      showError('A category with this name already exists.');
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      await onUpdate(cat.id, name);
      showSuccess(`Renamed to "${name}"`);
      cancelEdit();
    } catch (err) {
      showError(err.message || 'Failed to update category.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cat) {
    if (confirmDeleteId !== cat.id) {
      setConfirmDeleteId(cat.id);
      return;
    }
    setConfirmDeleteId(null);
    setBusy(true);
    setModalError('');
    try {
      await onDelete(cat.id);
      showSuccess(`"${cat.name}" deleted.`);
      if (editingId === cat.id) cancelEdit();
    } catch (err) {
      showError(err.message || 'Failed to delete category.');
    } finally {
      setBusy(false);
    }
  }

  const nameAlreadyExists = categories.some(
    c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()
  );

  const categoriesWithCounts = categories.map(cat => ({
    ...cat,
    itemCount: menuItems.filter(item => item.category === cat.name).length
  }));

  return ReactDOM.createPortal(
    <div className="mm-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="mm-modal-wrapper mm-cat-modal-wrapper">
        <div className="mm-modal-header">
          <h3 className="mm-modal-title"><FaLayerGroup style={{ marginRight: '0.5rem' }} />Manage Categories</h3>
          <button className="mm-btn-icon" onClick={onCancel} type="button">
            <FaTimes />
          </button>
        </div>

        <div className="mm-modal-body">
          {/* Inline feedback */}
          {modalError && (
            <div className="mm-modal-alert mm-modal-alert--error">{modalError}</div>
          )}
          {modalSuccess && (
            <div className="mm-modal-alert mm-modal-alert--success">✓ {modalSuccess}</div>
          )}

          {/* Add new category */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <input
              type="text"
              value={newCategoryName}
              onChange={e => { setNewCategoryName(e.target.value); setModalError(''); }}
              placeholder="New category name…"
              style={{ flex: 1 }}
              autoFocus
              disabled={busy}
            />
            <button
              type="submit"
              className="mm-btn-primary"
              style={{ whiteSpace: 'nowrap' }}
              disabled={busy || !newCategoryName.trim() || nameAlreadyExists}
            >
              {busy ? <FaSpinner className="mm-spin" /> : <><FaPlus style={{ marginRight: '0.35rem' }} />Add</>}
            </button>
          </form>

          {/* Existing categories list */}
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Existing Categories ({categories.length})
          </div>

          <div className="mm-cat-manage-list">
            {categoriesWithCounts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>No categories yet. Add one above.</p>
            ) : (
              categoriesWithCounts.map(cat => (
                <div key={cat.id} className="mm-cat-manage-row">
                  {editingId === cat.id ? (
                    <>
                      <input
                        className="mm-cat-manage-input"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(cat); } if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus
                        disabled={busy}
                      />
                      <button
                        className="mm-cat-action-btn mm-cat-action-btn--save"
                        onClick={() => saveEdit(cat)}
                        disabled={busy}
                        title="Save"
                      >
                        {busy ? <FaSpinner className="mm-spin" /> : <FaCheck />}
                      </button>
                      <button
                        className="mm-cat-action-btn mm-cat-action-btn--cancel"
                        onClick={cancelEdit}
                        disabled={busy}
                        title="Cancel"
                      >
                        <FaTimes />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="mm-cat-manage-name">{cat.name}</span>
                      {cat.itemCount > 0 && (
                        <span className="mm-cat-item-count" title={`${cat.itemCount} items in this category`}>
                          {cat.itemCount} item{cat.itemCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <button
                        className="mm-cat-action-btn mm-cat-action-btn--edit"
                        onClick={() => startEdit(cat)}
                        disabled={busy}
                        title="Rename"
                      >
                        <FaEdit />
                      </button>
                      {confirmDeleteId === cat.id ? (
                        <div className="mm-cat-confirm-delete">
                          <button
                            className="mm-cat-action-btn mm-cat-action-btn--confirm"
                            onClick={() => handleDelete(cat)}
                            disabled={busy}
                            title="Confirm Delete"
                          >
                            {busy ? <FaSpinner className="mm-spin" /> : <FaCheck />}
                          </button>
                          <button
                            className="mm-cat-action-btn mm-cat-action-btn--cancel"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={busy}
                            title="Cancel"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="mm-cat-action-btn mm-cat-action-btn--delete"
                          onClick={() => handleDelete(cat)}
                          disabled={busy || cat.itemCount > 0}
                          title={cat.itemCount > 0 ? "Cannot delete: category has items" : "Delete"}
                        >
                          <FaTrash />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mm-modal-footer">
          <button type="button" className="mm-btn-secondary" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BulkAddMenuModal({ categories, loading, error, onCancel, onSubmit }) {
  const [items, setItems] = useState([
    { id: Date.now(), name: '', price: '', category: '' }
  ]);

  const addRow = () => {
    setItems([...items, { id: Date.now(), name: '', price: '', category: '' }]);
  };

  const removeRow = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateRow = (id, field, value) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleBulkSubmit = (e) => {
    e.preventDefault();
    const validItems = items.filter(item => item.name.trim() && item.price);
    if (validItems.length === 0) return;
    onSubmit(validItems);
  };

  return ReactDOM.createPortal(
    <div className="mm-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="mm-modal-wrapper mm-bulk-modal-wrapper">
        <div className="mm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FaLayerGroup className="mm-icon" style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }} />
            <h3 className="mm-modal-title">Add Multiple Menu Items</h3>
          </div>
          <button className="mm-btn-icon" onClick={onCancel} type="button">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleBulkSubmit} className="mm-bulk-form">
          <div className="mm-modal-body mm-bulk-body">
            {error && (
              <div className="mm-modal-alert mm-modal-alert--error">{error}</div>
            )}
            <p className="mm-bulk-hint">Enter the names, prices, and categories for the items you want to add. Blank rows will be ignored.</p>

            <div className="mm-bulk-table-container">
              <table className="mm-bulk-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Item Name *</th>
                    <th style={{ width: '20%' }}>Price *</th>
                    <th style={{ width: '30%' }}>Category *</th>
                    <th style={{ width: '10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="mm-fade-in">
                      <td>
                        <input
                          type="text"
                          className="mm-bulk-input"
                          value={item.name}
                          onChange={(e) => updateRow(item.id, 'name', e.target.value)}
                          placeholder="e.g., Cold Coffee"
                          required={index === 0}
                          autoFocus={index === items.length - 1 && index !== 0}
                        />
                      </td>
                      <td>
                        <div className="mm-bulk-price-wrapper">
                          <span className="mm-bulk-currency">NRP</span>
                          <input
                            type="number"
                            className="mm-bulk-input"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateRow(item.id, 'price', e.target.value)}
                            placeholder="0.00"
                            required={index === 0}
                          />
                        </div>
                      </td>
                      <td>
                        <select
                          className="mm-bulk-select"
                          value={item.category}
                          onChange={(e) => updateRow(item.id, 'category', e.target.value)}
                          required={index === 0}
                        >
                          <option value="">Select Category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="mm-btn-delete-row"
                          onClick={() => removeRow(item.id)}
                          disabled={items.length === 1}
                          title="Remove row"
                        >
                          <FaTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="button" className="mm-btn-add-row" onClick={addRow}>
              <FaPlusSquare /> Add Another Row
            </button>
          </div>

          <div className="mm-modal-footer">
            <button type="button" className="mm-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="mm-btn-primary" disabled={loading || items.every(i => !i.name.trim())}>
              {loading ? 'Creating Items...' : `Create ${items.filter(i => i.name.trim()).length} Items`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}


