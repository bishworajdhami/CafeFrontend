import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SocketProvider } from './SocketContext';
import DashboardShellSkeleton from './components/skeletons/DashboardShellSkeleton';
import LoginPage from './Pages/Login/LoginPage.jsx';
import FirstLoginOTPPage from './Pages/FirstLoginOTP/FirstLoginOTP.jsx';
import SetNewPasswordPage from './Pages/SetNewPassword/SetNewPassword.jsx';
import ForgotPasswordPage from './Pages/ForgotPassword/ForgotPassword.jsx';
import ResetPasswordOTPPage from './Pages/ResetPasswordOTP/ResetPasswordOTP.jsx';
import ResetPasswordPage from './Pages/ResetPassword/ResetPassword.jsx';
import ManagerDashboard from './Pages/Manager/ManagerDashboard.jsx';
import CashierDashboard from './Pages/Cashier/CashierDashboard.jsx';
import ChefDashboard from './Pages/Chef/ChefDashboard.jsx';
import WaiterDashboard from './Pages/Waiter/WaiterDashboard.jsx';


// Very small auth guard example
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

// Role-based route guard
function RoleBasedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/first-login-otp" element={<FirstLoginOTPPage />} />
          <Route path="/set-new-password" element={<SetNewPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password-otp" element={<ResetPasswordOTPPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/manager" element={
            <RoleBasedRoute requiredRole="Manager">
              <ManagerDashboard />
            </RoleBasedRoute>
          } />
          <Route path="/cashier" element={
            <RoleBasedRoute requiredRole="Cashier">
              <CashierDashboard />
            </RoleBasedRoute>
          } />
          <Route path="/chef" element={
            <RoleBasedRoute requiredRole="Chef">
              <ChefDashboard />
            </RoleBasedRoute>
          } />
          <Route path="/waiter" element={
            <RoleBasedRoute requiredRole="Waiter">
              <WaiterDashboard />
            </RoleBasedRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

function Dashboard() {
  const role = localStorage.getItem('role') || 'Unknown';
  const navigate = useNavigate();

  // Redirect users to their respective dashboards
  React.useEffect(() => {
    if (role === 'Manager') {
      navigate('/manager');
    } else if (role === 'Cashier') {
      navigate('/cashier');
    } else if (role === 'Chef') {
      navigate('/chef');
    } else if (role === 'Waiter') {
      navigate('/waiter');
    }

  }, [role, navigate]);

  return <DashboardShellSkeleton />;
}