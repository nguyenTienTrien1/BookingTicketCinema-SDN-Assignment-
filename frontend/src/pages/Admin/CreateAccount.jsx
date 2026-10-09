import { useState } from 'react';
import { createAccount } from '../../services/userService';

const initialForm = { fullName: '', email: '', phone: '', password: '', role: 'employee' };

export default function CreateAccount({ setMsg }) {
    const [form, setForm] = useState(initialForm);

    async function submit(event) {
        event.preventDefault();
        try {
            await createAccount(form);
            setMsg('Tạo tài khoản thành công.');
            setForm(initialForm);
        } catch (error) {
            setMsg(error.message);
        }
    }

    return (
        <section className="page adminPage">
            <h2>Tạo tài khoản</h2>
            <form className="adminForm" onSubmit={submit}>
                <input
                    type="text"
                    placeholder="Họ và tên"
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    required
                />
                <input
                    type="email"
                    placeholder="Địa chỉ email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                />
                <input
                    type="tel"
                    placeholder="Số điện thoại"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    required
                />
                <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                />
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                    <option value="employee">Nhân viên</option>
                    <option value="admin">Quản trị viên</option>
                    <option value="member">Thành viên</option>
                </select>
                <button className="primary full" type="submit">TẠO TÀI KHOẢN</button>
            </form>
        </section>
    );
}
