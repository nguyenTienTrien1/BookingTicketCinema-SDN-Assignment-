import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile, changePassword } from '../../services/profileService';
import { translateAccountStatus, translateRole } from '../../utils/uiText';
import './profile.css';
import AccountSecurity from '../../components/auth/AccountSecurity';

function profileForm(user) {
  return {
    fullName: user.fullName || '', phone: user.phone || '',
    age: user.age == null ? '' : String(user.age), gender: user.gender || 'Other'
  };
}

export function ProfilePanel() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [mode, setMode] = useState('view');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getProfile()
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setForm(profileForm(data));
        setUser(data);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Không thể tải hồ sơ. Vui lòng thử lại.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retry, setUser]);

  function switchMode(value) {
    setMode(value);
    setError('');
    setMessage('');
    setForm(profileForm(profile));
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const result = await updateProfile({
        fullName: form.fullName, phone: form.phone,
        age: form.age === '' ? null : Number(form.age), gender: form.gender
      });
      setProfile(result.user);
      setUser(result.user);
      setForm(profileForm(result.user));
      setMode('view');
      setMessage(result.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    setSaving(true);
    try {
      const result = await changePassword(passwords);
      setUser(null);
      navigate('/login', { replace: true, state: { message: result.message } });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Đang tải hồ sơ…</p>;
  if (!profile) return <div className="memberProfile"><p role="alert">{error}</p><button type="button" className="ghost" onClick={() => setRetry(retry + 1)}>Thử lại</button></div>;

  return (
    <section className="memberProfile" aria-label="Hồ sơ cá nhân">
      <div className="profileHeading">
        <div className="accountAvatar" aria-hidden="true">{profile.fullName.trim().charAt(0).toUpperCase()}</div>
        <div><h2>{profile.fullName}</h2><p>{profile.email}</p></div>
      </div>
      {error && <p className="profileError" role="alert">{error}</p>}
      {message && <p className="profileSuccess" role="status">{message}</p>}

      {mode === 'view' && <>
        <dl className="profileGrid">
          <div><dt>Số điện thoại</dt><dd>{profile.phone || 'Chưa cập nhật'}</dd></div>
          {profile.role==='member'&&<div><dt>Tuổi đã xác minh</dt><dd>{profile.verifiedAge==null?'Chưa được nhân viên xác minh':profile.verifiedAge}</dd></div>}
          <div><dt>Tuổi</dt><dd>{profile.age == null ? 'Chưa cập nhật' : profile.age}</dd></div>
          <div><dt>Giới tính</dt><dd>{({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' })[profile.gender]}</dd></div>
          <div><dt>Vai trò</dt><dd>{translateRole(profile.role)}</dd></div>
          {profile.role === 'member' && <div><dt>Điểm thành viên</dt><dd>{Number(profile.memberPoints || 0).toLocaleString('vi-VN')}</dd></div>}
          <div className="profileAccountStatus" data-status={profile.status}><dt>Trạng thái</dt><dd>{translateAccountStatus(profile.status)}</dd></div>
          {profile.role === 'member' && <div><dt>Hạng thành viên</dt><dd>{profile.isVIP ? 'VIP' : 'Thành viên'}</dd></div>}
        </dl>
        <div className="profileActions">
          <button type="button" className="primary" onClick={() => switchMode('edit')}>Cập nhật hồ sơ</button>
          {profile.loginMethods?.local !== false && <button type="button" className="ghost" onClick={() => switchMode('password')}>Đổi mật khẩu</button>}
        </div>
        {profile.role === 'member' && profile.loginMethods && <AccountSecurity methods={profile.loginMethods} />}
      </>}

      {mode === 'edit' && <form onSubmit={saveProfile}>
        <h3>Cập nhật hồ sơ</h3>
        <p className="profileHint">Email, điểm và trạng thái tài khoản do hệ thống quản lý.</p>
        <fieldset disabled={saving} className="profileFields">
          <div className="profileFormGrid">
            <label htmlFor="profile-name">Họ và tên<input id="profile-name" autoComplete="name" required maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label htmlFor="profile-phone">Số điện thoại<input id="profile-phone" type="tel" autoComplete="tel" pattern="\+?[0-9]{9,15}" title="9–15 chữ số, có thể bắt đầu bằng +" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label htmlFor="profile-age">Tuổi<input id="profile-age" type="number" min="0" max="120" step="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></label>
            <label htmlFor="profile-gender">Giới tính<select id="profile-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="Other">Khác</option><option value="Male">Nam</option><option value="Female">Nữ</option></select></label>
          </div>
          <div className="profileActions"><button className="primary" type="submit">{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button><button className="ghost" type="button" onClick={() => switchMode('view')}>Hủy</button></div>
        </fieldset>
      </form>}

      {mode === 'password' && <form onSubmit={savePassword}>
        <h3>Đổi mật khẩu</h3>
        <p className="profileHint" id="password-help">Mật khẩu mới có ít nhất 6 ký tự và khác mật khẩu hiện tại. Sau khi đổi, bạn cần đăng nhập lại trên các thiết bị.</p>
        <fieldset disabled={saving} className="profileFields profilePasswordFields">
          <label htmlFor="password-current">Mật khẩu hiện tại<input id="password-current" type="password" autoComplete="current-password" required maxLength={72} value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label>
          <label htmlFor="password-new">Mật khẩu mới<input id="password-new" type="password" autoComplete="new-password" aria-describedby="password-help" required minLength={6} maxLength={72} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></label>
          <label htmlFor="password-confirm">Xác nhận mật khẩu mới<input id="password-confirm" type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></label>
          <div className="profileActions"><button className="primary" type="submit">{saving ? 'Đang đổi…' : 'Lưu mật khẩu mới'}</button><button className="ghost" type="button" onClick={() => switchMode('view')}>Hủy</button></div>
        </fieldset>
      </form>}
    </section>
  );
}

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingOut(false);
    }
  }

  return <main className="profilePage">
    <div className="profileActions">
      <Link to="/">← Về trang chủ</Link>
      <button type="button" className="ghost" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
    </div>
    {error && <p role="alert" className="profileError">{error}</p>}
    <h1>Profile — Hồ sơ của tôi</h1>
    <ProfilePanel />
  </main>;
}
