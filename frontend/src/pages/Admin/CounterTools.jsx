import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Payment from '../Payment/Payment';
import StaffFoodReceipt from '../../components/StaffFoodReceipt';
import './movies.css';
import './counterTools.css';

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ';

export default function CounterTools() {
 const { user, setUser } = useAuth();
 const navigate = useNavigate();
 const [params, setParams] = useSearchParams();
 const section = params.get('section') === 'reconciliation' ? 'reconciliation' : 'payment';
 const bookingFromLink = params.get('order') || params.get('booking');
 const admin = user?.role === 'admin';
 const [search, setSearch] = useState('');
 const [members, setMembers] = useState([]);
 const [ages, setAges] = useState({});
 const [id, setId] = useState('');
 const [booking, setBooking] = useState(null);
 const [foodOrder, setFoodOrder] = useState(null);
 const [foodReceipts, setFoodReceipts] = useState([]);
 const [foodReceiptsReady, setFoodReceiptsReady] = useState(false);
 const [foods, setFoods] = useState([]);
 const [stock, setStock] = useState({});
 const [receipts, setReceipts] = useState([]);
 const [receiptsReady, setReceiptsReady] = useState(false);
 const [notes, setNotes] = useState({});
 const [refunds, setRefunds] = useState([]);
 const [refundsReady, setRefundsReady] = useState(false);
 const [message, setMessage] = useState('');
 const [isError, setIsError] = useState(false);
 const [busy, setBusy] = useState(false);

 async function run(action) {
  if (busy) return;
  setBusy(true); setMessage(''); setIsError(false);
  try { await action(); }
  catch (error) { setMessage(error.message); setIsError(true); }
  finally { setBusy(false); }
 }

 async function refreshReceipts() {
  setReceiptsReady(false);
  setRefundsReady(false);
  setFoodReceiptsReady(false);
  setReceipts([]); setRefunds([]); setFoodReceipts([]);
  const [ticketData, refundData, foodData] = await Promise.all([api('/payments/reconciliation'), api('/payments/refunds'), api('/payments/food-sales/reconciliation')]);
  setReceipts(ticketData); setRefunds(refundData); setFoodReceipts(foodData);
  setRefundsReady(true);
  setReceiptsReady(true);
  setFoodReceiptsReady(true);
 }

 useEffect(() => {
  let active = true;
  api('/payments/reconciliation').then(data => { if (active) { setReceipts(data); setReceiptsReady(true); } }).catch(error => { if (active) { setMessage(error.message); setIsError(true); } });
  api('/payments/refunds').then(data => { if (active) { setRefunds(data); setRefundsReady(true); } }).catch(error => { if (active) { setMessage(error.message); setIsError(true); } });
  api('/payments/food-sales/reconciliation').then(data => { if (active) { setFoodReceipts(data); setFoodReceiptsReady(true); } }).catch(error => { if (active) { setMessage(error.message); setIsError(true); } });
  if (admin) api('/payments/stock').then(data => { if (active) setFoods(data); }).catch(error => { if (active) setMessage(error.message); });
  return () => { active = false; };
 }, [admin]);

 useEffect(() => {
  if (!bookingFromLink) return;
  let active = true;
  setId(bookingFromLink);
  api('/payments/orders/' + encodeURIComponent(bookingFromLink))
   .then(data => { if (active) { setBooking(data.type === 'booking' ? data.order : null); setFoodOrder(data.type === 'food-sale' ? data.order : null); } })
   .catch(error => { if (active) { setMessage(error.message); setIsError(true); } });
  return () => { active = false; };
 }, [bookingFromLink]);

 useEffect(() => {
  if (booking?.activePayment) refreshReceipts().catch(error => setMessage(error.message));
 }, [booking?.activePayment, booking?.paymentIssue]);

 async function resolve(receipt, action) {
  const reason = (notes[receipt.ref] || '').trim();
  if (reason.length < 3) throw new Error('Nhập lý do xử lý từ 3 ký tự.');
  if (action === 'cash-returned' && !window.confirm('Xác nhận đã trả lại ' + money(receipt.amount) + ' cho khách? Tiền thừa đã trả trước đó không được trả lần nữa.')) return;
  if (action === 'refund-points' && !window.confirm('Hoàn 100% khoản thu đã xác minh về điểm Member? Không hoàn thêm bằng tiền mặt/VNPay.')) return;
  const result = await api('/payments/reconciliation/' + encodeURIComponent(receipt.ref), {
   method: 'POST', body: JSON.stringify({ action, reason, returnedAmount: action === 'cash-returned' ? receipt.amount : undefined })
  });
  if (result.booking) setBooking(current => current?._id === result.booking._id ? result.booking : current);
  setMessage(result.message);
  await refreshReceipts();
 }
 async function resolveFood(order, action) {
  const reason = (notes[order._id] || '').trim();
  if (reason.length < 3) throw new Error('Nhập lý do xử lý từ 3 ký tự.');
  if (action === 'cash-returned' && !window.confirm('Xác nhận đã trả lại ' + money(order.total) + ' cho khách? Đây là khoản thực thu, không cộng lại tiền thừa ' + money(order.change) + '.')) return;
  const result = await api('/payments/food-sales/' + order._id + '/reconciliation', { method: 'POST', body: JSON.stringify({ action, reason, returnedAmount: action === 'cash-returned' ? order.total : undefined }) });
  setFoodOrder(current => current?._id === order._id ? result.order : current);
  await refreshReceipts();
  setMessage(result.message);
 }

 function returnToCounter() {
  if (booking?.status === 'pending' || booking?.activePayment) {
   try { sessionStorage.setItem('cinema-counter-booking-' + user._id, booking._id); } catch { /* Storage may be unavailable. */ }
  }
  navigate('/account?task=booking');
 }

 return <main className="movieAdmin staffToolsPage"><div className="movieAdminShell">
  <button type="button" className="ghost staffBackButton" disabled={busy} onClick={() => navigate('/account?section=profile')}>← Về hồ sơ & tác vụ</button>
  <header className="staffToolsHero"><p className="movieEyebrow">CINEMA+ / QUẢN LÝ KHOẢN THU</p><h1>Thu tiền & đối soát</h1>
  <p>Tra cứu đơn vé và F&B. Kiểm tra khoản đã thu trước khi xử lý.</p><div className="staffToolsSummary"><span>Vé cần đối soát <strong>{receiptsReady ? receipts.length : '…'}</strong></span><span>F&B cần đối soát <strong>{foodReceiptsReady ? foodReceipts.length : '…'}</strong></span><span>Hoàn điểm chờ xử lý <strong>{refundsReady ? refunds.length : '…'}</strong></span></div></header>
  {message && <p className={isError ? 'staffToolsError' : 'staffToolsSuccess'} role={isError ? 'alert' : 'status'}>{message}</p>}
  <div className="accountTabs" role="tablist" aria-label="Nghiệp vụ thu tiền">
   <button type="button" role="tab" aria-selected={section === 'payment'} className={section === 'payment' ? 'active' : ''} onClick={() => { setMessage(''); setParams({ section: 'payment' }, { replace: true }); }}>Thu tiền</button>
   <button type="button" role="tab" aria-selected={section === 'reconciliation'} className={section === 'reconciliation' ? 'active' : ''} onClick={() => { setMessage(''); setParams({ section: 'reconciliation' }, { replace: true }); }}>Đối soát</button>
  </div>

  {section === 'payment' && <>
  <form className="moviePanel movieForm staffLookup" onSubmit={event => { event.preventDefault(); run(async () => { setBooking(null); setFoodOrder(null); const result = await api('/payments/orders/' + encodeURIComponent(id.trim())); setBooking(result.type === 'booking' ? result.order : null); setFoodOrder(result.type === 'food-sale' ? result.order : null); }); }}><fieldset disabled={busy}>
   <h2>Tra cứu đơn cần thanh toán</h2>
   <p className="staffToolsHint">Dùng mã đơn vé hoặc mã hóa đơn F&B. Hệ thống tự nhận diện loại đơn và trạng thái thanh toán.</p>
   <label htmlFor="staff-order-id">Mã đơn</label><div className="staffLookupRow"><input id="staff-order-id" aria-label="Mã đơn" required pattern="[a-fA-F0-9]{24}" title="Mã đơn gồm 24 ký tự chữ số và chữ cái a–f" maxLength={24} value={id} onChange={event => { setId(event.target.value.trim()); setBooking(null); setFoodOrder(null); setMessage(''); }} placeholder="Nhập mã đơn gồm 24 ký tự" />
   <button className="moviePrimary" type="submit" disabled={busy || !/^[a-fA-F0-9]{24}$/.test(id.trim())}>{busy ? 'Đang tra cứu…' : 'Tra cứu đơn'}</button></div>
  </fieldset></form>
  {foodOrder && <StaffFoodReceipt order={foodOrder} onReconcile={() => setParams({ section: 'reconciliation', order: foodOrder._id }, { replace: true })} />}
  {booking && <Payment key={booking._id} user={user} setUser={setUser} pending={booking}
   setPending={updated => setBooking(current => current?._id === updated._id ? updated : current)}
   setMsg={setMessage} setTab={returnToCounter} collectionOnly />}
  </>}

  {section === 'reconciliation' && <fieldset disabled={busy} className="moviePanel movieForm">
   <h2>Đối soát thanh toán vé</h2>
   <p>Admin và nhân viên được xử lý mọi đơn. Chỉ hoàn tất khi còn đủ điều kiện; không thu tiền lần nữa.</p>
   <button className="movieSecondary" onClick={() => run(refreshReceipts)}>Tải lại danh sách đối soát</button>
   {!receiptsReady && <p role="status">Chưa tải xong danh sách đối soát.</p>}
   {receiptsReady && receipts.length === 0 && <p>Không có khoản thu đang chờ đối soát.</p>}
   {receipts.map(receipt => <article className="paymentPanel" key={receipt.ref}>
    <h3>{receipt.method === 'cash' ? 'Tiền mặt' : 'VNPay'} · {money(receipt.amount)}</h3>
    <p>Mã giao dịch: {receipt.ref}</p>
    <p>Mã đơn: {receipt.booking?._id || 'Đơn không còn tồn tại'} · {receipt.booking?.showtime?.movie?.title}</p>
    {receipt.actor && <p>Người ghi nhận: {receipt.actor.fullName}</p>}
    {receipt.receivedAmount != null && <p>Khách đưa: {money(receipt.receivedAmount)} · Tiền thừa đã trả: {money(receipt.change)}</p>}
    <p>{receipt.message || 'Khoản thu chưa hoàn tất.'}</p>
    {receipt.method === 'vnpay' && <p>Chỉ xử lý khi có xác nhận thu tiền từ VNPay. Đơn Member không hoàn tất được hoàn 100% về điểm, không gửi hoàn tiền qua VNPay.</p>}
    <label>Lý do / ghi chú
     <input aria-label={'Lý do đối soát ' + receipt.ref} maxLength={500} value={notes[receipt.ref] || ''} onChange={event => setNotes({ ...notes, [receipt.ref]: event.target.value })} />
    </label>
    <div className="movieFormActions" style={{ flexWrap: 'wrap' }}>
     <button className="movieSecondary" style={{ whiteSpace: 'normal' }} disabled={!receipt.booking || !receipt.collectedAt || (receipt.method === 'vnpay' && !receipt.providerRef)} onClick={() => run(() => resolve(receipt, 'retry'))}>Thử hoàn tất khoản đã thu</button>
     {receipt.booking?.user && <button className="movieSecondary" disabled={!receipt.collectedAt || (receipt.method === 'vnpay' && !receipt.providerRef)} onClick={() => run(() => resolve(receipt, 'refund-points'))}>Hoàn 100% về điểm</button>}
     {receipt.method === 'cash' && !receipt.booking?.user && <button className="movieSecondary" style={{ whiteSpace: 'normal' }} onClick={() => run(() => resolve(receipt, 'cash-returned'))}>Xác nhận đã trả lại {money(receipt.amount)}</button>}
     <button className="movieSecondary" style={{ whiteSpace: 'normal' }} onClick={() => run(() => resolve(receipt, 'note'))}>Lưu ghi chú đối soát</button>
    </div>
   </article>)}
   <h2>Đối soát F&B</h2>
   <p className="staffToolsHint">Chỉ hiển thị đơn đã nhận tiền nhưng chưa hoàn tất. Đơn đã thanh toán không cần đối soát.</p>
   {!foodReceiptsReady && <p role="status">Đang tải các khoản F&B cần đối soát…</p>}
   {foodReceiptsReady && foodReceipts.length === 0 && <p className="staffToolsEmpty">Không có đơn F&B cần đối soát.</p>}
   {foodReceipts.map(order => <article className="paymentPanel staffReconciliationCard" key={order._id}>
     <div className="staffReceiptHeading"><div><span className="staffOrderKind">F&B · ĐÃ NHẬN TIỀN MẶT</span><h3>{money(order.total)}</h3></div><span className="staffOrderStatus status-reconciliation">Cần xử lý</span></div>
     <p className="staffOrderReference">Mã đơn: {order._id}</p><p>Nhân viên: {order.employee?.fullName || 'Chưa có thông tin'}</p>
     <p>Khách đưa: {money(order.cashReceived)} · Tiền thừa đã ghi nhận: {money(order.change)}</p>
     <p className="staffToolsWarning">{order.issue || 'Đã ghi nhận tiền, chưa xác nhận hoàn tất.'} Không thu tiền lần nữa.</p>
     <label htmlFor={'food-reason-' + order._id}>Lý do / ghi chú</label><input id={'food-reason-' + order._id} aria-label={'Lý do đối soát F&B ' + order._id} maxLength={500} value={notes[order._id] || ''} onChange={event => setNotes({ ...notes, [order._id]: event.target.value })} placeholder="Ghi rõ kết quả kiểm tra và cách xử lý…" />
     <div className="staffReconciliationActions"><button type="button" className="moviePrimary" onClick={() => run(() => resolveFood(order, 'retry'))}>Hoàn tất khoản F&B đã thu</button><button type="button" className="movieSecondary" onClick={() => run(() => resolveFood(order, 'cash-returned'))}>Xác nhận trả lại {money(order.total)}</button><button type="button" className="movieSecondary" onClick={() => run(() => resolveFood(order, 'note'))}>Lưu ghi chú F&B</button></div>
   </article>)}
   <h2>Đối soát hoàn điểm</h2>
   {!refundsReady && <p role="status">Chưa tải xong danh sách hoàn điểm.</p>}
   {refundsReady && refunds.length === 0 && <p>Không có yêu cầu hoàn điểm đang chờ xử lý.</p>}
   {refunds.map(refund => <article className="paymentPanel" key={refund.reference}>
    <h3>{refund.user?.fullName} · {Number(refund.points).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} điểm</h3>
    <p>Mã đơn: {refund.booking?._id} · Mã khoản thu: {refund.reference}</p>
    <p>{refund.error || 'Đã ghi nhận yêu cầu, chưa xác nhận cộng điểm.'}</p>
    <button className="movieSecondary" onClick={() => run(async () => {
     const result = await api('/payments/refunds/' + encodeURIComponent(refund.reference) + '/retry', { method: 'POST', body: '{}' });
     setMessage(result.refund.status === 'completed' ? 'Đã hoàn điểm thành công.' : 'Yêu cầu vẫn chờ xử lý. Chưa cộng điểm thành công.');
     await refreshReceipts();
    })}>Thử lại cộng điểm</button>
   </article>)}
  </fieldset>}

  <details>
   <summary>Công cụ bổ sung tại quầy</summary>
  <fieldset disabled={busy} className="moviePanel movieForm">
   <h2>Xác minh tuổi Member</h2>
   <p>Kiểm tra giấy tờ thực tế; thông tin tuổi tự sửa trong hồ sơ không thay thế xác minh.</p>
   <input aria-label="Tìm Member" placeholder="Email hoặc điện thoại" value={search} onChange={event => setSearch(event.target.value)} />
   <button className="movieSecondary" onClick={() => run(async () => setMembers(await api('/counter/members?search=' + encodeURIComponent(search))))}>Tìm Member</button>
   {members.map(member => <div className="adminRow" key={member._id}>
    <span>{member.fullName} · {member.email}</span>
    <input aria-label={'Tuổi xác minh của ' + member.fullName} type="number" min="0" max="120" value={ages[member._id] ?? ''} onChange={event => setAges({ ...ages, [member._id]: event.target.value })} />
    <button className="movieSecondary" disabled={ages[member._id] == null || ages[member._id] === ''} onClick={() => run(async () => {
     await api('/payments/members/' + member._id + '/age', { method: 'PATCH', body: JSON.stringify({ age: Number(ages[member._id]) }) });
     setMessage('Đã lưu xác minh tuổi.');
    })}>Xác nhận đã kiểm tra giấy tờ</button>
   </div>)}
  </fieldset>

  {admin && <fieldset disabled={busy} className="moviePanel movieForm">
   <h2>Tồn kho bắp nước</h2><p>Nhập tồn kho thực tế. Không tự giả định hàng còn sẵn.</p>
   {foods.map(food => <div className="adminRow" key={food._id}>
    <span>{food.name} · Còn {food.stock || 0}</span>
    <input aria-label={'Tồn kho ' + food.name} type="number" min="0" step="1" value={stock[food._id] ?? food.stock ?? 0} onChange={event => setStock({ ...stock, [food._id]: event.target.value })} />
    <button className="movieSecondary" onClick={() => run(async () => {
     const updated = await api('/payments/stock/' + food._id, { method: 'PATCH', body: JSON.stringify({ stock: Number(stock[food._id] ?? food.stock ?? 0), expectedStock: food.stock || 0 }) });
     setFoods(current => current.map(item => item._id === food._id ? updated : item)); setMessage('Đã cập nhật tồn kho.');
    })}>Lưu tồn kho</button>
   </div>)}
  </fieldset>}
  </details>
 </div></main>;
}
