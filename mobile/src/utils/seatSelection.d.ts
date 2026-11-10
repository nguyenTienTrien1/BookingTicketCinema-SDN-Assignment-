declare module '*.mjs' {
  type Seat = { number: string; status: string; condition?: string };
  export function isAvailableSeat(seat: Seat): boolean;
  export function orphanSeatMessage(seats: Seat[], selectedSeats: string[]): string;
}
