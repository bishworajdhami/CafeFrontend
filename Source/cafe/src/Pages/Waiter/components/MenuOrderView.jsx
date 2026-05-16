import React, { useState } from 'react';
import { FaArrowLeft, FaCheck, FaGift, FaMinus, FaPlus, FaShoppingCart, FaTrash, FaTimes } from 'react-icons/fa';
import { MdTableRestaurant } from 'react-icons/md';

export default function MenuOrderView({
  selectedTable,
  cart,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredMenuItems,
  settings,
  loading,
  linkedBookingId,
  setLinkedBookingId,
  applyBookingCharge,
  setApplyBookingCharge,
  getActiveOrUpcomingBookingForTable,
  openBookingForTable,
  calculateBookingCharge,
  calculateTotal,
  handlePlaceOrder,
  addToCart,
  removeFromCart,
  clearCart,
  onBack
}) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const existingBooking = getActiveOrUpcomingBookingForTable(selectedTable?.floor, selectedTable?.table);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const bookingCharge = calculateBookingCharge();

  return (
    <div className="wd-menu-view">
      <header className="wd-menu-header">
        <button className="wd-back-btn" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
          <MdTableRestaurant style={{ fontSize: '1.8rem', color: 'var(--color-primary)' }} />
          <div className="wd-menu-title">
            <h2>Table {selectedTable?.table}</h2>
            <span>{selectedTable?.floor}</span>
          </div>
        </div>
        <button 
          className="wd-cart-summary" 
          onClick={() => setIsCartOpen(true)}
          aria-label="View Cart"
        >
          <FaShoppingCart />
          <span className="wd-cart-count">{cartItemCount}</span>
        </button>
      </header>

      {/* Cart Info Modal */}
      {isCartOpen && (
        <div className="wd-modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="wd-cart-modal" onClick={e => e.stopPropagation()}>
            <div className="wd-cart-modal-header">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>Cart Items ({cartItemCount})</h3>
                {cart.length > 0 && (
                  <button className="wd-cart-clear-all" onClick={clearCart}>
                    <FaTrash /> Clear All
                  </button>
                )}
              </div>
              <button className="wd-modal-close" onClick={() => setIsCartOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="wd-cart-modal-body">
              {cart.length === 0 ? (
                <div className="wd-empty-cart-msg">Your cart is empty</div>
              ) : (
                <div className="wd-cart-items-list">
                  {cart.map(item => (
                    <div key={item.id} className="wd-cart-modal-item">
                      <div className="wd-cart-item-info">
                        <span className="wd-cart-item-name">{item.name}</span>
                        <span className="wd-cart-item-price">Rs. {item.price}</span>
                      </div>
                      <div className="wd-cart-item-actions">
                        <button onClick={() => removeFromCart(item.id)} className="wd-mini-btn"><FaMinus /></button>
                        <span className="wd-cart-item-qty">{item.quantity}</span>
                        <button onClick={() => addToCart(item)} className="wd-mini-btn"><FaPlus /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="wd-cart-modal-footer">
              <div className="wd-modal-total">
                <span>Total</span>
                <strong>Rs. {calculateTotal().toFixed(2)}</strong>
              </div>
              <button 
                className="wd-modal-close-btn" 
                onClick={() => setIsCartOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {existingBooking ? (
        <div className={`wd-menu-booking-alert ${linkedBookingId === existingBooking.id ? 'linked' : ''}`}>
          <div className="wd-menu-booking-header">
            <span className="wd-menu-booking-name">
              <FaGift className="wd-inline-icon" /> {existingBooking.customerName || 'Walk-in / Occupied'}
            </span>
            {linkedBookingId === existingBooking.id ? (
              <span className="wd-linked-badge"><FaCheck /> Linked</span>
            ) : (
              <button
                className="wd-link-booking-btn"
                onClick={() => {
                  setLinkedBookingId(existingBooking.id);
                  setApplyBookingCharge(true);
                }}
              >
                Link
              </button>
            )}
          </div>

          {linkedBookingId === existingBooking.id && settings.tableBookingCharge > 0 && (
            <div className="wd-booking-charge-row">
              {existingBooking.customerName && existingBooking.customerName !== 'Walk-in / Occupied' ? (
                <div className="wd-charge-applied">
                  <FaCheck className="wd-success-icon" />
                  Charge Applied: Rs. {bookingCharge.toFixed(2)}
                </div>
              ) : (
                <label className="wd-charge-toggle">
                  <input
                    type="checkbox"
                    checked={applyBookingCharge}
                    onChange={(e) => setApplyBookingCharge(e.target.checked)}
                  />
                  Apply Booking Charge (Rs. {bookingCharge.toFixed(2)})
                </label>
              )}
              <button
                className="wd-unlink-btn"
                onClick={() => {
                  setLinkedBookingId(null);
                  setApplyBookingCharge(false);
                }}
              >
                Unlink
              </button>
            </div>
          )}
        </div>
      ) : settings.enableTableBooking !== false ? (
        <div className="wd-menu-booking-options-container">
          <button
            className="wd-btn-booking-named"
            onClick={() => openBookingForTable(selectedTable?.floor, selectedTable?.table)}
          >
            <FaGift /> Book with Name & Number
          </button>
        </div>
      ) : null}

      <div className="wd-category-scroll">
        {categories.map(cat => (
          <button
            key={cat}
            className={`wd-cat-pill ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <main className="wd-menu-main">
        <div className="wd-menu-grid">
          {filteredMenuItems.map(item => {
            const cartItem = cart.find(i => i.id === item.id);
            return (
              <div key={item.id} className={`wd-menu-card ${!item.isAvailable ? 'unavailable' : ''}`}>
                <div className="wd-menu-card-info">
                  <h3>{item.name}</h3>
                  <span className="wd-menu-price">Rs. {item.price}</span>
                </div>
                {!item.isAvailable ? (
                  <span className="wd-sold-out-text">Sold Out</span>
                ) : cartItem ? (
                  <div className="wd-item-controls">
                    <button onClick={() => removeFromCart(item.id)}><FaMinus /></button>
                    <span>{cartItem.quantity}</span>
                    <button onClick={() => addToCart(item)}><FaPlus /></button>
                  </div>
                ) : (
                  <button className="wd-add-btn" onClick={() => addToCart(item)}>
                    <FaPlus />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {(cart.length > 0 || bookingCharge > 0) && (
        <footer className="wd-menu-footer">
          <div className="wd-total-info">
            <span>Total Amount</span>
            <strong>Rs. {calculateTotal().toFixed(2)}</strong>
            {bookingCharge > 0 && (
              <span className="wd-menu-footer-charge">incl. Booking: Rs. {bookingCharge.toFixed(2)}</span>
            )}
          </div>
          <button className="wd-place-order-btn" onClick={handlePlaceOrder} disabled={loading}>
            {loading ? 'Sending...' : <>Place Order <FaCheck /></>}
          </button>
        </footer>
      )}
    </div>
  );
}
