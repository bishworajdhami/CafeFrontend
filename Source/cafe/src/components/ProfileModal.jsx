import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FaTimes, FaUser, FaEnvelope, FaIdBadge, FaShieldAlt, FaCheckCircle, FaUserShield, FaCamera, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';
import { putJson, postJson, uploadFile, deleteJson, getImageUrl } from '../utils/api';
import './ProfileModal.css';

export default function ProfileModal({ isOpen, onClose, onLogout }) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'security'

  // General Tab State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Security Tab State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');

  // Password visibility states
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Prioritize email from localStorage, fallback to an empty string if not found
      setName(localStorage.getItem('name') || '');
      setEmail(localStorage.getItem('email') || '');
      setRole(localStorage.getItem('role') || '');
      setProfilePictureUrl(localStorage.getItem('profilePictureUrl') || '');
      setProfileSuccess('');
      setProfileError('');
      setSecuritySuccess('');
      setSecurityError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setActiveTab('general');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const response = await putJson('/api/auth/profile', { name });
      if (response && (response.status === true || response.Status === true || response.status === 'true')) {
        setProfileSuccess('Profile updated successfully');
        localStorage.setItem('name', name);
        window.dispatchEvent(new Event('profileUpdated'));
        setTimeout(() => setProfileSuccess(''), 3000);
      } else {
        setProfileError(response?.message || response?.Message || 'Failed to update profile');
      }
    } catch (err) {
      setProfileError(err.message || 'Error communicating with server');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Image size must be less than 2MB');
      return;
    }

    setUploadingImage(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await uploadFile('/api/auth/upload-profile-picture', file);

      if (res && res.status) {
        setProfilePictureUrl(res.url);
        localStorage.setItem('profilePictureUrl', res.url);
        setProfileSuccess('Profile picture updated!');
        window.dispatchEvent(new Event('profileUpdated'));
        setTimeout(() => setProfileSuccess(''), 3000);
      } else {
        setProfileError(res?.message || 'Failed to upload image');
      }
    } catch (err) {
      setProfileError('Network error while uploading image');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDeleteImage() {
    setUploadingImage(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await deleteJson('/api/auth/delete-profile-picture');

      if (res && res.status) {
        setProfilePictureUrl('');
        localStorage.removeItem('profilePictureUrl');
        setProfileSuccess('Profile picture removed');
        window.dispatchEvent(new Event('profileUpdated'));
        setTimeout(() => setProfileSuccess(''), 3000);
      } else {
        setProfileError(res?.message || 'Failed to delete image');
      }
    } catch (err) {
      setProfileError('Network error while deleting image');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSecuritySubmit(e) {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess('');

    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setSecurityError('Password must be at least 6 characters');
      return;
    }

    setSecurityLoading(true);
    try {
      const response = await postJson('/api/auth/change-password', { currentPassword, newPassword });
      if (response && (response.status === true || response.Status === true || response.status === 'true')) {
        setSecuritySuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSecuritySuccess(''), 3000);
      } else {
        setSecurityError(response?.message || response?.Message || 'Failed to change password');
      }
    } catch (err) {
      setSecurityError(err.message || 'Error communicating with server');
    } finally {
      setSecurityLoading(false);
    }
  }

  const getInitials = (nameStr, emailStr) => {
    if (nameStr && nameStr.trim().length > 0) {
      return nameStr.charAt(0).toUpperCase();
    }
    if (emailStr && emailStr.trim().length > 0) {
      return emailStr.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return ReactDOM.createPortal(
    <div className="profile-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="profile-container animate-scale-in">

        {/* Sidebar Container */}
        <aside className="profile-sidebar">
          <div className="profile-user-brand">
            <div className="brand-avatar-container">
              <div className="brand-avatar">
                {profilePictureUrl ? (
                  <img src={getImageUrl(profilePictureUrl)} alt="Profile" className="avatar-image" />
                ) : (
                  getInitials(name, email)
                )}
                <div className="avatar-overlay">
                  {!profilePictureUrl ? (
                    <label htmlFor="avatar-upload" className="overlay-btn upload-btn" title="Upload New Picture">
                      <FaCamera />
                    </label>
                  ) : (
                    <button type="button" className="overlay-btn delete-btn" onClick={handleDeleteImage} title="Delete Picture">
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg, image/png, image/jpg"
                onChange={handleImageUpload}
                disabled={uploadingImage || profileLoading}
                style={{ display: 'none' }}
              />
              {uploadingImage && <div className="avatar-loader"></div>}
            </div>
            <div className="brand-details">
              <h3>{name || 'Unknown User'}</h3>
              <p>{email}</p>
            </div>
          </div>

          <nav className="profile-nav">
            <button
              className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <FaUser className="nav-icon" /> General Information
            </button>
            <button
              className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <FaShieldAlt className="nav-icon" /> Account Security
            </button>

            <div className="nav-divider"></div>

            <button
              className="nav-item nav-item-logout"
              onClick={() => {
                onLogout?.();
                onClose();
              }}
            >
              <FaTimes className="nav-icon" /> Sign Out
            </button>
          </nav>

          <footer className="profile-sidebar-footer">
            <div className="badge-container">
              <span className={`role-badge role-${role?.toLowerCase()}`}>
                <FaUserShield style={{ marginRight: '6px' }} /> {role} Access
              </span>
            </div>
          </footer>
        </aside>

        {/* Content Container */}
        <main className="profile-main">
          <header className="profile-header">
            <h2 className="profile-title">
              {activeTab === 'general' ? 'Profile Management' : 'Security Preferences'}
            </h2>
            <button className="close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </header>

          <div className="profile-scroll-area">

            {activeTab === 'general' && (
              <div className="tab-panel animate-fade-in">
                <section className="profile-section">
                  <h4 className="section-label">Identity Details</h4>
                  <div className="data-grid">
                    <div className="data-item">
                      <div className="data-icon"><FaEnvelope /></div>
                      <div className="data-info">
                        <label>Primary Email</label>
                        <p>{email || 'Not Available'}</p>
                      </div>
                      <div className="verification-status">
                        <FaCheckCircle className="verified-icon" /> Verifed
                      </div>
                    </div>
                    <div className="data-item">
                      <div className="data-icon"><FaIdBadge /></div>
                      <div className="data-info">
                        <label>Account Type</label>
                        <p>{role}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <hr className="divider" />

                <section className="profile-section">
                  <h4 className="section-label">Personal Settings</h4>
                  <form onSubmit={handleProfileSubmit} className="modern-form">
                    {profileError && <div className="alert-message error">{profileError}</div>}
                    {profileSuccess && <div className="alert-message success">{profileSuccess}</div>}

                    <div className="form-field">
                      <label>Display Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        disabled={profileLoading}
                      />
                      <small className="field-hint">Your name will be visible to other staff members and used in activity logs.</small>
                    </div>

                    <div className="form-footer">
                      <button type="submit" className="action-button primary" disabled={profileLoading}>
                        {profileLoading ? 'Saving Changes...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="tab-panel animate-fade-in">
                <section className="profile-section">
                  <h4 className="section-label">Password Policy</h4>
                  <p className="section-hint">Update your password regularly to maintain account safety. Use a combination of letters, numbers, and symbols.</p>

                  <form onSubmit={handleSecuritySubmit} className="modern-form">
                    {securityError && <div className="alert-message error">{securityError}</div>}
                    {securitySuccess && <div className="alert-message success">{securitySuccess}</div>}

                    <div className="form-field">
                      <label>Current Password</label>
                      <div className="password-input-wrapper">
                        <input
                          type={showCurrent ? "text" : "password"}
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={securityLoading}
                        />
                        <button type="button" className="password-toggle-btn" onClick={() => setShowCurrent(!showCurrent)}>
                          {showCurrent ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="form-field">
                        <label>New Password</label>
                        <div className="password-input-wrapper">
                          <input
                            type={showNew ? "text" : "password"}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={securityLoading}
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowNew(!showNew)}>
                            {showNew ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Confirm Password</label>
                        <div className="password-input-wrapper">
                          <input
                            type={showConfirm ? "text" : "password"}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={securityLoading}
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(!showConfirm)}>
                            {showConfirm ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="form-footer">
                      <button type="submit" className="action-button security" disabled={securityLoading}>
                        {securityLoading ? 'Processing Request...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                </section>

                <hr className="divider" />

                <section className="profile-section">
                  <h4 className="section-label">Account Sessions</h4>
                  <div className="session-card">
                    <FaCheckCircle className="active-session-icon" />
                    <div>
                      <p>Currently active in your browser</p>
                      <small>Session started manually via login provider.</small>
                    </div>
                  </div>
                </section>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>,
    document.body
  );
}
