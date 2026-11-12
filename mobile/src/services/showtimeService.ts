import { api } from './api';
import { Movie, Seat } from '../utils/types';

export type ManagedShowtime = {
  _id: string; movie: Movie | null; cinema: string; room: string;
  startTime: string; price: number; seats: Seat[]; updatedAt: string;
  cancelledAt?: string; cancellationReason?: string;
};
export type ShowtimeRoom = { _id: string; cinema: string; name: string; seats: string[] };
export type ShowtimePage = { showtimes: ManagedShowtime[]; total: number; page: number; totalPages: number };
export type ShowtimeForm = { movie: string; roomId: string; startTime: string; price: string };
export const vietnamTime = (value: string) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16);
export const emptyShowtimeForm = (): ShowtimeForm => ({ movie: '', roomId: '', startTime: '', price: '80000' });
export const listShowtimes = (movie: string, page: number) => api<ShowtimePage>(`/showtimes?${new URLSearchParams({ movie, page: String(page), limit: '10' })}`);
export const getShowtime = (id: string) => api<ManagedShowtime>(`/showtimes/${id}`);
export const getShowtimeRooms = () => api<ShowtimeRoom[]>('/showtimes/rooms');

export function showtimePayload(form: ShowtimeForm, rooms: ShowtimeRoom[]) {
  if (!form.movie) throw new Error('Vui lòng chọn phim.');
  const room = rooms.find(item => item._id === form.roomId);
  if (!room) throw new Error('Vui lòng chọn phòng đang hoạt động.');
  const start = new Date(`${form.startTime}:00+07:00`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.startTime) ||
      !Number.isFinite(start.getTime()) || vietnamTime(start.toISOString()) !== form.startTime) {
    throw new Error('Vui lòng chọn ngày và giờ bắt đầu hợp lệ.');
  }
  if (start.getTime() <= Date.now()) throw new Error('Suất chiếu phải bắt đầu trong tương lai.');
  const price = Number(form.price);
  if (!/^\d+$/.test(form.price.trim()) || !Number.isSafeInteger(price) || price <= 0) {
    throw new Error('Giá vé phải là số nguyên dương (VND).');
  }
  return { movie: form.movie, cinema: room.cinema, room: room.name, startTime: start.toISOString(), price };
}
