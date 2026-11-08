import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {api} from '../../services/api';
import {useAuth} from '../../context/AuthContext';

export default function PaymentResult() {
 const [params]=useSearchParams();
 const {user}=useAuth();
 const staff=['admin','employee'].includes(user?.role);
 const reference=params.get('reference')||params.get('vnp_TxnRef');
 const [result,setResult]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!reference){setError('Thiếu mã giao dịch VNPay.');return;}
  let active=true,timer;
  async function refresh(){try{
   const data=await api((staff?'/payments/results/':'/bookings/payment-result/')+encodeURIComponent(reference));
   if(!active)return;
   setError('');setResult(data);
   if(data.status==='created'&&data.booking.status==='pending'&&new Date(data.booking.expiresAt)>new Date())timer=setTimeout(refresh,3000);
  }catch(e){if(active)setError(e.message);}}
  refresh();return()=>{active=false;clearTimeout(timer);};
 },[reference,retry,staff]);
 const booking=result?.booking;
 const paid=result?.status==='succeeded'&&booking?.status==='paid'&&booking.paymentRef===reference;
 const refund=result?.refund || booking?.refund;
 const refunded=refund?.status==='completed'&&refund.reference===reference;
 const message=paid?'Thanh toán thành công':result?.status==='unresolved'?'Giao dịch đang cần đối soát. Vui lòng liên hệ nhân viên, không thanh toán lại.':booking?.status==='cancelled'||(booking&&new Date(booking.expiresAt)<=new Date())?'Đơn đã hết hạn giữ ghế. Nếu tài khoản đã bị trừ tiền, vui lòng liên hệ nhân viên để đối soát.':result?.status==='failed'?'Thanh toán không thành công hoặc đã hủy. Bạn có thể thanh toán lại trong thời hạn giữ ghế.':'Đang chờ xác nhận từ VNPay. Vé sẽ xuất hiện sau khi máy chủ xác nhận.';
 return <main className="page paymentPage"><h1>Kết quả thanh toán VNPay</h1>
  {error?<p role="alert">{error}</p>:<p role="status">{refunded ? `Khoản thanh toán đã hoàn về ${Number(refund.points).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} điểm thành viên. ${booking?.status === 'paid' ? 'Vé thanh toán bằng giao dịch khác vẫn được giữ nguyên.' : 'Vé không còn sử dụng được.'}` : booking?.status === 'refund-requested' ? 'Đang xử lý hoàn điểm. Không thanh toán lại.' : message}</p>}
  {booking&&<><p>Mã đơn: {booking._id}</p><p>Ghế: {booking.seats.join(', ')} · {Number(booking.total).toLocaleString('vi-VN')}đ</p>
   {paid&&<>{!staff&&<Link to={'/bookings/'+booking._id+'/tickets'}>Xem vé QR và trạng thái check-in</Link>}<div className="ticketGrid">{booking.tickets?.map(ticket=><article key={ticket.code}><h2>Ghế {ticket.seat}</h2>{['valid','issued'].includes(ticket.status)?<img src={ticket.qr} alt={'QR vé ghế '+ticket.seat} width="220" height="220"/>:<p>{ticket.status==='checked-in'?'Đã check-in':'Vé không còn sử dụng được'}</p>}<p>{ticket.code}</p></article>)}</div></>}</>}
  <button onClick={()=>setRetry(value=>value+1)}>Kiểm tra lại trạng thái</button> <Link to={staff?'/staff/tools':'/account?section=tickets'}>{staff?'Về nghiệp vụ quầy':'Về vé của tôi'}</Link>
 </main>;
}
