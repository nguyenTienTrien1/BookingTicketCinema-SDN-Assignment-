import { api } from './api';

export function getRooms(filters = {}) {
  return api('/rooms?' + new URLSearchParams(filters));
}
export function getRoom(id) { return api(`/rooms/${id}`); }
export function createRoom(data) { return api('/rooms', { method: 'POST', body: JSON.stringify(data) }); }
export function updateRoom(id, data) { return api(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteRoom(id, version) { return api(`/rooms/${id}`, { method: 'DELETE', body: JSON.stringify({ version }) }); }
export function getRoomSeats(id) { return api(`/rooms/${id}/seats`); }
export function previewRoomSeats(id, data) { return api(`/rooms/${id}/seats/preview`, { method: 'POST', body: JSON.stringify(data) }); }
export function saveRoomSeats(id, data) { return api(`/rooms/${id}/seats`, { method: 'PUT', body: JSON.stringify({ ...data, confirmed: true }) }); }

export function generateSeats(rows, columns) {
  const seats = [];
  if (!Number.isInteger(rows) || rows < 1 || rows > 26 || !Number.isInteger(columns) || columns < 1 || columns > 40 || rows * columns > 1000) {
    throw new Error('Chọn 1–26 hàng, 1–40 ghế mỗi hàng và tối đa 1000 ghế.');
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 1; column <= columns; column++) seats.push(String.fromCharCode(65 + row) + column);
  }
  return seats;
}
