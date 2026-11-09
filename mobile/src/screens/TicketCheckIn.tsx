import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api, ApiError, when } from '../api';
import { BackButton, Button, Card, Field, Heading, Muted, Page, s } from '../ui';
import OptionPicker from '../OptionPicker';

type Preview = { reference: string; seat: string; status: string; checkedInAt?: string; mode: string; reason?: string; message?: string; requiresAgeCheck: boolean; eligible: boolean; admissionGranted?: boolean; showtime: { movieTitle: string; cinema: string; room: string; startTime: string; classification: string }; window: { opensAt: string; closesAt: string } };
type Show = { _id: string; movie: { title: string }; cinema: string; room: string; startTime: string };
export default function TicketCheckIn() {
  const [permission, requestPermission] = useCameraPermissions();
  const [shows, setShows] = useState<Show[]>([]), [showtimeId, setShowtimeId] = useState(''), [reference, setReference] = useState('');
  const [ticket, setTicket] = useState<Preview | null>(null), [ageVerified, setAgeVerified] = useState(false), [needsLookup, setNeedsLookup] = useState(false), [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [now, setNow] = useState(() => Date.now());
  const requestVersion = useRef(0), scanned = useRef(false), saving = useRef(false);
  async function load() { setError(''); try { setShows((await api<{ showtimes: Show[] }>('/tickets/showtimes')).showtimes); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void Promise.resolve().then(load); const timer = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(timer); requestVersion.current++; }; }, []);
  function clear() { requestVersion.current++; setTicket(null); setAgeVerified(false); setNeedsLookup(false); setError(''); setSuccess(''); }
  async function lookup(value = reference) {
    clear(); if (!showtimeId || !value.trim()) { setError('Chọn suất chiếu và nhập hoặc quét mã vé.'); return; }
    const version = requestVersion.current; setBusy(true);
    try { const data = await api<Preview>(`/tickets/lookup?reference=${encodeURIComponent(value.trim())}&showtimeId=${showtimeId}`); if (version === requestVersion.current) { setTicket(data); setNow(Date.now()); } }
    catch (e) { if (version === requestVersion.current) setError((e as Error).message); }
    finally { if (version === requestVersion.current) setBusy(false); }
  }
  const inWindow = !!ticket && now >= new Date(ticket.window.opensAt).getTime() && now <= new Date(ticket.window.closesAt).getTime();
  async function confirm() {
    if (!ticket?.eligible || !inWindow || needsLookup || saving.current || (ticket.requiresAgeCheck && !ageVerified)) return;
    saving.current = true; setBusy(true); setError(''); setSuccess('');
    try { const result = await api<Preview>(`/tickets/${encodeURIComponent(ticket.reference)}/check-in`, 'POST', { showtimeId, ageVerified }); setTicket(result); setSuccess(result.message || 'Đã lưu trạng thái check-in.'); }
    catch (e) {
      setError((e as Error).message); setTicket(null); setAgeVerified(false);
      if (!(e instanceof ApiError) || e.status >= 500) setNeedsLookup(true);
    } finally { saving.current = false; setBusy(false); }
  }
  return <Page><BackButton disabled={busy} onPress={() => router.navigate('/workspace')} /><Heading>Check-in vé</Heading><Muted>Chọn đúng suất, tra cứu vé rồi xác nhận vào rạp sau khi trạng thái được lưu.</Muted>
    <OptionPicker title="Suất chiếu đang soát vé" value={showtimeId} items={shows.map(show => ({ value: show._id, label: show.movie?.title || 'Phim', detail: `${show.cinema} · ${show.room} · ${when(show.startTime)}` }))} onChange={value => { if (!busy) { clear(); setShowtimeId(value); } }} />
    <Field label="Mã vé / QR" value={reference} editable={!busy} autoCapitalize="none" onChangeText={value => { clear(); setReference(value); }} />
    <Button busy={busy} disabled={!showtimeId || !reference.trim()} title="Tra cứu vé" onPress={() => void lookup()} />
    {Platform.OS !== 'web' && <Button secondary disabled={busy || !showtimeId} title="Mở camera quét QR" onPress={() => void (async () => { const p = permission?.granted ? permission : await requestPermission(); if (!p.granted) { setError('Chưa có quyền camera. Có thể nhập mã vé hoặc cấp quyền trong cài đặt.'); return; } scanned.current = false; setCamera(true); })()} />}
    {camera && <><CameraView style={{ height: 290 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { if (scanned.current) return; scanned.current = true; setCamera(false); setReference(data); void lookup(data); }} /><Button secondary title="Đóng camera" onPress={() => setCamera(false)} /></>}
    <Button secondary disabled={busy} title="Tải lại suất chiếu" onPress={() => { clear(); setShowtimeId(''); void load(); }} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {needsLookup && <Card><Muted>Kết quả lưu chưa rõ. Chưa cho khách vào rạp; tra cứu lại trạng thái trước khi xử lý tiếp.</Muted><Button secondary disabled={busy} title="Tra cứu lại trạng thái" onPress={() => void lookup()} /></Card>}
    {!!success && <Card><Heading>{ticket?.admissionGranted ? 'Check-in thành công' : 'Kết quả check-in'}</Heading><Muted>{success}</Muted></Card>}
    {ticket && <Card><Heading>Ghế {ticket.seat} · {ticket.showtime.movieTitle}</Heading><Muted>{ticket.showtime.cinema} · {ticket.showtime.room}</Muted><Muted>Giờ chiếu: {when(ticket.showtime.startTime)}</Muted><Muted>Nhận khách: {when(ticket.window.opensAt)} — {when(ticket.window.closesAt)}</Muted><Muted>Phân loại: {ticket.showtime.classification || 'P'}</Muted><Muted>Trạng thái: {ticket.status === 'checked-in' ? 'Đã check-in' : ticket.status === 'issued' ? 'Chưa sử dụng' : ticket.status}</Muted><Text selectable style={s.muted}>{ticket.reference}</Text>
      {ticket.mode === 'demo' && <Text style={s.error}>Vé mô phỏng — không xác nhận vào rạp thật.</Text>}{!!ticket.reason && <Text style={s.error}>{ticket.reason}</Text>}{ticket.checkedInAt && <Muted>Đã check-in: {when(ticket.checkedInAt)}</Muted>}
      {ticket.eligible && <>{ticket.requiresAgeCheck && <Button secondary={!ageVerified} disabled={busy} title={ageVerified ? '✓ Đã kiểm tra tuổi / người giám hộ' : 'Xác nhận kiểm tra tuổi / người giám hộ'} onPress={() => setAgeVerified(!ageVerified)} />}<Button busy={busy} disabled={!inWindow || needsLookup || (ticket.requiresAgeCheck && !ageVerified)} title={ticket.mode === 'demo' ? 'Lưu check-in mô phỏng' : 'Xác nhận check-in'} onPress={() => void confirm()} /></>}
    </Card>}
  </Page>;
}
