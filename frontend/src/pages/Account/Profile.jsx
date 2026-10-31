import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getProfile } from '../../services/profileService';
import { translateAccountStatus } from '../../utils/uiText';
import './profile.css';

export function ProfilePanel() {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getProfile()
      .then((data) => {
        if (!active) return;
        setProfile(data);
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

  if (loading) return <p role="status">Đang tải hồ sơ…</p>;
  if (!profile) return <div className="memberProfile"><p role="alert">{error}</p><button type="button" className="ghost" onClick={() => setRetry(retry + 1)}>Thử lại</button></div>;

  return (
    <section className="memberProfile" aria-label="Hồ sơ thành viên">
      <div className="profileHeading">
        <div className="accountAvatar" aria-hidden="true">{profile.fullName.trim().charAt(0).toUpperCase()}</div>
        <div><h2>{profile.fullName}</h2><p>{profile.email}</p></div>
      </div>
      {error && <p className="profileError" role="alert">{error}</p>}

      <>
        <dl className="profileGrid">
          <div><dt>Số điện thoại</dt><dd>{profile.phone || 'Chưa cập nhật'}</dd></div>
          <div><dt>Tuổi</dt><dd>{profile.age == null ? 'Chưa cập nhật' : profile.age}</dd></div>
          <div><dt>Giới tính</dt><dd>{({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' })[profile.gender]}</dd></div>
          <div><dt>Điểm thành viên</dt><dd>{Number(profile.memberPoints || 0).toLocaleString('vi-VN')}</dd></div>
          <div><dt>Trạng thái</dt><dd>{translateAccountStatus(profile.status)}</dd></div>
          <div><dt>Hạng thành viên</dt><dd>{profile.isVIP ? 'VIP' : 'Thành viên'}</dd></div>
        </dl>
      </>

    </section>
  );
}

export default function Profile() {
  return <main className="profilePage"><Link to="/dashboard">← Về tài khoản</Link><h1>Hồ sơ của tôi</h1><ProfilePanel /></main>;
}
