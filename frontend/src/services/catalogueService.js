import { api } from './api';

export function listCatalogue(kind, search, page) {
  const query = new URLSearchParams({ search, page: String(page), limit: '10' });
  return api(`/${kind}/admin?${query}`);
}

export const getCatalogueItem = (kind, id) => api(`/${kind}/admin/${id}`);

export const createCatalogueItem = (kind, data) => api(`/${kind}`, { method: 'POST', body: JSON.stringify(data) });
