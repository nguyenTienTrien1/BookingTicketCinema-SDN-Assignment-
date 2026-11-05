import { useEffect, useRef, useState } from 'react';
import LoginInput from '../../components/auth/LoginInput';
import PasswordRecoveryLayout from '../../components/auth/PasswordRecoveryLayout';
import { requestPasswordReset } from '../../services/auth/authService';

const ACKNOWLEDGEMENT = 'Nếu email này thuộc tài khoản đủ điều kiện, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến và thư rác.';

function validateEmail(email) {
  if (!email.trim()) return 'Vui lòng nhập địa chỉ email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Địa chỉ email không hợp lệ. Ví dụ: email@domain.com.';
  return '';
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [status, setStatus] = useState('idle');
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
    if (status === 'error' || status === 'acknowledged' || focusRequest > 0) alertRef.current?.focus();
  }, [focusRequest, status]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    const validationError = validateEmail(email);
    setEmailError(validationError);
    setMessage('');
    if (validationError) {
      setStatus('idle');
      setFocusRequest(focusRequest + 1);
      return;
    }

    submittingRef.current = true;
    setStatus('submitting');
    try {
      const acknowledged = await requestPasswordReset(email.trim().toLowerCase());
      if (acknowledged !== true) throw new Error('Unconfirmed request');
      if (mountedRef.current) setStatus('acknowledged');
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus('error');
      if (error.code === 'PASSWORD_RECOVERY_UNAVAILABLE') {
        setMessage(error.message);
      } else {
        setMessage('Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <PasswordRecoveryLayout title="Quên mật khẩu?" description="Nhập email đã đăng ký để yêu cầu liên kết đặt lại mật khẩu.">
      {status === 'acknowledged' ? (
        <div className="recoveryResult" ref={alertRef} tabIndex={-1} role="status">
          <h2 className="successTitle">Kiểm tra email của bạn</h2>
          <p className="successDesc">{ACKNOWLEDGEMENT}</p>
          <p className="recoveryNote">Mỗi liên kết chỉ dùng được một lần. Không chia sẻ liên kết này với người khác.</p>
          <button type="button" className="cinemaBtnGoogle" onClick={() => { setStatus('idle'); setEmail(''); }}>Dùng email khác</button>
        </div>
      ) : (
        <form className="cinemaAuthForm" noValidate onSubmit={handleSubmit} aria-busy={status === 'submitting'}>
          {(emailError || message) && (
            <div className="cinemaAlert cinemaAlertError recoveryAlert" role="alert" ref={alertRef} tabIndex={-1}>
              {emailError ? <a href="#recovery-email" onClick={(event) => { event.preventDefault(); document.getElementById('recovery-email').focus(); }}>{emailError}</a> : message}
            </div>
          )}
          <LoginInput id="recovery-email" label="Địa chỉ email" type="email" inputMode="email" autoComplete="email"
            placeholder="ví dụ: email@domain.com" value={email} disabled={status === 'submitting'} error={emailError}
            onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError(validateEmail(event.target.value)); }}
            onBlur={() => setEmailError(validateEmail(email))}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m2 7 10 6 10-6" /></svg>}
          />
          <button type="submit" className="cinemaBtnSubmit recoverySubmit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Đang gửi yêu cầu...' : 'Gửi liên kết đặt lại mật khẩu'}
          </button>
          <p className="recoveryNote" role={status === 'submitting' ? 'status' : undefined}>
            {status === 'submitting' ? 'Vui lòng đợi trong khi yêu cầu được xử lý.' : 'Liên kết khôi phục sẽ được gửi qua email nếu tài khoản đủ điều kiện.'}
          </p>
        </form>
      )}
    </PasswordRecoveryLayout>
  );
}
