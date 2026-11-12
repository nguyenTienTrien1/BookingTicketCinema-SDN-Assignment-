import { api } from './api';

export type RoomStatus = 'Active' | 'Inactive' | 'Maintenance';
export type SeatType = 'Standard' | 'VIP';
export type SeatCondition = 'Active' | 'Broken' | 'Maintenance' | 'Disabled';
export type SeatConfig = { type: SeatType; status: SeatCondition };
export type Room = {
  _id: string; cinema: string; name: string; status: RoomStatus; capacity: number;
  seats: string[]; seatConfigs: Record<string, SeatConfig>; version: number; layoutPolicy: string;
};
export type RoomList = { rooms: Room[]; cinemas: string[]; total: number; totalPages: number; page: number };
export type LayoutReview = {
  before: number; after: number; added: string[]; removed: string[];
  types: { seat: string; before: SeatType; after: SeatType }[];
  conditions: { seat: string; before: SeatCondition; after: SeatCondition }[];
  conflicts: string[]; canSave: boolean; scheduledShowtimes: number; layoutPolicy: string;
};
export const roomLabels: Record<RoomStatus, string> = { Active: 'Hoạt động', Inactive: 'Chưa hoạt động', Maintenance: 'Bảo trì' };
export const conditionLabels: Record<SeatCondition, string> = { Active: 'Sử dụng được', Broken: 'Hỏng', Maintenance: 'Bảo trì', Disabled: 'Ngừng sử dụng' };
export const typeLabels: Record<SeatType, string> = { Standard: 'Thường', VIP: 'VIP' };
export function generateRoomSeats(rows: string, columns: string) {
  const r = Number(rows), c = Number(columns);
  if (!/^\d+$/.test(rows) || !/^\d+$/.test(columns) || r < 1 || r > 26 || c < 1 || c > 40 || r * c > 1000) {
    throw new Error('Chọn 1–26 hàng, 1–40 ghế mỗi hàng và tối đa 1000 ghế.');
  }
  return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => String.fromCharCode(65 + i) + (j + 1))).flat();
}
export function roomLayout(seats: string[], configs: Record<string, SeatConfig>) {
  return { seats, seatConfigs: Object.fromEntries(seats.map(number => [number, configs[number] || { type: 'Standard', status: 'Active' }])) as Record<string, SeatConfig> };
}
export const getRoom = (id: string) => api<Room>(`/rooms/${id}`);
