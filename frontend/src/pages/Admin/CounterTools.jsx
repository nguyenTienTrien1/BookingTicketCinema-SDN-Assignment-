import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Payment from '../Payment/Payment';

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ';

export default function CounterTools() {
 const { user, setUser } = useAuth();
 const navigate = useNavigate();
 const admin = user?.role === 'admin';
 const [search, setSearch] = useState('');
 const [members, setMembers] = useState([]);
 const [ages, setAges] = useState({});
 const [id, setId] = useState('');
 const [booking, setBooking] = useState(null);
 const [foods, setFoods] = useState([]);
 const [stock, setStock] = useState({});
 const [receipts, setReceipts] = useState([]);
 const [notes, setNotes] = useState({});
 const [message, setMessage] = useState('');
 const [busy, setBusy] = useState(false);

 async function run(action) {
  if (busy) return;
  setBusy(true); setMessage('');
  try { await action(); }
  catch (error) { setMessage(error.message); }
  finally { setBusy(false); }
 }

 async function refreshReceipts() {
  setReceipts(await api('/payments/reconciliation'));
 }

 useEffect(() => {
  let active = true;
  api('/payments/reconciliation').then(data => { if (active) setReceipts(data); }).catch(error => { if (active) setMessage(error.message); });
  if (admin) api('/payments/stock').then(data => { if (active) setFoods(data); }).catch(error => { if (active) setMessage(error.message); });
  return () => { active = false; };
 }, [admin]);

 useEffect(() => {
  if (booking?.activePayment) refreshReceipts().catch(error => setMessage(error.message));
 }, [booking?.activePayment, booking?.paymentIssue]);

 async function resolve(receipt, action) {
  const reason = (notes[receipt.ref] || '').trim();
  if (reason.length < 3) throw new Error('Nhập lý do xử lý từ 3 ký tự.');
  if (action === 'cash-returned' && !window.confirm('Xác nhận đã trả lại ' + money(receipt.amount) + ' cho khách? Tiền thừa đã trả trước đó không được trả lần nữa.')) return;
  const result = await api('/payments/reconciliation/' + encodeURIComponent(receipt.ref), {
   method: 'POST', body: JSON.stringify({ action, reason, returnedAmount: action === 'cash-returned' ? receipt.amount : undefined })
  });
  if (result.booking) setBooking(current => current?._id === result.booking._id ? result.booking : current);
  setMessage(result.message);
  await refreshReceipts();
 }

 return <main className="page">
  <Link to="/">← Về rạp phim</Link>
  <h1>Nghiệp vụ quầy</h1>
  <p role="status">{message}</p>

  <fieldset disabled={busy}>
   <h2>Xác minh tuổi Member</h2>
   <p>Kiểm tra giấy tờ thực tế; thông tin tuổi tự sửa trong hồ sơ không thay thế xác minh.</p>
   <input aria-label="Tìm Member" placeholder="Email hoặc điện thoại" value={search} onChange={event => setSearch(event.target.value)} />
   <button onClick={() => run(async () => setMembers(await api('/counter/members?search=' + encodeURIComponent(search))))}>Tìm Member</button>
   {members.map(member => <div className="adminRow" key={member._id}>
    <span>{member.fullName} · {member.email}</span>
    <input aria-label={'Tuổi xác minh của ' + member.fullName} type="number" min="0" max="120" value={ages[member._id] || ''} onChange={event => setAges({ ...ages, [member._id]: event.target.value })} />
    <button onClick={() => run(async () => {
     await api('/payments/members/' + member._id + '/age', { method: 'PATCH', body: JSON.stringify({ age: Number(ages[member._id]) }) });
     setMessage('Đã lưu xác minh tuổi.');
    })}>Xác nhận đã kiểm tra giấy tờ</button>
   </div>)}
  </fieldset>

  <fieldset disabled={busy}>
   <h2>Tiếp nhận thanh toán đơn online hoặc tại quầy</h2>
   <input aria-label="Mã đơn" value={id} onChange={event => setId(event.target.value)} placeholder="Mã đơn khách cung cấp" />
   <button onClick={() => run(async () => setBooking(await api('/payments/bookings/' + encodeURIComponent(id.trim()))))}>Tra cứu đơn</button>
  </fieldset>
  {booking && <Payment key={booking._id} user={user} setUser={setUser} pending={booking}
   setPending={updated => setBooking(current => current?._id === updated._id ? updated : current)}
   setMsg={setMessage} setTab={() => navigate('/account')} collectionOnly />}

  <fieldset disabled={busy}>
   <h2>Đối soát thanh toán</h2>
   <p>Admin và nhân viên được xử lý mọi đơn. Chỉ hoàn tất khi còn đủ điều kiện; không thu tiền lần nữa.</p>
   <button onClick={() => run(refreshReceipts)}>Tải lại danh sách đối soát</button>
   {receipts.length === 0 && <p>Không có khoản thu đang chờ đối soát.</p>}
   {receipts.map(receipt => <article className="paymentPanel" key={receipt.ref}>
    <h3>{receipt.method === 'cash' ? 'Tiền mặt' : 'VNPay'} · {money(receipt.amount)}</h3>
    <p>Mã giao dịch: {receipt.ref}</p>
    <p>Mã đơn: {receipt.booking?._id || 'Đơn không còn tồn tại'} · {receipt.booking?.showtime?.movie?.title}</p>
    {receipt.actor && <p>Người ghi nhận: {receipt.actor.fullName}</p>}
    {receipt.receivedAmount != null && <p>Khách đưa: {money(receipt.receivedAmount)} · Tiền thừa đã trả: {money(receipt.change)}</p>}
    <p>{receipt.message || 'Khoản thu chưa hoàn tất.'}</p>
    {receipt.method === 'vnpay' && <p>Chỉ thử hoàn tất khi có xác nhận từ VNPay. Khoản cần hoàn qua cổng thanh toán vẫn chờ xác minh, không tự đánh dấu đã hoàn.</p>}
    <label>Lý do / ghi chú
     <input aria-label={'Lý do đối soát ' + receipt.ref} maxLength={500} value={notes[receipt.ref] || ''} onChange={event => setNotes({ ...notes, [receipt.ref]: event.target.value })} />
    </label>
    <div className="movieFormActions">
     <button disabled={!receipt.booking || !receipt.collectedAt || (receipt.method === 'vnpay' && !receipt.providerRef)} onClick={() => run(() => resolve(receipt, 'retry'))}>Thử hoàn tất khoản đã thu</button>
     {receipt.method === 'cash' && <button onClick={() => run(() => resolve(receipt, 'cash-returned'))}>Xác nhận đã trả lại {money(receipt.amount)}</button>}
     <button onClick={() => run(() => resolve(receipt, 'note'))}>Lưu ghi chú đối soát</button>
    </div>
   </article>)}
  </fieldset>

  {admin && <fieldset disabled={busy}>
   <h2>Tồn kho bắp nước</h2><p>Nhập tồn kho thực tế. Không tự giả định hàng còn sẵn.</p>
   {foods.map(food => <div className="adminRow" key={food._id}>
    <span>{food.name} · Còn {food.stock || 0}</span>
    <input aria-label={'Tồn kho ' + food.name} type="number" min="0" step="1" value={stock[food._id] ?? food.stock ?? 0} onChange={event => setStock({ ...stock, [food._id]: event.target.value })} />
    <button onClick={() => run(async () => {
     const updated = await api('/payments/stock/' + food._id, { method: 'PATCH', body: JSON.stringify({ stock: Number(stock[food._id] ?? food.stock ?? 0), expectedStock: food.stock || 0 }) });
     setFoods(current => current.map(item => item._id === food._id ? updated : item)); setMessage('Đã cập nhật tồn kho.');
    })}>Lưu tồn kho</button>
   </div>)}
  </fieldset>}
 </main>;
}
