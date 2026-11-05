import { api } from './api';

export function listCatalogue(kind, search, page) {
  const query = new URLSearchParams({ search, page: String(page), limit: '10' });
  return api(`/${kind}/admin?${query}`);
}
export const getCatalogueItem = (kind, id) => api(`/${kind}/admin/${id}`);
export const createCatalogueItem = (kind, data) => api(`/${kind}`, { method: 'POST', body: JSON.stringify(data) });
export const updateCatalogueItem = (kind, id, data) => api(`/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCatalogueItem = (kind, id, version) => api(`/${kind}/${id}`, { method: 'DELETE', body: JSON.stringify({ version }) });
