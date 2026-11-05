const publicTabs = ['home', 'movies', 'showtimes', 'cinemas', 'movie-detail', 'login'];
const tabsByRole = {
  guest: [...publicTabs, 'booking', 'account'],
  member: [...publicTabs, 'booking', 'payment', 'account'],
  employee: [...publicTabs, 'booking', 'payment', 'account'],
  admin: [...publicTabs, 'booking', 'payment', 'account', 'create-account', 'update-status', 'adjust-points']
};

export function canOpenTab(role, tab) {
  return (tabsByRole[role || 'guest'] || publicTabs).includes(tab);
}

export function loginDestination(role, state) {
  const from = state?.from;
  const allowed = state?.allowedRoles;
  if (Array.isArray(allowed) && (allowed.length === 0 || allowed.includes(role)) &&
      typeof from?.pathname === 'string' && from.pathname.startsWith('/') && !from.pathname.startsWith('//')) {
    return { pathname: from.pathname, search: from.search || '', hash: from.hash || '' };
  }
  return '/account';
}
