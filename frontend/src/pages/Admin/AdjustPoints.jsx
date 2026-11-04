import { useEffect, useRef, useState } from 'react';
import { adjustPoints, getUsers, getPointHistory } from '../../services/userService';

export default function AdjustPoints({ setMsg }) {
    const [users, setUsers] = useState([]);
    const [values, setValues] = useState({});
    const [reasons, setReasons] = useState({});
    const [busyId, setBusyId] = useState('');
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [history, setHistory] = useState(null);
    const submitting = useRef(false);
    const requests = useRef({});

    useEffect(() => {
        getUsers().then(setUsers).catch((err) => setError(err.message));
    }, []);

    async function submit(event, user) {
        event.preventDefault();
        if (submitting.current) return;
        const delta = Number(values[user._id]);
        const reason = (reasons[user._id] || '').trim();
        if (!Number.isSafeInteger(delta) || delta === 0 || user.memberPoints + delta < 0 || reason.length < 5) {
            setError('Nhập số điểm nguyên khác 0 và lý do ít nhất 5 ký tự. Số dư mới không được âm.');
            return;
        }
        submitting.current = true;
        setBusyId(user._id);
        setError('');
        const payload = JSON.stringify({ delta, reason });
        if (requests.current[user._id]?.payload !== payload) {
            requests.current[user._id] = { payload, id: crypto.randomUUID(), expectedBalance: user.memberPoints };
        }
        try {
            const request = requests.current[user._id];
            const updated = await adjustPoints(user._id, delta, reason, request.expectedBalance, request.id);
            setUsers((current) => current.map((item) => item._id === user._id ? updated : item));
            setValues((current) => ({ ...current, [user._id]: '' }));
            setReasons((current) => ({ ...current, [user._id]: '' }));
            delete requests.current[user._id];
            setHistory(null);
            setMsg('Đã điều chỉnh điểm và lưu lý do, người thực hiện.');
        } catch (err) {
            setError(err.message);
        } finally {
            submitting.current = false;
            setBusyId('');
        }
    }

    async function showHistory(user) {
        try {
            const result = await getPointHistory(user._id);
            const request = requests.current[user._id];
            if (request && result.entries.some((entry) => entry.requestId === request.id)) {
                setValues((current) => ({ ...current, [user._id]: '' }));
                setReasons((current) => ({ ...current, [user._id]: '' }));
                delete requests.current[user._id];
                setMsg('Điều chỉnh trước đó đã được lưu thành công.');
            } else if (request) {
                request.expectedBalance = result.balance;
            }
            setHistory({ ...result, fullName: user.fullName });
            setUsers((current) => current.map((item) => item._id === user._id ? { ...item, memberPoints: result.balance } : item));
        } catch (err) { setError(err.message); }
    }

    const query = search.trim().toLowerCase();
    const members = users.filter((user) => user.role === 'member' &&
        [user.fullName, user.email, user.phone].some((value) => String(value || '').toLowerCase().includes(query)));

    return <section className="page">
        <h2>Adjust Member Points — Điều chỉnh điểm thành viên</h2>
        <p>Chỉ Admin được cộng/trừ điểm để sửa sai hoặc bù điểm, có lý do. Đây không phải bước đổi điểm thanh toán.</p>
        <input aria-label="Tìm thành viên" placeholder="Tìm theo tên, email, số điện thoại" value={search} onChange={(event) => setSearch(event.target.value)} />
        {error && <p role="alert">{error}</p>}
        <div className="adminList">
            {members.map((user) => {
                const delta = Number(values[user._id] || 0);
                const after = Number(user.memberPoints || 0) + delta;
                return <form className="adminRow" key={user._id} onSubmit={(event) => submit(event, user)}>
                    <div>
                        <b>{user.fullName}</b>
                        <span>{user.email}</span>
                        <span>Hiện có: {user.memberPoints} điểm → Sau điều chỉnh: {Number.isFinite(after) ? after : '—'} điểm</span>
                        <button type="button" onClick={() => showHistory(user)} disabled={!!busyId}>Xem lịch sử / Làm mới số dư</button>
                    </div>
                    <div className="pointBox" style={{ flexWrap: 'wrap' }}>
                        <input type="number" step="1" required aria-label={'Số điểm cộng/trừ của ' + user.fullName}
                            value={values[user._id] ?? ''} onChange={(event) => setValues({ ...values, [user._id]: event.target.value })} placeholder="Số điểm (+/-)" disabled={!!busyId} />
                        <input type="text" minLength={5} maxLength={500} required aria-label={'Lý do điều chỉnh cho ' + user.fullName}
                            value={reasons[user._id] || ''} onChange={(event) => setReasons({ ...reasons, [user._id]: event.target.value })} placeholder="Lý do điều chỉnh" disabled={!!busyId} />
                        <button type="submit" disabled={!!busyId || !Number.isSafeInteger(delta) || delta === 0 || after < 0 || (reasons[user._id] || '').trim().length < 5}>
                            {busyId === user._id ? 'Đang lưu…' : 'Xác nhận điều chỉnh'}
                        </button>
                    </div>
                </form>;
            })}
            {!members.length && <p>Không tìm thấy thành viên.</p>}
        </div>
        {history && <section aria-label="Lịch sử điều chỉnh điểm">
            <h3>{history.fullName} — 20 điều chỉnh gần nhất</h3>
            {!history.entries.length && <p>Chưa có điều chỉnh thủ công.</p>}
            {history.entries.map((entry) => <p key={entry.requestId}>
                {new Date(entry.createdAt).toLocaleString('vi-VN')} · {entry.delta > 0 ? '+' : ''}{entry.delta} điểm · {entry.before} → {entry.after} · {entry.reason} · {entry.admin?.fullName || 'Admin'}
            </p>)}
        </section>}
    </section>;
}
