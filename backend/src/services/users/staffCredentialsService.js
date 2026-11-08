import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from "../../models/users/User.js";
import { sendStaffCredentials } from "../email/emailService.js";
import { domainError as fail } from "../common/transaction.js";

// Kiểm tra họ tên, email, điện thoại; chuẩn hóa email chữ thường và bỏ khoảng trắng thừa.
export function validateAccountFields(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail('Thông tin tài khoản không hợp lệ.');
  if (typeof data.fullName !== 'string' || !data.fullName.trim() || data.fullName.trim().length > 100) throw fail('Họ tên phải từ 1 đến 100 ký tự.');
  if (typeof data.email !== 'string' || data.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) throw fail('Địa chỉ email không hợp lệ.');
  if (data.phone !== undefined && (typeof data.phone !== 'string' || (data.phone.trim() && !/^\+?\d{9,15}$/.test(data.phone.trim())))) throw fail('Số điện thoại phải có từ 9 đến 15 chữ số, có thể bắt đầu bằng +.');
  return { fullName: data.fullName.trim(), email: data.email.trim().toLowerCase(), phone: (data.phone || '').trim() };
}

// Chỉ trả thông tin tài khoản cần thiết, không trả mật khẩu hoặc mã xử lý email nội bộ.
export function accountSummary(user) {
  return { _id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, status: user.status,
    credentialsEmailStatus: user.credentialsEmailStatus, credentialsEmailSentAt: user.credentialsEmailSentAt, __v: user.__v, createdAt: user.createdAt };
}

// Sinh mật khẩu riêng cho mỗi lần tạo/gửi lại bằng bộ sinh ngẫu nhiên bảo mật.
const newPassword = () => 'Aa1!' + crypto.randomBytes(18).toString('base64url');

// Gửi email đăng nhập: SMTP chấp nhận thì kích hoạt tài khoản; lỗi thì giữ chờ gửi lại.
async function deliver(user, password, requestId) {
  try {
    await sendStaffCredentials({ to: user.email, fullName: user.fullName, password });
  } catch {
    await User.updateOne({ _id: user._id, credentialsEmailRequestId: requestId }, { $set: { credentialsEmailStatus: 'failed' }, $unset: { credentialsEmailRequestId: '' }, $inc: { __v: 1 } });
    const latest = await User.findById(user._id);
    return { user: accountSummary(latest), emailSent: false, message: 'Đã lưu tài khoản nhưng chưa gửi được email. Kiểm tra cấu hình SMTP và dùng Gửi lại email. Tài khoản chưa được phép đăng nhập.' };
  }
  const updated = await User.findOneAndUpdate({ _id: user._id, status: 'Pending Activation', credentialsEmailRequestId: requestId }, {
    $set: { status: 'Active', credentialsEmailStatus: 'sent', credentialsEmailSentAt: new Date() },
    $unset: { credentialsEmailRequestId: '', staffActivationHash: '', staffActivationExpires: '' }, $inc: { __v: 1 }
  }, { new: true });
  if (!updated) throw fail('Email đã gửi nhưng tài khoản vừa thay đổi. Hãy tải lại để kiểm tra trạng thái.', 409);
  return { user: accountSummary(updated), emailSent: true, message: 'Đã tạo tài khoản và gửi mật khẩu ngẫu nhiên tới email. Nhân sự có thể đăng nhập ngay.' };
}

// Tạo employee/admin ở trạng thái chờ, sinh mật khẩu và gửi email; không nhận mật khẩu từ form.
export async function createStaffAccount(data, actorId) {
  const fields = validateAccountFields(data);
  if (!['employee', 'admin'].includes(data.role)) throw fail('Chỉ tạo tài khoản Nhân viên hoặc Quản trị viên.');
  if (Object.keys(data).some(key => !['fullName', 'email', 'phone', 'role'].includes(key))) throw fail('Chỉ nhập họ tên, email, điện thoại và vai trò; mật khẩu do hệ thống tạo.');
  const password = newPassword(), requestId = crypto.randomUUID();
  // Hook trước khi lưu của User băm mật khẩu bằng bcrypt; database không lưu mật khẩu rõ.
  const user = await User.create({ ...fields, role: data.role, password, status: 'Pending Activation', createdBy: actorId,
    credentialsEmailStatus: 'sending', credentialsEmailAttemptAt: new Date(), credentialsEmailRequestId: requestId });
  return deliver(user, password, requestId);
}

// Chỉ gửi lại cho nhân sự đang chờ: tạo mật khẩu mới và chặn các lần gửi đồng thời.
export async function resendStaffCredentials(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw fail('Mã tài khoản không hợp lệ.');
  const password = newPassword(), requestId = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate({ _id: id, role: { $in: ['admin', 'employee'] }, status: 'Pending Activation',
    $or: [{ credentialsEmailStatus: { $ne: 'sending' } }, { credentialsEmailAttemptAt: { $lt: new Date(Date.now() - 60000) } }] }, {
    $set: { password: hash, credentialsEmailStatus: 'sending', credentialsEmailAttemptAt: new Date(), credentialsEmailRequestId: requestId },
    $unset: { staffActivationHash: '', staffActivationExpires: '' }, $inc: { tokenVersion: 1, __v: 1 }
  }, { new: true });
  if (!user) throw fail('Chỉ gửi lại cho nhân sự đang chờ email; yêu cầu trước có thể vẫn đang xử lý.', 409);
  return deliver(user, password, requestId);
}
