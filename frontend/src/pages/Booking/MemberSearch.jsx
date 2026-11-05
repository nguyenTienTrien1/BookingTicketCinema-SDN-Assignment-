import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { searchMembers, getMember } from '../../services/memberService';
import { translateAccountStatus } from '../../utils/uiText';
import '../Admin/movies.css';
import './memberSearch.css';

function accountStatus(status) {
    return status === 'Pending Verification' ? 'Chờ xác thực email' : translateAccountStatus(status);
}

function formatDate(value) {
    if (!value) return 'Chưa có thông tin';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN');
}

export default function MemberSearch() {
    const { user } = useAuth();
    const isAdmin = user.role === 'admin';
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [selected, setSelected] = useState(null);
    const [searching, setSearching] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState('');
    const [detailError, setDetailError] = useState('');
    const request = useRef(null);
    const input = useRef(null);
    const detailHeading = useRef(null);

    useEffect(() => () => { request.current?.abort(); }, []);
    useEffect(() => { if (selected) detailHeading.current?.focus(); }, [selected]);

    function changeQuery(value) {
        request.current?.abort();
        setQuery(value);
        setResult(null);
        setSelected(null);
        setError('');
        setDetailError('');
        setSearching(false);
        setDetailLoading(false);
    }

    async function search(event) {
        event.preventDefault();
        if (!query.trim()) {
            setError('Vui lòng nhập email hoặc số điện thoại của thành viên.');
            input.current.focus();
            return;
        }
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setSearching(true);
        setDetailLoading(false);
        setResult(null);
        setSelected(null);
        setError('');
        setDetailError('');
        try {
            const data = await searchMembers(query.trim(), controller.signal);
            if (!Array.isArray(data.members)) throw new Error('Không thể đọc kết quả tra cứu. Vui lòng thử lại.');
            if (!controller.signal.aborted) setResult(data);
        } catch (err) {
            if (!controller.signal.aborted) { setError(err.message); input.current?.focus(); }
        } finally { if (!controller.signal.aborted) setSearching(false); }
    }

    async function selectMember(id) {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setSelected(null);
        setDetailLoading(true);
        setDetailError('');
        try {
            const data = await getMember(id, controller.signal);
            if (!data.member?._id) throw new Error('Không thể đọc thông tin thành viên.');
            if (!controller.signal.aborted) setSelected(data.member);
        } catch (err) {
            if (!controller.signal.aborted) setDetailError(err.message);
        } finally { if (!controller.signal.aborted) setDetailLoading(false); }
    }

    return <main className="movieAdmin memberSearch">
        <div className="movieAdminShell">
            <Link className="movieBack" to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'}>
                ← {isAdmin ? 'Bảng điều khiển quản trị' : 'Bảng điều khiển nhân viên'}
            </Link>
            <header className="movieAdminHeading">
                <div><p className="movieEyebrow">{isAdmin ? 'QUẢN TRỊ CINEMA+' : 'QUẦY VÉ CINEMA+'}</p><h1>Tra cứu thành viên</h1>
                    <p>{isAdmin ? 'Tìm bằng email hoặc số điện thoại để xem thông tin hồ sơ và hoạt động tài khoản thành viên.'
                        : 'Tìm bằng email hoặc số điện thoại, sau đó chọn thành viên để xem thông tin phục vụ tại quầy.'}</p></div>
            </header>
            <section className="moviePanel" aria-label="Tra cứu thành viên">
                <form className="memberSearchForm" onSubmit={search} noValidate>
                    <label htmlFor="member-query">Email hoặc số điện thoại</label>
                    <div className="memberSearchInput">
                        <input ref={input} id="member-query" type="search" value={query} maxLength={254}
                            autoComplete="off" spellCheck={false} required aria-invalid={Boolean(error)}
                            aria-describedby={`member-search-hint${error ? ' member-search-error' : ''}`}
                            onChange={(event) => changeQuery(event.target.value)} placeholder="Ví dụ: member@cinema.com hoặc 0901 234 567" />
                        <button className="moviePrimary" type="submit" disabled={searching}>{searching ? 'Đang tìm…' : 'Tìm thành viên'}</button>
                    </div>
                    <p id="member-search-hint">Nhập đầy đủ email hoặc số điện thoại. Có thể dùng đầu số 0 hoặc +84.</p>
                    {error && <p id="member-search-error" className="movieError" role="alert">{error}</p>}
                </form>
                <div className="memberSearchGrid">
                    <section aria-label="Kết quả tìm kiếm" aria-busy={searching}>
                        <h2>Kết quả tìm kiếm</h2>
                        {searching && <p role="status">Đang tìm thành viên…</p>}
                        {!searching && !result && !error && <p className="memberSearchHint">Nhập thông tin phía trên để bắt đầu tra cứu.</p>}
                        {result && <p className="memberSearchHint" role="status">{result.members.length === 0 ? 'Không tìm thấy thành viên phù hợp.' : `Tìm thấy ${result.members.length} thành viên.`}</p>}
                        {result?.hasMore && <p className="memberSearchHint">Chỉ hiển thị 20 kết quả đầu tiên. Hãy dùng email để xác định đúng thành viên.</p>}
                        <ul className="memberSearchList">
                            {result?.members.map((member) => <li key={member._id}>
                                <button type="button" disabled={detailLoading} aria-pressed={selected?._id === member._id}
                                    onClick={() => selectMember(member._id)}>
                                    <strong>{member.fullName}</strong><span>{member.email}</span><span>{member.phone || 'Chưa có số điện thoại'}</span>
                                    <span>{accountStatus(member.status)}</span><span className="memberSearchChoose">Xem thông tin →</span>
                                </button>
                            </li>)}
                        </ul>
                    </section>
                    <section className="memberSearchDetail" aria-label="Thông tin thành viên" aria-busy={detailLoading}>
                        <h2 ref={detailHeading} tabIndex={-1}>Thông tin thành viên</h2>
                        {detailLoading && <p role="status">Đang tải thông tin mới nhất…</p>}
                        {detailError && <p className="movieError" role="alert">{detailError} Chọn lại thành viên để thử lại.</p>}
                        {!selected && !detailLoading && !detailError && <p className="memberSearchHint">Chọn một thành viên từ kết quả tìm kiếm.</p>}
                        {selected && <dl className="memberSearchDetails">
                            <div><dt>Họ và tên</dt><dd>{selected.fullName}</dd></div>
                            <div><dt>Email</dt><dd>{selected.email}</dd></div>
                            <div><dt>Số điện thoại</dt><dd>{selected.phone || 'Chưa có thông tin'}</dd></div>
                            <div><dt>Trạng thái tài khoản</dt><dd>{accountStatus(selected.status)}</dd></div>
                            <div><dt>Điểm thành viên</dt><dd>{Number(selected.memberPoints || 0).toLocaleString('vi-VN')} điểm</dd></div>
                            <div><dt>Hạng thành viên</dt><dd>{selected.isVIP ? 'VIP' : 'Thành viên thường'}</dd></div>
                            {isAdmin && <>
                                <div><dt>Tuổi</dt><dd>{selected.age ?? 'Chưa có thông tin'}</dd></div>
                                <div><dt>Giới tính</dt><dd>{{ Male: 'Nam', Female: 'Nữ', Other: 'Khác' }[selected.gender] || 'Chưa có thông tin'}</dd></div>
                                <div><dt>Ngày tạo tài khoản</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                                <div><dt>Cập nhật gần nhất</dt><dd>{formatDate(selected.updatedAt)}</dd></div>
                                <div><dt>Đăng nhập gần nhất</dt><dd>{formatDate(selected.lastLogin)}</dd></div>
                            </>}
                        </dl>}
                    </section>
                </div>
            </section>
        </div>
    </main>;
}
