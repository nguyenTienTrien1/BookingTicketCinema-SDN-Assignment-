const API = import.meta.env.VITE_API_URL || '/api';
export async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error('Invalid API response. Please check the backend.'); }
  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}
export { API };
