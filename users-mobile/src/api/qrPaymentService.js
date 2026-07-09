import api from './api';

export async function requestQrFareToken() {
  const response = await api.post('/fare/qr');
  return response.data?.data;
}

export async function getQrFareStatus(payload) {
  const response = await api.post('/fare/qr/status', { payload });
  return response.data?.data;
}
