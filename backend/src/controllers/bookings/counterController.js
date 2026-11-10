import mongoose from 'mongoose';
import User from "../../models/users/User.js";
import Booking from "../../models/bookings/Booking.js";
import * as bookings from "../../services/bookings/bookingService.js";
import { payStaffBooking } from "../../services/payments/counterPaymentService.js";
import { searchMembers as findMembers } from "../../services/users/memberService.js";

export async function searchMembers(req, res, next) {
  try {
    const { members } = await findMembers(req.query.search, 'employee');
    // Keep the existing counter response and restricted fields for every staff role.
    res.json(members.map(({ _id, fullName, email, phone, memberPoints, status }) =>
      ({ _id, fullName, email, phone, memberPoints, status })));
  } catch (error) { next(error); }
}

export async function create(req, res, next) {
  try {
    if (req.body.customerType !== undefined && !['guest', 'member'].includes(req.body.customerType)) {
      return res.status(400).json({ message: 'Loại khách hàng không hợp lệ.' });
    }
    const isGuest = req.body.customerType === 'guest' || (req.body.customerType !== 'member' && !req.body.memberId);
    if (isGuest) {
      const booking = await bookings.createBooking({ ...req.body, userId: null, counterEmployee: req.user._id });
      return res.status(201).json(booking);
    }
    if (!mongoose.isObjectIdOrHexString(req.body.memberId)) {
      return res.status(400).json({ message: 'Vui lòng chọn tài khoản thành viên của khách hàng.' });
    }
    const member = await User.findOne({ _id: req.body.memberId, role: 'member', status: { $in: ['Active', 'active'] } });
    if (!member) return res.status(404).json({ message: 'Không tìm thấy thành viên đang hoạt động.' });
    const booking = await bookings.createBooking({ ...req.body, userId: member._id, counterEmployee: req.user._id });
    res.status(201).json(booking);
  } catch (error) { next(error); }
}

async function ownedSale(req) {
  const actor = req.user.role === 'admin' ? { $ne: null } : req.user._id;
  return Booking.findOne({ _id: req.params.id, counterEmployee: actor });
}

export async function requestStatus(req, res, next) {
  try {
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(req.params.requestId)) return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    const booking = await Booking.findOne({ counterEmployee: req.user._id, counterRequestId: req.params.requestId }).select('_id');
    if (!booking) return res.status(404).json({ message: 'Chưa tìm thấy đơn của yêu cầu này. Có thể thử lại cùng mã yêu cầu.' });
    res.set('Cache-Control', 'no-store').json(await bookings.loadBooking(booking._id));
  } catch (error) { next(error); }
}

export async function points(req, res, next) {
  try {
    const sale = await ownedSale(req);
    if (!sale) return res.status(404).json({ message: 'Không tìm thấy đơn bán tại quầy của bạn.' });
    if (!sale.user) return res.status(400).json({ message: 'Khách vãng lai không sử dụng điểm Member.' });
    res.json(await bookings.applyMemberPoints(sale._id, sale.user, Number(req.body.points)));
  } catch (error) { next(error); }
}

export async function payment(req, res, next) {
  try {
    const result = await payStaffBooking(req.params.id, req.body, req.user._id, req.ip);
    res.status(result.status === 'pending' && result.cashReceived > 0 ? 202 : 200).json(result);
  } catch (error) { next(error); }
}

export async function promotion(req, res, next) {
  try {
    const sale = await ownedSale(req);
    if (!sale) return res.status(404).json({ message: 'Không tìm thấy đơn bán tại quầy của bạn.' });
    if (typeof req.body?.code !== 'string') return res.status(400).json({ message: 'Vui lòng gửi mã khuyến mãi; dùng chuỗi rỗng để bỏ mã.' });
    res.json(await bookings.applyCounterPromotion(sale._id, sale.user, req.body.code, req.body.replacePoints));
  } catch (error) { next(error); }
}

export async function food(req,res,next){try{const b=await ownedSale(req);if(!b)return res.status(404).json({message:'Không tìm thấy đơn.'});res.json(await bookings.updateFoods(b._id,b.user,req.body.foodItems));}catch(e){next(e);}}
export async function cancel(req,res,next){try{const b=await ownedSale(req);if(!b)return res.status(404).json({message:'Không tìm thấy đơn.'});res.json(await bookings.cancelBooking(b._id,b.user));}catch(e){next(e);}}
