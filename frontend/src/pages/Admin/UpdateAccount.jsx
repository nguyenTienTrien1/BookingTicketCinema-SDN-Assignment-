import { useEffect, useState } from 'react';
import { getUsers, updateAccount, resendCredentials } from '../../services/userService';
import { translateAccountStatus, translateRole } from '../../utils/uiText';
import { useAuth } from '../../context/AuthContext';
import AccountFields from './AccountFields';
import './adminAccounts.css';

const normalizeStatus = value => ({ active: 'Active', inactive: 'Deactivated', blocked: 'Banned', Inactive: 'Deactivated' })[value] || value;
const draft = user => ({ fullName: user.fullName, email: user.email, phone: user.phone || '', role: user.role, status: normalizeStatus(user.status) });

// Trang admin tìm tài khoản, sửa thông tin và lưu trực tiếp, không hỏi xác nhận lại.
export default function UpdateAccount({ initialAccountId }) {
    const { user: actor, setUser } = useAuth();
    const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [query, setQuery] = useState(''), [role, setRole] = useState(''), [selected, setSelected] = useState(null), [form, setForm] = useState(null);
    // Sao chép tài khoản đã chọn sang form, chưa thay đổi dữ liệu trên server.
    function edit(user) { setSelected(user); setForm(draft(user)); setError(''); setMessage(''); }
    useEffect(() => {
        let active = true;
        getUsers().then(data => { if (!active) return; setUsers(data); const user = data.find(item => item._id === initialAccountId); if (user) edit(user); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [initialAccountId]);
    // Tải lại danh sách và bản mới nhất của tài khoản đang sửa.
    async function reload() {
        setLoading(true); setError('');
        try { const data = await getUsers(); setUsers(data); if (selected) { const fresh = data.find(item => item._id === selected._id); if (fresh) edit(fresh); else { setSelected(null); setForm(null); } } } catch (e) { setError(e.message); } finally { setLoading(false); }
    }
    // Đồng bộ dữ liệu đã lưu vào danh sách và hồ sơ đăng nhập nếu đang sửa chính mình.
    function replace(user) { setUsers(current => current.map(item => item._id === user._id ? user : item)); if (user._id === actor?._id) setUser(current => ({ ...current, ...user })); }
    // Gửi form cùng phiên bản/trạng thái đã xem để server chặn ghi đè dữ liệu cũ.
    async function save(event) {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try { const updated = await updateAccount(selected._id, { ...form, version: selected.__v || 0, expectedStatus: selected.status }); replace(updated); setSelected(null); setForm(null); setMessage('Đã lưu thay đổi tài khoản.'); } catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    // Gửi lại thông tin đăng nhập cho tài khoản đang chờ email và cập nhật trạng thái.
    async function resend(user) {
        if (busy) return; setBusy(true); setError(''); setMessage('');
        try { const result = await resendCredentials(user._id); replace(result.user); if (selected?._id === user._id) { setSelected(result.user); setForm(draft(result.user)); } if (result.emailSent) setMessage(result.message); else setError(result.message); } catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    const filtered = users.filter(user => (!role || user.role === role) && `${user.fullName} ${user.email} ${user.phone || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <section className="accountAdminPage" aria-labelledby="update-account-title">
        <header className="accountPageHeading"><div><p className="accountEyebrow">NHÂN SỰ & THÀNH VIÊN</p><h2 id="update-account-title">Cập nhật tài khoản</h2><p>Tìm tài khoản, chỉnh sửa thông tin và lưu thay đổi trực tiếp.</p></div><button type="button" className="ghost" disabled={busy || loading} onClick={reload}>Làm mới danh sách</button></header>
        {error && <p className="accountAlert error" role="alert">{error}</p>}{message && <p className="accountAlert success" role="status">{message}</p>}
        <div className={'accountManageLayout' + (selected ? ' editing' : '')}><div className="accountDirectory">
            <div className="accountToolbar"><label>Tìm tài khoản<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Họ tên, email hoặc điện thoại" /></label><label>Lọc vai trò<select value={role} onChange={event => setRole(event.target.value)}><option value="">Tất cả vai trò</option><option value="admin">Quản trị viên</option><option value="employee">Nhân viên</option><option value="member">Thành viên</option></select></label></div>
            <p className="accountCount" aria-live="polite">{loading ? 'Đang tải tài khoản…' : `${filtered.length} tài khoản`}</p>
            <div className="accountUserList">{!loading && filtered.map(user => <article className={'accountUserRow' + (selected?._id === user._id ? ' selected' : '')} key={user._id}>
                <span className="accountAvatar" aria-hidden="true">{user.fullName?.charAt(0).toUpperCase()}</span><div className="accountUserInfo"><h3>{user.fullName}{user._id === actor?._id && <small> · Bạn</small>}</h3><p>{user.email}</p><small>{translateRole(user.role)}{user.phone ? ` · ${user.phone}` : ''}</small><span className={'accountStatus ' + (['Active', 'active'].includes(user.status) ? 'active' : 'inactive')}>{user.status === 'Pending Activation' && user.credentialsEmailStatus ? user.credentialsEmailStatus === 'sending' ? 'Đang gửi email' : 'Chờ gửi lại email' : translateAccountStatus(user.status)}</span></div>
                <div className="accountRowActions"><button type="button" className="ghost" disabled={busy || user.credentialsEmailStatus === 'sending'} aria-label={`Chỉnh sửa ${user.email}`} onClick={() => edit(user)}>Chỉnh sửa</button>{user.status === 'Pending Activation' && <button type="button" className="accountInlineButton" disabled={busy} onClick={() => resend(user)}>Gửi lại email</button>}</div>
            </article>)}{!loading && filtered.length === 0 && <p className="accountEmpty">Không có tài khoản phù hợp.</p>}</div>
        </div>{selected && form && <form className="accountFormCard accountEditCard" onSubmit={save}><div className="accountCardHeading"><div><p className="accountEyebrow">CHỈNH SỬA</p><h3>{selected.fullName}</h3></div><button type="button" className="accountInlineButton" disabled={busy} onClick={() => { setSelected(null); setForm(null); }}>Đóng</button></div>
            <fieldset disabled={busy || loading}><AccountFields editing form={form} setForm={setForm} /><label className="accountStatusField" htmlFor="staff-status">Trạng thái<select id="staff-status" value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))}>{selected.status.startsWith('Pending') && <option value={selected.status} disabled>{translateAccountStatus(selected.status)}</option>}<option value="Active" disabled={selected.status.startsWith('Pending')}>Đang hoạt động</option><option value="Deactivated">Ngừng hoạt động</option><option value="Banned">Đã khóa</option></select></label>
            {selected.status.startsWith('Pending') && <p className="accountFieldHint">Tài khoản cần nhận email đăng nhập hoặc hoàn tất xác minh trước khi hoạt động.</p>}<div className="accountFormActions"><button type="button" className="ghost" disabled={busy} onClick={() => { setSelected(null); setForm(null); }}>Hủy</button><button type="submit" className="primary">{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></fieldset></form>}</div>
    </section>;
}
