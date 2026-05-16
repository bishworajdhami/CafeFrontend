import React, { useState, useEffect, useCallback } from 'react';
import SettingsSkeleton from '../../components/skeletons/SettingsSkeleton';
import { FaVolumeUp, FaVolumeMute, FaBell, FaClock, FaCheckCircle, FaSave, FaExclamationTriangle, FaCog, FaBoxOpen, FaTh, FaList } from 'react-icons/fa';
import { getJson, putJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import './KitchenSettings.css';

export default function KitchenSettings() {
    const { socketRef } = useSocket();
    const [settings, setSettings] = useState({
        soundEnabled: true,
        autoAcceptOrders: true,
        priorityAlerts: true,
        displayMode: 'grid',
        prepTimeWarning: 15,
        maxActiveOrders: 10
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getJson('/api/kitchen/settings');
            if (data) {
                setSettings({
                    soundEnabled: data.soundEnabled ?? true,
                    autoAcceptOrders: data.autoAcceptOrders ?? true,
                    priorityAlerts: data.priorityAlerts ?? true,
                    displayMode: data.displayMode ?? 'grid',
                    prepTimeWarning: data.prepTimeWarning ?? 15,
                    maxActiveOrders: data.maxActiveOrders ?? 10,
                });
            }
        } catch (err) {
            setError('Failed to load kitchen settings.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();

        const conn = socketRef?.current;
        if (conn) {
            conn.on('SettingsUpdated', loadSettings);
        }
        return () => {
            if (conn) conn.off('SettingsUpdated', loadSettings);
        };
    }, [loadSettings, socketRef]);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError('');
            await putJson('/api/kitchen/settings', {
                soundEnabled: settings.soundEnabled,
                autoAcceptOrders: settings.autoAcceptOrders,
                priorityAlerts: settings.priorityAlerts,
                displayMode: settings.displayMode,
                prepTimeWarning: settings.prepTimeWarning,
                maxActiveOrders: settings.maxActiveOrders,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError('Failed to save settings. Please try again.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    const setNum = (key, val) => {
        const num = parseInt(val);
        if (!isNaN(num)) setSettings(prev => ({ ...prev, [key]: num }));
    };

    if (loading) {
        return (
            <div className="ks-page">
                <header className="standard-page-header">
                    <div className="standard-page-header-text">
                        <h1 className="standard-page-title"><FaCog style={{marginRight: '8px'}} /> Kitchen Settings</h1>
                        <p className="standard-page-subtitle">Configure your kitchen display and workflow preferences</p>
                    </div>
                </header>
                <SettingsSkeleton />
            </div>
        );
    }

    return (
        <div className="ks-page">
            {/* Page Header */}
            <header className="standard-page-header">
                <div className="standard-page-header-text">
                    <h1 className="standard-page-title"><FaCog style={{marginRight: '8px'}} /> Kitchen Settings</h1>
                    <p className="standard-page-subtitle">Configure your kitchen display and workflow preferences</p>
                </div>
                <div className="standard-page-header-actions">
                    <button className="ks-save-btn" onClick={handleSave} disabled={saving}>
                        {saved ? <><FaCheckCircle /> Saved!</> : saving ? 'Saving...' : <><FaSave /> Save Changes</>}
                    </button>
                </div>
            </header>

            {error && (
                <div className="ks-error-banner">
                    <FaExclamationTriangle /> {error}
                </div>
            )}

            {saved && (
                <div className="ks-success-banner">
                    <FaCheckCircle /> Settings saved successfully!
                </div>
            )}

            <div className="ks-grid">
                {/* Sound Notifications Card */}
                <div className="ks-card">
                    <div className="ks-card-icon-wrap sound">
                        {settings.soundEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
                    </div>
                    <div className="ks-card-body">
                        <div className="ks-card-title">Sound Notifications</div>
                        <div className="ks-card-desc">Play audio alert when a new order arrives in the kitchen queue</div>
                        <div className="ks-card-meta">
                            <span className={`ks-badge ${settings.soundEnabled ? 'active' : 'inactive'}`}>
                                {settings.soundEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                    <label className="ks-toggle">
                        <input
                            type="checkbox"
                            checked={settings.soundEnabled}
                            onChange={() => toggle('soundEnabled')}
                        />
                        <span className="ks-slider" />
                    </label>
                </div>

                {/* Priority Alerts Card */}
                <div className="ks-card">
                    <div className="ks-card-icon-wrap alert">
                        <FaBell />
                    </div>
                    <div className="ks-card-body">
                        <div className="ks-card-title">Priority Alerts</div>
                        <div className="ks-card-desc">Highlight and visually accent high-priority or overdue orders</div>
                        <div className="ks-card-meta">
                            <span className={`ks-badge ${settings.priorityAlerts ? 'active' : 'inactive'}`}>
                                {settings.priorityAlerts ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                    <label className="ks-toggle">
                        <input
                            type="checkbox"
                            checked={settings.priorityAlerts}
                            onChange={() => toggle('priorityAlerts')}
                        />
                        <span className="ks-slider" />
                    </label>
                </div>

                {/* Auto-Accept Card */}
                <div className="ks-card">
                    <div className="ks-card-icon-wrap auto">
                        <FaCheckCircle />
                    </div>
                    <div className="ks-card-body">
                        <div className="ks-card-title">Auto-Accept Orders</div>
                        <div className="ks-card-desc">Automatically move incoming orders to "Preparing" status without manual confirmation</div>
                        <div className="ks-card-meta">
                            <span className={`ks-badge ${settings.autoAcceptOrders ? 'active' : 'inactive'}`}>
                                {settings.autoAcceptOrders ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                    <label className="ks-toggle">
                        <input
                            type="checkbox"
                            checked={settings.autoAcceptOrders}
                            onChange={() => toggle('autoAcceptOrders')}
                        />
                        <span className="ks-slider" />
                    </label>
                </div>

                {/* Prep Time Warning Card */}
                <div className="ks-card">
                    <div className="ks-card-icon-wrap time">
                        <FaClock />
                    </div>
                    <div className="ks-card-body">
                        <div className="ks-card-title">Prep Time Warning</div>
                        <div className="ks-card-desc">Alert when an order's prep time exceeds the threshold (minutes)</div>
                        <div className="ks-card-meta">
                            <span className="ks-badge active">{settings.prepTimeWarning} min</span>
                        </div>
                    </div>
                    <div className="ks-number-control">
                        <button onClick={() => setNum('prepTimeWarning', Math.max(5, settings.prepTimeWarning - 1))}>−</button>
                        <input
                            type="number"
                            value={settings.prepTimeWarning}
                            onChange={e => setNum('prepTimeWarning', e.target.value)}
                            min={5} max={60}
                        />
                        <button onClick={() => setNum('prepTimeWarning', Math.min(60, settings.prepTimeWarning + 1))}>+</button>
                    </div>
                </div>

                {/* Max Active Orders Card */}
                <div className="ks-card">
                    <div className="ks-card-icon-wrap orders">
                        <FaBoxOpen />
                    </div>
                    <div className="ks-card-body">
                        <div className="ks-card-title">Max Active Orders</div>
                        <div className="ks-card-desc">Maximum number of orders displayed simultaneously on the kitchen screen</div>
                        <div className="ks-card-meta">
                            <span className="ks-badge active">{settings.maxActiveOrders} orders</span>
                        </div>
                    </div>
                    <div className="ks-number-control">
                        <button onClick={() => setNum('maxActiveOrders', Math.max(5, settings.maxActiveOrders - 1))}>−</button>
                        <input
                            type="number"
                            value={settings.maxActiveOrders}
                            onChange={e => setNum('maxActiveOrders', e.target.value)}
                            min={5} max={50}
                        />
                        <button onClick={() => setNum('maxActiveOrders', Math.min(50, settings.maxActiveOrders + 1))}>+</button>
                    </div>
                </div>

                {/* Display Mode Card */}
                <div className="ks-card">
                    <div className="ks-card-icon-wrap display">
                        {settings.displayMode === 'grid' ? <FaTh /> : <FaList />}
                    </div>
                    <div className="ks-card-body">
                        <div className="ks-card-title">Display Mode</div>
                        <div className="ks-card-desc">Choose how active orders are arranged on the kitchen display</div>
                        <div className="ks-mode-selector">
                            {['grid', 'list', 'compact'].map(mode => (
                                <button
                                    key={mode}
                                    className={`ks-mode-btn ${settings.displayMode === mode ? 'selected' : ''}`}
                                    onClick={() => setSettings(prev => ({ ...prev, displayMode: mode }))}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
