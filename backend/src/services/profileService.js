import User from '../models/User.js';

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
