import { useEffect, useState } from 'react';
import { adjustPoints, getUsers } from '../../services/userService';

export default function AdjustPoints({ setMsg }) {
    const [users, setUsers] = useState([]);
    const [values, setValues] = useState({});

    useEffect(() => {
        getUsers()
            .then((result) => setUsers(result))
            .catch((error) => setMsg(error.message));
    }, [setMsg]);

    async function submit(user) {
        try {
            const updated = await adjustPoints(user._id, Number(values[user._id] || 0));
            setUsers((current) => current.map((item) => item._id === user._id ? updated : item));
            setMsg('Đã điều chỉnh điểm thành viên.');
        } catch (error) {
            setMsg(error.message);
        }
    }

    const members = users.filter((user) => String(user.role).toLowerCase() === 'member');

    return (
        <section className="page">
            <h2>Điều chỉnh điểm thành viên</h2>
            <div className="adminList">
                {members.map((user) => (
                    <div className="adminRow" key={user._id}>
                        <div>
                            <b>{user.fullName}</b>
                            <span>Điểm hiện có: {Number(user.memberPoints || 0).toLocaleString()}</span>
                        </div>
                        <div className="pointBox">
                            <input
                                type="number"
                                value={values[user._id] || ''}
                                onChange={(event) => setValues({ ...values, [user._id]: event.target.value })}
                                placeholder="Số điểm (+/-)"
                                aria-label={`Số điểm điều chỉnh cho ${user.fullName}`}
                            />
                            <button type="button" onClick={() => submit(user)}>CẬP NHẬT</button>
                        </div>
                    </div>
                ))}
                {!members.length && <p>Chưa có thành viên nào.</p>}
            </div>
        </section>
    );
}
