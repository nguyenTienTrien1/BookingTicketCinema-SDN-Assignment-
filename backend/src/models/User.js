import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName:{type:String,required:true,trim:true},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  password:{type:String,required:true,minlength:6},
  phone:{type:String,default:''},
  age:{type:Number,min:0},
  gender:{type:String,enum:['Male','Female','Other'],default:'Other'},
  role:{type:String,enum:['member','employee','admin'],default:'member'},
  isVIP:{type:Boolean,default:false},
  memberPoints:{type:Number,default:0,min:0},
  status:{type:String,enum:['active','inactive','blocked'],default:'active'}
},{timestamps:true});
export default mongoose.model('User',userSchema);
