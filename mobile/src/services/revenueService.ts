import { api } from './api';

export const revenueSources = { all: 'Tất cả nguồn', tickets: 'Vé và F&B đi kèm', food: 'F&B tại quầy' };
export const revenueMethods = { all: 'Tất cả phương thức', cash: 'Tiền mặt', vnpay: 'VNPay', momo: 'MoMo', 'credit-card': 'Thẻ', points: 'Chỉ dùng điểm' };
export type RevenueFilters = {
  from: string; to: string; source: keyof typeof revenueSources;
  method: keyof typeof revenueMethods; groupBy: 'day' | 'month';
};
export type RevenueMetrics = {
  gross: number; discounts: number; fees: number; points: number;
  payments: number; refunds: number; net: number; paymentCount: number; refundCount: number;
};
export type RevenuePeriod = RevenueMetrics & { period: string };
export type RevenueReport = {
  reportId: string; filters: RevenueFilters; timezone: string; currency: string;
  dataTimestamp: string; expiresAt: string; basis: string; sourceNote: string;
  totals: RevenueMetrics; sources: { tickets: RevenueMetrics; food: RevenueMetrics };
  series: RevenuePeriod[]; excludedFoodSales: number;
  pointRefunds?: { value: number; points: number; count: number; unfinalizedCollections: number };
};
export const vietnamDay = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export function initialRevenueFilters(): RevenueFilters {
  const today = vietnamDay();
  return { from: today.slice(0, 7) + '-01', to: today, source: 'all', method: 'all', groupBy: 'day' };
}
export function validateRevenueFilters(filters: RevenueFilters) {
  for (const value of [filters.from, filters.to]) {
    const date = new Date(value + 'T00:00:00Z');
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error('Chọn ngày hợp lệ trong giai đoạn 2000–2099.');
    }
  }
  const days = (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000;
  if (days < 0 || days >= 366) throw new Error('Ngày kết thúc phải từ ngày bắt đầu; khoảng báo cáo tối đa 366 ngày.');
}
export function getRevenueReport(filters: RevenueFilters) {
  validateRevenueFilters(filters);
  return api<RevenueReport>('/revenue/reports', 'POST', filters);
}
