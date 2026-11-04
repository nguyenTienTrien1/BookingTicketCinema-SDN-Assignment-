import mongoose from 'mongoose';
const foodSchema=new mongoose.Schema({name:{type:String,required:true},description:String,image:String,price:{type:Number,required:true},available:{type:Boolean,default:true},stock:{type:Number,default:0,min:0}});
export default mongoose.model('Food',foodSchema);
