import React from 'react';
import { FaArrowLeft, FaChair, FaCheck } from 'react-icons/fa';
import { MdTableRestaurant } from 'react-icons/md';

export default function SeatPickerView({
  selectedTable,
  tableConfig,
  seatStatusData,
  selectedWalkInSeats,
  setSelectedWalkInSeats,
  onBack,
  onContinue
}) {
  const floor = tableConfig.floors?.find(f => f.name === selectedTable?.floor);
  const maxSeats = floor?.customSeats?.[selectedTable?.table?.toString()]
    ? parseInt(floor.customSeats[selectedTable.table.toString()])
    : (parseInt(floor?.seats) || 4);

  return (
    <div className="wd-menu-view">
      <header className="wd-menu-header">
        <button className="wd-back-btn" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <MdTableRestaurant style={{ fontSize: '1.8rem', color: 'var(--color-primary)' }} />
          <div className="wd-menu-title">
            <h2>Select Seats</h2>
            <span>{selectedTable?.floor} - Table {selectedTable?.table}</span>
          </div>
        </div>
      </header>

      <main className="wd-seat-picker-main">
        <p className="wd-seat-picker-help">
          Tap available seats for new orders, or tap occupied seats to add items to an existing order.
        </p>

        <div className="wd-seat-grid">
          {Array.from({ length: maxSeats }, (_, i) => i + 1).map(seatNum => {
            const statusEntry = seatStatusData.find(s => s.seatNumber === seatNum);
            const isOccupied = statusEntry && statusEntry.status !== 'Available';
            const isSelected = selectedWalkInSeats.includes(seatNum);

            return (
              <button
                key={seatNum}
                className={`wd-seat-button ${isSelected ? 'selected' : ''} ${isOccupied ? 'occupied' : ''}`}
                onClick={() => {
                  setSelectedWalkInSeats(prev =>
                    prev.includes(seatNum)
                      ? prev.filter(s => s !== seatNum)
                      : [...prev, seatNum]
                  );
                }}
              >
                <FaChair className="wd-seat-icon" />
                <span className="wd-seat-number">{seatNum}</span>
                {isOccupied && !isSelected && <span className="wd-seat-status">Occupied</span>}
              </button>
            );
          })}
        </div>

        {selectedWalkInSeats.length > 0 && (
          <div className="wd-seat-selection-summary">
            Selected: Seat(s) {selectedWalkInSeats.slice().sort((a, b) => a - b).join(', ')}
          </div>
        )}

        <button
          className="wd-place-order-btn wd-seat-continue-btn"
          disabled={selectedWalkInSeats.length === 0}
          onClick={onContinue}
        >
          Continue to Menu <FaCheck className="wd-seat-continue-icon" />
        </button>
      </main>
    </div>
  );
}
