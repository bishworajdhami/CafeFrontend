import React, { useState } from 'react';
import { FaCamera, FaCheck, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';

import { getImageUrl } from '../../../utils/api';

export default function ProfileSettingsModal({
  isOpen,
  loading,
  passwordSubmitting,
  setProfileModalOpen,
  profilePictureUrl,
  userName,
  fileInputRef,
  handleDeleteProfilePicture,
  handleProfilePictureUpload,
  newName,
  setNewName,
  handleNameUpdate,
  passwordError,
  passwordSuccess,
  passwordForm,
  setPasswordForm,
  handlePasswordUpdate
}) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="wd-modal-backdrop" onClick={() => !loading && !passwordSubmitting && setProfileModalOpen(false)}>
      <div className="wd-modal wd-profile-modal" onClick={e => e.stopPropagation()}>
        <div className="wd-modal-header">
          <div className="wd-modal-title">Profile Settings</div>
          <button className="wd-modal-close" onClick={() => setProfileModalOpen(false)}>x</button>
        </div>

        <div className="wd-profile-modal-content">
          <section className="wd-modal-section">
            <h3 className="wd-section-title">Profile Picture</h3>
            <div className="wd-modal-avatar-edit">
              <div className="wd-avatar-large-preview">
                {profilePictureUrl ? (
                  <img src={getImageUrl(profilePictureUrl)} alt="Profile" />
                ) : (
                  <div className="wd-avatar-placeholder">{userName.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="wd-avatar-edit-btns">
                {!profilePictureUrl ? (
                  <button className="wd-btn-upload-avatar" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                    <FaCamera /> Upload Photo
                  </button>
                ) : (
                  <button className="wd-btn-delete-avatar" onClick={handleDeleteProfilePicture} disabled={loading}>
                    <FaTrash /> Remove Photo
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleProfilePictureUpload}
              />
            </div>
          </section>

          <section className="wd-modal-section">
            <h3 className="wd-section-title">Personal Information</h3>
            <div className="wd-form-field">
              <label className="wd-form-label">Display Name</label>
              <div className="wd-input-with-action">
                <input
                  className="wd-form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Your name"
                />
                <button className="wd-btn-icon-save" onClick={handleNameUpdate} disabled={loading || newName === userName}>
                  <FaCheck />
                </button>
              </div>
            </div>
          </section>

          <section className="wd-modal-section">
            <h3 className="wd-section-title">Account Security</h3>
            {passwordError && <div className="wd-form-error">{passwordError}</div>}
            {passwordSuccess && <div className="wd-form-success">{passwordSuccess}</div>}

            <div className="wd-form-grid-single">
              <div className="wd-form-field">
                <label className="wd-form-label">Current Password</label>
                <div className="wd-password-wrapper">
                  <input
                    className="wd-form-input"
                    type={showCurrent ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="********"
                  />
                  <button type="button" className="wd-password-toggle" onClick={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div className="wd-form-field">
                <label className="wd-form-label">New Password</label>
                <div className="wd-password-wrapper">
                  <input
                    className="wd-form-input"
                    type={showNew ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Minimum 6 characters"
                  />
                  <button type="button" className="wd-password-toggle" onClick={() => setShowNew(!showNew)}>
                    {showNew ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div className="wd-form-field">
                <label className="wd-form-label">Confirm New Password</label>
                <div className="wd-password-wrapper">
                  <input
                    className="wd-form-input"
                    type={showConfirm ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="********"
                  />
                  <button type="button" className="wd-password-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            </div>
            <button className="wd-btn-change-password" onClick={handlePasswordUpdate} disabled={passwordSubmitting}>
              {passwordSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </section>
        </div>

        <div className="wd-modal-footer">
          <button className="wd-btn-full" onClick={() => setProfileModalOpen(false)}>Done</button>
        </div>
      </div>
    </div>
  );
}
