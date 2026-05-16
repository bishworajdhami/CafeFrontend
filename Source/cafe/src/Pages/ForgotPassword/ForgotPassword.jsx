import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { postJson } from '../../utils/api';
import AuthLogo from '../../components/AuthLogo/AuthLogo';
import './ForgotPassword.css';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [receivedOTP, setReceivedOTP] = useState(''); // For dev mode

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);
        try {
            const emailNormalized = email.trim().toLowerCase();
            const response = await postJson('/api/auth/forgot-password', {
                email: emailNormalized
            });

            if (response?.status) {
                setSuccess(true);

                // Store email for next step
                sessionStorage.setItem('resetPasswordEmail', emailNormalized);

                // If OTP is returned in development mode, show it
                if (response?.otp) {
                    setReceivedOTP(response.otp);
                    sessionStorage.setItem('resetPasswordOTP', response.otp);
                }

                // Navigate to OTP verification page after a short delay
                setTimeout(() => {
                    navigate('/reset-password-otp', {
                        state: {
                            email: emailNormalized,
                            otp: response?.otp
                        }
                    });
                }, 2000);
            } else {
                setError(response?.message || 'Failed to send password reset OTP. Please try again.');
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            setError(err.message || 'Failed to send password reset OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page-split">
            <div className="auth-banner-side">
                <AuthLogo />
            </div>
            <div className="auth-form-side">
                <div className="auth-card">
                    <h1 className="auth-title">Forgot Password</h1>
                <p className="auth-subtitle">
                    Enter your email address and we'll send you a verification code to reset your password.
                </p>

                {success && (
                    <div className="auth-success-box">
                        <p>✓ Password reset OTP sent! Redirecting...</p>
                        {receivedOTP && (
                            <div className="otp-dev-box">
                                <div className="otp-dev-label">🔐 Development Mode - Your OTP Code:</div>
                                <div className="otp-dev-code">{receivedOTP}</div>
                            </div>
                        )}
                    </div>
                )}

                {!success && (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <label>
                            Email Address
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={loading}
                                placeholder="Enter your email"
                                autoFocus
                            />
                        </label>

                        {error && (
                            <div className="auth-error" role="alert">
                                {error}
                            </div>
                        )}

                        <button type="submit" className="auth-btn" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Reset Code'}
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
