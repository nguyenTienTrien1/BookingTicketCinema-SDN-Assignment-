import mongoose from 'mongoose';
import { createStaffAccount, validateAccountFields } from './staffCredentialsService.js';
import SystemLock from '../models/SystemLock.js';
import {transaction,domainError as fail} from './transaction.js';
import User from '../models/User.js';
import { authenticate } from './auth/loginService.js';

export const createAccount = createStaffAccount;

export async function updateAccount(id, data, actorId) {
 if (!mongoose.isObjectIdOrHexString(id)) throw fail('Mã tài khoản không hợp lệ.');
 const fields = validateAccountFields(data);
 if (Object.keys(data).some(key => !['fullName','email','phone','role','status','version','expectedStatus'].includes(key))) throw fail('Thông tin cập nhật chứa trường không được phép.');
 if (!Number.isSafeInteger(data.version) || data.version < 0 || typeof data.expectedStatus !== 'string' || !['member','employee','admin'].includes(data.role) || !['Active','Deactivated','Banned','Pending Activation','Pending Verification'].includes(data.status)) throw fail('Vai trò, trạng thái hoặc phiên bản tài khoản không hợp lệ.');
 await SystemLock.updateOne({_id:'account-status'},{$setOnInsert:{version:0}},{upsert:true});
 return transaction(async session => {
  await SystemLock.updateOne({_id:'account-status'},{$inc:{version:1}},{session});
  const actor = await User.findOne({_id:actorId,role:'admin',status:{$in:['Active','active']}}).session(session);
  if (!actor) throw fail('Phiên Admin không còn hợp lệ.',403);
  const user = await User.findById(id).select('+staffActivationHash').session(session);
  if (!user) throw fail('Không tìm thấy tài khoản.',404);
  if ((user.__v || 0) !== data.version || user.status !== data.expectedStatus || user.credentialsEmailStatus === 'sending') throw fail('Tài khoản đã thay đổi hoặc đang gửi email. Tải lại rồi lưu lại thông tin.',409);
  if ((user.role === 'member') !== (data.role === 'member')) throw fail('Không chuyển đổi giữa tài khoản thành viên và tài khoản nhân sự.');
  if (String(id) === String(actorId) && (data.role !== 'admin' || data.status !== 'Active')) throw fail('Không được tự khóa hoặc hạ quyền Admin đang sử dụng.',403);
  if (data.status.startsWith('Pending') && data.status !== user.status) throw fail('Không thể tự đưa tài khoản vào trạng thái chờ xác minh.');
  if (data.status === 'Active' && (user.status.startsWith('Pending') || user.staffActivationHash || user.verificationToken || user.credentialsEmailStatus && user.credentialsEmailStatus !== 'sent')) throw fail('Tài khoản phải nhận email đăng nhập hoặc hoàn tất xác minh trước khi hoạt động.');
  if (user.role === 'admin' && ['Active','active'].includes(user.status) && (data.role !== 'admin' || data.status !== 'Active') && await User.countDocuments({role:'admin',status:{$in:['Active','active']}}).session(session) <= 1) throw fail('Không được khóa hoặc hạ quyền Admin cuối cùng.',409);
  const update = { $set: { ...fields, role:data.role, status:data.status, statusUpdatedBy:actorId }, $inc: { __v:1 } };
  if (data.role !== user.role || data.status !== user.status && data.status !== 'Active') update.$inc.tokenVersion = 1;
  if (data.status !== user.status) update.$push = { statusHistory: {before:user.status,after:data.status,actor:actorId,at:new Date()} };
  const updated = await User.findOneAndUpdate({_id:id,__v:user.__v},update,{new:true,runValidators:true,session});
  if (!updated) throw fail('Tài khoản vừa thay đổi. Hãy tải lại và thử lại.',409);
  return safeUser(updated);
 });
}

export async function login(email, password) {
  const result = await authenticate(email, password);
  return result.user;
}

export async function updateStatus(id,status,actorId,expectedStatus) {
 const aliases={active:'Active',inactive:'Deactivated',blocked:'Banned',Inactive:'Deactivated'};const target=aliases[status]||status;
 if(!['Active','Deactivated','Banned'].includes(target)||typeof expectedStatus!=='string')throw fail('Cần trạng thái hợp lệ và trạng thái gốc đã xem.');
 await SystemLock.updateOne({_id:'account-status'},{$setOnInsert:{version:0}},{upsert:true});
 return transaction(async session=>{
  await SystemLock.updateOne({_id:'account-status'},{$inc:{version:1}},{session});
  const actor=await User.findOne({_id:actorId,role:'admin',status:{$in:['Active','active']}}).session(session);if(!actor)throw fail('Phiên Admin không còn hợp lệ.',403);
  const user=await User.findById(id).select('+statusHistory +staffActivationHash').session(session);if(!user)return null;
  if(user.status!==expectedStatus)throw fail('Trạng thái đã thay đổi. Tải lại để xác nhận.',409);
  if(target!=='Active'&&String(id)===String(actorId))throw fail('Không được tự khóa Admin đang sử dụng.',403);
  if(target==='Active'&&(user.status.startsWith('Pending')||user.staffActivationHash||user.verificationToken||user.credentialsEmailStatus&&user.credentialsEmailStatus!=='sent'||user.statusHistory.some(h=>h.before?.startsWith('Pending'))))throw fail('Tài khoản phải hoàn tất kích hoạt, không thể bỏ qua bằng đổi trạng thái.');
  if(user.role==='admin'&&target!=='Active'&&['Active','active'].includes(user.status)&&await User.countDocuments({role:'admin',status:{$in:['Active','active']}}).session(session)<=1)throw fail('Không được khóa Admin cuối cùng.',409);
  if(user.status===target)return safeUser(user);
  const before=user.status;user.status=target;user.statusUpdatedBy=actorId;user.__v=(user.__v||0)+1;if(target!=='Active')user.tokenVersion=(user.tokenVersion||0)+1;
  user.statusHistory.push({before,after:target,actor:actorId,at:new Date()});await user.save({session});return safeUser(user);
 });
}

export async function adjustPoints(id, points, reason, actorId, requestId, expectedBalance) {
  if (!Number.isSafeInteger(points) || points === 0) {
    throw Object.assign(new Error('Số điểm điều chỉnh phải là số nguyên khác 0.'), { status: 400 });
  }
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
    throw Object.assign(new Error('Vui lòng nhập lý do điều chỉnh từ 5 đến 500 ký tự.'), { status: 400 });
  }
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId) || !actorId) {
    throw Object.assign(new Error('Thiếu mã yêu cầu điều chỉnh hợp lệ.'), { status: 400 });
  }
  // Retrying the same request must not change the balance twice.
  const existing = await User.findOne({ _id: id, 'pointAdjustments.requestId': requestId }).select('+pointAdjustments');
  if (existing) {
    const entry = existing.pointAdjustments.find(item => item.requestId === requestId);
    if (entry.delta !== points || entry.reason !== reason.trim() || String(entry.admin) !== String(actorId)) {
      throw Object.assign(new Error('Mã yêu cầu đã được sử dụng cho điều chỉnh khác.'), { status: 409 });
    }
    return safeUser(existing);
  }
  const user = await User.findById(id);
  if (!user) return null;
  if (user.role !== 'member') throw Object.assign(new Error('Chỉ được điều chỉnh điểm của Member.'), { status: 400 });
  if (expectedBalance !== undefined && expectedBalance !== user.memberPoints) {
    throw Object.assign(new Error('Số dư đã thay đổi. Vui lòng tải lại trước khi điều chỉnh.'), { status: 409 });
  }
  const afterUnits = Math.round(user.memberPoints * 1000) + points * 1000;
  const after = afterUnits / 1000;
  if (!Number.isSafeInteger(afterUnits) || after < 0) {
    throw Object.assign(new Error('Điều chỉnh làm số dư âm hoặc vượt giới hạn cho phép.'), { status: 400 });
  }
  // The balance and its audit record are written together in one atomic document update.
  const updated = await User.findOneAndUpdate(
    { _id: id, role: 'member', memberPoints: user.memberPoints, 'pointAdjustments.requestId': { $ne: requestId } },
    { $set: { memberPoints: after }, $push: { pointAdjustments: {
      requestId, delta: points, before: user.memberPoints, after, reason: reason.trim(), admin: actorId
    } } },
    { new: true, runValidators: true }
  );
  if (!updated) {
    const retried = await User.findOne({ _id: id, 'pointAdjustments.requestId': requestId });
    if (retried) return adjustPoints(id, points, reason, actorId, requestId, expectedBalance);
    throw Object.assign(new Error('Số dư vừa thay đổi. Vui lòng tải lại và thử lại.'), { status: 409 });
  }
  return safeUser(updated);
}

export async function pointHistory(id) {
  const user = await User.findById(id).select({ memberPoints: 1, role: 1, pointAdjustments: 1 })
    .populate('pointAdjustments.admin', 'fullName email');
  if (!user) return null;
  if (user.role !== 'member') throw Object.assign(new Error('Lịch sử điểm chỉ áp dụng cho Member.'), { status: 400 });
  return { balance: user.memberPoints, entries: user.pointAdjustments.slice(-20).reverse() };
}

export async function applyPoints(id, points) {
  const u = await User.findById(id);
  if (!u || u.memberPoints < points) return null;
  u.memberPoints -= points;
  await u.save();
  return u;
}

function safeUser(user) {
  const result = user.toObject();
  for (const field of [
    'password', 'verificationToken', 'verificationExpires', 'tokenVersion',
    'failedLoginAttempts', 'lockUntil', 'passwordResetTokenHash',
    'passwordResetExpiresAt', 'passwordResetUsedAt', 'passwordResetRequestedAt',
    'passwordResetTokenVersion', 'pointAdjustments', 'staffActivationHash',
    'staffActivationExpires', 'statusHistory', 'redemptionEntries', 'credentialsEmailRequestId'
  ]) delete result[field];
  return result;
}
