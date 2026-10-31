import authApi from './auth/authService';

export async function getProfile() {
  const response = await authApi.get('/users/me');
  return response.data.user;
}

export async function updateProfile(data) {
  const response = await authApi.patch('/users/me', data);
  return response.data;
}

export async function changePassword(data) {
  const response = await authApi.patch('/users/me/password', data);
  return response.data;
}
