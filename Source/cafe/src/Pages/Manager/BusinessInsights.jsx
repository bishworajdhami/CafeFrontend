import React, { useState, useEffect } from 'react';
import InsightsSkeleton from '../../components/skeletons/InsightsSkeleton';
import { FaMoneyBillWave, FaBox, FaChartBar, FaCalendarAlt, FaShoppingCart, FaExclamationTriangle, FaChartLine, FaPlus, FaMinus, FaClock } from 'react-icons/fa';
import { getJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './BusinessInsights.css';

export default function BusinessInsights() {
  const { socketRef } = useSocket();
  const [timeRange, setTimeRange] = useState('daily');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalItemsSold: 0,
    averageOrderValue: 0,
    topItems: [],
    busyHours: [],
    salesByDay: [],
    bookingStats: { TotalRevenue: 0, TotalBookings: 0 },
    paymentMethodStats: [],
    categorySales: [],
    orderTypeStats: []
  });

  // ── Cash Drawer State is now inside `insights` ────────────────────

  // ── Stock Insights State (time-range-aware) ─────────────────────
  const [stockInsights, setStockInsights] = useState(null);
  const [error, setError] = useState(null);

  const loadInsights = React.useCallback(async () => {
    try {
      setLoading(true);
      let query = `/api/manager/insights?range=${timeRange}`;
      if (timeRange === 'custom') {
        if (!customStartDate || !customEndDate) { setLoading(false); return; }
        query += `&customStartDate=${customStartDate}&customEndDate=${customEndDate}`;
      }
      const data = await getJson(query);
      if (data) {
        setInsights(data);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load insights', err);
      setError(`Failed to load business insights: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [timeRange, customStartDate, customEndDate]);

  const loadStockInsights = React.useCallback(async () => {
    try {
      let query = `/api/stock/insights?range=${timeRange}`;
      if (timeRange === 'custom') {
        if (!customStartDate || !customEndDate) return;
        query += `&customStartDate=${customStartDate}&customEndDate=${customEndDate}`;
      }
      const data = await getJson(query);
      if (data) setStockInsights(data);
    } catch (err) {
      console.error('Failed to load stock insights', err);
    } finally {
      // Stock loading is now handled implicitly by the main loader
    }
  }, [timeRange, customStartDate, customEndDate]);

  useEffect(() => { loadInsights(); }, [loadInsights]);
  useEffect(() => { loadStockInsights(); }, [loadStockInsights]);

  useEffect(() => {
    const conn = socketRef?.current;
    if (!conn) return;

    const handleUpdate = () => {
      loadInsights();
      loadStockInsights();
    };

    conn.on('NewOrder', handleUpdate);
    conn.on('OrderUpdated', handleUpdate);
    conn.on('PaymentUpdate', handleUpdate);

    return () => {
      conn.off('NewOrder', handleUpdate);
      conn.off('OrderUpdated', handleUpdate);
      conn.off('PaymentUpdate', handleUpdate);
    };
  }, [socketRef, loadInsights, loadStockInsights]);

  return (
    <div className="business-insights">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaChartLine style={{ marginRight: '8px' }} /> Business Insights</h1>
          <p className="standard-page-subtitle">View your cafe's performance and analytics</p>
        </div>
        <div className="standard-page-header-actions time-range-selector">
          <button
            className={timeRange === 'daily' ? 'active' : ''}
            onClick={() => { setTimeRange('daily'); setShowDatePicker(false); }}
          >
            Daily
          </button>
          <button
            className={timeRange === 'weekly' ? 'active' : ''}
            onClick={() => { setTimeRange('weekly'); setShowDatePicker(false); }}
          >
            Weekly
          </button>
          <button
            className={timeRange === 'monthly' ? 'active' : ''}
            onClick={() => { setTimeRange('monthly'); setShowDatePicker(false); }}
          >
            Monthly
          </button>
          <button
            className={timeRange === 'yearly' ? 'active' : ''}
            onClick={() => { setTimeRange('yearly'); setShowDatePicker(false); }}
          >
            Yearly
          </button>

          <button
            className={timeRange === 'custom' ? 'active' : ''}
            onClick={() => {
              setTimeRange('custom');
              setShowDatePicker(!showDatePicker);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FaCalendarAlt />
            {timeRange === 'custom' && customStartDate && customEndDate
              ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
              : 'Custom Range'}
          </button>

          {/* Backdrop Overlay */}
          {showDatePicker && (
            <div className="date-picker-backdrop" onClick={() => setShowDatePicker(false)} />
          )}

          {showDatePicker && (
            <div className="date-picker-dropdown">
              <div className="dropdown-header">
                <h4>Select Date Range</h4>
                <button className="close-btn" onClick={() => setShowDatePicker(false)}>
                  ✕
                </button>
              </div>

              <div className="date-picker-inputs">
                <div className="date-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    className={`date-input ${customStartDate && customEndDate && customStartDate > customEndDate
                      ? 'date-input-error'
                      : ''
                      }`}
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="date-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    className={`date-input ${customStartDate && customEndDate && customStartDate > customEndDate
                      ? 'date-input-error'
                      : ''
                      }`}
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>

              {customStartDate && customEndDate && customStartDate > customEndDate && (
                <div className="date-validation-error">
                  ⚠️ Start date must be before or equal to end date
                </div>
              )}

              <div className="dropdown-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDatePicker(false)}
                >
                  Cancel
                </button>
                <button
                  className="apply-btn"
                  disabled={!customStartDate || !customEndDate || customStartDate > customEndDate}
                  onClick={() => {
                    if (customStartDate && customEndDate && customStartDate <= customEndDate) {
                      setTimeRange('custom');
                      setShowDatePicker(false);
                    }
                  }}
                >
                  Apply Range
                </button>
              </div>
            </div>
          )}

        </div>
      </header>

      {error && (
        <div style={{ margin: '1rem 2rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <FaExclamationTriangle />
          <div>
            <strong>Backend Error:</strong> {error}
            <button
              onClick={() => { setError(null); loadInsights(); loadStockInsights(); }}
              style={{ marginLeft: '1rem', background: '#991b1b', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <InsightsSkeleton />
      ) : (
        <>
          <div className="insights-grid">
            <div className="insight-card sales-card">
              <div className="insight-header">
                <div className="insight-icon-container"><FaMoneyBillWave /></div>
                <div className="insight-trend">Total</div>
              </div>
              <div className="insight-content">
                <span className="insight-label">Total Sales</span>
                <div className="insight-value-wrapper" title={`NRP ${insights.totalSales.toFixed(2)}`}>
                  <span className="insight-currency">NRP</span>
                  <p className="insight-value">{insights.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <p className="insight-card-subtitle">Gross revenue in selected period</p>
              </div>
            </div>

            <div className="insight-card orders-card">
              <div className="insight-header">
                <div className="insight-icon-container"><FaBox /></div>
                <div className="insight-trend">Volume</div>
              </div>
              <div className="insight-content">
                <span className="insight-label">Total Orders</span>
                <div className="insight-value-wrapper" title={`${insights.totalOrders} orders`}>
                  <p className="insight-value">{insights.totalOrders.toLocaleString()}</p>
                </div>
                <p className="insight-card-subtitle">Volume of transactions</p>
              </div>
            </div>

            <div className="insight-card items-card">
              <div className="insight-header">
                <div className="insight-icon-container"><FaShoppingCart /></div>
                <div className="insight-trend">Stock</div>
              </div>
              <div className="insight-content">
                <span className="insight-label">Total Items Sold</span>
                <div className="insight-value-wrapper" title={`${insights.totalItemsSold || 0} items`}>
                  <p className="insight-value">{(insights.totalItemsSold || 0).toLocaleString()}</p>
                </div>
                <p className="insight-card-subtitle">Volume of products production</p>
              </div>
            </div>

            <div className="insight-card avg-card">
              <div className="insight-header">
                <div className="insight-icon-container"><FaChartBar /></div>
                <div className="insight-trend">Avg</div>
              </div>
              <div className="insight-content">
                <span className="insight-label">Avg. Order Value</span>
                <div className="insight-value-wrapper" title={`NRP ${insights.averageOrderValue.toFixed(2)}`}>
                  <span className="insight-currency">NRP</span>
                  <p className="insight-value">{insights.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <p className="insight-card-subtitle">Mean spend per customer</p>
              </div>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-card">
              <h3>Top Selling Items</h3>
              <p className="card-subtitle">Best performing products by volume</p>
              <div className="top-items-list">
                {insights.topItems.map((item, index) => (
                  <div key={index} className="top-item">
                    <div className="item-info">
                      <span className="item-rank">{index + 1}</span>
                      <span className="item-name">{item.name}</span>
                    </div>
                    <div className="item-stats">
                      <span className="item-quantity">{item.quantity.toLocaleString()} sold</span>
                      <span className="item-revenue">NRP {item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h3>Busiest Hours</h3>
              <p className="card-subtitle">Peak transaction times (Nepal Standard Time)</p>
              <div className="busy-hours-list">
                {insights.busyHours.map((hour, index) => (
                  <div key={index} className="busy-hour">
                    <span className="hour-label">{hour.hour}</span>
                    <div className="hour-bar-container">
                      <div
                        className="hour-bar"
                        style={{ width: `${(hour.orders / 15) * 100}%` }}
                      />
                    </div>
                    <span className="hour-orders">{hour.orders} orders</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-card">
              <h3>Table Booking Overview</h3>
              <p className="card-subtitle">Revenue and count of reservations</p>
              <div className="booking-overview-content">
                <div className="booking-main-stat">
                  <span className="booking-stat-value">
                    NRP {(insights.bookingStats?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="booking-subtext">Total Booking Revenue</span>
                </div>

                <div className="booking-secondary-stat">
                  <span className="booking-count-value">
                    {(insights.bookingStats?.totalBookings || 0).toLocaleString()}
                  </span>
                  <span className="booking-subtext">Total Reservations</span>
                </div>
              </div>
            </div>

            {/* Category Sales Card */}
            <div className="chart-card">
              <h3>Sales by Category</h3>
              <p className="card-subtitle">Revenue distribution across menu categories</p>
              <div className="category-sales-list">
                {insights.categorySales?.map((cat, index) => {
                  const maxVal = Math.max(...insights.categorySales.map(c => c.revenue)) || 1;
                  return (
                    <div key={index} className="category-item">
                      <span className="category-info">{cat.category}</span>
                      <div className="category-bar-container">
                        <div
                          className="category-bar"
                          style={{ width: `${(cat.revenue / maxVal) * 100}%` }}
                        />
                      </div>
                      <span className="category-revenue">NRP {cat.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-card">
              <h3>Payment Methods</h3>
              <p className="card-subtitle">Distribution of payment modes used</p>
              <div className="payment-methods-list">
                {insights.paymentMethodStats?.map((method, index) => {
                  const totalPaymentRevenue = insights.paymentMethodStats.reduce((sum, item) => sum + item.total, 0);
                  const percent = totalPaymentRevenue > 0 ? (method.total / totalPaymentRevenue) * 100 : 0;
                  const colors = ['#10b981', '#8b5cf6', '#f59e0b', '#3b82f6'];

                  return (
                    <div key={index} className="payment-stat-item">
                      <div className="payment-label">
                        <span>{method.method}</span>
                        <span>{percent.toFixed(1)}% (NRP {method.total.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                      </div>
                      <div className="payment-progress-bg">
                        <div
                          className="payment-progress-fill"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: colors[index % colors.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Types Donut */}
            <div className="chart-card">
              <h3>Order Composition</h3>
              <p className="card-subtitle">Ratio of Dine-in vs Takeaway volume</p>
              <div className="donut-chart-container">
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: `conic-gradient(
                    var(--color-primary) 0% ${insights.orderTypeStats?.find(t => t.type === 'dine-in')?.revenue / insights.totalSales * 100 || 0}%, 
                    #f59e0b ${insights.orderTypeStats?.find(t => t.type === 'dine-in')?.revenue / insights.totalSales * 100 || 0}% 100%
                  )`,
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '20px', left: '20px',
                    width: '80px', height: '80px',
                    background: 'white',
                    borderRadius: '50%'
                  }}></div>
                </div>

                <div className="donut-legend">
                  {insights.orderTypeStats?.map((type, index) => (
                    <div key={index} className="legend-item">
                      <div
                        className="legend-color"
                        style={{ backgroundColor: type.type === 'dine-in' ? 'var(--color-primary)' : '#f59e0b' }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>
                        {type.type}: {type.count} orders
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="chart-card full-width">
            <h3>Sales Trend</h3>
            <p className="card-subtitle">{timeRange === 'yearly' ? 'Monthly revenue breakdown' : 'Daily revenue breakdown'}</p>
            <div className="sales-chart">
              {insights.salesByDay && insights.salesByDay.length > 0 ? (
                (() => {
                  const maxSales = Math.max(...insights.salesByDay.map(d => d.sales)) || 1;
                  return insights.salesByDay.map((day, index) => (
                    <div key={index} className="sales-bar-item">
                      <div className="sales-bar-container">
                        <div
                          className="sales-bar"
                          style={{ height: `${(day.sales / maxSales) * 100}%` }}
                        />
                      </div>
                      <span className="sales-day">{day.day}</span>
                      <span className="sales-amount">NRP {day.sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ));
                })()
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', width: '100%' }}>
                  No sales data available for this period.
                </div>
              )}
            </div>
          </div>
          <div className="charts-section">
            <div className="chart-card">
              <h3>Purchasing Spend
                {stockInsights?.totalPurchaseSpend > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    Rs. {Number(stockInsights.totalPurchaseSpend).toLocaleString('en-IN', { maximumFractionDigits: 0 })} total
                  </span>
                )}
              </h3>
              <p className="card-subtitle">Cost of restocking inventory items</p>
              {!stockInsights || stockInsights.purchaseSpend?.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  No restocking purchases recorded in this period.
                </div>
              ) : (() => {
                const maxAmt = Math.max(...stockInsights.purchaseSpend.map(d => d.amount)) || 1;
                return (
                  <div className="sales-chart">
                    {stockInsights.purchaseSpend.map((d, i) => (
                      <div key={i} className="sales-bar-item">
                        <div className="sales-bar-container">
                          <div
                            className="sales-bar"
                            style={{ height: `${(d.amount / maxAmt) * 100}%`, background: 'var(--color-primary)' }}
                          />
                        </div>
                        <span className="sales-day">{d.label}</span>
                        <span className="sales-amount">Rs. {Number(d.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="chart-card">
              <h3>Wastage &amp; Shrinkage
                {stockInsights?.totalWastageValue > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 700, color: '#ef4444' }}>
                    Rs. {Number(stockInsights.totalWastageValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })} lost
                  </span>
                )}
              </h3>
              <p className="card-subtitle">Estimated losses from damaged or expired stock</p>
              {!stockInsights || stockInsights.wastageByReason?.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  No stock wastage or losses recorded in this period.
                </div>
              ) : (() => {
                const maxVal = Math.max(...stockInsights.wastageByReason.map(r => r.estimatedValue)) || 1;
                const colors = ['#ef4444', '#f59e0b', '#8b5cf6', 'var(--color-primary-dark)', 'var(--color-primary)'];
                return (
                  <div className="wastage-breakdown-list">
                    {stockInsights.wastageByReason.map((r, idx) => (
                      <div key={idx} className="category-item">
                        <span className="category-info">{r.reason}</span>
                        <div className="category-bar-container">
                          <div
                            className="category-bar"
                            style={{
                              width: `${(r.estimatedValue / maxVal) * 100}%`,
                              background: colors[idx % colors.length]
                            }}
                          />
                        </div>
                        <span className="category-revenue" style={{ color: colors[idx % colors.length] }}>
                          Rs. {Number(r.estimatedValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                    <div className="wastage-footer">
                      <span>Total units lost: <strong>{Number(stockInsights.totalWastageUnits).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></span>
                      <span>Estimated loss: <strong className="loss-value">Rs. {Number(stockInsights.totalWastageValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          {insights.drawerData ? (
            <div className="charts-section drawer-insights-section">
              {/* Card 1: Cash Flow Breakdown */}
              <div className="chart-card">
                <h3>Cash Flow Breakdown</h3>
                <p className="card-subtitle">Net cash movement during this period</p>

                <div className="cash-movement-list">
                  {/* Cash Sales */}
                  <div className="cash-movement-item">
                    <div className="item-label">
                      <FaMoneyBillWave className="icon-sales" />
                      <span>Total Cash Sales</span>
                    </div>
                    <div className="item-bar-wrap">
                      <div className="item-bar bar-sales" style={{ width: `${insights.drawerData.cashSales > 0 ? 100 : 0}%` }} />
                    </div>
                    <div className="item-value value-sales">NRP {(insights.drawerData.cashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>

                  {/* Manager Added */}
                  <div className="cash-movement-item">
                    <div className="item-label">
                      <FaPlus className="icon-added" />
                      <span>Manager Added</span>
                    </div>
                    <div className="item-bar-wrap">
                      <div className="item-bar bar-added" style={{
                        width: `${insights.drawerData.cashSales > 0 ? (insights.drawerData.managerAdded / insights.drawerData.cashSales) * 100 : (insights.drawerData.managerAdded > 0 ? 100 : 0)}%`
                      }} />
                    </div>
                    <div className="item-value value-added">+ NRP {(insights.drawerData.managerAdded || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>

                  {/* Manager Removed */}
                  <div className="cash-movement-item">
                    <div className="item-label">
                      <FaMinus className="icon-removed" />
                      <span>Manager Removed</span>
                    </div>
                    <div className="item-bar-wrap">
                      <div className="item-bar bar-removed" style={{
                        width: `${insights.drawerData.cashSales > 0 ? (insights.drawerData.managerRemoved / insights.drawerData.cashSales) * 100 : (insights.drawerData.managerRemoved > 0 ? 100 : 0)}%`
                      }} />
                    </div>
                    <div className="item-value value-removed">− NRP {(insights.drawerData.managerRemoved || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>

                  <div className="cash-movement-footer">
                    <span className="footer-label">Net Cash Movement</span>
                    <span className={`footer-value ${((insights.drawerData.cashSales || 0) + (insights.drawerData.managerAdded || 0) - (insights.drawerData.managerRemoved || 0)) >= 0 ? 'pos' : 'neg'}`}>
                      NRP {((insights.drawerData.cashSales || 0) + (insights.drawerData.managerAdded || 0) - (insights.drawerData.managerRemoved || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Drawer Balance */}
              <div className="chart-card">
                <h3>Drawer Balance</h3>
                <p className="card-subtitle">Expected vs actual cash remaining in drawer</p>

                <div className="drawer-balance-stats">
                  <div className="balance-card opening">
                    <span className="balance-label">Opening Cash</span>
                    <span className="balance-value">NRP {(insights.drawerData.openingCash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="balance-card expected">
                    <span className="balance-label">Expected in Drawer</span>
                    <span className="balance-value">NRP {(insights.drawerData.expectedCash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {insights.drawerData.closed ? (
                    <>
                      <div className="balance-card actual">
                        <span className="balance-label">Actual Cash Counted</span>
                        <span className="balance-value">NRP {(insights.drawerData.cashInDrawer || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className={`balance-card difference ${insights.drawerData.difference >= 0 ? 'positive' : 'negative'}`}>
                        <span className="balance-label">Difference</span>
                        <span className="balance-value">
                          {insights.drawerData.difference >= 0 ? '+' : ''}NRP {(insights.drawerData.difference || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="session-status-note">
                      <FaClock />
                      <span>Session not yet closed — difference will show after cash closing</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

        </>
      )}
    </div>
  );
}
