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
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const alertRef = useRef(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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
      const normalizedEmail = email.trim().toLowerCase();
      const acknowledged = await requestPasswordReset(normalizedEmail);
      if (acknowledged !== true) throw new Error('Unconfirmed request');
      if (mountedRef.current) {
        setSubmittedEmail(normalizedEmail);
        setStatus('acknowledged');
        setResendCooldown(60);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus('error');
      setMessage(error.message || 'Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleResend() {
    if (resending || resendCooldown > 0 || !submittedEmail) return;
    setResending(true);
    setResendMessage('');
    try {
      await requestPasswordReset(submittedEmail);
      setResendMessage('Đã gửi lại liên kết đặt lại mật khẩu thành công.');
      setResendCooldown(60);
    } catch (error) {
      setResendMessage(error.message || 'Không thể gửi lại lúc này. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  }

  return (
    <PasswordRecoveryLayout
      title={status === 'acknowledged' ? 'Kiểm tra hộp thư' : 'Quên mật khẩu?'}
      description={
        status === 'acknowledged'
          ? 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.'
          : 'Nhập email đã đăng ký để yêu cầu liên kết đặt lại mật khẩu.'
      }
    >
      {status === 'acknowledged' ? (
        <div className="recoveryResult" ref={alertRef} tabIndex={-1} role="status">
          <div className="recoveryMailSentVisual" aria-hidden="true">
            <div className="recoveryMailIconCircle">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <div className="recoveryMailSuccessBadge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          </div>

          <h2 className="successTitle">Kiểm tra email của bạn</h2>

          {submittedEmail && (
            <div className="recoveryTargetEmail">
              <span className="recoveryTargetLabel">Đã gửi tới:</span>
              <strong className="recoveryTargetValue">{submittedEmail}</strong>
            </div>
          )}

          <p className="successDesc">{ACKNOWLEDGEMENT}</p>

          <div className="recoveryInfoBox">
            <p className="recoveryInfoText">
              Liên kết có hiệu lực trong <strong>30 phút</strong> và chỉ sử dụng được <strong>1 lần duy nhất</strong>. Vui lòng kiểm tra thêm mục <strong>Thư rác / Spam</strong> nếu không thấy trong Hộp thư đến.
            </p>
          </div>

          {resendMessage && (
            <div className="recoveryResendAlert" role="status">
              {resendMessage}
            </div>
          )}

          <button
            type="button"
            className="cinemaBtnSubmit recoveryResendBtn"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
          >
            {resending
              ? 'Đang gửi lại...'
              : resendCooldown > 0
                ? `Gửi lại (${resendCooldown}s)`
                : 'Gửi lại'}
          </button>
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
