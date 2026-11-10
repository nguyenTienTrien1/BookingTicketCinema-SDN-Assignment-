import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, Text, View } from 'react-native';
import { openExternal } from '../../services/browser';
import { appReturnUrl } from '../../services/appReturnUrl';
import { LinearGradient } from 'expo-linear-gradient';
import { api, ApiError, readDraft, writeDraft } from '../../services/api';
import { money, statusText, when } from '../../utils/format';
import { Booking, Food, Movie, Showtime, TicketResult } from '../../utils/types';
import { Artwork, Badge, Button, Card, Chip, ConfirmButton, Eyebrow, Field, Heading, Muted, Page, Section, StickyBar } from '../../components/ui';
import { colors, s } from '../../theme/index';
import { useSession } from '../../context/SessionContext';
import RefundPanel from '../../components/RefundPanel';
import SeatPlan from '../../components/SeatPlan';
import { Icon } from '../../components/Icon';
import { orphanSeatMessage } from '../../../../shared/seatSelection.mjs';
import { holdSeconds, maxRedeemablePoints, validRedemption, bookingSummary } from '../../utils/checkout';

export function MovieDetail({ movie, onBook }: { movie: Movie; onBook: (show: Showtime) => void }) {
  const [shows, setShows] = useState<Showtime[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError('');
    try { setShows((await api<Showtime[]>('/movies/showtimes?movie=' + movie._id)).filter(show => !show.cancelledAt && new Date(show.startTime) > new Date())); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void Promise.resolve().then(load); }, [movie._id]);
  return <Page><View style={{borderRadius:22,overflow:'hidden',backgroundColor:colors.panel}}><Artwork uri={movie.banner||movie.poster} wide/><LinearGradient colors={['transparent','#0a0b10d0']} style={{position:'absolute',left:0,right:0,bottom:0,height:90}}/><View style={{position:'absolute',left:14,bottom:14}}><Badge tone="red">{movie.classification||'P'}</Badge></View></View><Heading>{movie.title}</Heading>
    <View style={s.wrap}><Badge>{movie.duration} phút</Badge><Badge tone="gold">{movie.rating?`${movie.rating}/10`:'Chưa có đánh giá'}</Badge></View><Muted>{movie.genre.join(' / ')}</Muted>
    <Text style={{ color: '#c5cddd', lineHeight: 25 }}>{movie.description || 'Chưa có mô tả.'}</Text>
    <Section title="Chọn suất chiếu" detail={`${shows.length} suất`}/>{loading && <Muted>Đang tải lịch chiếu…</Muted>}
    {!!error && <><Text style={s.error}>{error}</Text><Button secondary title="Thử lại" onPress={load} /></>}
    {!loading && !error && !shows.length && <Card><Muted>Phim chưa có suất chiếu sắp tới.</Muted></Card>}
    {[...new Set(shows.map(show=>show.cinema))].map(cinema=><Card key={cinema}><View style={s.row}><Icon name="pin" size={18} color={colors.pink}/><Text style={[s.title,{flex:1}]}>{cinema}</Text></View><View style={s.wrap}>{shows.filter(show=>show.cinema===cinema).map(show=><View key={show._id} style={{width:'48%'}}><Button secondary accessibilityLabel={`${when(show.startTime)} · ${money(show.price)} · Chọn ghế`} title={when(show.startTime)} onPress={()=>onBook(show)}/><Text style={[s.muted,{textAlign:'center',fontSize:11,marginTop:5}]}>{show.room} · {money(show.price)}</Text></View>)}</View></Card>)}
  </Page>;
}

export function ChooseBooking({ show: initialShow, onCreated, onHistory, counter=false }: { show: Showtime; onCreated: (booking: Booking) => void; onHistory: () => void; counter?:boolean }) {
  const {user}=useSession();
  const [customerType,setCustomerType]=useState('guest'),[memberSearch,setMemberSearch]=useState(''),[members,setMembers]=useState<any[]>([]),[memberId,setMemberId]=useState('');
  const [show, setShow] = useState(initialShow);
  const [seats, setSeats] = useState<string[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [guardian, setGuardian] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  useEffect(() => { api<Food[]>('/foods').then(setFoods).catch(e => setError(e.message)); }, []);
  async function refreshSeats() {
    const shows = await api<Showtime[]>('/movies/showtimes?movie=' + initialShow.movie._id);
    const current = shows.find(item => item._id === initialShow._id);
    if (!current) throw new Error('Suất chiếu không còn khả dụng. Vui lòng chọn lại.');
    if (current.cancelledAt || new Date(current.startTime).getTime() <= Date.now()) {
      setSeats([]);
      throw new Error('Suất chiếu đã bắt đầu hoặc đã hủy. Vui lòng chọn suất khác.');
    }
    setShow(current);
    setSeats(previous => previous.filter(number => current.seats.some(item => item.number === number && item.status === 'available' && (!item.condition || item.condition === 'Active'))));
  }
  useEffect(() => {
    const timer = setInterval(() => { if (!submitting.current) void refreshSeats().catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, []);
  async function create() {
    if (submitting.current || uncertain || !seats.length) return;
    const seatError = orphanSeatMessage(show.seats, seats);
    if (seatError) { setError(seatError); return; }
    if (show.cancelledAt || new Date(show.startTime).getTime() <= Date.now()) { setError('Suất chiếu đã bắt đầu hoặc đã hủy. Vui lòng chọn suất khác.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      if(counter&&customerType==='member'&&!memberId)throw new ApiError('Chọn thành viên trước khi tạo đơn.',400);
      const previous=counter?await readDraft('cinema.counter.'+user?._id):null;
      if(previous){const order=await api<Booking>('/payments/bookings/'+previous);if(order.status==='pending'){onCreated(order);return;}await writeDraft('cinema.counter.'+user?._id,null);}
      const result = await api<Booking>(counter?'/counter/bookings':'/bookings', 'POST', { showtimeId: show._id, seats, guardianConfirmed: guardian,
        ...(counter?{customerType,memberId:customerType==='member'?memberId:undefined}:{}),
        foodItems: foods.filter(food => quantities[food._id] > 0).map(food => ({ food: food._id, quantity: quantities[food._id] })) });
      if(counter)await writeDraft('cinema.counter.'+user?._id,result._id);
      onCreated(result);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) {
        setUncertain(true);
        setError('Chưa xác định được đơn đã tạo hay chưa. Mở Vé của tôi để kiểm tra trước khi đặt lại.');
      } else setError(e.message);
      await refreshSeats().catch(() => {});
    }
    finally { submitting.current = false; setBusy(false); }
  }
  const estimate = show.price * seats.length + foods.reduce((sum, food) => sum + food.price * (quantities[food._id] || 0), 0);
  return <View style={{flex:1}}><Page><View style={{gap:5}}><Eyebrow>ĐẶT VÉ · CHỌN GHẾ & BẮP NƯỚC</Eyebrow><Heading>Chọn chỗ của bạn</Heading></View><Card><Text style={s.title}>{show.movie.title}</Text><View style={s.row}><Icon name="calendar" size={15}/><Muted>{when(show.startTime)} · {show.room}</Muted></View><View style={s.row}><Icon name="pin" size={15}/><Muted>{show.cinema}</Muted></View></Card>
    {counter&&<Card><Heading>Khách tại quầy</Heading><View style={s.row}><Button secondary={customerType!=='guest'} title="Vãng lai" onPress={()=>setCustomerType('guest')}/><Button secondary={customerType!=='member'} title="Thành viên" onPress={()=>setCustomerType('member')}/></View>{customerType==='member'&&<><Field label="Tìm thành viên" value={memberSearch} onChangeText={setMemberSearch}/><Button secondary title="Tìm khách" onPress={()=>{void api<any[]>('/counter/members?search='+encodeURIComponent(memberSearch)).then(setMembers).catch(e=>setError(e.message));}}/>{members.map(member=><Button key={member._id} secondary={memberId!==member._id} title={`${member.fullName} · ${member.email}`} onPress={()=>setMemberId(member._id)}/>)}</>}</Card>}
    <SeatPlan seats={show.seats} selected={seats} disabled={busy} onToggle={seat=>{setError('');setSeats(current=>current.includes(seat.number)?current.filter(value=>value!==seat.number):[...current,seat.number]);}}/><Muted>Kéo ngang để xem hết hàng ghế. Không để trống một ghế lẻ giữa hàng.</Muted>
    <Section title="Thêm bắp & nước" detail="Không bắt buộc"/>{foods.map(food => <Card key={food._id}><View style={s.row}><View style={{ width: 64 }}><Artwork uri={food.image} square/></View><View style={{ flex: 1 }}><Text style={s.title}>{food.name}</Text><Text style={{color:colors.pink,fontWeight:'700',fontSize:14,marginVertical:4}}>{money(food.price)}</Text><Muted>{food.stock>0?`Còn ${food.stock} phần`:'Tạm hết hàng'}</Muted></View></View>
      <View style={s.row}><Button secondary title="−" disabled={busy || !quantities[food._id]} onPress={() => setQuantities(q => ({ ...q, [food._id]: (q[food._id] || 0) - 1 }))} /><Text style={s.title}>{quantities[food._id] || 0}</Text><Button title="+" disabled={busy || (quantities[food._id] || 0) >= Math.min(food.stock || 0, 100)} onPress={() => setQuantities(q => ({ ...q, [food._id]: (q[food._id] || 0) + 1 }))} /></View></Card>)}
    <Button secondary title={counter?(guardian?'✓ Đã kiểm tra tuổi / người giám hộ':'Xác nhận đã kiểm tra tuổi / người giám hộ'):(guardian ? '✓ Có người giám hộ đi cùng' : 'Xác nhận có người giám hộ (nếu cần)')} onPress={() => setGuardian(!guardian)} disabled={busy} />
    <Muted>Giá, tình trạng ghế và điều kiện độ tuổi được kiểm tra lại khi tạo đơn.</Muted>
  </Page><StickyBar>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<View style={s.between}><View style={{flex:1,gap:3}}><Text style={s.muted} numberOfLines={1}>{seats.length?`Ghế ${seats.join(', ')}`:'Chưa chọn ghế'}</Text><Text style={{color:'white',fontSize:21,fontWeight:'800'}}>{money(estimate)}</Text></View><Badge tone="red">{seats.length} ghế</Badge></View>{uncertain?<Button title="Kiểm tra Vé của tôi" onPress={onHistory}/>:<Button busy={busy} disabled={!seats.length} title="Giữ ghế & tiếp tục" icon="arrow" onPress={create}/>}</StickyBar></View>;
}

export function OrderDetail({ initial, onChanged, counter=false }: { initial: Booking; onChanged: () => void; counter?:boolean }) {
  const {user}=useSession();
  const [promotions,setPromotions]=useState<any[]>([]),[cash,setCash]=useState(''),[cashConfirmed,setCashConfirmed]=useState(false),[method,setMethod]=useState(counter?'cash':'vnpay');
  const [pointStep, setPointStep] = useState(1);
  const [booking, setBooking] = useState(initial);
  const [code, setCode] = useState(initial.promotion?.code || '');
  const [points, setPoints] = useState(String(initial.pointsUsed || 0));
  const [tickets, setTickets] = useState<TicketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const processing = useRef(false);
  const mounted = useRef(true);
  const path=(counter?'/counter/bookings/':'/bookings/')+initial._id;
  const canEdit=!counter||user?.role==='admin'||String(initial.counterEmployee)===user?._id;
  useEffect(()=>{
    api<any[]>('/promotions').then(setPromotions).catch(()=>{});
    api<{pointRedeemStep:number}>('/config').then(policy=>setPointStep(policy.pointRedeemStep || 1)).catch(e=>setError(e.message));
  },[]);
  async function refresh() {
    const current = await api<Booking>((counter?'/payments/bookings/':'/bookings/') + initial._id);
    if (!mounted.current) return;
    setBooking(current);
    if (current.status === 'paid'&&!counter) setTickets(await api<TicketResult>(`/bookings/${initial._id}/tickets`));
    if(current.status==='paid'&&counter)setTickets(await api<TicketResult>(`/payments/bookings/${initial._id}/tickets`));
    if(current.status!=='paid')setTickets(null);
  }
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(refresh).catch(e => setError(e.message));
    const timer = setInterval(() => { if (!processing.current) void refresh().catch(() => {}); }, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && !processing.current) void Promise.resolve().then(refresh).catch(e => setError(e.message)); });
    return () => { mounted.current = false; clearInterval(timer); clearInterval(clock); listener.remove(); };
  }, []);
  async function perform(action: () => Promise<void>) {
    if (processing.current) return;
    processing.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); onChanged(); }
    catch (e) { setError((e as Error).message); await refresh().catch(() => {}); }
    finally { processing.current = false; if (mounted.current) setBusy(false); }
  }
  const remaining = holdSeconds(booking, now);
  const editable = booking.status === 'pending' && remaining > 0 && !booking.activePayment;
  const dirty = code.trim().toUpperCase() !== (booking.promotion?.code || '') || !points.trim() || Number(points) !== (booking.pointsUsed || 0);
  const summary = bookingSummary(booking);
  const pointsAllowed = !booking.promotion || booking.promotion.stackable;
  const maxPoints = maxRedeemablePoints(booking.user?.memberPoints ?? user?.memberPoints ?? 0, booking.subtotal - (booking.promotionDiscount || 0), pointStep);
  const replacement = booking.pointsUsed > 0 && promotions.some(item=>item.code===code.trim().toUpperCase() && !item.stackable);
  async function pay() {
    const result = await api<any>(counter?`/payments/bookings/${booking._id}/pay`:path+'/pay', 'POST', { method: booking.total === 0 ? 'points' : method, confirmedTotal: booking.total,receivedAmount:counter&&method==='cash'?Number(cash):0,mobileReturnTo:appReturnUrl('/payment-return') });
    if (result.paymentUrl) {
      setGatewayUrl(result.paymentUrl);
      setNotice('Đã mở VNPay. Trang kết quả sẽ mở lại Expo Go; trạng thái được xác nhận từ máy chủ. Nếu trình duyệt chặn mở app, bấm Mở lại Expo Go hoặc quay lại thủ công.');
      await openExternal(result.paymentUrl);
    }
    await refresh();
  }
  return <View style={{flex:1}}><Page><Eyebrow>XÁC NHẬN & THANH TOÁN</Eyebrow><View style={[s.row,{alignItems:'flex-start'}]}><View style={{width:64}}><Artwork uri={booking.showtime?.movie?.poster}/></View><View style={{flex:1,gap:6}}><Text style={[s.title,{fontSize:20,lineHeight:27}]}>{summary.title}</Text><Muted>{summary.cinema} · {summary.room}</Muted><Text style={s.muted}>{summary.startTime?when(summary.startTime):''}</Text></View></View>
    <Card><View style={s.between}><Badge tone={booking.status==='paid'?'green':booking.status==='pending'?'gold':'neutral'}>{statusText(booking.status)}</Badge>{booking.status==='pending'&&<View style={[s.row,{gap:5}]}><Icon name="clock" size={14} color={remaining<120?colors.pink:colors.gold}/><Text style={{color:remaining<120?colors.pink:colors.gold,fontSize:13,fontWeight:'700'}}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</Text></View>}</View><Text selectable style={s.title}>Ghế {booking.seats.join(', ')}</Text><Text selectable style={[s.muted,{fontSize:10}]}>{booking._id}</Text><View style={{height:1,backgroundColor:colors.border}}/>{[['Tạm tính',money(booking.subtotal)],['Khuyến mãi','−'+money(booking.promotionDiscount)],['Điểm thành viên','−'+money(booking.discount)]].map(([label,value])=><View key={label} style={s.between}><Text style={s.muted}>{label}</Text><Text style={{color:'#d7dae5',fontSize:13,fontWeight:'600'}}>{value}</Text></View>)}<View style={[s.between,{borderTopWidth:1,borderTopColor:colors.border,paddingTop:12}]}><Text style={s.title}>Tổng thanh toán</Text><Text style={{color:colors.pink,fontSize:23,fontWeight:'800'}}>{money(booking.total)}</Text></View></Card>
    {!!booking.foodItems?.length&&<Card><Heading>Bắp & nước đã chọn</Heading>{booking.foodItems.map((item,index)=><View key={index} style={s.between}><Text style={[s.muted,{flex:1}]}>{item.name} × {item.quantity}</Text><Text style={s.muted}>{money(item.unitPrice*item.quantity)}</Text></View>)}</Card>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice && <Card><Muted>{notice}</Muted></Card>}
    {booking.status === 'pending' && booking.activePayment && <Card><Muted>Đang chờ kết quả thanh toán. Kiểm tra trạng thái trước khi thanh toán lại.</Muted>{remaining > 0 && <Button secondary title="Mở lại trang VNPay" disabled={busy} onPress={() => perform(async () => { if (gatewayUrl) { await openExternal(gatewayUrl); await refresh(); } else await pay(); })} />}</Card>}
    {booking.status === 'pending' && <><Card>
      <View style={s.row}><Icon name="ticket" color={colors.pink}/><Text style={s.title}>Ưu đãi cho đơn vé</Text></View>
      <Field label="Mã khuyến mãi" value={code} onChangeText={setCode} autoCapitalize="characters" editable={editable && canEdit && !busy} placeholder="Nhập mã, hoặc để trống để bỏ mã" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{promotions.map(item=><Chip key={item._id} selected={code===item.code} disabled={!editable||!canEdit||busy} title={`${item.code} · ${item.discountType==='percentage'?item.value+'%':money(item.value)}`} onPress={()=>setCode(item.code)}/>)}</ScrollView>
      <Button secondary disabled={!editable||!canEdit} busy={busy} title={replacement?'Bỏ điểm và áp dụng mã':'Áp dụng mã'} onPress={() => perform(async () => {
      const updated = await api<Booking>(path+'/promotion', 'PATCH', { code: code.trim(), replacePoints: replacement }); setBooking(updated); setCode(updated.promotion?.code || ''); setPoints(String(updated.pointsUsed || 0));
    })} />
      {replacement&&<Muted>Áp dụng mã này sẽ bỏ số điểm đang dùng vì mã không cho phép cộng dồn.</Muted>}
      {code.trim().toUpperCase() !== (booking.promotion?.code || '') && <Button secondary disabled={busy} title="Hủy thay đổi mã" onPress={()=>setCode(booking.promotion?.code || '')}/>}
      <Muted>Mỗi đơn một mã. Mã được kiểm tra lại khi thanh toán.</Muted></Card>
      {(!counter||booking.user)&&<Card><View style={s.between}><Text style={s.title}>Dùng điểm thành viên</Text><Icon name="wallet" color={colors.green}/></View>
        <Muted>Điểm hiện có: {booking.user?.memberPoints ?? user?.memberPoints ?? 0}. 1 điểm = 1.000đ.</Muted>
        <Muted>{pointsAllowed ? `Dùng theo bội số ${pointStep}, tối đa ${maxPoints} điểm. Chỉ trừ khi thanh toán thành công.` : 'Mã này không dùng cùng điểm. Bỏ mã nếu muốn sử dụng điểm.'}</Muted>
        <View style={s.wrap}>{[...new Set([0,pointStep,pointStep*2,maxPoints])].filter(value=>value<=maxPoints).map(value=><Chip key={value} selected={Number(points)===value} disabled={!editable||!canEdit||busy||!pointsAllowed} title={value?`${value} điểm`:'Không dùng'} onPress={()=>setPoints(String(value))}/>)}</View>
        <Field label="Số điểm muốn sử dụng" value={points} onChangeText={setPoints} keyboardType="number-pad" editable={editable && canEdit && !busy && pointsAllowed} />
        <Button secondary disabled={!editable||!canEdit||!pointsAllowed||!validRedemption(points,maxPoints,pointStep)} busy={busy} title="Cập nhật điểm" onPress={() => perform(async () => {
        if (!validRedemption(points, maxPoints, pointStep)) throw new Error(`Điểm phải là số nguyên không âm, theo bội số ${pointStep} và không vượt quá ${maxPoints}.`);
        const updated = await api<Booking>(path+'/points', 'PATCH', { points: Number(points) }); setBooking(updated); setPoints(String(updated.pointsUsed || 0));
      })} />{points !== String(booking.pointsUsed || 0) && <Button secondary disabled={busy} title="Hủy thay đổi điểm" onPress={()=>setPoints(String(booking.pointsUsed || 0))}/>}</Card>}{dirty && <Muted>Bấm áp dụng mã và cập nhật điểm trước khi thanh toán.</Muted>}
      {counter&&booking.total>0&&<Card><View style={s.row}><Button secondary={method!=='cash'} title="Tiền mặt" onPress={()=>setMethod('cash')}/><Button secondary={method!=='vnpay'} title="VNPay" onPress={()=>setMethod('vnpay')}/></View>{method==='cash'&&<><Field label="Tiền khách đưa (VND)" keyboardType="number-pad" value={cash} onChangeText={v=>{setCash(v);setCashConfirmed(false);}}/><Muted>Tiền thừa: {money(Math.max(0,Number(cash)-booking.total))}</Muted><Button secondary={!cashConfirmed} title={cashConfirmed?'✓ Đã nhận đủ tiền mặt':'Tôi đã nhận đủ tiền mặt'} onPress={()=>setCashConfirmed(!cashConfirmed)}/></>}</Card>}
      <ConfirmButton disabled={!editable||!canEdit||busy} title="Hủy đơn và trả ghế" message="Hủy đơn chưa thanh toán và giải phóng các ghế đang giữ?" onConfirm={() => perform(async () => { setBooking(await api(path+'/cancel', 'POST', {})); })} /></>}
    {booking.status==='pending'&&remaining===0&&<Text accessibilityRole="alert" style={s.error}>Giữ ghế đã hết hạn hoặc suất chiếu đã bắt đầu. {booking.activePayment?'Kiểm tra kết quả thanh toán; liên hệ nhân viên nếu đã bị trừ tiền.':'Vui lòng chọn suất chiếu và đặt lại.'}</Text>}
    <Button secondary busy={busy} title="Kiểm tra trạng thái" onPress={() => perform(refresh)} />
    {!counter&&booking.status==='paid'&&<RefundPanel id={booking._id} onChanged={refresh}/>}
    {tickets && <><Heading>Vé của bạn</Heading>{tickets.mode === 'demo' && <Muted>Vé dữ liệu demo, không dùng để vào rạp thực tế.</Muted>}{tickets.message && <Muted>{tickets.message}</Muted>}{tickets.tickets.map(ticket => <Card key={ticket.reference}><View style={s.between}><Heading>Ghế {ticket.seat}</Heading><Icon name="qr" color={colors.pink}/></View><Muted>{ticket.status}</Muted>{ticket.qrDataUrl&&<View style={{alignSelf:'center',padding:10,backgroundColor:'white',borderRadius:18}}><Image accessibilityLabel={`Mã QR ghế ${ticket.seat}`} source={{uri:ticket.qrDataUrl}} style={{width:216,height:216}}/></View>}<Text selectable style={[s.muted,{fontSize:10,textAlign:'center'}]}>{ticket.reference}</Text></Card>)}</>}
  </Page>{booking.status==='pending'&&<StickyBar><View style={s.between}><Muted>Cần thanh toán</Muted><Text style={{color:'white',fontSize:22,fontWeight:'800'}}>{money(booking.total)}</Text></View><Button icon="shield" disabled={!editable||dirty||(counter&&booking.total>0&&method==='cash'&&(!cashConfirmed||!/^\d+$/.test(cash)||!Number.isSafeInteger(Number(cash))||Number(cash)<booking.total))} busy={busy} title={booking.total===0?'Thanh toán bằng điểm':counter&&method==='cash'?'Xác nhận thu tiền mặt':'Thanh toán VNPay'} onPress={()=>perform(pay)}/></StickyBar>}</View>;
}
