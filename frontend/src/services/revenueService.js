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

export async function exportRevenueReport(reportId, filters) {
  try {
    const response = await authApi.post(`/revenue/reports/${reportId}/export`, filters, { responseType: 'blob' });
    if (!response.headers['content-type']?.includes('text/csv')) throw new Error('Máy chủ chưa trả về file CSV hoàn chỉnh.');
    return response.data;
  } catch (error) {
    let message = 'Không thể xuất báo cáo. Vui lòng thử lại.';
    if (error.response?.data instanceof Blob) {
      try { message = JSON.parse(await error.response.data.text()).message || message; }
      catch { /* Keep a readable error if a proxy returns a non-JSON body. */ }
    } else if (error.message) message = error.message;
    throw new Error(message);
  }
}
