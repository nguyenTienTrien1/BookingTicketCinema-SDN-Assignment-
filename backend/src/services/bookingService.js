import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';
import User from '../models/User.js';

export async function createBooking({userId,showtimeId,seats,foodItems=[]}){
  const st=await Showtime.findById(showtimeId); if(!st) throw Object.assign(new Error('Showtime not found'),{status:404});
  const now=new Date(); for(const s of st.seats){if(s.status==='held'&&s.holdUntil<now){s.status='available';s.holdUntil=null;}}
  for(const n of seats){const s=st.seats.find(x=>x.number===n);if(!s||s.status!=='available') throw Object.assign(new Error(`Seat ${n} is not available`),{status:409});}
  const foods=await Food.find({_id:{$in:foodItems.map(x=>x.food)}}); let foodTotal=0;
  const normalized=foodItems.map(x=>{const f=foods.find(y=>String(y._id)===String(x.food));if(!f) throw Object.assign(new Error('Food item not found'),{status:404});foodTotal+=f.price*x.quantity;return {food:f._id,quantity:x.quantity};});
  const subtotal=st.price*seats.length+foodTotal;
  const b=await Booking.create({user:userId,showtime:showtimeId,seats,foodItems:normalized,subtotal,total:subtotal,expiresAt:new Date(Date.now()+10*60*1000)});
  for(const n of seats){const s=st.seats.find(x=>x.number===n);s.status='held';s.holdUntil=b.expiresAt;s.bookingId=b._id;} await st.save();
  return b.populate([{path:'showtime',populate:{path:'movie'}},{path:'foodItems.food'},{path:'user'}]);
}
export async function applyMemberPoints(bookingId,userId,points){const b=await Booking.findOne({_id:bookingId,user:userId});if(!b) throw Object.assign(new Error('Booking not found'),{status:404});if(b.status!=='pending') throw Object.assign(new Error('Booking cannot be changed'),{status:400});const u=await User.findById(userId);if(!u||u.memberPoints<points) throw Object.assign(new Error('Not enough member points'),{status:400});b.pointsUsed=points;b.discount=points*1000;b.total=Math.max(0,b.subtotal-b.discount);await b.save();return b;}
export async function pay(bookingId,userId,method='mock'){const b=await Booking.findOne({_id:bookingId,user:userId});if(!b) throw Object.assign(new Error('Booking not found'),{status:404});if(b.status==='cancelled') throw Object.assign(new Error('Booking cancelled'),{status:400});const u=await User.findById(userId);if(b.pointsUsed){u.memberPoints-=b.pointsUsed;await u.save();}b.status='paid';b.paymentStatus='paid';b.paymentMethod=method;b.paymentRef='PAY-'+Date.now();await b.save();const st=await Showtime.findById(b.showtime);for(const n of b.seats){const s=st.seats.find(x=>x.number===n);if(s){s.status='booked';s.holdUntil=null;s.bookingId=b._id;}}await st.save();return b;
}
export const listBookings=userId=>Booking.find({user:userId}).populate([{path:'showtime',populate:{path:'movie'}},{path:'foodItems.food'}]).sort({createdAt:-1});
