import { FaArrowUp, FaArrowDown, FaPlus, FaTimes, FaCashRegister, FaMoneyBillWave, FaCalendarAlt } from 'react-icons/fa';

export default function CashDrawerTab({
  drawerStatus,
  addCashReasonType, setAddCashReasonType,
  removeCashReasonType, setRemoveCashReasonType,
  handleCashAdjustment, loading,
  cashFilter, setCashFilter,
  cashFromDate, setCashFromDate,
  cashToDate, setCashToDate,
  cashHistory
}) {
  return (
    <div className="settings-tab-container fade-in">


      {drawerStatus && (
        <div className="settings-kpi-grid">
          <div className="settings-kpi-card">
            <div className="settings-kpi-icon">
              <FaMoneyBillWave />
            </div>
            <div className="settings-kpi-content">
              <h3>Opening Cash</h3>
              <p className="settings-kpi-value">NRP {drawerStatus.openingCash?.toFixed(2) || '0.00'}</p>
              <p className="settings-kpi-subtext">Carry-forward from last closing</p>
            </div>
          </div>
          <div className="settings-kpi-card" style={{ borderColor: 'var(--color-primary-light)' }}>
            <div className="settings-kpi-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <FaCashRegister />
            </div>
            <div className="settings-kpi-content">
              <h3>Current Expected</h3>
              <p className="settings-kpi-value" style={{ color: 'var(--color-primary)' }}>NRP {drawerStatus.expectedCash?.toFixed(2) || '0.00'}</p>
              <p className="settings-kpi-subtext">Opening + Sales +/- Adjustments</p>
            </div>
          </div>
        </div>
      )}



      <div className="settings-inner-grid">
        <div className="settings-inner-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="settings-inner-card-header">
            <h3 style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaArrowUp /> Add Cash
            </h3>
          </div>
          <div className="settings-inner-card-body">
            <div className="settings-form-control">
              <label>Amount (NRP)</label>
              <input type="number" id="addCashAmount" min="0" step="0.01" />
            </div>
            <div className="settings-form-control">
              <label>Reason</label>
              <select 
                value={addCashReasonType} 
                onChange={(e) => setAddCashReasonType(e.target.value)}
              >
                <option value="Initial Float">Initial Float</option>
                <option value="Change Return (Exchange)">Change Return (Exchange)</option>
                <option value="Manager Top-up">Manager Top-up</option>
                <option value="Other">Other (Manual Entry)</option>
              </select>
              {addCashReasonType === 'Other' && (
                <input type="text" id="addCashReasonManual" placeholder="Type specific reason..." style={{ marginTop: '0.75rem' }} />
              )}
            </div>
            <button className="settings-btn-primary" onClick={() => handleCashAdjustment('add')} disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              <FaPlus /> Add to Drawer
            </button>
          </div>
        </div>

        <div className="settings-inner-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="settings-inner-card-header">
            <h3 style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaArrowDown /> Remove Cash
            </h3>
          </div>
          <div className="settings-inner-card-body">
            <div className="settings-form-control">
              <label>Amount (NRP)</label>
              <input type="number" id="removeCashAmount" min="0" step="0.01" />
            </div>
            <div className="settings-form-control">
              <label>Reason</label>
              <select 
                value={removeCashReasonType} 
                onChange={(e) => setRemoveCashReasonType(e.target.value)}
              >
                <option value="Safe Drop">Safe Drop / Bank Deposit</option>
                <option value="Petty Cash (Expenses)">Petty Cash (Expenses)</option>
                <option value="Vendor Payment">Vendor Payment</option>
                <option value="Change Exchange">Change Exchange</option>
                <option value="Other">Other (Manual Entry)</option>
              </select>
              {removeCashReasonType === 'Other' && (
                <input type="text" id="removeCashReasonManual" placeholder="Type specific reason..." style={{ marginTop: '0.75rem' }} />
              )}
            </div>
            <button className="settings-btn-danger" onClick={() => handleCashAdjustment('remove')} disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              <FaTimes /> Remove from Drawer
            </button>
          </div>
        </div>
      </div>
      
      <div className="time-range-selector" style={{ margin: '1rem 0' }}>
          <button className={cashFilter === 'today' ? 'active' : ''} onClick={() => setCashFilter('today')}>Today</button>
          <button className={cashFilter === 'weekly' ? 'active' : ''} onClick={() => setCashFilter('weekly')}>Weekly</button>
          <button className={cashFilter === 'monthly' ? 'active' : ''} onClick={() => setCashFilter('monthly')}>Monthly</button>
          <button className={cashFilter === 'yearly' ? 'active' : ''} onClick={() => setCashFilter('yearly')}>Yearly</button>
          <button className={cashFilter === 'custom' ? 'active' : ''} onClick={() => setCashFilter('custom')}>Custom</button>
        </div>

      {cashFilter === 'custom' && (
        <div className="custom-date-row fade-in" style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '1.25rem', 
          marginBottom: '1.5rem', 
          background: 'var(--color-surface-alt)', 
          padding: '1.25rem', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ color: 'var(--color-primary)', fontSize: '1.25rem', flexShrink: 0 }}>
            <FaCalendarAlt />
          </div>
          <div className="settings-form-control" style={{ marginBottom: 0, flex: 1 }}>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>From Date</label>
            <input 
              type="date" 
              value={cashFromDate} 
              onChange={(e) => setCashFromDate(e.target.value)} 
              style={{ fontWeight: 600 }}
            />
          </div>
          <div className="settings-form-control" style={{ marginBottom: 0, flex: 1 }}>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>To Date</label>
            <input 
              type="date" 
              value={cashToDate} 
              onChange={(e) => setCashToDate(e.target.value)} 
              style={{ fontWeight: 600 }}
            />
          </div>
        </div>
      )}


      <div className="settings-inner-card">
        <div className="breakdown-table">
          <div className="breakdown-row header">
            <div>Time</div>
            <div>Type</div>
            <div>Amount</div>
            <div>Reason</div>
          </div>
          {cashHistory.length === 0 ? (
            <div className="empty-text">No adjustments recorded for this period.</div>
          ) : cashHistory.map(tx => (
            <div className="breakdown-row" key={tx.id}>
              <div style={{ fontWeight: 500 }}>{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              <div style={{ color: tx.type === 'Add' ? 'var(--color-primary)' : '#ef4444', fontWeight: 'bold' }}>{tx.type}</div>
              <div style={{ fontWeight: 600 }}>NRP {tx.amount.toFixed(2)}</div>
              <div style={{ color: 'var(--color-text-secondary)' }}>{tx.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
