import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { postJson } from '../../utils/api';
import AuthLogo from '../../components/AuthLogo/AuthLogo';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './ResetPassword.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Get email and OTP from navigation state or sessionStorage
  const email = location.state?.email || sessionStorage.getItem('resetPasswordEmail');
  const otp = location.state?.otp || sessionStorage.getItem('resetPasswordOTP');

  useEffect(() => {
    if (!email || !otp) {
      // If no email or OTP, redirect back to forgot password
      navigate('/forgot-password', { replace: true });
      return;
    }
  }, [email, otp, navigate]);

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
      const response = await postJson('/api/auth/reset-password', {
        email: email,
        otp: otp,
        newPassword: newPassword
      });
      
      if (response?.status) {
        // Clear session storage
        sessionStorage.removeItem('resetPasswordEmail');
        sessionStorage.removeItem('resetPasswordOTP');
        
        // Show success message and redirect to login after a short delay
        setSuccess(true);
        setTimeout(() => {
          navigate('/login', { replace: true, state: { message: 'Password reset successfully! Please login with your new password.' } });
        }, 2000);
      } else {
        setError(response?.message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!email || !otp) {
    return (
      <main className="auth-page-split">
        <div className="auth-banner-side"></div>
        <div className="auth-form-side">
          <div className="auth-card">
            <h1 className="auth-title">Error</h1>
            <p style={{ textAlign: 'center', color: '#dc2626' }}>
              Missing verification information. Please <Link to="/forgot-password">request a password reset</Link> again.
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
          <h1 className="auth-title">Reset Your Password</h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Enter your new password below.
          <br />
          <small style={{ color: '#94a3b8' }}>Make sure it's at least 6 characters long.</small>
        </p>

        {success && (
          <div style={{ 
            background: '#d1fae5', 
            padding: '0.75rem', 
            borderRadius: '6px', 
            marginBottom: '1rem',
            border: '2px solid var(--color-primary)',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#047857', fontSize: '0.9rem' }}>
              ✓ Password reset successfully! Redirecting to login...
            </p>
          </div>
        )}

        {!success && (
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
            <div role="alert" style={{ 
              color: '#dc2626', 
              background: '#fef2f2', 
              padding: '0.75rem', 
              borderRadius: '6px',
              border: '1px solid #fecaca',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
        )}

        <p className="auth-switch">
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
        </div>
      </div>
    </main>
  );
}

