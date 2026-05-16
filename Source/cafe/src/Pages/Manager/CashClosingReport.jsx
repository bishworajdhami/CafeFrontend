import React, { useState, useEffect, useCallback } from 'react';
import { FaCalendarAlt, FaExclamationCircle, FaCheckCircle, FaClock, FaFileInvoiceDollar } from 'react-icons/fa';
import { getJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './CashClosingReport.css';

export default function CashClosingReport() {
  const { socketRef } = useSocket();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setError('');
      const data = await getJson(`/api/cash-closing?date=${selectedDate}`);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setFirstLoadDone(true);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadReport();
  }, [selectedDate, loadReport]);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
      loadReport();
    };

    conn.on('NewOrder', handleUpdate);
    conn.on('OrderUpdated', handleUpdate);
    conn.on('PaymentUpdate', handleUpdate);

    return () => {
      conn.off('NewOrder', handleUpdate);
      conn.off('OrderUpdated', handleUpdate);
      conn.off('PaymentUpdate', handleUpdate);
    };
  }, [socketRef, loadReport]);

  const formatCurrency = (val) => `NRP ${(val || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;



  return (
    <div className="manager-closing-report">
      {/* Header Section */}
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaFileInvoiceDollar style={{ marginRight: '8px' }} /> Daily Cash Report</h1>
          <p className="standard-page-subtitle">Review cashier submissions and daily reconciliation</p>
        </div>
        <div className="standard-page-header-actions date-picker-wrapper">
          <FaCalendarAlt className="calendar-icon" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="modern-date-input"
          />
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <FaExclamationCircle /> {error}
        </div>
      )}

      {/* Main Content */}
      <div className="report-content">
        {firstLoadDone && report && (
          !report?.closed ? (
            // PENDING STATE
            <div className="pending-state-card">
              <div className="pending-icon-wrapper">
                <FaClock />
              </div>
              <h2>Report Not Submitted</h2>
              <p>The cashier has not yet submitted the closing report for <strong>{selectedDate}</strong>.</p>
              <div className="live-preview-box">
                <h3>Live System Totals (Preview)</h3>
                <div className="live-preview-grid">
                  <div className="preview-item">
                    <span>Total Sales</span>
                    <strong>{formatCurrency(report?.totalSales)}</strong>
                  </div>
                  <div className="preview-item">
                    <span>Total Orders</span>
                    <strong>{report?.totalOrders || 0}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // SUBMITTED REPORT
            <div className="submitted-report-container">
              {/* Status Banner */}
              <div className="status-banner success">
                <div className="status-info">
                  <FaCheckCircle className="status-icon" />
                  <div>
                    <h3>Submitted by {report.submittedByUserName || 'Cashier'}</h3>
                    <p>Report finalized. Email notification sent.</p>
                  </div>
                </div>
                <div className="status-meta">
                  <span className="badge">Verified</span>
                </div>
              </div>

              {/* Reconciliation Card (Hero) */}
              <div className="reconciliation-card">
                <h3 className="section-title">Cash Reconciliation</h3>
                <div className="recon-grid">
                  <div className="recon-item">
                    <span className="label">Opening Balance</span>
                    <span className="value">{formatCurrency(report.openingCash)}</span>
                  </div>
                  <div className="recon-operator">+</div>
                  <div className="recon-item">
                    <span className="label">Cash Sales</span>
                    <span className="value">{formatCurrency(report.cashSales)}</span>
                  </div>
                  <div className="recon-operator">-</div>
                  <div className="recon-item">
                    <span className="label">Expenses / Paid Outs</span>
                    <span className="value highlight">{formatCurrency(report.cashExpenses || 0)}</span>
                  </div>
                  <div className="recon-operator">=</div>
                  <div className="recon-item">
                    <span className="label">Expected Cash</span>
                    <span className="value strong">{formatCurrency(report.expectedCash)}</span>
                  </div>
                </div>
                <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '2px solid #e5e7eb' }} />
                <div className="recon-grid">
                  <div className="recon-item">
                    <span className="label">Actual Cash Counted</span>
                    <span className="value highlight">{formatCurrency(report.cashInDrawer)}</span>
                  </div>
                  <div className="recon-operator">-</div>
                  <div className="recon-item">
                    <span className="label">Expected Cash</span>
                    <span className="value">{formatCurrency(report.expectedCash)}</span>
                  </div>
                  <div className="recon-operator">=</div>
                  <div className={`recon-item result ${report.difference === 0 ? 'perfect' : report.difference > 0 ? 'surplus' : 'shortage'}`}>
                    <span className="label">Difference</span>
                    <span className="value">
                      {report.difference > 0 ? '+' : ''}{formatCurrency(report.difference)}
                    </span>
                    <span className="status-tag">
                      {report.difference === 0 ? 'Perfect Match' : report.difference > 0 ? 'Surplus' : 'Shortage'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="details-grid-row">
                {/* Sales Breakdown */}
                <div className="detail-card">
                  <h3 className="section-title">Sales Breakdown</h3>
                  <div className="table-wrapper">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Payment Method</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Cash</td>
                          <td className="text-right">{formatCurrency(report.cashSales)}</td>
                          <td className="text-right">{report.cashCount}</td>
                        </tr>
                        <tr>
                          <td>Card</td>
                          <td className="text-right">{formatCurrency(report.cardSales)}</td>
                          <td className="text-right">{report.cardCount}</td>
                        </tr>
                        <tr>
                          <td>Mobile / Digital</td>
                          <td className="text-right">{formatCurrency(report.mobileSales)}</td>
                          <td className="text-right">{report.mobileCount}</td>
                        </tr>
                        <tr className="row-total">
                          <td><strong>Total</strong></td>
                          <td className="text-right"><strong>{formatCurrency(report.totalSales)}</strong></td>
                          <td className="text-right"><strong>{report.totalOrders}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes Card */}
                <div className="detail-card">
                  <h3 className="section-title">Cashier Notes</h3>
                  <div className="notes-box">
                    {report.notes ? report.notes : <span className="text-muted">No notes provided.</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
