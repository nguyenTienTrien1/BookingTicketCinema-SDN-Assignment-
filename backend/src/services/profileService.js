import User from '../models/User.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

// Explicit fields keep password hashes and verification tokens out of responses.
function profileData(user) {
  return {
    _id: user._id, fullName: user.fullName, email: user.email,
    phone: user.phone, age: user.age, gender: user.gender, role: user.role,
    memberPoints: user.memberPoints, isVIP: user.isVIP,
    status: user.status, createdAt: user.createdAt
  };
}

async function findMember(id) {
  const user = await User.findById(id);
  if (!user) {
    const error = new Error('Không tìm thấy tài khoản.');
    error.status = 404;
    throw error;
  }
  return user;
}

export async function getProfile(id) {
  return profileData(await findMember(id));
}

export async function updateProfile(id, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    badRequest('Thông tin hồ sơ không hợp lệ.');
  }
  const allowedFields = ['fullName', 'phone', 'age', 'gender'];
  const fields = Object.keys(data);
  if (fields.length === 0) badRequest('Vui lòng nhập thông tin cần cập nhật.');
  for (const field of fields) {
    if (!allowedFields.includes(field)) badRequest('Chỉ được cập nhật họ tên, số điện thoại, tuổi và giới tính.');
  }
  if (data.fullName !== undefined) {
    if (typeof data.fullName !== 'string' || !data.fullName.trim() || data.fullName.trim().length > 100) {
      badRequest('Họ tên phải có từ 1 đến 100 ký tự.');
    }
  }
  // Optional phone: 9–15 digits, optionally starting with +.
  if (data.phone !== undefined) {
    if (typeof data.phone !== 'string' || (data.phone.trim() !== '' && !/^\+?[0-9]{9,15}$/.test(data.phone.trim()))) {
      badRequest('Số điện thoại phải có từ 9 đến 15 chữ số, có thể bắt đầu bằng +.');
    }
  }
  if (data.age !== undefined && data.age !== null) {
    if (!Number.isInteger(data.age) || data.age < 0 || data.age > 120) {
      badRequest('Tuổi phải là số nguyên từ 0 đến 120.');
    }
  }
  if (data.gender !== undefined && !['Male', 'Female', 'Other'].includes(data.gender)) {
    badRequest('Giới tính không hợp lệ.');
  }
  const user = await findMember(id);
  if (data.fullName !== undefined) user.fullName = data.fullName.trim();
  if (data.phone !== undefined) user.phone = data.phone.trim();
  if (data.age !== undefined) user.age = data.age;
  if (data.gender !== undefined) user.gender = data.gender;
  await user.save();
  return profileData(user);
}
