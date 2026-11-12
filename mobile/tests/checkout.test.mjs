import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdSeconds, maxRedeemablePoints, validRedemption, bookingSummary } from '../src/utils/checkout.ts';

test('checkout closes when the film starts even when the ten-minute hold has time left', () => {
  const now = Date.parse('2026-11-10T12:00:00+07:00');
  const booking = { expiresAt: '2026-11-10T12:10:00+07:00', showtime: { startTime: '2026-11-10T12:02:00+07:00' } };
  assert.equal(holdSeconds(booking, now), 120);
  assert.equal(holdSeconds(booking, now + 120000), 0);
  assert.equal(holdSeconds({ expiresAt: 'invalid' }, now), 0);
  assert.equal(holdSeconds({ expiresAt: '2026-11-10T12:10:00+07:00' }, now), 600);
});

test('redemption respects balance, discounted total and configured step', () => {
  assert.equal(maxRedeemablePoints(300, 89000, 100), 0);
  assert.equal(maxRedeemablePoints(300, 249000, 100), 200);
  assert.equal(maxRedeemablePoints(125, 249000, 100), 100);
  assert.equal(maxRedeemablePoints(300, 249000, 1), 249);
  assert.equal(maxRedeemablePoints(300, -1, 1), 0);
  assert.equal(maxRedeemablePoints(300, 249000, 0), 0);
  for (const value of ['', '-1', '1.5', '1e2', 'Infinity', '9007199254740992', '150', '300']) assert.equal(validRedemption(value, 200, 100), false, value);
  assert.equal(validRedemption('200', 200, 100), true);
  assert.equal(validRedemption('0', 0, 100), true);
});

test('history retains booking snapshots when the show or movie is no longer in the catalogue', () => {
  const ticketContext = { movieTitle: 'Historical movie', cinema: 'Central', room: 'VIP', startTime: '2026-11-10T12:00:00+07:00' };
  assert.deepEqual(bookingSummary({showtime:null,ticketContext}), {title:'Historical movie',cinema:'Central',room:'VIP',startTime:ticketContext.startTime});
  assert.equal(bookingSummary({showtime:{movie:null},ticketContext}).title, 'Historical movie');
  assert.equal(bookingSummary({}).title.length > 0, true);
});
