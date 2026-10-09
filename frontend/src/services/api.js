const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export async function api(path, options = {}) {
  const res = await fetch(API + path, { headers: {'Content-Type':'application/json', ...(options.headers||{})}, ...options });
  const text = await res.text(); let data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || 'Yêu cầu không thành công.');
  return data;
}
export { API };
