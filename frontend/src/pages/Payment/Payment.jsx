import {useEffect,useState} from 'react';
import {api} from '../../services/api';
import FoodPicker, {foodImage} from '../../components/FoodPicker';
import {translateFoodName} from '../../utils/uiText';
import useMemberPoints from '../../hooks/useMemberPoints';
import { memberPointsQuote } from '../../utils/memberPoints';
import {Link} from 'react-router-dom';
import CounterPromotion from '../../components/CounterPromotion';
const money=value=>Number(value||0).toLocaleString('vi-VN')+'đ';
export default function Payment({user,setUser,pending,setPending,foods=[],pointsPolicy,setTab,setMsg,collectionOnly=false}) {
 const [booking,setBooking]=useState(pending),[points,setPoints]=useState(String(pending?.pointsUsed||0)),[items,setItems]=useState([]),[editingFood,setEditingFood]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clock,setClock]=useState(Date.now()),[received,setReceived]=useState(''),[notice,setNotice]=useState(''),[method,setMethod]=useState(['admin','employee'].includes(user?.role)?'cash':'vnpay');
 const [gatewayUrl,setGatewayUrl]=useState('');
 const [paymentUncertain,setPaymentUncertain]=useState(false);
 const wallet=useMemberPoints(user,setUser),counter=['admin','employee'].includes(user?.role);
 const [promotionDirty,setPromotionDirty]=useState(false);
 useEffect(()=>{
  if(counter&&pending){setBooking(pending);setPoints(String(pending.pointsUsed||0));setReceived('');}
 },[pending,counter]);
 useEffect(()=>{
  if(counter||!pending?._id)return;
  let active=true;
  api('/bookings/'+pending._id).then(data=>{if(active)sync(data);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[pending?._id,counter]);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(counter ? !booking?.activePayment&&!paymentUncertain : !notice||booking?.status!=='pending')return;
  let active=true;const refresh=()=>api((counter?'/payments/bookings/':'/bookings/')+booking._id).then(result=>{if(active){sync(result);if(result.status==='paid'&&!counter)wallet.refresh();}}).catch(e=>{if(active)setError(e.message);});
  const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[notice,counter,booking?._id,booking?.status,booking?.activePayment,paymentUncertain]);
 if(!booking)return <section className="page"><h2>Chưa có đơn thanh toán</h2><button onClick={()=>setTab('booking')}>Đặt vé</button></section>;
 const path=counter?(collectionOnly?'/payments/bookings/':'/counter/bookings/')+booking._id:'/bookings/'+booking._id;
 const deadline=Math.min(new Date(booking.expiresAt).getTime(),new Date(booking.showtime?.startTime||booking.expiresAt).getTime());
 const remaining=Math.max(0,Math.ceil((deadline-clock)/1000));
 const pointStep=counter?(pointsPolicy?.pointRedeemStep||1):wallet.step;
 const balance=counter?Number(booking.user?.memberPoints||0):wallet.balance;
 const pointsAllowed=!booking.promotion||booking.promotion.stackable;
 const {maxPoints,pointsValid:validPoints}=memberPointsQuote(pointsAllowed?balance:0,booking.subtotal-(booking.promotionDiscount||0),points,pointStep);
 const pointsDirty=points.trim()===''||Number(points)!==Number(booking.pointsUsed||0);
 const editable=booking.status==='pending'&&remaining>0&&!booking.activePayment&&!paymentUncertain;
 const canEditOrder=editable&&!collectionOnly&&(!counter||user.role==='admin'||String(booking.counterEmployee)===String(user._id));
 const validCash=received.trim()!==''&&Number.isSafeInteger(Number(received))&&Number(received)>=booking.total;
 const change=validCash?Number(received)-booking.total:0;
 const blocked=!editable||busy||editingFood||pointsDirty||promotionDirty||(counter&&method==='cash'&&booking.total>0&&!validCash);
 // Quản lý trạng thái đang xử lý và thông báo lỗi khi gửi yêu cầu thanh toán/chỉnh đơn.
 async function perform(action){if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e.message);if(!counter)wallet.refresh();}finally{setBusy(false);}}
 // Đồng bộ đơn và số dư trên giao diện theo dữ liệu server trả về.
 function sync(result,{preservePointsDraft=false}={}){
  setPaymentUncertain(false);
  if(!result.activePayment||result.cashReceived>0)setGatewayUrl('');
  if(counter&&!result.activePayment)setNotice('');
  if(counter&&result.total!==booking?.total)setReceived('');
  setBooking(result);setPending(result);if(!preservePointsDraft||!pointsDirty)setPoints(String(result.pointsUsed||0));
  if(user.role==='member'&&result.user)setUser(current=>current?._id===user._id?{...current,memberPoints:result.user.memberPoints}:current);
 }
 const post=(suffix,body,method='POST')=>api(path+suffix,{method,body:JSON.stringify(body)});
 // Gửi yêu cầu thanh toán; với khách online, chuyển tới URL VNPay do server tạo.
 const pay=()=>perform(async()=>{
  const chosen=booking.total===0?'points':counter?method:'vnpay';
  let result;
  try { result=await post('/pay',{method:chosen,receivedAmount:chosen==='cash'?Number(received):0,confirmedTotal:booking.total}); }
  catch(error){if(counter&&chosen==='cash'&&(!error.status||error.status>=500))setPaymentUncertain(true);throw error;}
  if(result.paymentUrl){
   if(!counter){window.location.assign(result.paymentUrl);return;}
   setGatewayUrl(result.paymentUrl);sync(result.booking);setNotice('Mở VNPay để khách thanh toán. Chờ máy chủ xác nhận kết quả.');return;
  }
  sync(result);if(result.status==='paid'){setNotice('');setMsg('Thanh toán thành công.');if(!counter)wallet.refresh();}else setNotice('Khoản thu đã được lưu và đang cần đối soát. Không thu tiền lần nữa.');
 });
 let submitLabel = 'Thanh toán qua VNPay Sandbox';
 if (busy) submitLabel = 'Đang xử lý…';
 else if (booking.total === 0) submitLabel = booking.promotion ? 'Xác nhận đơn 0đ' : 'Xác nhận thanh toán bằng điểm';
 else if (counter && method === 'vnpay') submitLabel = 'Tạo thanh toán VNPay';
 else if (counter) submitLabel = change > 0 ? 'Xác nhận thu tiền và trả tiền thừa' : 'Xác nhận thu tiền tại quầy';
 return <section className="page paymentPage"><div className="payment checkoutPayment">
 <header className="paymentHeading"><div><p className="bookingEyebrow">CINEMA+ / HOÀN TẤT ĐẶT VÉ</p><h2>{booking.status==='paid'?'Đã hoàn tất đơn':'Xác nhận đơn vé'}</h2><p>Kiểm tra thông tin trước khi hoàn tất đặt vé.</p></div><span className="simulationBadge">{counter?'VNPay Sandbox / Thanh toán tại quầy':'VNPay Sandbox'}</span></header>
 {error&&<p className="paymentError" role="alert">{error}</p>}{notice&&booking.status==='pending'&&<p className="paymentNotice" role="status">{notice}</p>}
 {booking.paymentIssue&&<p className="paymentError" role="alert">{booking.paymentIssue}</p>}
 {(booking.activePayment||paymentUncertain)&&<section className="paymentNotice" aria-label="Giao dịch đang xử lý">
  <p>{paymentUncertain?'Chưa xác nhận lưu khoản thu. Kiểm tra kết quả trước khi xử lý tiếp; không yêu cầu khách trả tiền lần nữa.':booking.cashReceived>0?'Đã ghi nhận tiền mặt. Không thu lại tiền; mở đối soát nếu chưa hoàn tất.':'Đang chờ kết quả giao dịch. Chưa thể thu thêm tiền hoặc đổi phương thức.'}</p>
  {gatewayUrl&&!booking.cashReceived&&<a href={gatewayUrl} target="_blank" rel="noopener noreferrer">Mở VNPay cho khách thanh toán</a>}
  {counter&&booking.activePayment&&!gatewayUrl&&!booking.cashReceived&&<button className="ghost" disabled={busy} onClick={()=>perform(async()=>{const result=await post('/pay',{method:'vnpay'});if(result.paymentUrl)setGatewayUrl(result.paymentUrl);else sync(result);})}>Mở lại VNPay</button>}
  <button className="ghost" disabled={busy} onClick={()=>perform(async()=>sync(await api((counter?'/payments/bookings/':'/bookings/')+booking._id)))}>Kiểm tra kết quả</button> {counter?<Link to={'/staff/tools?section=reconciliation&booking='+encodeURIComponent(booking._id)}>Đối soát thanh toán</Link>:!booking.cashReceived&&<Link to={'/payment-result?reference='+encodeURIComponent(booking.activePayment)}>Xem kết quả VNPay</Link>}
 </section>}
 <div className="paymentLayout"><div className="paymentMain">
 <section className="paymentPanel"><div className="panelHeading"><h3>Thông tin vé</h3><span className={'orderStatus '+booking.status}>{{paid:'Đã thanh toán',cancelled:'Đã hủy',pending:'Chờ thanh toán','refund-requested':'Đang hoàn điểm',refunded:'Đã hoàn về điểm'}[booking.status] || 'Cần kiểm tra trạng thái'}</span></div>
 {booking.refund?.reference&&<p role="status">{booking.refund.status==='completed'?'Đã hoàn':'Đang xử lý hoàn'} {Number(booking.refund.points).toLocaleString('vi-VN',{maximumFractionDigits:3})} điểm thành viên.</p>}
 <h3 className="paymentMovieTitle">{booking.showtime?.movie?.title}</h3><dl className="ticketDetails"><div><dt>Rạp chiếu</dt><dd>{booking.showtime?.cinema}</dd></div><div><dt>Phòng</dt><dd>{booking.showtime?.room||'—'}</dd></div><div><dt>Suất chiếu</dt><dd>{booking.showtime?.startTime?new Date(booking.showtime.startTime).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'}):'—'}</dd></div><div><dt>Ghế đã chọn</dt><dd className="paymentSeats">{booking.seats.map(seat=><span key={seat}>{seat}</span>)}</dd></div></dl>
 <p className="orderReference">Mã đơn: {booking._id}</p><p className="helperText">Nhân viên kiểm tra tuổi và điều kiện người giám hộ tại quầy.</p></section>
 <section className="paymentPanel"><div className="panelHeading"><h3>Bắp & nước</h3>{canEditOrder&&<button className="ghost" disabled={busy} onClick={()=>{setError('');setItems(booking.foodItems.map(item=>({...item.food,quantity:item.quantity})));setEditingFood(!editingFood);}}>{editingFood?'Hủy chỉnh sửa':'Đổi bắp nước'}</button>}</div>
 {editingFood?<><FoodPicker foods={foods} items={items} onChange={setItems} disabled={busy}/><button className="primary" disabled={busy} onClick={()=>perform(async()=>{sync(await post('/food',{foodItems:items.map(item=>({food:item._id,quantity:item.quantity}))},'PATCH'));setEditingFood(false);})}>Lưu món và cập nhật tổng tiền</button></>:booking.foodItems?.length?<div className="paymentFoodList">{booking.foodItems.map(item=><div className="paymentFoodRow" key={item._id||item.food?._id}><img src={foodImage(item.food||item)} alt={translateFoodName(item.name||item.food?.name)} width="64" height="64"/><div><strong>{translateFoodName(item.name||item.food?.name)}</strong><small>{item.quantity} × {money(item.unitPrice)}</small></div><b>{money(item.unitPrice*item.quantity)}</b></div>)}</div>:<p className="helperText">{canEditOrder?'Bạn chưa chọn bắp nước. Có thể thêm món hoặc tiếp tục thanh toán.':'Đơn không có bắp nước đi kèm.'}</p>}</section>
 {!collectionOnly&&<CounterPromotion
  heading={counter?'Khuyến mãi tại quầy':'Mã khuyến mãi'} booking={booking} editable={canEditOrder}
  disabled={busy||editingFood} onDraftChange={setPromotionDirty} onCancelDraft={()=>setError('')}
  onApply={code=>perform(async()=>{sync(await post('/promotion',{code},'PATCH'),{preservePointsDraft:true});})}
  onReplacePoints={code=>perform(async()=>{sync(await post('/promotion',{code,replacePoints:true},'PATCH'));})}
  onRemove={()=>perform(async()=>{sync(await post('/promotion',{code:''},'PATCH'),{preservePointsDraft:true});})}
 />}
 {canEditOrder&&(booking.user||!counter)&&<section className="paymentPanel pointsPayment">
  <h3>Ưu đãi thành viên</h3><p>Số dư: <strong>{balance} điểm</strong> · 1 điểm = 1.000đ</p>
  <p className="paymentPointsApplied">Đang áp dụng: <strong>{booking.pointsUsed||0} điểm</strong> · Giảm {money(booking.discount)}</p>
  <label htmlFor="paymentPoints">Điểm muốn sử dụng</label>
  <div className="pointsControl"><input id="paymentPoints" type="number" min="0" step={pointStep} max={maxPoints} value={points} onChange={e=>setPoints(e.target.value)} disabled={busy||!pointsAllowed}/>
   <button className="ghost" disabled={busy||!validPoints||!pointsDirty} onClick={()=>perform(async()=>{sync(await post('/points',{points:Number(points)},'PATCH'));})}>Áp dụng điểm</button>
   {pointsDirty&&<button className="ghost" disabled={busy} onClick={()=>{setPoints(String(booking.pointsUsed||0));setError('');}}>Hủy thay đổi điểm</button>}
   {booking.pointsUsed>0&&<button className="ghost" disabled={busy} onClick={()=>perform(async()=>{sync(await post('/points',{points:0},'PATCH'));})}>Bỏ dùng điểm</button>}
  </div>
  <small>{pointsAllowed?`${pointStep===1?'Nhập số điểm nguyên':`Đổi theo bội số ${pointStep}`}, tối đa ${maxPoints} điểm. Chỉ trừ khi thanh toán thành công.`:'Mã khuyến mãi đang áp dụng không dùng cùng điểm. Bỏ mã nếu muốn sử dụng điểm.'}</small>
  {!counter&&<button className="paymentTextButton" disabled={busy||wallet.refreshing} onClick={wallet.refresh}>Làm mới số dư</button>}
 </section>}
 </div><aside className="paymentPanel paymentReceipt"><h3>Chi tiết thanh toán</h3>{editable&&<div className={'holdTimer'+(remaining<120?' urgent':'')} role="timer">Giữ ghế còn <strong>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></div>}
 <div className="receiptLines"><p><span>Vé ({booking.seats.length} × {money(booking.ticketPrice)})</span><b>{money(booking.ticketPrice*booking.seats.length)}</b></p><p><span>Bắp nước</span><b>{money(booking.subtotal-booking.ticketPrice*booking.seats.length)}</b></p><p><span>Tạm tính</span><b>{money(booking.subtotal)}</b></p>
 {booking.promotion&&<p className="receiptDiscount"><span>Khuyến mãi ({booking.promotion.code})</span><b>−{money(booking.promotionDiscount)}</b></p>}
 <p className="receiptDiscount"><span>Giảm từ {booking.pointsUsed} điểm</span><b>−{money(booking.discount)}</b></p></div><div className="receiptTotal"><span>{booking.status==='paid'?'Đã thanh toán ':'Tổng thanh toán'}</span><strong>{money(booking.total)}</strong></div>
 {booking.cashReceived!=null&&<div className="receiptLines"><p><span>Khách đưa</span><b>{money(booking.cashReceived)}</b></p><p><span>Tiền thừa đã trả</span><b>{money(booking.change)}</b></p></div>}
 {editable&&<>
 {booking.total>0&&<fieldset className="paymentMethods"><legend>Phương thức thanh toán</legend><label className={method==='vnpay'?'selected':''}><input type="radio" name="paymentMethod" value="vnpay" checked={method==='vnpay'} disabled={busy} onChange={()=>setMethod('vnpay')}/><span><strong>VNPay Sandbox</strong><small>Chuyển sang cổng thanh toán Sandbox</small></span></label>{counter&&<label className={method==='cash'?'selected':''}><input type="radio" name="paymentMethod" value="cash" checked={method==='cash'} disabled={busy} onChange={()=>setMethod('cash')}/><span><strong>Tiền mặt tại quầy</strong><small>Nhân viên xác nhận trước khi hết giữ ghế</small></span></label>}</fieldset>}
 {counter&&method==='cash'&&booking.total>0&&<label className="receivedLabel">Số tiền khách đưa<input type="number" min="0" step="1" value={received} onChange={e=>setReceived(e.target.value)} disabled={busy}/><small>{validCash?`Tiền trả khách: ${money(change)}`:`Cần nhận tối thiểu ${money(booking.total)}.`}</small></label>}
 {booking.total===0&&<p className="paymentNotice">Đơn đã được giảm còn 0đ. Xác nhận để nhận vé QR.</p>}
 {editingFood&&<p className="helperText" role="status">Lưu món hoặc hủy chỉnh sửa bắp nước trước khi thanh toán.</p>}
 {promotionDirty&&<p className="helperText" role="status">Mã vừa nhập chưa áp dụng. Chọn Áp dụng mã hoặc Hủy thay đổi mã.</p>}
 {pointsDirty&&<p className="helperText" role="status">Số điểm vừa nhập chưa áp dụng. Chọn Áp dụng điểm hoặc Hủy thay đổi điểm.</p>}
 <button className="primary paymentSubmit" disabled={blocked} onClick={pay}>{submitLabel}</button>

 {canEditOrder&&<button className="paymentTextButton cancelOrder" disabled={busy} onClick={()=>perform(async()=>{if(window.confirm('Hủy đơn và giải phóng ghế?'))sync(await post('/cancel',{}));})}>Hủy đơn và giải phóng ghế</button>}</>}
 {booking.status==='pending'&&remaining===0&&<><p className="paymentError" role="alert">{booking.activePayment||paymentUncertain?'Giữ ghế đã hết hạn. Cần kiểm tra và đối soát giao dịch trước khi thu thêm tiền.':'Giữ ghế đã hết hạn. Vui lòng tạo đơn mới.'}</p>{!booking.activePayment&&!paymentUncertain&&!collectionOnly&&<button className="primary" onClick={()=>setTab('booking')}>Đặt vé lại</button>}</>}
 {booking.status==='cancelled'&&<p>Đơn đã hủy. Không trừ điểm hoặc tồn kho.</p>}
 </aside></div>
 {booking.status==='paid'&&<>{!counter&&<Link to={'/bookings/'+booking._id+'/tickets'}>Xem vé QR và trạng thái check-in</Link>}{booking.ticketMode==='demo'&&<p role="status">Vé mô phỏng — không xác nhận vào rạp thật.</p>}<div className="ticketGrid">{booking.tickets?.map(ticket=><article className="ticketCard" key={ticket.code}><h3>Ghế {ticket.seat}</h3>{['valid','issued'].includes(ticket.status)?<img width="220" height="220" src={ticket.qr} alt={'Mã QR vé ghế '+ticket.seat}/>:<p>{ticket.status==='checked-in'?'Đã check-in':'Vé không còn sử dụng được'}</p>}<p>Mã vé: {ticket.code}</p><p>{booking.showtime?.movie?.title}</p><small>Chỉ phát hành sau khi hoàn tất thanh toán.</small></article>)}</div></>}
 <button className="ghost paymentBack" disabled={busy} onClick={()=>setTab(counter?'booking':'account')}>{counter?'Về quầy vé':'Về tài khoản / Vé của tôi'}</button></div></section>;
}
