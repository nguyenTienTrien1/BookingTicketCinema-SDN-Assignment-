export default function AccountFields({ form, setForm, editing = false }) {
    const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
    return <div className="accountFields">
        <label htmlFor="staff-fullName">Họ tên <span>*</span><input id="staff-fullName" name="fullName" autoComplete="name" required maxLength={100} value={form.fullName} onChange={change} placeholder="Nguyễn Văn An" /></label>
        <label htmlFor="staff-email">Email đăng nhập <span>*</span><input id="staff-email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={change} placeholder="nhanvien@example.com" /><small>{editing ? 'Email dùng để đăng nhập tài khoản.' : 'Mật khẩu được gửi đến địa chỉ này. Kiểm tra email trước khi tạo.'}</small></label>
        <label htmlFor="staff-phone">Số điện thoại<input id="staff-phone" name="phone" type="tel" autoComplete="tel" pattern="\+?[0-9]{9,15}" maxLength={16} value={form.phone} onChange={change} placeholder="0901234567" /><small>Không bắt buộc · 9–15 chữ số.</small></label>
        <label htmlFor="staff-role">Vai trò <span>*</span><select id="staff-role" name="role" value={form.role} onChange={change} disabled={form.role === 'member'}>
            {form.role === 'member' ? <option value="member">Thành viên</option> : <><option value="employee">Nhân viên</option><option value="admin">Quản trị viên</option></>}
        </select><small>{form.role === 'admin' ? 'Quản lý dữ liệu và tài khoản của hệ thống.' : form.role === 'employee' ? 'Bán vé, phục vụ khách và nghiệp vụ tại quầy.' : 'Tài khoản khách hàng; không chuyển sang nhân sự.'}</small></label>
    </div>;
}
