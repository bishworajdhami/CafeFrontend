import { FaUpload, FaTrash, FaBuilding } from 'react-icons/fa';
import { getImageUrl } from '../../../utils/api';

export default function GeneralTab({
  cafeName, setCafeName,
  cafeAddress, setCafeAddress,
  contactPhone, setContactPhone,
  cafePan, setCafePan,
  vatPercentage, setVatPercentage,
  vatIncluded, setVatIncluded,
  serviceChargePercentage, setServiceChargePercentage,
  serviceChargeIncluded, setServiceChargeIncluded,
  payFirst, setPayFirst,
  cafeLogo, setCafeLogo,
  onSave, onLogoUpload, loading
}) {
  const handleLocalLogoUpload = (e) => {
    if (onLogoUpload) onLogoUpload(e);
  };

  return (
    <div className="settings-tab-container cc-fadeIn">
      <div className="settings-section-grid">
        {/* Left Column: Cafe Info */}
        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3><FaBuilding /> Cafe Identity</h3>
            <p>Core branding details for receipts and invoices</p>
          </div>
          
          <div className="settings-panel-content">
            <div className="settings-modern-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Cafe Brand Name</label>
                  <input
                    type="text"
                    value={cafeName}
                    onChange={e => setCafeName(e.target.value)}
                    placeholder="e.g. Skyline Cafe"
                  />
                </div>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="+977 98XXXXXXXX"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Physical Address / Tagline</label>
                <input
                  type="text"
                  value={cafeAddress}
                  onChange={e => setCafeAddress(e.target.value)}
                  placeholder="Street Address, City, Country"
                />
              </div>

              <div className="form-group">
                <label>Business PAN Number</label>
                <input
                  type="text"
                  value={cafePan}
                  onChange={e => setCafePan(e.target.value)}
                  placeholder="9-digit PAN"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Logo & Visuals */}
        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3><FaUpload /> Brand Visuals</h3>
            <p>Upload your logo for the dashboard header</p>
          </div>
          
          <div className="settings-panel-content">
            <div className="logo-upload-showcase">
              {cafeLogo ? (
                <div className="logo-display-box">
                  <div className="logo-img-wrap">
                    <img src={getImageUrl(cafeLogo)} alt="Cafe Logo" />
                  </div>
                  <button className="logo-delete-btn" onClick={() => setCafeLogo(null)}>
                    <FaTrash /> Remove Logo
                  </button>
                </div>
              ) : (
                <label className="logo-drop-zone">
                  <input type="file" onChange={handleLocalLogoUpload} accept="image/*" />
                  <div className="drop-zone-content">
                    <div className="upload-circle">
                      <FaUpload />
                    </div>
                    <span className="upload-title">Click to Upload</span>
                    <span className="upload-hint">PNG or JPG, Max 2MB</span>
                  </div>
                </label>
              )}
            </div>
            
            <div className="settings-info-alert">
              <p>Your logo will be automatically optimized and displayed in a 1:1 aspect ratio across the dashboard.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Taxes & Charges Section */}
      <div className="settings-section-grid" style={{ marginTop: '2rem' }}>
        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3>Financial Rules</h3>
            <p>Configure VAT and Service Charges</p>
          </div>
          <div className="settings-panel-content">
            <div className="settings-modern-form">
              <div className="form-row">
                <div className="form-group">
                  <label>VAT Percentage (%)</label>
                  <div className="input-with-icon">
                    <input type="number" step="0.1" value={vatPercentage} onChange={e => setVatPercentage(e.target.value)} />
                    <span className="suffix">%</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Service Charge (%)</label>
                  <div className="input-with-icon">
                    <input type="number" step="0.1" value={serviceChargePercentage} onChange={e => setServiceChargePercentage(e.target.value)} />
                    <span className="suffix">%</span>
                  </div>
                </div>
              </div>

              <div className="settings-toggle-group">
                <label className="settings-toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-label">VAT Inclusive Prices</span>
                    <p className="toggle-desc">Menu item prices already include VAT</p>
                  </div>
                  <input type="checkbox" className="settings-toggle-switch" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} />
                </label>

                <label className="settings-toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-label">SC Inclusive Prices</span>
                    <p className="toggle-desc">Menu item prices already include Service Charge</p>
                  </div>
                  <input type="checkbox" className="settings-toggle-switch" checked={serviceChargeIncluded} onChange={e => setServiceChargeIncluded(e.target.checked)} />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3>Operational Workflow</h3>
            <p>Configure cashier checkout behavior</p>
          </div>
          <div className="settings-panel-content">
            <label className="settings-toggle-row premium">
              <div className="toggle-info">
                <span className="toggle-label">Pay First Mode</span>
                <p className="toggle-desc">Skip order summary and go directly to payment screen</p>
              </div>
              <input type="checkbox" className="settings-toggle-switch" checked={payFirst} onChange={e => setPayFirst(e.target.checked)} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
