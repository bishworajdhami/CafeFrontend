import { useState, useRef } from 'react';
import {
  FaDownload, FaUpload, FaTrash, FaExclamationTriangle,
  FaCheck, FaFileCsv, FaFileExcel, FaDatabase,
  FaSpinner, FaShieldAlt, FaCheckSquare, FaSquare, FaTimes
} from 'react-icons/fa';
import { getJson, postJson } from '../../../utils/api';
import './DataManagementTab.css';

const DATASETS = [
  { key: 'orders',    label: 'Orders',         desc: 'All customer orders & KOTs' },
  { key: 'payments',  label: 'Payments',        desc: 'Payment transactions' },
  { key: 'menu',      label: 'Menu Items',      desc: 'Categories & menu items' },
  { key: 'staff',     label: 'Staff Accounts',  desc: 'Employee profiles' },
  { key: 'bookings',  label: 'Table Bookings',  desc: 'Reservation history' },
  { key: 'refunds',   label: 'Refunds',         desc: 'Refund records' },
];

function flattenObj(obj, prefix = '') {
  return Object.keys(obj || {}).reduce((acc, key) => {
    const val = obj[key];
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val))
      return { ...acc, ...flattenObj(val, newKey) };
    acc[newKey] = val;
    return acc;
  }, {});
}

function toCSV(rows) {
  if (!rows || !rows.length) return 'No data available\n';
  const flat = rows.map(r => flattenObj(r));
  const headers = Object.keys(flat[0]);
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(','),
    ...flat.map(r => headers.map(h => escape(r[h] ?? '')).join(','))
  ].join('\n');
}

function toExcelHTML(datasets) {
  const tableHtml = datasets.map(({ label, rows }) => {
    if (!rows || !rows.length) return `<h2>${label}</h2><p>No data.</p>`;
    const flat = rows.map(r => flattenObj(r));
    const headers = Object.keys(flat[0]);
    return `
      <h2>${label}</h2>
      <p class="meta">Records: ${flat.length}</p>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${flat.map((r, i) => `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  }).join('<br/>');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;padding:20px;background:#fafafa}
  h2{color:#065f46;border-left:4px solid #10b981;padding-left:10px;margin-top:32px}
  .meta{color:#64748b;font-size:12px;margin-bottom:8px}
  table{border-collapse:collapse;width:100%;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  thead th{background:#10b981;color:#fff;font-weight:700;padding:10px 14px;border:1px solid #059669;text-align:left;font-size:12px}
  tbody tr.even td{background:#fff}
  tbody tr.odd td{background:#f0fdf4}
  td{padding:8px 14px;border:1px solid #e2e8f0;font-size:11px;color:#1e293b}
  .cover{background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:24px;border-radius:8px;margin-bottom:24px}
  .cover h1{margin:0 0 4px;font-size:22px}
  .cover p{margin:0;opacity:.85;font-size:13px}
</style></head><body>
  <div class="cover"><h1>📊 Data Export</h1><p>Exported: ${new Date().toLocaleString()}</p></div>
  ${tableHtml}
</body></html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Reset Confirmation Inline Modal ───────────────────────────────────────
function ResetModal({ onClose, onConfirm, onDownloadBackup, loadingBackup }) {
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (typed !== 'RESET ALL DATA') return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <div className="dm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dm-confirm-modal">
        <button className="dm-modal-close" onClick={onClose}><FaTimes /></button>

        {step === 1 && (
          <>
            <div className="dm-modal-icon danger"><FaExclamationTriangle /></div>
            <h3>Reset All Data?</h3>
            <p className="dm-modal-desc">
              This will permanently delete <strong>all orders, payments, staff accounts, menu items, bookings, and refunds</strong>.
              Your manager account will be preserved.
            </p>
            <div className="dm-modal-tip">
              <FaShieldAlt /> We recommend downloading a backup before proceeding.
            </div>
            <div className="dm-modal-actions">
              <button
                className="dm-btn dm-btn-outline"
                onClick={onDownloadBackup}
                disabled={loadingBackup}
              >
                {loadingBackup ? <FaSpinner className="spin" /> : <FaDownload />}
                {loadingBackup ? ' Downloading...' : ' Download Backup First'}
              </button>
              <button className="dm-btn dm-btn-danger" onClick={() => setStep(2)}>
                Continue Without Backup
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="dm-modal-icon danger"><FaTrash /></div>
            <h3>Final Confirmation</h3>
            <p className="dm-modal-desc">Type <strong>RESET ALL DATA</strong> below to confirm this irreversible action.</p>
            <input
              className="dm-confirm-input"
              placeholder="Type: RESET ALL DATA"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoFocus
            />
            <div className="dm-modal-actions">
              <button className="dm-btn dm-btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="dm-btn dm-btn-danger"
                disabled={typed !== 'RESET ALL DATA' || busy}
                onClick={handleConfirm}
              >
                {busy ? <><FaSpinner className="spin" /> Resetting...</> : <><FaTrash /> Reset All Data</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function DataManagementTab({ setError, setSuccess }) {
  const [selected, setSelected] = useState(new Set(DATASETS.map(d => d.key)));
  const [format, setFormat] = useState('excel');
  const [exporting, setExporting] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const fileRef = useRef();

  const allSelected = selected.size === DATASETS.length;

  function toggleDataset(key) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(DATASETS.map(d => d.key)));
  }

  // ── Export ──────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!selected.size) { setError?.('Select at least one dataset.'); return; }
    setExporting(true);
    try {
      const backup = await getJson('/api/backup');
      const date = new Date().toISOString().split('T')[0];

      const dataMap = {
        orders:   backup?.orders   || backup?.Orders   || [],
        payments: backup?.payments || backup?.Payments || [],
        menu:     backup?.menuItems|| backup?.MenuItems|| backup?.menu || [],
        staff:    backup?.users    || backup?.Users    || backup?.staff || [],
        bookings: backup?.bookings || backup?.Bookings || [],
        refunds:  backup?.refunds  || backup?.Refunds  || [],
      };

      const chosen = DATASETS.filter(d => selected.has(d.key));

      if (format === 'csv') {
        // Multi-section CSV
        const sections = chosen.map(d =>
          `===== ${d.label} =====\n${toCSV(dataMap[d.key])}`
        ).join('\n\n');
        downloadBlob(new Blob([sections], { type: 'text/csv' }), `cafe_export_${date}.csv`);
      } else {
        const datasetsForHtml = chosen.map(d => ({ label: d.label, rows: dataMap[d.key] }));
        const html = toExcelHTML(datasetsForHtml);
        downloadBlob(
          new Blob([html], { type: 'application/vnd.ms-excel' }),
          `cafe_export_${date}.xls`
        );
      }
      setSuccess?.('Export downloaded successfully!');
    } catch (err) {
      setError?.(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  // ── Backup JSON download ────────────────────────────────────────────────
  async function handleDownloadBackup() {
    setBackupLoading(true);
    try {
      const data = await getJson('/api/backup');
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        `cafe_backup_${date}.json`
      );
      setSuccess?.('Backup downloaded!');
    } catch (err) {
      setError?.(err.message || 'Backup failed.');
    } finally {
      setBackupLoading(false);
    }
  }

  // ── Restore ─────────────────────────────────────────────────────────────
  async function handleRestore() {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const text = await restoreFile.text();
      const payload = JSON.parse(text);
      const res = await postJson('/api/restore', payload);
      if (res?.status) {
        setSuccess?.('Data restored successfully!');
        setRestoreFile(null);
      } else {
        throw new Error(res?.message || 'Restore failed');
      }
    } catch (err) {
      setError?.(err.message || 'Invalid backup file.');
    } finally {
      setRestoring(false);
    }
  }

  // ── Reset all ───────────────────────────────────────────────────────────
  async function performReset() {
    try {
      const res = await postJson('/api/manager/clear-operational-data', {});
      if (!res?.status) throw new Error(res?.message || 'Reset failed');
      setSuccess?.('All data has been reset. Your manager account is preserved.');
      setShowReset(false);
    } catch (err) {
      setError?.(err.message);
      setShowReset(false);
    }
  }

  return (
    <div className="settings-tab-container cc-fadeIn">
      {showReset && (
        <ResetModal
          onClose={() => setShowReset(false)}
          onConfirm={performReset}
          onDownloadBackup={handleDownloadBackup}
          loadingBackup={backupLoading}
        />
      )}

      <div className="settings-section-grid">
        {/* ── EXPORT PANEL ── */}
        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3><FaDownload /> Export Business Data</h3>
            <p>Download records as a styled spreadsheet or CSV file.</p>
          </div>
          <div className="settings-panel-content">
            <div className="dm-card-body">
              {/* Format toggle */}
              <div className="dm-format-toggle">
                <button
                  className={`dm-format-btn ${format === 'excel' ? 'active' : ''}`}
                  onClick={() => setFormat('excel')}
                >
                  <FaFileExcel /> Excel (.xls)
                </button>
                <button
                  className={`dm-format-btn ${format === 'csv' ? 'active' : ''}`}
                  onClick={() => setFormat('csv')}
                >
                  <FaFileCsv /> CSV (.csv)
                </button>
              </div>

              {/* Dataset selection */}
              <div className="dm-selection-header">
                <span className="dm-section-label">Select Datasets</span>
                <button className="dm-toggle-all" onClick={toggleAll}>
                  {allSelected ? <FaCheckSquare /> : <FaSquare />}
                  {allSelected ? ' Deselect All' : ' Select All'}
                </button>
              </div>
              <div className="dm-datasets">
                {DATASETS.map(d => (
                  <button
                    key={d.key}
                    className={`dm-dataset-chip ${selected.has(d.key) ? 'selected' : ''}`}
                    onClick={() => toggleDataset(d.key)}
                  >
                    <span className="dm-chip-check">
                      {selected.has(d.key) ? <FaCheck /> : <FaSquare />}
                    </span>
                    <span>
                      <span className="dm-chip-label">{d.label}</span>
                      <span className="dm-chip-desc">{d.desc}</span>
                    </span>
                  </button>
                ))}
              </div>

              <button
                className="dm-btn dm-btn-primary dm-btn-full"
                onClick={handleExport}
                disabled={exporting || !selected.size}
                style={{ marginTop: '1rem' }}
              >
                {exporting
                  ? <><FaSpinner className="spin" /> Preparing Export...</>
                  : <><FaDownload /> Export {selected.size} Dataset{selected.size !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── BACKUP & RESTORE PANEL ── */}
        <div className="settings-panel">
          <div className="settings-panel-header">
            <h3><FaDatabase /> Backup &amp; Restore</h3>
            <p>Full JSON snapshots for system migration or recovery.</p>
          </div>
          <div className="settings-panel-content">
            <div className="dm-card-body">
              <button
                className="dm-btn dm-btn-primary dm-btn-full"
                onClick={handleDownloadBackup}
                disabled={backupLoading}
              >
                {backupLoading
                  ? <><FaSpinner className="spin" /> Downloading...</>
                  : <><FaDownload /> Download Full Backup (JSON)</>}
              </button>

              <div className="dm-divider"><span>or restore</span></div>

              <div
                className={`dm-dropzone ${restoreFile ? 'has-file' : ''}`}
                onClick={() => fileRef.current?.click()}
              >
                <FaUpload className="dm-dropzone-icon" />
                {restoreFile
                  ? <><strong>{restoreFile.name}</strong><br /><small>{(restoreFile.size / 1024).toFixed(1)} KB</small></>
                  : <><strong>Click to upload backup</strong><br /><small>JSON backup files only</small></>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={e => setRestoreFile(e.target.files[0] || null)}
                />
              </div>

              {restoreFile && (
                <button
                  className="dm-btn dm-btn-success dm-btn-full"
                  onClick={handleRestore}
                  disabled={restoring}
                  style={{ marginTop: '1rem' }}
                >
                  {restoring
                    ? <><FaSpinner className="spin" /> Restoring...</>
                    : <><FaUpload /> Restore from Backup</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── DANGER ZONE ── */}
      <div className="settings-section-grid" style={{ marginTop: '2rem' }}>
        <div className="settings-panel" style={{ borderColor: '#fca5a5' }}>
          <div className="settings-panel-header" style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)' }}>
            <h3 style={{ color: '#dc2626' }}><FaExclamationTriangle /> Reset All Data</h3>
            <p>Permanently wipe all operational records.</p>
          </div>
          <div className="settings-panel-content">
            <div className="dm-card-body">
              <div className="dm-danger-list">
                <span className="dm-danger-item deleted">✗ All Orders &amp; KOTs</span>
                <span className="dm-danger-item deleted">✗ All Payments</span>
                <span className="dm-danger-item deleted">✗ All Staff Accounts</span>
                <span className="dm-danger-item deleted">✗ All Menu Items</span>
                <span className="dm-danger-item deleted">✗ All Bookings &amp; Refunds</span>
                <span className="dm-danger-item kept">✓ Your Manager Account (kept)</span>
              </div>
              <button
                className="dm-btn dm-btn-danger dm-btn-full"
                onClick={() => setShowReset(true)}
                style={{ marginTop: '1rem' }}
              >
                <FaTrash /> Reset All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

