import { useEffect, useState, useRef } from 'react';
import {
    MapContainer, TileLayer,
    Marker, Popup, Polyline, useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    FiRefreshCw,
    FiMapPin,
    FiAlertTriangle,
    FiCheck,
    FiX,
    FiNavigation,
    FiTruck,
} from 'react-icons/fi';
import AdminSidebar from '../components/AdminSidebar';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const busIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38], iconAnchor: [19, 38],
    popupAnchor: [0, -38],
});

const emergencyIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
    iconSize: [42, 42], iconAnchor: [21, 42],
    popupAnchor: [0, -42],
});

const landmarkIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [32, 32], iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

const MAP_CENTER  = [13.8557, 121.1107];
const MAP_ZOOM    = 12;
const SM_LIPA     = { name: 'SM Lipa',
    lat: 13.954781, lng: 121.163096 };
const SM_BATANGAS = { name: 'SM Batangas',
    lat: 13.7567,   lng: 121.0584  };

// ✅ Flies to alert location when target changes
const MapFlyTo = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (target?.latitude && target?.longitude) {
            map.flyTo(
                [target.latitude, target.longitude],
                16,
                { animate: true, duration: 1.5 }
            );
        }
    }, [target, map]);
    return null;
};

const EmergencyMapPage = () => {
    const [buses, setBuses]               = useState([]);
    const [alerts, setAlerts]             = useState([]);
    const [prevAlertIds, setPrevAlertIds] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [lastUpdated, setLastUpdated]   = useState(null);
    const [error, setError]               = useState(null);
    const [flyTarget, setFlyTarget]       = useState(null);
    const [resolving, setResolving]       = useState(null);
    const intervalRef                     = useRef(null);

    // ==================== FETCH ====================

    const fetchBuses = async () => {
        try {
            const res = await fetch(
                'http://localhost:8080/api/driver/buses');
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const response = await res.json();
            setBuses(response.data || []);
            setLastUpdated(
                new Date().toLocaleTimeString());
            setError(null);
        } catch (err) {
            setError('Cannot fetch buses — ' +
                'is Spring Boot running?');
        } finally {
            setLoading(false);
        }
    };

    const fetchAlerts = async () => {
        try {
            const res = await fetch(
                'http://localhost:8080/api/driver/bus-alerts');
            if (!res.ok) return;
            const response = await res.json();
            const newAlerts = response.data || [];

            // ✅ Detect brand new alert
            const newAlert = newAlerts.find(
                a => !prevAlertIds.includes(a.id)
                  && a.latitude
                  && a.longitude
            );

            if (newAlert) {
                setFlyTarget(newAlert);
            }

            setPrevAlertIds(newAlerts.map(a => a.id));
            setAlerts(newAlerts);

        } catch (err) {
            console.error('Alerts fetch error:', err);
        }
    };

    useEffect(() => {
        fetchBuses();
        fetchAlerts();
        intervalRef.current = setInterval(() => {
            fetchBuses();
            fetchAlerts();
        }, 5000);
        return () =>
            clearInterval(intervalRef.current);
    }, []);

    // ==================== RESOLVE ====================

    // ✅ Called when admin clicks "Resolve" on an alert
    const resolveAlert = async (alertId) => {
        setResolving(alertId);
        try {
            const res = await fetch(
                `http://localhost:8080/api/driver/emergency/${alertId}/resolve`,
                { method: 'PUT' }
            );

            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);

            // ✅ Remove from local state immediately
            setAlerts(prev =>
                prev.filter(a => a.id !== alertId));

            // ✅ Clear fly target if it was this alert
            if (flyTarget?.id === alertId) {
                setFlyTarget(null);
            }

            console.log('✅ Alert resolved:', alertId);

        } catch (err) {
            console.error('❌ Resolve failed:', err);
            alert('Failed to resolve alert. Try again.');
        } finally {
            setResolving(null);
        }
    };

    // ==================== POPUPS ====================

    const renderBusPopup = (bus) => (
        <div style={{ minWidth: 180 }}>
            <strong style={{ color: 'var(--brand-maroon)' }}>
                🚌 {bus.plateNumber}
            </strong><br />
            <span style={{ fontSize: 13, color: '#666' }}>
                Route: {bus.route}
            </span><br />
            <span style={{
                fontSize: 13, fontWeight: 600,
                color: bus.status === 'ACTIVE'
                    ? 'var(--brand-green)' : 'var(--danger-muted)',
            }}>
                ● {bus.status}
            </span><br />
            <span style={{ fontSize: 12, color: '#999' }}>
                Capacity: {bus.totalCapacity}
            </span><br />
            <span style={{ fontSize: 11, color: '#888' }}>
                📍 {bus.latitude?.toFixed(4)},
                {' '}{bus.longitude?.toFixed(4)}
            </span>
        </div>
    );

    const renderAlertPopup = (alert) => (
        <div style={{ minWidth: 210 }}>
            <strong style={{
                color: 'var(--danger-muted-dark)', fontSize: 14,
            }}>
                🚨 EMERGENCY ALERT
            </strong><br />
            <span style={{ fontSize: 13 }}>
                {alert.description || alert.message}
            </span><br />
            <span style={{ fontSize: 12, color: '#666' }}>
                🚌 {alert.plateNumber}
            </span><br />
            <span style={{ fontSize: 12, color: '#666' }}>
                👤 {alert.driverName}
            </span><br />
            <span style={{ fontSize: 11, color: '#999' }}>
                📍 {alert.latitude?.toFixed(4)},
                {' '}{alert.longitude?.toFixed(4)}
            </span><br />
            <span style={{ fontSize: 11, color: '#999' }}>
                🕐 {new Date(alert.reportedAt)
                    .toLocaleString()}
            </span>
            <br />
            {/* ✅ Resolve button inside popup */}
            <button
                onClick={() => resolveAlert(alert.id)}
                disabled={resolving === alert.id}
                className="btn-resolve"
                style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
            >
                <FiCheck />
                {resolving === alert.id
                    ? 'Resolving...'
                    : 'Mark as Resolved'}
            </button>
        </div>
    );

    const routeCoordinates = buses
        .filter(b => b.latitude && b.longitude)
        .map(b => [b.latitude, b.longitude]);

    // ==================== RENDER ====================

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">Operations</span>
                        <h1>Emergency Alerts Map</h1>
                        {lastUpdated && (
                            <p style={{
                                margin: '0.25rem 0 0',
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                            }}>
                                Last updated: {lastUpdated}
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        {flyTarget && (
                            <button
                                type="button"
                                onClick={() => setFlyTarget(null)}
                                className="admin-action"
                            >
                                <FiMapPin />
                                Reset View
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                fetchBuses();
                                fetchAlerts();
                            }}
                            className="admin-action refresh"
                        >
                            <FiRefreshCw />
                            Refresh
                        </button>
                    </div>
                </header>

                {/* Error banner */}
                {error && (
                    <div className="error-banner">
                        ⚠️ {error}
                    </div>
                )}

                {/* ✅ Active alert banner with resolve btn */}
                {flyTarget && (
                    <div className="alert-banner">
                        <div className="left">
                            <FiAlertTriangle className="icon" />
                            <div>
                                <div className="title">
                                    EMERGENCY — {flyTarget.plateNumber}
                                </div>
                                <div className="sub">
                                    {flyTarget.description || flyTarget.message}
                                    {' '}— Driver: {flyTarget.driverName}
                                </div>
                            </div>
                        </div>
                        <div className="actions">
                            {/* ✅ Resolve from banner */}
                            <button
                                type="button"
                                onClick={() => resolveAlert(flyTarget.id)}
                                disabled={resolving === flyTarget.id}
                                className="btn-resolve"
                            >
                                <FiCheck />
                                {resolving === flyTarget.id ? 'Resolving...' : 'Resolve'}
                            </button>
                            {/* Dismiss banner only */}
                            <button
                                type="button"
                                onClick={() => setFlyTarget(null)}
                                className="btn-dismiss"
                                aria-label="Dismiss"
                            >
                                <FiX />
                            </button>
                        </div>
                    </div>
                )}

                {/* Landmarks bar */}
                <div className="landmarks-bar">
                    {[SM_LIPA, SM_BATANGAS].map(place => (
                        <div key={place.name} className="landmark-card">
                            <FiMapPin style={{ color: 'var(--brand-maroon)', fontSize: '1.2rem' }} />
                            <div className="name">{place.name}</div>
                        </div>
                    ))}
                </div>

                {/* Map card */}
                <div className="map-card">
                    {/* Title bar */}
                    <div className="map-title-bar">
                        <h3>Real-time Tracking — SM Lipa ↔ SM Batangas</h3>
                        <span className={`map-status-pill ${loading ? 'warning' : ''}`}>
                            {loading
                                ? 'Loading...'
                                : `${buses.length} buses online`}
                        </span>
                    </div>

                    {/* Leaflet Map */}
                    <MapContainer
                        center={MAP_CENTER}
                        zoom={MAP_ZOOM}
                        style={{
                            height: 500, borderRadius: 8,
                        }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* ✅ Auto fly to new alert */}
                        <MapFlyTo target={flyTarget} />

                        {/* SM Lipa marker */}
                        <Marker
                            position={[
                                SM_LIPA.lat,
                                SM_LIPA.lng,
                            ]}
                            icon={landmarkIcon}
                        >
                            <Popup>
                                <strong style={{ color: 'var(--brand-maroon)' }}>
                                    📍 SM Lipa
                                </strong><br />
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {SM_LIPA.lat}, {SM_LIPA.lng}
                                </span>
                            </Popup>
                        </Marker>

                        {/* SM Batangas marker */}
                        <Marker
                            position={[
                                SM_BATANGAS.lat,
                                SM_BATANGAS.lng,
                            ]}
                            icon={landmarkIcon}
                        >
                            <Popup>
                                <strong style={{ color: 'var(--brand-maroon)' }}>
                                    📍 SM Batangas
                                </strong><br />
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {SM_BATANGAS.lat}, {SM_BATANGAS.lng}
                                </span>
                            </Popup>
                        </Marker>

                        {/* Route line */}
                        <Polyline
                            positions={[
                                [SM_LIPA.lat, SM_LIPA.lng],
                                [SM_BATANGAS.lat, SM_BATANGAS.lng],
                            ]}
                            color="#6f2f3c"
                            weight={3}
                            opacity={0.5}
                            dashArray="8, 8"
                        />

                        {/* Bus markers */}
                        {buses.map((bus, i) =>
                            bus.latitude && bus.longitude
                                ? (
                                    <Marker
                                        key={`bus-${bus.plateNumber || i}`}
                                        position={[
                                            bus.latitude,
                                            bus.longitude,
                                        ]}
                                        icon={busIcon}
                                    >
                                        <Popup>
                                            {renderBusPopup(bus)}
                                        </Popup>
                                    </Marker>
                                ) : null
                        )}

                        {/* ✅ Emergency markers */}
                        {alerts.map(alert =>
                            alert.latitude && alert.longitude ? (
                                <Marker
                                    key={`alert-${alert.id}`}
                                    position={[
                                        alert.latitude,
                                        alert.longitude,
                                    ]}
                                    icon={emergencyIcon}
                                >
                                    <Popup>
                                        {renderAlertPopup(alert)}
                                    </Popup>
                                </Marker>
                            ) : null
                        )}

                        {/* Live bus polyline */}
                        {routeCoordinates.length > 1 && (
                            <Polyline
                                positions={routeCoordinates}
                                color="#b24a52"
                                weight={3}
                                opacity={0.7}
                            />
                        )}
                    </MapContainer>

                    {/* ✅ Active alerts list below map */}
                    {alerts.length > 0 && (
                        <div className="alert-list-section">
                            <div className="alert-list-heading">
                                <FiAlertTriangle />
                                Active Alerts ({alerts.length})
                            </div>
                            <div>
                                {alerts.map(alert => (
                                    <div key={alert.id} className="alert-row">
                                        <div>
                                            <div className="alert-title">
                                                🚌 {alert.plateNumber} — {alert.driverName}
                                            </div>
                                            <div className="alert-sub">
                                                {alert.description || alert.message}
                                            </div>
                                        </div>
                                        <div className="actions">
                                            {/* ✅ Fly to */}
                                            <button
                                                type="button"
                                                onClick={() => setFlyTarget(alert)}
                                                className="btn-locate"
                                            >
                                                <FiNavigation />
                                                Locate
                                            </button>
                                            {/* ✅ Resolve */}
                                            <button
                                                type="button"
                                                onClick={() => resolveAlert(alert.id)}
                                                disabled={resolving === alert.id}
                                                className="btn-resolve"
                                            >
                                                <FiCheck />
                                                {resolving === alert.id
                                                    ? '...'
                                                    : 'Resolve'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="map-stats">
                        {[
                            {
                                Icon: FiTruck,
                                label: 'Active Buses',
                                count: buses.filter(b => b.status === 'ACTIVE').length,
                                alert: false,
                            },
                            {
                                Icon: FiAlertTriangle,
                                label: 'Active Alerts',
                                count: alerts.length,
                                alert: alerts.length > 0,
                            },
                        ].map((item, i) => (
                            <div key={i} className={`map-stat ${item.alert ? 'alert' : ''}`}>
                                <item.Icon className="icon" />
                                <div>
                                    <div className="num">{item.count}</div>
                                    <div className="label-sm">{item.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default EmergencyMapPage;
