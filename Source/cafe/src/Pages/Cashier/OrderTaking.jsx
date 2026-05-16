import { useState, useEffect, useMemo, useCallback } from 'react';
import MenuSkeleton from '../../components/skeletons/MenuSkeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaUtensils, FaShoppingBag, FaGift, FaPlus, FaThLarge, FaList, FaCheck, FaSearch, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { getJson, postJson } from '../../utils/api';
import Modal from '../../components/Modal';
import { useSocket } from '../../SocketContext';
import './OrderTaking.css';

export default function OrderTaking() {
  const { connection } = useSocket();
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Table Selection State
  const [currentTable, setCurrentTable] = useState('');
  const [tableConfig, setTableConfig] = useState({ floors: [] });


  // Seat & Booking State
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedFloorName, setSelectedFloorName] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingDuration, setBookingDuration] = useState(60);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Feature Toggles from Settings
  const [bookingEnabled, setBookingEnabled] = useState(true);

  const [orderType, setOrderType] = useState('dine-in'); // 'dine-in' or 'takeaway'
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    vatPercentage: 13,
    vatIncluded: false,
    serviceChargePercentage: 0,
    serviceChargeIncluded: false,
    tableBookingCharge: 0,
    tableBookingChargeType: 'per_hour',
    payFirst: false
  });

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: null
  });

  // const [showClearConfirm, setShowClearConfirm] = useState(false); // Removed for native confirm
  // const [showClearConfirm, setShowClearConfirm] = useState(false); // Removed for native confirm
  const [discounts, setDiscounts] = useState([]);

  // Active Booking State
  const [activeBooking, setActiveBooking] = useState(null);
  const [applyBookingCharge, setApplyBookingCharge] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false);
  const [linkedBookingId, setLinkedBookingId] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [bookedTables, setBookedTables] = useState([]); // List of tables that are currently booked
  const [seatStatusData, setSeatStatusData] = useState([]); // Per-seat occupancy for walk-in modal
  const [seatStatusLoading, setSeatStatusLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState('');
  const [isCartActive, setIsCartActive] = useState(false);


  const fetchBookedTables = useCallback(async () => {
    try {
      const data = await getJson('/api/booking/current');
      if (data && data.status && data.bookings) {
        // Extract unique table identifiers (Floor-Table) that are active
        const active = data.bookings.map(b => `${b.floorName}-${b.tableNumber}`);
        setBookedTables(active);
      }
    } catch (err) {
      console.error("Failed to fetch booked tables", err);
    }
  }, []);

  const loadMenuItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getJson('/api/manager/menu');
      setMenuItems(data || []);
    } catch (err) {
      setError('Failed to load menu items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await getJson('/api/manager/settings');
      if (data) {
        const toBool = (val) => {
          if (typeof val === 'string') return val.toLowerCase() === 'true';
          return val === true || val === 1;
        };

        setSettings({
          vatPercentage: parseFloat(data.vatPercentage ?? data.VatPercentage ?? 13),
          vatIncluded: toBool(data.vatIncluded ?? data.VatIncluded ?? false),
          serviceChargePercentage: parseFloat(data.serviceChargePercentage ?? data.ServiceChargePercentage ?? 0),
          serviceChargeIncluded: toBool(data.serviceChargeIncluded ?? data.ServiceChargeIncluded ?? false),
          tableBookingCharge: parseFloat(data.tableBookingCharge ?? data.TableBookingCharge ?? 0),
          tableBookingChargeType: data.tableBookingChargeType ?? data.TableBookingChargeType ?? 'per_hour',
          payFirst: toBool(data.payFirst ?? data.PayFirst ?? false)
        });

        // Load Table Config
        let tableConfigVal = data.tableConfiguration ?? data.TableConfiguration;
        if (typeof tableConfigVal === 'string') {
          try { tableConfigVal = JSON.parse(tableConfigVal); } catch (e) { tableConfigVal = { floors: [] }; }
        }
        if (tableConfigVal && tableConfigVal.floors) {
          setTableConfig(tableConfigVal);
        }

        // Load Feature Toggles
        setBookingEnabled(data.enableTableBooking ?? true);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const loadDiscounts = useCallback(async () => {
    try {
      const data = await getJson('/api/manager/discounts');
      setDiscounts(data || []);
    } catch (err) {
      console.error('Failed to load discounts:', err);
      setDiscounts([]);
    }
  }, []);

  useEffect(() => {
    // Parallelize data loading for better performance
    loadMenuItems();
    loadDiscounts();
    loadSettings(); // This loads settings & table config
    fetchBookedTables(); // This loads active bookings

    const settingsInterval = setInterval(loadSettings, 5000);
    const discountsInterval = setInterval(loadDiscounts, 10000);
    const bookedTablesInterval = setInterval(fetchBookedTables, 10000);

    return () => {
      clearInterval(settingsInterval);
      clearInterval(discountsInterval);
      clearInterval(bookedTablesInterval);
    };
  }, [loadMenuItems, loadDiscounts, loadSettings, fetchBookedTables]);

  useEffect(() => {
    if (!connection) return;

    const handleUpdate = () => {
      fetchBookedTables();
    };

    connection.on('NewOrder', handleUpdate);
    connection.on('OrderUpdated', handleUpdate);
    connection.on('PaymentUpdate', handleUpdate);
    connection.on('table.stateChanged', handleUpdate);

    return () => {
      connection.off('NewOrder', handleUpdate);
      connection.off('OrderUpdated', handleUpdate);
      connection.off('PaymentUpdate', handleUpdate);
      connection.off('table.stateChanged', handleUpdate);
    };
  }, [connection, fetchBookedTables]);

  // Sync with URL Params for Auto-Selection
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const floorParam = searchParams.get('floorName');
    const tableParam = searchParams.get('tableNumber');
    const seatsParam = searchParams.get('seatNumbers');

    // Only sync from URL if params are present. 
    // This prevents the useEffect from re-applying old values during a 'Cancel' transition.
    if (floorParam && tableParam) {
      setSelectedFloorName(floorParam);
      setCurrentTable(tableParam);

      if (seatsParam) {
        const seatList = seatsParam.split(',')
          .map(s => parseInt(s.trim()))
          .filter(s => !isNaN(s));
        if (seatList.length > 0) setSelectedSeats(seatList);
      } else if (selectedSeats.length === 0) {
        setSelectedSeats([1]);
      }
    } else {
      // CRITICAL FIX: If URL params are missing (e.g. after Cancel), clear local state.
      // This ensures the Cancel button works on the first click every time.
      setSelectedFloorName('');
      setCurrentTable('');
      setSelectedSeats([]);
    }
  }, [searchParams, selectedSeats.length]); // Watching both URL and local seat count for reliable syncing

  const checkActiveBooking = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        floorName: selectedFloorName,
        tableNumber: currentTable
      });
      const data = await getJson(`/api/booking/active-booking?${params}`);

      if (data && data.status && data.booking) {
        setActiveBooking(data.booking);

        // AUTOMATION: If we have floorName/tableNumber in searchParams, 
        // it means we came from TableBooking "Add Order".
        // Auto-link it if not already linked.
        const floorParam = searchParams.get('floorName');
        const tableParam = searchParams.get('tableNumber');
        if (floorParam && tableParam && !linkedBookingId) {
          setLinkedBookingId(data.booking.id);
          setApplyBookingCharge(true);
        }
      } else {
        setActiveBooking(null);
        setLinkedBookingId(null);
      }
    } catch (err) {
      console.error('Failed to check active booking:', err);
      setActiveBooking(null);
    }
  }, [selectedFloorName, currentTable, linkedBookingId, searchParams]);

  // Check for active booking when table is selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orderType === 'dine-in' && selectedFloorName && currentTable) {
      checkActiveBooking();
    } else {
      setActiveBooking(null);
      setApplyBookingCharge(false);
    }
  }, [orderType, selectedFloorName, currentTable, checkActiveBooking]);


  // Simplified to match MenuManagement exactly
  function getDiscountedPrice(item) {
    const now = new Date();

    // Filter individual discounts only (not combo offers)
    const activeDiscounts = discounts.filter(discount => {
      if (!discount.active) return false;
      if (discount.offerType === 'combo') return false; // Skip combo offers
      if (discount.startDate && new Date(discount.startDate) > now) return false;
      if (discount.endDate && new Date(discount.endDate) < now) return false;

      return discount.menuItems?.some(menuItem => menuItem.id === item.id);
    });

    if (activeDiscounts.length === 0) return null;

    const discount = activeDiscounts[0];
    const itemPrice = parseFloat(item.price);

    if (discount.discountType === 'percentage') {
      return itemPrice * (1 - discount.value / 100);
    } else if (discount.discountType === 'fixed') {
      return Math.max(0, itemPrice - discount.value);
    }

    return null;
  }

  function addToCart(item) {
    if (!item.isAvailable) {
      setError('This item is currently unavailable');
      return;
    }

    const discountedPrice = getDiscountedPrice(item);
    const finalPrice = discountedPrice !== null ? discountedPrice : parseFloat(item.price);

    // Check if an identical item (same menuItemId, same price, not a combo) is already in cart
    const existingIndex = cart.findIndex(
      c => c.menuItemId === item.id && !c.isComboItem && Math.abs(c.price - finalPrice) < 0.001
    );

    if (existingIndex !== -1) {
      // Merge: increment quantity of existing cart entry
      setCart(cart.map((c, idx) =>
        idx === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      // New entry
      const cartItem = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        menuItemId: item.id,
        name: item.name,
        originalPrice: parseFloat(item.price),
        price: finalPrice,
        quantity: 1,
        specialRequest: '',
        discountApplied: discountedPrice !== null
      };
      setCart([...cart, cartItem]);
    }
    setError('');
  }
  
  const isComboAvailable = useCallback((combo) => {
    if (!combo || !combo.menuItems) return false;
    return combo.menuItems.every(mi => {
      const fullItem = menuItems.find(m => m.id === mi.id);
      return fullItem ? fullItem.isAvailable : false;
    });
  }, [menuItems]);

  function addComboToCart(combo) {
    if (!isComboAvailable(combo)) {
      setError('One or more items in this combo are currently unavailable');
      return;
    }
    const comboId = `combo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const originalTotal = combo.menuItems?.reduce((sum, item) => sum + parseFloat(item.price), 0) || 0;
    let comboPrice = originalTotal;

    if (combo.discountType === 'percentage') {
      comboPrice = originalTotal * (1 - combo.value / 100);
    } else if (combo.discountType === 'fixed') {
      comboPrice = Math.max(0, originalTotal - combo.value);
    }

    // Add all items from combo to cart with combo identifier
    const comboItems = combo.menuItems.map((item, index) => ({
      id: `${comboId}-${index}`,
      menuItemId: item.id,
      name: item.name,
      originalPrice: parseFloat(item.price),
      price: index === 0 ? comboPrice : 0, // Apply full combo price to first item
      quantity: 1,
      specialRequest: '',
      comboId: comboId,
      comboName: combo.name,
      isComboItem: true,
      discountApplied: true
    }));

    setCart([...cart, ...comboItems]);
    setError('');
  }

  function updateQuantity(id, delta) {
    const itemToUpdate = cart.find(item => item.id === id);
    if (!itemToUpdate) return;

    if (itemToUpdate.isComboItem) {
      // Update quantity for all items in the same combo together
      setCart(cart.map(item => {
        if (item.comboId === itemToUpdate.comboId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }));
    } else {
      // Regular single item
      setCart(cart.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }));
    }
  }

  function removeFromCart(id) {
    const itemToRemove = cart.find(item => item.id === id);
    if (itemToRemove && itemToRemove.isComboItem) {
      // Remove the entire combo at once
      setCart(cart.filter(item => item.comboId !== itemToRemove.comboId));
    } else {
      setCart(cart.filter(item => item.id !== id));
    }
  }

  function updateSpecialRequest(id, request) {
    setCart(cart.map(item => {
      if (item.id === id) {
        return { ...item, specialRequest: request };
      }
      return item;
    }));
  }

  function calculateSubtotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Unused helper removed
  // function calculateBaseAmount() { ... }

  function calculateVAT() {
    const subtotal = calculateSubtotal();
    if (settings.vatIncluded) {
      const base = subtotal / (1 + (settings.vatPercentage / 100));
      return subtotal - base;
    } else {
      return subtotal * (settings.vatPercentage / 100);
    }
  }

  function calculateServiceCharge() {
    const subtotal = calculateSubtotal();
    if (settings.serviceChargeIncluded) {
      const base = subtotal / (1 + (settings.serviceChargePercentage / 100));
      return subtotal - base;
    } else {
      return subtotal * (settings.serviceChargePercentage / 100);
    }
  }

  function calculateBookingCharge(forceApply = false, previewData = null) {
    // Priority: Preview Data (used for modal displays)
    if (previewData) {
      const baseCharge = settings.tableBookingCharge || 0;
      const chargeType = settings.tableBookingChargeType || 'per_hour';
      const durationInMinutes = previewData.duration || 60;
      if (chargeType === 'per_hour') {
        return baseCharge * (durationInMinutes / 60);
      } else if (chargeType === 'per_minute') {
        return baseCharge * durationInMinutes;
      }
      return baseCharge;
    }

    // 1. Existing Active Booking (Linked named booking)
    if (activeBooking && (linkedBookingId === activeBooking.id) && (applyBookingCharge || forceApply)) {
      const baseCharge = settings.tableBookingCharge || 0;
      const chargeType = settings.tableBookingChargeType || 'per_hour';
      const duration = activeBooking.durationMinutes || 60;
      if (chargeType === 'per_hour') return baseCharge * (duration / 60);
      if (chargeType === 'per_minute') return baseCharge * duration;
      return baseCharge;
    }

    // 2. Named booking via isBooking flag
    if ((isBooking || forceApply) && orderType === 'dine-in') {
      const baseCharge = settings.tableBookingCharge || 0;
      const chargeType = settings.tableBookingChargeType || 'per_hour';
      if (chargeType === 'per_hour') {
        return baseCharge * (bookingDuration / 60);
      } else if (chargeType === 'per_minute') {
        return baseCharge * bookingDuration;
      }
      return baseCharge;
    }

    return 0;
  }

  function calculateTotal() {
    const subtotal = calculateSubtotal();
    let total = subtotal;

    if (!settings.vatIncluded) {
      total += calculateVAT();
    }

    if (!settings.serviceChargeIncluded) {
      total += calculateServiceCharge();
    }

    // Add booking charge
    total += calculateBookingCharge();

    return total;
  }

  async function placeOrder() {
    if (cart.length === 0 && calculateBookingCharge() === 0) {
      setError('Cart is empty. Please add items before placing an order.');
      return;
    }

    if (orderType === 'dine-in') {
      // Walk-in: seat selection is mandatory
      if (!isBooking && !activeBooking && !linkedBookingId && selectedSeats.length === 0 && currentTable) {
        setError('Please select at least one seat for the walk-in order.');
        return;
      }

      if (isBooking) {
        if (!customerName || !customerPhone) {
          setError('Customer name and phone are required for bookings');
          return;
        }
        if (!/^\d{10}$/.test(customerPhone.trim())) {
          setError('Phone number must be exactly 10 digits and contain only numbers.');
          return;
        }
      }
    }

    try {
      setLoading(true);
      setError('');

      // If linking to active booking, ensure we send the ID
      let existingBookingId = null;
      if (linkedBookingId) {
        existingBookingId = linkedBookingId;
      }

      // Convert duration to minutes for backend
      // Booking duration is already in minutes
      const durationInMinutes = bookingDuration;

      const orderData = {
        orderType: orderType,
        tableNumber: orderType === 'dine-in' && currentTable ? currentTable.trim() : null,
        // Booking & Seat Info
        floorName: selectedFloorName || null,
        seatNumbers: selectedSeats.length > 0 ? selectedSeats.map(Number) : [],
        isBooking: isBooking,
        customerName: isBooking ? customerName : null,
        customerPhone: isBooking ? customerPhone : null,
        bookingDurationMinutes: isBooking ? durationInMinutes : null,

        items: cart.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          specialRequest: item.specialRequest,
          price: item.price,
        })),
        subtotal: calculateSubtotal(),
        tax: calculateVAT(),
        serviceCharge: calculateServiceCharge(),
        bookingCharge: calculateBookingCharge(),
        total: calculateTotal(),
        existingBookingId: existingBookingId // New field for backend
      };

      const result = await postJson('/api/cashier/orders', orderData);

      setSuccess('Order placed successfully!');
      setCart([]);
      setCurrentTable('');
      setSelectedFloorName('');
      setSelectedSeats([]);
      setIsBooking(false);
      setCustomerName('');
      setCustomerPhone('');
      setBookingDuration(60);

      // Automatically navigate to payment page for the new order
      const newOrderId = result?.OrderId ?? result?.orderId ?? result?.id;
      if (newOrderId) {
        navigate(`/cashier?tab=payments&orderId=${newOrderId}`);
        return;
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }



  function clearCart() {
    setConfirmModal({
      show: true,
      title: 'Clear Cart',
      message: 'Are you sure you want to clear all items from the cart?',
      type: 'danger',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setCart([]);
        setCurrentTable('');
        setSelectedFloorName('');
        setSelectedSeats([]);
        setIsBooking(false);
        setCustomerName('');
        setCustomerPhone('');
        setBookingDuration(60);
      }
    });
  }

  // 1. Filter by search term first
  const searchedItems = useMemo(() => {
    let filtered = menuItems;
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = menuItems.filter(item =>
        item.name.toLowerCase().includes(lowerSearch) ||
        (item.category && item.category.toLowerCase().includes(lowerSearch))
      );
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [menuItems, searchTerm]);

  // 2. Group by category
  const { itemsByCategory } = useMemo(() => {
    const grouped = {};
    searchedItems.forEach(item => {
      const category = item.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    return { itemsByCategory: grouped };
  }, [searchedItems]);

  // Show all categories at once
  const visibleCategories = Object.keys(itemsByCategory).sort().filter(cat => activeCategory === 'All' || activeCategory === cat);

  const pagedVisibleCategories = visibleCategories;
  const pagedCategoryGroups = {};
  pagedVisibleCategories.forEach(cat => {
    pagedCategoryGroups[cat] = itemsByCategory[cat];
  });

  const resetMenuPage = () => {};

  // Get active combo offers
  const activeComboOffers = useMemo(() => {
    const now2 = new Date();
    return discounts.filter(discount => {
      if (!discount.active || discount.offerType !== 'combo') return false;
      if (discount.startDate && new Date(discount.startDate) > now2) return false;
      if (discount.endDate && new Date(discount.endDate) < now2) return false;
      return true;
    });
  }, [discounts]);

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

  // --- Table Selection Render Helper ---
  function renderTableSelection() {
    if (!bookingEnabled) return null;

    return (
      <div className="table-selector">

        {/* Booking Buttons (only when no active booking on selected table) */}
        {!activeBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {/* Named Booking */}
            <button
              onClick={() => { setModalError(''); setShowBookingModal(true); }}
              className="btn-create-booking"
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <FaGift /> Book with Name &amp; Number
            </button>
            {/* Quick Walk-in */}
            <button
              onClick={() => { setModalError(''); setShowQuickBookingModal(true); }}
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary)',
                border: '1.5px solid var(--color-primary)',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <FaUtensils /> Quick Walk-in (No Name)
            </button>
          </div>
        )}

        {/* Selected Table + Seat Badge */}
        {currentTable && (
          <div style={{
            padding: '0.5rem 0.75rem', marginBottom: '0.5rem',
            backgroundColor: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
            borderRadius: '0.5rem', fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: '600' }}>
              <span><FaUtensils style={{ marginRight: '0.4rem', color: 'var(--color-primary)' }} />{selectedFloorName} — Table {currentTable}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    setCurrentTable('');
                    setSelectedFloorName('');
                    setSelectedSeats([]);
                    setActiveBooking(null);
                    setSeatStatusData([]);
                    // Clear URL params to prevent auto-reselection by useEffect
                    navigate('/cashier?tab=orders', { replace: true });
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <FaTimes /> Cancel
                </button>
              </div>
            </div>
            {!isBooking && selectedSeats.length > 0 && (
              <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--color-primary-dark)' }}>
                Seats: {selectedSeats.slice().sort((a, b) => a - b).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Active Booking Alert & Link Logic */}
        {activeBooking && (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div className={`booking-alert-compact ${linkedBookingId === activeBooking.id ? 'linked' : ''}`}>
              <div className="booking-alert-header">
                <span className="booking-customer-name">
                  <FaShoppingBag style={{ fontSize: '0.8rem' }} /> {activeBooking.customerName}
                </span>
                {linkedBookingId === activeBooking.id ? (
                  <span className="linked-badge"><FaCheck /> Linked</span>
                ) : (
                  <button
                    className="link-booking-btn-small"
                    onClick={() => {
                      setLinkedBookingId(activeBooking.id);
                      setCustomerName(activeBooking.customerName);
                      setCustomerPhone(activeBooking.customerPhone);
                      setApplyBookingCharge(true);
                    }}
                  >
                    Link
                  </button>
                )}
              </div>

              {linkedBookingId === activeBooking.id && (
                <div className="booking-charge-mini-row">
                  <span>Booking Charge: NRP {calculateBookingCharge().toFixed(2)}</span>
                  <button className="unlink-btn-small" onClick={() => {
                    setLinkedBookingId(null);
                    setApplyBookingCharge(false);
                  }}>Unlink</button>
                </div>
              )}
            </div>

            {linkedBookingId === activeBooking.id && settings.tableBookingCharge > 0 && (
              <div className="booking-charge-status">
                {activeBooking.customerName && activeBooking.customerName !== 'Walk-in / Occupied' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--color-primary-dark)' }}>
                    <FaCheck style={{ color: '#059669' }} />
                    Charge Applied: NRP {calculateBookingCharge().toFixed(2)}
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={applyBookingCharge}
                      onChange={(e) => setApplyBookingCharge(e.target.checked)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Apply Booking Charge (+NRP {calculateBookingCharge(true).toFixed(2)})
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {!currentTable && !activeBooking && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingTop: '0.25rem' }}>
            Select a table inside a booking popup above.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cashier-order-taking">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaShoppingBag style={{ marginRight: '8px' }} /> Take Orders</h1>
          <p className="standard-page-subtitle">Create new dine-in or takeaway orders</p>
        </div>
        <div className="standard-page-header-actions">
          <div className="cashier-order-type-selector">
            <button
              className={`cashier-type-btn ${orderType === 'dine-in' ? 'active' : ''}`}
              onClick={() => { setOrderType('dine-in'); setCurrentTable(''); }}
            >
              <FaUtensils /> Dine-in
            </button>
            <button
              className={`cashier-type-btn ${orderType === 'takeaway' ? 'active' : ''}`}
              onClick={() => { setOrderType('takeaway'); setCurrentTable(''); }}
            >
              <FaShoppingBag /> Takeaway
            </button>
            <div className="vertical-divider" style={{ width: '1px', height: '20px', background: '#cbd5e1', alignSelf: 'center', margin: '0 0.25rem' }}></div>
          </div>
        </div>
      </header>

      {error && <div className="cashier-error-message">{error}</div>}
      {success && <div className="cashier-success-message">{success}</div>}

      <div className="cashier-order-layout">
        <div className="cashier-menu-section">
          <div className="cashier-menu-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>Menu Items</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="cashier-menu-search-wrapper">
                  <FaSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search menu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="cashier-menu-search-input"
                  />
                  {searchTerm && (
                    <button className="search-clear-btn" onClick={() => setSearchTerm('')}>✕</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.6rem', border: 'none', background: viewMode === 'grid' ? 'white' : 'transparent', borderRadius: '0.25rem', cursor: 'pointer', boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', color: viewMode === 'grid' ? 'var(--color-primary)' : '#64748b', transition: 'all 0.2s' }}
                    title="Grid View"
                  >
                    <FaThLarge />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.6rem', border: 'none', background: viewMode === 'list' ? 'white' : 'transparent', borderRadius: '0.25rem', cursor: 'pointer', boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', color: viewMode === 'list' ? 'var(--color-primary)' : '#64748b', transition: 'all 0.2s' }}
                    title="List View"
                  >
                    <FaList />
                  </button>
                </div>
              </div>
            </div>

            {!loading && (
              <div className="cashier-category-chips">
                <button
                  className={`cashier-chip ${activeCategory === 'All' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('All')}
                >
                  All
                </button>
                {activeComboOffers.length > 0 && (
                  <button
                    className={`cashier-chip ${activeCategory === 'Combo Offers' ? 'active' : ''}`}
                    onClick={() => { setActiveCategory('Combo Offers'); resetMenuPage(); }}
                  >
                    <FaGift /> Combos
                  </button>
                )}
                {Object.keys(itemsByCategory).sort().map(cat => (
                  <button
                    key={cat}
                    className={`cashier-chip ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => { setActiveCategory(cat); resetMenuPage(); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <MenuSkeleton />
          ) : (
            <div className="cashier-menu-categories">
              {(() => {
                const relevantCombos = activeCategory === 'All' || activeCategory === 'Combo Offers'
                  ? activeComboOffers
                  : activeComboOffers.filter(c => c.menuItems?.some(mi => {
                    const menuItem = menuItems.find(m => m.id === mi.id);
                    return menuItem && (menuItem.category === activeCategory);
                  }));

                if (relevantCombos.length > 0) {
                  return (
                    <div className="cashier-menu-group cashier-combo-group" style={{ marginBottom: '2rem' }}>
                      <div className={`cashier-menu-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
                        {relevantCombos.map(combo => {
                          const originalPrice = getComboOriginalPrice(combo);
                          const comboPrice = getComboPrice(combo);
                          const savings = originalPrice - comboPrice;
                          const isAvail = isComboAvailable(combo);
                          
                          return (
                            <div 
                              key={combo.id} 
                              className={`cashier-menu-item-card cashier-combo-card ${!isAvail ? 'unavailable' : ''}`} 
                              onClick={() => isAvail ? addComboToCart(combo) : undefined}
                              style={!isAvail ? { opacity: 0.6, cursor: 'not-allowed', filter: 'grayscale(100%)', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' } : {}}
                            >
                              <div className="cashier-menu-item-info">
                                <h4 style={!isAvail ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}>{combo.name}</h4>
                                {combo.description && (
                                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0', lineHeight: '1.3' }}>{combo.description}</p>
                                )}

                                <div className="cashier-combo-includes">
                                  <div className="cashier-combo-includes-title">
                                    <FaUtensils size={10} /> Includes
                                  </div>
                                  <div className="cashier-combo-items-list">
                                    {combo.menuItems?.map(item => {
                                      const fullItem = menuItems.find(m => m.id === item.id);
                                      const itemAvail = fullItem ? fullItem.isAvailable : false;
                                      return (
                                        <span 
                                          key={item.id} 
                                          className="cashier-combo-item-tag"
                                          style={!itemAvail ? { textDecoration: 'line-through', opacity: 0.7, background: '#f1f5f9', color: '#94a3b8' } : {}}
                                        >
                                          {item.name} {!itemAvail && '(Out)'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="cashier-price-container">
                                  <span className="cashier-menu-item-price-original" style={!isAvail ? { color: '#cbd5e1' } : {}}>NRP {originalPrice.toFixed(2)}</span>
                                  <span className="cashier-menu-item-price-discounted" style={!isAvail ? { color: '#94a3b8' } : {}}>NRP {comboPrice.toFixed(2)}</span>
                                </div>
                                {isAvail && (
                                  <div className="cashier-savings-badge">
                                    Save NRP {savings.toFixed(2)}
                                  </div>
                                )}
                              </div>
                              {isAvail && (
                                <div className="cashier-add-icon">
                                  <FaPlus />
                                </div>
                              )}
                              {!isAvail && (
                                <span className="cashier-discount-badge" style={{ backgroundColor: '#ef4444' }}>Sold Out</span>
                              )}
                              <span className="cashier-combo-badge">Combo</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {activeCategory === 'All' ? (
                <div className="cashier-menu-group">
                  <div className={`cashier-menu-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
                    {searchedItems.map(item => {
                      const discountedPrice = getDiscountedPrice(item);
                      const isAvail = item.isAvailable;
                      return (
                        <div
                          key={item.id}
                          className={`cashier-menu-item-card ${!isAvail ? 'unavailable' : ''}`}
                          onClick={() => isAvail ? addToCart(item) : undefined}
                          style={!isAvail ? { opacity: 0.6, cursor: 'not-allowed', filter: 'grayscale(100%)', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' } : {}}
                        >
                          <div className="cashier-menu-item-info">
                            <h4 style={!isAvail ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}>{item.name}</h4>
                            <div className="cashier-price-container">
                              {discountedPrice !== null ? (
                                <>
                                  <span className="cashier-menu-item-price-original" style={!isAvail ? { color: '#cbd5e1' } : {}}>NRP {parseFloat(item.price).toFixed(2)}</span>
                                  <span className="cashier-menu-item-price-discounted" style={!isAvail ? { color: '#94a3b8' } : {}}>NRP {discountedPrice.toFixed(2)}</span>
                                </>
                              ) : (
                                <span className="cashier-menu-item-price" style={!isAvail ? { color: '#94a3b8' } : {}}>NRP {parseFloat(item.price).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          {isAvail && (
                            <div className="cashier-add-icon">
                              <FaPlus />
                            </div>
                          )}
                          {!isAvail && (
                            <span className="cashier-discount-badge" style={{ backgroundColor: '#ef4444' }}>Unavailable</span>
                          )}
                          {isAvail && discountedPrice !== null && (
                            <span className="cashier-discount-badge">Discount</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                pagedVisibleCategories.map(category => (
                  <div key={category} className="cashier-menu-group">
                    <div className={`cashier-menu-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
                      {pagedCategoryGroups[category].map(item => {
                        const discountedPrice = getDiscountedPrice(item);
                        const isAvail = item.isAvailable;
                        return (
                          <div
                            key={item.id}
                            className={`cashier-menu-item-card ${!isAvail ? 'unavailable' : ''}`}
                            onClick={() => isAvail ? addToCart(item) : undefined}
                            style={!isAvail ? { opacity: 0.6, cursor: 'not-allowed', filter: 'grayscale(100%)', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' } : {}}
                          >
                            <div className="cashier-menu-item-info">
                              <h4 style={!isAvail ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}>{item.name}</h4>
                              <div className="cashier-price-container">
                                {discountedPrice !== null ? (
                                  <>
                                    <span className="cashier-menu-item-price-original" style={!isAvail ? { color: '#cbd5e1' } : {}}>NRP {parseFloat(item.price).toFixed(2)}</span>
                                    <span className="cashier-menu-item-price-discounted" style={!isAvail ? { color: '#94a3b8' } : {}}>NRP {discountedPrice.toFixed(2)}</span>
                                  </>
                                ) : (
                                  <span className="cashier-menu-item-price" style={!isAvail ? { color: '#94a3b8' } : {}}>NRP {parseFloat(item.price).toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                            {isAvail && (
                              <div className="cashier-add-icon">
                                <FaPlus />
                              </div>
                            )}
                            {!isAvail && (
                              <span className="cashier-discount-badge" style={{ backgroundColor: '#ef4444' }}>Unavailable</span>
                            )}
                            {isAvail && discountedPrice !== null && (
                              <span className="cashier-discount-badge">Discount</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}


            </div>
          )}
        </div>

        <div className={`cashier-cart-column ${isCartActive ? 'active' : ''}`}>
          <div className="cashier-cart-section">
            <div className="cashier-cart-header" onClick={() => setIsCartActive(!isCartActive)}>
              <div className="cashier-cart-header-top">
                <h3>Order Cart</h3>
                {cart.length > 0 && (
                  <button type="button" className="cashier-btn-clear" onClick={clearCart}>
                    Clear All
                  </button>
                )}
              </div>

              {orderType === 'dine-in' ? (
                <div className="cashier-cart-header-bottom">
                  {renderTableSelection()}
                </div>
              ) : (
                <div className="cashier-order-type-display">
                  <FaShoppingBag /> Takeaway Order
                </div>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="cashier-empty-cart">
                <p>Cart is empty. Click on menu items to add them.</p>
              </div>
            ) : (
              <>
                <div className="cashier-cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cashier-cart-item">
                      <div className="cashier-cart-item-header">
                        <div>
                          <h4>{item.name}</h4>
                          {item.isComboItem && <span style={{ fontSize: '0.75em', color: 'var(--color-warning-dark)', fontWeight: '600' }}>(Combo: {item.comboName})</span>}
                        </div>
                        <button
                          className="cashier-btn-remove"
                          onClick={() => removeFromCart(item.id)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="cashier-cart-item-details">
                        <div className="cashier-quantity-control">
                          <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                        </div>
                        <div className="cashier-item-price-info">
                          <span className="cashier-item-price">NRP {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="cashier-special-request">
                        <input
                          type="text"
                          placeholder="Special request"
                          value={item.specialRequest}
                          onChange={e => updateSpecialRequest(item.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cashier-cart-summary">
                  <div className="cashier-summary-row">
                    <span>Subtotal:</span>
                    <span>NRP {calculateSubtotal().toFixed(2)}</span>
                  </div>

                  {settings.vatIncluded ? (
                    <div className="cashier-summary-row" style={{ fontStyle: 'italic', fontSize: '0.9em', color: '#666' }}>
                      <span>(Includes VAT {settings.vatPercentage}%)</span>
                      <span>NRP {calculateVAT().toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="cashier-summary-row">
                      <span>VAT ({settings.vatPercentage}%):</span>
                      <span>NRP {calculateVAT().toFixed(2)}</span>
                    </div>
                  )}

                  {settings.serviceChargeIncluded ? (
                    <div className="cashier-summary-row" style={{ fontStyle: 'italic', fontSize: '0.9em', color: '#666' }}>
                      <span>(Includes Service Charge {settings.serviceChargePercentage}%)</span>
                      <span>NRP {calculateServiceCharge().toFixed(2)}</span>
                    </div>
                  ) : settings.serviceChargePercentage > 0 && (
                    <div className="cashier-summary-row">
                      <span>Service Charge ({settings.serviceChargePercentage}%):</span>
                      <span>NRP {calculateServiceCharge().toFixed(2)}</span>
                    </div>
                  )}

                  {calculateBookingCharge() > 0 && (
                    <div className="cashier-summary-row" style={{ color: '#0369a1', fontWeight: '500' }}>
                      <span>Table Booking Charge:</span>
                      <span>NRP {calculateBookingCharge().toFixed(2)}</span>
                    </div>
                  )}

                  <div className="cashier-summary-row total">
                    <span>Total:</span>
                    <span>NRP {calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            className="cashier-btn-place-order"
            onClick={placeOrder}
            disabled={loading || (cart.length === 0 && calculateBookingCharge() === 0)}
          >
            {loading ? 'Processing...' : (cart.length === 0 && calculateBookingCharge() > 0 ? 'Add Booking Charge' : 'Place Order')}
          </button>
        </div>
      </div>

      <Modal
        isOpen={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />

      {/* Named Booking Modal (with Name & Phone + Table Selection) */}
      <Modal
        isOpen={showBookingModal}
        title="Book Table — With Customer Details"
        message={
          <div className="ot-booking-modal-content">
            {modalError && (
              <div className="mm-modal-alert mm-modal-alert--error" style={{ margin: 0 }}>{modalError}</div>
            )}

            <div className="ot-banner-info">
              <FaInfoCircle />
              <div><strong>Named Booking:</strong> A booking charge will be mandatory once the booking is active.</div>
            </div>

            {/* Customer Details */}
            <div className="ot-modal-section">
              <label className="ot-modal-section-title">Customer Details</label>
              <div className="ot-form-grid">
                <div className="ot-form-group">
                  <label>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="ot-form-input"
                  />
                </div>
                <div className="ot-form-group">
                  <label>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={customerPhone}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setCustomerPhone(value);
                    }}
                    className="ot-form-input"
                  />
                </div>
              </div>
            </div>

            {/* Area Selection */}
            <div className="ot-modal-section">
              <label className="ot-modal-section-title">Select Area</label>
              <div className="ot-floor-chips">
                {tableConfig.floors.map(floor => (
                  <button
                    key={floor.id}
                    type="button"
                    className={`ot-floor-chip ${selectedFloorName === floor.name ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedFloorName(floor.name);
                      setCurrentTable('');
                      setSelectedSeats([]);
                    }}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Selection Grid */}
            {selectedFloorName && (
              <div className="ot-modal-section">
                <label className="ot-modal-section-title">Select Table</label>
                <div className="ot-table-grid">
                  {(() => {
                    const floor = tableConfig.floors.find(f => f.name === selectedFloorName);
                    const tableList = floor ? Array.from({ length: floor.tableCount }, (_, i) => (i + 1).toString()) : [];
                    return tableList.map(t => {
                      const isBooked = bookedTables.includes(`${selectedFloorName}-${t}`);
                      const isSelected = currentTable === t;
                      
                      return (
                        <div
                          key={t}
                          className={`ot-table-item ${isSelected ? 'is-selected' : ''} ${isBooked ? 'is-booked' : ''}`}
                          onClick={() => {
                            if (!isBooked) {
                              setCurrentTable(t);
                              setSelectedSeats([]);
                            }
                          }}
                        >
                          <div className="ot-table-number">T-{t}</div>
                          {isBooked && <div className="ot-booked-badge">BOOKED</div>}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Seat Selection */}
            {currentTable && selectedFloorName && (
              <div className="ot-modal-section">
                <label className="ot-modal-section-title">Select Seats (Optional)</label>
                <div className="ot-seats-wrap">
                  {(() => {
                    const floor = tableConfig.floors.find(f => f.name === selectedFloorName);
                    let maxSeats = floor ? floor.seats : 0;
                    if (floor?.customSeats?.[currentTable]) {
                      maxSeats = parseInt(floor.customSeats[currentTable]);
                    }
                    return Array.from({ length: maxSeats }, (_, i) => i + 1).map(seatNum => {
                      const isSel = selectedSeats.includes(seatNum);
                      return (
                        <button
                          key={seatNum}
                          type="button"
                          className={`ot-seat-btn ${isSel ? 'active' : ''}`}
                          onClick={() => {
                            if (isSel) setSelectedSeats(prev => prev.filter(s => s !== seatNum));
                            else setSelectedSeats(prev => [...prev, seatNum]);
                          }}
                        >
                          {seatNum}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Booking Options */}
            <div className="ot-modal-section">
              <label className="ot-modal-section-title">Booking Options</label>
              <div className="ot-form-grid">
                <div className="ot-form-group">
                  <label>Duration</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                      <input
                        type="number"
                        min="0"
                        value={Math.floor(bookingDuration / 60)}
                        onChange={e => {
                          const h = parseInt(e.target.value) || 0;
                          const m = bookingDuration % 60;
                          setBookingDuration((h * 60) + m);
                        }}
                        className="ot-form-input"
                        placeholder="Hrs"
                        style={{ width: '100%' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>h</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={bookingDuration % 60}
                        onChange={e => {
                          const m = parseInt(e.target.value) || 0;
                          const h = Math.floor(bookingDuration / 60);
                          setBookingDuration((h * 60) + m);
                        }}
                        className="ot-form-input"
                        placeholder="Min"
                        style={{ width: '100%' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>m</span>
                    </div>
                  </div>
                </div>
                <div className="ot-form-group">
                  <label>Summary</label>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <strong>Table:</strong> {selectedFloorName || '-'} / T-{currentTable || '-'}
                    </div>
                    {settings.tableBookingCharge > 0 && (
                      <div style={{ color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Charge: NRP {calculateBookingCharge(false, { duration: bookingDuration }).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        type="primary"
        size="large"
        onConfirm={() => {
          if (!customerName || !customerPhone) {
            setModalError('Customer name and phone number are required for a named booking.');
            return;
          }
          if (!/^\d{10}$/.test(customerPhone.trim())) {
            setModalError('Phone number must be exactly 10 digits.');
            return;
          }
          if (!currentTable) {
            setModalError('Please select a table.');
            return;
          }
          setModalError('');
          setIsBooking(true);
          setApplyBookingCharge(true);
          setShowBookingModal(false);
        }}
        onCancel={() => {
          setShowBookingModal(false);
          // Don't clear selections here unless they are just starting
        }}
      />

      {/* Quick Walk-in Booking Modal — Seat-level, no name/phone/duration */}
      <Modal
        isOpen={showQuickBookingModal}
        title="Quick Walk-in — Select Seats"
        message={
          <div className="ot-booking-modal-content">
            {modalError && (
              <div className="mm-modal-alert mm-modal-alert--error" style={{ margin: 0 }}>{modalError}</div>
            )}

            <div className="ot-banner-info">
              <FaInfoCircle />
              <div>Select the specific seats this customer will occupy. Each seat-group gets its own order and bill.</div>
            </div>

            {/* Area Selection */}
            <div className="ot-modal-section">
              <label className="ot-modal-section-title">Select Area</label>
              <div className="ot-floor-chips">
                {tableConfig.floors.map(floor => (
                  <button
                    key={floor.id}
                    type="button"
                    className={`ot-floor-chip ${selectedFloorName === floor.name ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedFloorName(floor.name);
                      setCurrentTable('');
                      setSelectedSeats([]);
                      setSeatStatusData([]);
                    }}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Selection Grid */}
            {selectedFloorName && (
              <div className="ot-modal-section">
                <label className="ot-modal-section-title">Select Table</label>
                <div className="ot-table-grid">
                  {(() => {
                    const floor = tableConfig.floors.find(f => f.name === selectedFloorName);
                    const tableList = floor ? Array.from({ length: floor.tableCount }, (_, i) => (i + 1).toString()) : [];
                    return tableList.map(t => {
                      const isBooked = bookedTables.includes(`${selectedFloorName}-${t}`);
                      const isSelected = currentTable === t;
                      return (
                        <div
                          key={t}
                          className={`ot-table-item ${isSelected ? 'is-selected' : ''} ${isBooked ? 'is-booked' : ''}`}
                          onClick={async () => {
                            setCurrentTable(t);
                            setSelectedSeats([]);
                            try {
                              setSeatStatusLoading(true);
                              const data = await getJson(`/api/booking/seat-status?floorName=${encodeURIComponent(selectedFloorName)}&tableNumber=${t}`);
                              if (data && data.status) setSeatStatusData(data.seats || []);
                              else setSeatStatusData([]);
                            } catch { setSeatStatusData([]); }
                            finally { setSeatStatusLoading(false); }
                          }}
                        >
                          <div className="ot-table-number">T-{t}</div>
                          {isBooked && <div className="ot-booked-badge">BOOKED</div>}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Seat selection */}
            {currentTable && selectedFloorName && (
              <div className="ot-modal-section">
                <label className="ot-modal-section-title">
                  Select Seats <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                </label>
                {seatStatusLoading ? (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', padding: '1rem', textAlign: 'center' }}>Loading seat status...</div>
                ) : (
                  <div className="ot-seats-wrap">
                    {(() => {
                      const floor = tableConfig.floors.find(f => f.name === selectedFloorName);
                      let maxSeats = floor ? floor.seats : 0;
                      if (floor?.customSeats?.[currentTable]) maxSeats = parseInt(floor.customSeats[currentTable]);
                      return Array.from({ length: maxSeats }, (_, i) => i + 1).map(seatNum => {
                        const statusEntry = seatStatusData.find(s => s.seatNumber === seatNum);
                        const isOccupied = statusEntry && statusEntry.status !== 'Available';
                        const isSel = selectedSeats.includes(seatNum);
                        
                        return (
                          <button
                            key={seatNum}
                            type="button"
                            className={`ot-seat-btn ${isSel ? 'active' : ''} ${isOccupied ? 'is-occupied' : ''}`}
                            onClick={() => {
                              if (isSel) setSelectedSeats(prev => prev.filter(s => s !== seatNum));
                              else setSelectedSeats(prev => [...prev, seatNum]);
                            }}
                            title={isOccupied ? `Seat ${seatNum}: ${statusEntry?.status}` : `Seat ${seatNum}`}
                            style={{
                              position: 'relative',
                              ...(isOccupied && !isSel ? { background: '#fef3c7', borderColor: '#fde68a', color: '#d97706' } : {})
                            }}
                          >
                            {seatNum}
                            {isOccupied && !isSel && (
                              <span style={{ position: 'absolute', bottom: '2px', left: 0, right: 0, fontSize: '7px', color: '#d97706', fontWeight: '800', textTransform: 'uppercase' }}>Busy</span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
                {selectedSeats.length > 0 && (
                  <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '700' }}>
                    Selected: {selectedSeats.length} seat(s) ({selectedSeats.slice().sort((a,b)=>a-b).join(', ')})
                  </div>
                )}
              </div>
            )}
          </div>
        }
        type="primary"
        size="large"
        onConfirm={() => {
          if (!currentTable) { setModalError('Please select a table.'); return; }
          if (selectedSeats.length === 0) { setModalError('Please select at least one seat.'); return; }
          setModalError('');
          // Walk-in: NOT a booking — seats are reserved via the order itself
          setCustomerName('');
          setCustomerPhone('');
          setIsBooking(false);
          setApplyBookingCharge(false);
          setShowQuickBookingModal(false);
        }}
        onCancel={() => { setShowQuickBookingModal(false); setSeatStatusData([]); }}
      />
    </div>
  );
}
