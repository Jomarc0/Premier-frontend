import { useState, useEffect, useRef, useCallback } from 'react';
import driverAPI from '../api/driverAxios';

const SEND_INTERVAL_MS = 5000;
const GPS_TIMEOUT_MS   = 15000;  
const GPS_MAX_AGE_MS   = 5000;   

export const GPS_STATUS = {
    IDLE:             'IDLE',
    ACTIVE:           'ACTIVE',
    PERMISSION_DENIED:'PERMISSION_DENIED',
    DISABLED:         'DISABLED',
    NO_SIGNAL:        'NO_SIGNAL',
    ERROR:            'ERROR',
};


const useGpsTracking = (plateNumber, shiftId) => {
    const [gpsStatus,   setGpsStatus]   = useState(GPS_STATUS.IDLE);
    const [coordinates, setCoordinates] = useState(null);
    const [geofence,    setGeofence]    = useState(null);
    const [eta,         setEta]         = useState(null);
    const [deviated,    setDeviated]    = useState(false);

    const watchIdRef   = useRef(null);
    const lastSentRef  = useRef(0);
    const isSendingRef = useRef(false);
    const latestRef    = useRef(null);

    // Send GPS to /api/driver/location 
    const sendLocation = useCallback(async (coords) => {
        if (!plateNumber || !coords) return;
        if (isSendingRef.current) return;

        const now = Date.now();
        if (now - lastSentRef.current < SEND_INTERVAL_MS) return;

        isSendingRef.current = true;
        lastSentRef.current = now;

        try {
            console.log('[GPS] 📡 Sending:', {
                plateNumber,
                latitude: coords.latitude,
                longitude: coords.longitude,
                speed: coords.speed?.toFixed(1)
            });

            const res = await driverAPI.post('/location', {
                plateNumber,
                shiftId: shiftId || null,
                latitude:  coords.latitude,
                longitude: coords.longitude,
                speed:     coords.speed ?? 0,
                heading:   coords.heading ?? 0,
                recordedAt: new Date().toISOString()  
            }, {
                timeout: 8000  
            });

            const data = res.data?.data;
            console.log('[GPS] Sent OK:', data?.status);

            if (data?.geofence !== undefined) setGeofence(data.geofence);
            if (data?.deviated !== undefined) setDeviated(data.deviated);
            if (data?.eta !== undefined) setEta(data.eta);

        } catch (err) {
            if (err.code === 'ECONNABORTED') {
                console.warn('[GPS] Timeout - GPS too slow');
            } else {
                console.warn('[GPS] Send failed:', err.response?.data?.message || err.message);
            }
        } finally {
            isSendingRef.current = false;
        }
    }, [plateNumber, shiftId]);

    // GPS Success 
    const onPosition = useCallback((pos) => {
        const coords = {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed:     pos.coords.speed ? pos.coords.speed * 3.6 : 0,  // m/s → km/h
            heading:   pos.coords.heading ?? 0,
            accuracy:  pos.coords.accuracy,
        };
        
        latestRef.current = coords;
        setCoordinates(coords);
        setGpsStatus(GPS_STATUS.ACTIVE);
        
        console.log('[GPS]  New position:', coords);
        sendLocation(coords);
    }, [sendLocation]);

    const onError = useCallback((err) => {
        console.error('[GPS]  Error:', err.code, err.message);
        
        switch (err.code) {
            case 1:  setGpsStatus(GPS_STATUS.PERMISSION_DENIED); break;
            case 2:  setGpsStatus(GPS_STATUS.NO_SIGNAL);         break;
            case 3:  // TIMEOUT - Most common on mobile
                console.warn('[GPS] Timeout - Retrying...');
                setGpsStatus(GPS_STATUS.NO_SIGNAL);
                break;
            default: setGpsStatus(GPS_STATUS.ERROR);
        }
    }, []);

    // Main Effect 
    useEffect(() => {
        if (!plateNumber) {
            setGpsStatus(GPS_STATUS.IDLE);
            return;
        }

        if (!navigator.geolocation) {
            console.warn('[GPS] Browser doesn\'t support geolocation');
            setGpsStatus(GPS_STATUS.DISABLED);
            return;
        }

        console.log('[GPS] Starting GPS tracking for:', plateNumber);

        const options = {
            enableHighAccuracy: true,
            timeout: GPS_TIMEOUT_MS,      
            maximumAge: GPS_MAX_AGE_MS    
        };

        watchIdRef.current = navigator.geolocation.watchPosition(
            onPosition,
            onError,
            options
        );

        const interval = setInterval(() => {
            if (latestRef.current) {
                sendLocation(latestRef.current);
            }
        }, SEND_INTERVAL_MS);

        return () => {
            console.log('[GPS] Stopping tracking');
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            clearInterval(interval);
        };
    }, [plateNumber, onPosition, onError, sendLocation]);

    return { gpsStatus, coordinates, geofence, eta, deviated };
};

export default useGpsTracking;