import { useCallback, useEffect, useRef, useState } from 'react';
import {
    CircleMarker,
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    FiChevronLeft,
    FiChevronRight,
    FiMapPin,
    FiNavigation,
    FiPause,
    FiPlay,
    FiRefreshCw,
    FiTruck,
    FiX,
} from 'react-icons/fi';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';
import adminAPI from '../api/adminAxios';
import { useRealtime } from '../context/RealtimeContext';
import { formatDateTime, formatTime, phtDateKey } from '../lib/time';

const MAP_CENTER = [13.8557, 121.1107];
const MAP_ZOOM = 12;
const FIXED_ROUTE_LABEL = 'SM Lipa → Grand Terminal';
const DEFAULT_ROUTE = {
    name: FIXED_ROUTE_LABEL,
    pointA: {
        code: 'POINT_A',
        label: 'SM Lipa',
        description: 'Starting Terminal',
        latitude: 13.954781,
        longitude: 121.163096,
    },
    pointB: {
        code: 'POINT_B',
        label: 'Grand Terminal',
        description: 'Destination Terminal',
        latitude: 13.790391,
        longitude: 121.062721,
    },
};

const makeVehiclePositionIcon = (fill, border) => L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;transform:rotate(45deg);border-radius:50% 50% 50% 8px;background:${fill};border:3px solid ${border};box-shadow:0 4px 14px rgba(44,36,41,.3);display:grid;place-items:center"><span style="width:9px;height:9px;border-radius:50%;background:white;display:block"></span></div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 34],
    popupAnchor: [0, -36],
});

const vehiclePositionIcons = {
    ONLINE: makeVehiclePositionIcon('#2f6b3d', '#ffffff'),
    DELAYED: makeVehiclePositionIcon('#e8bd47', '#6f2f3c'),
    OFFLINE: makeVehiclePositionIcon('#6b7280', '#ffffff'),
};

const playbackIcon = L.divIcon({
    className: '',
    html: '<div style="width:30px;height:30px;transform:rotate(45deg);border-radius:50% 50% 50% 8px;background:#e8bd47;border:4px solid #6f2f3c;box-shadow:0 4px 16px rgba(44,36,41,.35);display:grid;place-items:center"><span style="width:9px;height:9px;border-radius:50%;background:#6f2f3c;display:block"></span></div>',
    iconSize: [30, 38],
    iconAnchor: [15, 34],
    popupAnchor: [0, -36],
});

const endpointIcon = (label, color) => L.divIcon({
    className: '',
    html: `<div style="min-width:72px;transform:translate(-28px,-12px);display:flex;align-items:center;gap:6px"><span style="width:20px;height:20px;border-radius:50%;background:${color};border:4px solid white;box-shadow:0 2px 9px rgba(44,36,41,.35);display:block;flex:none"></span><strong style="white-space:nowrap;color:#6f2f3c;font:800 11px Arial;background:white;padding:3px 5px;border-radius:4px;box-shadow:0 2px 8px rgba(44,36,41,.15)">${label}</strong></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -13],
});

const pointAIcon = endpointIcon('SM Lipa', '#6f2f3c');
const pointBIcon = endpointIcon('Grand Terminal', '#e8bd47');

const validCoordinates = (item) => {
    const latitude = Number(item?.latitude);
    const longitude = Number(item?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= -90 && latitude <= 90
        && longitude >= -180 && longitude <= 180
        && latitude !== 0 && longitude !== 0;
};

const formatCoordinate = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(5) : 'N/A';
};

const formatSpeed = (value) => `${Number(value || 0).toFixed(1)} km/h`;

const relativeTime = (value) => {
    if (!value) return 'No GPS update';
    const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
};

const durationText = (seconds) => {
    if (seconds == null) return 'Not available';
    const total = Number(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const statusTone = {
    ONLINE: 'bg-[#e4f4e8] text-[#2f6b3d]',
    DELAYED: 'bg-[#fff4d5] text-[#946b00]',
    OFFLINE: 'bg-[#fce7ea] text-danger-muted',
};

const normalizeRoute = (route = {}) => ({
    ...DEFAULT_ROUTE,
    ...route,
    name: FIXED_ROUTE_LABEL,
    pointA: {
        ...DEFAULT_ROUTE.pointA,
        ...route.pointA,
        label: 'SM Lipa',
        description: 'Starting Terminal',
    },
    pointB: {
        ...DEFAULT_ROUTE.pointB,
        ...route.pointB,
        label: 'Grand Terminal',
        description: 'Destination Terminal',
    },
});

const readBusPayload = (payload) => {
    const envelope = payload?.data ?? payload;
    if (Array.isArray(envelope)) return { buses: envelope, route: DEFAULT_ROUTE };
    return {
        buses: envelope?.buses || envelope?.content || envelope?.vehicles || [],
        route: normalizeRoute(envelope?.route),
    };
};

const readHistoryPayload = (payload) => {
    const envelope = payload?.data ?? payload;
    if (Array.isArray(envelope)) return { history: envelope, summary: {}, route: DEFAULT_ROUTE };
    return {
        history: envelope?.history || envelope?.content || [],
        summary: envelope?.summary || {},
        route: normalizeRoute(envelope?.route),
    };
};

const MapController = ({ focus, resetToken, route, markerRefs }) => {
    const map = useMap();
    useEffect(() => {
        if (validCoordinates(focus)) {
            map.flyTo([Number(focus.latitude), Number(focus.longitude)], 16, { animate: true, duration: 0.8 });
            window.setTimeout(() => markerRefs.current.get(focus.markerKey)?.openPopup(), 250);
            return;
        }
        map.fitBounds([
            [route.pointA.latitude, route.pointA.longitude],
            [route.pointB.latitude, route.pointB.longitude],
        ], { padding: [55, 55] });
    }, [focus, map, markerRefs, resetToken, route]);
    return null;
};

const VehicleMonitoringPage = () => {
    const [buses, setBuses] = useState([]);
    const [route, setRoute] = useState(DEFAULT_ROUTE);
    const [busSearch, setBusSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState('');
    const [mapFocus, setMapFocus] = useState(null);
    const [resetToken, setResetToken] = useState(0);
    const [selectedHistoryBus, setSelectedHistoryBus] = useState(null);
    const [historyFilters, setHistoryFilters] = useState({
        date: phtDateKey(),
        startTime: '00:00',
        endTime: '23:59',
    });
    const [historyPoints, setHistoryPoints] = useState([]);
    const [historySummary, setHistorySummary] = useState({});
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [playing, setPlaying] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const markerRefs = useRef(new Map());
    const intervalRef = useRef(null);
    const { subscribe } = useRealtime();

    const fetchBuses = useCallback(async () => {
        try {
            const response = await adminAPI.get('/vehicle-monitoring/buses');
            const parsed = readBusPayload(response.data);
            setBuses(parsed.buses);
            setRoute(parsed.route);
            setLastUpdated(formatTime(new Date()));
            setError('');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to load vehicle monitoring data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        Promise.resolve().then(fetchBuses);
        intervalRef.current = window.setInterval(fetchBuses, 30000);
        return () => window.clearInterval(intervalRef.current);
    }, [fetchBuses]);

    useEffect(() => subscribe((event) => {
        if (event.entity === 'VEHICLE_LOCATION' || event.entity === 'VEHICLE') fetchBuses();
    }), [fetchBuses, subscribe]);

    const loadHistory = useCallback(async (bus, filters) => {
        if (!bus?.plateNumber) return;
        setHistoryLoading(true);
        setHistoryError('');
        setPlaying(false);
        try {
            const response = await adminAPI.get(
                `/vehicle-monitoring/location-history/${encodeURIComponent(bus.plateNumber)}`,
                { params: filters },
            );
            const parsed = readHistoryPayload(response.data);
            const validPoints = parsed.history.filter(validCoordinates);
            setHistoryPoints(validPoints);
            setHistorySummary(parsed.summary);
            setRoute(parsed.route);
            setPlaybackIndex(0);
            if (validPoints.length) {
                const first = validPoints[0];
                setMapFocus({ ...first, markerKey: `history-${first.id ?? 0}` });
            } else {
                setMapFocus(null);
                setResetToken(value => value + 1);
            }
        } catch (requestError) {
            setHistoryPoints([]);
            setHistorySummary({});
            setHistoryError(requestError.response?.data?.message || 'Cannot load location history for this bus.');
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const showHistory = (bus) => {
        setSelectedHistoryBus(bus);
        loadHistory(bus, historyFilters);
    };

    const closeHistory = () => {
        setSelectedHistoryBus(null);
        setHistoryPoints([]);
        setHistorySummary({});
        setHistoryError('');
        setPlaying(false);
        setMapFocus(null);
        setResetToken(value => value + 1);
    };

    const focusBus = (bus) => {
        if (!validCoordinates(bus)) {
            setError('No GPS location available for this vehicle.');
            return;
        }
        setError('');
        setMapFocus({ ...bus, markerKey: `bus-${bus.plateNumber}` });
    };

    const focusHistoryPoint = (point, index) => {
        setPlaybackIndex(index);
        setMapFocus({ ...point, markerKey: `history-${point.id ?? index}` });
    };

    const changePlaybackPoint = (nextIndex) => {
        if (!historyPoints.length) return;
        const bounded = Math.max(0, Math.min(historyPoints.length - 1, nextIndex));
        setPlaybackIndex(bounded);
        const point = historyPoints[bounded];
        setMapFocus({ ...point, markerKey: `history-${point.id ?? bounded}` });
    };

    useEffect(() => {
        if (!playing || historyPoints.length < 2) return undefined;
        const timer = window.setInterval(() => {
            setPlaybackIndex(current => {
                if (current >= historyPoints.length - 1) {
                    setPlaying(false);
                    return current;
                }
                const next = current + 1;
                const point = historyPoints[next];
                setMapFocus({ ...point, markerKey: `history-${point.id ?? next}` });
                return next;
            });
        }, Math.max(150, 1000 / playbackSpeed));
        return () => window.clearInterval(timer);
    }, [historyPoints, playbackSpeed, playing]);

    const filteredBuses = buses.filter(bus => {
        const query = busSearch.trim().toLowerCase();
        const matchesSearch = !query || String(bus.plateNumber || '').toLowerCase().includes(query);
        return matchesSearch && (statusFilter === 'ALL' || bus.status === statusFilter);
    });
    const currentPlaybackPoint = historyPoints[playbackIndex];

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Operations</span>
                        <h1 className={ui.headerTitle}>Bus / Vehicle Monitoring</h1>
                        <p className="mt-1 mb-0 text-[0.78rem] text-text-muted">
                            Fixed route: <strong>{FIXED_ROUTE_LABEL}</strong>
                            {lastUpdated && <> · Last updated: {lastUpdated}</>}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setMapFocus(null); setResetToken(value => value + 1); }} className={ui.adminAction}>
                            <FiMapPin /> Reset View
                        </button>
                        <button type="button" onClick={fetchBuses} className={ui.adminActionRefresh}>
                            <FiRefreshCw /> Refresh
                        </button>
                    </div>
                </header>

                {error && <div className="mb-4 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-[0.88rem] font-extrabold text-danger-muted-dark">{error}</div>}

                <div className="mb-5 flex gap-3 max-[760px]:flex-col">
                    {[route.pointA, route.pointB].map(point => (
                        <article key={point.code} className="flex-1 rounded-lg border-l-4 border-maroon bg-white px-4 py-3 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                            <div className="text-sm font-black text-maroon">{point.label}</div>
                        </article>
                    ))}
                </div>

                <section className={ui.filterPanel}>
                    <h2 className={ui.filterPanelTitle}>Filter Monitored Vehicles</h2>
                    <div className={ui.filterBar}>
                        <label className={`${ui.filterGroup} flex-[1_1_18rem]`}>
                            <span className={ui.filterLabel}>Search</span>
                            <input type="search" value={busSearch} onChange={event => setBusSearch(event.target.value)}
                                placeholder="Vehicle plate..." className={`${ui.filterSearch} w-full`} />
                        </label>
                        <label className={ui.filterGroup}>
                            <span className={ui.filterLabel}>GPS Status</span>
                            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className={ui.filterField}>
                                <option value="ALL">All Statuses</option>
                                <option value="ONLINE">Online</option>
                                <option value="DELAYED">Delayed</option>
                                <option value="OFFLINE">Offline</option>
                            </select>
                        </label>
                        <button type="button" onClick={() => { setBusSearch(''); setStatusFilter('ALL'); }} className={ui.filterReset}>Reset</button>
                    </div>
                </section>

                <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                    <div className="mb-4 flex items-center justify-between rounded-lg bg-maroon px-4 py-3">
                        <h2 className="m-0 text-[0.95rem] font-black text-white">
                            {selectedHistoryBus ? `Bus History — ${selectedHistoryBus.plateNumber}` : `Real-time Tracking — ${FIXED_ROUTE_LABEL}`}
                        </h2>
                        <span className="rounded-full bg-gold px-3 py-1 text-[0.72rem] font-black text-maroon">
                            {selectedHistoryBus ? `${historyPoints.length} GPS records` : `${buses.filter(bus => bus.status === 'ONLINE').length} online`}
                        </span>
                    </div>

                    <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} style={{ height: 520, borderRadius: 8 }}>
                        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapController focus={mapFocus} resetToken={resetToken} route={route} markerRefs={markerRefs} />

                        <Marker position={[route.pointA.latitude, route.pointA.longitude]} icon={pointAIcon}>
                            <Popup><strong className="text-maroon">{route.pointA.label}</strong><br />{route.pointA.description}</Popup>
                        </Marker>
                        <Marker position={[route.pointB.latitude, route.pointB.longitude]} icon={pointBIcon}>
                            <Popup><strong className="text-maroon">{route.pointB.label}</strong><br />{route.pointB.description}</Popup>
                        </Marker>

                        {!selectedHistoryBus && buses.filter(validCoordinates).map(bus => (
                            <Marker key={bus.plateNumber} position={[bus.latitude, bus.longitude]}
                                icon={vehiclePositionIcons[bus.status] || vehiclePositionIcons.OFFLINE}
                                ref={marker => markerRefs.current.set(`bus-${bus.plateNumber}`, marker)}>
                                <Tooltip permanent direction="right" offset={[12, -18]} opacity={0.96}>
                                    <strong className="whitespace-nowrap text-maroon">{bus.plateNumber}</strong>
                                </Tooltip>
                                <Popup><BusPopup bus={bus} /></Popup>
                            </Marker>
                        ))}

                        {selectedHistoryBus && historyPoints.map((point, index) => {
                            const latest = index === historyPoints.length - 1;
                            return (
                                <CircleMarker key={point.id ?? index} center={[point.latitude, point.longitude]}
                                    radius={latest ? 9 : 5}
                                    pathOptions={{
                                        color: latest ? '#6f2f3c' : '#ffffff',
                                        fillColor: latest ? '#e8bd47' : '#6f2f3c',
                                        fillOpacity: latest ? 1 : 0.78,
                                        weight: latest ? 4 : 2,
                                    }}
                                    eventHandlers={{ click: () => setPlaybackIndex(index) }}
                                    ref={marker => markerRefs.current.set(`history-${point.id ?? index}`, marker)}>
                                    <Popup><HistoryPointPopup point={point} plateNumber={selectedHistoryBus.plateNumber} /></Popup>
                                </CircleMarker>
                            );
                        })}

                        {selectedHistoryBus && playing && currentPlaybackPoint && (
                            <Marker position={[currentPlaybackPoint.latitude, currentPlaybackPoint.longitude]} icon={playbackIcon}>
                                <Popup><HistoryPointPopup point={currentPlaybackPoint} plateNumber={selectedHistoryBus.plateNumber} /></Popup>
                            </Marker>
                        )}
                    </MapContainer>

                    <MapLegend />

                    {selectedHistoryBus && (
                        <HistoryPanel bus={selectedHistoryBus} filters={historyFilters} onFiltersChange={setHistoryFilters}
                            onLoad={() => loadHistory(selectedHistoryBus, historyFilters)} onClose={closeHistory}
                            loading={historyLoading} error={historyError} points={historyPoints} summary={historySummary}
                            playing={playing} onPlayingChange={setPlaying} speed={playbackSpeed} onSpeedChange={setPlaybackSpeed}
                            playbackIndex={playbackIndex} onPlaybackPointChange={changePlaybackPoint}
                            onPointClick={focusHistoryPoint} />
                    )}

                    {!selectedHistoryBus && (
                        <VehicleTable buses={filteredBuses} loading={loading} onLocate={focusBus} onHistory={showHistory} />
                    )}
                </section>
            </main>
        </div>
    );
};

const BusPopup = ({ bus }) => (
    <div style={{ minWidth: 210 }}>
        <strong style={{ color: '#6f2f3c' }}>BUS {bus.plateNumber}</strong><br />
        <span>Route: {FIXED_ROUTE_LABEL}</span><br />
        <span>Status: <strong>{bus.status}</strong></span><br />
        <span>GPS status: {bus.gpsStatus}</span><br />
        <span>Latitude: {formatCoordinate(bus.latitude)}</span><br />
        <span>Longitude: {formatCoordinate(bus.longitude)}</span><br />
        <span>Speed: {formatSpeed(bus.speed)}</span><br />
        <span>Last GPS update: {relativeTime(bus.lastUpdated)}</span><br />
        <span>Last seen: {formatDateTime(bus.lastSeen)}</span>
    </div>
);

const HistoryPointPopup = ({ point, plateNumber }) => (
    <div style={{ minWidth: 200 }}>
        <strong style={{ color: '#6f2f3c' }}>Bus {plateNumber}</strong><br />
        <span>Date: {new Date(point.recordedAt).toLocaleDateString('en-PH')}</span><br />
        <span>Time: {new Date(point.recordedAt).toLocaleTimeString('en-PH')}</span><br />
        <span>Latitude: {formatCoordinate(point.latitude)}</span><br />
        <span>Longitude: {formatCoordinate(point.longitude)}</span><br />
        <span>Speed: {formatSpeed(point.speed)}</span><br />
        <span>Status: {point.status}</span>
    </div>
);

const MapLegend = () => (
    <div className="mt-3 flex flex-wrap gap-4 rounded-md border border-border-soft bg-page-bg px-3 py-2 text-xs text-text-muted">
        <LegendItem color="#6f2f3c" label="SM Lipa" text="Starting Terminal" />
        <LegendItem color="#e8bd47" label="Grand Terminal" text="Destination Terminal" />
        <LegendItem color="#2f6b3d" label="Vehicle" text="Plate shown; green online, gold delayed, gray offline" ring />
        <LegendItem color="#6f2f3c" label="GPS Point" text="Historical GPS record" small />
        <LegendItem color="#e8bd47" label="Latest Position" text="Most recent GPS record" ring />
    </div>
);

const LegendItem = ({ color, label, text, small, ring }) => (
    <span className="inline-flex items-center gap-2">
        <span style={{ background: color }} className={`${small ? 'h-2.5 w-2.5' : 'h-4 w-4'} rounded-full ${ring ? 'border-[3px] border-maroon' : ''}`} />
        <strong className="text-maroon">{label}</strong> — {text}
    </span>
);

const HistoryPanel = ({
    bus, filters, onFiltersChange, onLoad, onClose, loading, error, points, summary,
    playing, onPlayingChange, speed, onSpeedChange, playbackIndex, onPlaybackPointChange, onPointClick,
}) => (
    <section className="mt-5">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-soft bg-page-bg p-4">
            <div className="mr-auto">
                <div className="font-black text-maroon">Bus History — {bus.plateNumber}</div>
                <div className="mt-1 text-xs text-text-muted">Route: {FIXED_ROUTE_LABEL}</div>
            </div>
            <HistoryInput label="Date" type="date" value={filters.date}
                onChange={value => onFiltersChange(current => ({ ...current, date: value }))} />
            <HistoryInput label="Start Time" type="time" value={filters.startTime}
                onChange={value => onFiltersChange(current => ({ ...current, startTime: value }))} />
            <HistoryInput label="End Time" type="time" value={filters.endTime}
                onChange={value => onFiltersChange(current => ({ ...current, endTime: value }))} />
            <button type="button" onClick={onLoad} disabled={loading} className={ui.adminActionRefresh}>
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> {loading ? 'Loading' : 'Load History'}
            </button>
            <button type="button" onClick={onClose} className={ui.adminAction}><FiX /> Close</button>
        </div>

        {error && <div className="mt-3 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm font-bold text-danger-muted-dark">{error}</div>}
        {!loading && !error && points.length === 0 && (
            <div className="mt-3 rounded-md border border-dashed border-border-soft bg-page-bg p-6 text-center">
                <strong className="text-maroon">No GPS history for the selected period</strong>
                <p className="m-0 mt-1 text-sm text-text-muted">No valid GPS records match this bus, date, and time range.</p>
            </div>
        )}

        {points.length > 0 && (
            <>
                <HistorySummary summary={summary} bus={bus} filters={filters} />
                <div className="my-4 flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-white p-3">
                    <button type="button" onClick={() => onPlayingChange(!playing)} className={ui.adminActionRefresh}>
                        {playing ? <FiPause /> : <FiPlay />} {playing ? 'Pause' : 'Play History'}
                    </button>
                    <button type="button" onClick={() => onPlaybackPointChange(playbackIndex - 1)}
                        disabled={playbackIndex === 0} className={ui.adminAction}><FiChevronLeft /> Previous</button>
                    <button type="button" onClick={() => onPlaybackPointChange(playbackIndex + 1)}
                        disabled={playbackIndex >= points.length - 1} className={ui.adminAction}>Next <FiChevronRight /></button>
                    <label className="ml-auto flex items-center gap-2 text-xs font-black text-text-muted">
                        Playback speed
                        <select value={speed} onChange={event => onSpeedChange(Number(event.target.value))}
                            className="rounded-md border border-border-soft bg-white px-3 py-2 text-text-main">
                            {[1, 2, 5, 10].map(value => <option key={value} value={value}>{value}×</option>)}
                        </select>
                    </label>
                    <span className="text-xs font-bold text-text-muted">{playbackIndex + 1} / {points.length}</span>
                </div>
                <div className={ui.tableWrap}>
                    <table className={`${ui.adminTable} min-w-[760px]`}>
                        <thead><tr>{['Time', 'Latitude', 'Longitude', 'Speed', 'Status'].map(header => <th key={header} className={ui.tableTh}>{header}</th>)}</tr></thead>
                        <tbody>{points.map((point, index) => (
                            <tr key={point.id ?? index} onClick={() => onPointClick(point, index)}
                                className={`${ui.tableRow} cursor-pointer ${index === playbackIndex ? 'bg-[#fff8e6]' : ''}`}>
                                <td className={ui.tableTd}>{new Date(point.recordedAt).toLocaleTimeString('en-PH')}</td>
                                <td className={`${ui.tableTd} ${ui.mono}`}>{formatCoordinate(point.latitude)}</td>
                                <td className={`${ui.tableTd} ${ui.mono}`}>{formatCoordinate(point.longitude)}</td>
                                <td className={ui.tableTd}>{formatSpeed(point.speed)}</td>
                                <td className={ui.tableTd}>{point.status}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </>
        )}
    </section>
);

const HistoryInput = ({ label, type, value, onChange }) => (
    <label className="grid gap-1 text-xs font-black text-text-muted">
        {label}
        <input type={type} value={value} max={type === 'date' ? phtDateKey() : undefined}
            onChange={event => onChange(event.target.value)}
            className="min-h-[2.4rem] rounded-md border border-border-soft bg-white px-3 text-sm font-semibold text-text-main" />
    </label>
);

const HistorySummary = ({ summary, bus, filters }) => {
    const metrics = [
        ['GPS Records', summary.gpsRecords ?? 0],
        ['First Recorded', summary.firstRecorded ? new Date(summary.firstRecorded).toLocaleTimeString('en-PH') : 'Not available'],
        ['Last Recorded', summary.lastRecorded ? new Date(summary.lastRecorded).toLocaleTimeString('en-PH') : 'Not available'],
        ['Total Recorded Time', durationText(summary.totalRecordedSeconds)],
        ['Distance', summary.totalDistanceKm == null ? 'Not available' : `${summary.totalDistanceKm} km`],
        ['Average Speed', summary.averageSpeedKmh == null ? 'Not available' : `${summary.averageSpeedKmh} km/h`],
        ['Maximum Speed', summary.maximumSpeedKmh == null ? 'Not available' : `${summary.maximumSpeedKmh} km/h`],
        ['Stops', summary.numberOfStops ?? 'Not available'],
    ];
    return (
        <div className="mt-4">
            <div className="mb-2 text-sm font-black text-maroon">
                Bus {bus.plateNumber} · {filters.date} · {filters.startTime}–{filters.endTime}
            </div>
            <div className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
                {metrics.map(([label, value]) => (
                    <article key={label} className="rounded-md border border-border-soft bg-white p-3">
                        <div className="text-xs font-black text-text-muted">{label}</div>
                        <div className="mt-1 font-black text-maroon">{value}</div>
                    </article>
                ))}
            </div>
        </div>
    );
};

const VehicleTable = ({ buses, loading, onLocate, onHistory }) => (
    <section className={`${ui.dataPanel} mt-5`}>
        <div className={ui.dataPanelHeader}>
            <span className={ui.dataPanelTitle}><FiTruck /> Monitored Vehicles <span className={ui.countPill}>{buses.length} shown</span></span>
        </div>
        {loading ? <div className="h-52 animate-pulse bg-[#eceff3]" /> : buses.length ? (
            <div className={ui.tableWrap}>
                <table className={`${ui.adminTable} min-w-[940px]`}>
                    <thead><tr>{['Vehicle', 'Fixed Route', 'GPS Status', 'Last Position', 'Speed', 'Last GPS Update', 'Actions'].map(header => <th key={header} className={ui.tableTh}>{header}</th>)}</tr></thead>
                    <tbody>{buses.map(bus => (
                        <tr key={bus.plateNumber} className={ui.tableRow}>
                            <td className={`${ui.tableTd} font-black text-maroon`}>Bus {bus.plateNumber}</td>
                            <td className={ui.tableTd}>{FIXED_ROUTE_LABEL}</td>
                            <td className={ui.tableTd}><span className={`rounded-full px-2 py-1 text-xs font-black ${statusTone[bus.status] || statusTone.OFFLINE}`}>{bus.status || 'OFFLINE'}</span></td>
                            <td className={`${ui.tableTd} ${ui.mono}`}>{validCoordinates(bus) ? `${formatCoordinate(bus.latitude)}, ${formatCoordinate(bus.longitude)}` : 'No GPS location available'}</td>
                            <td className={ui.tableTd}>{validCoordinates(bus) ? formatSpeed(bus.speed) : 'Not available'}</td>
                            <td className={`${ui.tableTd} text-text-muted`}>{bus.lastUpdated ? `${formatDateTime(bus.lastUpdated)} (${relativeTime(bus.lastUpdated)})` : 'No GPS update'}</td>
                            <td className={ui.tableTd}>
                                <div className="inline-flex gap-2">
                                    <button type="button" onClick={() => onLocate(bus)} disabled={!validCoordinates(bus)}
                                        title={!validCoordinates(bus) ? 'No GPS location available for this vehicle.' : 'Locate latest valid GPS position'}
                                        className="inline-flex min-h-8 items-center gap-1 rounded-md bg-maroon px-3 text-[0.78rem] font-black text-white disabled:cursor-not-allowed disabled:opacity-45">
                                        <FiNavigation /> Locate
                                    </button>
                                    <button type="button" onClick={() => onHistory(bus)}
                                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-maroon bg-white px-3 text-[0.78rem] font-black text-maroon">
                                        <FiMapPin /> History
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        ) : <div className="p-10 text-center text-text-muted italic">No monitored vehicles match the current filters.</div>}
    </section>
);

export default VehicleMonitoringPage;
