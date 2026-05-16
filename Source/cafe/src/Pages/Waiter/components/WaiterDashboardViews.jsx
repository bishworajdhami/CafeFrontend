import React from 'react';
import {
  FaBell,
  FaChair,
  FaCog,
  FaExclamationCircle,
  FaListAlt,
  FaSignOutAlt,
  FaUserCircle,
  FaUtensils,
  FaPlus
} from 'react-icons/fa';
import { MdTableRestaurant } from 'react-icons/md';

import EmptyState from '../../../components/common/EmptyState';
import { getImageUrl } from '../../../utils/api';

export default function WaiterDashboardViews({
  view,
  setView,
  settings,
  isConnected,
  setMenuInfoModalOpen,
  tableConfig,
  activeFloor,
  setActiveFloor,
  currentFloor,
  getTableStatus,
  getActiveOrUpcomingBookingForTable,
  formatTimeShort,
  handleTableClick,
  openBookingForTable,
  activeOrders,
  alerts,
  dismissAlert,
  profilePictureUrl,
  userName,
  userRole,
  setProfileModalOpen,
  handleLogout
}) {
  return (
    <>
      <header className="wd-waiter-header">
        <div className="wd-waiter-header-left">
          <div className="wd-branding-section">
            {settings.cafeLogo ? (
              <img src={getImageUrl(settings.cafeLogo)} alt="Logo" className="wd-header-logo" />
            ) : (
              <div className="wd-header-logo-fallback"><FaUtensils /></div>
            )}
            <div className="wd-branding-text">
              <h1 className="wd-cafe-name-title">{settings.cafeName || 'Cafe'}</h1>
              <div className="wd-view-status-row">
                <span className="wd-view-subtitle">
                  {view === 'tables' && 'Tables'}
                  {view === 'orders' && 'Orders'}
                  {view === 'alerts' && 'Notifications'}
                  {view === 'profile' && 'Profile'}
                </span>
                <span className={`wd-waiter-status-pill ${isConnected ? 'online' : 'offline'}`}>
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="wd-waiter-header-actions">
          <button className="wd-icon-btn primary" onClick={() => setMenuInfoModalOpen(true)} title="Check Menu Availability">
            <FaUtensils />
          </button>
        </div>
      </header>

      {view === 'tables' && (
        <>
          {tableConfig.floors && tableConfig.floors.length > 0 && (
            <div className="wd-floor-tabs">
              {tableConfig.floors.map((floor, idx) => (
                <button
                  key={idx}
                  className={`wd-floor-tab ${activeFloor === idx ? 'active' : ''}`}
                  onClick={() => setActiveFloor(idx)}
                >
                  {floor.name || `Floor ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          <main className="wd-waiter-main">
            <div className="wd-table-grid">
              {currentFloor && Array.from({ length: currentFloor.tableCount || 0 }, (_, i) => {
                const tableNum = i + 1;
                const tableSeats = currentFloor.customSeats?.[tableNum.toString()] !== undefined
                  ? parseInt(currentFloor.customSeats[tableNum.toString()])
                  : (parseInt(currentFloor.seats) || 4);

                const status = getTableStatus(currentFloor.name, tableNum);
                const booking = getActiveOrUpcomingBookingForTable(currentFloor.name, tableNum);

                return (
                  <div
                    key={tableNum}
                    className={`wd-table-card ${status}`}
                    onClick={() => handleTableClick(currentFloor.name, tableNum)}
                  >
                    <div className="wd-table-icon"><MdTableRestaurant /></div>
                    <div className="wd-table-info">
                      <span className="wd-table-number">Table {tableNum}</span>
                    </div>
                    <span className="wd-table-status-text">{status.toUpperCase()}</span>
                    {booking && (
                      <div className="wd-table-booking-mini">
                        <div className="wd-table-booking-name">{booking.customerName || 'Booked'}</div>
                        {booking.endTime && (
                          <div className="wd-table-booking-time">Until {formatTimeShort(booking.endTime)}</div>
                        )}
                      </div>
                    )}
                    <div className="wd-table-footer">
                      <FaChair /> {tableSeats}
                    </div>
                    <button
                      type="button"
                      className="wd-table-book-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openBookingForTable(currentFloor.name, tableNum);
                      }}
                      disabled={status !== 'available'}
                      title={status === 'available' ? 'Book this table' : 'Table is not available'}
                    >
                      <FaPlus />
                    </button>
                  </div>
                );
              })}
            </div>
          </main>
        </>
      )}

      {view === 'orders' && (
        <main className="wd-waiter-main">
          {activeOrders.length === 0 ? (
            <EmptyState icon={FaListAlt} message="No active orders currently." className="wd-empty-state" />
          ) : (
            <div className="wd-orders-list">
              {activeOrders.map(order => (
                <div key={order.id} className="wd-order-list-card">
                  <div className="wd-order-list-header">
                    <div>
                      <h3 className="wd-order-list-title">
                        {order.orderType === 'dine-in'
                          ? `Table ${order.tableNumber}${order.seatNumbers?.length > 0 ? ` (Seat ${order.seatNumbers.join(', ')})` : ''}`
                          : 'Takeaway'}
                      </h3>
                      <span className="wd-order-list-meta">
                        Order #{order.id} - {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className={`wd-order-list-status ${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="wd-order-list-items">
                    {order.items.reduce((acc, item) => acc + item.quantity, 0)} Items - Rs. {order.total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {view === 'alerts' && (
        <main className="wd-waiter-main">
          {alerts.length === 0 ? (
            <EmptyState icon={FaBell} message="No new notifications." className="wd-empty-state" />
          ) : (
            <div className="wd-alerts-list">
              {alerts.map(alert => (
                <div key={alert.id} className="wd-alert-card wd-alert-card-list" onClick={() => dismissAlert(alert.id)}>
                  <FaExclamationCircle className="wd-alert-icon" />
                  <div className="wd-alert-content">
                    <strong>Order Ready!</strong>
                    <span>Table {alert.table} ({alert.floor})</span>
                  </div>
                  <span className="wd-alert-time">{alert.time}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {view === 'profile' && (
        <main className="wd-waiter-main">
          <div className="wd-profile-summary-card">
            <div className="wd-profile-avatar-large">
              {profilePictureUrl ? (
                <img src={getImageUrl(profilePictureUrl)} alt={userName} className="wd-profile-img" />
              ) : (
                <div className="wd-profile-initials">{userName.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className="wd-profile-info-stack">
              <h2>{userName}</h2>
              <p className="wd-profile-role-badge">{userRole}</p>
            </div>

            <div className="wd-profile-actions-grid">
              <button className="wd-profile-main-action" onClick={() => setProfileModalOpen(true)}>
                <FaCog /> Profile Settings
              </button>
              <button className="wd-profile-logout-btn" onClick={handleLogout}>
                <FaSignOutAlt /> Log Out
              </button>
            </div>
          </div>

          <div className="wd-profile-stats">
            <div className="wd-stat-item">
              <span className="wd-stat-value">{activeOrders.length}</span>
              <span className="wd-stat-label">Active Orders</span>
            </div>
            <div className="wd-stat-item">
              <span className="wd-stat-value">{alerts.length}</span>
              <span className="wd-stat-label">Notifications</span>
            </div>
          </div>
        </main>
      )}

      <nav className="wd-waiter-nav">
        <button className={`wd-nav-item ${view === 'tables' ? 'active' : ''}`} onClick={() => setView('tables')}>
          <MdTableRestaurant />
          <span>Tables</span>
        </button>
        <button className={`wd-nav-item ${view === 'orders' ? 'active' : ''}`} onClick={() => setView('orders')}>
          <FaListAlt />
          <span>Orders</span>
        </button>
        <button className={`wd-nav-item ${view === 'alerts' ? 'active' : ''}`} onClick={() => setView('alerts')}>
          <div className="wd-nav-alert-wrap">
            <FaBell />
            {alerts.length > 0 && <span className="wd-alert-dot"></span>}
          </div>
          <span>Alerts</span>
        </button>
        <button className={`wd-nav-item ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
          <div className="wd-nav-profile-wrap">
            {profilePictureUrl ? (
              <img src={getImageUrl(profilePictureUrl)} alt="Profile" className="wd-nav-profile-img" />
            ) : (
              <FaUserCircle />
            )}
          </div>
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
}
