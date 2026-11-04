import crypto from 'node:crypto';
import Booking from '../models/Booking.js';
import PaymentAttempt from '../models/PaymentAttempt.js';
import { settle, loadBooking } from './bookingService.js';
import { transaction, domainError as fail } from './transaction.js';
export function canonical(params) {
 return Object.keys(params).filter(k => k.startsWith('vnp_') && !['vnp_SecureHash','vnp_SecureHashType'].includes(k)).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]).replace(/%20/g, '+')).join('&');
}
export function signature(params, secret = process.env.VNPAY_HASH_SECRET) { if (!secret) throw fail('Chưa cấu hình VNPay sandbox.', 503); return crypto.createHmac('sha512', secret).update(canonical(params)).digest('hex'); }
function date(value) { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(value); const get = key => p.find(x => x.type === key).value; return ['year','month','day','hour','minute','second'].map(get).join(''); }
export async function createPayment(bookingId, userId, ip) {
 if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET || !process.env.VNPAY_RETURN_URL) throw fail('Cần cấu hình VNPAY_TMN_CODE, VNPAY_HASH_SECRET và VNPAY_RETURN_URL trong backend/.env.', 503);
 const attempt = await transaction(async session => {
  const b = await Booking.findOne({ _id: bookingId, user: userId }).session(session); if (!b || b.status !== 'pending' || b.expiresAt <= new Date()) throw fail('Đơn không còn hiệu lực.', 410);
  if (b.total <= 0) throw fail('Đơn 0đ phải dùng thanh toán bằng điểm.');
  if (b.activePayment) { const a = await PaymentAttempt.findOne({ ref: b.activePayment, status: 'created' }).session(session); if (a) return a; }
  const a = new PaymentAttempt({ ref: crypto.randomBytes(12).toString('hex'), booking: b._id, amount: b.total, method: 'vnpay', expiresAt: b.expiresAt });
  await a.save({session}); b.activePayment = a.ref; await b.save({session}); return a;
 });
 const params = { vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:process.env.VNPAY_TMN_CODE,vnp_Amount:String(attempt.amount * 100),vnp_CurrCode:'VND',vnp_TxnRef:attempt.ref,vnp_OrderInfo:'Thanh toan ve ' + bookingId,vnp_OrderType:'other',vnp_Locale:'vn',vnp_ReturnUrl:process.env.VNPAY_RETURN_URL,vnp_IpAddr:ip === '::1' ? '127.0.0.1' : String(ip).replace('::ffff:',''),vnp_CreateDate:date(attempt.createdAt),vnp_ExpireDate:date(attempt.expiresAt) };
 return { paymentUrl:(process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html') + '?' + canonical(params) + '&vnp_SecureHash=' + signature(params), reference:attempt.ref };
}
export async function processIPN(params) {
 if (Object.values(params).some(value => typeof value !== 'string') || !/^[a-f0-9]{128}$/i.test(params.vnp_SecureHash || '')) return { RspCode:'97', Message:'Invalid signature' };
 const expected = signature(params); if (!crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(params.vnp_SecureHash,'hex'))) return { RspCode:'97', Message:'Invalid signature' };
 if (params.vnp_TmnCode !== process.env.VNPAY_TMN_CODE) return { RspCode:'97', Message:'Merchant mismatch' };
 const attempt = await PaymentAttempt.findOne({ ref:params.vnp_TxnRef, method:'vnpay' }); if (!attempt) return { RspCode:'01', Message:'Order not found' };
 if (!/^\d+$/.test(params.vnp_Amount) || Number(params.vnp_Amount) !== attempt.amount * 100 || (params.vnp_CurrCode && params.vnp_CurrCode !== 'VND')) return { RspCode:'04', Message:'Invalid amount' };
 if (attempt.status === 'succeeded') return { RspCode:'02', Message:'Already confirmed' };
 if (params.vnp_ResponseCode !== '00' || params.vnp_TransactionStatus !== '00') {
  await transaction(async session => { const a=await PaymentAttempt.findOne({ref:attempt.ref,status:'created'}).session(session); if(!a)return; a.status='failed';a.responseCode=params.vnp_ResponseCode;await a.save({session}); await Booking.updateOne({_id:a.booking,activePayment:a.ref,status:'pending'},{$set:{activePayment:null}},{session}); });
  return { RspCode:'00', Message:'Failure recorded' };
 }
 if (!params.vnp_TransactionNo || params.vnp_TransactionNo === '0') return { RspCode:'99', Message:'Missing transaction reference' };
 try { await settle(attempt.booking,{kind:'vnpay',ref:attempt.ref,verified:true,providerRef:params.vnp_TransactionNo}); return { RspCode:'00', Message:'Confirm Success' }; }
 catch (error) { await PaymentAttempt.updateOne({ref:attempt.ref,status:{$ne:'succeeded'}},{$set:{status:'unresolved',providerRef:params.vnp_TransactionNo,message:error.message}}); return { RspCode:'99', Message:'Recorded for reconciliation' }; }
}
