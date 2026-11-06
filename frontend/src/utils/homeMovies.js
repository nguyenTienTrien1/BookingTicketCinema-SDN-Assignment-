export function movieIdOf(showtime) {
    return String(showtime.movie?._id || showtime.movie || '');
}

export function availableSeats(showtime, now = Date.now()) {
    return (showtime.seats || []).filter((seat) => seat.status === 'available' ||
        (seat.status === 'held' && seat.holdUntil && new Date(seat.holdUntil).getTime() <= now)).length;
}

export function upcomingShowtimes(showtimes, movies, now = Date.now()) {
    const permitted = new Set(movies.filter((movie) => movie.classification !== 'C').map((movie) => String(movie._id)));
    return showtimes.filter((showtime) => permitted.has(movieIdOf(showtime)) &&
        new Date(showtime.startTime).getTime() > now && availableSeats(showtime, now) > 0)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}
