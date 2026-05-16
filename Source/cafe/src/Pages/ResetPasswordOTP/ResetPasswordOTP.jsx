import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { postJson } from '../../utils/api';
import AuthLogo from '../../components/AuthLogo/AuthLogo';
import './ResetPasswordOTP.css';

export default function ResetPasswordOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [receivedOTP, setReceivedOTP] = useState(''); // For displaying OTP in dev mode

  // Get email from navigation state or sessionStorage
  const email = location.state?.email || sessionStorage.getItem('resetPasswordEmail');
  const devOTP = location.state?.otp || sessionStorage.getItem('resetPasswordOTP');

  useEffect(() => {
    if (!email) {
      // If no email, redirect back to forgot password
      navigate('/forgot-password', { replace: true });
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
      const response = await postJson('/api/auth/verify-password-reset-otp', {
        email: email,
        otp: otp
      });
      
      if (response?.status) {
        // Keep email and OTP in sessionStorage for password reset page
        sessionStorage.setItem('resetPasswordEmail', email);
        sessionStorage.setItem('resetPasswordOTP', otp);
        
        // Navigate to password reset page
        navigate('/reset-password', { 
          replace: true,
          state: { email: email, otp: otp }
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

  async function handleResendOTP() {
    setError('');
    setLoading(true);
    try {
      const response = await postJson('/api/auth/forgot-password', { email: email });
      if (response?.status) {
        startResendCooldown();
        setOtp('');
        // If OTP is returned in development mode, show it
        if (response?.otp) {
          setReceivedOTP(response.otp);
          sessionStorage.setItem('resetPasswordOTP', response.otp);
          console.log('🔐 Resent OTP Code:', response.otp);
        }
      } else {
        setError(response?.message || 'Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err.message || 'Failed to resend OTP. Please try again.');
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
              No email found. Please <Link to="/forgot-password">request a password reset</Link> again.
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
          <small>Enter the code to reset your password.</small>
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
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="auth-switch">
          <button 
            type="button" 
            onClick={handleResendOTP}
            disabled={loading || resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
          </button>
          <Link to="/forgot-password" 
            onClick={() => {
              sessionStorage.removeItem('resetPasswordEmail');
              sessionStorage.removeItem('resetPasswordOTP');
            }}
          >
            Change email
          </Link>
        </div>
        </div>
      </div>
    </main>
  );
}

