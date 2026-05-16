import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardShellSkeleton from '../../components/skeletons/DashboardShellSkeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaClipboardList, FaCheckCircle, FaHistory, FaBox, FaChevronUp, FaChevronDown, FaUserCircle } from 'react-icons/fa';
import KitchenDisplay from './KitchenDisplay';
import ItemAvailability from './ItemAvailability';
import ChefStockTracking from './ChefStockTracking';
import OrderHistory from './OrderHistory';
import MenuManagement from '../Manager/MenuManagement';
import ProfileModal from '../../components/ProfileModal';
import { getJson, getImageUrl } from '../../utils/api';
import './ChefDashboard.css';

const allTabs = [
    { id: 'orders', label: 'Order Queue', icon: FaClipboardList },
    { id: 'menu', label: 'Menu Management', icon: FaBox, permission: 'kitchen.manage_menu' },
    { id: 'availability', label: 'Item Availability', icon: FaCheckCircle, permission: 'kitchen.toggle_availability' },
    { id: 'stock', label: 'Stock Tracking', icon: FaBox },
    { id: 'history', label: 'Order History', icon: FaHistory },
];

export default function ChefDashboard() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'orders';

    const setActiveTab = (tabId) => {
        setSearchParams({ tab: tabId });
    };

    const [cafeName, setCafeName] = useState(localStorage.getItem('cachedCafeName') || 'Cafe');
    const [cafeLogo, setCafeLogo] = useState(localStorage.getItem('cachedCafeLogo') || null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [userName, setUserName] = useState(localStorage.getItem('name') || localStorage.getItem('email') || 'Profile');
    const [profilePictureUrl, setProfilePictureUrl] = useState(localStorage.getItem('profilePictureUrl') || '');
    const [loading, setLoading] = useState(!localStorage.getItem('cachedCafeName'));
    const [isHeaderVisible, setIsHeaderVisible] = useState(() => {
        return localStorage.getItem('chef_header_visible') !== 'false';
    });

    const toggleHeader = () => {
        const newValue = !isHeaderVisible;
        setIsHeaderVisible(newValue);
        localStorage.setItem('chef_header_visible', newValue);
    };

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        const handleProfileUpdate = () => {
            setUserName(localStorage.getItem('name') || localStorage.getItem('email') || 'Profile');
            setProfilePictureUrl(localStorage.getItem('profilePictureUrl') || '');
        };
        window.addEventListener('profileUpdated', handleProfileUpdate);
        return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
    }, []);

    async function loadSettings() {
        try {
            const data = await getJson('/api/manager/settings');
            if (data) {
                const name = data.cafeName ?? data.CafeName ?? 'Cafe';
                const logo = data.cafeLogo ?? data.CafeLogo ?? null;
                setCafeName(name);
                setCafeLogo(logo);
                localStorage.setItem('cachedCafeName', name);
                if (logo) localStorage.setItem('cachedCafeLogo', logo);
                else localStorage.removeItem('cachedCafeLogo');
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        navigate('/login');
    }

    const hasPermission = useCallback((perm) => {
        if (!perm) return true;
        const permissions = (localStorage.getItem('permissions') || '').split(',');
        return permissions.includes(perm);
    }, []);

    const tabs = useMemo(() => allTabs.filter(tab => hasPermission(tab.permission)), [hasPermission]);

    useEffect(() => {
        const activeTabObj = tabs.find(t => t.id === activeTab);
        if (activeTabObj) {
            document.title = `${activeTabObj.label} | ${cafeName} Dashboard`;
        }
    }, [activeTab, tabs, cafeName]);

    if (loading) return <DashboardShellSkeleton />;

    return (
        <div className="chef-dashboard">
            {isHeaderVisible && (
                <header className="dashboard-header transition-banner">
                    <div className="header-content">
                        <div className="header-titles">
                            {cafeLogo && (
                                <img
                                    src={getImageUrl(cafeLogo)}
                                    alt="Cafe Logo"
                                    className="header-logo transition-logo"
                                />
                            )}
                            <div className="header-titles-text">
                                <h1 className="cafe-name transition-name">{cafeName}</h1>
                                <p className="dashboard-subtitle">Chef Dashboard</p>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="header-profile-pill" onClick={() => setIsProfileOpen(true)} aria-label="User Profile">
                                <div className="profile-pill-avatar">
                                    {profilePictureUrl ? (
                                        <img src={getImageUrl(profilePictureUrl)} alt="Profile" />
                                    ) : (
                                        userName.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="profile-pill-name">{userName}</span>
                            </button>
                        </div>
                    </div>
                </header>
            )}

            <nav className="dashboard-nav" aria-label="Dashboard Navigation">
                <div className="nav-container" role="tablist">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            title={tab.label}
                            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-icon">{React.createElement(tab.icon)}</span>
                            <span className="tab-label">{tab.label}</span>
                        </button>
                    ))}
                    
                    <div className="nav-actions">
                        {!isHeaderVisible && (
                            <button 
                                className="nav-icon-btn profile-nav-btn" 
                                onClick={() => setIsProfileOpen(true)} 
                                title="User Profile"
                            >
                                {profilePictureUrl ? (
                                    <div className="nav-profile-img-wrap">
                                        <img src={getImageUrl(profilePictureUrl)} alt="Profile" className="nav-profile-img" />
                                    </div>
                                ) : (
                                    <FaUserCircle />
                                )}
                            </button>
                        )}
                        <button 
                            className="nav-icon-btn toggle-header-btn" 
                            onClick={toggleHeader} 
                            title={isHeaderVisible ? "Hide Header" : "Show Header"}
                        >
                            {isHeaderVisible ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="dashboard-content">
                <div key={activeTab} style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    {activeTab === 'orders' && <KitchenDisplay />}
                    {activeTab === 'menu' && hasPermission('kitchen.manage_menu') && <MenuManagement isChefView={true} />}
                    {activeTab === 'availability' && hasPermission('kitchen.toggle_availability') && <ItemAvailability />}
                    {activeTab === 'stock' && <ChefStockTracking />}
                    {activeTab === 'history' && <OrderHistory />}
                </div>
            </main>

            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onLogout={logout}
            />
        </div>
    );
}
