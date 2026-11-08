import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCounterFoods, createFoodSale, getFoodSale, cancelFoodSale, payFoodSale } from '../../services/foodSaleService';
import { foodImage } from '../../components/FoodPicker';
import imagePlaceholder from '../../assets/foods/placeholder.svg';
import popcornArt from '../../assets/foods/popcorn_cheese.png';
import drinkArt from '../../assets/foods/coca_cola.png';
import '../Admin/movies.css';
import './foodCounter.css';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
function ProductImage({ food, ...props }) {
  return <img {...props} src={foodImage(food)} alt={food.name} loading="lazy" onError={event => { if (event.currentTarget.src !== new URL(imagePlaceholder, window.location.href).href) event.currentTarget.src = imagePlaceholder; }} />;
}

export default function FoodCounter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const storageKey = `cinema-food-sale-${user._id}`;
  const [catalogue, setCatalogue] = useState({ foods: [], paymentsEnabled: false });
  const [quantities, setQuantities] = useState({});
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cash, setCash] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reload, setReload] = useState(0);
  const [recoveryId, setRecoveryId] = useState('');
  const [search, setSearch] = useState('');
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const processing = useRef(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    async function load() {
      try {
        const data = await getCounterFoods();
        if (!ignore) setCatalogue(data);
        const id = sessionStorage.getItem(storageKey);
        if (id) {
          if (!ignore) setRecoveryId(id);
          const saved = await getFoodSale(id);
          if (!ignore) { setSale(saved); setRecoveryId(''); }
        }
      } catch (err) { if (!ignore) setError(err.message); }
      finally { if (!ignore) setLoading(false); }
    }
    load();
    return () => { ignore = true; };
  }, [storageKey, reload]);

  async function perform(action) {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (err) { setError(err.message); }
    finally { processing.current = false; setBusy(false); }
  }

  async function quote(event) {
    event.preventDefault();
    await perform(async () => {
      const items = [];
      for (const food of catalogue.foods) {
        const quantity = Number(quantities[food._id] || 0);
        if (quantity > 0) items.push({ food: food._id, quantity });
      }
      const order = await createFoodSale(items, requestId.current);
      sessionStorage.setItem(storageKey, order._id);
      setSale(order);
      setConfirmed(false);
      setCash('');
    });
  }

  async function cancel() {
    await perform(async () => {
      const result = await cancelFoodSale(sale._id);
      setSale(result);
      sessionStorage.removeItem(storageKey);
    });
  }

  function newOrder() {
    sessionStorage.removeItem(storageKey);
    requestId.current = crypto.randomUUID();
    setSale(null); setCash(''); setConfirmed(false); setQuantities({}); setError(''); setSearch('');
    setReload(reload + 1);
  }

  async function pay(event) {
    event.preventDefault();
    if (sale.status === 'pending' && (!cashValid || !confirmed)) {
      setError('Nhập đủ tiền khách đưa và xác nhận đã nhận tiền mặt trước khi hoàn tất.');
      return;
    }
    await perform(async () => {
      try {
        const result = await payFoodSale(sale._id, sale.total, Number(cash));
        setSale(result);
      } catch (err) {
        // Re-read instead of assuming a lost payment response means failure.
        try { setSale(await getFoodSale(sale._id)); } catch { /* Keep the order id for recovery. */ }
        throw err;
      }
    });
  }

  let estimate = 0;
  for (const food of catalogue.foods) estimate += food.price * Number(quantities[food._id] || 0);
  const selectedFoods = catalogue.foods.filter(food => Number(quantities[food._id]) > 0);
  const itemCount = selectedFoods.reduce((sum, food) => sum + Number(quantities[food._id]), 0);
  const visibleFoods = catalogue.foods.filter(food => (!hideSoldOut || food.stock > 0) && food.name.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN')))
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  function changeQuantity(food, value) {
    if (value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > Math.min(food.stock ?? 0, 100))) return;
    setQuantities(current => ({ ...current, [food._id]: value }));
    requestId.current = crypto.randomUUID();
  }
  const cashAmount = Number(cash);
  const cashEntered = cash.trim() !== '';
  const cashInteger = cashEntered && Number.isSafeInteger(cashAmount) && cashAmount >= 0;
  const cashValid = cashInteger && !!sale && cashAmount >= sale.total;
  const quickCash = sale ? [...new Set([sale.total, ...[50000, 100000, 200000, 500000].filter(amount => amount > sale.total), Math.ceil(sale.total / 100000) * 100000])].filter(Number.isSafeInteger).slice(0, 4) : [];
  function changeCash(value) { setCash(value); setConfirmed(false); }

  return <main className="movieAdmin foodCounterPage"><div className="movieAdminShell">
    <button type="button" className="ghost staffBackButton" disabled={busy} onClick={() => navigate('/account?section=profile')}>← Về hồ sơ & tác vụ</button>
    <header className={'foodCounterHero' + (sale ? ' compact' : '')}><div><p className="movieEyebrow">CINEMA+ / QUẦY F&B</p>
      {sale ? <h1>Quầy đồ ăn & thức uống</h1> : <h1>Bắp ngon. Nước mát.<br /><span>Chọn món thật nhanh.</span></h1>}{!sale && <p>Bán đồ ăn & thức uống tại quầy · Thanh toán tiền mặt</p>}
      <span className="foodCounterStaff"><span aria-hidden="true">●</span> Nhân viên: {user.fullName}</span></div>
      <div className="foodCounterHeroArt" aria-hidden="true"><img src={popcornArt} alt="" /><img src={drinkArt} alt="" /><span>BẮP & NƯỚC</span></div>
    </header>
    <ol className="foodCounterSteps" aria-label="Tiến trình bán hàng">{['Chọn món', 'Xác nhận & nhận tiền', 'Hoàn tất'].map((label, index) => {
      const current = !sale ? 0 : sale.status === 'paid' ? 2 : 1;
      return <li key={label} className={index <= current ? 'active' : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? '✓' : index + 1}</span>{label}</li>;
    })}</ol>
    {error && <div role="alert" className="movieError">{error}</div>}
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {!loading && !catalogue.paymentsEnabled && <p className="movieWarning">Thanh toán chưa sẵn sàng: cần cấu hình MongoDB replica set. Chưa thu tiền khách.</p>}
    {recoveryId && <div className="movieWarning">Cần kiểm tra lại đơn {recoveryId} trước khi tạo đơn khác.
      <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Kiểm tra lại đơn</button></div>}
    {!loading && !sale && !recoveryId && <form onSubmit={quote}>
      <fieldset disabled={busy} className="foodCounterFields"><legend className="movieSrOnly">Danh mục tại quầy</legend>
      <div className="foodCounterLayout"><section className="foodCounterMenu" aria-labelledby="food-menu-title">
        <div className="foodCounterMenuHeading"><div><h2 id="food-menu-title">Thực đơn tại quầy</h2><p>{visibleFoods.length} / {catalogue.foods.length} món · Ưu tiên món còn hàng</p></div>
          <label className="foodCounterSearch"><span className="movieSrOnly">Tìm món</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm món yêu thích…" /></label>
        </div>
        <label className="foodCounterAvailability"><input type="checkbox" checked={hideSoldOut} onChange={event => setHideSoldOut(event.target.checked)} />Ẩn món hết hàng</label>
        {catalogue.foods.length === 0 && <p>Chưa có sản phẩm. Admin cần bổ sung danh mục và tồn kho trước khi bán.</p>}
        {!!catalogue.foods.length && !visibleFoods.length && <p className="foodCounterEmpty">Không tìm thấy món phù hợp. Thử tên món khác nhé.</p>}
        <div className="foodCounterGrid">{visibleFoods.map((food) => {
          const quantity = Number(quantities[food._id] || 0), stock = food.stock ?? 0;
          return <article key={food._id} className={'foodCounterItem' + (quantity ? ' selected' : '') + (!stock ? ' soldOut' : '')}>
          <div className="foodCounterPhoto"><ProductImage food={food} width="280" height="210" /><span className={'foodCounterStock' + (!stock ? ' empty' : stock <= 5 ? ' low' : '')}>{!stock ? 'Tạm hết hàng' : stock <= 5 ? `Chỉ còn ${stock}` : `Còn ${stock}`}</span>{quantity > 0 && <span className="foodCounterChosen" aria-label="Đã chọn">✓</span>}</div>
          <div className="foodCounterItemBody"><h2>{food.name}</h2><p className="foodCounterPrice">{money(food.price)}<small>/ phần</small></p>
          <label className="movieSrOnly" htmlFor={`quantity-${food._id}`}>Số lượng {food.name}</label>
          <div className="foodCounterStepper"><button type="button" aria-label={'Giảm ' + food.name} disabled={!stock || quantity === 0} onClick={() => changeQuantity(food, quantity - 1)}>−</button>
            <input id={`quantity-${food._id}`} type="number" min={0} max={Math.min(stock, 100)} step={1} disabled={!stock} value={quantities[food._id] ?? 0} onChange={event => changeQuantity(food, event.target.value)} />
            <button type="button" aria-label={'Tăng ' + food.name} disabled={!stock || quantity >= Math.min(stock, 100)} onClick={() => changeQuantity(food, quantity + 1)}>+</button>
          </div></div>
        </article>;})}</div>
      </section><aside className="foodCounterCart" aria-labelledby="food-cart-title"><div className="foodCounterCartHeading"><h2 id="food-cart-title">Đơn hàng hiện tại</h2><span>{itemCount} phần</span></div>
        {selectedFoods.length ? <ul className="foodCounterCartItems">{selectedFoods.map(food => <li key={food._id}><ProductImage food={food} width="52" height="52" /><div><strong>{food.name}</strong><span>{quantities[food._id]} × {money(food.price)}</span></div><button type="button" aria-label={'Bỏ món ' + food.name} onClick={() => changeQuantity(food, 0)}>×</button></li>)}</ul> : <div className="foodCounterCartEmpty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8Z M8 8V6a4 4 0 0 1 8 0v2" /></svg><strong>Chưa có món nào</strong><p>Chọn bắp, nước hoặc combo<br />để bắt đầu đơn hàng.</p></div>}
        <div className="foodCounterCartTotal" aria-live="polite"><span>Tạm tính</span><strong>{money(estimate)}</strong></div>
        <p className="foodCounterCartHint">Kiểm tra món trước khi xác nhận. Tiền mặt sẽ được ghi nhận ở bước tiếp theo.</p>
        <button type="submit" className="moviePrimary" disabled={estimate <= 0}>{busy ? 'Đang tạo đơn…' : 'Xác nhận đơn hàng'}</button>
      </aside></div>
      </fieldset>
    </form>}
    {sale && <section className="moviePanel movieForm foodCounterReceipt" aria-label="Thông tin đơn F&B">
      <h2>{sale.status === 'paid' ? 'Hóa đơn đã thanh toán' : 'Đơn bán F&B'}</h2>
      <p className="foodReceiptId">Mã đơn: {sale._id}</p>
      <p>Nhân viên: {user.fullName}</p>
      <p>Trạng thái: {{ pending: 'Chờ thanh toán', payment_received: 'Đã ghi nhận nhận tiền — đang hoàn tất', paid: 'Đã thanh toán', cancelled: 'Đã hủy', reconciliation: 'Cần đối soát thanh toán' }[sale.status]}</p>
      <div className={'foodCounterCheckout' + (sale.status === 'pending' ? ' awaitingCash' : '')}><div className="foodCounterOrderSummary">
      <div className="movieTableWrap"><table className="movieTable foodReceiptTable"><thead><tr><th scope="col">Sản phẩm</th><th scope="col">Đơn giá</th><th scope="col">Số lượng</th><th scope="col">Thành tiền</th></tr></thead>
        <tbody>{sale.items.map((item) => <tr key={item.food}><td data-label="Sản phẩm"><span className="foodCounterReceiptProduct"><ProductImage food={catalogue.foods.find(food => String(food._id) === String(item.food)) || { name: item.name }} width="48" height="48" />{item.name}</span></td><td data-label="Đơn giá">{money(item.unitPrice)}</td><td data-label="Số lượng">{item.quantity}</td><td data-label="Thành tiền">{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody>
      </table></div>
      <p><strong>Tổng thanh toán: {money(sale.total)}</strong></p>
      </div>
      {sale.status === 'pending' && <form onSubmit={pay} className="foodPaymentForm">
        <h3>Nhận tiền mặt</h3>
        <div className="foodAmountDue"><span>Cần thu từ khách</span><strong>{money(sale.total)}</strong></div>
        <label htmlFor="cash-received">Tiền mặt khách đưa (VND)
          <input id="cash-received" type="number" inputMode="numeric" min={sale.total} max={Number.MAX_SAFE_INTEGER} step={1} value={cash} required placeholder="Nhập số tiền thực nhận" aria-invalid={cashEntered && !cashValid} aria-describedby="food-cash-feedback" disabled={busy || !catalogue.paymentsEnabled} onChange={(event) => changeCash(event.target.value)} /></label>
        <div className="foodCashShortcuts" role="group" aria-label="Chọn nhanh tiền khách đưa">{quickCash.map(amount => <button type="button" key={amount} aria-pressed={cashEntered && cashAmount === amount} disabled={busy || !catalogue.paymentsEnabled} onClick={() => changeCash(String(amount))}>{amount === sale.total ? 'Đủ tiền · ' : ''}{money(amount)}</button>)}</div>
        <div id="food-cash-feedback" className={'foodCashFeedback' + (cashEntered && !cashValid ? ' insufficient' : cashValid ? ' sufficient' : '')} role="status" aria-live="polite">
          {!cashEntered ? <><span>Tiền khách đưa</span><strong>Chưa nhập</strong></> : !cashInteger ? <span>Nhập số tiền nguyên hợp lệ, không âm.</span> : cashAmount < sale.total ? <><span>Còn thiếu</span><strong>{money(sale.total - cashAmount)}</strong></> : <><span>Tiền thừa trả khách</span><strong>{money(cashAmount - sale.total)}</strong></>}
        </div>
        <label className="foodConfirm"><input type="checkbox" required checked={confirmed} disabled={busy || !catalogue.paymentsEnabled || !cashValid} onChange={(event) => setConfirmed(event.target.checked)} />Tôi đã kiểm tra đơn và nhận {cashValid ? money(cashAmount) : 'đủ tiền mặt'} từ khách.</label>
        <div className="movieFormActions">
          <button type="button" className="movieSecondary" disabled={busy} onClick={cancel}>Hủy đơn / Chọn lại</button>
          <button type="submit" className="moviePrimary" disabled={busy || !confirmed || !cashValid || !catalogue.paymentsEnabled}>{busy ? 'Đang hoàn tất…' : 'Hoàn tất & xuất hóa đơn'}</button>
        </div>
        <p className="foodCashNote">{!cashValid ? 'Nhập đủ tiền khách đưa để tiếp tục.' : !confirmed ? 'Xác nhận đã nhận tiền để hoàn tất đơn.' : 'Sẵn sàng ghi nhận thanh toán và xuất hóa đơn.'}</p>
      </form>}
      </div>
      {sale.status === 'paid' && <div className="movieSuccess" role="status">
        <p>Thanh toán tiền mặt thành công. Tồn kho đã được cập nhật.</p>
        <p>Khách đưa: {money(sale.cashReceived)} — Tiền thừa: {money(sale.change)}</p>
        <p>Thời gian: {new Date(sale.paidAt).toLocaleString('vi-VN')}</p>
      </div>}
      {['payment_received', 'reconciliation'].includes(sale.status) && <div className="movieWarning" role="status">
        <p>Đã ghi nhận tiền mặt: {money(sale.cashReceived)}. Không thu tiền lần nữa.</p>
        <p>{sale.issue || 'Kiểm tra trạng thái đơn để xác định kết quả.'}</p>
        <button className="movieSecondary" disabled={busy} onClick={() => perform(async () => setSale(await getFoodSale(sale._id)))}>Kiểm tra trạng thái</button>
        {sale.status === 'payment_received' && <button className="movieSecondary" disabled={busy} onClick={pay}>Thử hoàn tất đơn đã nhận tiền</button>}
      </div>}
      {['paid', 'cancelled', 'reconciliation'].includes(sale.status) && <div className="movieFormActions">
        <button className="moviePrimary" disabled={busy} onClick={newOrder}>Tạo đơn mới</button>
      </div>}
    </section>}
  </div></main>;
}
