import api from '../../api/axios';

export const tapRfidCard = (rfidUid, plateNumber) =>
    api.post('/rfid/tap', { rfidUid, plateNumber });