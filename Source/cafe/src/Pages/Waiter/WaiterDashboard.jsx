import React from 'react';

import Modal from '../../components/Modal';
import BookingModal from './components/BookingModal';
import MenuAvailabilityModal from './components/MenuAvailabilityModal';
import MenuOrderView from './components/MenuOrderView';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import SeatPickerView from './components/SeatPickerView';
import WaiterAlertsOverlay from './components/WaiterAlertsOverlay';
import WaiterDashboardViews from './components/WaiterDashboardViews';
import useWaiterDashboard from './hooks/useWaiterDashboard';
import './WaiterDashboard.css';

export default function WaiterDashboard() {
  const dashboard = useWaiterDashboard();
  const touchRef = React.useRef({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    const deltaX = e.changedTouches[0].clientX - touchRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchRef.current.y;

    // Detect horizontal swipe (distance > 70px and more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 70) {
      const direction = deltaX < 0 ? 'next' : 'prev';
      handleSwipe(direction);
    }
  };

  const handleSwipe = (direction) => {
    const { view, setView, activeFloor, setActiveFloor, tableConfig, categories, selectedCategory, setSelectedCategory } = dashboard;
    
    // Support "Back" gesture (Right swipe to go back to tables)
    if (direction === 'prev') {
      if (view === 'seats') {
        setView('tables');
        return;
      }
      if (view === 'menu') {
        const currentIndex = categories.indexOf(selectedCategory);
        // If on the first category, right swipe goes back to tables
        if (currentIndex <= 0) {
          setView('tables');
          return;
        }
      }
    }

    // In tables view, horizontal swipe switches floors
    if (view === 'tables') {
      const floorCount = tableConfig.floors?.length || 0;
      if (direction === 'next' && activeFloor < floorCount - 1) {
        setActiveFloor(activeFloor + 1);
        return;
      } else if (direction === 'prev' && activeFloor > 0) {
        setActiveFloor(activeFloor - 1);
        return;
      }
    }

    // In menu view, horizontal swipe switches categories
    if (view === 'menu' && categories?.length > 0) {
      const currentIndex = categories.indexOf(selectedCategory);
      if (direction === 'next' && currentIndex < categories.length - 1) {
        setSelectedCategory(categories[currentIndex + 1]);
        return;
      } else if (direction === 'prev' && currentIndex > 0) {
        setSelectedCategory(categories[currentIndex - 1]);
        return;
      }
    }

    // In main views, swipe between tabs
    const mainViews = ['tables', 'orders', 'alerts', 'profile'];
    if (mainViews.includes(view)) {
      const currentIndex = mainViews.indexOf(view);
      if (direction === 'next' && currentIndex < mainViews.length - 1) {
        setView(mainViews[currentIndex + 1]);
      } else if (direction === 'prev' && currentIndex > 0) {
        setView(mainViews[currentIndex - 1]);
      }
    }
  };

  if (dashboard.loading && dashboard.view === 'tables') {
    return <div className="wd-waiter-loader"><div className="standard-loader"></div></div>;
  }

  return (
    <div 
      className="wd-waiter-mobile-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <WaiterAlertsOverlay
        alerts={dashboard.alerts}
        view={dashboard.view}
        onDismiss={dashboard.dismissAlert}
      />

      {dashboard.view === 'seats' && (
        <SeatPickerView
          selectedTable={dashboard.selectedTable}
          tableConfig={dashboard.tableConfig}
          seatStatusData={dashboard.seatStatusData}
          selectedWalkInSeats={dashboard.selectedWalkInSeats}
          setSelectedWalkInSeats={dashboard.setSelectedWalkInSeats}
          onBack={() => dashboard.setView('tables')}
          onContinue={() => {
            if (dashboard.selectedWalkInSeats.length === 0) return;
            dashboard.setView('menu');
          }}
        />
      )}

      {dashboard.view === 'menu' ? (
        <MenuOrderView
          selectedTable={dashboard.selectedTable}
          cart={dashboard.cart}
          categories={dashboard.categories}
          selectedCategory={dashboard.selectedCategory}
          setSelectedCategory={dashboard.setSelectedCategory}
          filteredMenuItems={dashboard.filteredMenuItems}
          settings={dashboard.settings}
          loading={dashboard.loading}
          linkedBookingId={dashboard.linkedBookingId}
          setLinkedBookingId={dashboard.setLinkedBookingId}
          applyBookingCharge={dashboard.applyBookingCharge}
          setApplyBookingCharge={dashboard.setApplyBookingCharge}
          getActiveOrUpcomingBookingForTable={dashboard.getActiveOrUpcomingBookingForTable}
          openBookingForTable={dashboard.openBookingForTable}
          calculateBookingCharge={dashboard.calculateBookingCharge}
          calculateTotal={dashboard.calculateTotal}
          handlePlaceOrder={dashboard.handlePlaceOrder}
          addToCart={dashboard.addToCart}
          removeFromCart={dashboard.removeFromCart}
          clearCart={dashboard.clearCart}
          onBack={() => dashboard.setView('tables')}
        />
      ) : (
        dashboard.view !== 'seats' && (
          <WaiterDashboardViews
            view={dashboard.view}
            setView={dashboard.setView}
            settings={dashboard.settings}
            isConnected={dashboard.isConnected}
            setMenuInfoModalOpen={dashboard.setMenuInfoModalOpen}
            tableConfig={dashboard.tableConfig}
            activeFloor={dashboard.activeFloor}
            setActiveFloor={dashboard.setActiveFloor}
            currentFloor={dashboard.currentFloor}
            getTableStatus={dashboard.getTableStatus}
            getActiveOrUpcomingBookingForTable={dashboard.getActiveOrUpcomingBookingForTable}
            formatTimeShort={dashboard.formatTimeShort}
            handleTableClick={dashboard.handleTableClick}
            openBookingForTable={dashboard.openBookingForTable}
            activeOrders={dashboard.activeOrders}
            alerts={dashboard.alerts}
            dismissAlert={dashboard.dismissAlert}
            profilePictureUrl={dashboard.profilePictureUrl}
            userName={dashboard.userName}
            userRole={dashboard.userRole}
            setProfileModalOpen={dashboard.setProfileModalOpen}
            handleLogout={dashboard.handleLogout}
          />
        )
      )}

      <BookingModal
        isOpen={dashboard.bookingModalOpen}
        bookingSubmitting={dashboard.bookingSubmitting}
        setBookingModalOpen={dashboard.setBookingModalOpen}
        selectedTable={dashboard.selectedTable}
        tableConfig={dashboard.tableConfig}
        bookingError={dashboard.bookingError}
        bookingForm={dashboard.bookingForm}
        setBookingForm={dashboard.setBookingForm}
        createBooking={dashboard.createBooking}
      />

      <ProfileSettingsModal
        isOpen={dashboard.profileModalOpen}
        loading={dashboard.loading}
        passwordSubmitting={dashboard.passwordSubmitting}
        setProfileModalOpen={dashboard.setProfileModalOpen}
        profilePictureUrl={dashboard.profilePictureUrl}
        userName={dashboard.userName}
        fileInputRef={dashboard.fileInputRef}
        handleDeleteProfilePicture={dashboard.handleDeleteProfilePicture}
        handleProfilePictureUpload={dashboard.handleProfilePictureUpload}
        newName={dashboard.newName}
        setNewName={dashboard.setNewName}
        handleNameUpdate={dashboard.handleNameUpdate}
        passwordError={dashboard.passwordError}
        passwordSuccess={dashboard.passwordSuccess}
        passwordForm={dashboard.passwordForm}
        setPasswordForm={dashboard.setPasswordForm}
        handlePasswordUpdate={dashboard.handlePasswordUpdate}
      />

      <MenuAvailabilityModal
        isOpen={dashboard.menuInfoModalOpen}
        setMenuInfoModalOpen={dashboard.setMenuInfoModalOpen}
        menuItems={dashboard.menuItems}
        categories={dashboard.categories}
        menuSearchQuery={dashboard.menuSearchQuery}
        setMenuSearchQuery={dashboard.setMenuSearchQuery}
      />

      <Modal
        isOpen={dashboard.confirmModal.show}
        title={dashboard.confirmModal.title}
        message={dashboard.confirmModal.message}
        type={dashboard.confirmModal.type}
        onConfirm={dashboard.confirmModal.onConfirm}
        onCancel={() => dashboard.setConfirmModal(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}
