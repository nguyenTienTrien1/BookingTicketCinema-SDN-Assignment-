import mongoose from 'mongoose';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import * as bookings from '../services/bookingService.js';
import { payStaffBooking } from '../services/counterPaymentService.js';

export async function searchMembers(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length < 3 || search.length > 100) {
      return res.status(400).json({ message: 'Nhập email hoặc số điện thoại từ 3 đến 100 ký tự.' });
    }
    const alternatives = [{ email: search.toLowerCase() }];
    if (/^[+\d\s().-]+$/.test(search)) {
      const digits = search.replace(/\D/g, '');
      if (digits.length >= 3 && digits.length <= 15) {
        const phonePattern = '^\\+?' + digits.split('').join('[\\s().-]*') + '$';
        alternatives.push({ phone: { $regex: phonePattern } });
      }
    }
    const members = await User.find({ role: 'member', $or: alternatives })
      .select('fullName email phone memberPoints status').limit(10);
    res.json(members);
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
    res.json(await bookings.applyCounterPromotion(sale._id, sale.user, req.body.code));
  } catch (error) { next(error); }
}

export async function food(req,res,next){try{const b=await ownedSale(req);if(!b)return res.status(404).json({message:'Không tìm thấy đơn.'});res.json(await bookings.updateFoods(b._id,b.user,req.body.foodItems));}catch(e){next(e);}}
export async function cancel(req,res,next){try{const b=await ownedSale(req);if(!b)return res.status(404).json({message:'Không tìm thấy đơn.'});res.json(await bookings.cancelBooking(b._id,b.user));}catch(e){next(e);}}
