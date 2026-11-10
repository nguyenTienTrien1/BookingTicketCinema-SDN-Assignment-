import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expoGoReturnUrl } from '../src/utils/returnUrl.ts';

test('Expo Go returns to Metro even when app.json defines the installed-app scheme', () => {
  assert.equal(expoGoReturnUrl('/payment-return', '127.0.0.1:8081', 'cinemaplus:///'), 'exp://127.0.0.1:8081/--/payment-return');
  assert.equal(expoGoReturnUrl('/auth-return', '192.168.1.10:8081'), 'exp://192.168.1.10:8081/--/auth-return');
  assert.equal(expoGoReturnUrl('/payment-return', '10.0.2.2:8081', 'exp://127.0.0.1:8081/--/'), 'exp://127.0.0.1:8081/--/payment-return');
});

test('Expo Go preserves secure tunnels and refuses a missing project address', () => {
  assert.equal(expoGoReturnUrl('/payment-return', 'https://project.exp.direct'), 'exps://project.exp.direct/--/payment-return');
  assert.equal(expoGoReturnUrl('/payment-return', undefined, 'exps://project.exp.direct/--/'), 'exps://project.exp.direct/--/payment-return');
  assert.throws(() => expoGoReturnUrl('/payment-return', undefined, 'cinemaplus:///'));
  assert.throws(() => expoGoReturnUrl('/payment-return', 'exp://user:secret@localhost:8081'));
  assert.throws(() => expoGoReturnUrl('/untrusted', 'localhost:8081'));
});
