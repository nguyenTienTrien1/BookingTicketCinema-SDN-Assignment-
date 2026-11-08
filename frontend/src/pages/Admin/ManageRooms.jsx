import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRooms, getRoom, createRoom, updateRoom, deleteRoom, generateSeats } from '../../services/roomService';
import './movies.css';
import './rooms.css';

const labels = { Active: 'Hoạt động', Inactive: 'Chưa hoạt động', Maintenance: 'Bảo trì' };
const createLabels = { Active: 'Hoạt động', Inactive: 'Chưa hoạt động' };
const editLabels = { ...labels, Inactive: 'Ngừng hoạt động' };
const empty = { cinema: '', name: '', status: 'Inactive', rows: '5', columns: '8' };

export default function ManageRooms() {
  const [result, setResult] = useState({ rooms: [], cinemas: [], total: 0, totalPages: 0 });
  const [keyword, setKeyword] = useState(''), [search, setSearch] = useState('');
  const [cinema, setCinema] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [reload, setReload] = useState(0), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [mode, setMode] = useState(''), [selected, setSelected] = useState(null), [form, setForm] = useState(empty);
  const [formError, setFormError] = useState(''), [saving, setSaving] = useState(false);
  const busy = useRef(false), editor = useRef(null), errorRef = useRef(null);
  const formLabels = mode === 'create' ? createLabels : editLabels;
  const saveClass = mode === 'delete' ? 'roomActionDelete' : 'roomActionSave';

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getRooms({ search, cinema, status, page: String(page), limit: '10' })
      .then(data => { if (active) setResult(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, cinema, status, page, reload]);
  useEffect(() => { if (mode) editor.current?.focus(); }, [mode]);
  useEffect(() => { if (formError) errorRef.current?.focus(); }, [formError]);

  async function open(nextMode, room) {
    setFormError(''); setMessage('');
    try {
      const fresh = room ? await getRoom(room._id) : null;
      setSelected(fresh); setForm(fresh ? { ...empty, cinema: fresh.cinema, name: fresh.name, status: fresh.status } : empty);
      setMode(nextMode);
    } catch (err) { setError(err.message); }
  }
  function close() { setMode(''); setSelected(null); setFormError(''); }
  function refresh() { close(); setReload(value => value + 1); }
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setSaving(true); setFormError('');
    try {
      let response;
      if (mode === 'delete') response = await deleteRoom(selected._id, selected.version);
      else {
        const data = { cinema: form.cinema.trim(), name: form.name.trim(), status: form.status };
        if (mode === 'create') {
          data.seats = generateSeats(Number(form.rows), Number(form.columns));
          response = await createRoom(data);
        } else response = await updateRoom(selected._id, { ...data, version: selected.version });
      }
      setMessage(response.message); close(); setPage(1); setReload(value => value + 1);
    } catch (err) { setFormError(err.message); }
    finally { busy.current = false; setSaving(false); }
  }

  return <main className="movieAdmin roomAdmin"><div className="movieAdminShell">
    <Link className="movieBack" to="/account?section=profile">← Trung tâm quản trị</Link>
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ</p>
      <h1>Quản lý phòng chiếu</h1><p>Thông tin phòng, sơ đồ ghế và tình trạng vận hành.</p></div>
      <button className="moviePrimary roomAction roomActionAdd" disabled={saving} onClick={() => open('create')}>+ Thêm phòng</button></header>
    {message && <p className="movieSuccess" role="status">{message}</p>}
    {mode && <section className="moviePanel roomEditorPanel" aria-labelledby="room-form-title">
      <form className="movieForm" onSubmit={submit}>
        <h2 id="room-form-title" tabIndex={-1} ref={editor}>{mode === 'create' ? 'Thêm phòng chiếu' : mode === 'edit' ? 'Sửa phòng chiếu' : 'Xác nhận xóa phòng'}</h2>
        {formError && <div className="movieError" role="alert" tabIndex={-1} ref={errorRef}><p>{formError}</p><button type="button" className="movieSecondary" onClick={refresh}>Tải lại danh sách</button></div>}
        <fieldset disabled={saving}>{mode === 'delete' ? <>
          <p><strong>{selected.cinema} · {selected.name}</strong> — {selected.capacity} ghế</p>
          <p className="movieWarning">Chỉ xóa phòng chưa có tham chiếu suất chiếu. Lịch sử đặt vé luôn được giữ lại.</p>
        </> : <div className="movieFormGrid">
          <label>Rạp<input name="cinema" required maxLength={100} value={form.cinema} onChange={change} list="room-cinemas" /></label>
          <datalist id="room-cinemas">{result.cinemas.map(name => <option key={name} value={name} />)}</datalist>
          <label>Tên phòng<input name="name" required maxLength={100} value={form.name} onChange={change} /></label>
          <label>Trạng thái<select className={`roomStatusSelect roomStatus${form.status}`} aria-label="Trạng thái" name="status" value={form.status} onChange={change}>{Object.keys(formLabels).map(value => <option className={`roomStatus${value}`} key={value} value={value}>{formLabels[value]}</option>)}</select></label>
          {mode === 'create' && <><label>Số hàng<input name="rows" type="number" required min="1" max="26" value={form.rows} onChange={change} /></label>
            <label>Ghế mỗi hàng<input name="columns" type="number" required min="1" max="40" value={form.columns} onChange={change} /></label>
            <p className="movieFormHint movieWide">Tạo {Number(form.rows) * Number(form.columns) || 0} ghế Standard / Active, tối đa 1000 ghế. Sau khi tạo, chọn “Cấu hình ghế” để chỉnh từng vị trí. Phòng mới mặc định chưa hoạt động.</p></>}
          {mode === 'edit' && <p className="movieFormHint movieWide">Không đổi tên phòng đã có lịch sử suất chiếu; không ngừng hoạt động phòng còn suất chưa kết thúc.</p>}
        </div>}
          <div className="movieFormActions"><button className="movieSecondary" type="button" onClick={close}>Hủy</button>
            <button className={`moviePrimary roomAction ${saveClass}`} type="submit">{saving ? 'Đang lưu…' : mode === 'delete' ? 'Xác nhận xóa' : 'Lưu phòng'}</button></div>
        </fieldset>
      </form>
    </section>}
    <section className="moviePanel" aria-label="Danh sách phòng chiếu" aria-busy={loading}>
      <form className="movieToolbar roomToolbar" onSubmit={event => { event.preventDefault(); setSearch(keyword.trim()); setPage(1); }} role="search">
        <label>Tìm phòng<input type="search" value={keyword} maxLength={200} onChange={event => setKeyword(event.target.value)} placeholder="Tên phòng chiếu" /></label>
        <label>Rạp<select aria-label="Rạp" value={cinema} onChange={event => { setCinema(event.target.value); setPage(1); }}><option value="">Tất cả rạp</option>{result.cinemas.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Trạng thái<select className={`roomStatusSelect${status ? ' roomStatus' + status : ''}`} aria-label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.keys(labels).map(value => <option className={`roomStatus${value}`} key={value} value={value}>{labels[value]}</option>)}</select></label>
        <button className="movieSecondary" type="submit">Tìm kiếm</button><button className="movieSecondary" type="button" onClick={refresh} disabled={saving}>Tải lại</button>
      </form>
      {loading ? <p className="movieState" role="status">Đang tải phòng chiếu…</p> : error ? <div className="movieError" role="alert"><p>{error}</p><button className="movieSecondary" onClick={refresh}>Thử lại</button></div> : <>
        <p className="movieCount" role="status">{result.total} phòng chiếu</p>
        {!result.rooms.length ? <div className="movieState"><h2>Chưa có phòng phù hợp</h2><p>Điều chỉnh bộ lọc hoặc thêm phòng chiếu mới.</p></div> : <div className="movieTableWrap"><table className="movieTable roomTable">
          <caption className="movieSrOnly">Phòng chiếu và cấu hình ghế</caption><thead><tr><th>Rạp / Phòng</th><th>Sức chứa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{result.rooms.map(room => <tr key={room._id}><td><strong>{room.name}</strong><div className="movieGenres">{room.cinema}</div></td><td>{room.capacity} ghế</td>
            <td><span className={`movieBadge roomStatus roomStatus${room.status}`}>{labels[room.status]}</span></td><td><div className="roomActions">
              <Link className="movieSecondary roomAction roomActionConfigure" to={`/admin/rooms/${room._id}/seats`}>Cấu hình ghế</Link>
              <button className="movieSecondary roomAction roomActionEdit" disabled={saving} onClick={() => open('edit', room)} aria-label={`Sửa ${room.name}`}>Sửa</button>
              <button className="movieSecondary roomAction roomActionDelete" disabled={saving} onClick={() => open('delete', room)} aria-label={`Xóa ${room.name}`}>Xóa</button>
            </div></td></tr>)}</tbody></table></div>}
        {result.totalPages > 1 && <nav className="moviePagination" aria-label="Phân trang phòng"><button className="movieSecondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>{page} / {result.totalPages}</span><button className="movieSecondary" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button></nav>}
      </>}
    </section>
  </div></main>;
}
