import authApi from './auth/authService';

export async function getRevenueReport(filters, signal) {
  try {
    const response = await authApi.post('/revenue/reports', filters, { signal });
    return response.data;
  } catch (error) {
    if (signal && signal.aborted) throw error;
    throw new Error(error.response?.data?.message || 'Không thể tải báo cáo doanh thu. Vui lòng thử lại.');
  }
}
