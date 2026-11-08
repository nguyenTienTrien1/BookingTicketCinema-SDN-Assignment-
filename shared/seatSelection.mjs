export function isAvailableSeat(seat) {
    return seat.status === 'available' && (!seat.condition || seat.condition === 'Active');
}

// Compare before/after within each row. Broken seats stay in the row, and gaps
// in numbering (aisles) do not create a new row or an exempt edge.
export function newOrphanSeats(seats, selectedSeats) {
    const selected = new Set(selectedSeats.map(String));
    const rows = new Map();
    for (const seat of seats) {
        const number = String(seat.number);
        const row = number.match(/^[A-Z]+/i)?.[0].toUpperCase() || '';
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(seat);
    }

    const orphans = [];
    for (const row of rows.values()) {
        row.sort((a, b) => String(a.number).localeCompare(String(b.number), 'en', { numeric: true }));
        const remainsFree = seat => isAvailableSeat(seat) && !selected.has(String(seat.number));
        // The first and last seats of the whole row may remain alone.
        for (let index = 1; index < row.length - 1; index++) {
            const left = row[index - 1], current = row[index], right = row[index + 1];
            const wasOrphan = !isAvailableSeat(left) && !isAvailableSeat(right);
            if (remainsFree(current) && !remainsFree(left) && !remainsFree(right) && !wasOrphan) {
                orphans.push(String(current.number));
            }
        }
    }
    return orphans;
}

export function orphanSeatMessage(seats, selectedSeats) {
    const orphans = newOrphanSeats(seats, selectedSeats);
    return orphans.length
        ? `Lựa chọn này tạo ghế trống lẻ giữa hàng: ${orphans.join(', ')}. Vui lòng chọn thêm hoặc đổi ghế. Được phép chừa một ghế ở đầu/cuối hàng.`
        : '';
}
