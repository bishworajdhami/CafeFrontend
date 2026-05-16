import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCalendarAlt, FaCheckCircle, FaLock, FaSync,
  FaMoneyBillWave, FaChartLine, FaCreditCard, FaMobileAlt, FaShoppingCart,
  FaPlus, FaMinus, FaList, FaExclamationCircle
} from 'react-icons/fa';
import { getJson, postJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './CashClosing.css';

export default function CashClosing() {
  const { socketRef } = useSocket();
  const [report, setReport] = useState(null);
  const [cashInDrawer, setCashInDrawer] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [managerAdded, setManagerAdded] = useState(0);
  const [managerRemoved, setManagerRemoved] = useState(0);
  const [cashExpenses, setCashExpenses] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setError('');
      const data = await getJson(`/api/cashier/cash-closing?date=${selectedDate}`);
      setReport(data);
      setCashInDrawer(data?.cashInDrawer != null ? data.cashInDrawer.toString() : '');
      setOpeningCash(data?.openingCash != null ? data.openingCash.toString() : '0');
      setManagerAdded(data?.managerAdded || 0);
      setManagerRemoved(data?.managerRemoved || 0);
      setCashExpenses(data?.cashExpenses != null ? data.cashExpenses.toString() : '');
      const rawNotes = data?.notes || '';
      setNotes(rawNotes.replace(/Auto-generated history/g, '').trim());
    } catch (err) {
      setError('Failed to load cash closing report');
      console.error(err);
    } finally {
      setFirstLoadDone(true);
    }
  }, [selectedDate]);

  const getExpectedCash = useCallback(() => {
    if (!report) return 0;
    return (
      parseFloat(openingCash || 0) +
      parseFloat(report.cashSales || 0) +
      parseFloat(managerAdded || 0) -
      parseFloat(managerRemoved || 0) -
      parseFloat(cashExpenses || 0)
    );
  }, [report, openingCash, managerAdded, managerRemoved, cashExpenses]);

  useEffect(() => { loadReport(); }, [selectedDate, loadReport]);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;
    const refresh = () => loadReport();
    conn.on('NewOrder', refresh);
    conn.on('OrderUpdated', refresh);
    conn.on('PaymentUpdate', refresh);
    return () => {
      conn.off('NewOrder', refresh);
      conn.off('OrderUpdated', refresh);
      conn.off('PaymentUpdate', refresh);
    };
  }, [socketRef, loadReport]);

  const executeSubmission = useCallback(async (actualCashAmount) => {
    if (isNaN(actualCashAmount) || actualCashAmount < 0) {
      setError('Please enter a valid cash amount in drawer');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await postJson('/api/cashier/cash-closing', {
        date: selectedDate,
        cashInDrawer: actualCashAmount,
        openingCash: parseFloat(openingCash) || 0,
        cashExpenses: cashExpenses ? parseFloat(cashExpenses) : 0,
        notes: notes.trim(),
      });
      setSuccess('Cash closing report submitted successfully!');
      setTimeout(() => { setSuccess(''); loadReport(); }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to submit cash closing report');
    } finally {
      setSubmitting(false);
    }
  }, [selectedDate, openingCash, cashExpenses, notes, loadReport]);

  const submitCashClosing = useCallback(async () => {
    await executeSubmission(parseFloat(cashInDrawer));
  }, [executeSubmission, cashInDrawer]);

  const expectedCash = getExpectedCash();
  const diff = parseFloat(cashInDrawer || 0) - expectedCash;
  const diffStatus = diff > 0 ? 'overage' : diff < 0 ? 'shortage' : 'perfect';
  const diffLabel = diff > 0 ? 'Cash Surplus' : diff < 0 ? 'Cash Shortage' : 'Perfect Match';
  const formatCurrency = (val) => `NRP ${(parseFloat(val || 0)).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

  return (
    <div className="cashier-closing-v5">

      {/* Header Section */}
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaLock style={{ marginRight: '8px' }} /> Daily Cash Closing</h1>
          <p className="standard-page-subtitle">End-of-day shift summary & drawer reconciliation</p>
        </div>
        <div className="standard-page-header-actions">
          <div className="cc5-date-picker">
            <FaCalendarAlt />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </header>

      {error && <div className="cc5-alert error"><FaExclamationCircle /> {error}</div>}
      {success && <div className="cc5-alert success"><FaCheckCircle /> {success}</div>}

      {firstLoadDone && report ? (
        <>
          {/* KPI Grid (Match Business Insights) */}
          <div className="cc5-insights-grid">
            <div className="cc5-insight-card cc5-card-sales">
              <div className="cc5-insight-header">
                <div className="cc5-insight-icon"><FaChartLine /></div>
              </div>
              <div className="cc5-insight-content">
                <span className="cc5-insight-label">Total Revenue</span>
                <div className="cc5-insight-val-wrap">
                  <span className="cc5-insight-cur">NRP</span>
                  <p className="cc5-insight-val">{parseFloat(report.totalSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="cc5-insight-card cc5-card-cash">
              <div className="cc5-insight-header">
                <div className="cc5-insight-icon"><FaMoneyBillWave /></div>
              </div>
              <div className="cc5-insight-content">
                <span className="cc5-insight-label">Cash Collected</span>
                <div className="cc5-insight-val-wrap">
                  <span className="cc5-insight-cur">NRP</span>
                  <p className="cc5-insight-val">{parseFloat(report.cashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="cc5-insight-card cc5-card-card">
              <div className="cc5-insight-header">
                <div className="cc5-insight-icon"><FaCreditCard /></div>
              </div>
              <div className="cc5-insight-content">
                <span className="cc5-insight-label">Card Payments</span>
                <div className="cc5-insight-val-wrap">
                  <span className="cc5-insight-cur">NRP</span>
                  <p className="cc5-insight-val">{parseFloat(report.cardSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="cc5-insight-card cc5-card-mobile">
              <div className="cc5-insight-header">
                <div className="cc5-insight-icon"><FaMobileAlt /></div>
              </div>
              <div className="cc5-insight-content">
                <span className="cc5-insight-label">Mobile Payments</span>
                <div className="cc5-insight-val-wrap">
                  <span className="cc5-insight-cur">NRP</span>
                  <p className="cc5-insight-val">{parseFloat(report.mobileSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="cc5-insight-card cc5-card-orders">
              <div className="cc5-insight-header">
                <div className="cc5-insight-icon"><FaShoppingCart /></div>
              </div>
              <div className="cc5-insight-content">
                <span className="cc5-insight-label">Total Orders</span>
                <div className="cc5-insight-val-wrap">
                  <p className="cc5-insight-val">{report.totalOrders || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Grid: Two Large Columns side-by-side filling 1400px */}
          <div className="cc5-form-grid">

            {/* Left Panel: Shift Ledger */}
            <div className="cc5-panel">
              <h3><FaList /> Shift Ledger</h3>
              <div className="cc5-ledger-list">

                <div className="cc5-ledger-item">
                  <div className="cc5-li-left">
                    <div className="cc5-li-op lock"><FaLock style={{ opacity: 0.6 }} /></div>
                    Opening Balance
                  </div>
                  <div className="cc5-li-right">{formatCurrency(openingCash)}</div>
                </div>

                <div className="cc5-ledger-item">
                  <div className="cc5-li-left">
                    <div className="cc5-li-op plus"><FaPlus /></div>
                    Total Cash Sales
                  </div>
                  <div className="cc5-li-right">{formatCurrency(report.cashSales)}</div>
                </div>

                {managerAdded > 0 && (
                  <div className="cc5-ledger-item">
                    <div className="cc5-li-left">
                      <div className="cc5-li-op plus"><FaPlus /></div>
                      Manager Additions
                    </div>
                    <div className="cc5-li-right">{formatCurrency(managerAdded)}</div>
                  </div>
                )}

                {managerRemoved > 0 && (
                  <div className="cc5-ledger-item">
                    <div className="cc5-li-left">
                      <div className="cc5-li-op minus"><FaMinus /></div>
                      Manager Removals
                    </div>
                    <div className="cc5-li-right">{formatCurrency(managerRemoved)}</div>
                  </div>
                )}



              </div>
            </div>

            {/* Right Panel: Final Reconciliation & Submit */}
            <div className="cc5-panel">
              <h3><FaMoneyBillWave /> Final Reconciliation</h3>
              <div className="cc5-recon-content">

                <div className="cc5-expected-block">
                  <span className="cc5-expected-lbl">Expected Cash</span>
                  <span className="cc5-expected-val">{formatCurrency(expectedCash)}</span>
                </div>

                <div className="cc5-actual-block">
                  <span className="cc5-actual-lbl">Actual Cash in Drawer</span>
                  <div className="cc5-actual-input-huge">
                    <span>NRP</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cashInDrawer}
                      onChange={e => setCashInDrawer(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {cashInDrawer !== '' && (
                  <div className={`cc5-result-badge ${diffStatus}`}>
                    <span>{diffLabel}</span>
                    <span>{diff > 0 ? '+' : ''}{formatCurrency(diff)}</span>
                  </div>
                )}

                <div className="cc5-notes-area">
                  <label>Shift Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Explain any discrepancies here..."
                  />
                </div>

                <button
                  className="cc5-submit-btn"
                  onClick={submitCashClosing}
                  disabled={submitting}
                >
                  {submitting
                    ? <><FaSync style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>
                    : report.closed
                      ? <><FaSync /> Update Closing Report</>
                      : <><FaLock /> Submit Cash Closing Report</>
                  }
                </button>

              </div>
            </div>

          </div>

        </>
      ) : firstLoadDone ? (
        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#94a3b8' }}>
          <FaMoneyBillWave style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
          <h2 style={{ color: '#1e293b' }}>No Report Available</h2>
          <p>Start taking orders to generate a report for the selected date.</p>
        </div>
      ) : null}
    </div>
  );
}
