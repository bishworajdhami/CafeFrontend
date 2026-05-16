import React from 'react';
import { MdTableRestaurant } from 'react-icons/md';

export default function BookingModal({
  isOpen,
  bookingSubmitting,
  setBookingModalOpen,
  selectedTable,
  tableConfig,
  bookingError,
  bookingForm,
  setBookingForm,
  createBooking
}) {
  if (!isOpen) return null;

  const floor = tableConfig.floors?.find(f => f.name === selectedTable?.floor);
  const seatCount = floor?.customSeats?.[selectedTable?.table?.toString()] !== undefined
    ? floor.customSeats[selectedTable?.table.toString()]
    : (floor?.seats || 4);
  const minStartTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="wd-modal-backdrop" onClick={() => !bookingSubmitting && setBookingModalOpen(false)}>
      <div className="wd-modal" onClick={e => e.stopPropagation()}>
        <div className="wd-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <MdTableRestaurant style={{ fontSize: '1.6rem', color: 'var(--color-primary)' }} />
            <div>
              <div className="wd-modal-title">Book Table</div>
              <div className="wd-modal-subtitle">
                {selectedTable?.floor} - Table {selectedTable?.table} ({seatCount} seats)
              </div>
            </div>
          </div>
          <button className="wd-modal-close" onClick={() => setBookingModalOpen(false)}>x</button>
        </div>

        {bookingError && <div className="wd-form-error">{bookingError}</div>}

        <div className="wd-form-grid">
          <div className="wd-form-field">
            <label className="wd-form-label">Customer name</label>
            <input
              className="wd-form-input"
              value={bookingForm.customerName}
              onChange={(e) => setBookingForm(prev => ({ ...prev, customerName: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div className="wd-form-field">
            <label className="wd-form-label">Customer phone</label>
            <input
              className="wd-form-input"
              value={bookingForm.customerPhone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                setBookingForm(prev => ({ ...prev, customerPhone: value }));
              }}
              placeholder="10-digit phone"
              inputMode="numeric"
            />
          </div>

          <div className="wd-form-field wd-form-field-row">
            <label className="wd-form-label">Guests</label>
            <input
              className="wd-form-input"
              type="number"
              min={1}
              value={bookingForm.partySize}
              onChange={(e) => setBookingForm(prev => ({ ...prev, partySize: e.target.value }))}
            />
          </div>

          <div className="wd-form-field">
            <label className="wd-form-label">Start time</label>
            <input
              className="wd-form-input"
              type="datetime-local"
              value={bookingForm.startTime}
              onChange={(e) => setBookingForm(prev => ({ ...prev, startTime: e.target.value }))}
              min={minStartTime}
            />
          </div>

          <div className="wd-form-field">
            <label className="wd-form-label">Duration</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                <input
                  className="wd-form-input"
                  type="number"
                  min="0"
                  value={Math.floor(bookingForm.durationMinutes / 60)}
                  onChange={(e) => {
                    const h = parseInt(e.target.value) || 0;
                    const m = bookingForm.durationMinutes % 60;
                    setBookingForm(prev => ({ ...prev, durationMinutes: (h * 60) + m }));
                  }}
                  placeholder="Hrs"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>h</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                <input
                  className="wd-form-input"
                  type="number"
                  min="0"
                  max="59"
                  value={bookingForm.durationMinutes % 60}
                  onChange={(e) => {
                    const m = parseInt(e.target.value) || 0;
                    const h = Math.floor(bookingForm.durationMinutes / 60);
                    setBookingForm(prev => ({ ...prev, durationMinutes: (h * 60) + m }));
                  }}
                  placeholder="Min"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>m</span>
              </div>
            </div>
            <div className="wd-form-hint">
              Total: {bookingForm.durationMinutes} minutes
            </div>
          </div>
        </div>

        <div className="wd-modal-actions">
          <button className="wd-btn-secondary" onClick={() => setBookingModalOpen(false)} disabled={bookingSubmitting}>
            Cancel
          </button>
          <button className="wd-btn-primary" onClick={createBooking} disabled={bookingSubmitting}>
            {bookingSubmitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
