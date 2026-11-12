import crypto from 'node:crypto';
import FoodSale from '../../models/catalogue/FoodSale.js';
import Food from '../../models/catalogue/Food.js';
import { transaction, domainError as fail } from '../common/transaction.js';
import { canonical, signature } from '../payments/vnpayService.js';
import { quoteFoodPromotion, consumeFoodPromotion } from './foodSalePromotionService.js';
import { validateMobileReturn } from '../payments/mobileReturn.js';

function date(value) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map(key => parts.find(p => p.type === key).value).join('');
}
export async function createFoodVnpay(id, employeeId, ip, mobileReturnTo = null) {
  if (mobileReturnTo) mobileReturnTo = validateMobileReturn(mobileReturnTo);
  if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET || !process.env.VNPAY_RETURN_URL) throw fail('Chưa cấu hình VNPay.', 503);
  const sale = await transaction(async session => {
    const order = await FoodSale.findOne({ _id: id, employee: employeeId }).session(session);
    if (!order) throw fail('Không tìm thấy đơn.', 404);
    if (order.status !== 'pending' || order.total <= 0) throw fail('Đơn không thể thanh toán VNPay. Đơn 0đ dùng nút hoàn tất tại quầy.', 409);
    if (order.onlinePayment?.status !== 'created') {
      const quote = await quoteFoodPromotion(order, order.promotion?.code || '', session);
      if (quote.discount !== (order.promotionDiscount || 0) || quote.promotion?.ruleSignature !== order.promotion?.ruleSignature) throw fail('Mã đã thay đổi. Áp dụng lại mã trước khi thanh toán.', 409);
      order.onlinePayment = order.onlinePayment?.ref
        ? { ref: order.onlinePayment.ref, status: 'created', expiresAt: order.onlinePayment.expiresAt }
        : { ref: 'food-' + crypto.randomBytes(12).toString('hex'), status: 'created', expiresAt: new Date(Date.now() + 15 * 60000) };
      order.paymentMethod = 'vnpay';
      order.increment();
      await order.save({ session });
    }
    if (order.onlinePayment.expiresAt <= new Date()) throw fail('Liên kết đã hết hạn. Kiểm tra kết quả VNPay trước khi đổi phương thức hoặc tạo đơn mới.', 409);
    if (mobileReturnTo && order.onlinePayment.mobileReturnTo !== mobileReturnTo) {
      order.onlinePayment.mobileReturnTo = mobileReturnTo;
      await order.save({ session });
    }
    return order;
  });
  // Keep the configured public host; use a dedicated return endpoint for FoodSale.
  const returnUrl = new URL(process.env.VNPAY_RETURN_URL);
  returnUrl.pathname = '/api/food-sales/vnpay/return'; returnUrl.search = ''; returnUrl.hash = '';
  const params = { vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Amount: String(sale.total * 100), vnp_CurrCode: 'VND', vnp_TxnRef: sale.onlinePayment.ref,
    vnp_OrderInfo: 'Thanh toan F&B ' + sale._id, vnp_OrderType: 'other', vnp_Locale: 'vn',
    vnp_ReturnUrl: returnUrl.toString(), vnp_IpAddr: ip === '::1' ? '127.0.0.1' : String(ip).replace('::ffff:', ''),
    vnp_CreateDate: date(new Date(sale.onlinePayment.expiresAt.getTime() - 15 * 60000)), vnp_ExpireDate: date(sale.onlinePayment.expiresAt) };
  return { paymentUrl: (process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html') + '?' + canonical(params) + '&vnp_SecureHash=' + signature(params) };
}

export async function processFoodVnpay(params) {
  if (Object.values(params).some(value => typeof value !== 'string') || !/^[a-f0-9]{128}$/i.test(params.vnp_SecureHash || '') || !crypto.timingSafeEqual(Buffer.from(signature(params), 'hex'), Buffer.from(params.vnp_SecureHash, 'hex')) || params.vnp_TmnCode !== process.env.VNPAY_TMN_CODE) return { RspCode: '97', Message: 'Invalid signature' };
  const sale = await FoodSale.findOne({ 'onlinePayment.ref': params.vnp_TxnRef });
  if (!sale) return { RspCode: '01', Message: 'Order not found' };
  if (!/^\d+$/.test(params.vnp_Amount) || Number(params.vnp_Amount) !== sale.total * 100 || (params.vnp_CurrCode && params.vnp_CurrCode !== 'VND')) return { RspCode: '04', Message: 'Invalid amount' };
  if (['paid', 'returned'].includes(sale.status)) return { RspCode: '02', Message: 'Already confirmed' };
  if (params.vnp_ResponseCode !== '00' || params.vnp_TransactionStatus !== '00') {
    await FoodSale.updateOne({ _id: sale._id, status: 'pending', 'onlinePayment.status': 'created', 'onlinePayment.collectedAt': null }, { $set: { 'onlinePayment.status': 'failed' } });
    return { RspCode: '00', Message: 'Failure recorded' };
  }
  if (!params.vnp_TransactionNo || params.vnp_TransactionNo === '0' || (sale.onlinePayment.providerRef && sale.onlinePayment.providerRef !== params.vnp_TransactionNo)) return { RspCode: '99', Message: 'Invalid transaction reference' };
  // Retain verified collection evidence even if local stock/promotion settlement fails.
  await FoodSale.updateOne({ _id: sale._id, status: 'pending' }, { $set: { status: 'payment_received', paymentMethod: 'vnpay', 'onlinePayment.status': 'collected', 'onlinePayment.providerRef': params.vnp_TransactionNo, 'onlinePayment.collectedAt': new Date(), paymentConfirmedAt: new Date() } });
  try {
    await transaction(async session => {
      const order = await FoodSale.findById(sale._id).session(session);
      if (order.status === 'paid') return;
      if (!['payment_received', 'reconciliation'].includes(order.status) || order.paymentMethod !== 'vnpay' || order.onlinePayment.providerRef !== params.vnp_TransactionNo) throw fail('Đơn cần đối soát.', 409);
      await consumeFoodPromotion(order, session);
      for (const item of order.items) {
        const result = await Food.updateOne({ _id: item.food, available: true, deletedAt: null, price: item.unitPrice, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity, __v: 1 } }, { session });
        if (result.modifiedCount !== 1) throw fail('Đã thu VNPay nhưng giá hoặc kho thay đổi. Cần đối soát, không thu lại.', 409);
      }
      order.status = 'paid'; order.paidAt = new Date(); order.issue = undefined; order.onlinePayment.status = 'succeeded';
      await order.save({ session });
    });
    return { RspCode: '00', Message: 'Confirm Success' };
  } catch (error) {
    await FoodSale.updateOne({ _id: sale._id, status: 'payment_received' }, { $set: { status: 'reconciliation', issue: error.status ? error.message : 'Khoản VNPay cần đối soát.' } });
    return { RspCode: '99', Message: 'Recorded for reconciliation' };
  }
}
