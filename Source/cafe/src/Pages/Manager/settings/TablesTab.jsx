import { FaPlus, FaTrash, FaCog, FaTimes, FaTable, FaBuilding, FaChair, FaUsers, FaLayerGroup, FaMoneyBillWave } from 'react-icons/fa';

export default function TablesTab({
  tableBookingCharge, setTableBookingCharge,
  tableBookingChargeType, setTableBookingChargeType,
  tableConfiguration,
  updateFloor, removeFloor, addFloor,
  openSeatConfig,
  seatConfigModal, setSeatConfigModal, handleSeatConfigSave, updateTableSeat,
  onSave, loading
}) {
  const floors = tableConfiguration.floors || [];
  const totalFloors = floors.length;
  const totalTables = floors.reduce((sum, f) => sum + (parseInt(f.tableCount) || 0), 0);
  const totalSeats = floors.reduce((sum, f) => {
    const floorDefault = parseInt(f.seats) || 4;
    const tableCount = parseInt(f.tableCount) || 0;
    const customSeats = f.customSeats || {};
    
    let floorSeats = 0;
    for (let i = 1; i <= tableCount; i++) {
        floorSeats += customSeats[i.toString()] !== undefined ? parseInt(customSeats[i.toString()]) : floorDefault;
    }
    return sum + floorSeats;
  }, 0);

  return (
    <>
      <div className="settings-tab-container cc-fadeIn">
      {/* Seating Stats KPIs */}
      <div className="settings-modern-kpi-grid">
        <div className="settings-modern-kpi-card">
          <div className="kpi-icon floors"><FaLayerGroup /></div>
          <div className="kpi-data">
            <span className="kpi-label">Active Floors</span>
            <span className="kpi-value">{totalFloors}</span>
          </div>
        </div>
        <div className="settings-modern-kpi-card">
          <div className="kpi-icon tables"><FaTable /></div>
          <div className="kpi-data">
            <span className="kpi-label">Total Tables</span>
            <span className="kpi-value">{totalTables}</span>
          </div>
        </div>
        <div className="settings-modern-kpi-card">
          <div className="kpi-icon seats"><FaUsers /></div>
          <div className="kpi-data">
            <span className="kpi-label">Seating Capacity</span>
            <span className="kpi-value">{totalSeats}</span>
          </div>
        </div>
      </div>

      <div className="settings-section-grid">
        <div className="settings-panel full-width">
          <div className="settings-panel-header flex-between">
            <div>
              <h3><FaBuilding /> Floor Configuration</h3>
              <p>Manage areas, table counts, and default seating</p>
            </div>
            <button className="settings-btn-add-floor" onClick={addFloor}>
              <FaPlus /> Add Area
            </button>
          </div>
          
          <div className="settings-panel-content">
            <div className="floors-modern-grid">
              {floors.map((floor, idx) => {
                const floorSeats = Array.from({ length: floor.tableCount || 0 }, (_, i) => {
                  const tableNum = (i + 1).toString();
                  return floor.customSeats?.[tableNum] !== undefined ? parseInt(floor.customSeats[tableNum]) : (parseInt(floor.seats) || 4);
                }).reduce((a, b) => a + b, 0);

                return (
                  <div key={floor.id} className="floor-modern-card">
                    <div className="floor-card-top">
                      <div className="floor-identity">
                        <div className="floor-index">{idx + 1}</div>
                        <input
                          type="text"
                          value={floor.name}
                          placeholder="Floor Name"
                          onChange={e => updateFloor(idx, 'name', e.target.value)}
                        />
                      </div>
                      <button className="floor-delete-btn" onClick={() => removeFloor(idx)}>
                        <FaTrash />
                      </button>
                    </div>

                    <div className="floor-card-stats-row">
                      <div className="floor-input-group">
                        <label>Tables</label>
                        <input
                          type="number" min="1" max="100"
                          value={floor.tableCount}
                          onChange={e => updateFloor(idx, 'tableCount', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="floor-input-group">
                        <label>Default Seats</label>
                        <div className="input-with-action">
                          <input
                            type="number" min="1" max="20"
                            value={floor.seats || 4}
                            onChange={e => updateFloor(idx, 'seats', parseInt(e.target.value))}
                          />
                          <button onClick={() => openSeatConfig(idx)} title="Custom Table Seats">
                            <FaCog />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="floor-card-footer">
                      <FaChair /> {floorSeats} Total Seats
                    </div>
                  </div>
                );
              })}
            </div>

            {floors.length === 0 && (
              <div className="settings-empty-state">
                <FaLayerGroup />
                <p>No areas defined. Create your first floor to begin configuration.</p>
              </div>
            )}
          </div>
        </div>

        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3><FaMoneyBillWave /> Reservation Rules</h3>
            <p>Define booking fees and billing logic</p>
          </div>
          <div className="settings-panel-content">
            <div className="settings-modern-form">
              <div className="form-group">
                <label>Booking Charge (NRP)</label>
                <div className="input-with-currency">
                  <span className="currency-symbol">Rs.</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={tableBookingCharge}
                    onChange={e => setTableBookingCharge(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Charge Basis</label>
                <select
                  value={tableBookingChargeType}
                  onChange={e => setTableBookingChargeType(e.target.value)}
                  className="settings-select"
                >
                  <option value="per_hour">Per Hour</option>
                  <option value="per_minute">Per Minute</option>
                </select>
              </div>
            </div>
            
            <div className="settings-info-alert info">
              <p>
                {tableBookingChargeType === 'per_hour' ? 
                  'Billing is calculated based on full hours of reservation.' : 
                  'Billing is calculated per minute for granular tracking.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Seat Configuration Modal */}
      {seatConfigModal.show && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Configure Seats - {seatConfigModal.floorName}</h2>
              <button className="modal-close-btn" onClick={() => setSeatConfigModal({ ...seatConfigModal, show: false })}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1rem' }}>
              <p className="settings-hint" style={{ marginBottom: '1rem' }}>
                Set custom seat counts for specific tables. Tables left blank or set to default will use the floor default ({seatConfigModal.defaultSeats} seats).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                {Array.from({ length: seatConfigModal.tableCount }, (_, i) => {
                  const tableNum = (i + 1).toString();
                  const currentVal = seatConfigModal.seats[tableNum] !== undefined
                    ? seatConfigModal.seats[tableNum]
                    : seatConfigModal.defaultSeats;

                  const isCustom = seatConfigModal.seats[tableNum] !== undefined && seatConfigModal.seats[tableNum] !== seatConfigModal.defaultSeats;

                  return (
                    <div key={tableNum} style={{
                      background: isCustom ? '#eff6ff' : '#f8fafc',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: isCustom ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Table {tableNum}</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={currentVal}
                        onChange={(e) => updateTableSeat(tableNum, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontWeight: isCustom ? 'bold' : 'normal'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="settings-btn-secondary" onClick={() => setSeatConfigModal({ ...seatConfigModal, show: false })}>
                Cancel
              </button>
              <button className="settings-btn-primary" onClick={handleSeatConfigSave}>
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
