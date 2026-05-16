import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { postJson } from '../../utils/api';
import AuthLogo from '../../components/AuthLogo/AuthLogo';
import './FirstLoginOTP.css';

export default function FirstLoginOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [receivedOTP, setReceivedOTP] = useState(''); // For displaying OTP in dev mode

  // Get email from navigation state or sessionStorage
  const email = location.state?.email || sessionStorage.getItem('firstLoginEmail');
  const devOTP = location.state?.otp || sessionStorage.getItem('firstLoginOTP');

  useEffect(() => {
    if (!email) {
      // If no email, redirect back to login
      navigate('/login', { replace: true });
      return;
    }
    if (devOTP) {
      setReceivedOTP(devOTP);
    }
    // Start cooldown on mount
    startResendCooldown();
  }, [email, devOTP, navigate]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function startResendCooldown() {
    setResendCooldown(60); // 60 seconds cooldown
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await postJson('/api/auth/verify-first-login-otp', {
        email: email,
        otp: otp
      });
      
      if (response?.status) {
        sessionStorage.removeItem('firstLoginOTP');
        // Keep email in sessionStorage for password reset page
        navigate('/set-new-password', { 
          replace: true,
          state: { email: email }
        });
      } else {
        setError(response?.message || 'OTP verification failed. Please try again.');
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.message || 'OTP verification failed. Please try again.');
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
              No email found for verification. Please <Link to="/login">login</Link> again.
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
          <h1 className="auth-title">Verify Your Email</h1>
        <p className="auth-subtitle">
          A 6-digit verification code has been sent to <strong>{email}</strong>.
          <br />
          <small>This is your first login. Please verify your email to continue.</small>
        </p>

        {receivedOTP && (
          <div className="otp-dev-box">
            <div className="otp-dev-label">🔐 Development Mode - Your OTP Code:</div>
            <div className="otp-dev-code">{receivedOTP}</div>
            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.5rem' }}>
              (This code expires in 10 minutes)
            </div>
          </div>
        )}

        <form className="auth-form" onSubmit={handleVerifyOTP}>
          <label>
            Verification Code (OTP)
            <input 
              type="text" 
              className="otp-input"
              required 
              value={otp} 
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              maxLength={6}
              disabled={loading}
              autoFocus
            />
          </label>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify Email'}
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

