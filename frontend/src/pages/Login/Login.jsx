import { useState } from 'react';
import { login } from '../../services/authService';

export default function Login({ setUser, setTab, setMsg, onLoginSuccess, onCancelLogin }) {
    const [form, setForm] = useState({ email: 'member@cinema.com', password: '123456' });

    async function submit(event) {
        event.preventDefault();
        try {
            const result = await login(form);
            setUser(result.user);
            setMsg('Đăng nhập thành công.');
            if (onLoginSuccess) onLoginSuccess();
            else setTab('home');
        } catch (error) {
            setMsg(error.message);
        }
    }

    return (
        <section className="auth page">
            <form onSubmit={submit}>
                <h2>Chào mừng trở lại</h2>
                <p>Đăng nhập để tiếp tục đặt vé và quản lý vé của bạn.</p>
                <input
                    type="email"
                    placeholder="Địa chỉ email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                />
                <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                />
                <button className="primary full" type="submit">Đăng nhập</button>
                <p className="loginHint">Tài khoản dùng thử: member@cinema.com / 123456</p>
                <button
                    className="textButton"
                    type="button"
                    onClick={onCancelLogin || (() => setTab('home'))}
                >
                    Quay lại trang chủ
                </button>
            </form>
        </section>
    );
}
