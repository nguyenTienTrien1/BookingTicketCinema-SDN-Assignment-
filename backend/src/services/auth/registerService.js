import crypto from 'crypto';
import User from '../../models/User.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * UC-1: Register Member Account
 * Enforces BR-1 (Password Hashing) & BR-8 (Pending Verification & 24h single-use token)
 */
export async function registerMember(data) {
  const { fullName, email, password, phone } = data;

  // 1. Validation
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    const error = new Error('Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).');
    error.status = 400;
    throw error;
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    const error = new Error('Địa chỉ email không hợp lệ.');
    error.status = 400;
    throw error;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const error = new Error('Mật khẩu phải có tối thiểu 6 ký tự.');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 2. Check duplicate email (UC-1 Exception E1)
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.status === 'Pending Verification') {
      // If pending verification, generate a new token and offer activation per BR-8
      const token = crypto.randomBytes(32).toString('hex');
      existingUser.verificationToken = token;
      existingUser.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await existingUser.save();

      console.log(`[AUTH AUDIT] Re-issued verification token for existing pending account: ${normalizedEmail}`);
      return {
        message: 'Tài khoản này đang chờ xác thực email. Liên kết kích hoạt mới đã được tạo.',
        isPending: true,
        verificationToken: token,
        verificationLink: `/verify-email?token=${token}`
      };
    }

    const error = new Error('Email này đã được sử dụng để đăng ký tài khoản.');
    error.status = 409;
    throw error;
  }

  // 3. Generate 24-hour single-use verification token (BR-8)
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 4. Create new Member with 'Pending Verification' status (BR-8)
  const newUser = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    password: password, // Pre-save hook hashes with bcrypt (BR-1)
    phone: phone ? phone.trim() : '',
    role: 'member',
    status: 'Pending Verification',
    verificationToken,
    verificationExpires
  });

  console.log(`[AUTH AUDIT] New member registered: email=${normalizedEmail}, status=Pending Verification`);

  const verificationLink = `/verify-email?token=${verificationToken}`;

  return {
    message: 'Đăng ký tài khoản thành công! Vui lòng xác thực email để kích hoạt tài khoản.',
    user: {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status
    },
    verificationToken,
    verificationLink
  };
}

/**
 * UC-1: Verify Email and activate Member account (BR-8)
 */
export async function verifyEmail(token) {
  if (!token || typeof token !== 'string') {
    const error = new Error('Mã xác thực không hợp lệ hoặc thiếu.');
    error.status = 400;
    throw error;
  }

  // Find user by verification token
  const user = await User.findOne({ verificationToken: token.trim() });

  if (!user) {
    const error = new Error('Mã xác thực không tồn tại hoặc đã được sử dụng.');
    error.status = 400;
    throw error;
  }

  // Check if token has expired (> 24 hours) - UC-1 Exception E3 & BR-8
  if (user.verificationExpires && user.verificationExpires < new Date()) {
    console.log(`[AUTH AUDIT] Verification token expired for email=${user.email}`);
    const error = new Error('Mã xác thực đã hết hạn (quá 24 giờ). Vui lòng yêu cầu gửi lại mã mới.');
    error.status = 400;
    throw error;
  }

  // Activate account (BR-8: Single-use activation)
  user.status = 'Active';
  user.verificationToken = null;
  user.verificationExpires = null;
  await user.save();

  console.log(`[AUTH AUDIT] Account verified and activated: email=${user.email}`);

  return {
    success: true,
    message: 'Kích hoạt tài khoản thành viên thành công! Bạn có thể đăng nhập ngay bây giờ.',
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status
    }
  };
}

/**
 * Resend verification email for Pending Verification account (BR-8)
 */
export async function resendVerification(email) {
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    const error = new Error('Địa chỉ email không hợp lệ.');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const error = new Error('Không tìm thấy tài khoản với email này.');
    error.status = 404;
    throw error;
  }

  if (user.status === 'Active') {
    return {
      success: true,
      message: 'Tài khoản này đã được kích hoạt trước đó. Bạn có thể đăng nhập.'
    };
  }

  if (user.status !== 'Pending Verification') {
    const error = new Error('Tài khoản này không ở trạng thái chờ kích hoạt.');
    error.status = 400;
    throw error;
  }

  // Generate new token valid for 24h
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.verificationToken = verificationToken;
  user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  console.log(`[AUTH AUDIT] Resent verification token for email=${normalizedEmail}`);

  return {
    success: true,
    message: 'Liên kết xác thực mới đã được tạo thành công.',
    verificationToken,
    verificationLink: `/verify-email?token=${verificationToken}`
  };
}

