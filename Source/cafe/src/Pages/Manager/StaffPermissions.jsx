import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import StaffSkeleton from '../../components/skeletons/StaffSkeleton';
import { FaTimes, FaUsersCog, FaEye, FaEyeSlash } from 'react-icons/fa';
import { getJson, postJson, putJson, deleteJson, getImageUrl } from '../../utils/api';
import Modal from '../../components/Modal';
import { useSocket } from '../../SocketContext';
import './StaffPermissions.css';

export default function StaffPermissions() {
  const { connection } = useSocket();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [permissionsModal, setPermissionsModal] = useState({ show: false, staff: null });

  const PERMISSIONS_BY_ROLE = {
    Manager: [],
    Cashier: [
      { id: 'pos.toggle_availability', label: 'Toggle Item Availability', description: 'Can make menu items available or unavailable' },
      { id: 'pos.manage_discounts', label: 'Manage Discounts', description: 'Show Discount Setup page in Cashier module' },
      { id: 'pos.process_refunds', label: 'Process Refunds', description: 'Access to Refund Management page' }
    ],
    Chef: [
      { id: 'kitchen.manage_menu', label: 'Manage Menu', description: 'Access Menu Management (Add items/categories)' },
      { id: 'kitchen.toggle_availability', label: 'Toggle Item Availability', description: 'Can make menu items available or unavailable' }
    ]
  };


  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: null
  });
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    newPassword: ''
  });


  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (!connection) return;

    const handleUpdate = () => {
      loadStaff();
    };

    connection.on('NewOrder', handleUpdate);
    connection.on('OrderUpdated', handleUpdate);
    connection.on('PaymentUpdate', handleUpdate);

    return () => {
      connection.off('NewOrder', handleUpdate);
      connection.off('OrderUpdated', handleUpdate);
      connection.off('PaymentUpdate', handleUpdate);
    };
  }, [connection]);

  async function loadStaff() {
    try {
      setLoading(true);
      setError('');
      // Try common API endpoint patterns for getting staff/users
      let data = null;
      let apiSuccess = false;

      try {
        data = await getJson('/api/manager/staff');
        apiSuccess = true;
      } catch (err1) {
        try {
          data = await getJson('/api/staff');
          apiSuccess = true;
        } catch (err2) {
          try {
            data = await getJson('/api/users');
            apiSuccess = true;
          } catch (err3) {
            try {
              // If all endpoints fail, try /api/auth/users
              data = await getJson('/api/auth/users');
              apiSuccess = true;
            } catch (err4) {
              // All endpoints failed - that's okay, we'll keep existing staff
              console.log('No API endpoint available for loading staff. Using locally stored staff.');
              apiSuccess = false;
            }
          }
        }
      }

      // Only process API data if we got a successful response
      if (apiSuccess && data) {
        // Handle different response formats
        let staffList = [];
        if (Array.isArray(data)) {
          staffList = data;
        } else if (data?.staff || data?.Staff) {
          staffList = data.staff || data.Staff;
        } else if (data?.users || data?.Users) {
          staffList = data.users || data.Users;
        } else if (data?.data) {
          staffList = data.data;
        }

        // Filter to show Cashier, Chef, Waiter, and Manager
        const filteredStaff = staffList.filter(member => {
          const role = member.role || member.Role || '';
          return role === 'Cashier' || role === 'Chef' || role === 'Waiter' || role === 'Manager';
        });


        // Merge with existing staff to avoid losing locally added members
        setStaff(prevStaff => {
          const merged = [...prevStaff];
          filteredStaff.forEach(apiMember => {
            const apiEmail = (apiMember.email || apiMember.Email || '').toLowerCase();
            const apiId = apiMember.id || apiMember.Id || apiMember.userId || apiMember.UserId;

            // Check if this member already exists
            const existingIndex = merged.findIndex(s => {
              const existingEmail = (s.email || s.Email || '').toLowerCase();
              const existingId = s.id || s.Id || s.userId || s.UserId;
              return existingEmail === apiEmail || (apiId && existingId === apiId);
            });

            if (existingIndex >= 0) {
              // Update existing member with API data
              merged[existingIndex] = { ...merged[existingIndex], ...apiMember };
            } else {
              // Add new member from API
              merged.push(apiMember);
            }
          });
          return merged;
        });
      }
      // If API failed, don't clear existing staff - keep what we have
    } catch (err) {
      console.error('Failed to load staff:', err);
      // Don't clear staff array on error - preserve locally added members
      // Only show error if it's not a 404
      if (err.status !== 404) {
        setError(err.message || 'Failed to load staff');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(staffMember) {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name || staffMember.Name || '',
      email: staffMember.email || staffMember.Email || '',
      role: staffMember.role || staffMember.Role || '',
      newPassword: ''
    });
    setShowForm(true);
  }

  function handleDeleteClick(id) {
    setConfirmModal({
      show: true,
      title: 'Delete Staff Member',
      message: 'Are you sure you want to delete this staff member? This action cannot be undone.',
      type: 'danger',
      onConfirm: () => performDelete(id)
    });
  }

  async function performDelete(id) {
    setConfirmModal(prev => ({ ...prev, show: false }));
    try {
      setLoading(true);
      setError('');

      const response = await deleteJson(`/api/manager/staff/${id}`);

      if (response && response.status === true) {
        setStaff(prevStaff => prevStaff.filter(s => {
          const staffId = s.id || s.Id || s.userId || s.UserId;
          return staffId !== id;
        }));
        setSuccess('Staff member deleted successfully!');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(response?.message || 'Failed to delete staff member');
      }
    } catch (err) {
      console.error('Delete API call failed:', err);
      setError(err.message || 'Failed to delete staff member due to a server error.');
    } finally {
      setLoading(false);
    }
  }



  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      if (editingStaff) {
        const id = editingStaff.id || editingStaff.Id || editingStaff.userId || editingStaff.UserId;
        const emailNormalized = formData.email.trim().toLowerCase();

        const payload = {
          name: formData.name.trim() || null,
          role: formData.role,
          email: emailNormalized
        };

        if (formData.newPassword) {
          payload.newPassword = formData.newPassword;
        }

        const response = await putJson(`/api/manager/staff/${id}`, payload);

        if (response && (response.status === true || response.Status === true || response.status === 'true')) {
          setStaff(prevStaff => prevStaff.map(s => {
            const sId = s.id || s.Id || s.userId || s.UserId;
            if (sId === id) {
              return { ...s, name: formData.name, Name: formData.name, role: formData.role, Role: formData.role, email: emailNormalized, Email: emailNormalized };
            }
            return s;
          }));
          setSuccess('Staff member updated successfully!');
          setTimeout(() => setSuccess(''), 5000);
          setShowForm(false);
          resetForm();
        } else {
          setError(response?.message || response?.Message || 'Failed to update staff member');
        }
      } else {
        const emailNormalized = formData.email.trim().toLowerCase();

        // Use the new create-staff endpoint (no OTP, no password needed)
        const response = await postJson('/api/auth/create-staff', {
          name: formData.name.trim() || null,
          email: emailNormalized,
          role: formData.role,
        });

        console.log('Create staff response:', response);

        // Check response status (handle both camelCase and PascalCase)
        const status = response?.status || response?.Status;
        if (status === true || status === 'true') {
          // Create a staff member object to add to the list
          const newStaffMember = {
            id: response?.id || response?.Id || response?.userId || response?.UserId || Date.now(),
            name: formData.name,
            Name: formData.name,
            email: emailNormalized,
            Email: emailNormalized,
            role: formData.role,
            Role: formData.role,
          };

          // Add the new staff member to the list
          setStaff(prevStaff => {
            const exists = prevStaff.some(s => {
              const existingEmail = (s.email || s.Email || '').toLowerCase();
              return existingEmail === emailNormalized;
            });
            if (exists) {
              return prevStaff;
            }
            return [...prevStaff, newStaffMember];
          });

          // Show success message with temp password if returned by backend (e.g. dev mode or email failure)
          if (response?.temporaryPassword || response?.TemporaryPassword) {
            const tempPwd = response.temporaryPassword || response.TemporaryPassword;
            const backendMessage = response?.message || response?.Message || 'Staff account created successfully!';
            setConfirmModal({
              show: true,
              title: 'Staff Account Created',
              message: `${backendMessage}\n\nTemporary Password: ${tempPwd}\n\nPlease copy this and provide it directly to the staff member!`,
              type: 'primary',
              onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
            });
          } else {
            setSuccess(response?.message || response?.Message || `Staff account created successfully! Temporary password has been sent to ${emailNormalized} via email.`);
          }

          setShowForm(false);
          resetForm();

          // Clear success message after 5 seconds
          setSuccess('Staff account created successfully! Check email for password.');
          setTimeout(() => setSuccess(''), 5000);
        } else {
          const errorMessage = response?.message || response?.Message || 'Failed to create staff member';
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Create staff error:', err);
      setError(err.message || 'Failed to create staff member');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingStaff(null);
    setFormData({
      name: '',
      email: '',
      role: '',
      newPassword: ''
    });
  }

  function cancelForm() {
    setShowForm(false);
    resetForm();
  }

  function handleOpenPermissions(staffMember) {
    setPermissionsModal({ show: true, staff: staffMember });
  }

  async function handleSavePermissions(staffId, permissionsList) {
    try {
      setLoading(true);
      const permissionsString = permissionsList.join(',');
      const response = await putJson(`/api/manager/staff/${staffId}`, {
        role: permissionsModal.staff.role || permissionsModal.staff.Role,
        name: permissionsModal.staff.name || permissionsModal.staff.Name,
        permissions: permissionsString
      });

      if (response && (response.status === true || response.Status === true)) {
        setStaff(prev => prev.map(s => {
          const sId = s.id || s.Id || s.userId || s.UserId;
          if (sId === staffId) {
            return { ...s, permissions: permissionsString, Permissions: permissionsString };
          }
          return s;
        }));
        setSuccess('Permissions updated successfully!');
        setTimeout(() => setSuccess(''), 5000);
        setPermissionsModal({ show: false, staff: null });
      } else {
        setError(response?.message || 'Failed to update permissions');
      }
    } catch (err) {
      setError(err.message || 'Error saving permissions');
    } finally {
      setLoading(false);
    }
  }




  return (
    <div className="staff-permissions">
      <header className="standard-page-header">
        <div className="standard-page-header-text">
          <h1 className="standard-page-title"><FaUsersCog style={{ marginRight: '8px' }} /> Staff Accounts</h1>
          <p className="standard-page-subtitle">Manage employee profiles and system access levels</p>
        </div>
        <div className="standard-page-header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add Staff Member
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="error-message" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#34d399' }}>✓ {success}</div>}

      {/* Inline Form */}
      {showForm && (
        <StaffFormModal
          editingStaff={editingStaff}
          formData={formData}
          setFormData={setFormData}
          loading={loading}
          onCancel={cancelForm}
          onSubmit={handleSubmit}
        />
      )}

      {permissionsModal.show && (
        <PermissionsModal
          staff={permissionsModal.staff}
          availablePermissions={PERMISSIONS_BY_ROLE[permissionsModal.staff.role || permissionsModal.staff.Role] || []}
          onCancel={() => setPermissionsModal({ show: false, staff: null })}
          onSave={handleSavePermissions}
          loading={loading}
        />
      )}


      {loading && !showForm ? (
        <StaffSkeleton />
      ) : staff.length === 0 ? (
        <div className="empty-state">
          <p>No staff members yet. Click "Add Staff Member" to get started.</p>
        </div>
      ) : (
        <div className="staff-grid">
          {staff.map((staffMember, index) => {
            const id = staffMember.id || staffMember.Id || staffMember.userId || staffMember.UserId || index;
            const name = staffMember.name || staffMember.Name || '';
            const email = staffMember.email || staffMember.Email || '';
            const role = staffMember.role || staffMember.Role || '';
            const displayName = name || email;
            const profilePictureUrl = staffMember.profilePictureUrl || staffMember.ProfilePictureUrl;
            return (
              <div key={id} className="staff-card">
                <div className="staff-card-header">
                  <div className="staff-avatar">
                    {profilePictureUrl ? (
                      <img src={getImageUrl(profilePictureUrl)} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="staff-info">
                    <h3 className="staff-email" style={{ fontSize: name ? '1.1rem' : '0.9rem', marginBottom: '0.2rem' }}>{displayName}</h3>
                    {name && <span style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>{email}</span>}
                    <span className={`role-badge role-badge-${role.toLowerCase()}`}>
                      {role}
                    </span>
                  </div>
                </div>
                <div className="staff-card-actions">
                  {role !== 'Manager' && role !== 'Waiter' && (
                    <button className="btn-card-action btn-card-primary" onClick={() => handleOpenPermissions(staffMember)}>
                      Permissions
                    </button>
                  )}
                  <button className="btn-card-action btn-card-secondary" onClick={() => handleEdit(staffMember)}>
                    Edit
                  </button>

                  {role !== 'Manager' && (
                    <button className="btn-card-action btn-card-tertiary" onClick={() => handleDeleteClick(id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      <Modal
        isOpen={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}








function StaffFormModal({
  editingStaff,
  formData,
  setFormData,
  loading,
  onCancel,
  onSubmit
}) {
  const [showPassword, setShowPassword] = useState(false);
  return ReactDOM.createPortal(
    <div className="sp-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="sp-modal-wrapper">
        <div className="sp-modal-header">
          <h3 className="sp-modal-title">
            {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h3>
          <button className="sp-btn-icon" onClick={onCancel} type="button">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="sp-modal-body">
            <div className="sp-form-group">
              <label>Full Name (Optional)</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                placeholder="Full Name"
                autoFocus={!editingStaff}
              />
            </div>

            <div className="sp-form-group">
              <label>Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
                placeholder="staff@example.com"
              />
              {!editingStaff && (
                <small className="sp-form-hint">
                  A temporary password will be sent to this email
                </small>
              )}
            </div>

            {editingStaff && (
              <div className="sp-form-group">
                <label>New Password</label>
                <div className="sp-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={formData.newPassword || ''}
                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                    disabled={loading}
                    placeholder="Leave blank to keep current password"
                  />
                  <button type="button" className="sp-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            )}

            {(!editingStaff || (editingStaff.role !== 'Manager' && editingStaff.Role !== 'Manager')) && (
              <div className="sp-form-group">
                <label>Role *</label>
                <select
                  required
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  disabled={loading}
                >
                  <option value="">Select role</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Chef">Chef</option>
                  <option value="Waiter">Waiter</option>
                </select>
              </div>
            )}

            <div className="sp-info-box">
              <p>
                ℹ️ The staff member will receive an email with a temporary password.
                They will need to verify their email and set a new password on first login.
              </p>
            </div>
          </div>

          <div className="sp-modal-footer">
            <button type="button" className="sp-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="sp-btn-primary" disabled={loading}>
              {loading ? 'Creating...' : editingStaff ? 'Update' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function PermissionsModal({ staff, availablePermissions, onCancel, onSave, loading }) {
  const currentPermissionsString = staff.permissions || staff.Permissions || '';
  const [selected, setSelected] = useState(currentPermissionsString ? currentPermissionsString.split(',') : []);

  const togglePermission = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return ReactDOM.createPortal(
    <div className="sp-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className="sp-modal-wrapper" style={{ maxWidth: '500px' }}>
        <div className="sp-modal-header">
          <h3 className="sp-modal-title">
            Permissions: {staff.name || staff.Name || staff.email || staff.Email}
          </h3>
          <button className="sp-btn-icon" onClick={onCancel}>
            <FaTimes />
          </button>
        </div>
        <div className="sp-modal-body">
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>
            Toggle the permissions allowed for this {staff.role || staff.Role}.
          </p>
          <div className="permissions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {availablePermissions.map(perm => (
              <div key={perm.id} className="permission-item" onClick={() => togglePermission(perm.id)}>
                <label className="sp-toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                  />
                  <span className="sp-toggle-slider"></span>
                </label>
                <div>
                  <div className="permission-label-text">{perm.label}</div>
                  <div className="permission-desc-text">{perm.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sp-modal-footer">
          <button type="button" className="sp-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="sp-btn-primary"
            disabled={loading}
            onClick={() => onSave(staff.id || staff.Id || staff.userId || staff.UserId, selected)}
          >
            {loading ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}



