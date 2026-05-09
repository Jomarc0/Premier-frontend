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
import * as ui from '../components/adminUI';

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
const SM_LIPA     = { name: 'SM Lipa',     lat: 13.954781, lng: 121.163096 };
const SM_BATANGAS = { name: 'SM Batangas', lat: 13.7567,   lng: 121.0584   };

const MapFlyTo = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (target?.latitude && target?.longitude) {
            map.flyTo([target.latitude, target.longitude], 16, { animate: true, duration: 1.5 });
        }
    }, [target, map]);
    return null;
};

const btnResolveCls =
    'inline-flex items-center gap-[0.35rem] px-[0.95rem] min-h-[2.2rem] rounded-md bg-green-brand text-white font-black text-[0.78rem] cursor-pointer enabled:hover:bg-[#245a30] disabled:bg-[#9ca3af] disabled:cursor-not-allowed';

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

    const fetchBuses = async () => {
        try {
            const res = await fetch('http://localhost:8080/api/driver/buses');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const response = await res.json();
            setBuses(response.data || []);
            setLastUpdated(new Date().toLocaleTimeString());
            setError(null);
        } catch (err) {
            setError('Cannot fetch buses — is Spring Boot running?');
        } finally {
            setLoading(false);
        }
    };

    const fetchAlerts = async () => {
        try {
            const res = await fetch('http://localhost:8080/api/driver/bus-alerts');
            if (!res.ok) return;
            const response = await res.json();
            const newAlerts = response.data || [];

            const newAlert = newAlerts.find(
                a => !prevAlertIds.includes(a.id) && a.latitude && a.longitude
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
        return () => clearInterval(intervalRef.current);
    }, []);

    const resolveAlert = async (alertId) => {
        setResolving(alertId);
        try {
            const res = await fetch(
                `http://localhost:8080/api/driver/emergency/${alertId}/resolve`,
                { method: 'PUT' }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            setAlerts(prev => prev.filter(a => a.id !== alertId));

            if (flyTarget?.id === alertId) {
                setFlyTarget(null);
            }

            console.log('Alert resolved:', alertId);

        } catch (err) {
            console.error('Resolve failed:', err);
            alert('Failed to resolve alert. Try again.');
        } finally {
            setResolving(null);
        }
    };

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
                📍 {bus.latitude?.toFixed(4)}, {bus.longitude?.toFixed(4)}
            </span>
        </div>
    );

    const renderAlertPopup = (alert) => (
        <div style={{ minWidth: 210 }}>
            <strong style={{ color: 'var(--danger-muted-dark)', fontSize: 14 }}>
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
                📍 {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
            </span><br />
            <span style={{ fontSize: 11, color: '#999' }}>
                🕐 {new Date(alert.reportedAt).toLocaleString()}
            </span>
            <br />
            <button
                onClick={() => resolveAlert(alert.id)}
                disabled={resolving === alert.id}
                className={`${btnResolveCls} mt-2.5 w-full justify-center`}
            >
                <FiCheck />
                {resolving === alert.id ? 'Resolving...' : 'Mark as Resolved'}
            </button>
        </div>
    );

    const routeCoordinates = buses
        .filter(b => b.latitude && b.longitude)
        .map(b => [b.latitude, b.longitude]);

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Operations</span>
                        <h1 className={ui.headerTitle}>Emergency Alerts Map</h1>
                        {lastUpdated && (
                            <p className="mt-1 mb-0 text-[0.78rem] text-text-muted">
                                Last updated: {lastUpdated}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-[0.6rem]">
                        {flyTarget && (
                            <button
                                type="button"
                                onClick={() => setFlyTarget(null)}
                                className={ui.adminAction}
                            >
                                <FiMapPin />
                                Reset View
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { fetchBuses(); fetchAlerts(); }}
                            className={ui.adminActionRefresh}
                        >
                            <FiRefreshCw />
                            Refresh
                        </button>
                    </div>
                </header>

                {/* Error banner */}
                {error && (
                    <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-lg px-4 py-3 mb-4 text-danger-muted-dark font-extrabold text-[0.88rem]">
                        ⚠️ {error}
                    </div>
                )}

                {/* Active alert banner with resolve btn */}
                {flyTarget && (
                    <div className="bg-[#fdecee] border-2 border-danger-muted rounded-[10px] px-[1.15rem] py-[0.95rem] mb-[1.1rem] flex items-center justify-between gap-4 max-[860px]:flex-col max-[860px]:items-start">
                        <div className="flex items-center gap-[0.8rem]">
                            <FiAlertTriangle className="text-[1.6rem] text-danger-muted" />
                            <div>
                                <div className="font-black text-danger-muted-dark text-[0.95rem]">
                                    EMERGENCY — {flyTarget.plateNumber}
                                </div>
                                <div className="text-[0.82rem] text-text-main mt-[0.15rem]">
                                    {flyTarget.description || flyTarget.message}
                                    {' '}— Driver: {flyTarget.driverName}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={() => resolveAlert(flyTarget.id)}
                                disabled={resolving === flyTarget.id}
                                className={btnResolveCls}
                            >
                                <FiCheck />
                                {resolving === flyTarget.id ? 'Resolving...' : 'Resolve'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlyTarget(null)}
                                className="bg-transparent border-none text-[1.15rem] cursor-pointer text-danger-muted px-[0.4rem] py-[0.2rem]"
                                aria-label="Dismiss"
                            >
                                <FiX />
                            </button>
                        </div>
                    </div>
                )}

                {/* Landmarks bar */}
                <div className="flex gap-[0.85rem] mb-5 max-[860px]:flex-col">
                    {[SM_LIPA, SM_BATANGAS].map(place => (
                        <div
                            key={place.name}
                            className="flex-1 bg-white rounded-lg px-4 py-[0.8rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)] flex items-center gap-[0.7rem] border-l-4 border-maroon"
                        >
                            <FiMapPin className="text-maroon text-[1.2rem]" />
                            <div className="font-black text-maroon text-[0.92rem]">{place.name}</div>
                        </div>
                    ))}
                </div>

                {/* Map card */}
                <div className="bg-white rounded-lg p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                    {/* Title bar */}
                    <div className="bg-maroon rounded-lg px-[1.1rem] py-[0.85rem] mb-[1.1rem] flex items-center justify-between">
                        <h3 className="m-0 text-white text-[0.95rem] font-black">
                            Real-time Tracking — SM Lipa ↔ SM Batangas
                        </h3>
                        <span
                            className={[
                                'px-[0.7rem] py-1 rounded-full text-[0.72rem] font-black',
                                loading ? 'bg-[#f59e0b] text-white' : 'bg-gold text-maroon',
                            ].join(' ')}
                        >
                            {loading ? 'Loading...' : `${buses.length} buses online`}
                        </span>
                    </div>

                    {/* Leaflet Map */}
                    <MapContainer
                        center={MAP_CENTER}
                        zoom={MAP_ZOOM}
                        style={{ height: 500, borderRadius: 8 }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <MapFlyTo target={flyTarget} />

                        <Marker position={[SM_LIPA.lat, SM_LIPA.lng]} icon={landmarkIcon}>
                            <Popup>
                                <strong style={{ color: 'var(--brand-maroon)' }}>
                                    📍 SM Lipa
                                </strong><br />
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {SM_LIPA.lat}, {SM_LIPA.lng}
                                </span>
                            </Popup>
                        </Marker>

                        <Marker position={[SM_BATANGAS.lat, SM_BATANGAS.lng]} icon={landmarkIcon}>
                            <Popup>
                                <strong style={{ color: 'var(--brand-maroon)' }}>
                                    📍 SM Batangas
                                </strong><br />
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {SM_BATANGAS.lat}, {SM_BATANGAS.lng}
                                </span>
                            </Popup>
                        </Marker>

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

                        {buses.map((bus, i) =>
                            bus.latitude && bus.longitude
                                ? (
                                    <Marker
                                        key={`bus-${bus.plateNumber || i}`}
                                        position={[bus.latitude, bus.longitude]}
                                        icon={busIcon}
                                    >
                                        <Popup>{renderBusPopup(bus)}</Popup>
                                    </Marker>
                                ) : null
                        )}

                        {alerts.map(alert =>
                            alert.latitude && alert.longitude ? (
                                <Marker
                                    key={`alert-${alert.id}`}
                                    position={[alert.latitude, alert.longitude]}
                                    icon={emergencyIcon}
                                >
                                    <Popup>{renderAlertPopup(alert)}</Popup>
                                </Marker>
                            ) : null
                        )}

                        {routeCoordinates.length > 1 && (
                            <Polyline
                                positions={routeCoordinates}
                                color="#b24a52"
                                weight={3}
                                opacity={0.7}
                            />
                        )}
                    </MapContainer>

                    {/* Active alerts list */}
                    {alerts.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[0.92rem] font-black text-danger-muted-dark mb-[0.6rem] inline-flex items-center gap-[0.4rem]">
                                <FiAlertTriangle />
                                Active Alerts ({alerts.length})
                            </div>
                            <div>
                                {alerts.map(alert => (
                                    <div
                                        key={alert.id}
                                        className="bg-[#fdecee] border border-[#fca5a5] border-l-4 border-l-danger-muted rounded-lg px-4 py-3 mb-2 flex justify-between items-center gap-[0.8rem] max-[860px]:flex-col max-[860px]:items-start"
                                    >
                                        <div>
                                            <div className="font-black text-danger-muted-dark text-[0.85rem]">
                                                🚌 {alert.plateNumber} — {alert.driverName}
                                            </div>
                                            <div className="text-[0.78rem] text-text-main mt-[0.15rem]">
                                                {alert.description || alert.message}
                                            </div>
                                        </div>
                                        <div className="flex gap-[0.4rem]">
                                            <button
                                                type="button"
                                                onClick={() => setFlyTarget(alert)}
                                                className="inline-flex items-center gap-[0.35rem] px-[0.85rem] min-h-[2.2rem] rounded-md bg-maroon text-white font-black text-[0.78rem] cursor-pointer hover:bg-maroon-dark"
                                            >
                                                <FiNavigation />
                                                Locate
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => resolveAlert(alert.id)}
                                                disabled={resolving === alert.id}
                                                className={btnResolveCls}
                                            >
                                                <FiCheck />
                                                {resolving === alert.id ? '...' : 'Resolve'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex gap-4 mt-4 max-[860px]:flex-col">
                        {[
                            { Icon: FiTruck,         label: 'Active Buses',  count: buses.filter(b => b.status === 'ACTIVE').length, alert: false },
                            { Icon: FiAlertTriangle, label: 'Active Alerts', count: alerts.length,                                   alert: alerts.length > 0 },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className={[
                                    'flex-1 rounded-lg px-4 py-[0.85rem] flex items-center gap-3 border-[1.5px]',
                                    item.alert
                                        ? 'bg-[#fdecee] border-[#fca5a5]'
                                        : 'bg-page-bg border-transparent',
                                ].join(' ')}
                            >
                                <item.Icon className="text-[1.4rem]" />
                                <div>
                                    <div className={[
                                        'text-[1.3rem] font-black',
                                        item.alert ? 'text-danger-muted-dark' : 'text-maroon',
                                    ].join(' ')}>
                                        {item.count}
                                    </div>
                                    <div className="text-[0.76rem] text-text-muted">{item.label}</div>
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
