import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { getGoogleChallenge } from '../../services/auth/authService';
import '../../styles/auth/googleSignIn.css';

export default function GoogleSignIn({ purpose = 'login', onCredential, disabled = false }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const [nonce, setNonce] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const containerRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      // GIS supports buttons up to 400px. Measure the form so the official
      // control also fits narrow screens without stretching its contents.
      setButtonWidth(Math.min(400, Math.floor(entries[0].contentRect.width)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    const controller = new AbortController();
    setNonce('');
    setError('');
    getGoogleChallenge(purpose, controller.signal)
      .then(value => { if (active) setNonce(value); })
      .catch(err => { if (active) setError(err.response?.data?.message || err.message || 'Không thể chuẩn bị đăng nhập Google. Vui lòng thử lại.'); });
    // A Google token must prove a fresh challenge, including when a page stays open.
    const timer = setTimeout(() => { if (active) setRetry(value => value + 1); }, 4 * 60 * 1000);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [clientId, purpose, retry]);

  async function complete(response) {
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    try {
      if (!response.credential) throw new Error('Google chưa trả về thông tin xác thực.');
      await onCredential(response.credential);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể xác thực Google.');
    } finally {
      setBusy(false);
    }
  }

  if (!clientId) return <p className="googleSignInNote" role="status">{purpose === 'login'
    ? 'Đăng nhập Google chưa được cấu hình. Bạn có thể dùng tài khoản email và mật khẩu đã có.'
    : 'Xác thực Google chưa được cấu hình. Vui lòng liên hệ quản trị để bật phương thức này.'}</p>;

  return <div className="googleSignIn" ref={containerRef} aria-busy={busy}>
    {error ? <>
      <p className="googleSignInNote googleSignInError" role="alert">{error}</p>
      <button type="button" className="ghost" onClick={() => setRetry(value => value + 1)} disabled={disabled || busy}>Thử lại Google</button>
    </> : <GoogleOAuthProvider clientId={clientId} locale="vi" onScriptLoadError={() => setError('Không tải được Google. Kiểm tra kết nối rồi thử lại.')}>
      {nonce && buttonWidth > 0 && !busy && !disabled && <GoogleLogin key={`${nonce}-${buttonWidth}`} nonce={nonce} onSuccess={complete}
        onError={() => setError('Không thể xác thực Google. Vui lòng thử lại.')}
        auto_select={false} useOneTap={false} theme="outline_dark" size="large" shape="rectangular"
        text={purpose === 'login' ? 'signin_with' : 'continue_with'} locale="vi" width={buttonWidth} containerProps={{ className: 'googleSignInButton' }} />}
      {(!nonce || busy || disabled) && <p className="googleSignInNote" role="status">{busy ? 'Đang xác thực Google…' : disabled ? 'Vui lòng hoàn tất thông tin trước khi xác thực Google.' : 'Đang chuẩn bị Google…'}</p>}
    </GoogleOAuthProvider>}
  </div>;
}
