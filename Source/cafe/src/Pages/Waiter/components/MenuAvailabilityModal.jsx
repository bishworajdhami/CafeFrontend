import React from 'react';
import { FaCheckCircle, FaSearch, FaTimesCircle, FaUtensils } from 'react-icons/fa';

export default function MenuAvailabilityModal({
  isOpen,
  setMenuInfoModalOpen,
  menuItems,
  categories,
  menuSearchQuery,
  setMenuSearchQuery
}) {
  if (!isOpen) return null;

  return (
    <div className="wd-modal-backdrop" onClick={() => setMenuInfoModalOpen(false)}>
      <div className="wd-modal wd-menu-info-modal" onClick={e => e.stopPropagation()}>
        <div className="wd-modal-header">
          <div>
            <div className="wd-modal-title">Menu Availability</div>
            <div className="wd-modal-subtitle">{menuItems.length} items synced</div>
          </div>
          <button className="wd-modal-close" onClick={() => setMenuInfoModalOpen(false)}>x</button>
        </div>

        <div className="wd-menu-info-search">
          <div className="wd-search-input-wrap">
            <FaSearch />
            <input
              type="text"
              placeholder="Search dishes..."
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="wd-menu-info-content">
          {categories.map(cat => {
            const itemsInCat = menuItems.filter(item =>
              item.category === cat &&
              (menuSearchQuery === '' || item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()))
            );

            if (itemsInCat.length === 0) return null;

            return (
              <section key={cat} className="wd-menu-info-section">
                <h3 className="wd-menu-info-cat-title">{cat}</h3>
                <div className="wd-menu-info-list">
                  {itemsInCat.map(item => (
                    <div key={item.id} className={`wd-menu-info-item ${!item.isAvailable ? 'unavailable' : ''}`}>
                      <div className="wd-menu-info-item-main">
                        <span className="wd-menu-info-name">{item.name}</span>
                        <span className="wd-menu-info-price">Rs. {item.price}</span>
                      </div>
                      <div className={`wd-availability-badge ${item.isAvailable ? 'available' : 'sold-out'}`}>
                        {item.isAvailable ? <><FaCheckCircle /> Available</> : <><FaTimesCircle /> Sold Out</>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {menuItems.length === 0 && (
            <div className="wd-empty-state">
              <FaUtensils />
              <p>No menu items found.</p>
            </div>
          )}
        </div>

        <div className="wd-modal-footer">
          <button className="wd-btn-full" onClick={() => setMenuInfoModalOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
