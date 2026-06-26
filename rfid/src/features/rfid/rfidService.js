import api from '../../api/axios';

export const tapRfidCard = (rfidUid, plateNumber) =>
    api.post('/rfid/tap', { rfidUid, plateNumber });

export const processQrFare = (payload, plateNumber) =>
    api.post('/rfid/qr/process', { payload, plateNumber });
