import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { listCatalogue, getCatalogueItem, createCatalogueItem, updateCatalogueItem } from '../../services/catalogueService';
import './movies.css';
import './catalogue.css';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const dateText = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const localDate = (value) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16);
const label = (kind) => kind === 'foods' ? 'F&B' : 'khuyến mãi';

function promotionState(item) {
  if (!item.active) return 'Tạm ngưng';
  if (Date.now() < new Date(item.startsAt).getTime()) return 'Chưa bắt đầu';
  if (Date.now() >= new Date(item.endsAt).getTime()) return 'Hết hạn';
  if (item.usageLimit !== null && item.usedCount >= item.usageLimit) return 'Hết lượt';
  return 'Đang hiệu lực';
}

function CatalogueTabs({ kind }) {
  return <nav className="catalogueTabs" aria-label="Danh mục quản trị">
    <Link className="movieSecondary" aria-current={kind === 'foods' ? 'page' : undefined} to="/admin/foods">Đồ ăn & thức uống</Link>
    <Link className="movieSecondary" aria-current={kind === 'promotions' ? 'page' : undefined} to="/admin/promotions">Khuyến mãi</Link>
  </nav>;
}

function CatalogueList({ kind }) {
  const location = useLocation();
  const [result, setResult] = useState({ items: [], total: 0, totalPages: 0 });
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const message = location.state?.message || '';
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError('');
    listCatalogue(kind, search, page).then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [kind, search, page, reload]);



  return <main className="movieAdmin"><div className="movieAdminShell">
    <Link className="movieBack" to="/admin/dashboard">← Trung tâm quản trị</Link>
    <CatalogueTabs kind={kind} />
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ</p>
      <h1>{kind === 'foods' ? 'Quản lý F&B' : 'Quản lý khuyến mãi'}</h1>
      <p>{kind === 'foods' ? 'Danh mục, giá bán và tồn kho tại rạp.' : 'Cấu hình mức giảm, thời hạn, giới hạn sử dụng và cộng dồn.'}</p></div>
      <Link className="moviePrimary" to={`/admin/${kind}/new`}>+ Thêm {label(kind)}</Link></header>
    {message && <p className="movieSuccess" role="status">{message}</p>}
    <section className="moviePanel" aria-label={`Danh sách ${label(kind)}`}>
      <form className="movieToolbar" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(keyword.trim()); setPage(1); }}>
        <label htmlFor="catalogue-search">{kind === 'foods' ? 'Tìm tên sản phẩm' : 'Tìm mã hoặc tên'}</label>
        <input id="catalogue-search" type="search" maxLength={100} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Nhập từ khóa…" />
        <button className="movieSecondary" type="submit">Tìm kiếm</button>
      </form>
      {loading && <p className="movieState" role="status">Đang tải danh mục…</p>}
      {!loading && error && <div className="movieError" role="alert">{error} <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Thử lại</button></div>}
      {!loading && !error && <>
        <p className="movieCount" role="status">{result.total} bản ghi{search && ` phù hợp với “${search}”`}</p>
        {result.items.length === 0 ? <p className="movieState">{search ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có dữ liệu. Chọn nút Thêm để bắt đầu.'}</p> :
          <div className="movieTableWrap"><table className="movieTable catalogueTable">
            <caption className="movieSrOnly">Danh sách {label(kind)}</caption>
            <thead><tr><th scope="col">{kind === 'foods' ? 'Sản phẩm' : 'Khuyến mãi'}</th><th scope="col">{kind === 'foods' ? 'Giá bán' : 'Mức giảm'}</th>
              <th scope="col">{kind === 'foods' ? 'Tồn kho' : 'Thời hạn (giờ VN)'}</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{result.items.map((item) => <tr key={item._id}>
              <td><strong>{item.name}</strong>{kind === 'promotions' && <p className="catalogueCode">{item.code}</p>}
                <details><summary>Chi tiết</summary><p className="movieDescription">{item.description || 'Chưa có mô tả.'}</p>
                  {kind === 'foods' ? <p className="movieMediaPath">Ảnh: {item.image || 'Chưa có'}</p> : <>
                    <p>Đơn tối thiểu: {money(item.minOrder)}</p><p>Giảm tối đa: {item.maxDiscount === null ? 'Không giới hạn' : money(item.maxDiscount)}</p>
                    <p>Phạm vi: {{ food: 'F&B', ticket: 'Vé', all: 'Vé và F&B' }[item.scope]}</p>
                    <p>Cộng dồn: {item.stackable ? 'Cho phép' : 'Không cho phép'}</p>
                    <p>Đã dùng: {item.usedCount} / {item.usageLimit === null ? 'Không giới hạn' : item.usageLimit}</p>
                  </>}
                </details></td>
              <td>{kind === 'foods' ? money(item.price) : <>{item.discountType === 'percentage' ? `${item.value}%` : money(item.value)}</>}</td>
              <td>{kind === 'foods' ? item.stock : <>{dateText(item.startsAt)}<br />đến {dateText(item.endsAt)}</>}</td>
              <td><span className="movieBadge">{kind === 'foods' ? (item.available ? 'Đang bán' : 'Ngừng bán') : promotionState(item)}</span></td>
              <td><Link className="movieSecondary" to={`/admin/${kind}/${item._id}/edit`} aria-label={`Sửa ${item.name}`}>Sửa</Link></td>
            </tr>)}</tbody>
          </table></div>}
        {result.totalPages > 1 && <nav className="moviePagination" aria-label="Phân trang danh mục">
          <button className="movieSecondary" disabled={page === 1} onClick={() => setPage(page - 1)}>← Trang trước</button>
          <span>Trang {page} / {result.totalPages}</span>
          <button className="movieSecondary" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Trang sau →</button>
        </nav>}
      </>}
    </section>
  </div></main>;
}

function CatalogueForm({ kind, editing }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', image: '', price: '', stock: '0', available: true,
    code: '', discountType: '', value: '', minOrder: '0', maxDiscount: '', scope: '', stackable: '', startsAt: '', endsAt: '', usageLimit: '', active: true });
  const [loading, setLoading] = useState(editing);
  const [loaded, setLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const errorRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    let ignore = false;
    setLoading(true); setLoaded(false); setError('');
    getCatalogueItem(kind, id).then((item) => {
      if (ignore) return;
      if (kind === 'foods') setForm({ name: item.name, description: item.description || '', image: item.image || '', price: String(item.price), stock: String(item.stock), available: item.available, version: item.__v });
      else setForm({ name: item.name, description: item.description, code: item.code, discountType: item.discountType,
        value: String(item.value), minOrder: String(item.minOrder), maxDiscount: item.maxDiscount === null ? '' : String(item.maxDiscount),
        scope: item.scope, stackable: String(item.stackable), startsAt: localDate(item.startsAt), endsAt: localDate(item.endsAt),
        usageLimit: item.usageLimit === null ? '' : String(item.usageLimit), active: item.active, usedCount: item.usedCount, version: item.__v });
      setLoaded(true);
    }).catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [kind, editing, id, reload]);

  function change(event) {
    const { name, type, value, checked } = event.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError('');
    try {
      let data;
      if (kind === 'foods') data = { name: form.name, description: form.description, image: form.image, price: Number(form.price), stock: Number(form.stock), available: form.available, version: form.version };
      else data = { name: form.name, description: form.description, code: form.code, discountType: form.discountType, value: Number(form.value),
        minOrder: Number(form.minOrder), maxDiscount: form.discountType === 'percentage' && form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
        scope: form.scope, stackable: form.stackable === 'true', startsAt: `${form.startsAt}:00+07:00`, endsAt: `${form.endsAt}:00+07:00`,
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit), active: form.active, version: form.version };
      const result = editing ? await updateCatalogueItem(kind, id, data) : await createCatalogueItem(kind, data);
      navigate(`/admin/${kind}`, { replace: true, state: { message: `${editing ? 'Đã cập nhật' : 'Đã thêm'} “${result.name}”.` } });
    } catch (err) { setError(err.message); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { submitting.current = false; setSaving(false); }
  }

  const used = kind === 'promotions' && form.usedCount > 0;
  return <main className="movieAdmin"><div className="movieAdminShell movieFormShell">
    <Link className="movieBack" to={`/admin/${kind}`}>← Danh sách {label(kind)}</Link>
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ DANH MỤC</p>
      <h1>{editing ? 'Cập nhật' : 'Thêm'} {label(kind)}</h1>
      <p>{kind === 'foods' ? 'Thông tin sản phẩm, giá bán và số lượng thực tế trong kho.' : 'Chọn rõ phạm vi và chính sách áp dụng của chương trình.'}</p></div></header>
    {loading && <p role="status">Đang tải thông tin…</p>}
    {error && !loaded && <div className="movieError" role="alert">{error} <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Tải lại</button></div>}
    {!loading && loaded && <form className="moviePanel movieForm" onSubmit={submit}>
      {error && <p className="movieError" ref={errorRef} tabIndex={-1} role="alert">{error}</p>}
      {editing && <button className="movieSecondary" type="button" disabled={saving} onClick={() => { if (window.confirm('Bỏ thay đổi chưa lưu và tải lại dữ liệu?')) setReload(reload + 1); }}>Tải lại dữ liệu</button>}
      <p className="movieFormHint">Các trường có dấu * là bắt buộc.{kind === 'promotions' && ' Thời gian theo giờ Việt Nam (UTC+7).'}</p>
      {used && <p className="movieWarning">Đã có {form.usedCount} lượt dùng. Mã, loại giảm, mức giảm và phạm vi được khóa để giữ lịch sử.</p>}
      <fieldset disabled={saving}><legend className="movieSrOnly">Thông tin {label(kind)}</legend><div className="movieFormGrid">
        <label className="movieWide" htmlFor="catalogue-name">Tên {label(kind)} *<input id="catalogue-name" name="name" required maxLength={kind === 'foods' ? 100 : 120} value={form.name} onChange={change} autoFocus /></label>
        <label className="movieWide" htmlFor="catalogue-description">Mô tả<textarea id="catalogue-description" name="description" maxLength={2000} value={form.description} onChange={change} rows={3} /></label>
        {kind === 'foods' ? <>
          <label htmlFor="food-price">Giá bán (VND) *<input id="food-price" name="price" type="number" required min={0} max={1000000000} step={1} value={form.price} onChange={change} /></label>
          <label htmlFor="food-stock">Tồn kho *<input id="food-stock" name="stock" type="number" required min={0} max={1000000000} step={1} value={form.stock} onChange={change} /><small>Số lượng hiện có; lưu lại sẽ cập nhật kho về số này.</small></label>
          <label className="movieWide" htmlFor="food-image">Đường dẫn ảnh<input id="food-image" name="image" maxLength={2048} value={form.image} onChange={change} placeholder="https://… hoặc /images/foods/…" /></label>
          <label className="movieWide movieCheckbox" htmlFor="food-available"><input id="food-available" name="available" type="checkbox" checked={form.available} onChange={change} />Đang bán</label>
        </> : <>
          <label htmlFor="promotion-code">Mã khuyến mãi *<input id="promotion-code" name="code" required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,39}" disabled={used} value={form.code} onChange={change} placeholder="CINEMA10" /><small>Mã được chuyển thành chữ in hoa khi lưu.</small></label>
          <label htmlFor="promotion-type">Loại giảm *<select id="promotion-type" name="discountType" required disabled={used} value={form.discountType} onChange={change}>
            <option value="">Chọn loại giảm</option><option value="percentage">Phần trăm (%)</option><option value="fixed">Số tiền cố định (VND)</option></select></label>
          <label htmlFor="promotion-value">Mức giảm *<input id="promotion-value" name="value" type="number" required min={1} max={form.discountType === 'percentage' ? 100 : 1000000000} step={1} disabled={used} value={form.value} onChange={change} /></label>
          <label htmlFor="promotion-min">Giá trị đơn tối thiểu (VND) *<input id="promotion-min" name="minOrder" type="number" required min={0} max={1000000000} step={1} value={form.minOrder} onChange={change} /></label>
          {form.discountType === 'percentage' && <label htmlFor="promotion-cap">Giảm tối đa (VND)<input id="promotion-cap" name="maxDiscount" type="number" min={1} max={1000000000} step={1} value={form.maxDiscount} onChange={change} /><small>Để trống nếu không giới hạn.</small></label>}
          <label htmlFor="promotion-scope">Phạm vi áp dụng *<select id="promotion-scope" name="scope" required disabled={used} value={form.scope} onChange={change}>
            <option value="">Chọn phạm vi</option><option value="food">F&B</option><option value="ticket">Vé</option><option value="all">Vé và F&B</option></select></label>
          <label htmlFor="promotion-stacking">Cộng dồn khuyến mãi *<select id="promotion-stacking" name="stackable" required value={form.stackable} onChange={change}>
            <option value="">Chọn chính sách</option><option value="false">Không cho cộng dồn</option><option value="true">Cho phép cộng dồn</option></select></label>
          <label htmlFor="promotion-start">Bắt đầu (giờ VN) *<input id="promotion-start" name="startsAt" type="datetime-local" required step={60} value={form.startsAt} onChange={change} /></label>
          <label htmlFor="promotion-end">Kết thúc (giờ VN) *<input id="promotion-end" name="endsAt" type="datetime-local" required step={60} value={form.endsAt} onChange={change} /></label>
          <label htmlFor="promotion-limit">Giới hạn tổng số lượt dùng<input id="promotion-limit" name="usageLimit" type="number" min={Math.max(1, form.usedCount || 0)} max={1000000000} step={1} value={form.usageLimit} onChange={change} /><small>Để trống nếu không giới hạn. Số lượt đã dùng do hệ thống ghi nhận.</small></label>
          <label className="movieWide movieCheckbox" htmlFor="promotion-active"><input id="promotion-active" name="active" type="checkbox" checked={form.active} onChange={change} />Kích hoạt chương trình</label>
        </>}
      </div></fieldset>
      <div className="movieFormActions"><button className="movieSecondary" type="button" disabled={saving} onClick={() => navigate(`/admin/${kind}`)}>Hủy</button>
        <button className="moviePrimary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button></div>
    </form>}
  </div></main>;
}

export default function ManageCatalogue({ kind, editing = false, creating = false }) {
  if (editing || creating) return <CatalogueForm key={`${kind}-${editing}`} kind={kind} editing={editing} />;
  return <CatalogueList key={kind} kind={kind} />;
}
