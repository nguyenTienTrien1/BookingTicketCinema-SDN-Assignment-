import { useEffect, useState } from 'react';
import { getUsers, updateStatus } from '../../services/userService';
import { translateAccountStatus, translateRole } from '../../utils/uiText';

const statuses = ['active', 'inactive', 'blocked'];

export default function UpdateAccount({ setMsg }) {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        getUsers().then(setUsers).catch((error) => setMsg(error.message));
    }, [setMsg]);

    async function change(user, status) {
        try {
            const updated = await updateStatus(user._id, status);
            setUsers((current) => current.map((item) => item._id === user._id ? updated : item));
            setMsg('Đã cập nhật trạng thái tài khoản.');
        } catch (error) {
            setMsg(error.message);
        }
    }

    return (
        <section className="page">
            <h2>Cập nhật trạng thái tài khoản</h2>
            <div className="adminList">
                {users.map((user) => (
                    <div className="adminRow" key={user._id}>
                        <div>
                            <b>{user.fullName}</b>
                            <span>{user.email} · {translateRole(user.role)}</span>
                        </div>
                        <select
                            aria-label={`Trạng thái tài khoản ${user.fullName}`}
                            value={user.status}
                            onChange={(event) => change(user, event.target.value)}
                        >
                            {statuses.map((status) => (
                                <option value={status} key={status}>{translateAccountStatus(status)}</option>
                            ))}
                        </select>
                    </div>
                ))}
                {!users.length && <p>Chưa có tài khoản nào.</p>}
            </div>
        </section>
    );
}
