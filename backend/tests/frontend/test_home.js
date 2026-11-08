import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableSeats, movieIdOf, upcomingShowtimes } from "../../../frontend/src/utils/homeMovies.js";

test('home booking shows only future sessions with available seats for published movies', () => {
    const now = Date.parse('2026-11-05T10:00:00Z');
    const movies = [{ _id: 'm1' }, { _id: 'm2', classification: 'C' }];
    const future = new Date(now + 3600000).toISOString();
    const sessions = [
        { _id: 'late', movie: { _id: 'm1' }, startTime: new Date(now + 7200000).toISOString(), seats: [{ status: 'available' }] },
        { _id: 'expired', movie: 'm1', startTime: new Date(now - 1).toISOString(), seats: [{ status: 'available' }] },
        { _id: 'full', movie: 'm1', startTime: future, seats: [{ status: 'booked' }] },
        { _id: 'restricted', movie: 'm2', startTime: future, seats: [{ status: 'available' }] },
        { _id: 'unknown', movie: 'missing', startTime: future, seats: [{ status: 'available' }] },
        { _id: 'next', movie: 'm1', startTime: future, seats: [{ status: 'held', holdUntil: new Date(now - 1).toISOString() }] }
    ];
    assert.deepEqual(upcomingShowtimes(sessions, movies, now).map((session) => session._id), ['next', 'late']);
    assert.equal(sessions[0]._id, 'late');
    assert.equal(movieIdOf(sessions[0]), 'm1');
});

test('active holds and paid seats cannot be selected through home quick booking', () => {
    const now = Date.now();
    assert.equal(availableSeats({ seats: [{ status: 'booked' }, { status: 'held', holdUntil: new Date(now + 10000) }, { status: 'available' }] }, now), 1);
    assert.equal(availableSeats({}), 0);
});
