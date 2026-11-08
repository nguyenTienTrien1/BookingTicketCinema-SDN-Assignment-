import { useEffect, useRef, useState } from 'react';
import { adjustPoints, getUsers, getPointHistory } from '../../services/userService';
import './adjustPoints.css';

const number = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const date = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

// Chọn một thành viên để điều chỉnh; giữ riêng bản nháp và mã yêu cầu chống gửi lặp.
export default function AdjustPoints({ setMsg }) {
    const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [reloadKey, setReloadKey] = useState(0);
    const [selectedId, setSelectedId] = useState(''), [search, setSearch] = useState('');
    const [values, setValues] = useState({}), [reasons, setReasons] = useState({}), [directions, setDirections] = useState({});
    const [busyId, setBusyId] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [history, setHistory] = useState(null), [historyLoading, setHistoryLoading] = useState(false), [historyError, setHistoryError] = useState('');
    const submitting = useRef(false), requests = useRef({}), historyRevision = useRef(0);
    const members = users.filter(user => user.role === 'member');
    const selected = members.find(user => user._id === selectedId);
    const query = search.trim().toLowerCase();
    const filtered = members.filter(user => [user.fullName, user.email, user.phone].some(value => String(value || '').toLowerCase().includes(query)));
    const direction = directions[selectedId] || 'add';
    const amount = values[selectedId] ?? '';
    const delta = (direction === 'subtract' ? -1 : 1) * Number(amount);
    const reason = reasons[selectedId] || '';
    const balance = Number(selected?.memberPoints || 0);
    const afterUnits = Math.round(balance * 1000) + delta * 1000;
    const after = afterUnits / 1000;
    const validAmount = amount !== '' && Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && Number.isSafeInteger(afterUnits);
    // Báo rõ lý do quá ngắn để admin biết vì sao nút xác nhận chưa được bật.
    const reasonTooShort = reason.length > 0 && reason.trim().length < 5;
    const valid = validAmount && after >= 0 && reason.trim().length >= 5 && reason.trim().length <= 500;

    // Tải danh sách thành viên; bỏ phản hồi nếu người dùng đã rời trang.
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        getUsers().then(data => { if (active) setUsers(data); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; ++historyRevision.current; };
    }, [reloadKey]);

    // Lấy số dư/lịch sử mới, bỏ phản hồi cũ khi chọn người khác; đối chiếu yêu cầu đã gửi.
    async function showHistory(user) {
        const revision = ++historyRevision.current;
        setHistoryLoading(true); setHistoryError('');
        try {
            const result = await getPointHistory(user._id);
            if (revision !== historyRevision.current) return;
            const request = requests.current[user._id];
            if (request && result.entries.some(entry => entry.requestId === request.id)) {
                setValues(current => ({ ...current, [user._id]: '' }));
                setReasons(current => ({ ...current, [user._id]: '' }));
                delete requests.current[user._id];
                setNotice('Điều chỉnh trước đó đã được lưu thành công.'); setError('');
            } else if (request) request.expectedBalance = result.balance;
            setHistory({ ...result, memberId: user._id });
            setUsers(current => current.map(item => item._id === user._id ? { ...item, memberPoints: result.balance } : item));
        } catch (err) { if (revision === historyRevision.current) setHistoryError(err.message); }
        finally { if (revision === historyRevision.current) setHistoryLoading(false); }
    }

    // Đổi thành viên và tải dữ liệu tương ứng; bản nháp của từng người vẫn được giữ riêng.
    function selectMember(user) {
        if (submitting.current) return;
        setSelectedId(user._id); setHistory(null); setError(''); setNotice('');
        showHistory(user);
    }

    // Gửi số điểm có dấu, lý do, số dư đã xem và mã yêu cầu; chỉ xóa bản nháp khi đã lưu.
    async function submit(event) {
        event.preventDefault();
        if (submitting.current || !selected || !valid || historyLoading || historyError) return;
        const user = selected;
        submitting.current = true; setBusyId(user._id); setError(''); setNotice('');
        const payload = JSON.stringify({ delta, reason: reason.trim() });
        if (requests.current[user._id]?.payload !== payload) requests.current[user._id] = { payload, id: crypto.randomUUID(), expectedBalance: balance };
        try {
            const request = requests.current[user._id];
            const updated = await adjustPoints(user._id, delta, reason.trim(), request.expectedBalance, request.id);
            setUsers(current => current.map(item => item._id === user._id ? updated : item));
            setValues(current => ({ ...current, [user._id]: '' })); setReasons(current => ({ ...current, [user._id]: '' }));
            delete requests.current[user._id];
            const message = `Đã ${delta > 0 ? 'cộng' : 'trừ'} ${number(Math.abs(delta))} điểm cho ${user.fullName}.`;
            setNotice(message); setMsg?.(message);
            await showHistory(updated);
        } catch (err) { setError(err.message); }
        finally { submitting.current = false; setBusyId(''); }
    }

    return <section className="pointsAdmin" aria-labelledby="points-admin-title">
        <header className="pointsPageHeading"><div><p className="pointsEyebrow">THÀNH VIÊN / QUẢN LÝ ĐIỂM</p><h2 id="points-admin-title">Điều chỉnh điểm thành viên</h2><p>Cộng điểm bù hoặc trừ điểm sai, kèm lý do và lịch sử rõ ràng.</p></div><span className="pointsAdminBadge">CHỈ DÀNH CHO ADMIN</span></header>
        <div className="pointsWorkspace">
            <aside className="pointsDirectory" aria-label="Danh sách thành viên">
                <div className="pointsPanelHeading"><h3>Chọn thành viên</h3><span>{members.length} thành viên</span></div>
                <label className="pointsSearch">Tìm thành viên<input type="search" placeholder="Tên, email hoặc số điện thoại" value={search} onChange={event => setSearch(event.target.value)} /></label>
                <p className="pointsResultCount" role="status">{loading ? 'Đang tải danh sách…' : `${filtered.length} kết quả`}</p>
                {error && !selected && <div className="pointsFeedback error" role="alert"><p>{error}</p><button type="button" className="pointsRefresh" onClick={() => setReloadKey(value => value + 1)}>Thử lại</button></div>}
                <div className="pointsMemberList">{filtered.map(user => <button type="button" key={user._id} className={'pointsMember' + (selectedId === user._id ? ' selected' : '')} aria-pressed={selectedId === user._id} disabled={!!busyId} onClick={() => selectMember(user)}>
                    <span className="pointsAvatar" aria-hidden="true">{user.fullName?.charAt(0).toUpperCase() || 'M'}</span><span className="pointsMemberInfo"><strong>{user.fullName}</strong><span>{user.email}</span>{user.phone && <small>{user.phone}</small>}</span><span className="pointsMemberBalance"><b>{number(user.memberPoints)}</b><small>điểm</small></span>
                </button>)}</div>
                {!loading && !filtered.length && <p className="pointsEmpty">Không tìm thấy thành viên.<br />Thử tên, email hoặc số điện thoại khác.</p>}
            </aside>
            <div className="pointsEditorColumn">
                {!selected ? <div className="pointsWelcome"><span aria-hidden="true">±</span><h3>Bắt đầu từ một thành viên</h3><p>Chọn tài khoản trong danh sách để xem số dư, điều chỉnh điểm và tra cứu lịch sử.</p></div> : <>
                    <form className="pointsEditor" onSubmit={submit}>
                        <div className="pointsPanelHeading"><div><p className="pointsEyebrow">TÀI KHOẢN ĐANG CHỌN</p><h3>{selected.fullName}</h3><p className="pointsSelectedEmail">{selected.email}</p></div><div className="pointsCurrentBalance"><span>Số dư hiện tại</span><strong>{number(balance)} <small>điểm</small></strong></div></div>
                        {notice && <p className="pointsFeedback success" role="status">{notice}</p>}
                        {error && <p className="pointsFeedback error" role="alert">{error}</p>}
                        <fieldset disabled={!!busyId || historyLoading || !!historyError}>
                            <legend className="pointsFieldLabel">Bạn muốn điều chỉnh như thế nào?</legend>
                            <div className="pointsDirection" role="group" aria-label="Loại điều chỉnh">{[['add', '+', 'Cộng điểm', 'Bù điểm cho thành viên'], ['subtract', '−', 'Trừ điểm', 'Thu hồi điểm ghi nhận sai']].map(([key, icon, title, hint]) => <button type="button" key={key} aria-pressed={direction === key} className={direction === key ? `selected ${key}` : ''} onClick={() => setDirections(current => ({ ...current, [selectedId]: key }))}><span aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{hint}</small></span></button>)}</div>
                            <label className="pointsField" htmlFor="adjust-points-amount">Số điểm {direction === 'add' ? 'cộng' : 'trừ'} <span>*</span></label>
                            <div className="pointsAmountInput"><span aria-hidden="true">{direction === 'add' ? '+' : '−'}</span><input id="adjust-points-amount" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" required value={amount} onChange={event => { if (/^\d*$/.test(event.target.value)) setValues(current => ({ ...current, [selectedId]: event.target.value })); }} placeholder="Nhập số điểm" aria-invalid={amount !== '' && (!validAmount || after < 0)} aria-describedby="adjust-points-help" /><span>điểm</span></div>
                            <p id="adjust-points-help" className={amount !== '' && (!validAmount || after < 0) ? 'pointsFieldError' : 'pointsHint'}>{amount !== '' && !validAmount ? 'Nhập số điểm nguyên dương trong giới hạn cho phép.' : amount !== '' && after < 0 ? 'Số điểm trừ vượt số dư hiện tại. Vui lòng giảm số điểm.' : 'Nhập số nguyên dương. Loại điều chỉnh quyết định cộng hay trừ.'}</p>
                            <label className="pointsField" htmlFor="adjust-points-reason">Lý do điều chỉnh <span>*</span></label>
                            <textarea id="adjust-points-reason" rows="3" required minLength={5} maxLength={500} value={reason} onChange={event => setReasons(current => ({ ...current, [selectedId]: event.target.value }))} placeholder="Ví dụ: Bù điểm cho giao dịch chưa được ghi nhận…" aria-invalid={reasonTooShort} aria-describedby="adjust-reason-help" />
                            <p id="adjust-reason-help" className={`${reasonTooShort ? 'pointsFieldError' : 'pointsHint'} pointsReasonHint`} aria-live="polite"><span>{reasonTooShort ? `Lý do cần ít nhất 5 ký tự. Hiện có ${reason.trim().length} ký tự sau khi bỏ khoảng trắng đầu/cuối.` : 'Ít nhất 5 ký tự, ghi rõ lý do để tra cứu sau này.'}</span><span>{reason.length}/500</span></p>
                            <div className="pointsPreview" aria-live="polite"><div><span>Hiện có</span><strong>{number(balance)}</strong></div><span aria-hidden="true">→</span><div><span>Sau điều chỉnh</span><strong className={validAmount && after >= 0 ? direction : ''}>{amount !== '' && validAmount && after >= 0 ? number(after) : '—'} <small>điểm</small></strong></div></div>
                            <div className="pointsSubmitRow"><span>{reasonTooShort ? 'Bổ sung lý do đủ 5 ký tự để bật nút xác nhận.' : 'Thao tác được lưu cùng người thực hiện và thời gian.'}</span><button type="submit" className={'pointsSubmit ' + direction} disabled={!valid}>{busyId ? 'Đang lưu…' : `Xác nhận ${direction === 'add' ? 'cộng' : 'trừ'} điểm`}</button></div>
                        </fieldset>
                    </form>
                    <section className="pointsHistory" aria-label="Lịch sử điều chỉnh điểm"><div className="pointsPanelHeading"><div><h3>Lịch sử điều chỉnh</h3><p>20 lần điều chỉnh thủ công gần nhất</p></div><button type="button" className="pointsRefresh" disabled={!!busyId || historyLoading} onClick={() => showHistory(selected)}>{historyLoading ? 'Đang tải…' : '↻ Làm mới số dư'}</button></div>
                        {historyError && <p className="pointsFeedback error" role="alert">{historyError} Hãy làm mới số dư để tiếp tục.</p>}
                        {historyLoading && <p className="pointsEmpty" role="status">Đang cập nhật số dư và lịch sử…</p>}
                        {!historyLoading && !historyError && history?.memberId === selectedId && (history.entries.length ? <ol className="pointsHistoryList">{history.entries.map(entry => <li key={entry.requestId}><span className={'pointsHistoryDelta ' + (entry.delta > 0 ? 'add' : 'subtract')}>{entry.delta > 0 ? '+' : '−'}{number(Math.abs(entry.delta))}</span><div><strong>{entry.reason}</strong><p>{number(entry.before)} → {number(entry.after)} điểm · {entry.admin?.fullName || 'Admin'}</p><time>{date(entry.createdAt)}</time></div></li>)}</ol> : <div className="pointsEmpty"><strong>Chưa có điều chỉnh thủ công</strong><p>Các lần cộng hoặc trừ điểm sẽ xuất hiện tại đây.</p></div>)}
                    </section>
                </>}
            </div>
        </div>
    </section>;
}
