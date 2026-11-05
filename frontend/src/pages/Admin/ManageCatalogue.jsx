import { useEffect, useRef, useState } from 'react';

import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { listCatalogue, getCatalogueItem } from '../../services/catalogueService';

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
      </header>
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
              <th scope="col">{kind === 'foods' ? 'Tồn kho' : 'Thời hạn (giờ VN)'}</th><th scope="col">Trạng thái</th></tr></thead>
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

export default function ManageCatalogue({ kind }) { return <CatalogueList key={kind} kind={kind} />; }
