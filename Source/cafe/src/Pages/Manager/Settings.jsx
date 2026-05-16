import { useState, useEffect, useCallback } from 'react';
import { FaCog, FaCogs, FaExclamationTriangle, FaCheck, FaMobileAlt, FaMoneyBillWave, FaArrowLeft, FaTable, FaSave } from 'react-icons/fa';
import { getJson, putJson, postJson, uploadFile, getImageUrl } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './Settings.css';

import GeneralTab from './settings/GeneralTab';
import TablesTab from './settings/TablesTab';
import CashDrawerTab from './settings/CashDrawerTab';
import QRPaymentTab from './settings/QRPaymentTab';
import DataManagementTab from './settings/DataManagementTab';

// Module-level caches for instant loading
let cachedSettings = null;

function preloadImages(urls) {
  if (!urls || !urls.length) return;
  urls.forEach(url => {
    if (!url) return;
    const img = new Image();
    img.src = getImageUrl(url);
  });
}

export default function Settings() {
  const { socketRef } = useSocket();
  // General & System Settings
  const [vatPercentage, setVatPercentage] = useState(13);
  const [vatIncluded, setVatIncluded] = useState(false);
  const [serviceChargePercentage, setServiceChargePercentage] = useState(0);
  const [serviceChargeIncluded, setServiceChargeIncluded] = useState(false);
  const [showRefundTab, setShowRefundTab] = useState(true);
  const [payFirst, setPayFirst] = useState(false);
  const [cafeName, setCafeName] = useState('Cafe');
  const [cafeAddress, setCafeAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [cafePan, setCafePan] = useState('');
  const [cafeLogo, setCafeLogo] = useState(null);

  // Table Management
  const [tableConfiguration, setTableConfiguration] = useState({ floors: [] });
  // Example structure: { floors: [ { id: 1, name: "Ground Floor", tableCount: 5, seats: 4 } ] }
  const [enableManualTableSelection, setEnableManualTableSelection] = useState(true);
  const [enableTableBooking, setEnableTableBooking] = useState(true);
  const [tableBookingCharge, setTableBookingCharge] = useState(100);
  const [tableBookingChargeType, setTableBookingChargeType] = useState('per_hour');

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'esewa', name: 'eSewa', enabled: false, qrCodeImage: null },
    { id: 'khalti', name: 'Khalti', enabled: false, qrCodeImage: null },
    { id: 'fonepay', name: 'FonePay', enabled: false, qrCodeImage: null },
    { id: 'imepay', name: 'IME Pay', enabled: false, qrCodeImage: null },
    { id: 'connectips', name: 'ConnectIPS', enabled: false, qrCodeImage: null }
  ]);
  const [paymentMethodsLoaded, setPaymentMethodsLoaded] = useState(false);





  // UI State
  const [activeTab, setActiveTab] = useState(null); // null, 'general', 'tables', 'categories', 'password', 'cashBalance', 'paymentMethods', 'dataManagement'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Seat Configuration Modal State
  const [seatConfigModal, setSeatConfigModal] = useState({
    show: false,
    floorIndex: null,
    floorName: '',
    seats: {} // Map of tableNumber -> seats
  });

  const applySettingsData = useCallback((data) => {
    setVatPercentage(data.vatPercentage ?? data.VatPercentage ?? 13);
    setVatIncluded(data.vatIncluded ?? data.VatIncluded ?? false);
    setServiceChargePercentage(data.serviceChargePercentage ?? data.ServiceChargePercentage ?? 0);
    setServiceChargeIncluded(data.serviceChargeIncluded ?? data.ServiceChargeIncluded ?? false);
    setShowRefundTab(data.showRefundTab ?? data.ShowRefundTab ?? true);

    const toBool = (val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val === true || val === 1;
    };
    setPayFirst(toBool(data.payFirst ?? data.PayFirst ?? false));

    // Parse table config if it's a string, or use directly if object
    let tableConfigVal = data.tableConfiguration ?? data.TableConfiguration;
    if (typeof tableConfigVal === 'string') {
      try {
        tableConfigVal = JSON.parse(tableConfigVal);
      } catch (e) {
        tableConfigVal = { floors: [] };
      }
    }
    setTableConfiguration(tableConfigVal || { floors: [] });

    // Load booking settings
    setEnableManualTableSelection(data.enableManualTableSelection ?? true);
    setEnableTableBooking(data.enableTableBooking ?? true);
    setTableBookingCharge(parseFloat(data.tableBookingCharge ?? data.TableBookingCharge ?? 100));
    setTableBookingChargeType(data.tableBookingChargeType ?? data.TableBookingChargeType ?? 'per_hour');
    console.log("DEBUG: Settings Apply Data:", data);
    setCafeName(data.cafeName ?? data.CafeName ?? 'Cafe');
    setCafeAddress(data.cafeOutletAddress ?? data.cafeAddress ?? data.CafeAddress ?? '');
    setContactPhone(data.cafeContactPhone ?? data.cafePhone ?? data.CafePhone ?? '');
    setCafePan(data.cafePan ?? data.CafePan ?? '');
    setCafeLogo(data.cafeLogo ?? data.CafeLogo ?? null);

    // Start background preloading for all images found in settings
    const urlsToPreload = [];
    if (data.cafeLogo) urlsToPreload.push(data.cafeLogo);
    if (data.paymentMethods) {
      try {
        const methods = typeof data.paymentMethods === 'string' ? JSON.parse(data.paymentMethods) : data.paymentMethods;
        if (Array.isArray(methods)) {
          methods.forEach(m => {
            if (m.qrCodeImage) urlsToPreload.push(m.qrCodeImage);
          });
        }
      } catch (e) { }
    }
    preloadImages(urlsToPreload);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      if (!cachedSettings) setLoading(true);

      // Fetch everything including payment methods in one parallelized/fast request
      const data = await getJson('/api/manager/settings?includePaymentMethods=true');
      if (data) {
        cachedSettings = data;
        applySettingsData(data);

        if (data.paymentMethods) {
          try {
            const methods = typeof data.paymentMethods === 'string'
              ? JSON.parse(data.paymentMethods)
              : data.paymentMethods;

            const parsedMethods = Array.isArray(methods) ? methods : [];
            setPaymentMethods(parsedMethods);
          } catch (e) {
            console.error('Failed to parse payment methods:', e);
          }
        }
        setPaymentMethodsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      if (!cachedSettings) setError(`Failed to load settings: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [applySettingsData]);


  useEffect(() => {
    // If we have cached data, initialize immediately to avoid loader
    if (cachedSettings) applySettingsData(cachedSettings);
    // Fetch fresh data in the background (or foreground if no cache)
    loadSettings();
  }, [applySettingsData, loadSettings]);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
      loadSettings();
    };

    conn.on('NewOrder', handleUpdate);
    conn.on('OrderUpdated', handleUpdate);
    conn.on('PaymentUpdate', handleUpdate);

    return () => {
      conn.off('NewOrder', handleUpdate);
      conn.off('OrderUpdated', handleUpdate);
      conn.off('PaymentUpdate', handleUpdate);
    };
  }, [socketRef, loadSettings]);

  async function saveSystemSettings(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Need to stringify table config for backend if it accepts generic object/string
      const payload = {
        vatPercentage: parseFloat(vatPercentage) || 0,
        vatIncluded: Boolean(vatIncluded),
        serviceChargePercentage: parseFloat(serviceChargePercentage) || 0,
        serviceChargeIncluded: Boolean(serviceChargeIncluded),
        showRefundTab: Boolean(showRefundTab),
        payFirst: Boolean(payFirst),
        tableConfiguration: tableConfiguration,
        enableManualTableSelection: Boolean(enableManualTableSelection),
        enableTableBooking: Boolean(enableTableBooking),
        tableBookingCharge: parseFloat(tableBookingCharge) || 0,
        tableBookingChargeType: tableBookingChargeType,
        cafeName: cafeName || 'Cafe',
        cafeOutletAddress: cafeAddress || '',
        cafeContactPhone: contactPhone || '',
        cafePan: cafePan || '',
        cafeLogo: cafeLogo || ''
      };

      if (paymentMethodsLoaded) {
        payload.paymentMethods = paymentMethods;
      }

      const response = await putJson('/api/manager/settings', payload);

      if (response && (response.status === true || response.Status === true)) {
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(response?.message || 'Failed to save settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  }

  // --- Cash Management Handlers ---
  const [cashHistory, setCashHistory] = useState([]);
  const [drawerStatus, setDrawerStatus] = useState(null);

  const [addCashReasonType, setAddCashReasonType] = useState('Initial Float');
  const [removeCashReasonType, setRemoveCashReasonType] = useState('Safe Drop');

  // Cash History Filtering
  const [cashFilter, setCashFilter] = useState('today');
  const [cashFromDate, setCashFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashToDate, setCashToDate] = useState(new Date().toISOString().split('T')[0]);

  const loadCashHistory = useCallback(async () => {
    try {
      setLoading(true);
      let query = '/api/managercash/history';
      const params = new URLSearchParams();

      if (cashFilter === 'weekly') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.append('fromDate', d.toISOString().split('T')[0]);
      } else if (cashFilter === 'monthly') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.append('fromDate', d.toISOString().split('T')[0]);
      } else if (cashFilter === 'yearly') {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        params.append('fromDate', d.toISOString().split('T')[0]);
      } else if (cashFilter === 'custom') {
        if (cashFromDate) params.append('fromDate', cashFromDate);
        if (cashToDate) params.append('toDate', cashToDate);
      }

      if (params.toString()) {
        query += `?${params.toString()}`;
      }

      const data = await getJson(query);
      if (data) setCashHistory(data);
    } catch (err) {
      console.error('Failed to load cash history:', err);
    } finally {
      setLoading(false);
    }
  }, [cashFilter, cashFromDate, cashToDate]);

  async function loadDrawerStatus() {
    try {
      const data = await getJson('/api/cash-closing'); // Reuse cashier logic securely!
      if (data) setDrawerStatus(data);
    } catch (err) {
      console.error('Failed to load drawer status', err);
    }
  }

  useEffect(() => {
    if (activeTab === 'cashBalance') {
      loadCashHistory();
      loadDrawerStatus();
    }
  }, [activeTab, loadCashHistory]);

  async function handleCashAdjustment(type) {
    const amountInput = document.getElementById(`${type}CashAmount`);
    const amount = parseFloat(amountInput?.value);

    let reason = '';
    if (type === 'add') {
      if (addCashReasonType === 'Other') reason = document.getElementById('addCashReasonManual')?.value?.trim();
      else reason = addCashReasonType;
    } else {
      if (removeCashReasonType === 'Other') reason = document.getElementById('removeCashReasonManual')?.value?.trim();
      else reason = removeCashReasonType;
    }

    if (!amount || amount <= 0) return setError('Please enter a valid amount');
    if (!reason) return setError('Please specify a reason');

    setError('');
    setLoading(true);
    try {
      const res = await postJson(`/api/managercash/${type}`, { amount, reason });
      if (res?.status || res?.Status) {
        setSuccess(`Cash ${type === 'add' ? 'added' : 'removed'} successfully`);
        amountInput.value = '';
        if (document.getElementById(`${type}CashReasonManual`)) {
          document.getElementById(`${type}CashReasonManual`).value = '';
        }
        if (type === 'add') setAddCashReasonType('Initial Float');
        else setRemoveCashReasonType('Safe Drop');

        await loadCashHistory();
        await loadDrawerStatus(); // Refresh KPIs dynamically
      } else {
        throw new Error(res?.message || 'Failed to adjust cash');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Table Management Handlers ---
  function addFloor() {
    const newFloors = [...(tableConfiguration.floors || [])];
    newFloors.push({
      id: Date.now(),
      name: `Floor ${newFloors.length + 1}`,
      tableCount: 5, // Default
      seats: 4 // Default 4 seats per table
    });
    setTableConfiguration({ ...tableConfiguration, floors: newFloors });
  }

  function removeFloor(index) {
    const newFloors = [...tableConfiguration.floors];
    newFloors.splice(index, 1);
    setTableConfiguration({ ...tableConfiguration, floors: newFloors });
  }

  function updateFloor(index, field, value) {
    const newFloors = [...tableConfiguration.floors];
    newFloors[index] = { ...newFloors[index], [field]: value };
    setTableConfiguration({ ...tableConfiguration, floors: newFloors });
  }

  // --- Seat Configuration Handlers ---
  function openSeatConfig(index) {
    const floor = tableConfiguration.floors[index];
    // Initialize seats map from existing customSeats or specific logic
    const currentSeats = { ...(floor.customSeats || {}) };

    // Ensure all tables have a value (default to floor default if specific not set)
    // We don't necessarily need to populate all if we treat null as "default", 
    // but for UI it's better to show the actual value.

    setSeatConfigModal({
      show: true,
      floorIndex: index,
      floorName: floor.name,
      defaultSeats: floor.seats || 4,
      tableCount: floor.tableCount,
      seats: currentSeats
    });
  }

  function handleSeatConfigSave() {
    // Save the custom seats back to the floor configuration
    const { floorIndex, seats } = seatConfigModal;
    const newFloors = [...tableConfiguration.floors];

    // Clean up: optional, remove entries that equal the default to save space?
    // For now, let's just save explicit overrides.

    newFloors[floorIndex] = { ...newFloors[floorIndex], customSeats: seats };
    setTableConfiguration({ ...tableConfiguration, floors: newFloors });
    setSeatConfigModal({ ...seatConfigModal, show: false });
  }

  function updateTableSeat(tableNum, value) {
    setSeatConfigModal(prev => ({
      ...prev,
      seats: { ...prev.seats, [tableNum]: parseInt(value) }
    }));
  }



  // --- Payment Methods Handlers ---
  function togglePaymentMethod(methodId) {
    setPaymentMethods(prevMethods => {
      const updated = prevMethods.map(m => {
        if (m.id === methodId) {
          return { ...m, enabled: !m.enabled };
        }
        return m;
      });
      return updated;
    });
  }

  async function handleQRUpload(methodId, event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Please upload a PNG or JPG image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }

    setLoading(true);
    try {
      const res = await uploadFile('/api/manager/settings/upload-qr', file);
      if (res?.status && res?.url) {
        setPaymentMethods(prev => prev.map(m =>
          m.id === methodId ? { ...m, qrCodeImage: res.url } : m
        ));
        setSuccess(`QR code uploaded for ${paymentMethods.find(m => m.id === methodId)?.name || 'method'}`);
      } else {
        throw new Error(res?.message || 'Failed to upload QR code');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload QR code');
    } finally {
      if (event.target) event.target.value = '';
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Please upload a PNG or JPG image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }

    setLoading(true);
    try {
      const res = await uploadFile('/api/manager/settings/upload-logo', file);
      if (res?.status && res?.url) {
        setCafeLogo(res.url);
        setSuccess('Cafe logo uploaded successfully!');
      } else {
        throw new Error(res?.message || 'Failed to upload logo');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload logo');
    } finally {
      if (event.target) event.target.value = '';
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  function removeQRCode(methodId) {
    setPaymentMethods(prev => prev.map(m =>
      m.id === methodId ? { ...m, qrCodeImage: null } : m
    ));
  }

  // --- Data Management Handlers ---
  // Note: Backup, reset, and restore operations are now handled
  // internally by the self-contained DataManagementTab component.



  const settingsCards = [
    { id: 'general', title: 'General & Taxes', icon: <FaCog />, desc: 'Configure taxes, fees, and interface options' },
    { id: 'tables', title: 'Table Management', icon: <FaTable />, desc: 'Configure floors, tables, and seats' },
    { id: 'cashBalance', title: 'Cash Drawer', icon: <FaMoneyBillWave />, desc: 'Manage cash balances and adjustments' },

    { id: 'paymentMethods', title: 'QR Payment Setup', icon: <FaMobileAlt />, desc: 'Mobile payment options and QR codes' },
    // { id: 'dataManagement', title: 'Data Management', icon: <FaTrash />, desc: 'Dangerous operations like data clearing' }
  ];

  return (
    <div className="settings-container">
      <header className="standard-page-header flex-between">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title">
            <FaCogs style={{ marginRight: '8px' }} /> System Setup
          </h1>
          <p className="standard-page-subtitle">Configure system-wide rules, taxes, and business setup</p>
        </div>
        
        <div className="header-actions">
          {activeTab && (
            <>
              {['general', 'tables', 'paymentMethods'].includes(activeTab) && (
                <button 
                  className="settings-btn-save-header" 
                  onClick={saveSystemSettings} 
                  disabled={loading}
                >
                  {loading ? <FaSave className="fa-spin" /> : <FaSave />}
                  {loading ? ' Saving...' : ' Save Changes'}
                </button>
              )}
              <button
                className="settings-btn-secondary"
                onClick={() => setActiveTab(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
              >
                <FaArrowLeft /> Back
              </button>
            </>
          )}
        </div>
      </header>

      {error && <div className="settings-alert error"><FaExclamationTriangle /> {error}</div>}
      {success && <div className="settings-alert success"><FaCheck /> {success}</div>}

      <div className="settings-layout">

        {!activeTab ? (
          <div className="settings-grid">
            {settingsCards.map(card => (
              <div
                key={card.id}
                className="settings-grid-card"
                onClick={() => setActiveTab(card.id)}
              >
                <div className="settings-grid-icon">
                  {card.icon}
                </div>
                <div className="settings-grid-content">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <main className="settings-content full-width">

            {activeTab === 'general' && (
              <GeneralTab
                cafeName={cafeName} setCafeName={setCafeName}
                cafeAddress={cafeAddress} setCafeAddress={setCafeAddress}
                contactPhone={contactPhone} setContactPhone={setContactPhone}
                cafePan={cafePan} setCafePan={setCafePan}
                vatPercentage={vatPercentage} setVatPercentage={setVatPercentage}
                vatIncluded={vatIncluded} setVatIncluded={setVatIncluded}
                serviceChargePercentage={serviceChargePercentage} setServiceChargePercentage={setServiceChargePercentage}
                serviceChargeIncluded={serviceChargeIncluded} setServiceChargeIncluded={setServiceChargeIncluded}
                showRefundTab={showRefundTab} setShowRefundTab={setShowRefundTab}
                payFirst={payFirst} setPayFirst={setPayFirst}
                cafeLogo={cafeLogo} setCafeLogo={setCafeLogo}
                onSave={saveSystemSettings} onLogoUpload={handleLogoUpload} loading={loading}
              />
            )}

            {activeTab === 'tables' && (
              <TablesTab
                tableBookingCharge={tableBookingCharge} setTableBookingCharge={setTableBookingCharge}
                tableBookingChargeType={tableBookingChargeType} setTableBookingChargeType={setTableBookingChargeType}
                tableConfiguration={tableConfiguration}
                updateFloor={updateFloor} removeFloor={removeFloor} addFloor={addFloor}
                openSeatConfig={openSeatConfig}
                seatConfigModal={seatConfigModal} setSeatConfigModal={setSeatConfigModal} handleSeatConfigSave={handleSeatConfigSave} updateTableSeat={updateTableSeat}
                onSave={saveSystemSettings} loading={loading}
              />
            )}


            {activeTab === 'cashBalance' && (
              <CashDrawerTab
                drawerStatus={drawerStatus}
                addCashReasonType={addCashReasonType} setAddCashReasonType={setAddCashReasonType}
                removeCashReasonType={removeCashReasonType} setRemoveCashReasonType={setRemoveCashReasonType}
                handleCashAdjustment={handleCashAdjustment} loading={loading}
                cashFilter={cashFilter} setCashFilter={setCashFilter}
                cashFromDate={cashFromDate} setCashFromDate={setCashFromDate}
                cashToDate={cashToDate} setCashToDate={setCashToDate}
                cashHistory={cashHistory}
              />
            )}



            {activeTab === 'paymentMethods' && (
              <QRPaymentTab
                paymentMethods={paymentMethods}
                togglePaymentMethod={togglePaymentMethod}
                handleQRUpload={handleQRUpload}
                removeQRCode={removeQRCode}
                onSave={saveSystemSettings} loading={loading}
              />
            )}

            {activeTab === 'dataManagement' && (
              <DataManagementTab
                setError={setError}
                setSuccess={setSuccess}
              />
            )}

          </main>
        )}
      </div>
    </div>
  );
}
