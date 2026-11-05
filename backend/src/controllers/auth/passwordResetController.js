import * as passwordResetService from '../../services/auth/passwordResetService.js';

export async function forgotPassword(req, res, next) {
  try {
    await passwordResetService.requestPasswordReset(req.body);
    return res.status(200).json({ success: true, message: passwordResetService.RESET_REQUEST_MESSAGE });
  } catch (error) {
    next(error);
  }
}

export async function verifyPasswordReset(req, res, next) {
  try {
    await passwordResetService.verifyPasswordResetToken(req.query.token);
    return res.status(200).json({ success: true, valid: true });
  } catch (error) {
    if (error.code === 'RESET_LINK_INVALID') {
      return res.status(400).json({ code: error.code, message: error.message });
    }
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await passwordResetService.resetPassword(req.body);
    return res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công.' });
  } catch (error) {
    if (error.code === 'RESET_LINK_INVALID') {
      return res.status(400).json({ code: error.code, message: error.message });
    }
    next(error);
  }
}
