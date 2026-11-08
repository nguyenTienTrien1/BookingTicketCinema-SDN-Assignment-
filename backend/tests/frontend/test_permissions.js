import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canOpenTab, loginPathForRoles, roleHome } from "../../../frontend/src/utils/permissions.js";

test('roles see only their permitted cinema areas', () => {
  for (const role of [undefined, 'member', 'employee', 'admin']) {
    for (const tab of ['home', 'movies', 'movie-detail', 'showtimes', 'cinemas', 'booking']) assert.equal(canOpenTab(role, tab), !['employee', 'admin'].includes(role));
    for (const tab of ['create-account', 'update-status', 'adjust-points']) assert.equal(canOpenTab(role, tab), role === 'admin');
    assert.equal(canOpenTab(role, 'payment'), role === 'member');
    assert.equal(canOpenTab(role, 'counter-booking'), ['employee', 'admin'].includes(role));
    assert.equal(canOpenTab(role, 'counter-payment'), ['employee', 'admin'].includes(role));
  }
  assert.equal(canOpenTab('admin', 'booking'), false);
  assert.equal(canOpenTab('employee', 'account'), true);
  assert.equal(canOpenTab('member', 'account'), true);
  assert.equal(canOpenTab('unknown', 'payment'), false);
  assert.equal(canOpenTab('unknown', 'home'), false);
});

test('login destinations separate customer, employee and admin workspaces', () => {
  assert.equal(roleHome('member'), '/');
  assert.equal(roleHome('admin'), '/admin/dashboard');
  assert.equal(roleHome('employee'), '/employee/dashboard');
});

test('staff-only routes send unauthenticated visitors to the staff login', () => {
  for (const roles of [['employee'], ['admin'], ['admin', 'employee']]) assert.equal(loginPathForRoles(roles), '/admin/login');
  for (const roles of [[], ['member'], ['member', 'employee', 'admin']]) assert.equal(loginPathForRoles(roles), '/login');
  assert.equal(loginPathForRoles(), '/login');
});
