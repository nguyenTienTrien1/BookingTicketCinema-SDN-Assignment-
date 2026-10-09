import mongoose from 'mongoose';
const movieSchema=new mongoose.Schema({title:{type:String,required:true},description:String,poster:String,banner:String,genre:[String],duration:{type:Number,default:120},ageLimit:{type:Number,default:0},rating:{type:Number,default:0},releaseDate:Date,featured:{type:Boolean,default:false}},{timestamps:true});
export default mongoose.model('Movie',movieSchema);
