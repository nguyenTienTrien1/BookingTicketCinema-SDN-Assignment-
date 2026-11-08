import crypto from 'crypto';
import User from "../../models/users/User.js";
import { sendVerificationEmail } from '../email/emailService.js';

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

  if (!password || typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    const error = new Error('Mật khẩu phải có tối thiểu 6 ký tự.');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 2. Check duplicate email (UC-1 Exception E1)
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.status === 'Pending Verification') {
      // If pending verification, generate a new token and send verification email (BR-8)
      const token = crypto.randomBytes(32).toString('hex');
      existingUser.verificationToken = token;
      existingUser.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await existingUser.save();

      console.log(`[AUTH AUDIT] Re-issued verification token for existing pending account: ${normalizedEmail}`);

      let emailResult = null;
      try {
        emailResult = await sendVerificationEmail({
          to: normalizedEmail,
          fullName: existingUser.fullName,
          token
        });
      } catch (err) {
        console.warn(`[AUTH AUDIT] Warning: Email delivery failed for ${normalizedEmail} (Exception E2):`, err.message);
      }

      return {
        message: 'Tài khoản này đang chờ kích hoạt. Email xác thực mới đã được gửi.',
        isPending: true,
        verificationToken: token,
        verificationLink: `/verify-email?token=${token}`,
        emailSent: !!emailResult,
        previewUrl: emailResult?.previewUrl || null
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
    phone: typeof phone === 'string' ? phone.trim() : '',
    role: 'member',
    status: 'Pending Verification',
    verificationToken,
    verificationExpires
  });

  console.log(`[AUTH AUDIT] New member registered: email=${normalizedEmail}, status=Pending Verification`);

  // 5. Send verification email (UC-1 Step 4 & Exception E2)
  let emailResult = null;
  let deliveryWarning = null;

  try {
    emailResult = await sendVerificationEmail({
      to: normalizedEmail,
      fullName: newUser.fullName,
      token: verificationToken
    });
  } catch (emailErr) {
    // UC-1 Exception E2: System keeps the account Pending Verification and reports delivery failure
    console.error(`[AUTH AUDIT] Verification email delivery failure for ${normalizedEmail}:`, emailErr.message);
    deliveryWarning = 'Không thể gửi email xác thực. Bạn có thể sử dụng liên kết kích hoạt trực tiếp bên dưới.';
  }

  const verificationLink = `/verify-email?token=${verificationToken}`;

  return {
    message: deliveryWarning || 'Đăng ký tài khoản thành công! Vui lòng kiểm tra hộp thư email để kích hoạt tài khoản.',
    user: {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status
    },
    verificationToken,
    verificationLink,
    emailSent: !!emailResult,
    previewUrl: emailResult?.previewUrl || null
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
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
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

  let emailResult = null;
  try {
    emailResult = await sendVerificationEmail({
      to: normalizedEmail,
      fullName: user.fullName,
      token: verificationToken
    });
  } catch (err) {
    console.warn(`[AUTH AUDIT] Warning: Resend email delivery failed for ${normalizedEmail}:`, err.message);
  }

  return {
    success: true,
    message: 'Liên kết xác thực mới đã được gửi vào hộp thư email của bạn.',
    verificationToken,
    verificationLink: `/verify-email?token=${verificationToken}`,
    emailSent: !!emailResult,
    previewUrl: emailResult?.previewUrl || null
  };
}

