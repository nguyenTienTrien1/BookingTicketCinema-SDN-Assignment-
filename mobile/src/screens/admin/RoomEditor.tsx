import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { api } from '../../services/api';
import { generateRoomSeats, getRoom, Room, RoomStatus, roomLabels } from '../../services/rooms';
import { useAction } from '../../utils/hooks';
import { Badge, Button, Card, Chip, ConfirmButton, Eyebrow, Field, Heading, Muted, Page } from '../../components/ui';
import { colors, s } from '../../theme';

export default function RoomEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession(), admin = user?.role === 'admin', creating = id === 'new';
  const [room, setRoom] = useState<Room | null>(null);
  const [form, setForm] = useState({ cinema: '', name: '', status: 'Inactive' as RoomStatus, rows: '5', columns: '8' });
  const [loading, setLoading] = useState(!creating), [loadError, setLoadError] = useState(''), [reload, setReload] = useState(0);
  const a = useAction();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { if (a.error || a.notice) scroll.current?.scrollTo({ y: 0, animated: false }); }, [a.error, a.notice]);

  useFocusEffect(useCallback(() => {
    if (!admin || creating) return;
    let active = true;
    setLoading(true); setLoadError(''); setRoom(null);
    getRoom(id).then(value => {
      if (active) { setRoom(value); setForm(f => ({ ...f, cinema: value.cinema, name: value.name, status: value.status })); }
    }).catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, creating, id, reload]));

  function change(key: keyof typeof form, value: string) { setForm(f => ({ ...f, [key]: value })); a.setError(''); a.setNotice(''); }
  async function save() {
    if (!form.cinema.trim() || !form.name.trim()) throw new Error('Vui lòng nhập tên rạp và tên phòng.');
    const data = { cinema: form.cinema.trim(), name: form.name.trim(), status: form.status };
    if (creating) {
      const result = await api<{ room: Room }>('/rooms', 'POST', { ...data, seats: generateRoomSeats(form.rows, form.columns) });
      router.replace({ pathname: '/rooms/edit', params: { id: result.room._id } });
    } else if (room) {
      const result = await api<{ room: Room; message: string }>(`/rooms/${id}`, 'PUT', { ...data, version: room.version });
      setRoom(result.room); a.setNotice(result.message);
    }
  }
  if (!admin) return <Redirect href="/workspace" />;
  const disabled = a.busy || loading;
  return <Page scrollRef={scroll}>
    <Button secondary title="← Danh sách phòng chiếu" disabled={a.busy} onPress={() => router.navigate('/rooms')} />
    <Eyebrow>CINEMA+ / ADMIN</Eyebrow><Heading>{creating ? 'Thêm phòng chiếu' : 'Sửa phòng chiếu'}</Heading>
    {!!a.error && <Text accessibilityRole="alert" style={s.error}>{a.error}</Text>}
    {!!a.notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.green }}>{a.notice}</Text>}
    {loading && <ActivityIndicator accessibilityLabel="Đang tải phòng" color={colors.pink} />}
    {!!loadError && <Text accessibilityRole="alert" style={s.error}>{loadError}</Text>}
    {(creating || room) && <>
      <Card>
        <Text style={s.title}>Thông tin phòng</Text>
        <Field label="Rạp" value={form.cinema} onChangeText={v => change('cinema', v)} maxLength={100} editable={!disabled} />
        <Field label="Tên phòng" value={form.name} onChangeText={v => change('name', v)} maxLength={100} editable={!disabled} />
        <Text style={s.label}>Trạng thái phòng</Text>
        <View style={s.wrap}>{(Object.keys(roomLabels) as RoomStatus[]).filter(v => !creating || v !== 'Maintenance').map(v => <Chip key={v} title={!creating && v === 'Inactive' ? 'Ngừng hoạt động' : roomLabels[v]} disabled={disabled} selected={form.status === v} onPress={() => change('status', v)} />)}</View>
        {!creating && <Muted>Phòng đã có suất chiếu không thể đổi tên hoặc rạp. Phòng còn suất chưa kết thúc không thể ngừng hoạt động hoặc bảo trì.</Muted>}
      </Card>
      {creating ? <Card>
        <Text style={s.title}>Sơ đồ ghế ban đầu</Text>
        <Field label="Số hàng (1–26)" keyboardType="number-pad" value={form.rows} maxLength={2} editable={!disabled} onChangeText={v => change('rows', v)} />
        <Field label="Ghế mỗi hàng (1–40)" keyboardType="number-pad" value={form.columns} maxLength={2} editable={!disabled} onChangeText={v => change('columns', v)} />
        <Muted>Dự kiến {Number(form.rows) * Number(form.columns) || 0} ghế thường, sử dụng được. Tối đa 1000 ghế. Có thể cấu hình từng vị trí sau khi tạo.</Muted>
      </Card> : room && <Card><Badge>{room.capacity} ghế</Badge><Muted>{room.layoutPolicy}</Muted><Button secondary icon="seat" disabled={disabled} title="Cấu hình ghế" onPress={() => router.push({ pathname: '/rooms/[id]/seats', params: { id } })} /></Card>}
      <Button busy={a.busy} disabled={loading} title={creating ? 'Tạo phòng chiếu' : 'Lưu thông tin phòng'} onPress={() => a.run(save)} />
      {!creating && room && <Card><Text style={s.title}>Xóa phòng chiếu</Text><Muted>Chỉ xóa phòng chưa có tham chiếu suất chiếu. Lịch sử đặt vé luôn được giữ lại.</Muted><ConfirmButton title="Xóa phòng" disabled={disabled} message={`Xóa “${room.name}” tại ${room.cinema}?`} onConfirm={() => { void a.run(async () => { await api(`/rooms/${id}`, 'DELETE', { version: room.version }); router.replace('/rooms'); }); }} /></Card>}
    </>}
    {!creating && <ConfirmButton disabled={disabled} title="Tải lại phòng" message="Tải dữ liệu mới nhất và bỏ các thông tin chưa lưu?" onConfirm={() => { a.setError(''); a.setNotice(''); setReload(n => n + 1); }} />}
  </Page>;
}
