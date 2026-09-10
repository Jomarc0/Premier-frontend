export function freshAt(value, now, lifetime = 45000) {
  if (!value) return false;
  const captured = Date.parse(value);
  return Number.isFinite(captured) && captured > now - lifetime && captured <= now + 10000;
}
export function monitoringView(bus, now) {
  const online = bus.deviceStatus === 'ONLINE' && freshAt(bus.deviceLastSeen, now, 90000);
  const fresh = online && bus.locationFresh === true && bus.gpsState === 'GPS_VALID' && freshAt(bus.capturedAt, now);
  return { ...bus, online, locationFresh: fresh, deviceStatus: online ? 'ONLINE' : 'DEVICE_OFFLINE',
    status: !online ? 'OFFLINE' : fresh ? 'ONLINE' : 'DELAYED',
    gpsState: fresh ? 'GPS_VALID' : bus.gpsState === 'GPS_VALID' ? 'GPS_STALE' : bus.gpsState || 'GPS_NO_FIX',
    gpsStatus: fresh ? bus.gpsStatus : 'Unknown', speed: fresh ? bus.speed : null };
}
export function queueView(bus, now) {
  if (freshAt(bus.capturedAt, now)) return bus;
  return { ...bus, distanceRemainingKm: null, estimatedArrivalMinutes: null,
    status: 'GPS_UNKNOWN', statusLabel: 'GPS unavailable' };
}
export function formatSpeed(value) {
  return value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 180
    ? 'Unknown' : `${Number(value).toFixed(1)} km/h`;
}
