import mongoose from 'mongoose';
export default mongoose.model('SystemLock', new mongoose.Schema({_id:String,version:{type:Number,default:0}}));
