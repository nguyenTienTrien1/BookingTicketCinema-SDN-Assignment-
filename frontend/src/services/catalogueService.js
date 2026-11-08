import { api, API } from './api';

export function listCatalogue(kind, search, page) {
  const query = new URLSearchParams({ search, page: String(page), limit: '10' });
  return api(`/${kind}/admin?${query}`);
}
export const getCatalogueItem = (kind, id) => api(`/${kind}/admin/${id}`);
export const createCatalogueItem = (kind, data) => api(`/${kind}`, { method: 'POST', body: JSON.stringify(data) });
export const updateCatalogueItem = (kind, id, data) => api(`/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCatalogueItem = (kind, id, version) => api(`/${kind}/${id}`, { method: 'DELETE', body: JSON.stringify({ version }) });

export async function uploadFoodImage(file) {
  const result = await api('/foods/images', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  return result.image;
}

export function foodImageUrl(image) {
  if (image?.startsWith('/api/uploads/foods/')) return new URL(image, new URL(API, window.location.origin)).href;
  return image;
}
