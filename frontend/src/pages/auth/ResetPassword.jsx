import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LoginInput from '../../components/auth/LoginInput';
import PasswordRecoveryLayout from '../../components/auth/PasswordRecoveryLayout';
import { validatePasswordResetToken, resetPassword } from '../../services/auth/authService';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokens = searchParams.getAll('token');
  const token = tokens.length === 1 ? tokens[0] : '';
  // A different email link starts a fresh form and discards the previous password.
  return <ResetPasswordForm key={token} token={token} />;
}

function ResetPasswordForm({ token }) {
  const [status, setStatus] = useState(token.trim() ? 'validating' : 'invalid');
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const alertRef = useRef(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!token.trim()) return;
    let active = true;

    async function checkToken() {
      try {
        const valid = await validatePasswordResetToken(token);
        if (active) setStatus(valid === true ? 'ready' : 'invalid');
      } catch (error) {
        if (!active) return;
        if (error.code === 'RESET_LINK_INVALID') {
          setStatus('invalid');
        } else {
          setStatus('verification-error');
          setMessage(error.code === 'PASSWORD_RECOVERY_UNAVAILABLE'
            ? error.message
            : 'Không thể kiểm tra liên kết. Vui lòng kiểm tra kết nối và thử lại.');
        }
      }
    }

    checkToken();
    return () => { active = false; };
  }, [token, attempt]);

  useEffect(() => {
    if (status !== 'ready' && status !== 'submitting' && status !== 'validating') alertRef.current?.focus();
    if (focusRequest > 0 && status === 'ready') alertRef.current?.focus();
  }, [status, focusRequest]);

  function validatePasswords() {
    const nextErrors = {};
    // Match the existing change-password policy, including bcrypt's byte limit.
    if (password.length < 6 || !password.trim()) {
      nextErrors.password = 'Mật khẩu mới cần ít nhất 6 ký tự và không chỉ chứa khoảng trắng.';
    } else if (new TextEncoder().encode(password).length > 72) {
      nextErrors.password = 'Mật khẩu mới không được vượt quá 72 byte UTF-8. Ký tự có dấu có thể chiếm nhiều byte.';
    }
    if (!confirmation) nextErrors.confirmation = 'Vui lòng nhập lại mật khẩu mới.';
    else if (password !== confirmation) nextErrors.confirmation = 'Xác nhận mật khẩu mới không khớp.';
    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current || (status !== 'ready' && status !== 'reset-error')) return;
    const nextErrors = validatePasswords();
    setErrors(nextErrors);
    setMessage('');
    if (nextErrors.password || nextErrors.confirmation) {
      setStatus('ready');
      setFocusRequest(focusRequest + 1);
      return;
    }

    submittingRef.current = true;
    setStatus('submitting');
    try {
      // Backend must revalidate and consume the token atomically with the update.
      const confirmed = await resetPassword(token, password, confirmation);
      if (confirmed !== true) throw new Error('Unconfirmed reset');
      if (!mountedRef.current) return;
      setPassword('');
      setConfirmation('');
      setStatus('success');
    } catch (error) {
      if (!mountedRef.current) return;
      if (error.code === 'RESET_LINK_INVALID') {
        setPassword('');
        setConfirmation('');
        setStatus('invalid');
      } else {
        setStatus('reset-error');
        setMessage(error.code === 'PASSWORD_RECOVERY_UNAVAILABLE'
          ? error.message
          : 'Chưa thể đặt lại mật khẩu. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function focusField(event, id) {
    event.preventDefault();
    document.getElementById(id).focus();
  }

  return (
    <PasswordRecoveryLayout title="Đặt lại mật khẩu" description="Tạo mật khẩu mới để đăng nhập lại vào CINEMA+.">
      {status === 'validating' && (
        <p className="recoveryNote recoveryChecking" role="status" aria-busy="true">Đang kiểm tra liên kết đặt lại mật khẩu...</p>
      )}

      {status === 'invalid' && (
        <div className="recoveryResult" ref={alertRef} tabIndex={-1}>
          <div className="cinemaAlert cinemaAlertError recoveryAlert" role="alert">
            <h2 className="recoveryStateHeading">Liên kết không còn hợp lệ</h2>
            <p>Liên kết có thể bị thiếu mã, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu một liên kết mới.</p>
          </div>
          <Link to="/forgot-password" className="cinemaBtnSubmit verifyNowBtn">Yêu cầu liên kết mới</Link>
        </div>
      )}

      {status === 'verification-error' && (
        <div className="recoveryResult" ref={alertRef} tabIndex={-1}>
          <div className="cinemaAlert cinemaAlertError recoveryAlert" role="alert">
            <h2 className="recoveryStateHeading">Chưa thể kiểm tra liên kết</h2>
            <p>{message}</p>
          </div>
          <button type="button" className="cinemaBtnSubmit" onClick={() => { setStatus('validating'); setAttempt(attempt + 1); }}>Thử lại</button>
          <Link to="/forgot-password" className="forgotPasswordLink recoverySecondaryLink">Yêu cầu liên kết mới</Link>
        </div>
      )}

      {status === 'success' && (
        <div className="recoveryResult" ref={alertRef} tabIndex={-1} role="status">
          <h2 className="successTitle">Đã đặt lại mật khẩu</h2>
          <p className="successDesc">Mật khẩu mới đã được cập nhật. Bạn có thể quay lại đăng nhập.</p>
          <Link to="/login" className="cinemaBtnSubmit verifyNowBtn">Đăng nhập</Link>
        </div>
      )}

      {(status === 'ready' || status === 'submitting' || status === 'reset-error') && (
        <form className="cinemaAuthForm" noValidate onSubmit={handleSubmit} aria-busy={status === 'submitting'}>
          {(errors.password || errors.confirmation || message) && (
            <div className="cinemaAlert cinemaAlertError recoveryAlert" role="alert" ref={alertRef} tabIndex={-1}>
              {message && <p>{message}</p>}
              {(errors.password || errors.confirmation) && <p>Vui lòng kiểm tra thông tin bên dưới:</p>}
              {errors.password && <a href="#reset-password" onClick={(event) => focusField(event, 'reset-password')}>{errors.password}</a>}
              {errors.confirmation && <a href="#reset-confirmation" onClick={(event) => focusField(event, 'reset-confirmation')}>{errors.confirmation}</a>}
            </div>
          )}
          <LoginInput id="reset-password" label="Mật khẩu mới" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
            placeholder="Nhập mật khẩu mới" value={password} disabled={status === 'submitting'} error={errors.password}
            hint="Ít nhất 6 ký tự, không quá 72 byte UTF-8."
            onChange={(event) => setPassword(event.target.value)}
            rightElement={<button type="button" className="passwordEyeToggle" aria-label={showPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'} aria-pressed={showPassword} disabled={status === 'submitting'} onClick={() => setShowPassword(!showPassword)}><PasswordEye visible={showPassword} /></button>}
          />
          <LoginInput id="reset-confirmation" label="Xác nhận mật khẩu mới" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới" value={confirmation} disabled={status === 'submitting'} error={errors.confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            rightElement={<button type="button" className="passwordEyeToggle" aria-label={showConfirmation ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'} aria-pressed={showConfirmation} disabled={status === 'submitting'} onClick={() => setShowConfirmation(!showConfirmation)}><PasswordEye visible={showConfirmation} /></button>}
          />
          <button type="submit" className="cinemaBtnSubmit recoverySubmit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Đang đặt lại mật khẩu...' : 'Lưu mật khẩu mới'}</button>
          {status === 'submitting' && <p className="recoveryNote" role="status">Vui lòng đợi trong khi mật khẩu được cập nhật.</p>}
        </form>
      )}
    </PasswordRecoveryLayout>
  );
}

function PasswordEye({ visible }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="m3 3 18 18" />}
    </svg>
  );
}
