import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import TableBookingSkeleton from '../../components/skeletons/TableBookingSkeleton';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClock, FaUser, FaPhone, FaMapMarkerAlt, FaFilter, FaSearch, FaPlus, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { MdTableRestaurant } from 'react-icons/md';
import { getJson, postJson } from '../../utils/api';
import Modal from '../../components/Modal';
import { useSocket } from '../../SocketContext';
import './TableBooking.css';

// Helper: returns YYYY-MM-DD in local timezone (avoids UTC date shift near midnight)
function toLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default function TableBooking() {
    const { connection } = useSocket();
    const [bookings, setBookings] = useState([]);
    const [tableConfig, setTableConfig] = useState({ floors: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [allOccupiedSeats, setAllOccupiedSeats] = useState([]); // Track per-seat occupancy

    // Filter states
    const [selectedFloor, setSelectedFloor] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [rangeType, setRangeType] = useState('day'); // 'day', 'week', 'month', 'year', 'custom'
    const [startDate, setStartDate] = useState(toLocalDateString());
    const [endDate, setEndDate] = useState(toLocalDateString());
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('visual');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        floorName: '',
        tableNumber: '',
        partySize: 2,
        startTime: '',
        durationMinutes: 60
    });
    const [tableAvailability, setTableAvailability] = useState({ available: true, maxSeats: 1, checking: false });
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        type: 'primary',
        onConfirm: null
    });

    // Table Context Menu State
    const [selectedTableAction, setSelectedTableAction] = useState(null); // { floorName, tableNumber, status, bookingId, orderId }
    const [selectedSeats, setSelectedSeats] = useState([]); // For walk-in selection
    const navigate = useNavigate();

    const loadSettings = useCallback(async () => {
        try {
            const data = await getJson('/api/manager/settings');
            if (data) {
                let tableConfigVal = data.tableConfiguration ?? data.TableConfiguration;
                if (typeof tableConfigVal === 'string') {
                    try { tableConfigVal = JSON.parse(tableConfigVal); } catch (e) { tableConfigVal = { floors: [] }; }
                }
                if (tableConfigVal && tableConfigVal.floors) {
                    setTableConfig(tableConfigVal);
                }
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }, []);

    const loadBookings = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            // Use /api/booking/current?startDate=...&endDate=...
            const data = await getJson(`/api/booking/current?startDate=${startDate}&endDate=${endDate}`);

            if (data && data.status) {
                const apiBookings = data.bookings || [];
                const occupiedSeats = data.occupiedSeats || [];

                // 1. Process regular bookings
                const processedBookings = apiBookings.map(b => ({
                    id: b.id,
                    customerName: b.customerName || 'Guest',
                    customerPhone: b.customerPhone || '',
                    floorName: b.floorName,
                    tableNumber: b.tableNumber,
                    seatNumber: b.seatNumber,
                    bookingDate: b.startTime,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    durationMinutes: b.durationMinutes,
                    status: (b.status || 'active').toLowerCase(),
                    orderId: b.orderId,
                }));

                // 2. Process occupied seats that DON'T have a matching booking in the list
                // Group seats by orderId (each distinct orderId = independent seat-group/customer)
                const seatGroups = {};
                occupiedSeats.forEach(seat => {
                    if (!seat.bookingId) {
                        // Key by orderId if present, else by floor+table (fallback for legacy seats)
                        const groupKey = seat.orderId
                            ? `order-${seat.orderId}`
                            : `${seat.floorName}-${seat.tableNumber}`;

                        if (!seatGroups[groupKey]) {
                            seatGroups[groupKey] = {
                                floorName: seat.floorName,
                                tableNumber: seat.tableNumber,
                                orderId: seat.orderId || null,
                                seats: []
                            };
                        }
                        seatGroups[groupKey].seats.push(seat);
                    }
                });

                // Create synthetic booking objects for these seat groups
                const syntheticBookings = Object.values(seatGroups).map(group => {
                    const seatNums = group.seats
                        .map(s => s.seatNumber)
                        .filter(Boolean)
                        .sort((a, b) => a - b);

                    const label = seatNums.length > 0
                        ? `Walk-in (Seats: ${seatNums.join(', ')})`
                        : 'Walk-in / Occupied';

                    return {
                        id: `synthetic-${group.orderId ?? `${group.floorName}-${group.tableNumber}`}`,
                        isSynthetic: true,
                        seatIds: group.seats.map(s => s.id),
                        orderId: group.orderId,
                        customerName: label,
                        customerPhone: '-',
                        floorName: group.floorName,
                        tableNumber: group.tableNumber,
                        seatNumber: group.seats.length,
                        bookingDate: new Date().toISOString(),
                        startTime: new Date().toISOString(),
                        durationMinutes: 0,
                        status: 'active'
                    };
                });

                setBookings([...processedBookings, ...syntheticBookings]);
                setAllOccupiedSeats(occupiedSeats);
            } else {
                setBookings([]);
                setAllOccupiedSeats([]);
            }
        } catch (err) {
            console.error('Failed to load bookings:', err);
            setError(`Failed to load bookings: ${err.message || 'Please try again.'}`);
            setBookings([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        loadBookings();
        loadSettings();
    }, [loadBookings, loadSettings]);

    useEffect(() => {
        const conn = connection;
        if (!conn) return;

        const handleUpdate = () => {
            loadBookings();
        };

        conn.on('NewOrder', handleUpdate);
        conn.on('OrderUpdated', handleUpdate);
        conn.on('PaymentUpdate', handleUpdate);
        conn.on('table.stateChanged', handleUpdate);

        return () => {
            conn.off('NewOrder', handleUpdate);
            conn.off('OrderUpdated', handleUpdate);
            conn.off('PaymentUpdate', handleUpdate);
            conn.off('table.stateChanged', handleUpdate);
        };
    }, [connection, loadBookings]);

    const checkTableAvailability = useCallback(async () => {
        if (!formData.floorName || !formData.tableNumber) {
            setTableAvailability({ available: true, maxSeats: 1, checking: false });
            return;
        }

        try {
            // Get table configuration to know max seats
            const currentFloor = tableConfig.floors.find(f => f.name === formData.floorName);
            let seatsPerTable = currentFloor?.seats || currentFloor?.seatsPerTable || 1;

            // Check for custom seats exception
            if (currentFloor?.customSeats && currentFloor.customSeats[formData.tableNumber]) {
                seatsPerTable = parseInt(currentFloor.customSeats[formData.tableNumber]);
            }

            // If no start time, we just set max seats but assume available (user hasn't checked time yet)
            if (!formData.startTime) {
                setTableAvailability({ available: true, maxSeats: seatsPerTable, checking: false });
                return;
            }

            setTableAvailability(prev => ({ ...prev, checking: true }));

            const params = new URLSearchParams({
                floorName: formData.floorName,
                tableNumber: formData.tableNumber,
                durationMinutes: formData.durationMinutes.toString()
            });

            if (formData.startTime) {
                params.append('startTime', new Date(formData.startTime).toISOString());
            }

            const data = await getJson(`/api/booking/available?${params}`);

            if (data.status && data.availableSeats) {
                const tableData = data.availableSeats.find(
                    t => t.floor === formData.floorName && t.table === formData.tableNumber
                );

                if (tableData && tableData.seats) {
                    // Whole table booking: If ANY seat is taken, the table is unavailable
                    const isFullyAvailable = tableData.seats.every(s => s.available);
                    setTableAvailability({
                        available: isFullyAvailable,
                        maxSeats: seatsPerTable, // Trust configuration for max seats
                        checking: false
                    });
                } else {
                    // If no data, assume available (or backend error)
                    setTableAvailability({ available: true, maxSeats: seatsPerTable, checking: false });
                }
            }
        } catch (err) {
            console.error('Failed to check availability:', err);
            setTableAvailability({ available: true, maxSeats: 1, checking: false });
        }
    }, [formData.floorName, formData.tableNumber, formData.startTime, formData.durationMinutes, tableConfig.floors]);

    // Check availability when floor/table/time changes
    useEffect(() => {
        checkTableAvailability();
    }, [checkTableAvailability]);

    async function handleCreateBooking(e) {
        e.preventDefault();
        setFormError('');

        // Validation
        if (!formData.customerName.trim()) {
            setFormError('Customer name is required');
            return;
        }
        if (!formData.customerPhone.trim()) {
            setFormError('Customer phone is required');
            return;
        }
        if (!/^\d{10}$/.test(formData.customerPhone.trim())) {
            setFormError('Phone number must be exactly 10 digits and contain only numbers.');
            return;
        }
        if (!formData.floorName || !formData.tableNumber) {
            setFormError('Please select floor and table');
            return;
        }
        if (!formData.partySize || formData.partySize < 1) {
            setFormError('Please enter number of guests');
            return;
        }
        if (formData.partySize > tableAvailability.maxSeats) {
            setFormError(`Maximum ${tableAvailability.maxSeats} guests allowed for this table`);
            return;
        }
        if (formData.startTime && !tableAvailability.available) {
            setFormError('Selected table is not available for this time');
            return;
        }
        if (!formData.startTime) {
            setFormError('Please select start time');
            return;
        }

        try {
            setSubmitting(true);

            const bookingData = {
                customerName: formData.customerName.trim(),
                customerPhone: formData.customerPhone.trim(),
                floorName: formData.floorName,
                tableNumber: formData.tableNumber,
                partySize: parseInt(formData.partySize),
                startTime: new Date(formData.startTime).toISOString(),
                durationMinutes: formData.durationMinutes
            };

            const response = await postJson('/api/booking/reserve', bookingData);

            if (response.status) {
                // Success - close modal and refresh bookings
                setShowModal(false);
                resetForm();
                await loadBookings();
                setError(''); // Clear any previous errors
            } else {
                setFormError(response.message || 'Failed to create booking');
            }
        } catch (err) {
            setFormError(err.message || 'Failed to create booking. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleFreeTable(bookingId, e) {
        if (e) e.stopPropagation();

        // Check if it is a synthetic booking
        const isSynthetic = typeof bookingId === 'string' && bookingId.startsWith('synthetic-');

        setConfirmModal({
            show: true,
            title: isSynthetic ? 'Free Walk-in Table' : 'Complete Booking',
            message: isSynthetic
                ? "This table is occupied without a booking. Do you want to free all seats at this table?"
                : "Are you sure you want to mark this table as free? This will complete the booking.",
            type: 'warning',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, show: false }));
                try {
                    setLoading(true);

                    if (isSynthetic) {
                        // Find the booking object to get seat IDs
                        const booking = bookings.find(b => b.id === bookingId);
                        if (booking && booking.seatIds) {
                            // Release each seat
                            // We do this in parallel or serial? Parallel is fine.
                            const promises = booking.seatIds.map(seatId =>
                                postJson('/api/booking/release-seat', { seatId })
                            );
                            await Promise.all(promises);
                            await loadBookings();
                        }
                    } else {
                        // Regular booking completion
                        const response = await postJson(`/api/booking/${bookingId}/complete`, {});
                        if (response.status) {
                            await loadBookings();
                        } else {
                            setError(response.message || "Failed to free table");
                        }
                    }
                } catch (err) {
                    console.error("Error freeing table:", err);
                    setError("Failed to free table");
                } finally {
                    setLoading(false);
                }
            }
        });
    }

    function resetForm() {
        setFormData({
            customerName: '',
            customerPhone: '',
            floorName: '',
            tableNumber: '',
            partySize: 2,
            startTime: '',
            durationMinutes: 60
        });
        setFormError('');
        setTableAvailability({ available: true, maxSeats: 1, checking: false });
    }

    function openModal() {
        resetForm();
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        resetForm();
    }

    function getBookingStatus(booking) {
        if (booking.isSynthetic) return 'active'; // Always active for walk-ins

        const status = (booking.status || '').toLowerCase();
        if (status === 'completed' || status === 'cancelled') {
            return status;
        }

        const now = new Date();
        const bookingStart = new Date(booking.bookingDate || booking.startTime);

        if (now < bookingStart) return 'upcoming';
        return 'active';
    }

    function getRemainingTime(booking) {
        if (booking.isSynthetic) return 'Occupied';

        const now = new Date();
        const bookingStart = new Date(booking.bookingDate || booking.startTime);
        const bookingEnd = new Date(booking.endTime || (bookingStart.getTime() + booking.durationMinutes * 60000));

        const status = getBookingStatus(booking);

        if (status === 'upcoming') {
            const diff = bookingStart - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            return `Starts in ${hours}h ${minutes}m`;
        } else if (status === 'active') {
            const diff = bookingEnd - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            if (diff < 0) return 'Overdue';
            return `${hours}h ${minutes}m remaining`;
        }
        return 'Completed';
    }

    function formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    const filteredBookings = bookings
        .filter(booking => {
            const status = getBookingStatus(booking);
            const matchesFloor = selectedFloor === 'all' || booking.floorName === selectedFloor;
            const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
            const matchesSearch = searchQuery === '' ||
                booking.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                booking.customerPhone.includes(searchQuery);

            return matchesFloor && matchesStatus && matchesSearch;
        })
        .sort((a, b) => {
            // Latest startTime first
            return new Date(b.startTime) - new Date(a.startTime);
        });

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedFloor, selectedStatus, searchQuery, startDate, endDate]);

    // Handle Range Type changes
    useEffect(() => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (rangeType === 'day') {
            // today
        } else if (rangeType === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            start = new Date(now.setDate(diff));
            end = new Date(now.setDate(diff + 6));
        } else if (rangeType === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (rangeType === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        } else if (rangeType === 'custom') {
            // keep existing or reset to today if switching for first time
            return;
        }

        setStartDate(toLocalDateString(start));
        setEndDate(toLocalDateString(end));
    }, [rangeType]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentBookings = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

    const changePage = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    function getTableBookingStatus(floorName, tableNumber) {
        const tableBookings = bookings.filter(b =>
            b.floorName === floorName &&
            b.tableNumber === tableNumber
        );

        if (tableBookings.length === 0) {
            return { status: 'available', booking: null, seatCount: 0 };
        }

        const activeBookings = tableBookings.filter(b => getBookingStatus(b) === 'active');
        if (activeBookings.length > 0) {
            const totalSeatsBooked = activeBookings.reduce((sum, b) => sum + (b.seatNumber || 1), 0);
            return {
                status: 'active',
                booking: activeBookings[0],
                allBookings: activeBookings,
                seatCount: totalSeatsBooked
            };
        }

        const upcomingBookings = tableBookings.filter(b => getBookingStatus(b) === 'upcoming');
        if (upcomingBookings.length > 0) {
            const totalSeatsBooked = upcomingBookings.reduce((sum, b) => sum + (b.seatNumber || 1), 0);
            return {
                status: 'upcoming',
                booking: upcomingBookings[0],
                allBookings: upcomingBookings,
                seatCount: totalSeatsBooked
            };
        }

        return { status: 'available', booking: null, seatCount: 0 };
    }

    // Get current floor for table selection
    const currentFloor = tableConfig.floors.find(f => f.name === formData.floorName);
    const tables = currentFloor ? Array.from({ length: currentFloor.tableCount }, (_, i) => {
        const num = (i + 1).toString();
        const seats = currentFloor.customSeats?.[num] || currentFloor.seats || 1;
        return { number: num, seats: seats };
    }) : [];

    return (
        <div className="table-booking">
            <header className="standard-page-header">
                <div className="standard-page-header-text">
                    <h1 className="standard-page-title"><FaCalendarAlt style={{ marginRight: '8px' }} /> Table Bookings</h1>
                    <p className="standard-page-subtitle">Manage reservations and table availability</p>
                </div>
                <div className="standard-page-header-actions">
                    <button className="create-booking-btn" onClick={openModal}>
                        <FaPlus /> Create New Booking
                    </button>

                    <div className="booking-view-toggle">
                        <button
                            className={`view-toggle-btn ${viewMode === 'visual' ? 'active' : ''}`}
                            onClick={() => {
                                setViewMode('visual');
                                setSearchQuery('');
                            }}
                        >
                            Visual Layout
                        </button>
                        <button
                            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => {
                                setViewMode('list');
                                setSearchQuery('');
                            }}
                        >
                            List View
                        </button>
                    </div>
                </div>
            </header>

            {error && <div className="booking-error-message">{error}</div>
            }

            {/* Context-Aware Filter Bar */}
            <div className="booking-filters-container">
                <div className="floor-tabs">
                    <button
                        className={`floor-tab ${selectedFloor === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedFloor('all')}
                    >
                        All Floors
                    </button>
                    {tableConfig.floors.map(floor => (
                        <button
                            key={floor.id}
                            className={`floor-tab ${selectedFloor === floor.name ? 'active' : ''}`}
                            onClick={() => setSelectedFloor(floor.name)}
                        >
                            {floor.name}
                        </button>
                    ))}
                </div>

                <div className="filter-actions-row">
                    {viewMode === 'list' ? (
                        <>
                            <div className="filter-group range-filter-group">
                                <FaCalendarAlt className="filter-icon" />
                                <select
                                    value={rangeType}
                                    onChange={(e) => setRangeType(e.target.value)}
                                    className="filter-select range-type-select"
                                >
                                    <option value="day">Day</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="year">Year</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                                {(rangeType === 'custom' || rangeType === 'day') && (
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="filter-select date-picker"
                                        title="Start Date"
                                    />
                                )}
                                {rangeType === 'custom' && (
                                    <>
                                        <span className="range-separator">to</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="filter-select date-picker"
                                            title="End Date"
                                        />
                                    </>
                                )}
                            </div>

                            <div className="filter-group">
                                <FaFilter className="filter-icon" />
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="all">All Status</option>
                                    <option value="upcoming">Upcoming</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="search-group">
                                <FaSearch className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-input"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="visual-legend-compact">
                            <div className="legend-dot available"></div> <span>Available</span>
                            <div className="legend-dot active"></div> <span>Occupied</span>
                            <div className="legend-dot upcoming"></div> <span>Reserved</span>
                        </div>
                    )}
                </div>
            </div>

            {
                loading ? (
                    <TableBookingSkeleton viewMode={viewMode} />
                ) : viewMode === 'list' ? (
                    <div className="booking-list">
                        {filteredBookings.length === 0 ? (
                            <div className="no-bookings">
                                <FaCalendarAlt />
                                <p>No bookings found</p>
                            </div>
                        ) : (
                            currentBookings.map(booking => {
                                const status = getBookingStatus(booking);
                                return (
                                    <div key={booking.id} className={`booking-card status-${status}`}>
                                        <div className="booking-card-header">
                                            <div className="booking-customer">
                                                <FaUser className="booking-icon" />
                                                <div>
                                                    <h3>{booking.customerName}</h3>
                                                    <p className="booking-phone">
                                                        <FaPhone /> {booking.customerPhone}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`booking-status-badge status-${status}`}>
                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                            </span>
                                        </div>

                                        <div className="booking-card-details">
                                            <div className="booking-detail">
                                                <FaMapMarkerAlt className="detail-icon" />
                                                <span>
                                                    {booking.floorName} - Table {booking.tableNumber}
                                                    {booking.seatNumber && `, Guests: ${booking.seatNumber}`}
                                                </span>
                                            </div>
                                            <div className="booking-detail">
                                                <FaCalendarAlt className="detail-icon" />
                                                <span>{formatDateTime(booking.bookingDate || booking.startTime)}</span>
                                            </div>
                                            <div className="booking-detail">
                                                <FaClock className="detail-icon" />
                                                <span>{booking.durationMinutes} minutes</span>
                                            </div>
                                        </div>

                                        <div className="tb-booking-card-footer">
                                            <span className="tb-booking-time-remaining">
                                                {getRemainingTime(booking)}
                                            </span>
                                            {(status === 'active' || status === 'upcoming') && (
                                                <button
                                                    className={`tb-btn-action ${status === 'active' ? 'tb-btn-action-free' : 'tb-btn-action-cancel'}`}
                                                    onClick={(e) => handleFreeTable(booking.id, e)}
                                                >
                                                    {status === 'active' ? <><FaCheckCircle /> Free</> : <><FaTimes /> Cancel</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}



                        {/* Pagination Controls */}
                        {filteredBookings.length > itemsPerPage && (
                            <div className="pagination-controls">
                                <button
                                    onClick={() => changePage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="pagination-btn"
                                >
                                    Previous
                                </button>

                                <span className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </span>

                                <button
                                    onClick={() => changePage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="pagination-btn"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="booking-visual-layout">
                        {tableConfig.floors.length === 0 ? (
                            <div className="no-floor-config">
                                <p>No floor configuration available</p>
                            </div>
                        ) : (
                            tableConfig.floors
                                .filter(floor => selectedFloor === 'all' || floor.name === selectedFloor)
                                .map(floor => {
                                    const visibleTables = Array.from({ length: floor.tableCount }, (_, i) => {
                                        const tableNumber = (i + 1).toString();
                                        const tableStatus = getTableBookingStatus(floor.name, tableNumber);

                                        // Apply status filter
                                        if (selectedStatus !== 'all' && tableStatus.status !== selectedStatus) return null;

                                        // Apply search filter (match on name or phone if present)
                                        if (searchQuery.trim() !== '') {
                                            if (!tableStatus.booking) return null; // available tables don't match search queries
                                            const query = searchQuery.toLowerCase();
                                            const nameMatch = tableStatus.booking.customerName?.toLowerCase().includes(query);
                                            const phoneMatch = tableStatus.booking.customerPhone?.includes(query);
                                            if (!nameMatch && !phoneMatch) return null;
                                        }

                                        return { tableNumber, tableStatus };
                                    }).filter(Boolean);

                                    // Avoid rendering a floor section entirely if its tables are completely filtered out
                                    if (visibleTables.length === 0) return null;

                                    return (
                                        <div key={floor.id} className="floor-section">
                                            <h3 className="floor-title">{floor.name}</h3>
                                            <div className="tables-grid">
                                                {visibleTables.map(({ tableNumber, tableStatus }) => (
                                                    <div
                                                        key={tableNumber}
                                                        className={`table-visual status-${tableStatus.status}`}
                                                        title={tableStatus.booking ?
                                                            `${tableStatus.booking.customerName} - ${getRemainingTime(tableStatus.booking)}` :
                                                            'Available'}
                                                        onClick={() => setSelectedTableAction({
                                                            floorName: floor.name,
                                                            tableNumber,
                                                            status: tableStatus.status,
                                                            bookingId: tableStatus.booking?.id,
                                                            orderId: tableStatus.booking?.orderId,
                                                            customerName: tableStatus.booking?.customerName
                                                        })}
                                                        style={{ cursor: 'pointer', position: 'relative' }}
                                                    >
                                                        <MdTableRestaurant className="table-icon" />
                                                        <div className="table-number">Table {tableNumber}</div>
                                                        {tableStatus.booking && (
                                                            <div className="table-booking-info">
                                                                <div className="table-customer">
                                                                    {tableStatus.allBookings?.length > 1 ? 'Multiple Walk-ins' : tableStatus.booking.customerName}
                                                                </div>
                                                                <div className="table-status-label" style={{
                                                                    fontSize: '0.7rem', fontWeight: 'bold',
                                                                    color: tableStatus.status === 'active' ? 'var(--color-warning-dark)' : 'var(--color-primary)',
                                                                    marginTop: '2px'
                                                                }}>
                                                                    {tableStatus.status.toUpperCase()}
                                                                </div>
                                                                <div className="table-time">
                                                                    {tableStatus.seatCount > 0 ? `${tableStatus.seatCount} Seat(s) Booked` : getRemainingTime(tableStatus.booking)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                        )}

                        {/* Redundant legend removed as it is now in the filter bar */}
                    </div>
                )
            }

            {/* Booking Modal */}
            {
                showModal && ReactDOM.createPortal(
                    <div className="modal-backdrop" onClick={closeModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2><FaCalendarAlt /> Create New Booking</h2>
                                <button className="modal-close-btn" onClick={closeModal}>
                                    <FaTimes />
                                </button>
                            </div>

                            <form onSubmit={handleCreateBooking} className="booking-form">
                                {formError && <div className="form-error-message">{formError}</div>}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Customer Name *</label>
                                        <input
                                            type="text"
                                            value={formData.customerName}
                                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                            placeholder="Enter customer name"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Customer Phone *</label>
                                        <input
                                            type="tel"
                                            value={formData.customerPhone}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                setFormData({ ...formData, customerPhone: value });
                                            }}
                                            placeholder="Enter 10-digit phone number"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Floor *</label>
                                        <select
                                            value={formData.floorName}
                                            onChange={(e) => setFormData({ ...formData, floorName: e.target.value, tableNumber: '' })}
                                            required
                                        >
                                            <option value="">Select Floor</option>
                                            {tableConfig.floors.map(floor => (
                                                <option key={floor.id} value={floor.name}>{floor.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Table *</label>
                                        <select
                                            value={formData.tableNumber}
                                            onChange={(e) => {
                                                const tableNum = e.target.value;
                                                const tableData = tables.find(t => t.number === tableNum);
                                                setFormData({ ...formData, tableNumber: tableNum });
                                                if (tableData) {
                                                    setTableAvailability(prev => ({ ...prev, maxSeats: tableData.seats }));
                                                }
                                            }}
                                            disabled={!formData.floorName}
                                            required
                                        >
                                            <option value="">Select Table</option>
                                            {tables.map(t => (
                                                <option key={t.number} value={t.number}>Table {t.number} ({t.seats} seats)</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Number of Guests *</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                value={formData.partySize}
                                                onChange={(e) => setFormData({ ...formData, partySize: parseInt(e.target.value) || 1 })}
                                                min="1"
                                                max={tableAvailability.maxSeats}
                                                disabled={!formData.tableNumber}
                                                required
                                                style={{ width: '100%' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                (Max {tableAvailability.maxSeats})
                                            </span>
                                        </div>
                                        {formData.tableNumber && formData.startTime && !tableAvailability.available && !tableAvailability.checking && (
                                            <small style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <FaTimes /> Table is unavailable for this time
                                            </small>
                                        )}
                                        {formData.tableNumber && formData.startTime && tableAvailability.available && !tableAvailability.checking && (
                                            <small style={{ color: '#059669', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <FaPlus /> Table is available!
                                            </small>
                                        )}
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Start Date & Time *</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                            required
                                        />
                                    </div>


                                    <div className="form-group">
                                        <label>Booking Duration *</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                                                <input
                                                    type="number"
                                                    value={Math.floor(formData.durationMinutes / 60)}
                                                    onChange={(e) => {
                                                        const h = parseInt(e.target.value) || 0;
                                                        const m = formData.durationMinutes % 60;
                                                        setFormData({ ...formData, durationMinutes: (h * 60) + m });
                                                    }}
                                                    min="0"
                                                    placeholder="Hrs"
                                                    style={{ width: '100%' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>h</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                                                <input
                                                    type="number"
                                                    value={formData.durationMinutes % 60}
                                                    onChange={(e) => {
                                                        const m = parseInt(e.target.value) || 0;
                                                        const h = Math.floor(formData.durationMinutes / 60);
                                                        setFormData({ ...formData, durationMinutes: (h * 60) + m });
                                                    }}
                                                    min="0"
                                                    max="59"
                                                    placeholder="Min"
                                                    style={{ width: '100%' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>m</span>
                                            </div>
                                        </div>
                                        <small style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                                            Total: {formData.durationMinutes} minutes
                                        </small>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={closeModal} disabled={submitting}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-submit" disabled={submitting}>
                                        {submitting ? 'Creating...' : 'Create Booking'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )
            }

            <Modal
                isOpen={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
            />

            {/* Table Action Menu Modal */}
            {selectedTableAction && ReactDOM.createPortal(
                <div className="tb-modal-overlay" onClick={() => { setSelectedTableAction(null); setSelectedSeats([]); }}>
                    <div className="tb-action-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="tb-action-modal-header">
                            <div className="tb-header-title-wrap">
                                <MdTableRestaurant className="tb-header-icon" />
                                <div>
                                    <h3>Table {selectedTableAction.tableNumber}</h3>
                                    <span className="tb-floor-label">{selectedTableAction.floorName} Area</span>
                                </div>
                            </div>
                            <button className="tb-modal-close" onClick={() => { setSelectedTableAction(null); setSelectedSeats([]); }}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className="tb-action-modal-body">
                            {/* Status Section */}
                            <div className="tb-status-banner">
                                <div className={`tb-status-badge-premium is-${selectedTableAction.status}`}>
                                    <span className="tb-status-dot"></span>
                                    {selectedTableAction.status.toUpperCase()}
                                </div>
                                {selectedTableAction.customerName && (
                                    <div className="tb-customer-info">
                                        <FaUser className="tb-info-icon" />
                                        <span>{selectedTableAction.customerName}</span>
                                    </div>
                                )}
                            </div>

                            {/* Seat Selection Section */}
                            <div className="tb-seat-selection-section">
                                <label className="tb-section-label">Select Seats</label>
                                <div className="tb-seats-grid-compact">
                                    {(() => {
                                        const floor = tableConfig.floors.find(f => f.name === selectedTableAction.floorName);
                                        let maxSeats = floor ? floor.seats : 0;
                                        if (floor?.customSeats?.[selectedTableAction.tableNumber]) {
                                            maxSeats = parseInt(floor.customSeats[selectedTableAction.tableNumber]);
                                        }

                                        return Array.from({ length: maxSeats }, (_, i) => i + 1).map(seatNum => {
                                            const isOccupied = allOccupiedSeats.some(s =>
                                                s.floorName === selectedTableAction.floorName &&
                                                s.tableNumber === selectedTableAction.tableNumber &&
                                                s.seatNumber === seatNum
                                            );
                                            const isSelected = selectedSeats.includes(seatNum);

                                            return (
                                                <button
                                                    key={seatNum}
                                                    className={`tb-seat-btn ${isSelected ? 'is-selected' : ''} ${isOccupied ? 'is-occupied' : ''}`}
                                                    onClick={() => {
                                                        if (isSelected) setSelectedSeats(prev => prev.filter(s => s !== seatNum));
                                                        else setSelectedSeats(prev => [...prev, seatNum]);
                                                    }}
                                                >
                                                    {seatNum}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                                {selectedSeats.length === 0 && (
                                    <p className="tb-seat-hint">Please select at least one seat to start an order</p>
                                )}
                            </div>

                            {/* Action Buttons Grid */}
                            <div className="tb-actions-container">
                                <button
                                    className="tb-action-card tb-action-primary"
                                    disabled={selectedSeats.length === 0}
                                    onClick={() => {
                                        const seatParams = selectedSeats.join(',');
                                        navigate(`?tab=orders&floorName=${encodeURIComponent(selectedTableAction.floorName)}&tableNumber=${selectedTableAction.tableNumber}&seatNumbers=${seatParams}`);
                                    }}
                                >
                                    <div className="tb-action-icon-box">
                                        <FaPlus />
                                    </div>
                                    <div className="tb-action-text">
                                        <h4>Add Order</h4>
                                        <p>Start new transaction</p>
                                    </div>
                                </button>

                                {(selectedTableAction.status === 'active' || selectedTableAction.orderId) && (
                                    <button
                                        className="tb-action-card tb-action-success"
                                        disabled={!selectedTableAction.orderId && !selectedTableAction.bookingId}
                                        onClick={() => {
                                            if (selectedTableAction.orderId) {
                                                navigate(`?tab=payments&orderId=${selectedTableAction.orderId}`);
                                            } else {
                                                navigate(`?tab=payments`);
                                            }
                                        }}
                                    >
                                        <div className="tb-action-icon-box">
                                            <span>$</span>
                                        </div>
                                        <div className="tb-action-text">
                                            <h4>Payment</h4>
                                            <p>Generate bill/receipt</p>
                                        </div>
                                    </button>
                                )}

                                {(selectedTableAction.status === 'active' || selectedTableAction.status === 'upcoming') && (
                                    <button
                                        className="tb-action-card tb-action-danger"
                                        onClick={(e) => {
                                            handleFreeTable(selectedTableAction.bookingId, e);
                                            setSelectedTableAction(null);
                                        }}
                                    >
                                        <div className="tb-action-icon-box">
                                            {selectedTableAction.status === 'active' ? <FaCheckCircle /> : <FaTimes />}
                                        </div>
                                        <div className="tb-action-text">
                                            <h4>{selectedTableAction.status === 'active' ? 'Free Table' : 'Cancel Booking'}</h4>
                                            <p>End current session</p>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
}
