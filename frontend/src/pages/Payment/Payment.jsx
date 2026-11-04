import {useEffect,useState} from 'react';
import {api} from '../../services/api';
import FoodPicker, {foodImage} from '../../components/FoodPicker';
import {translateFoodName} from '../../utils/uiText';
import useMemberPoints from '../../hooks/useMemberPoints';
const money=value=>Number(value||0).toLocaleString('vi-VN')+'đ';
export default function Payment({user,setUser,pending,setPending,foods=[],pointsPolicy,setTab,setMsg}) {
 const [booking,setBooking]=useState(pending),[points,setPoints]=useState(String(pending?.pointsUsed||0)),[items,setItems]=useState([]),[editingFood,setEditingFood]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clock,setClock]=useState(Date.now()),[received,setReceived]=useState(''),[notice,setNotice]=useState(''),[method,setMethod]=useState('demo');
 const wallet=useMemberPoints(user,setUser),counter=['admin','employee'].includes(user?.role);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!notice||counter||booking?.status!=='pending')return;
  let active=true;const refresh=()=>api('/bookings/'+booking._id).then(result=>{if(active){sync(result);if(result.status==='paid')wallet.refresh();}}).catch(e=>{if(active)setError(e.message);});
  const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[notice,counter,booking?._id,booking?.status]);
 if(!booking)return <section className="page"><h2>Chưa có đơn thanh toán</h2><button onClick={()=>setTab('booking')}>Đặt vé</button></section>;
 const path=counter?'/counter/bookings/'+booking._id:'/bookings/'+booking._id;
 const remaining=Math.max(0,Math.ceil((new Date(booking.expiresAt)-clock)/1000));
 const pointStep=counter?(pointsPolicy?.pointRedeemStep||100):wallet.step;
 const balance=counter?Number(booking.user?.memberPoints||0):wallet.balance;
 const maxPoints=Math.floor(Math.min(balance,Math.floor(booking.subtotal/1000))/pointStep)*pointStep;
 const pointsDirty=Number(points)!==booking.pointsUsed;
 const validPoints=points!==''&&Number.isSafeInteger(Number(points))&&Number(points)>=0&&Number(points)<=maxPoints&&Number(points)%pointStep===0;
 const editable=booking.status==='pending'&&remaining>0;
 const blocked=busy||editingFood||pointsDirty||(counter&&booking.total>0&&(received===''||Number(received)!==booking.total));
 async function perform(action){if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e.message);if(!counter)wallet.refresh();}finally{setBusy(false);}}
 function sync(result){setBooking(result);setPending(result);setPoints(String(result.pointsUsed||0));if(user.role==='member'&&result.user)setUser(current=>current?._id===user._id?{...current,memberPoints:result.user.memberPoints}:current);}
 const post=(suffix,body,method='POST')=>api(path+suffix,{method,body:JSON.stringify(body)});
 const pay=()=>perform(async()=>{
  const chosen=booking.total===0?'points':counter?'demo':method;
  const result=await post('/pay',{method:chosen,receivedAmount:Number(received)});
  if(chosen==='cash'){sync(result.booking);setNotice(result.message+' Mã đơn: '+booking._id);}
  else {sync(result);setNotice('');setMsg('Thanh toán giả lập thành công.');if(!counter)wallet.refresh();}
 });
 return <section className="page paymentPage"><div className="payment checkoutPayment">
 <header className="paymentHeading"><div><p className="bookingEyebrow">CINEMA+ / HOÀN TẤT ĐẶT VÉ</p><h2>{booking.status==='paid'?'Đã hoàn tất đơn':'Xác nhận đơn vé'}</h2><p>Kiểm tra thông tin trước khi hoàn tất đặt vé.</p></div><span className="simulationBadge">Thanh toán giả lập · Không thu tiền thật</span></header>
 {error&&<p className="paymentError" role="alert">{error}</p>}{notice&&booking.status==='pending'&&<p className="paymentNotice" role="status">{notice}</p>}
 <div className="paymentLayout"><div className="paymentMain">
 <section className="paymentPanel"><div className="panelHeading"><h3>Thông tin vé</h3><span className={'orderStatus '+booking.status}>{booking.status==='paid'?'Đã thanh toán':booking.status==='cancelled'?'Đã hủy':'Chờ thanh toán'}</span></div>
 <h3 className="paymentMovieTitle">{booking.showtime?.movie?.title}</h3><dl className="ticketDetails"><div><dt>Rạp chiếu</dt><dd>{booking.showtime?.cinema}</dd></div><div><dt>Phòng</dt><dd>{booking.showtime?.room||'—'}</dd></div><div><dt>Suất chiếu</dt><dd>{booking.showtime?.startTime?new Date(booking.showtime.startTime).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'}):'—'}</dd></div><div><dt>Ghế đã chọn</dt><dd className="paymentSeats">{booking.seats.map(seat=><span key={seat}>{seat}</span>)}</dd></div></dl>
 <p className="orderReference">Mã đơn: {booking._id}</p><p className="helperText">Nhân viên kiểm tra tuổi và điều kiện người giám hộ tại quầy.</p></section>
 <section className="paymentPanel"><div className="panelHeading"><h3>Bắp & nước</h3>{editable&&<button className="ghost" disabled={busy} onClick={()=>{setItems(booking.foodItems.map(item=>({...item.food,quantity:item.quantity})));setEditingFood(!editingFood);}}>{editingFood?'Hủy chỉnh sửa':'Đổi bắp nước'}</button>}</div>
 {editingFood?<><FoodPicker foods={foods} items={items} onChange={setItems} disabled={busy}/><button className="primary" disabled={busy} onClick={()=>perform(async()=>{sync(await post('/food',{foodItems:items.map(item=>({food:item._id,quantity:item.quantity}))},'PATCH'));setEditingFood(false);})}>Lưu món và cập nhật tổng tiền</button></>:booking.foodItems?.length?<div className="paymentFoodList">{booking.foodItems.map(item=><div className="paymentFoodRow" key={item._id||item.food?._id}><img src={foodImage(item.food||item)} alt={translateFoodName(item.name||item.food?.name)} width="64" height="64"/><div><strong>{translateFoodName(item.name||item.food?.name)}</strong><small>{item.quantity} × {money(item.unitPrice)}</small></div><b>{money(item.unitPrice*item.quantity)}</b></div>)}</div>:<p className="helperText">Bạn chưa chọn bắp nước. Có thể thêm món hoặc tiếp tục thanh toán.</p>}</section>
 {editable&&(booking.user||!counter)&&<section className="paymentPanel pointsPayment"><h3>Ưu đãi thành viên</h3><p>Số dư: <strong>{balance} điểm</strong> · 1 điểm = 1.000đ</p><label htmlFor="paymentPoints">Điểm muốn sử dụng</label><div className="pointsControl"><input id="paymentPoints" type="number" min="0" step={pointStep} max={maxPoints} value={points} onChange={e=>setPoints(e.target.value)} disabled={busy}/><button className="ghost" disabled={busy||!validPoints||!pointsDirty} onClick={()=>perform(async()=>{sync(await post('/points',{points:Number(points)},'PATCH'));})}>Áp dụng điểm</button>{booking.pointsUsed>0&&<button className="ghost" disabled={busy} onClick={()=>perform(async()=>{sync(await post('/points',{points:0},'PATCH'));})}>Bỏ dùng điểm</button>}</div><small>Đổi theo bội số {pointStep}, tối đa {maxPoints} điểm. Chỉ trừ khi thanh toán thành công.</small>{!counter&&<button className="paymentTextButton" disabled={busy||wallet.refreshing} onClick={wallet.refresh}>Làm mới số dư</button>}</section>}
 </div><aside className="paymentPanel paymentReceipt"><h3>Chi tiết thanh toán</h3>{editable&&<div className={'holdTimer'+(remaining<120?' urgent':'')} role="timer">Giữ ghế còn <strong>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></div>}
 <div className="receiptLines"><p><span>Vé ({booking.seats.length} × {money(booking.ticketPrice)})</span><b>{money(booking.ticketPrice*booking.seats.length)}</b></p><p><span>Bắp nước</span><b>{money(booking.subtotal-booking.ticketPrice*booking.seats.length)}</b></p><p><span>Tạm tính</span><b>{money(booking.subtotal)}</b></p><p className="receiptDiscount"><span>Giảm từ {booking.pointsUsed} điểm</span><b>−{money(booking.discount)}</b></p></div><div className="receiptTotal"><span>{booking.status==='paid'?'Đã thanh toán giả lập':'Tổng thanh toán'}</span><strong>{money(booking.total)}</strong></div>
 {editable&&<>
 {!counter&&booking.total>0&&<fieldset className="paymentMethods"><legend>Phương thức thanh toán</legend><label className={method==='demo'?'selected':''}><input type="radio" name="paymentMethod" value="demo" checked={method==='demo'} disabled={busy} onChange={()=>setMethod('demo')}/><span><strong>VNPay giả lập</strong><small>Hoàn tất ngay, nhận vé QR</small></span></label><label className={method==='cash'?'selected':''}><input type="radio" name="paymentMethod" value="cash" checked={method==='cash'} disabled={busy} onChange={()=>setMethod('cash')}/><span><strong>Tiền mặt tại quầy</strong><small>Nhân viên xác nhận trước khi hết giữ ghế</small></span></label></fieldset>}
 {counter&&booking.total>0&&<label className="receivedLabel">Số tiền khách đưa (giả lập)<input type="number" min="0" step="1" value={received} onChange={e=>setReceived(e.target.value)} disabled={busy}/><small>Nhập đúng {money(booking.total)} để xác nhận.</small></label>}
 {booking.total===0&&<p className="paymentNotice">Điểm đã đủ thanh toán toàn bộ đơn. Xác nhận để nhận vé QR.</p>}
 {(editingFood||pointsDirty)&&<p className="helperText" role="status">Lưu thay đổi bắp nước hoặc áp dụng điểm trước khi thanh toán.</p>}
 <button className="primary paymentSubmit" disabled={blocked||(!counter&&method==='cash'&&!!notice&&booking.total>0)} onClick={pay}>{busy?'Đang xử lý…':booking.total===0?'Xác nhận thanh toán bằng điểm':counter?'Xác nhận thu tiền tại quầy (giả lập)':method==='cash'?(notice?'Đang chờ thanh toán tại quầy':'Xác nhận trả tại quầy'):'VNPay giả lập — Thành công'}</button>
 {!counter&&method==='demo'&&booking.total>0&&<details className="simulationTools"><summary>Thử tình huống thanh toán</summary><button className="ghost" disabled={blocked} onClick={()=>perform(async()=>{sync(await post('/pay',{method:'demo',result:'failed'}));setError('Thanh toán giả lập thất bại. Đơn vẫn chưa trả tiền; điểm và tồn kho không thay đổi.');})}>Giả lập thất bại / Thử lại</button></details>}
 <button className="paymentTextButton cancelOrder" disabled={busy} onClick={()=>perform(async()=>{if(window.confirm('Hủy đơn và giải phóng ghế?'))sync(await post('/cancel',{}));})}>Hủy đơn và giải phóng ghế</button></>}
 {booking.status==='pending'&&remaining===0&&<><p className="paymentError" role="alert">Giữ ghế đã hết hạn. Vui lòng tạo đơn mới.</p><button className="primary" onClick={()=>setTab('booking')}>Đặt vé lại</button></>}
 {booking.status==='cancelled'&&<p>Đơn đã hủy. Không trừ điểm hoặc tồn kho.</p>}
 </aside></div>
 {booking.status==='paid'&&<div className="ticketGrid">{booking.tickets?.map(ticket=><article className="ticketCard" key={ticket.code}><h3>Ghế {ticket.seat}</h3><img width="220" height="220" src={ticket.qr} alt={'Mã QR vé ghế '+ticket.seat}/><p>Mã vé: {ticket.code}</p><p>{booking.showtime?.movie?.title}</p><small>Chỉ phát hành sau khi hoàn tất thanh toán giả lập.</small></article>)}</div>}
 <button className="ghost paymentBack" disabled={busy} onClick={()=>setTab(counter?'booking':'account')}>{counter?'Về quầy vé':'Về tài khoản / Vé của tôi'}</button></div></section>;
}
