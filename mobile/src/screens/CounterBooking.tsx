import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { api, ApiError, money, readDraft, when, writeDraft } from '../api';
import { Booking, Food, Movie, Showtime, User } from '../types';
import { useSession } from '../session';
import { Artwork, BackButton, Button, Card, Chip, Field, Heading, Muted, Page, s, StickyBar } from '../ui';
import SeatPlan from '../SeatPlan';
import FoodPicker from '../FoodPicker';
import { isAvailableSeat, orphanSeatMessage } from '../../../shared/seatSelection.mjs';

const steps = ['Chọn rạp', 'Chọn suất chiếu', 'Chọn ghế', 'Thông tin', 'Xác nhận đơn'];
type CreateRequest = { requestId: string; data: Record<string, unknown> };
const active = (member: User) => ['Active', 'active'].includes(member.status || '');
const live = (show: Showtime) => !!show.movie && !show.cancelledAt && !show.movie.deletedAt && show.movie.classification !== 'C' && new Date(show.startTime).getTime() > Date.now() && Number.isSafeInteger(show.price) && show.price > 0;

export default function CounterBooking() {
  const { user } = useSession();
  const [step, setStep] = useState(0), [shows, setShows] = useState<Showtime[]>([]), [movies, setMovies] = useState<Movie[]>([]), [foods, setFoods] = useState<Food[]>([]);
  const [cinema, setCinema] = useState(''), [movieId, setMovieId] = useState(''), [showId, setShowId] = useState(''), [seats, setSeats] = useState<string[]>([]);
  const [customerType, setCustomerType] = useState('guest'), [query, setQuery] = useState(''), [members, setMembers] = useState<User[]>([]), [member, setMember] = useState<User | null>(null);
  const [points, setPoints] = useState('0'), [pointStep, setPointStep] = useState(1), [quantities, setQuantities] = useState<Record<string, number>>({}), [ageAck, setAgeAck] = useState('');
  const [busy, setBusy] = useState(false), [searching, setSearching] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState(''), [availabilityError, setAvailabilityError] = useState('');
  const [resume, setResume] = useState<Booking | null>(null), [pendingRequest, setPendingRequest] = useState<CreateRequest | null>(null), [recoveryError, setRecoveryError] = useState('');
  const processing = useRef(false), searchVersion = useRef(0), mounted = useRef(true);
  const draftKey = 'cinema.counter.' + user?._id, requestKey = draftKey + '.request';
  const show = shows.find(item => item._id === showId), movie = show?.movie || movies.find(item => item._id === movieId);
  const availableShows = shows.filter(live), cinemas = [...new Set(availableShows.map(item => item.cinema))];
  const movieIds = new Set(availableShows.filter(item => item.cinema === cinema).map(item => item.movie._id));
  const selectedFoods = foods.filter(item => quantities[item._id] > 0);
  const subtotal = (show?.price || 0) * seats.length + selectedFoods.reduce((sum, item) => sum + item.price * quantities[item._id], 0);
  const maxPoints = Math.floor(Math.min(member?.memberPoints || 0, subtotal / 1000) / pointStep) * pointStep;
  const pointsValid = /^\d+$/.test(points) && Number.isSafeInteger(Number(points)) && Number(points) % pointStep === 0 && Number(points) <= maxPoints;
  const requiredAge = ({ T13: 13, T16: 16, T18: 18 }[movie?.classification || ''] || movie?.ageLimit || 0);
  const needsAge = requiredAge > 0 || movie?.classification === 'K';
  const ageKey = JSON.stringify([showId, movie?.classification, requiredAge, customerType, member?._id, [...seats].sort()]);

  async function load() {
    const [movieData, showData, foodData, policy] = await Promise.all([api<Movie[]>('/movies'), api<Showtime[]>('/movies/showtimes'), api<Food[]>('/foods'), api<{ pointRedeemStep: number }>('/config')]);
    if (!mounted.current) return;
    setMovies(movieData); setShows(showData); setFoods(foodData); setPointStep(policy.pointRedeemStep || 1); setAvailabilityError(''); setReady(true);
    setSeats(current => current.filter(number => showData.find(item => item._id === showId)?.seats.some(item => item.number === number && isAvailableSeat(item))));
  }
  async function recover() {
    setRecoveryError('');
    try {
      const saved = await readDraft(requestKey);
      if (saved) {
        const request: CreateRequest = JSON.parse(saved); setPendingRequest(request);
        try { await openCreated(await api<Booking>('/counter/requests/' + request.requestId)); }
        catch (e) { setRecoveryError((e as Error).message); }
        return;
      }
      const id = await readDraft(draftKey);
      if (!id) { setResume(null); return; }
      try {
        const order = await api<Booking>('/payments/bookings/' + id);
        if ((order.status === 'pending' && new Date(order.expiresAt).getTime() > Date.now()) || order.activePayment) setResume(order);
        else { await writeDraft(draftKey, null); setResume(null); }
      } catch (e) {
        if (e instanceof ApiError && [400, 404].includes(e.status)) { await writeDraft(draftKey, null); setResume(null); }
        else throw e;
      }
    } catch (e) { setRecoveryError((e as Error).message); }
  }
  useEffect(() => {
    mounted.current = true;
    void load().catch(e => setAvailabilityError(e.message)); void Promise.resolve().then(recover);
    return () => { mounted.current = false; searchVersion.current++; };
  }, [user?._id]);
  useEffect(() => {
    const timer = setInterval(() => { if (!processing.current) void load().catch(() => setAvailabilityError('Chưa tải lại được ghế và giá. Kiểm tra lại trước khi tiếp tục.')); }, 15000);
    return () => clearInterval(timer);
  }, [showId]);

  function clearMember(value = '') { searchVersion.current++; setQuery(value); setMembers([]); setMember(null); setSearching(false); setPoints('0'); setAgeAck(''); }
  async function findMember() {
    const version = ++searchVersion.current; setSearching(true); setError(''); setMembers([]); setMember(null); setPoints('0'); setAgeAck('');
    try { const result = await api<User[]>('/counter/members?search=' + encodeURIComponent(query.trim())); if (version === searchVersion.current) setMembers(result); }
    catch (e) { if (version === searchVersion.current) setError((e as Error).message); }
    finally { if (version === searchVersion.current) setSearching(false); }
  }
  function validate(target: number) {
    if (target > 0 && !cinema) { setError('Vui lòng chọn rạp chiếu.'); setStep(0); return false; }
    if (target > 1 && (!show || !live(show) || show.cinema !== cinema)) { setError('Chọn phim và suất chiếu còn mở bán.'); setStep(1); return false; }
    if (target > 2) {
      const seatError = !seats.length || seats.some(number => !show?.seats.some(item => item.number === number && isAvailableSeat(item))) ? 'Chọn ít nhất một ghế còn khả dụng.' : orphanSeatMessage(show!.seats, seats);
      if (availabilityError || seatError) { setError(availabilityError || seatError); setStep(2); return false; }
    }
    if (target > 3 && ((customerType === 'member' && (!member || !active(member))) || !pointsValid)) { setError('Chọn Member đang hoạt động và số điểm hợp lệ.'); setStep(3); return false; }
    return true;
  }
  function go(target: number) { if (busy || pendingRequest) return; setError(''); if (target <= step || validate(target)) setStep(target); }
  async function openCreated(order: Booking) {
    if (!mounted.current) return;
    await writeDraft(draftKey, order._id); await writeDraft(requestKey, null); setPendingRequest(null);
    if (mounted.current) router.replace({ pathname: '/order/[id]', params: { id: order._id } });
  }
  async function submit(request: CreateRequest, retry = false) {
    if (processing.current) return;
    processing.current = true; setBusy(true); setError('');
    try {
      await writeDraft(requestKey, JSON.stringify(request)); setPendingRequest(request);
      await openCreated(await api<Booking>('/counter/bookings', 'POST', { ...request.data, requestId: request.requestId }));
    } catch (e) {
      const uncertain = !(e instanceof ApiError) || e.status >= 500 || (retry && e.status === 409);
      if (uncertain) setError('Chưa xác nhận tạo đơn. Kiểm tra hoặc thử lại cùng yêu cầu bên dưới; không tạo đơn khác.');
      else { await writeDraft(requestKey, null); setPendingRequest(null); setError((e as Error).message); await load().catch(() => setAvailabilityError('Chưa tải lại được sơ đồ ghế.')); }
    } finally { processing.current = false; if (mounted.current) setBusy(false); }
  }
  async function create() {
    if (pendingRequest || resume || recoveryError || !validate(4) || !show) return;
    if (needsAge && ageAck !== ageKey) { setError('Cần kiểm tra tuổi/điều kiện người giám hộ của tất cả khách trước khi giữ ghế.'); return; }
    await submit({ requestId: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`, data: {
      showtimeId: show._id, seats, customerType, memberId: customerType === 'member' ? member?._id : null,
      points: Number(points), guardianConfirmed: needsAge && ageAck === ageKey,
      foodItems: selectedFoods.map(item => ({ food: item._id, quantity: quantities[item._id] }))
    } });
  }
  if (!user || !['employee', 'admin'].includes(user.role)) return <Redirect href="/" />;
  return <View style={{ flex: 1 }}><Page>
    <BackButton disabled={busy} onPress={() => router.navigate('/workspace')} />
    <Heading>Đặt vé tại quầy</Heading><Muted>Chọn rạp, suất chiếu, ghế và thông tin khách. Mã khuyến mãi áp dụng ở bước thanh toán.</Muted>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!!recoveryError && <Text style={s.error}>{recoveryError}</Text>}
    {resume && <Card><Heading>Đơn đang xử lý</Heading><Text selectable style={s.muted}>{resume._id}</Text><Muted>Tiếp tục hoặc hủy đơn cũ trước khi tạo đơn khác. Thời hạn giữ ghế không được kéo dài.</Muted><Button title="Tiếp tục đơn đang xử lý" onPress={() => router.push({ pathname: '/order/[id]', params: { id: resume._id } })} /></Card>}
    {pendingRequest && <Card><Heading>Kiểm tra yêu cầu tạo đơn</Heading><Muted>Mã yêu cầu: {pendingRequest.requestId}</Muted><Button secondary disabled={busy} title="Kiểm tra kết quả tạo đơn" onPress={() => void recover()} /><Button busy={busy} title="Thử lại cùng yêu cầu" onPress={() => void submit(pendingRequest, true)} /></Card>}
    {!!recoveryError && !pendingRequest && <Button secondary title="Kiểm tra lại đơn đang xử lý" onPress={() => void recover()} />}
    {!!availabilityError && <><Text style={s.error}>{availabilityError}</Text><Button secondary disabled={busy} title="Tải lại sơ đồ ghế" onPress={() => void load().catch(e => setAvailabilityError(e.message))} /></>}
    {!ready && <Muted>Đang tải quầy vé…</Muted>}
    {ready && !pendingRequest && <>
      <View style={s.wrap}>{steps.map((name, index) => <Chip key={name} selected={step === index} disabled={busy} title={`${index + 1}. ${name}`} onPress={() => go(index)} />)}</View>
      {step === 0 && <><Heading>1. Chọn rạp chiếu</Heading>{!cinemas.length && <Muted>Chưa có suất chiếu còn mở bán.</Muted>}{cinemas.map(value => <Button key={value} secondary={cinema !== value} title={value} onPress={() => { setCinema(value); setMovieId(''); setShowId(''); setSeats([]); setAgeAck(''); }} />)}</>}
      {step === 1 && <><Heading>2. Chọn phim & suất chiếu</Heading>{movies.filter(item => movieIds.has(item._id)).map(item => <Card key={item._id}>
        <View style={s.row}><View style={{ width: 64 }}><Artwork uri={item.poster} /></View><View style={{ flex: 1 }}><Text style={s.title}>{item.title}</Text><Muted>{item.classification || 'P'} · {item.duration} phút</Muted></View></View>
        {availableShows.filter(value => value.cinema === cinema && value.movie._id === item._id).map(value => <Button key={value._id} secondary={showId !== value._id} title={`${when(value.startTime)} · ${value.room} · ${money(value.price)}`} onPress={() => { setMovieId(item._id); setShowId(value._id); setSeats([]); setAgeAck(''); }} />)}
      </Card>)}</>}
      {step === 2 && show && <><Heading>3. Chọn ghế</Heading><Muted>{movie?.title} · {cinema} · {show.room} · {when(show.startTime)}</Muted><SeatPlan seats={show.seats} selected={seats} disabled={busy || !!availabilityError || !live(show)} onToggle={seat => { setSeats(current => current.includes(seat.number) ? current.filter(item => item !== seat.number) : [...current, seat.number]); setAgeAck(''); }} /><Muted>Được phép chừa ghế lẻ ở đầu/cuối hàng; không tạo ghế trống lẻ mới giữa hàng.</Muted></>}
      {step === 3 && <><Heading>4. Chọn loại khách hàng</Heading><View style={s.row}>{[['guest', 'Khách vãng lai'], ['member', 'Member']].map(([value, title]) => <Button key={value} secondary={customerType !== value} title={title} onPress={() => { setCustomerType(value); clearMember(); }} />)}</View>
        {customerType === 'guest' ? <Muted>Không cần cung cấp thông tin cá nhân. Khách vãng lai không sử dụng điểm Member.</Muted> : <>
          <Field label="Email hoặc số điện thoại thành viên" value={query} onChangeText={clearMember} autoCapitalize="none" />
          <Button busy={searching} disabled={!query.trim()} title="Tìm thành viên" onPress={() => void findMember()} />
          {members.map(item => <Button key={item._id} secondary={member?._id !== item._id} disabled={searching || !active(item)} title={`${item.fullName} · ${item.email}${active(item) ? '' : ' · Không hoạt động'}`} onPress={() => { setMember(item); setPoints('0'); setAgeAck(''); }} />)}
          {member && <Card><Text style={s.title}>{member.fullName}</Text><Muted>{member.email} · {member.phone || 'Chưa có số điện thoại'}</Muted><Muted>Điểm hiện có: {member.memberPoints || 0} · 1 điểm = 1.000đ</Muted><Field label="Điểm thưởng" value={points} onChangeText={setPoints} keyboardType="number-pad" /><Button secondary title={`Dùng tối đa (${maxPoints})`} onPress={() => setPoints(String(maxPoints))} /><Muted>{pointStep === 1 ? 'Nhập số điểm nguyên.' : `Dùng theo bội số ${pointStep}.`} Chỉ trừ điểm khi thanh toán thành công.</Muted></Card>}
        </>}
      </>}
      {step === 4 && show && <><Heading>5. Xác nhận đơn trước khi giữ ghế</Heading><Card>
        <Text style={s.title}>Khách hàng: {customerType === 'guest' ? 'Khách vãng lai' : member?.fullName}</Text><Muted>{movie?.title} · {cinema} · {show.room}</Muted><Muted>{when(show.startTime)} · Ghế {seats.join(', ')}</Muted>
        {selectedFoods.map(item => <Muted key={item._id}>{item.name} × {quantities[item._id]} · {money(item.price * quantities[item._id])}</Muted>)}
        <Muted>Tạm tính: {money(subtotal)}</Muted><Muted>Giảm từ {points} điểm: {money(Number(points) * 1000)}</Muted><Heading>Thành tiền: {money(subtotal - Number(points) * 1000)}</Heading>
      </Card><Heading>Bắp & nước</Heading><FoodPicker foods={foods} quantities={quantities} onChange={setQuantities} disabled={busy} />
        {needsAge && <Card><Heading>Kiểm tra điều kiện xem phim · {movie?.classification || `${requiredAge}+`}</Heading><Muted>{movie?.classification === 'K' ? 'Kiểm tra điều kiện người giám hộ theo phân loại K.' : `Kiểm tra tất cả khách trong đơn đủ ${requiredAge} tuổi.`}</Muted><Button secondary={ageAck !== ageKey} title={ageAck === ageKey ? '✓ Đã kiểm tra tuổi / người giám hộ' : 'Xác nhận đã kiểm tra tuổi / người giám hộ'} onPress={() => setAgeAck(ageAck === ageKey ? '' : ageKey)} /></Card>}
      </>}
    </>}
  </Page>{ready && !pendingRequest && <StickyBar><View style={s.row}>{step > 0 && <Button secondary disabled={busy} title="Quay lại bước trước" onPress={() => go(step - 1)} />}{step < 4 ? <Button disabled={busy || !!availabilityError} title="Tiếp tục" onPress={() => go(step + 1)} /> : <Button busy={busy} disabled={!!availabilityError || !!resume || !!recoveryError || !pointsValid || (needsAge && ageAck !== ageKey)} title="Giữ ghế & tiếp tục thanh toán" onPress={() => void create()} />}</View></StickyBar>}</View>;
}
