import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Food from '../models/Food.js';
import PaymentAttempt from '../models/PaymentAttempt.js';
import PointRefund from '../models/PointRefund.js';
import { settle, loadBooking, simulationFailure } from '../services/bookingService.js';
import { createPayment, processIPN } from '../services/vnpayService.js';
import { domainError as fail } from '../services/transaction.js';
import { payStaffBooking, listReconciliation, reconcilePayment } from '../services/counterPaymentService.js';
export async function result(req,res,next) { try {
 const attempt = await PaymentAttempt.findOne({ref:req.params.reference,method:'vnpay'});
 if(!attempt)throw fail('Không tìm thấy giao dịch.',404);
 const filter = { _id: attempt.booking };
 if (req.user.role === 'member') filter.user = req.user._id;
 const booking = await Booking.findOne(filter);
 if(!booking)throw fail('Không tìm thấy giao dịch.',404);
 const refund = await PointRefund.findOne({ reference: attempt.ref, booking: booking._id }).select('reference kind status rate amount points completedAt').lean();
 res.set('Cache-Control', 'no-store').json({status:attempt.status,booking:await loadBooking(booking._id),refund});
 }catch(e){next(e);} }
export async function start(req,res,next) { try {
 const b=await Booking.findOne({_id:req.params.id,user:req.user._id});if(!b)throw fail('Không tìm thấy đơn.',404);
 if(b.status==='paid')return res.json(await loadBooking(b._id));
 if(req.body.method==='demo'&&req.body.result==='failed')return res.json(await simulationFailure(b._id));
 if(req.body.method==='demo')return res.json(await settle(b._id,{kind:b.total===0?'points':'demo'}));
 if(req.body.method==='points')return res.json(await settle(b._id,{kind:'points'}));
 if(req.body.method==='cash'){
  if(b.status!=='pending'||b.expiresAt<=new Date())throw fail('Đơn đã hủy hoặc hết hạn.',410);
  if(b.activePayment)throw fail('Đơn đang chờ kết quả VNPay. Chưa thể chuyển sang tiền mặt.',409);
  return res.json({status:'pending',message:'Mang mã đơn tới quầy trước khi hết hạn.',booking:await loadBooking(b._id)});
 }
 if(req.body.method!=='vnpay')throw fail('Chọn thanh toán giả lập hoặc phương thức hợp lệ.');
 res.json(await createPayment(b._id,req.user._id,req.ip));
 }catch(e){next(e);} }
export async function cash(req,res,next) { try {
 if (req.body.method && !['cash', 'demo', 'points'].includes(req.body.method)) throw fail('Dùng chức năng thanh toán để chọn VNPay.');
 const result = await payStaffBooking(req.params.id, req.body, req.user._id, req.ip);
 res.status(result.status === 'pending' && result.cashReceived > 0 ? 202 : 200).json(result);
 }catch(e){next(e);} }
export async function staffPay(req, res, next) {
 try {
  const result = await payStaffBooking(req.params.id, req.body, req.user._id, req.ip);
  res.status(result.status === 'pending' && result.cashReceived > 0 ? 202 : 200).json(result);
 } catch (error) { next(error); }
}
export async function ipn(req,res) { try { res.json(await processIPN(req.query)); } catch {res.json({RspCode:'99',Message:'Retry later'});} }
export async function returnUrl(req,res) { const url=new URL('/payment-result',process.env.CLIENT_URL||process.env.FRONTEND_URL||'http://localhost:5173'); if(typeof req.query.vnp_TxnRef==='string')url.searchParams.set('reference',req.query.vnp_TxnRef); res.redirect(url.toString()); }
export async function reconciliation(req, res, next) {
 try { res.set('Cache-Control', 'no-store').json(await listReconciliation()); }
 catch (error) { next(error); }
}
export async function resolvePayment(req, res, next) {
 try { res.json(await reconcilePayment(req.params.reference, req.body, req.user._id)); }
 catch (error) { next(error); }
}
export async function verifyAge(req,res,next){try{if(!Number.isInteger(req.body.age)||req.body.age<0||req.body.age>120)throw fail('Tuổi không hợp lệ.');const u=await User.findOneAndUpdate({_id:req.params.id,role:'member'},{$set:{verifiedAge:req.body.age,ageVerifiedBy:req.user._id}},{new:true}).select('fullName verifiedAge');if(!u)throw fail('Không tìm thấy Member.',404);res.json(u);}catch(e){next(e);}}
export async function lookup(req,res,next){try{const b=await loadBooking(req.params.id);if(!b)throw fail('Không tìm thấy đơn.',404);res.set('Cache-Control','no-store').json(b);}catch(e){next(e);}}

export async function stock(req,res,next){try{if(req.method==='GET')return res.json(await Food.find());if(!Number.isSafeInteger(req.body.stock)||req.body.stock<0)throw fail('Tồn kho phải là số nguyên không âm.');const food=await Food.findOneAndUpdate({_id:req.params.id,...(req.body.expectedStock===0?{$or:[{stock:0},{stock:{$exists:false}}]}:{stock:req.body.expectedStock})},{$set:{stock:req.body.stock}},{new:true});if(!food)throw fail('Tồn kho đã thay đổi. Tải lại trước khi sửa.',409);res.json(food);}catch(e){next(e);}}

export async function ticket(req,res,next){try{const booking=await Booking.findOne({'tickets.code':req.params.code}).populate({path:'showtime',populate:{path:'movie'}});if(!booking)throw fail('Mã vé không tồn tại.',404);const ticket=booking.tickets.find(t=>t.code===req.params.code);res.json({booking:booking._id,status:booking.status,ticket,showtime:booking.showtime});}catch(e){next(e);}}
