import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { postJson } from '../../utils/api';
import AuthLogo from '../../components/AuthLogo/AuthLogo';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './LoginPage.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const emailNormalized = email.trim().toLowerCase();

            console.info('LOGIN REQUEST', {
                url: '/api/auth/login',
                payload: { email: emailNormalized, password: '[REDACTED]' }
            });

            const res = await postJson('/api/auth/login', { email: emailNormalized, password });
            console.info('LOGIN RESPONSE', res);

            const requiresFirstLoginOTP = res?.requiresFirstLoginOTP || res?.RequiresFirstLoginOTP;

            if (requiresFirstLoginOTP) {
                sessionStorage.setItem('firstLoginEmail', emailNormalized);
                if (res?.otp || res?.OTP) {
                    sessionStorage.setItem('firstLoginOTP', res.otp || res.OTP);
                }
                navigate('/first-login-otp', {
                    state: { email: emailNormalized, otp: res?.otp || res?.OTP }
                });
                return;
            }

            const token = res?.token ?? res?.Token;
            const roleFromRes = res?.role ?? res?.Role;
            const message = res?.message ?? res?.Message;

            if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('email', res?.email || res?.Email || emailNormalized);
                const userName = res?.name || res?.Name;
                if (userName) localStorage.setItem('name', userName);
                const pfp = res?.profilePictureUrl || res?.ProfilePictureUrl;
                if (pfp) {
                    localStorage.setItem('profilePictureUrl', pfp);
                } else {
                    localStorage.removeItem('profilePictureUrl');
                }
                const resolvedRole = roleFromRes || '';
                if (resolvedRole) localStorage.setItem('role', resolvedRole);
                const permissions = res?.permissions || res?.Permissions || '';
                localStorage.setItem('permissions', permissions);

                // Determine destination route
                const targetRoute = resolvedRole === 'Manager' ? '/manager' : '/dashboard';

                // Use the native View Transition API for the cool morphing effect
                if (document.startViewTransition) {
                    document.startViewTransition(() => {
                        navigate(targetRoute, { replace: true });
                        // Wait for React to render the dashboard before capturing the new state
                        return new Promise(resolve => setTimeout(resolve, 100));
                    });
                } else {
                    navigate(targetRoute, { replace: true });
                }
            } else {
                throw new Error(message ?? 'Login failed');
            }
        } catch (err) {
            console.error('Login error', err);
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <main className="auth-page-split">
                <div className="auth-banner-side transition-banner">
                    <AuthLogo />
                </div>
                <div className="auth-form-side">
                    <div className="auth-card">
                        <h1 className="auth-title">Sign in</h1>
                        <form className="auth-form" onSubmit={handleSubmit}>
                            <label>
                                Email
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                            </label>

                            <label>
                                Password
                                <div className="password-input-wrapper">
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        required 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                    />
                                    <button 
                                        type="button" 
                                        className="password-toggle-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </label>

                            {error && <div className="auth-error" role="alert">{error}</div>}

                            <button type="submit" className="auth-btn" disabled={loading}>
                                {loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </form>

                        <div className="auth-forgot-container">
                            <Link to="/forgot-password" className="auth-forgot-link">
                                Forgot Password?
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
