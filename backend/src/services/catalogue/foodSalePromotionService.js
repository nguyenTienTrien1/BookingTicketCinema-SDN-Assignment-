import { quoteCounterPromotion, consumeCounterPromotion } from './counterPromotionService.js';
import { domainError as fail } from '../common/transaction.js';

function context(sale) {
  const subtotal = sale.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal <= 0 || subtotal !== (sale.subtotal ?? subtotal) || sale.total !== subtotal - (sale.promotionDiscount || 0)) throw fail('Giá đơn F&B không nhất quán.', 409);
  return { ticketPrice: 0, seats: ['food-only'], foodItems: sale.items, subtotal,
    pointsUsed: 0, discount: 0, total: sale.total, promotion: sale.promotion,
    promotionDiscount: sale.promotionDiscount || 0, expiresAt: new Date(Date.now() + 60000) };
}
export async function quoteFoodPromotion(sale, code, session) {
  return quoteCounterPromotion(code, context(sale), session);
}
export async function consumeFoodPromotion(sale, session) {
  await consumeCounterPromotion(context(sale), session);
}
