import { FaTimes, FaMobileAlt, FaUpload } from 'react-icons/fa';
import { getImageUrl } from '../../../utils/api';

export default function QRPaymentTab({
  paymentMethods, togglePaymentMethod, handleQRUpload, removeQRCode,
  onSave, loading
}) {
  return (
    <div className="settings-tab-container cc-fadeIn">
      <div className="settings-section-grid single-column">
        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3><FaMobileAlt /> Mobile Payment Config</h3>
            <p>Setup QR codes for customer self-payments</p>
          </div>
          
          <div className="settings-panel-content">
            <div className="qr-methods-grid">
              {paymentMethods.map((method) => (
                <div key={method.id} className={`qr-method-card ${method.enabled ? 'active' : ''}`}>
                  <div className="qr-card-header">
                    <div className="qr-method-brand">
                      <div className={`qr-brand-dot ${method.enabled ? 'pulse' : ''}`} />
                      <h4>{method.name}</h4>
                    </div>
                    <label className="qr-status-toggle">
                      <span>{method.enabled ? 'Enabled' : 'Disabled'}</span>
                      <input
                        type="checkbox"
                        className="settings-toggle-switch"
                        checked={!!method.enabled}
                        onChange={() => togglePaymentMethod(method.id)}
                      />
                    </label>
                  </div>

                  <div className="qr-card-body">
                    <div className="qr-upload-section">
                      {!method.qrCodeImage ? (
                        <label className="qr-file-label">
                          <span className="qr-label-text">QR IMAGE</span>
                          <div className="qr-input-custom">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQRUpload(method.id, e)}
                            />
                            <div className="qr-input-placeholder">
                              <FaUpload /> Choose Image
                            </div>
                          </div>
                        </label>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeQRCode(method.id)}
                          className="qr-remove-btn"
                        >
                          <FaTimes /> Remove QR
                        </button>
                      )}
                    </div>

                    {method.qrCodeImage && (
                      <div className="qr-preview-container">
                        <div className="qr-preview-frame">
                          <img
                            src={getImageUrl(method.qrCodeImage)}
                            alt={`${method.name} QR`}
                          />
                        </div>
                        <span className="qr-preview-hint">Customer View</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
