import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { appReturnUrl } from '../../services/appReturnUrl';
import { api, ApiError, writeDraft } from '../../services/api';
import { money, statusText, when } from '../../utils/format';
import { Booking, Food, TicketResult } from '../../utils/types';
import { useSession } from '../../context/SessionContext';
import { openExternal } from '../../services/browser';
import FoodPicker from '../../components/FoodPicker';
import { BackButton, Button, Card, Chip, ConfirmButton, Field, Heading, Muted, Page, StickyBar } from '../../components/ui';
import { s } from '../../theme/index';

type Promotion = { _id: string; code: string; name: string; discountType: string; value: number; stackable: boolean; scope: string; minOrder: number };
export default function CounterPayment({ initial, collectionOnly = false }: { initial: Booking; collectionOnly?: boolean }) {
  const { user } = useSession();
  const [booking, setBooking] = useState(initial), [foods, setFoods] = useState<Food[]>([]), [promotions, setPromotions] = useState<Promotion[]>([]), [pointStep, setPointStep] = useState(1);
  const [code, setCode] = useState(initial.promotion?.code || ''), [points, setPoints] = useState(String(initial.pointsUsed || 0));
  const [cash, setCash] = useState(''), [cashConfirmed, setCashConfirmed] = useState(false), [method, setMethod] = useState('cash');
  const [editingFood, setEditingFood] = useState(false), [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [gatewayUrl, setGatewayUrl] = useState('');
  const [tickets, setTickets] = useState<TicketResult | null>(null), [now, setNow] = useState(() => Date.now());
  const processing = useRef(false), mounted = useRef(true), current = useRef(initial), codeDraft = useRef(code), pointsDraft = useRef(points);
  const path = '/counter/bookings/' + booking._id;
  const remaining = Math.max(0, Math.ceil((Math.min(new Date(booking.expiresAt).getTime(), new Date(booking.showtime?.startTime || booking.expiresAt).getTime()) - now) / 1000));
  const editable = booking.status === 'pending' && remaining > 0 && !booking.activePayment && !uncertain;
  const canEdit = editable && !collectionOnly && !!booking.counterEmployee && (user?.role === 'admin' || booking.counterEmployee === user?._id);
  const pointsAllowed = !booking.promotion || booking.promotion.stackable;
  const maxPoints = Math.floor(Math.min(booking.user?.memberPoints || 0, (booking.subtotal - (booking.promotionDiscount || 0)) / 1000) / pointStep) * pointStep;
  const validPoints = /^\d+$/.test(points) && Number.isSafeInteger(Number(points)) && Number(points) % pointStep === 0 && Number(points) <= maxPoints;
  const codeDirty = code.trim().toUpperCase() !== (booking.promotion?.code || ''), pointsDirty = !points.trim() || Number(points) !== booking.pointsUsed;
  const validCash = /^\d+$/.test(cash) && Number.isSafeInteger(Number(cash)) && Number(cash) >= booking.total;
  const replacement = booking.pointsUsed > 0 && promotions.some(item => item.code === code.trim().toUpperCase() && !item.stackable);
  function changeCode(value: string) { codeDraft.current = value; setCode(value); }
  function changePoints(value: string) { pointsDraft.current = value; setPoints(value); }
  function sync(order: Booking, resetDraft = false) {
    if (!mounted.current) return;
    const previous = current.current;
    if (order.total !== previous.total) { setCash(''); setCashConfirmed(false); }
    if (resetDraft || codeDraft.current.trim().toUpperCase() === (previous.promotion?.code || '')) changeCode(order.promotion?.code || '');
    if (resetDraft || pointsDraft.current === String(previous.pointsUsed || 0)) changePoints(String(order.pointsUsed || 0));
    current.current = order; setBooking(order); setUncertain(false);
    if (!order.activePayment || order.cashReceived) setGatewayUrl('');
    void writeDraft('cinema.counter.' + user?._id, order.status === 'pending' || order.activePayment ? order._id : null).catch(() => {});
  }
  async function refresh() {
    const order = await api<Booking>('/payments/bookings/' + initial._id); sync(order);
    if (order.status === 'paid') { const issued = await api<TicketResult>('/payments/bookings/' + initial._id + '/tickets'); if (mounted.current) setTickets(issued); }
    else if (mounted.current) setTickets(null);
  }
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(refresh).catch(e => setError(e.message));
    void Promise.all([api<Food[]>('/foods'), api<Promotion[]>('/promotions'), api<{ pointRedeemStep: number }>('/config')]).then(([f, p, policy]) => { if (mounted.current) { setFoods(f); setPromotions(p); setPointStep(policy.pointRedeemStep || 1); } }).catch(e => setError(e.message));
    const timer = setInterval(() => { if (!processing.current) void refresh().catch(() => {}); }, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && !processing.current) void refresh().catch(e => setError(e.message)); });
    return () => { mounted.current = false; clearInterval(timer); clearInterval(clock); listener.remove(); };
  }, [initial._id]);
  async function run(action: () => Promise<void>) {
    if (processing.current) return;
    processing.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { processing.current = false; if (mounted.current) setBusy(false); }
  }
  async function update(suffix: string, data: unknown) { sync(await api<Booking>(path + suffix, 'PATCH', data), true); }
  async function pay(chosen = booking.total === 0 ? 'points' : method) {
    let result: Booking & { paymentUrl?: string; booking?: Booking };
    try {
      result = await api('/payments/bookings/' + booking._id + '/pay', 'POST', { method: chosen, receivedAmount: chosen === 'cash' ? Number(cash) : 0, confirmedTotal: booking.total, mobileReturnTo: appReturnUrl('/payment-return') });
    } catch (e) { if (!(e instanceof ApiError) || e.status >= 500) setUncertain(true); throw e; }
    if (result.paymentUrl) {
      if (result.booking) sync(result.booking);
      setGatewayUrl(result.paymentUrl); setNotice('Mở VNPay để khách thanh toán. Chờ máy chủ xác nhận; không thu tiền lần nữa.');
      await openExternal(result.paymentUrl); await refresh(); return;
    }
    sync(result, true);
    setNotice(result.status === 'paid' ? 'Thanh toán thành công.' : result.refund?.status === 'completed' ? 'Khoản thu đã hoàn về điểm thành viên.' : 'Khoản thu đang cần kiểm tra/đối soát. Không thu tiền lần nữa.');
    await refresh();
  }
  const blocked = !editable || busy || editingFood || codeDirty || pointsDirty || (booking.total > 0 && method === 'cash' && (!validCash || !cashConfirmed));
  return <View style={{ flex: 1 }}><Page>
    <BackButton disabled={busy} onPress={() => router.navigate('/workspace')} />
    <Heading>{booking.status === 'paid' ? 'Đã hoàn tất đơn' : 'Xác nhận đơn vé'}</Heading>
    <Card><Text style={s.title}>{booking.showtime?.movie?.title}</Text><Muted>{booking.showtime?.cinema} · {booking.showtime?.room}</Muted><Muted>{booking.showtime?.startTime && when(booking.showtime.startTime)}</Muted><Muted>Ghế: {booking.seats.join(', ')}</Muted><Text selectable style={s.muted}>Mã đơn: {booking._id}</Text><Heading>{statusText(booking.status)}</Heading></Card>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice && <Muted>{notice}</Muted>}
    {!!booking.paymentIssue && <Text style={s.error}>{booking.paymentIssue}</Text>}
    {booking.refund && <Card><Heading>{booking.refund.status === 'completed' ? 'Đã hoàn về điểm' : 'Đang xử lý hoàn điểm'}</Heading><Muted>{booking.refund.points} điểm thành viên.</Muted></Card>}
    {(booking.activePayment || uncertain) && <Card><Heading>Giao dịch đang xử lý</Heading><Muted>{uncertain ? 'Chưa xác nhận lưu khoản thu. Kiểm tra kết quả trước khi xử lý tiếp.' : booking.cashReceived ? 'Đã ghi nhận tiền mặt. Không thu lại tiền.' : 'Đang chờ kết quả VNPay. Chưa thể thu thêm tiền hoặc đổi phương thức.'}</Muted>
      {booking.activePayment && !booking.cashReceived && <Button secondary disabled={busy} title="Mở lại VNPay" onPress={() => void run(async () => { if (gatewayUrl) await openExternal(gatewayUrl); else await pay('vnpay'); })} />}
      <Button secondary busy={busy} title="Kiểm tra kết quả" onPress={() => void run(refresh)} /><Button secondary disabled={busy} title="Đối soát thanh toán" onPress={() => router.push({ pathname: '/staff/reconciliation', params: { order: booking._id, section: 'reconciliation' } })} />
    </Card>}
    <Card><View style={s.between}><Heading>Bắp & nước</Heading>{canEdit && <Button secondary disabled={busy} title={editingFood ? 'Hủy chỉnh sửa' : 'Đổi bắp nước'} onPress={() => { setQuantities(Object.fromEntries((booking.foodItems || []).map(item => [typeof item.food === 'object' ? item.food._id : item.food || '', item.quantity]))); setEditingFood(!editingFood); }} />}</View>
      {editingFood ? <><FoodPicker foods={foods} quantities={quantities} onChange={setQuantities} disabled={busy} /><Button busy={busy} title="Lưu bắp nước" onPress={() => void run(async () => { await update('/food', { foodItems: foods.filter(item => quantities[item._id] > 0).map(item => ({ food: item._id, quantity: quantities[item._id] })) }); setEditingFood(false); })} /></> : (booking.foodItems?.length ? booking.foodItems.map((item, index) => <Muted key={index}>{item.name} × {item.quantity} · {money(item.unitPrice * item.quantity)}</Muted>) : <Muted>Không gọi thêm.</Muted>)}
    </Card>
    {canEdit && <Card><Heading>Khuyến mãi tại quầy</Heading><Field label="Mã khuyến mãi" value={code} onChangeText={changeCode} editable={!busy} autoCapitalize="characters" /><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{promotions.map(item => <Chip key={item._id} title={`${item.code} · ${item.discountType === 'percentage' ? item.value + '%' : money(item.value)}`} selected={code === item.code} disabled={busy} onPress={() => changeCode(item.code)} />)}</ScrollView>
      <Button secondary busy={busy} title={replacement ? 'Bỏ điểm và áp dụng mã' : 'Áp dụng mã'} onPress={() => void run(() => update('/promotion', { code: code.trim(), replacePoints: replacement }))} />
      {booking.promotion && <Button secondary disabled={busy} title="Bỏ mã khuyến mãi" onPress={() => void run(() => update('/promotion', { code: '' }))} />}
      {codeDirty && <Button secondary title="Hủy thay đổi mã" onPress={() => changeCode(booking.promotion?.code || '')} />}
      <Muted>1 mã/đơn. Giảm khuyến mãi trước, giảm điểm sau. Chỉ mã cho phép cộng dồn mới dùng cùng điểm.</Muted>
    </Card>}
    {canEdit && booking.user && <Card><Heading>Dùng điểm thành viên</Heading><Muted>{booking.user.fullName} · Điểm hiện có: {booking.user.memberPoints || 0}</Muted><Field label="Số điểm muốn sử dụng" value={points} onChangeText={changePoints} keyboardType="number-pad" editable={!busy && pointsAllowed} /><Button secondary disabled={busy || !pointsAllowed} title={`Dùng tối đa (${maxPoints})`} onPress={() => changePoints(String(maxPoints))} /><Button secondary busy={busy} disabled={!pointsAllowed || !validPoints || !pointsDirty} title="Áp dụng điểm" onPress={() => void run(() => update('/points', { points: Number(points) }))} />
      {pointsDirty && <Button secondary title="Hủy thay đổi điểm" onPress={() => changePoints(String(booking.pointsUsed || 0))} />}
      {booking.pointsUsed > 0 && <Button secondary disabled={busy} title="Bỏ dùng điểm" onPress={() => void run(() => update('/points', { points: 0 }))} />}
      <Muted>{pointsAllowed ? `1 điểm = 1.000đ. ${pointStep === 1 ? 'Nhập số điểm nguyên' : `Dùng theo bội số ${pointStep}`}, tối đa ${maxPoints} điểm. Chỉ trừ khi thanh toán thành công.` : 'Mã này không dùng cùng điểm. Bỏ mã nếu muốn sử dụng điểm.'}</Muted>
    </Card>}
    <Card><Heading>Chi tiết thanh toán</Heading><Muted>Vé: {money((booking.ticketPrice || 0) * booking.seats.length)}</Muted><Muted>Bắp nước: {money(booking.subtotal - (booking.ticketPrice || 0) * booking.seats.length)}</Muted><Muted>Tạm tính: {money(booking.subtotal)}</Muted><Muted>Khuyến mãi{booking.promotion ? ` (${booking.promotion.code})` : ''}: −{money(booking.promotionDiscount || 0)}</Muted><Muted>Giảm từ {booking.pointsUsed} điểm: −{money(booking.discount)}</Muted><Heading>Tổng thanh toán: {money(booking.total)}</Heading>
      {booking.cashReceived != null && <><Muted>Tiền khách đưa: {money(booking.cashReceived)}</Muted><Muted>Tiền thừa đã trả: {money(booking.change || 0)}</Muted></>}
    </Card>
    {editable && <Card>{booking.total > 0 ? <><View style={s.row}><Button secondary={method !== 'cash'} disabled={busy} title="Tiền mặt tại quầy" onPress={() => setMethod('cash')} /><Button secondary={method !== 'vnpay'} disabled={busy} title="VNPay Sandbox" onPress={() => setMethod('vnpay')} /></View>{method === 'cash' && <><Field label="Số tiền khách đưa" value={cash} onChangeText={value => { setCash(value); setCashConfirmed(false); }} keyboardType="number-pad" editable={!busy} /><Muted>{validCash ? `Tiền trả khách: ${money(Number(cash) - booking.total)}` : `Cần nhận tối thiểu ${money(booking.total)}.`}</Muted><Button secondary={!cashConfirmed} disabled={busy || !validCash} title={cashConfirmed ? '✓ Đã nhận đủ tiền mặt' : 'Tôi đã nhận đủ tiền mặt'} onPress={() => setCashConfirmed(!cashConfirmed)} /></>}</> : <Muted>Đơn 0đ không thu thêm tiền. Xác nhận để nhận vé QR.</Muted>}</Card>}
    {editable && canEdit && <ConfirmButton disabled={busy} title="Hủy đơn và giải phóng ghế" message="Hủy đơn chưa thanh toán và giải phóng ghế đang giữ?" onConfirm={() => void run(async () => { sync(await api<Booking>(path + '/cancel', 'POST', {}), true); })} />}
    {booking.status === 'pending' && remaining === 0 && <Text style={s.error}>{booking.activePayment ? 'Giữ ghế đã hết hạn. Kiểm tra và đối soát khoản thu; không thu thêm tiền.' : 'Giữ ghế đã hết hạn. Vui lòng tạo đơn mới.'}</Text>}
    <Button secondary busy={busy} title="Kiểm tra trạng thái" onPress={() => void run(refresh)} />
    {tickets && <><Heading>Vé QR theo từng ghế</Heading>{!!tickets.message && <Muted>{tickets.message}</Muted>}{tickets.mode === 'demo' && <Muted>Vé mô phỏng — không xác nhận vào rạp thật.</Muted>}{tickets.tickets.map(ticket => <Card key={ticket.reference}><Heading>Ghế {ticket.seat}</Heading><Muted>{ticket.status}</Muted>{ticket.qrDataUrl && <View style={{ backgroundColor: 'white', padding: 12, alignSelf: 'center' }}><Image accessibilityLabel={`QR vé ghế ${ticket.seat}`} source={{ uri: ticket.qrDataUrl }} style={{ width: 216, height: 216 }} /></View>}<Text selectable style={s.muted}>{ticket.reference}</Text></Card>)}</>}
    <Button secondary disabled={busy} title="Về quầy vé" onPress={() => router.navigate('/staff/booking')} />
  </Page>{booking.status === 'pending' && <StickyBar><Muted>Giữ ghế còn {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Muted>{(codeDirty || pointsDirty || editingFood) && <Muted>Lưu hoặc hủy thay đổi mã, điểm và bắp nước trước khi thanh toán.</Muted>}<Heading>{money(booking.total)}</Heading><Button busy={busy} disabled={blocked} title={booking.total === 0 ? 'Xác nhận đơn 0đ' : method === 'vnpay' ? 'Tạo thanh toán VNPay' : validCash && Number(cash) > booking.total ? 'Xác nhận thu tiền và trả tiền thừa' : 'Xác nhận thu tiền tại quầy'} onPress={() => void run(() => pay())} /></StickyBar>}</View>;
}
