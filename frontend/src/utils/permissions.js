const publicTabs = ['home', 'movies', 'showtimes', 'cinemas', 'movie-detail', 'login'];
const tabsByRole = {
  guest: [...publicTabs, 'booking', 'account'],
  member: [...publicTabs, 'booking', 'payment', 'account'],
  employee: ['account', 'counter-booking', 'counter-payment'],
  admin: ['account', 'counter-booking', 'counter-payment', 'create-account', 'update-status', 'adjust-points']
};

export function canOpenTab(role, tab) {
  return (tabsByRole[role || 'guest'] || []).includes(tab);
}

export function roleHome(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'employee') return '/employee/dashboard';
  return '/';
}

export function loginPathForRoles(roles = []) {
  return roles.length > 0 && roles.every(role => ['employee', 'admin'].includes(role))
    ? '/admin/login' : '/login';
}
