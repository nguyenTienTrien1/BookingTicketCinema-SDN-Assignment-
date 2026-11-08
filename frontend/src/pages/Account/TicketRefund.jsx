import { useRef, useState } from 'react';
import { api } from '../../services/api';
import { getProfile } from '../../services/profileService';
import { useAuth } from '../../context/AuthContext';

const number = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

export default function TicketRefund({ booking, onChanged }) {
 const { setUser } = useAuth();
 const dialog = useRef(null);
 const [quote, setQuote] = useState(null);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');

 async function preview() {
  setMessage(''); setQuote(null); setBusy(true);
  try {
   const result = await api(`/bookings/${booking._id}/refund`);
   setQuote(result); dialog.current.showModal();
  } catch (error) { setMessage(error.message); }
  finally { setBusy(false); }
 }

 async function confirm() {
  if (busy || !quote?.eligible) return;
  setBusy(true); setMessage('');
  try {
   const { refund } = await api(`/bookings/${booking._id}/refund`, { method: 'POST', body: JSON.stringify({ quoteKey: quote.quoteKey }) });
   setQuote({ eligible: false });
   const notice = refund.status === 'completed' ? `Đã hoàn ${number(refund.points)} điểm thành viên. Vé không còn sử dụng được.` : 'Đã ghi nhận yêu cầu, đang chờ đối soát cộng điểm. Không gửi lại hoặc yêu cầu hoàn qua phương thức khác.';
   setMessage(notice);
   if (refund.status === 'completed') {
    try {
     const profile = await getProfile();
     setUser(current => current?._id === profile._id ? { ...current, memberPoints: profile.memberPoints } : current);
     window.dispatchEvent(new Event('member-points-changed'));
    } catch { /* Successful refund stays successful; balance can refresh later. */ }
   }
   onChanged(notice);
  } catch (error) {
   setQuote(null);
   setMessage(`${error.message} Tải lại trạng thái trước khi xác nhận lại.`);
   onChanged(`${error.message} Chưa xác nhận hoàn điểm; tải lại trạng thái trước khi thử lại.`);
  } finally { setBusy(false); }
 }

 return <>
  <button type="button" className="ghost" disabled={busy} onClick={preview}>{busy ? 'Đang xử lý…' : 'Hoàn vé về điểm'}</button>
  {message && !dialog.current?.open && <p role="status">{message}</p>}
  <dialog className="refundDialog" ref={dialog} aria-labelledby={`refund-title-${booking._id}`} onCancel={event => { if (busy) event.preventDefault(); }}>
   <h3 id={`refund-title-${booking._id}`}>Hoàn toàn bộ đơn về điểm</h3>
   <p>Mã đơn: {booking._id}</p>
   {quote?.eligible && <>
    <p>Mức hoàn: <strong>{quote.rate}%</strong> trên vé và bắp nước sau khuyến mãi, gồm cả tiền và điểm đã sử dụng.</p>
    <p>Giá trị được hoàn: <strong>{number(quote.amount)}đ</strong></p>
    <p>Điểm nhận lại: <strong>{number(quote.points)} điểm</strong></p>
    <p>1 điểm = 1.000đ. Giữ điểm lẻ, sử dụng theo bội số 100 điểm. Không trả tiền mặt/VNPay; không trả lại lượt mã khuyến mãi.</p>
    <p>Sau khi hoàn thành, toàn bộ vé trong đơn bị vô hiệu và ghế được giải phóng.</p>
   </>}
   {quote?.reason && <p role="status">{quote.reason}</p>}
   {message && <p role="status">{message}</p>}
   <div className="myTicketFooter">
    <button type="button" className="ghost" disabled={busy} onClick={() => dialog.current.close()}>Đóng</button>
    {quote?.eligible && <button type="button" className="primary" disabled={busy} onClick={confirm}>{busy ? 'Đang hoàn điểm…' : 'Xác nhận hoàn về điểm'}</button>}
   </div>
  </dialog>
 </>;
}
