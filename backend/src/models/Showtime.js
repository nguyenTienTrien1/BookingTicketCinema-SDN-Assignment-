import mongoose from 'mongoose';
const showtimeSchema=new mongoose.Schema({movie:{type:mongoose.Schema.Types.ObjectId,ref:'Movie',required:true},cinema:{type:String,required:true},room:{type:String,required:true},startTime:{type:Date,required:true},price:{type:Number,required:true},seats:[{number:String,status:{type:String,enum:['available','held','booked'],default:'available'},holdUntil:Date,bookingId:{type:mongoose.Schema.Types.ObjectId,ref:'Booking'}}]},{timestamps:true});
export default mongoose.model('Showtime',showtimeSchema);
