import { GPS_STATUS } from '../hooks/useGpsTracking';
 
const CFG = {
    [GPS_STATUS.ACTIVE]:
        { color: '#4ade80', label: 'GPS: Active',            dot: true  },
    [GPS_STATUS.IDLE]:
        { color: '#facc15', label: 'GPS: Starting...',       dot: true  },
    [GPS_STATUS.PERMISSION_DENIED]:
        { color: '#f87171', label: 'GPS: Permission Denied', dot: false },
    [GPS_STATUS.DISABLED]:
        { color: '#f87171', label: 'GPS: Disabled',          dot: false },
    [GPS_STATUS.NO_SIGNAL]:
        { color: '#fb923c', label: 'GPS: No Signal',         dot: true  },
    [GPS_STATUS.ERROR]:
        { color: '#f87171', label: 'GPS: Error',             dot: false },
};

export const GpsStatusBadge = ({ status }) => {
    const cfg = CFG[status] ?? CFG[GPS_STATUS.IDLE];
    return (
        <div className="flex items-center gap-1.5 text-xs"
            style={{ color: cfg.color }}>
            {cfg.dot && (
                <span
                    className="w-2 h-2 rounded-full inline-block animate-pulse"
                    style={{ background: cfg.color }}
                />
            )}
            {cfg.label}
        </div>
    );
};

export default GpsStatusBadge;