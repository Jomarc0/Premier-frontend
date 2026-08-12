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
import { useRealtime } from '../context/RealtimeContext';
import { formatDateTime, formatTime } from '../lib/time';

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
    const [busSearch, setBusSearch]       = useState('');
    const [busStatusFilter, setBusStatusFilter] = useState('ALL');
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
    const { subscribe } = useRealtime();

    const fetchBuses = async () => {
        try {
            const response = await adminAPI.get('/vehicle-monitoring/buses');
            setBuses(getBusList(response.data));
            setLastUpdated(formatTime(new Date()));
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to load vehicle monitoring data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBuses();
        intervalRef.current = setInterval(() => {
            fetchBuses();
        }, 30000);
        return () => clearInterval(intervalRef.current);
    }, []);

    useEffect(() => subscribe((event) => {
        if (event.entity === 'VEHICLE_LOCATION' || event.entity === 'VEHICLE') fetchBuses();
    }), [subscribe]);

    const fetchHistory = async (bus = selectedHistoryBus, range = historyRange) => {
        if (!bus?.plateNumber) return;

        try {
            setHistoryLoading(true);
            setHistoryError(null);
            const response = await adminAPI.get(
                `/vehicle-monitoring/location-history/${encodeURIComponent(bus.plateNumber)}?range=${range}`
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

    const filteredBuses = buses.filter((bus) => {
        const query = busSearch.trim().toLowerCase();
        const matchesSearch = !query || [bus.plateNumber, bus.route, bus.status]
            .some(value => String(value || '').toLowerCase().includes(query));
        return matchesSearch && (busStatusFilter === 'ALL' || bus.status === busStatusFilter);
    });

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

                <section className={ui.filterPanel}>
                    <h2 className={ui.filterPanelTitle}>Filter Monitored Vehicles</h2>
                    <div className={ui.filterBar}>
                        <label className={`${ui.filterGroup} flex-[1_1_18rem]`}><span className={ui.filterLabel}>Search</span><input type="search" value={busSearch} onChange={(event) => setBusSearch(event.target.value)} placeholder="Vehicle plate or route..." className={`${ui.filterSearch} w-full`} /></label>
                        <label className={ui.filterGroup}><span className={ui.filterLabel}>Status</span><select value={busStatusFilter} onChange={(event) => setBusStatusFilter(event.target.value)} className={ui.filterField}><option value="ALL">All Statuses</option>{[...new Set(buses.map(bus => bus.status).filter(Boolean))].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
                        <button type="button" onClick={() => { setBusSearch(''); setBusStatusFilter('ALL'); }} className={ui.filterReset}>Reset</button>
                    </div>
                </section>

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
                    {filteredBuses.length > 0 && (
                        <section className={`${ui.dataPanel} mt-5`}>
                            <div className={ui.dataPanelHeader}><span className={ui.dataPanelTitle}><FiTruck /> Monitored Vehicles <span className={ui.countPill}>{filteredBuses.length} shown</span></span></div>
                            <div className={ui.tableWrap}><table className={`${ui.adminTable} min-w-[850px]`}><thead><tr>{['Vehicle', 'Route', 'Status', 'Last Position', 'Last Seen', 'Actions'].map(header => <th key={header} className={ui.tableTh}>{header}</th>)}</tr></thead><tbody>{filteredBuses.map((bus, i) => <tr key={bus.plateNumber || i} className={ui.tableRow}>
                                <td className={`${ui.tableTd} font-black text-maroon`}>Bus {bus.plateNumber}</td><td className={ui.tableTd}>{bus.route || 'No route set'}</td><td className={ui.tableTd}><span className={ui.statusPillColor} style={{ background: bus.status === 'ACTIVE' ? '#2f6b3d' : '#717680' }}>{bus.status || 'UNKNOWN'}</span></td><td className={`${ui.tableTd} ${ui.mono}`}>{formatCoordinate(bus.latitude)}, {formatCoordinate(bus.longitude)}</td><td className={`${ui.tableTd} text-text-muted`}>{formatDateTime(bus.lastUpdated)}</td>
                                <td className={ui.tableTd}><div className="inline-flex gap-2"><button type="button" onClick={() => setFlyTarget(bus)} disabled={!hasCoordinates(bus)} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-maroon px-3 text-[0.78rem] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><FiNavigation /> Locate</button><button type="button" onClick={() => showHistory(bus)} disabled={!hasCoordinates(bus)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-maroon bg-white px-3 text-[0.78rem] font-black text-maroon disabled:cursor-not-allowed disabled:opacity-50"><FiMapPin /> History</button></div></td>
                            </tr>)}</tbody></table></div>
                        </section>
                    )}
                    {buses.length > 0 && filteredBuses.length === 0 && (
                        <section className={`${ui.dataPanel} mt-5`}><div className={ui.dataPanelHeader}><span className={ui.dataPanelTitle}><FiTruck /> Monitored Vehicles</span></div><div className="p-10 text-center text-text-muted italic">No monitored vehicles match the current filters.</div></section>
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

