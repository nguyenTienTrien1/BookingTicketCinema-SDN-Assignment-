import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { linkGoogleAccount, setLocalPassword } from '../../services/auth/authService';
import GoogleSignIn from './GoogleSignIn';

export default function AccountSecurity({ methods, onLinked }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [action, setAction] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function cancel() {
    setAction('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function complete(credential) {
    setSaving(true);
    try {
      let result;
      if (action === 'set-password') {
        result = await setLocalPassword({ newPassword, confirmPassword, credential });
      } else {
        result = await linkGoogleAccount({ currentPassword, credential });
        setUser(result.user);
        onLinked?.(result.user.loginMethods);
        cancel();
        setMessage(result.message);
        return;
      }
      setUser(null);
      navigate('/login', { replace: true, state: { message: result.message } });
    } finally {
      setSaving(false);
    }
  }

  const validPassword = newPassword.trim() && newPassword.length >= 6 && new TextEncoder().encode(newPassword).length <= 72 && newPassword === confirmPassword;
  const ready = action === 'set-password' ? validPassword : !!currentPassword;

  return <section className="profileSecurity" aria-labelledby="login-methods-title">
    <h3 id="login-methods-title">Bảo mật · Phương thức đăng nhập</h3>
    {message && <p className="profileSuccess" role="status">{message}</p>}
    <dl className="profileGrid">
      <div><dt>Google</dt><dd>{methods.google ? 'Đã liên kết' : 'Chưa liên kết'}</dd>
        {methods.googleEmail && <dd>{methods.googleEmail}</dd>}</div>
      <div><dt>Email và mật khẩu</dt><dd>{methods.local ? 'Đã thiết lập' : 'Chưa thiết lập'}</dd></div>
    </dl>
    {!action && <div className="profileActions">
      {methods.google && !methods.local && <button type="button" className="ghost" onClick={() => setAction('set-password')}>Đặt mật khẩu</button>}
      {methods.local && !methods.google && <button type="button" className="ghost" onClick={() => setAction('link-google')}>Liên kết tài khoản Google</button>}
    </div>}
    {action && <form onSubmit={event => event.preventDefault()}>
      <h4>{action === 'set-password' ? 'Đặt mật khẩu Cinema+' : 'Liên kết tài khoản Google'}</h4>
      <p className="profileHint" id="google-security-help">{action === 'set-password'
        ? 'Nhập mật khẩu mới có ít nhất 6 ký tự (tối đa 72 byte UTF-8), rồi xác thực lại bằng Google đã liên kết để lưu. Sau khi lưu thành công, bạn cần đăng nhập lại.'
        : 'Nhập mật khẩu Cinema+ hiện tại, rồi chọn Tiếp tục với Google để xác thực tài khoản có cùng email và hoàn tất liên kết.'}</p>
      <fieldset className="profileFields profilePasswordFields" disabled={saving} aria-describedby="google-security-help">
        {action === 'link-google' ? <label htmlFor="google-link-password">Mật khẩu Cinema+ hiện tại
          <input id="google-link-password" type="password" autoComplete="current-password" required maxLength={72} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
        </label> : <>
          <label htmlFor="google-set-password">Mật khẩu mới
            <input id="google-set-password" type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} />
          </label>
          <label htmlFor="google-confirm-password">Xác nhận mật khẩu mới
            <input id="google-confirm-password" type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
          </label>
          {confirmPassword && newPassword !== confirmPassword && <p className="profileError" role="alert">Xác nhận mật khẩu mới không khớp.</p>}
        </>}
        <GoogleSignIn purpose={action} onCredential={complete} disabled={saving || !ready} />
        <button type="button" className="ghost" onClick={cancel}>Hủy</button>
      </fieldset>
    </form>}
  </section>;
}
