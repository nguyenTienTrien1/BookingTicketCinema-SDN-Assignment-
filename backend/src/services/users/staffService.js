import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from "../../models/users/User.js";
import {sendStaffInvitation} from "../email/emailService.js";
import {domainError as fail} from "../common/transaction.js";
export async function inviteStaff(data, actorId) {
 if(!data || !['employee','admin'].includes(data.role) || typeof data.fullName!=='string' || !data.fullName.trim() || data.fullName.length>100 || typeof data.email!=='string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))throw fail('Thông tin nhân sự hoặc role không hợp lệ.');
 const token=crypto.randomBytes(32).toString('hex');
 const user=await User.create({fullName:data.fullName.trim(),email:data.email.trim().toLowerCase(),phone:typeof data.phone==='string'?data.phone.trim():'',role:data.role,status:'Pending Activation',password:crypto.randomBytes(32).toString('hex'),staffActivationHash:crypto.createHash('sha256').update(token).digest('hex'),staffActivationExpires:new Date(Date.now()+86400000),createdBy:actorId});
 let delivery;try{delivery=await sendStaffInvitation({to:user.email,fullName:user.fullName,token});}catch{delivery={emailSent:false};}
 return {user:{_id:user._id,fullName:user.fullName,email:user.email,role:user.role,status:user.status},...delivery,activationLink:process.env.NODE_ENV==='production'?undefined:'/activate-staff?token='+token,message:delivery.emailSent?'Đã tạo nhân sự và gửi lời mời kích hoạt.':'Đã tạo nhân sự chờ kích hoạt; email chưa gửi được.'};
}
export async function activateStaff(token,password,confirmation) {
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<6||Buffer.byteLength(password,'utf8')>72||password!==confirmation)throw fail('Mã kích hoạt hoặc mật khẩu/xác nhận không hợp lệ.');
 const hash=await bcrypt.hash(password,10);
 const user=await User.findOneAndUpdate({staffActivationHash:crypto.createHash('sha256').update(token).digest('hex'),staffActivationExpires:{$gt:new Date()},status:'Pending Activation'},{$set:{password:hash,status:'Active'},$unset:{staffActivationHash:'',staffActivationExpires:''},$inc:{tokenVersion:1}},{new:true});
 if(!user)throw fail('Lời mời đã hết hạn, đã dùng hoặc tài khoản không được phép kích hoạt.');
 return {message:'Đã kích hoạt tài khoản. Vui lòng đăng nhập.'};
}

export async function resendStaffInvitation(id) {
 const token=crypto.randomBytes(32).toString('hex');const user=await User.findOneAndUpdate({_id:id,status:'Pending Activation'},{$set:{staffActivationHash:crypto.createHash('sha256').update(token).digest('hex'),staffActivationExpires:new Date(Date.now()+86400000)}},{new:true});if(!user)throw fail('Chỉ gửi lại lời mời cho tài khoản chờ kích hoạt.');
 let delivery;try{delivery=await sendStaffInvitation({to:user.email,fullName:user.fullName,token});}catch{delivery={emailSent:false};}
 return {...delivery,message:delivery.emailSent?'Đã gửi lại lời mời.':'Đã tạo lại lời mời; chưa gửi được email.',activationLink:process.env.NODE_ENV==='production'?undefined:'/activate-staff?token='+token};
}
