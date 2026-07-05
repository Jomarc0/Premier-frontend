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
    FiNavigation,
    FiTruck,
} from 'react-icons/fi';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';
import adminAPI from '../api/adminAxios';

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

const landmarkIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [32, 32], iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

const MAP_CENTER  = [13.8557, 121.1107];
const MAP_ZOOM    = 12;
const SM_LIPA     = { name: 'SM Lipa',     lat: 13.954781, lng: 121.163096 };
const GRAND_TERMINAL = { name: 'Grand Terminal', lat: 13.790391, lng: 121.062721 };

const getBusList = (payload) => {
    const data = payload?.data ?? payload;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.content)) return data.content;
    if (Array.isArray(data?.buses)) return data.buses;
    if (Array.isArray(data?.vehicles)) return data.vehicles;

    return [];
};

const getHistoryList = (payload) => {
    const data = payload?.data ?? payload;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.content)) return data.content;
    if (Array.isArray(data?.history)) return data.history;

    return [];
};

const HISTORY_RANGES = [
    { value: 'hour', label: 'Last hour' },
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'This week' },
];

const hasCoordinates = (item) => item?.latitude != null && item?.longitude != null;

const formatCoordinate = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(5) : 'N/A';
};

const formatDateTime = (value) => {
    if (!value) return 'No GPS record yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString();
};

const MapFlyTo = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (target?.latitude && target?.longitude) {
            map.flyTo([target.latitude, target.longitude], 16, { animate: true, duration: 1.5 });
        }
    }, [target, map]);
    return null;
};

const VehicleMonitoringPage = () => {
    const [buses, setBuses]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [lastUpdated, setLastUpdated]   = useState(null);
    const [error, setError]               = useState(null);
    const [flyTarget, setFlyTarget]       = useState(null);
    const [selectedHistoryBus, setSelectedHistoryBus] = useState(null);
    const [historyRange, setHistoryRange] = useState('day');
    const [historyPoints, setHistoryPoints] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState(null);
    const intervalRef                     = useRef(null);

    const fetchBuses = async () => {
        try {
            const response = await adminAPI.get(
                `${import.meta.env.VITE_API_URL}/api/driver/buses`
            );
            setBuses(getBusList(response.data));
            setLastUpdated(new Date().toLocaleTimeString());
            setError(null);
        } catch (err) {
            setError('Cannot fetch buses - is Spring Boot running?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBuses();
        intervalRef.current = setInterval(() => {
            fetchBuses();
        }, 5000);
        return () => clearInterval(intervalRef.current);
    }, []);

    const fetchHistory = async (bus = selectedHistoryBus, range = historyRange) => {
        if (!bus?.plateNumber) return;

        try {
            setHistoryLoading(true);
            setHistoryError(null);
            const response = await adminAPI.get(
                `${import.meta.env.VITE_API_URL}/api/driver/location-history/${encodeURIComponent(bus.plateNumber)}?range=${range}`
            );
            setHistoryPoints(getHistoryList(response.data).filter(hasCoordinates));
        } catch (err) {
            setHistoryPoints([]);
            setHistoryError('Cannot load location history for this bus.');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (selectedHistoryBus?.plateNumber) {
            fetchHistory(selectedHistoryBus, historyRange);
        }
    }, [selectedHistoryBus?.plateNumber, historyRange]);

    const showHistory = (bus) => {
        setSelectedHistoryBus(bus);
        if (hasCoordinates(bus)) {
            setFlyTarget(bus);
        }
    };

    const historyPath = historyPoints.map(point => [point.latitude, point.longitude]);

    const renderBusPopup = (bus) => (
        <div style={{ minWidth: 180 }}>
            <strong style={{ color: 'var(--brand-maroon)' }}>
                Bus {bus.plateNumber}
            </strong><br />
            <span style={{ fontSize: 13, color: '#666' }}>
                Route: {bus.route}
            </span><br />
            <span style={{
                fontSize: 13, fontWeight: 600,
                color: bus.status === 'ACTIVE'
                    ? 'var(--brand-green)' : 'var(--danger-muted)',
            }}>
                Status: {bus.status}
            </span><br />
            <span style={{ fontSize: 12, color: '#999' }}>
                Capacity: {bus.totalCapacity}
            </span><br />
            <span style={{ fontSize: 11, color: '#888' }}>
                Location: {formatCoordinate(bus.latitude)}, {formatCoordinate(bus.longitude)}
            </span><br />
            <span style={{ fontSize: 11, color: '#888' }}>
                Last seen: {formatDateTime(bus.lastUpdated)}
            </span>
        </div>
    );

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Operations</span>
                        <h1 className={ui.headerTitle}>Bus / Vehicle Monitoring</h1>
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
                            onClick={() => fetchBuses()}
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
                        {error}
                    </div>
                )}

                {/* Landmarks bar */}
                <div className="flex gap-[0.85rem] mb-5 max-[860px]:flex-col">
                    {[SM_LIPA, GRAND_TERMINAL].map(place => (
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
                            Real-time Tracking - SM Lipa to Grand Terminal
                        </h3>
                        <span
                            className={[
                                'px-[0.7rem] py-1 rounded-full text-[0.72rem] font-black',
                                loading ? 'bg-[#f59e0b] text-white' : 'bg-gold text-maroon',
                            ].join(' ')}
                        >
                            {loading ? 'Loading...' : `${buses.filter(b => b.online || b.locationFresh).length} buses online`}
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

                        {/* SM Lipa landmark marker */}
                        <Marker position={[SM_LIPA.lat, SM_LIPA.lng]} icon={landmarkIcon}>
                            <Popup>
                                <strong style={{ color: 'var(--brand-maroon)' }}>
                                    SM Lipa
                                </strong><br />
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {SM_LIPA.lat}, {SM_LIPA.lng}
                                </span>
                            </Popup>
                        </Marker>

                        {/* Grand Terminal landmark marker */}
                        <Marker position={[GRAND_TERMINAL.lat, GRAND_TERMINAL.lng]} icon={landmarkIcon}>
                            <Popup>
                                <strong style={{ color: 'var(--brand-maroon)' }}>
                                    Grand Terminal
                                </strong><br />
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {GRAND_TERMINAL.lat}, {GRAND_TERMINAL.lng}
                                </span>
                            </Popup>
                        </Marker>

                        {/* Bus markers - shows latest saved GPS point even if bus is offline */}
                        {buses.map((bus, i) =>
                            hasCoordinates(bus)
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

                        {historyPath.length > 1 && (
                            <Polyline
                                positions={historyPath}
                                pathOptions={{
                                    color: '#6b1f2a',
                                    weight: 5,
                                    opacity: 0.8,
                                }}
                            />
                        )}
                    </MapContainer>

                    {selectedHistoryBus && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-page-bg px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="text-[0.92rem] font-black text-maroon">
                                        Route History - Bus {selectedHistoryBus.plateNumber}
                                    </div>
                                    <div className="text-[0.78rem] text-text-muted">
                                        {historyLoading
                                            ? 'Loading saved GPS points...'
                                            : `${historyPoints.length} saved GPS point${historyPoints.length === 1 ? '' : 's'} shown`}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={historyRange}
                                        onChange={(event) => setHistoryRange(event.target.value)}
                                        className="min-h-[2.35rem] rounded-md border border-slate-300 bg-white px-3 text-[0.8rem] font-bold text-text-main"
                                    >
                                        {HISTORY_RANGES.map(range => (
                                            <option key={range.value} value={range.value}>
                                                {range.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => fetchHistory()}
                                        className={ui.adminActionRefresh}
                                    >
                                        <FiRefreshCw />
                                        History
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedHistoryBus(null);
                                            setHistoryPoints([]);
                                            setHistoryError(null);
                                        }}
                                        className={ui.adminAction}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            {historyError && (
                                <div className="mt-3 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] font-bold text-danger-muted-dark">
                                    {historyError}
                                </div>
                            )}
                            {!historyLoading && !historyError && historyPoints.length === 0 && (
                                <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[0.78rem] text-text-muted">
                                    No saved GPS history for this bus in the selected range.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vehicle list */}
                    {buses.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[0.92rem] font-black text-maroon mb-[0.6rem] inline-flex items-center gap-[0.4rem]">
                                <FiTruck />
                                Monitored Vehicles ({buses.length})
                            </div>
                            <div>
                                {buses.map((bus, i) => (
                                    <div
                                        key={bus.plateNumber || i}
                                        className="bg-page-bg border border-slate-200 border-l-4 border-l-maroon rounded-lg px-4 py-3 mb-2 flex justify-between items-center gap-[0.8rem] max-[860px]:flex-col max-[860px]:items-start"
                                    >
                                        <div>
                                            <div className="font-black text-maroon text-[0.85rem]">
                                                Bus {bus.plateNumber}
                                            </div>
                                            <div className="text-[0.78rem] text-text-main mt-[0.15rem]">
                                                {bus.route || 'No route set'} - {bus.status || 'UNKNOWN'}
                                            </div>
                                            <div className="text-[0.72rem] text-text-muted mt-1">
                                                Last position: {formatCoordinate(bus.latitude)}, {formatCoordinate(bus.longitude)}
                                            </div>
                                            <div className="text-[0.72rem] text-text-muted">
                                                Last seen: {formatDateTime(bus.lastUpdated)}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-[0.4rem]">
                                            <button
                                                type="button"
                                                onClick={() => setFlyTarget(bus)}
                                                disabled={!hasCoordinates(bus)}
                                                className="inline-flex items-center gap-[0.35rem] px-[0.85rem] min-h-[2.2rem] rounded-md bg-maroon text-white font-black text-[0.78rem] cursor-pointer hover:bg-maroon-dark"
                                            >
                                                <FiNavigation />
                                                Locate
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => showHistory(bus)}
                                                disabled={!hasCoordinates(bus)}
                                                className="inline-flex items-center gap-[0.35rem] px-[0.85rem] min-h-[2.2rem] rounded-md bg-white border border-maroon text-maroon font-black text-[0.78rem] cursor-pointer hover:bg-[#f8eef0] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FiMapPin />
                                                Show History
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
                            { Icon: FiTruck, label: 'Active Buses', count: buses.filter(b => b.status === 'ACTIVE').length },
                            { Icon: FiTruck, label: 'Total Vehicles', count: buses.length },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-lg px-4 py-[0.85rem] flex items-center gap-3 border-[1.5px] bg-page-bg border-transparent"
                            >
                                <item.Icon className="text-[1.4rem]" />
                                <div>
                                    <div className="text-[1.3rem] font-black text-maroon">
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

export default VehicleMonitoringPage;

