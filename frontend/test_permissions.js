import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canOpenTab, loginDestination } from './src/utils/permissions.js';

test('roles see only their permitted cinema areas', () => {
  for (const role of [undefined, 'member', 'employee', 'admin']) {
    for (const tab of ['home', 'movies', 'movie-detail']) assert.equal(canOpenTab(role, tab), true);
    for (const tab of ['create-account', 'update-status', 'adjust-points']) assert.equal(canOpenTab(role, tab), role === 'admin');
    assert.equal(canOpenTab(role, 'payment'), role === 'member' || role === 'employee' || role === 'admin');
  }
  assert.equal(canOpenTab('admin', 'booking'), true);
  assert.equal(canOpenTab('employee', 'account'), true);
  assert.equal(canOpenTab('member', 'account'), true);
  assert.equal(canOpenTab('unknown', 'payment'), false);
});

test('shared login returns to a permitted page or Account', () => {
  for (const role of ['member', 'employee', 'admin']) assert.equal(loginDestination(role), '/account');
  const state = { from: { pathname: '/admin/movies', search: '?page=2' }, allowedRoles: ['admin'] };
  assert.deepEqual(loginDestination('admin', state), { pathname: '/admin/movies', search: '?page=2', hash: '' });
  assert.equal(loginDestination('member', state), '/account');
  assert.equal(loginDestination('employee', state), '/account');
  assert.equal(loginDestination('admin', { ...state, from: { pathname: '//external.example' } }), '/account');
});
