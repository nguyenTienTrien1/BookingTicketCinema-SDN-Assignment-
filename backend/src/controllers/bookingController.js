import * as s from '../services/bookingService.js';
export async function create(req,res,next){try{res.status(201).json(await s.createBooking({ ...req.body, userId: req.user._id, counterEmployee: null }));}catch(e){next(e);}}
export async function points(req,res,next){try{res.json(await s.applyMemberPoints(req.params.id,req.user._id,Number(req.body.points)));}catch(e){next(e);}}
export async function payment(req,res,next){try{res.json(await s.pay(req.params.id,req.user._id,req.body.method));}catch(e){next(e);}}
export async function list(req, res, next) {
 try {
  const bookings = await s.listBookings(req.user._id);
  res.set('Cache-Control', 'no-store').json(bookings);
 } catch (error) { next(error); }
}

export async function view(req,res,next){try{const b=await s.loadBooking(req.params.id);if(!b||String(b.user?._id)!==String(req.user._id))return res.status(404).json({message:'Không tìm thấy đơn.'});res.json(b);}catch(e){next(e);}}
export async function food(req,res,next){try{res.json(await s.updateFoods(req.params.id,req.user._id,req.body.foodItems));}catch(e){next(e);}}
export async function cancel(req,res,next){try{res.json(await s.cancelBooking(req.params.id,req.user._id));}catch(e){next(e);}}
