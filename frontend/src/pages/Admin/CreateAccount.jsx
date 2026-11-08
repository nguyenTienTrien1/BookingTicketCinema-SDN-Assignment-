import { useState } from 'react';
import { createAccount, resendCredentials } from '../../services/userService';
import AccountFields from './AccountFields';
import './adminAccounts.css';

const emptyForm = () => ({ fullName: '', email: '', phone: '', role: 'employee' });

// Form admin tạo nhân sự: gửi thông tin, hiển thị kết quả và cho gửi lại email nếu lỗi.
export default function CreateAccount({ onManage }) {
    const [form, setForm] = useState(emptyForm), [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('');
    // Chặn gửi lặp trong lúc xử lý và hiển thị lỗi/kết quả từ server.
    async function perform(action) {
        if (busy) return;
        setBusy(true); setError('');
        try { setResult(await action()); } catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    function reset() { setForm(emptyForm()); setResult(null); setError(''); }
    return <section className="accountAdminPage" aria-labelledby="create-account-title">
        <header className="accountPageHeading"><div><p className="accountEyebrow">NHÂN SỰ / TÀI KHOẢN MỚI</p><h2 id="create-account-title">Tạo tài khoản nhân sự</h2><p>Nhập thông tin nhân sự. Hệ thống tạo mật khẩu ngẫu nhiên và gửi email đăng nhập.</p></div></header>
        {error && <p className="accountAlert error" role="alert">{error}</p>}
        {result && <div className={'accountAlert ' + (result.emailSent ? 'success' : 'warning')} role={result.emailSent ? 'status' : 'alert'}><strong>{result.emailSent ? 'Đã tạo và gửi email' : 'Email chưa gửi thành công'}</strong><p>{result.message}</p><p>{result.user.fullName} · {result.user.email}</p><div className="accountResultActions">{!result.emailSent && <button type="button" className="primary" disabled={busy} onClick={() => perform(() => resendCredentials(result.user._id))}>{busy ? 'Đang gửi…' : 'Gửi lại email'}</button>}{onManage && <button type="button" className="ghost" disabled={busy} onClick={() => onManage(result.user)}>Cập nhật tài khoản này</button>}<button type="button" className="ghost" disabled={busy} onClick={reset}>Tạo tài khoản khác</button></div></div>}
        {!result && <div className="accountCreateLayout"><form className="accountFormCard" onSubmit={event => { event.preventDefault(); perform(() => createAccount(form)); }}>
            <div className="accountCardHeading"><h3>Thông tin tài khoản</h3><span>Các mục có * là bắt buộc</span></div>
            <fieldset disabled={busy}><AccountFields form={form} setForm={setForm} /><div className="accountFormActions"><button type="button" className="ghost" disabled={busy} onClick={reset}>Xóa nội dung</button><button className="primary" type="submit">{busy ? 'Đang tạo và gửi email…' : 'Tạo tài khoản và gửi email'}</button></div></fieldset>
        </form><aside className="accountHelpCard"><span className="accountMailIcon" aria-hidden="true">✉</span><h3>Thông tin đăng nhập qua email</h3><ol><li>Hệ thống tạo một mật khẩu ngẫu nhiên riêng cho tài khoản.</li><li>Email gửi đến nhân sự gồm email đăng nhập, mật khẩu và đường dẫn đăng nhập.</li><li>Nhân sự đăng nhập và đổi mật khẩu trong Hồ sơ.</li></ol><div className="accountEmailPreview"><span>Email nhận thông tin</span><strong>{form.email || 'Chưa nhập email'}</strong></div><p>Nếu email gửi lỗi, tài khoản sẽ chờ gửi lại email và chưa thể đăng nhập.</p></aside></div>}
    </section>;
}
