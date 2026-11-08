import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { listCatalogue, getCatalogueItem, createCatalogueItem, updateCatalogueItem, deleteCatalogueItem, uploadFoodImage, foodImageUrl } from '../../services/catalogueService';
import './movies.css';
import './catalogue.css';
import './adminEditor.css';
import { vietnamToday, shiftDay, readPromotionWindow, promotionWindowPayload, switchPromotionWindow, displayDay } from '../../utils/promotionWindow';
import FormFieldError, { useFieldErrors } from '../../components/FormFieldError';
import { foodImage } from '../../components/FoodPicker';
import placeholder from '../../assets/foods/placeholder.svg';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const dateText = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const label = (kind) => kind === 'foods' ? 'F&B' : 'khuyến mãi';

function PromotionDates({ item }) {
  const window = readPromotionWindow(item.startsAt, item.endsAt);
  return window.specificTime ? <PromotionDates item={item} /> : <>Từ {displayDay(window.startsAt)}<br />đến hết {displayDay(window.endsAt)}</>;
}

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');
  const [reload, setReload] = useState(0);
  const deleting = useRef(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError('');
    listCatalogue(kind, search, page).then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [kind, search, page, reload]);

  async function remove(item) {
    if (deleting.current || !window.confirm(`Xóa ${label(kind)} “${item.name}” khỏi danh mục? Lịch sử giao dịch vẫn được giữ lại.`)) return;
    deleting.current = true; setBusy(true); setActionError(''); setMessage('');
    try {
      await deleteCatalogueItem(kind, item._id, item.__v);
      setMessage(`Đã xóa “${item.name}”.`);
      if (page > 1 && result.items.length === 1) setPage(page - 1);
      else setReload(reload + 1);
    } catch (err) { setActionError(err.message); }
    finally { deleting.current = false; setBusy(false); }
  }

  return <main className="movieAdmin"><div className="movieAdminShell">
    <Link className="movieBack" to="/admin/dashboard">← Trung tâm quản trị</Link>
    <CatalogueTabs kind={kind} />
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ</p>
      <h1>{kind === 'foods' ? 'Quản lý F&B' : 'Quản lý khuyến mãi'}</h1>
      <p>{kind === 'foods' ? 'Danh mục, giá bán và tồn kho tại rạp.' : 'Cấu hình mức giảm, thời hạn, giới hạn sử dụng và cộng dồn.'}</p></div>
      <Link className="moviePrimary" to={`/admin/${kind}/new`}>+ Thêm {label(kind)}</Link></header>
    {message && <p className="movieSuccess" role="status">{message}</p>}
    {actionError && <p className="movieError" role="alert">{actionError}</p>}
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
                  {kind === 'foods' ? <>{item.image && <img className="catalogueFoodThumbnail" src={foodImageUrl(item.image)} alt={item.name} loading="lazy" />}<p className="movieMediaPath">Ảnh: {item.image || 'Chưa có'}</p></> : <>
                    <p>Đơn tối thiểu: {money(item.minOrder)}</p><p>Giảm tối đa: {item.maxDiscount === null ? 'Không giới hạn' : money(item.maxDiscount)}</p>
                    <p>Phạm vi: {{ food: 'F&B', ticket: 'Vé', all: 'Vé và F&B' }[item.scope]}</p>
                    <p>Cộng dồn: {item.stackable ? 'Cho phép' : 'Không cho phép'}</p>
                    <p>Đã dùng: {item.usedCount} / {item.usageLimit === null ? 'Không giới hạn' : item.usageLimit}</p>
                  </>}
                </details></td>
              <td>{kind === 'foods' ? money(item.price) : <>{item.discountType === 'percentage' ? `${item.value}%` : money(item.value)}</>}</td>
              <td>{kind === 'foods' ? item.stock : <>{dateText(item.startsAt)}<br />đến {dateText(item.endsAt)}</>}</td>
              <td><span className="movieBadge">{kind === 'foods' ? (item.available ? 'Đang bán' : 'Ngừng bán') : promotionState(item)}</span></td>
              <td><div className="catalogueActions"><Link className="movieSecondary" to={`/admin/${kind}/${item._id}/edit`} aria-label={`Sửa ${item.name}`}>Sửa</Link>
                <button className="movieSecondary" disabled={busy} onClick={() => remove(item)} aria-label={`Xóa ${item.name}`}>Xóa</button></div></td>
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
    code: '', discountType: '', value: '', minOrder: '0', maxDiscount: '', scope: '', stackable: '', startsAt: vietnamToday(), endsAt: vietnamToday(), usageLimit: '', active: true });
  const [specificTime, setSpecificTime] = useState(false);
  const originalWindow = useRef(null);
  const [loading, setLoading] = useState(editing);
  const [loaded, setLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const errorRef = useRef(null);
  const fileInput = useRef(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState('');
  const [preview, setPreview] = useState('');
  const { fieldErrors, onInvalid, onChange, resetFieldErrors } = useFieldErrors();

  useEffect(() => {
    if (kind !== 'foods') return;
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(/^(https?:\/\/|\/(?!\/))/.test(form.image || '') ? foodImage({ image: form.image, name: form.name }) : '');
  }, [kind, imageFile, form.image]);

  function chooseImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setImageError('Chọn ảnh JPG, PNG hoặc WebP, dung lượng tối đa 5 MB.');
      event.target.value = '';
      return;
    }
    setImageError('');
    setImageFile(file);
  }

  function clearImageSelection() {
    setImageFile(null); setImageError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  useEffect(() => {
    if (!editing) return;
    let ignore = false;
    setLoading(true); setLoaded(false); setError('');
    getCatalogueItem(kind, id).then((item) => {
      if (ignore) return;
      if (kind === 'foods') setForm({ name: item.name, description: item.description || '', image: item.image || '', price: String(item.price), stock: String(item.stock), available: item.available, version: item.__v });
      else {
        const window = readPromotionWindow(item.startsAt, item.endsAt);
        originalWindow.current = window; setSpecificTime(window.specificTime);
        setForm({ name: item.name, description: item.description, code: item.code, discountType: item.discountType,
        value: String(item.value), minOrder: String(item.minOrder), maxDiscount: item.maxDiscount === null ? '' : String(item.maxDiscount),
        scope: item.scope, stackable: String(item.stackable), startsAt: window.startsAt, endsAt: window.endsAt,
        usageLimit: item.usageLimit === null ? '' : String(item.usageLimit), active: item.active, usedCount: item.usedCount, version: item.__v });
      }
      setImageFile(null); setImageError('');
      if (fileInput.current) fileInput.current.value = '';
      setLoaded(true);
    }).catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [kind, editing, id, reload]);

  function change(event) {
    const { name, type, value, checked } = event.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }
  function chooseDuration(days) {
    resetFieldErrors();
    const today = vietnamToday();
    setSpecificTime(false);
    setForm(current => ({ ...current, startsAt: today, endsAt: shiftDay(today, days - 1) }));
  }
  function toggleSpecificTime(checked) {
    resetFieldErrors();
    setForm(current => ({ ...current, ...switchPromotionWindow(current, checked) }));
    setSpecificTime(checked);
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || imageError) return;
    submitting.current = true; setSaving(true); setError('');
    try {
      let data;
      if (kind === 'foods') {
        let image = form.image;
        if (imageFile) {
          image = await uploadFoodImage(imageFile);
          setForm((current) => ({ ...current, image }));
          clearImageSelection();
        }
        data = { name: form.name, description: form.description, image, price: Number(form.price), stock: Number(form.stock), available: form.available, version: form.version };
      }
      else data = { name: form.name, description: form.description, code: form.code, discountType: form.discountType, value: Number(form.value),
        minOrder: Number(form.minOrder), maxDiscount: form.discountType === 'percentage' && form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
        scope: form.scope, stackable: form.stackable === 'true', ...promotionWindowPayload(form, specificTime, originalWindow.current),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit), active: form.active, version: form.version };
      const result = editing ? await updateCatalogueItem(kind, id, data) : await createCatalogueItem(kind, data);
      navigate(`/admin/${kind}`, { replace: true, state: { message: `${editing ? 'Đã cập nhật' : 'Đã thêm'} “${result.name}”.` } });
    } catch (err) { setError(err.message); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { submitting.current = false; setSaving(false); }
  }

  const used = kind === 'promotions' && form.usedCount > 0;
  return <main className="movieAdmin adminEditorPage"><div className="movieAdminShell movieFormShell">
    <Link className="movieBack" to={`/admin/${kind}`}>← Danh sách {label(kind)}</Link>
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ DANH MỤC</p>
      <h1>{editing ? 'Cập nhật' : 'Thêm'} {label(kind)}</h1>
      <p>{kind === 'foods' ? 'Thông tin sản phẩm, giá bán và số lượng thực tế trong kho.' : 'Chọn rõ phạm vi và chính sách áp dụng của chương trình.'}</p></div></header>
    {loading && <p role="status">Đang tải thông tin…</p>}
    {error && !loaded && <div className="movieError" role="alert">{error} <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Tải lại</button></div>}
    {!loading && loaded && <form className="moviePanel movieForm adminEditorForm" onSubmit={submit} onInvalidCapture={onInvalid} onChangeCapture={onChange}>
      {error && <p className="movieError" ref={errorRef} tabIndex={-1} role="alert">{error}</p>}
      {editing && <button className="movieSecondary" type="button" disabled={saving} onClick={() => { if (window.confirm('Bỏ thay đổi chưa lưu và tải lại dữ liệu?')) setReload(reload + 1); }}>Tải lại dữ liệu</button>}
      <p className="movieFormHint">Các trường có dấu * là bắt buộc.{kind === 'promotions' && ' Thời gian theo giờ Việt Nam (UTC+7).'}</p>
      {used && <p className="movieWarning">Đã có {form.usedCount} lượt dùng. Mã, loại giảm, mức giảm và phạm vi được khóa để giữ lịch sử.</p>}
      <fieldset disabled={saving}><legend className="movieSrOnly">Thông tin {label(kind)}</legend><div className="adminEditorLayout"><div className="movieFormGrid adminEditorMain">
        <div className="adminSectionHeading first"><span>01</span><h2>Thông tin {kind === 'foods' ? 'sản phẩm' : 'chương trình'}</h2></div>
        <label className="movieWide" htmlFor="catalogue-name">Tên {label(kind)} *<input id="catalogue-name" name="name" required maxLength={kind === 'foods' ? 100 : 120} value={form.name} onChange={change} autoFocus /><FormFieldError error={fieldErrors['catalogue-name']} /></label>
        <label className="movieWide" htmlFor="catalogue-description">Mô tả<textarea id="catalogue-description" name="description" maxLength={2000} value={form.description} onChange={change} rows={3} /><FormFieldError error={fieldErrors['catalogue-description']} /></label>
        {kind === 'foods' ? <>
          <div className="adminSectionHeading"><span>02</span><h2>Giá bán & tồn kho</h2></div>
          <label htmlFor="food-price">Giá bán (VND) *<input id="food-price" name="price" type="number" required min={0} max={1000000000} step={1} value={form.price} onChange={change} /><FormFieldError error={fieldErrors['food-price']} /></label>
          <label htmlFor="food-stock">Tồn kho *<input id="food-stock" name="stock" type="number" required min={0} max={1000000000} step={1} value={form.stock} onChange={change} /><small>Số lượng hiện có; lưu lại sẽ cập nhật kho về số này.</small><FormFieldError error={fieldErrors['food-stock']} /></label>
          <section className="movieWide foodImagePicker" aria-labelledby="food-image-heading">
            <h2 id="food-image-heading">Ảnh sản phẩm</h2>
            <input ref={fileInput} id="food-image-file" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseImage} />
            <div className="foodImageActions"><button className="movieSecondary" type="button" onClick={() => fileInput.current.click()} aria-controls="food-image-file" aria-describedby="food-image-help">Chọn ảnh từ máy tính</button>
              {(imageFile || imageError) && <button className="movieSecondary" type="button" onClick={clearImageSelection}>Bỏ chọn</button>}</div>
            <p id="food-image-help">JPG, PNG hoặc WebP, tối đa 5 MB. Ảnh được tải lên khi bạn bấm Lưu.</p>
            {imageFile && <p className="foodImageFilename" role="status">{imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB</p>}
            {imageError && <p className="movieError" role="alert">{imageError}</p>}
            <details className="adminMediaUrl"><summary>Hoặc dùng đường dẫn ảnh</summary><label htmlFor="food-image">Đường dẫn ảnh<input id="food-image" name="image" maxLength={2048} value={form.image} disabled={Boolean(imageFile)} onChange={(event) => { setImageError(''); change(event); }} placeholder="https://… hoặc /images/foods/…" /><FormFieldError error={fieldErrors['food-image']} /></label></details>
          </section>
          <label className="movieWide movieCheckbox" htmlFor="food-available"><input id="food-available" name="available" type="checkbox" checked={form.available} onChange={change} />Đang bán<FormFieldError error={fieldErrors['food-available']} /></label>
        </> : <>
          <div className="adminSectionHeading"><span>02</span><h2>Mức giảm & điều kiện</h2></div>
          <label htmlFor="promotion-code">Mã khuyến mãi *<input id="promotion-code" name="code" required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,39}" disabled={used} value={form.code} onChange={change} placeholder="CINEMA10" /><small>Mã được chuyển thành chữ in hoa khi lưu.</small><FormFieldError error={fieldErrors['promotion-code']} /></label>
          <label htmlFor="promotion-type">Loại giảm *<select id="promotion-type" name="discountType" required disabled={used} value={form.discountType} onChange={change}>
            <option value="">Chọn loại giảm</option><option value="percentage">Phần trăm (%)</option><option value="fixed">Số tiền cố định (VND)</option></select><FormFieldError error={fieldErrors['promotion-type']} /></label>
          <label htmlFor="promotion-value">Mức giảm {form.discountType === 'percentage' ? '(%)' : form.discountType === 'fixed' ? '(VND)' : ''} *<input id="promotion-value" name="value" type="number" required min={1} max={form.discountType === 'percentage' ? 100 : 1000000000} step={1} disabled={used} value={form.value} onChange={change} /><FormFieldError error={fieldErrors['promotion-value']} /></label>
          <label htmlFor="promotion-min">Giá trị đơn tối thiểu (VND) *<input id="promotion-min" name="minOrder" type="number" required min={0} max={1000000000} step={1} value={form.minOrder} onChange={change} /><FormFieldError error={fieldErrors['promotion-min']} /></label>
          {form.discountType === 'percentage' && <label htmlFor="promotion-cap">Giảm tối đa (VND)<input id="promotion-cap" name="maxDiscount" type="number" min={1} max={1000000000} step={1} value={form.maxDiscount} onChange={change} /><small>Để trống nếu không giới hạn.</small><FormFieldError error={fieldErrors['promotion-cap']} /></label>}
          <label htmlFor="promotion-scope">Phạm vi áp dụng *<select id="promotion-scope" name="scope" required disabled={used} value={form.scope} onChange={change}>
            <option value="">Chọn phạm vi</option><option value="food">F&B</option><option value="ticket">Vé</option><option value="all">Vé và F&B</option></select><FormFieldError error={fieldErrors['promotion-scope']} /></label>
          <label htmlFor="promotion-stacking">Dùng cùng điểm thành viên *<select id="promotion-stacking" name="stackable" required value={form.stackable} onChange={change}>
            <option value="">Chọn chính sách</option><option value="false">Không dùng cùng điểm</option><option value="true">Được dùng cùng điểm</option></select><small>Mỗi đơn chỉ dùng một mã khuyến mãi.</small><FormFieldError error={fieldErrors['promotion-stacking']} /></label>
          <div className="adminSectionHeading"><span>03</span><h2>Thời hạn & số lượt dùng</h2></div>
          <div className="movieWide promotionDateSettings"><p>Mặc định áp dụng từ đầu ngày bắt đầu đến hết ngày kết thúc, theo giờ Việt Nam.</p><div className="promotionDatePresets" role="group" aria-label="Chọn nhanh thời hạn">{[[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']].map(([days, title]) => <button key={days} type="button" aria-pressed={!specificTime && form.startsAt === vietnamToday() && form.endsAt === shiftDay(vietnamToday(), days - 1)} onClick={() => chooseDuration(days)}>{title}</button>)}</div><label className="promotionTimeToggle" htmlFor="promotion-specific-time"><input id="promotion-specific-time" type="checkbox" checked={specificTime} onChange={event => toggleSpecificTime(event.target.checked)} />Thiết lập giờ cụ thể</label>
            {editing && originalWindow.current?.specificTime && specificTime && <small>Chương trình đang dùng giờ cụ thể. Giữ nguyên nếu bạn không thay đổi thời gian.</small>}
          </div>
          <label htmlFor="promotion-start">{specificTime ? 'Bắt đầu (giờ VN)' : 'Ngày bắt đầu'} *<input id="promotion-start" name="startsAt" type={specificTime ? 'datetime-local' : 'date'} required max={specificTime ? '9999-12-31T23:59' : '9999-12-30'} step={specificTime ? 60 : 1} value={form.startsAt} onChange={change} /><FormFieldError error={fieldErrors['promotion-start']} /></label>
          <label htmlFor="promotion-end">{specificTime ? 'Kết thúc (giờ VN)' : 'Ngày kết thúc'} *<input id="promotion-end" name="endsAt" type={specificTime ? 'datetime-local' : 'date'} required min={form.startsAt || undefined} max={specificTime ? '9999-12-31T23:59' : '9999-12-30'} step={specificTime ? 60 : 1} value={form.endsAt} onChange={change} />{!specificTime && <small>Có hiệu lực hết ngày này, không cần chọn giờ.</small>}<FormFieldError error={fieldErrors['promotion-end']} /></label>
          <label htmlFor="promotion-limit">Giới hạn tổng số lượt dùng<input id="promotion-limit" name="usageLimit" type="number" min={Math.max(1, form.usedCount || 0)} max={1000000000} step={1} value={form.usageLimit} onChange={change} /><small>Để trống nếu không giới hạn. Số lượt đã dùng do hệ thống ghi nhận.</small><FormFieldError error={fieldErrors['promotion-limit']} /></label>
          <label className="movieWide movieCheckbox" htmlFor="promotion-active"><input id="promotion-active" name="active" type="checkbox" checked={form.active} onChange={change} />Kích hoạt chương trình<FormFieldError error={fieldErrors['promotion-active']} /></label>
        </>}
      </div><aside className="adminEditorAside" aria-label="Xem trước cấu hình"><section className="adminLiveCard">
        <p className="adminPreviewEyebrow">{kind === 'foods' ? 'XEM TRƯỚC SẢN PHẨM' : 'TÓM TẮT KHUYẾN MÃI'}</p>
        {kind === 'foods' ? <><img className="adminPreviewImage" src={preview || placeholder} alt="Xem trước ảnh sản phẩm" onError={event => { if (event.currentTarget.src !== new URL(placeholder, window.location.href).href) event.currentTarget.src = placeholder; }} /><h3>{form.name || 'Tên sản phẩm'}</h3><p className="adminPreviewDescription">{form.description || 'Mô tả sản phẩm sẽ hiển thị tại đây.'}</p><p className="adminPreviewPrice">{money(Number(form.price) || 0)}</p><span className={'adminPreviewBadge' + (!form.available ? ' paused' : '')}>{form.available ? 'Đang bán' : 'Ngừng bán'}</span><dl className="adminPreviewFacts"><div><dt>Tồn kho sau khi lưu</dt><dd>{form.stock || '0'} sản phẩm</dd></div></dl></> : <><h3>{form.name || 'Tên chương trình'}</h3><span className="adminCouponCode">{form.code.trim().toUpperCase() || 'MÃ KHUYẾN MÃI'}</span><p className="adminPreviewPrice">{form.value ? `Giảm ${form.discountType === 'percentage' ? form.value + '%' : form.discountType === 'fixed' ? money(Number(form.value)) : '—'}` : 'Chọn mức giảm'}</p><p className="adminPreviewDescription">{form.description || 'Thông tin chương trình sẽ hiển thị tại đây.'}</p><dl className="adminPreviewFacts">
          <div><dt>Phạm vi áp dụng</dt><dd>{{ food: 'Đồ ăn & thức uống', ticket: 'Vé xem phim', all: 'Vé và F&B' }[form.scope] || 'Chưa chọn phạm vi'}</dd></div>
          <div><dt>Giá trị tối thiểu của phần được giảm</dt><dd>{money(Number(form.minOrder) || 0)}</dd></div>
          {form.discountType === 'percentage' && <div><dt>Giảm tối đa</dt><dd>{form.maxDiscount ? money(Number(form.maxDiscount)) : 'Không giới hạn'}</dd></div>}
          <div><dt>Điểm thành viên</dt><dd>{form.stackable === 'true' ? 'Được dùng cùng điểm' : form.stackable === 'false' ? 'Không dùng cùng điểm' : 'Chưa chọn chính sách'}</dd></div>
          <div><dt>Hiệu lực · Giờ Việt Nam</dt><dd>{form.startsAt ? `Từ ${displayDay(form.startsAt)}${specificTime ? ' · ' + form.startsAt.slice(11) : ''}` : 'Chưa chọn ngày bắt đầu'}<br />{form.endsAt ? `${specificTime ? 'đến' : 'đến hết ngày'} ${displayDay(form.endsAt)}${specificTime ? ' · ' + form.endsAt.slice(11) : ''}` : 'Chưa chọn ngày kết thúc'}</dd></div>
          <div><dt>Lượt dùng</dt><dd>{form.usageLimit ? `Tối đa ${form.usageLimit} lượt` : 'Không giới hạn'}{used ? ` · Đã dùng ${form.usedCount}` : ''}</dd></div>
          <div><dt>Trạng thái sau khi lưu</dt><dd>{form.active ? 'Bật khi đủ điều kiện áp dụng' : 'Tạm ngưng'}</dd></div>
        </dl><p className="adminPreviewDescription">Mỗi đơn dùng 1 mã. Điều kiện được kiểm tra lại khi áp dụng và thanh toán.</p></>}
      </section></aside></div></fieldset>
      <div className="movieFormActions"><span className="adminSaveHint">Kiểm tra thông tin trước khi lưu.</span><button className="movieSecondary" type="button" disabled={saving} onClick={() => navigate(`/admin/${kind}`)}>Hủy</button>
        <button className="moviePrimary" type="submit" disabled={saving || Boolean(imageError)}>{saving ? (imageFile ? 'Đang tải ảnh…' : 'Đang lưu…') : kind === 'foods' ? 'Lưu F&B' : 'Lưu khuyến mãi'}</button></div>
    </form>}
  </div></main>;
}

export default function ManageCatalogue({ kind, editing = false, creating = false }) {
  if (editing || creating) return <CatalogueForm key={`${kind}-${editing}`} kind={kind} editing={editing} />;
  return <CatalogueList key={kind} kind={kind} />;
}
