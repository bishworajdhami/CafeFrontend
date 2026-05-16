import React, { useState, useEffect } from 'react';
import ItemAvailabilitySkeleton from '../../components/skeletons/ItemAvailabilitySkeleton';
import { FaSearch, FaBoxOpen, FaLayerGroup } from 'react-icons/fa';
import { getJson, putJson } from '../../utils/api';
import { useSocket } from '../../SocketContext';
import Modal from '../../components/Modal';
import './ItemAvailability.css';

export default function ItemAvailability() {
    const { socketRef } = useSocket();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        type: 'primary',
        onConfirm: null
    });


    useEffect(() => {
        loadItems();
    }, []);

    useEffect(() => {
        const conn = socketRef?.current;
        if (!conn) return;

        const handleUpdate = () => {
            loadItems();
        };

        conn.on('NewOrder', handleUpdate);
        conn.on('OrderUpdated', handleUpdate);
        conn.on('PaymentUpdate', handleUpdate);
        conn.on('MenuUpdate', handleUpdate);

        return () => {
            conn.off('NewOrder', handleUpdate);
            conn.off('OrderUpdated', handleUpdate);
            conn.off('PaymentUpdate', handleUpdate);
            conn.off('MenuUpdate', handleUpdate);
        };
    }, [socketRef]);

    async function loadItems() {
        try {
            setLoading(true);
            const data = await getJson('/api/kitchen/menu');
            if (data) setItems(data);
        } catch (err) {
            console.error("Failed to load menu", err);
        } finally {
            setLoading(false);
        }
    }

    async function toggleAvailability(item) {
        // Optimistic update
        const originalItems = [...items];
        const newStatus = !item.isAvailable;

        setItems(items.map(i => i.id === item.id ? { ...i, isAvailable: newStatus } : i));

        try {
            await putJson(`/api/kitchen/menu/${item.id}/availability`, { isAvailable: newStatus });
        } catch (err) {
            console.error("Failed to update status", err);
            // Revert on failure
            setItems(originalItems);
            setConfirmModal({
                show: true,
                title: 'Update Failed',
                message: 'Failed to update item availability. Please try again.',
                type: 'danger',
                onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false }))
            });
        }
    }

    // derived state
    const categories = ['All', ...new Set(items.map(i => i.category || 'Uncategorized'))];

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'All' || (item.category || 'Uncategorized') === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // Group for display
    const groupedItems = filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    return (
        <div className="availability-container">
            <header className="standard-page-header">
                <div className="standard-page-header-text">
                    <h1 className="standard-page-title"><FaBoxOpen style={{marginRight: '8px'}} /> Item Availability Manager</h1>
                    <p className="standard-page-subtitle">Manage stock status for the Menu</p>
                </div>

                <div className="standard-page-header-actions">
                    <div className="stats-pills">
                        <div className="pill available">
                            <span className="value">{items.filter(i => i.isAvailable).length}</span>
                            <span className="label">In Stock</span>
                        </div>
                        <div className="pill unavailable">
                            <span className="value">{items.filter(i => !i.isAvailable).length}</span>
                            <span className="label">Sold Out</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <FaSearch className="icon" />
                    <input
                        type="text"
                        placeholder="Search menu items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="category-scroll">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`cat-chip ${filterCategory === cat ? 'active' : ''}`}
                            onClick={() => setFilterCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="inventory-grid">
                {loading ? (
                    <ItemAvailabilitySkeleton />
                ) : Object.keys(groupedItems).length === 0 ? (
                    <div className="empty-state">No items found matching your filters.</div>
                ) : (
                    Object.entries(groupedItems).map(([category, catItems]) => (
                        <div key={category} className="category-group">
                            <h3 className="category-title"><FaLayerGroup /> {category}</h3>
                            <div className="items-list">
                                {catItems.map(item => (
                                    <div key={item.id} className={`inventory-card ${item.isAvailable ? 'in-stock' : 'out-of-stock'}`}>
                                        <div className="card-info">
                                            <h4>{item.name}</h4>
                                            <span className="price-tag">NRP {item.price}</span>
                                        </div>
                                        <div className="card-action">
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={item.isAvailable}
                                                    onChange={() => toggleAvailability(item)}
                                                />
                                                <span className="slider round"></span>
                                            </label>
                                            <span className="status-text">
                                                {item.isAvailable ? 'Available' : 'Sold Out'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
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
