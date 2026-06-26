import { useEffect, useState, useRef } from 'react';
import {
    MapContainer, TileLayer,
    Marker, Popup, useMap
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
    const intervalRef                     = useRef(null);

    const fetchBuses = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/driver/buses`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const response = await res.json();
            setBuses(response.data || []);
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
                Location: {bus.latitude?.toFixed(4)}, {bus.longitude?.toFixed(4)}
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
                            {loading ? 'Loading...' : `${buses.filter(b => b.status === 'ACTIVE').length} buses online`}
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

                        {/* Bus markers - only ACTIVE buses shown on map */}
                        {buses.map((bus, i) =>
                            bus.latitude && bus.longitude && bus.status === 'ACTIVE'
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
                    </MapContainer>

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
                                        </div>
                                        <div className="flex gap-[0.4rem]">
                                            <button
                                                type="button"
                                                onClick={() => setFlyTarget(bus)}
                                                disabled={!bus.latitude || !bus.longitude}
                                                className="inline-flex items-center gap-[0.35rem] px-[0.85rem] min-h-[2.2rem] rounded-md bg-maroon text-white font-black text-[0.78rem] cursor-pointer hover:bg-maroon-dark"
                                            >
                                                <FiNavigation />
                                                Locate
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

