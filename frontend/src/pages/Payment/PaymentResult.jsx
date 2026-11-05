import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {api} from '../../services/api';

export default function PaymentResult() {
 const [params]=useSearchParams();
 const reference=params.get('reference');
 const [result,setResult]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!reference){setError('Thiếu mã giao dịch VNPay.');return;}
  let active=true,timer;
  async function refresh(){try{
   const data=await api('/bookings/payment-result/'+encodeURIComponent(reference));
   if(!active)return;
   setError('');setResult(data);
   if(data.status==='created'&&data.booking.status==='pending'&&new Date(data.booking.expiresAt)>new Date())timer=setTimeout(refresh,3000);
  }catch(e){if(active)setError(e.message);}}
  refresh();return()=>{active=false;clearTimeout(timer);};
 },[reference,retry]);
 const booking=result?.booking;
 const message=booking?.status==='paid'?'Thanh toán thành công':result?.status==='unresolved'?'Giao dịch đang cần đối soát. Vui lòng liên hệ nhân viên, không thanh toán lại.':booking?.status==='cancelled'||(booking&&new Date(booking.expiresAt)<=new Date())?'Đơn đã hết hạn giữ ghế. Nếu tài khoản đã bị trừ tiền, vui lòng liên hệ nhân viên để đối soát.':result?.status==='failed'?'Thanh toán không thành công hoặc đã hủy. Bạn có thể thanh toán lại trong thời hạn giữ ghế.':'Đang chờ xác nhận từ VNPay. Vé sẽ xuất hiện sau khi máy chủ xác nhận.';
 return <main className="page paymentPage"><h1>Kết quả thanh toán VNPay</h1>
  {error?<p role="alert">{error}</p>:<p role="status">{message}</p>}
  {booking&&<><p>Mã đơn: {booking._id}</p><p>Ghế: {booking.seats.join(', ')} · {Number(booking.total).toLocaleString('vi-VN')}đ</p>
   {booking.status==='paid'&&<div className="ticketGrid">{booking.tickets?.map(ticket=><article key={ticket.code}><h2>Ghế {ticket.seat}</h2><img src={ticket.qr} alt={'QR vé ghế '+ticket.seat} width="220" height="220"/><p>{ticket.code}</p></article>)}</div>}</>}
  <button onClick={()=>setRetry(value=>value+1)}>Kiểm tra lại trạng thái</button> <Link to="/account?section=tickets">Về vé của tôi</Link>
 </main>;
}
