import authApi from './auth/authService';

export async function getProfile() {
  const response = await authApi.get('/users/me');
  return response.data.user;
}
