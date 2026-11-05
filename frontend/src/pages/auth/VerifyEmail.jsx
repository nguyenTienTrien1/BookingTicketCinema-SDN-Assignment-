import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../../services/auth/authService';
import '../../styles/auth/login.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(!!token);
  const [status, setStatus] = useState(token ? 'pending' : 'request-link'); // 'pending' | 'success' | 'error' | 'request-link'
  const [message, setMessage] = useState('');
  const verificationRequestedRef = useRef(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState(searchParams.get('email') || '');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('request-link');
      setLoading(false);
      return;
    }

    // Guard against React 18 StrictMode double-invoking
    if (verificationRequestedRef.current === token) return;
    verificationRequestedRef.current = token;
    setLoading(true);

    async function performVerification() {
      try {
        const res = await verifyEmail(token);
        setStatus('success');
        setMessage(res.message || 'Kích hoạt tài khoản thành viên thành công!');
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Xác thực email không thành công. Mã có thể đã hết hạn hoặc đã được sử dụng.');
      } finally {
        setLoading(false);
      }
    }

    performVerification();
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    setResendMessage('');
    setResendSuccess(false);

    try {
      const res = await resendVerification(resendEmail.trim().toLowerCase());
      setResendSuccess(true);
      setResendMessage(res.message || 'Đã gửi lại liên kết xác thực mới vào hộp thư email của bạn.');
    } catch (err) {
      setResendSuccess(false);
      setResendMessage(err.message || 'Không thể gửi lại liên kết xác thực lúc này. Vui lòng thử lại sau.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="cinemaSplitPage">
      <div className="cinemaVisualSide">
        <div className="cinemaBrandHeader">
          CINEMA<span>+</span>
        </div>
        <div className="cinemaPosterWall" aria-hidden="true">
          <div className="posterColumn col1">
            <img src="/images/posters/dune.jpg" alt="" loading="lazy" />
            <img src="/images/posters/the_batman.jpg" alt="" loading="lazy" />
          </div>
          <div className="posterColumn col2">
            <img src="/images/posters/stranger_things.jpg" alt="" loading="lazy" />
            <img src="/images/posters/avatar_fire_and_ash.jpg" alt="" loading="lazy" />
          </div>
          <div className="posterColumn col3">
            <img src="/images/posters/alice_in_borderland.jpg" alt="" loading="lazy" />
            <img src="/images/posters/attack_on_titan.jpg" alt="" loading="lazy" />
          </div>
        </div>
        <div className="cinemaVisualGradientOverlay" />
      </div>

      <div className="cinemaFormSide">
        <div className="cinemaFormCard">
          <div className="cinemaCardHeader">
            <Link to="/" className="cinemaCardLogo" aria-label="Trang chủ CINEMA+">
              CINEMA<span>+</span>
            </Link>
            <h2 className="cinemaCardHeading">
              {status === 'success' ? 'Kích hoạt tài khoản' : 'Xác thực tài khoản'}
            </h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                border: '3px solid rgba(229, 9, 20, 0.2)',
                borderTopColor: '#e50914',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#94a3b8', fontSize: '15px' }}>Đang xác thực liên kết tài khoản...</p>
            </div>
          ) : status === 'success' ? (
            <div className="registerSuccessCard" role="status">
              <div className="successBadgeIcon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 className="successTitle">Kích hoạt thành công!</h3>
              <p className="successDesc">{message}</p>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
                Tài khoản của bạn đã được kích hoạt. Hãy đăng nhập để bắt đầu đặt vé ngay!
              </p>
              <Link to="/login" className="cinemaBtnSubmit verifyNowBtn">
                Đăng nhập ngay →
              </Link>
            </div>
          ) : (
            <div>
              {status === 'error' && (
                <div className="cinemaAlert cinemaAlertError" role="alert" style={{ marginBottom: '20px' }}>
                  <span>{message}</span>
                </div>
              )}

              {/* Helpful context */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, margin: '0 0 12px' }}>
                  {status === 'error'
                    ? 'Nếu bạn đã kích hoạt trước đó, bạn có thể thử đăng nhập ngay. Hoặc nhập email để nhận liên kết kích hoạt mới:'
                    : 'Nhập địa chỉ email đăng ký để nhận liên kết kích hoạt tài khoản mới:'}
                </p>
                {status === 'error' && (
                  <Link
                    to="/login"
                    className="cinemaBtnSubmit"
                    style={{
                      display: 'inline-block',
                      width: '100%',
                      textAlign: 'center',
                      textDecoration: 'none',
                      backgroundColor: '#272b38',
                      border: '1px solid #3b4255',
                      marginBottom: '20px',
                      padding: '12px 16px',
                      color: '#ffffff'
                    }}
                  >
                    Thử đăng nhập vào tài khoản
                  </Link>
                )}
              </div>

              {/* Form to resend verification link */}
              <div>
                <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>
                  Yêu cầu gửi lại liên kết xác thực mới:
                </h4>
                <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="email"
                    placeholder="Nhập email của bạn (ví dụ: email@domain.com)"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    className="loginInputField"
                    style={{
                      background: '#1a1e27',
                      border: '1px solid #2d3343',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      color: '#fff',
                      fontSize: '14.5px'
                    }}
                  />
                  <button
                    type="submit"
                    className="cinemaBtnSubmit"
                    disabled={resendLoading}
                    style={{ height: '46px', cursor: resendLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {resendLoading ? 'Đang gửi yêu cầu...' : 'Tạo liên kết xác thực mới'}
                  </button>
                </form>

                {resendMessage && (
                  <div style={{
                    backgroundColor: resendSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: resendSuccess ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                    color: resendSuccess ? '#34d399' : '#fca5a5',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    marginTop: '14px',
                    textAlign: 'center'
                  }}>
                    {resendMessage}
                  </div>
                )}
              </div>

              <div className="cinemaCardFooter" style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #232838' }}>
                <Link to="/login" className="footerSignUpLink">
                  ← Quay lại trang Đăng nhập
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

