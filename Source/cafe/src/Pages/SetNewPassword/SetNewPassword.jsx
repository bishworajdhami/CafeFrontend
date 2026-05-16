import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { postJson } from '../../utils/api';
import AuthLogo from '../../components/AuthLogo/AuthLogo';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './SetNewPassword.css';

export default function SetNewPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get email from navigation state or sessionStorage
  const email = location.state?.email || sessionStorage.getItem('firstLoginEmail');

  useEffect(() => {
    if (!email) {
      // If no email, redirect back to login
      navigate('/login', { replace: true });
      return;
    }
  }, [email, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validation
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await postJson('/api/auth/set-new-password', {
        email: email,
        newPassword: newPassword
      });

      if (response?.status) {
        // Store token and role for immediate login
        const token = response?.token;
        const role = response?.role;

        if (token) {
          localStorage.setItem('token', token);
          localStorage.setItem('email', email);
          const userName = response?.name || response?.Name;
          if (userName) localStorage.setItem('name', userName);
          if (role) localStorage.setItem('role', role);

          // Store permissions
          const permissions = response?.permissions || response?.Permissions || '';
          localStorage.setItem('permissions', permissions);
        }

        // Clear session storage
        sessionStorage.removeItem('firstLoginEmail');
        sessionStorage.removeItem('firstLoginOTP');

        // Redirect to appropriate dashboard
        if (role === 'Manager') {
          navigate('/manager', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        setError(response?.message || 'Failed to set new password. Please try again.');
      }
    } catch (err) {
      console.error('Set password error:', err);
      setError(err.message || 'Failed to set new password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <main className="auth-page-split">
        <div className="auth-banner-side"></div>
        <div className="auth-form-side">
          <div className="auth-card">
            <h1 className="auth-title">Error</h1>
            <p className="auth-subtitle">
              No email found. Please <Link to="/login">login</Link> again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page-split">
      <div className="auth-banner-side">
        <AuthLogo />
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h1 className="auth-title">Set Your Password</h1>
          <p className="auth-subtitle">
            Please set a new password for your account.
            <br />
            <small>This will be your permanent password for future logins.</small>
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              New Password
              <div className="password-input-wrapper">
                <input
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={loading}
                  placeholder="At least 6 characters"
                  minLength={6}
                />
                <button type="button" className="password-toggle-btn" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </label>

            <label>
              Confirm New Password
              <div className="password-input-wrapper">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Re-enter your new password"
                />
                <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </label>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Setting Password...' : 'Set Password & Login'}
            </button>
          </form>

          <div className="auth-switch">
            <Link to="/login"
              onClick={() => {
                sessionStorage.removeItem('firstLoginEmail');
                sessionStorage.removeItem('firstLoginOTP');
              }}
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

