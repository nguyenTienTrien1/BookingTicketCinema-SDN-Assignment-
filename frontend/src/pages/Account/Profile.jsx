import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile } from '../../services/profileService';
import { translateAccountStatus } from '../../utils/uiText';
import './profile.css';

function profileForm(user) {
  return {
    fullName: user.fullName || '', phone: user.phone || '',
    age: user.age == null ? '' : String(user.age), gender: user.gender || 'Other'
  };
}

export function ProfilePanel() {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
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

  if (loading) return <p role="status">Đang tải hồ sơ…</p>;
  if (!profile) return <div className="memberProfile"><p role="alert">{error}</p><button type="button" className="ghost" onClick={() => setRetry(retry + 1)}>Thử lại</button></div>;

  return (
    <section className="memberProfile" aria-label="Hồ sơ thành viên">
      <div className="profileHeading">
        <div className="accountAvatar" aria-hidden="true">{profile.fullName.trim().charAt(0).toUpperCase()}</div>
        <div><h2>{profile.fullName}</h2><p>{profile.email}</p></div>
      </div>
      {error && <p className="profileError" role="alert">{error}</p>}
      {message && <p className="profileSuccess" role="status">{message}</p>}

      {mode === 'view' && <>
        <dl className="profileGrid">
          <div><dt>Số điện thoại</dt><dd>{profile.phone || 'Chưa cập nhật'}</dd></div>
          <div><dt>Tuổi</dt><dd>{profile.age == null ? 'Chưa cập nhật' : profile.age}</dd></div>
          <div><dt>Giới tính</dt><dd>{({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' })[profile.gender]}</dd></div>
          <div><dt>Điểm thành viên</dt><dd>{Number(profile.memberPoints || 0).toLocaleString('vi-VN')}</dd></div>
          <div><dt>Trạng thái</dt><dd>{translateAccountStatus(profile.status)}</dd></div>
          <div><dt>Hạng thành viên</dt><dd>{profile.isVIP ? 'VIP' : 'Thành viên'}</dd></div>
        </dl>
        <div className="profileActions">
          <button type="button" className="primary" onClick={() => switchMode('edit')}>Cập nhật hồ sơ</button>
        </div>
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

    </section>
  );
}

export default function Profile() {
  return <main className="profilePage"><Link to="/dashboard">← Về tài khoản</Link><h1>Hồ sơ của tôi</h1><ProfilePanel /></main>;
}
