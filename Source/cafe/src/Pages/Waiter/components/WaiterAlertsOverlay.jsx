import React from 'react';
import { FaExclamationCircle } from 'react-icons/fa';

export default function WaiterAlertsOverlay({ alerts, view, onDismiss }) {
  if (alerts.length === 0 || view === 'alerts') return null;

  return (
    <div className="wd-alerts-container">
      {alerts.map(alert => (
        <div key={alert.id} className="wd-alert-card" onClick={() => onDismiss(alert.id)}>
          <FaExclamationCircle className="wd-alert-icon" />
          <div className="wd-alert-content">
            <strong>Order Ready!</strong>
            <span>Table {alert.table} ({alert.floor})</span>
          </div>
          <span className="wd-alert-time">{alert.time}</span>
        </div>
      ))}
    </div>
  );
}
