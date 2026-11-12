import { api } from './api';

export const getCounterFoods = () => api('/food-sales/catalogue');
export const getFoodSale = (id) => api(`/food-sales/${id}`);
export const applyFoodPromotion = (id, code) => api(`/food-sales/${id}/promotion`, { method: 'PATCH', body: JSON.stringify({ code }) });
export const startFoodVnpay = id => api(`/food-sales/${id}/vnpay`, { method: 'POST' });
export const createFoodSale = (items, requestId) => api('/food-sales', {
  method: 'POST', body: JSON.stringify({ items, requestId })
});
export const cancelFoodSale = (id) => api(`/food-sales/${id}/cancel`, { method: 'POST' });
export const payFoodSale = (id, total, cashReceived) => api(`/food-sales/${id}/pay`, {
  method: 'POST', body: JSON.stringify({ paymentMethod: 'cash', confirmedTotal: total, cashReceived, paymentConfirmed: true })
});
