import authApi from './auth/authService';

export async function getProfile() {
  const response = await authApi.get('/users/me');
  return response.data.user;
}

export async function updateProfile(data) {
  const response = await authApi.patch('/users/me', data);
  return response.data;
}
