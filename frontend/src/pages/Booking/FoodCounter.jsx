import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCounterFoods, createFoodSale, getFoodSale, cancelFoodSale, payFoodSale } from '../../services/foodSaleService';
import '../Admin/movies.css';
import './foodCounter.css';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export default function FoodCounter() {
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
    setSale(null); setCash(''); setConfirmed(false); setQuantities({}); setError('');
    setReload(reload + 1);
  }

  async function pay(event) {
    event.preventDefault();
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
  const cashAmount = Number(cash);

  return <main className="movieAdmin"><div className="movieAdminShell">
    <Link className="movieBack" to="/employee/dashboard">← Trang nhân viên</Link>
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / QUẦY F&B</p>
      <h1>Bán đồ ăn & thức uống</h1><p>Chọn sản phẩm, xác nhận đơn và thanh toán tiền mặt tại quầy.</p></div></header>
    {error && <div role="alert" className="movieError">{error}</div>}
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {!loading && !catalogue.paymentsEnabled && <p className="movieWarning">Thanh toán chưa sẵn sàng: cần cấu hình MongoDB replica set. Chưa thu tiền khách.</p>}
    {recoveryId && <div className="movieWarning">Cần kiểm tra lại đơn {recoveryId} trước khi tạo đơn khác.
      <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Kiểm tra lại đơn</button></div>}
    {!loading && !sale && !recoveryId && <form className="moviePanel movieForm" onSubmit={quote}>
      <fieldset disabled={busy} className="foodCounterFields"><legend>Danh mục tại quầy</legend>
        {catalogue.foods.length === 0 && <p>Chưa có sản phẩm. Admin cần bổ sung danh mục và tồn kho trước khi bán.</p>}
        <div className="foodCounterGrid">{catalogue.foods.map((food) => <article key={food._id} className="foodCounterItem">
          <h2>{food.name}</h2><p>{money(food.price)}</p><small>Còn {food.stock ?? 0} sản phẩm</small>
          <label htmlFor={`quantity-${food._id}`}>Số lượng
            <input id={`quantity-${food._id}`} type="number" min={0} max={Math.min(food.stock ?? 0, 100)} step={1}
              disabled={!food.stock} value={quantities[food._id] ?? 0} onChange={(event) => {
                setQuantities({ ...quantities, [food._id]: event.target.value });
                requestId.current = crypto.randomUUID();
              }} /></label>
        </article>)}</div>
        <div className="movieFormActions"><strong>Tạm tính: {money(estimate)}</strong>
          <button type="submit" className="moviePrimary" disabled={estimate <= 0}>{busy ? 'Đang tạo đơn…' : 'Xác nhận đơn hàng'}</button></div>
      </fieldset>
    </form>}
    {sale && <section className="moviePanel movieForm" aria-label="Thông tin đơn F&B">
      <h2>{sale.status === 'paid' ? 'Hóa đơn đã thanh toán' : 'Đơn bán F&B'}</h2>
      <p className="foodReceiptId">Mã đơn: {sale._id}</p>
      <p>Nhân viên: {user.fullName}</p>
      <p>Trạng thái: {{ pending: 'Chờ thanh toán', payment_received: 'Đã ghi nhận nhận tiền — đang hoàn tất', paid: 'Đã thanh toán', cancelled: 'Đã hủy', reconciliation: 'Cần đối soát thanh toán' }[sale.status]}</p>
      <div className="movieTableWrap"><table className="movieTable foodReceiptTable"><thead><tr><th scope="col">Sản phẩm</th><th scope="col">Đơn giá</th><th scope="col">Số lượng</th><th scope="col">Thành tiền</th></tr></thead>
        <tbody>{sale.items.map((item) => <tr key={item.food}><td data-label="Sản phẩm">{item.name}</td><td data-label="Đơn giá">{money(item.unitPrice)}</td><td data-label="Số lượng">{item.quantity}</td><td data-label="Thành tiền">{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody>
      </table></div>
      <p><strong>Tổng thanh toán: {money(sale.total)}</strong></p>
      {sale.status === 'pending' && <form onSubmit={pay} className="foodPaymentForm">
        <label htmlFor="cash-received">Tiền mặt khách đưa (VND)
          <input id="cash-received" type="number" min={sale.total} max={Number.MAX_SAFE_INTEGER} step={1} value={cash} required disabled={busy || !catalogue.paymentsEnabled} onChange={(event) => setCash(event.target.value)} /></label>
        <p>Tiền thừa: {money(Math.max(0, cashAmount - sale.total))}</p>
        <label className="foodConfirm"><input type="checkbox" required checked={confirmed} disabled={busy || !catalogue.paymentsEnabled} onChange={(event) => setConfirmed(event.target.checked)} />Tôi đã xác nhận đơn với khách và nhận đủ tiền mặt.</label>
        <div className="movieFormActions">
          <button type="button" className="movieSecondary" disabled={busy} onClick={cancel}>Hủy đơn / Chọn lại</button>
          <button type="submit" className="moviePrimary" disabled={busy || !confirmed || !catalogue.paymentsEnabled}>{busy ? 'Đang hoàn tất…' : 'Hoàn tất & xuất hóa đơn'}</button>
        </div>
      </form>}
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
