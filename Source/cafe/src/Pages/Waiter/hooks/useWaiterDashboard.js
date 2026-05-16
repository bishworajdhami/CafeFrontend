import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { deleteJson, getJson, postJson, putJson, uploadFile } from '../../../utils/api';
import { useSocket } from '../../../SocketContext';

export default function useWaiterDashboard() {
  const { connection, isConnected } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tableConfig, setTableConfig] = useState({ floors: [] });
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [tableStates, setTableStates] = useState([]);
  const [currentBookings, setCurrentBookings] = useState([]);
  const [activeFloor, setActiveFloor] = useState(0);

  const [settings, setSettings] = useState({});

  const [userName, setUserName] = useState(localStorage.getItem('name') || localStorage.getItem('userName') || 'Waiter');
  const userRole = localStorage.getItem('role') || localStorage.getItem('userRole') || 'Waiter';
  const [profilePictureUrl, setProfilePictureUrl] = useState(localStorage.getItem('profilePictureUrl') || '');
  const [newName, setNewName] = useState(userName);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [menuInfoModalOpen, setMenuInfoModalOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  const fileInputRef = useRef(null);

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);

  const [view, setView] = useState(() => searchParams.get('view') || 'tables');

  useEffect(() => {
    setSearchParams(prev => {
      prev.set('view', view);
      return prev;
    }, { replace: true });
  }, [view, setSearchParams]);

  const [alerts, setAlerts] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const recentlyAlertedOrdersRef = useRef(new Map());

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingForm, setBookingForm] = useState({
    customerName: '',
    customerPhone: '',
    partySize: 2,
    startTime: '',
    durationMinutes: 60
  });

  const [linkedBookingId, setLinkedBookingId] = useState(null);
  const [applyBookingCharge, setApplyBookingCharge] = useState(false);
  const [seatStatusData, setSeatStatusData] = useState([]);
  const [selectedWalkInSeats, setSelectedWalkInSeats] = useState([]);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: null
  });

  const playNotificationSound = async () => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      if (ctx.state === 'suspended') await ctx.resume();

      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(880, ctx.currentTime);
      g1.gain.setValueAtTime(0.001, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o1.connect(g1);
      g1.connect(ctx.destination);
      o1.start();
      o1.stop(ctx.currentTime + 0.23);

      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
      g2.gain.setValueAtTime(0.001, ctx.currentTime + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.16);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start(ctx.currentTime + 0.12);
      o2.stop(ctx.currentTime + 0.36);
    } catch {
      // Audio is non-critical for the waiter workflow.
    }
  };

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchTableStatus, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'orders') {
      fetchActiveOrders();
      const interval = setInterval(fetchActiveOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [view]);

  useEffect(() => {
    if (!connection) return;

    const pushReadyAlert = (order) => {
      const orderId = order.orderId || order.id;
      if (!orderId) return;

      const now = Date.now();
      const lastAlertAt = recentlyAlertedOrdersRef.current.get(orderId);
      if (lastAlertAt && now - lastAlertAt < 15000) return;
      recentlyAlertedOrdersRef.current.set(orderId, now);

      const newAlert = {
        id: Date.now() + Math.random().toString(36),
        orderId,
        table: order.tableNumber || 'Takeaway',
        floor: order.floorName || '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setAlerts(prev => [newAlert, ...prev]);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      playNotificationSound();
    };

    const handleUpdate = async () => {
      fetchTableStatus();
      if (view === 'orders') fetchActiveOrders();
    };

    connection.on('OrderUpdated', handleUpdate);
    connection.on('NewOrder', handleUpdate);
    connection.on('order.created', handleUpdate);
    connection.on('order.statusChanged', handleUpdate);
    connection.on('order.ready', (payload) => {
      fetchTableStatus();
      if (view === 'orders') fetchActiveOrders();
      pushReadyAlert(payload || {});
    });
    connection.on('table.stateChanged', fetchTableStatus);
    connection.on('MenuUpdate', fetchMenu);

    return () => {
      connection.off('OrderUpdated', handleUpdate);
      connection.off('NewOrder', handleUpdate);
      connection.off('order.created', handleUpdate);
      connection.off('order.statusChanged', handleUpdate);
      connection.off('order.ready');
      connection.off('table.stateChanged', fetchTableStatus);
      connection.off('MenuUpdate', fetchMenu);
    };
  }, [connection, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const settingsData = await getJson('/api/manager/settings');
      setSettings(settingsData);

      let config = settingsData.tableConfiguration || settingsData.TableConfiguration;
      if (typeof config === 'string') config = JSON.parse(config);
      setTableConfig(config || { floors: [] });

      await fetchMenu();
      await fetchTableStatus();
    } catch (err) {
      console.error('Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const items = await getJson('/api/cashier/menu');
      setMenuItems(items);
      const cats = ['All', ...new Set(items.map(i => i.category).filter(Boolean))];
      setCategories(cats);
    } catch (err) {
      console.error('Failed to sync menu:', err);
    }
  };

  const fetchTableStatus = async () => {
    try {
      const data = await getJson('/api/booking/current');
      if (data.status) {
        setOccupiedSeats(data.occupiedSeats || []);
        setTableStates(data.tableStates || []);
        setCurrentBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Failed to sync table status:', err);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const orders = await getJson('/api/cashier/orders/pending');
      setActiveOrders(orders);
    } catch (err) {
      console.error('Failed to load active orders', err);
    }
  };

  const calculateSubtotal = () => cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const calculateVAT = () => {
    const subtotal = calculateSubtotal();
    const rate = (settings.vatPercentage || 0) / 100;
    if (settings.vatIncluded) return subtotal - (subtotal / (1 + rate));
    return subtotal * rate;
  };

  const calculateServiceCharge = () => {
    const subtotal = calculateSubtotal();
    const rate = (settings.serviceChargePercentage || 0) / 100;
    if (settings.serviceChargeIncluded) return subtotal - (subtotal / (1 + rate));
    return subtotal * rate;
  };

  const calculateBookingCharge = () => {
    const baseCharge = settings.tableBookingCharge || 0;
    const chargeType = settings.tableBookingChargeType || 'per_hour';

    const existingBooking = getActiveOrUpcomingBookingForTable(selectedTable?.floor, selectedTable?.table);

    if (existingBooking && linkedBookingId === existingBooking.id && applyBookingCharge) {
      const duration = existingBooking.durationMinutes || 60;
      if (chargeType === 'per_hour') return baseCharge * (duration / 60);
      if (chargeType === 'per_minute') return baseCharge * duration;
      return baseCharge;
    }

    return 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let total = subtotal;
    if (!settings.vatIncluded) total += calculateVAT();
    if (!settings.serviceChargeIncluded) total += calculateServiceCharge();
    total += calculateBookingCharge();
    return total;
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0 && calculateBookingCharge() === 0) return;

    setLoading(true);
    try {
      const floorConfig = tableConfig.floors?.find(f => f.name === selectedTable.floor);
      const totalSeats = floorConfig?.customSeats?.[selectedTable.table.toString()]
        ? parseInt(floorConfig.customSeats[selectedTable.table.toString()])
        : (parseInt(floorConfig?.seats) || 4);

      const existingBooking = getActiveOrUpcomingBookingForTable(selectedTable.floor, selectedTable.table);
      const seatNumbers = existingBooking
        ? Array.from({ length: totalSeats }, (_, i) => i + 1)
        : selectedWalkInSeats.length > 0
          ? selectedWalkInSeats
          : [1];

      const orderData = {
        orderType: 'dine-in',
        tableNumber: selectedTable.table.toString(),
        floorName: selectedTable.floor,
        seatNumbers,
        isBooking: false,
        customerName: null,
        customerPhone: null,
        bookingDurationMinutes: null,
        existingBookingId: linkedBookingId || null,
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal: calculateSubtotal(),
        tax: calculateVAT(),
        serviceCharge: calculateServiceCharge(),
        bookingCharge: calculateBookingCharge(),
        total: calculateTotal()
      };

      await postJson('/api/cashier/orders', orderData);
      setCart([]);
      setView('tables');
      fetchTableStatus();

      if ('vibrate' in navigator) navigator.vibrate([50]);
    } catch (err) {
      setConfirmModal({
        show: true,
        title: 'Order Failed',
        message: 'Failed to place order: ' + err.message,
        type: 'danger',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
      });
    } finally {
      setLoading(false);
    }
  };

  const getTableStatus = (floorName, tableNumber) => {
    const canonical = tableStates.find(
      t => t.floorName === floorName && t.tableNumber === tableNumber.toString()
    );
    if (canonical?.status) return canonical.status;

    const seats = occupiedSeats.filter(s => s.floorName === floorName && s.tableNumber === tableNumber.toString());
    if (seats.length === 0) return 'available';
    if (seats.some(s => s.status === 'Occupied')) return 'occupied';
    if (seats.some(s => s.status === 'Reserved')) return 'reserved';
    return 'available';
  };

  const getActiveOrUpcomingBookingForTable = (floorName, tableNumber) => {
    if (!floorName || !tableNumber) return null;

    const now = new Date();
    const tableNumberString = tableNumber.toString();
    const candidates = (currentBookings || []).filter(
      b => b.floorName === floorName && b.tableNumber === tableNumberString && (b.status === 'Active' || b.status === 'Reserved')
    );
    if (candidates.length === 0) return null;

    const valid = candidates
      .filter(b => !b.endTime || new Date(b.endTime) > now)
      .sort((a, b) => new Date(a.endTime || a.startTime) - new Date(b.endTime || b.startTime));
    return valid[0] || candidates[0];
  };

  const formatTimeShort = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openBookingForTable = (floorName, tableNumber) => {
    const floor = tableConfig.floors?.find(f => f.name === floorName);
    const tableSeats = floor?.customSeats?.[tableNumber.toString()] !== undefined
      ? parseInt(floor.customSeats[tableNumber.toString()])
      : (parseInt(floor?.seats) || 4);

    const localMin = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setBookingError('');
    setBookingForm({
      customerName: '',
      customerPhone: '',
      partySize: tableSeats,
      startTime: localMin,
      durationMinutes: 60
    });
    setSelectedTable({ floor: floorName, table: tableNumber });
    setBookingModalOpen(true);
  };

  const createBooking = async () => {
    if (!selectedTable?.floor || !selectedTable?.table) return;
    const name = bookingForm.customerName.trim();
    const phone = bookingForm.customerPhone.trim();
    if (!name) return setBookingError('Customer name is required.');
    if (!/^\d{10}$/.test(phone)) return setBookingError('Phone number must be exactly 10 digits.');

    const partySize = Number(bookingForm.partySize) || 1;
    if (partySize < 1) return setBookingError('Guests must be at least 1.');
    if (!bookingForm.startTime) return setBookingError('Start time is required.');

    const durationMinutes = Number(bookingForm.durationMinutes) || 60;

    if (durationMinutes < 15) return setBookingError('Minimum duration is 15 minutes.');

    try {
      setBookingSubmitting(true);
      setBookingError('');
      const response = await postJson('/api/booking/reserve', {
        customerName: name,
        customerPhone: phone,
        floorName: selectedTable.floor,
        tableNumber: selectedTable.table.toString(),
        partySize,
        startTime: new Date(bookingForm.startTime).toISOString(),
        durationMinutes
      });
      setBookingModalOpen(false);

      setLinkedBookingId(response.bookingId || response.id || null);
      setApplyBookingCharge(true);

      await fetchTableStatus();
      playNotificationSound();
    } catch (err) {
      setBookingError(err.message || 'Failed to create booking.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('profilePictureUrl');
    localStorage.removeItem('permissions');
    window.location.href = '/';
  };

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await uploadFile('/api/auth/upload-profile-picture', file);
      if (data && data.status) {
        setProfilePictureUrl(data.url);
        localStorage.setItem('profilePictureUrl', data.url);
      } else {
        setConfirmModal({
          show: true,
          title: 'Upload Failed',
          message: data?.message || 'Failed to upload profile picture',
          type: 'danger',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setConfirmModal({
        show: true,
        title: 'Error',
        message: 'Error uploading profile picture',
        type: 'danger',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteProfilePicture = async () => {
    setConfirmModal({
      show: true,
      title: 'Remove Profile Picture',
      message: 'Are you sure you want to remove your profile picture?',
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        try {
          const data = await deleteJson('/api/auth/delete-profile-picture');
          if (data && data.status) {
            setProfilePictureUrl('');
            localStorage.removeItem('profilePictureUrl');
          } else {
            setConfirmModal({
              show: true,
              title: 'Error',
              message: data?.message || 'Failed to remove profile picture',
              type: 'danger',
              onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
            });
          }
        } catch (err) {
          console.error('Delete error:', err);
          setConfirmModal({
            show: true,
            title: 'Error',
            message: 'Error removing profile picture',
            type: 'danger',
            onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleNameUpdate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const response = await putJson('/api/auth/profile', { name: newName.trim() });
      if (response && (response.status === true || response.Status === true)) {
        setUserName(newName.trim());
        localStorage.setItem('name', newName.trim());
      } else {
        setConfirmModal({
          show: true,
          title: 'Update Failed',
          message: response?.message || 'Failed to update name',
          type: 'danger',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
        });
      }
    } catch (err) {
      console.error('Name update error:', err);
      setConfirmModal({
        show: true,
        title: 'Error',
        message: 'Error updating name',
        type: 'danger',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    setPasswordSubmitting(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      const response = await postJson('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      if (response && (response.status === true || response.Status === true)) {
        setPasswordSuccess('Password updated successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(response?.message || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError(err.message || 'Error updating password');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleTableClick = async (floorName, tableNumber) => {
    setSelectedTable({ floor: floorName, table: tableNumber });
    setCart([]);
    setSeatStatusData([]);
    setSelectedWalkInSeats([]);

    const existingBooking = getActiveOrUpcomingBookingForTable(floorName, tableNumber);
    if (existingBooking) {
      setLinkedBookingId(existingBooking.id);
      setApplyBookingCharge(true);
      setView('menu');
    } else {
      try {
        const data = await getJson(`/api/booking/seat-status?floorName=${encodeURIComponent(floorName)}&tableNumber=${tableNumber}`);
        if (data && data.status) setSeatStatusData(data.seats || []);
      } catch {
        setSeatStatusData([]);
      }
      setLinkedBookingId(null);
      setApplyBookingCharge(false);
      setView('seats');
    }
  };

  const addToCart = (item) => {
    if (!item.isAvailable) {
      setConfirmModal({
        show: true,
        title: 'Item Unavailable',
        message: `${item.name} is currently sold out.`,
        type: 'warning',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
      });
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate(20);
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    if ('vibrate' in navigator) navigator.vibrate(20);
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const clearCart = () => {
    if ('vibrate' in navigator) navigator.vibrate([30, 30]);
    setCart([]);
  };

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const currentFloor = tableConfig.floors[activeFloor];
  const filteredMenuItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(i => i.category === selectedCategory);

  return {
    activeFloor,
    activeOrders,
    addToCart,
    alerts,
    applyBookingCharge,
    bookingError,
    bookingForm,
    bookingModalOpen,
    bookingSubmitting,
    calculateBookingCharge,
    calculateTotal,
    cart,
    categories,
    confirmModal,
    createBooking,
    currentFloor,
    dismissAlert,
    fileInputRef,
    filteredMenuItems,
    formatTimeShort,
    getActiveOrUpcomingBookingForTable,
    getTableStatus,
    handleDeleteProfilePicture,
    handleLogout,
    handleNameUpdate,
    handlePasswordUpdate,
    handlePlaceOrder,
    handleProfilePictureUpload,
    handleTableClick,
    isConnected,
    linkedBookingId,
    loading,
    menuInfoModalOpen,
    menuItems,
    menuSearchQuery,
    newName,
    openBookingForTable,
    passwordError,
    passwordForm,
    passwordSubmitting,
    passwordSuccess,
    profileModalOpen,
    profilePictureUrl,
    removeFromCart,
    selectedCategory,
    selectedTable,
    selectedWalkInSeats,
    setActiveFloor,
    setApplyBookingCharge,
    setBookingForm,
    setBookingModalOpen,
    setConfirmModal,
    setLinkedBookingId,
    setMenuInfoModalOpen,
    setMenuSearchQuery,
    setNewName,
    setPasswordForm,
    setProfileModalOpen,
    setSelectedCategory,
    setSelectedWalkInSeats,
    setView,
    settings,
    tableConfig,
    userName,
    userRole,
    view,
    seatStatusData,
    clearCart
  };
}
