import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { api } from '../../services/api';
import { conditionLabels, generateRoomSeats, getRoom, LayoutReview, Room, roomLayout, SeatCondition, SeatConfig, SeatType, typeLabels } from '../../services/rooms';
import { useAction } from '../../utils/hooks';
import { Accordion, Button, Card, Chip, ConfirmButton, Field, Heading, Muted, Page, StickyBar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, s } from '../../theme';

export default function RoomSeats() {
  const { id } = useLocalSearchParams<{ id: string }>(), { user } = useSession(), admin = user?.role === 'admin';
  const [room, setRoom] = useState<Room | null>(null), [seats, setSeats] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, SeatConfig>>({}), [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState<LayoutReview | null>(null);
  const [rows, setRows] = useState('5'), [columns, setColumns] = useState('8'), [number, setNumber] = useState('');
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [reload, setReload] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const { height } = useWindowDimensions();
  const a = useAction();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const gridTop = useRef(0);
  useEffect(() => { if (a.error || a.notice) scroll.current?.scrollTo({ y: 0, animated: false }); }, [a.error, a.notice]);
  useEffect(() => { if (editorOpen && selected.length) scroll.current?.scrollTo({ y: gridTop.current, animated: false }); }, [editorOpen, selected.length]);
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const seat of seats) { const row = seat.replace(/\d+$/, ''); map.set(row, [...(map.get(row) || []), seat]); }
    return [...map.entries()].sort(([a], [b]) => a.length - b.length || a.localeCompare(b)).map(([row, values]) => [row, values.sort((a, b) => Number(a.match(/\d+$/)?.[0]) - Number(b.match(/\d+$/)?.[0]))] as const);
  }, [seats]);

  useFocusEffect(useCallback(() => {
    if (!admin) return;
    let active = true;
    setLoading(true); setLoadError(''); setRoom(null); setReview(null); setSelected([]);
    getRoom(id).then(value => {
      if (active) {
        setRoom(value); setSeats(value.seats); setConfigs(roomLayout(value.seats, value.seatConfigs).seatConfigs);
        setRows(String(Math.min(26, new Set(value.seats.map(v => v.replace(/\d+$/, ''))).size)));
        setColumns(String(Math.min(40, Math.max(...value.seats.map(v => Number(v.match(/\d+$/)?.[0]))))));
      }
    }).catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, id, reload]));

  function change(nextSeats: string[], nextConfigs: Record<string, SeatConfig>) {
    const layout = roomLayout(nextSeats, nextConfigs);
    setSeats(layout.seats); setConfigs(layout.seatConfigs); setReview(null); a.setError(''); a.setNotice('');
    setSelected(current => current.filter(value => nextSeats.includes(value)));
  }
  function apply(value: Partial<SeatConfig>) {
    const next = { ...configs };
    for (const seat of selected) next[seat] = { ...next[seat], ...value };
    change(seats, next);
  }
  function toggle(seat: string) { setSelected(current => current.includes(seat) ? current.filter(value => value !== seat) : [...current, seat]); setEditorOpen(true); }
  async function preview() {
    if (!room) return;
    setEditorOpen(false);
    setReview(null);
    const result = await api<{ review: LayoutReview }>(`/rooms/${id}/seats/preview`, 'POST', { version: room.version, ...roomLayout(seats, configs) });
    setReview(result.review);
  }
  async function save() {
    if (!room || !review?.canSave) return;
    try {
      const result = await api<{ room: Room; message: string }>(`/rooms/${id}/seats`, 'PUT', { version: room.version, ...roomLayout(seats, configs), confirmed: true });
      setRoom(result.room); setSeats(result.room.seats); setConfigs(result.room.seatConfigs); setSelected([]); a.setNotice(result.message);
    } finally { setReview(null); }
  }
  if (!admin) return <Redirect href="/workspace" />;
  return <View style={{ flex: 1, backgroundColor: colors.bg }}><Page scrollRef={scroll}>
    <Button secondary disabled={a.busy} title="← Danh sách phòng chiếu" onPress={() => router.navigate('/rooms')} />
    <Heading>Sơ đồ ghế</Heading>
    {!!a.error && <Text accessibilityRole="alert" style={s.error}>{a.error}</Text>}
    {!!a.notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.green }}>{a.notice}</Text>}
    {!!loadError && <Text accessibilityRole="alert" style={s.error}>{loadError}</Text>}
    {loading && <ActivityIndicator color={colors.pink} accessibilityLabel="Đang tải sơ đồ ghế" />}
    {room && <>
      <View style={{ gap: 4 }}><Text style={s.title}>{room.name}</Text><Muted>{room.cinema} · {seats.length} ghế</Muted></View>
      <Muted>Chạm ghế để chỉnh ngay. Vuốt ngang và dọc trong sơ đồ để xem các vị trí khác.</Muted>
      <View style={s.wrap}><Button secondary disabled={a.busy} title="Chọn tất cả ghế" onPress={() => { setSelected([...seats]); setEditorOpen(true); }} /><Button secondary disabled={a.busy || !selected.length} title="Bỏ chọn" onPress={() => { setSelected([]); setEditorOpen(false); }} /></View>
      <View testID="room-seat-map" onLayout={event => { gridTop.current = event.nativeEvent.layout.y; }} style={{ backgroundColor: colors.panel, borderRadius: 20, paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        <View style={{ height: 4, width: '70%', alignSelf: 'center', backgroundColor: colors.muted, borderRadius: 4 }} /><Text style={[s.muted, { textAlign: 'center' }]}>MÀN HÌNH</Text>
        <ScrollView testID="room-seat-map-vertical" nestedScrollEnabled style={{ height: Math.min(300, Math.max(160, height * .34)) }} showsVerticalScrollIndicator persistentScrollbar>
        <ScrollView testID="room-seat-map-horizontal" horizontal nestedScrollEnabled directionalLockEnabled style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12, flexGrow: 1 }} showsHorizontalScrollIndicator persistentScrollbar>
          <View style={{ gap: 8 }}>{groups.map(([row, values]) => <View key={row} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Chọn hàng ${row}`} accessibilityState={{ selected: values.every(v => selected.includes(v)), disabled: a.busy }} disabled={a.busy} onPress={() => { setSelected(current => values.every(v => current.includes(v)) ? current.filter(v => !values.includes(v)) : [...new Set([...current, ...values])]); setEditorOpen(true); }} style={({ pressed }) => ({ minWidth: 48, minHeight: 52, justifyContent: 'center', alignItems: 'center', opacity: pressed ? .6 : 1 })}><Text style={s.label}>{row}</Text></Pressable>
            {values.map((seat, index) => {
              const config = configs[seat], chosen = selected.includes(seat), available = config.status === 'Active';
              const tint = chosen ? colors.text : !available ? colors.pink : config.type === 'VIP' ? colors.gold : colors.muted;
              const column = Number(seat.slice(row.length)), previous = index ? Number(values[index - 1].slice(row.length)) : 0;
              const gap = Number(values[values.length - 1].slice(row.length)) <= 100 ? (column - previous - 1) * 58 : 0;
              return <Pressable key={seat} accessibilityRole="button" accessibilityLabel={`Ghế ${seat}, ${typeLabels[config.type]}, ${conditionLabels[config.status]}`} accessibilityState={{ selected: chosen, disabled: a.busy }} disabled={a.busy} onPress={() => toggle(seat)} style={({ pressed }) => ({ width: 52, marginLeft: gap, minHeight: 64, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: chosen ? colors.pink : colors.border, backgroundColor: chosen ? colors.red : colors.soft, gap: 3, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}>
                <Icon name="seat" color={tint} size={20} /><Text style={{ color: tint, fontSize: 11, fontWeight: '700' }}>{seat}</Text><Text style={{ color: tint, fontSize: 10 }}>{available ? typeLabels[config.type] : conditionLabels[config.status]}</Text>
              </Pressable>;
            })}
          </View>)}</View>
        </ScrollView>
        </ScrollView>
      </View>
      <Card>
        <Text style={s.title}>Thêm hoặc đổi mã ghế</Text>
        <Field label="Mã ghế mới" placeholder="Ví dụ: A9 hoặc AA12" value={number} editable={!a.busy} maxLength={32} autoCapitalize="characters" onFocus={() => setEditorOpen(false)} onChangeText={setNumber} />
        <Button secondary disabled={a.busy} icon="plus" title="Thêm ghế" onPress={() => {
          const value = number.trim().toUpperCase();
          if (!/^[A-Z]+[1-9][0-9]*$/.test(value)) { a.setError('Mã ghế theo dạng A1, B2 hoặc AA12.'); return; }
          if (seats.includes(value)) { a.setError('Mã ghế đã tồn tại.'); return; }
          if (seats.length >= 1000) { a.setError('Mỗi phòng tối đa 1000 ghế.'); return; }
          change([...seats, value], configs); setNumber('');
        }} />
        <Muted>Để đổi mã, chọn đúng một ghế trên sơ đồ rồi nhập mã mới. Loại và tình trạng ghế được giữ nguyên.</Muted>
        <Button secondary disabled={a.busy || selected.length !== 1} title="Đổi mã ghế đang chọn" onPress={() => {
          const value = number.trim().toUpperCase(), old = selected[0];
          if (!/^[A-Z]+[1-9][0-9]*$/.test(value)) { a.setError('Mã ghế theo dạng A1, B2 hoặc AA12.'); return; }
          if (seats.includes(value)) { a.setError('Mã ghế đã tồn tại.'); return; }
          change(seats.map(v => v === old ? value : v), { ...configs, [value]: configs[old] }); setSelected([value]); setNumber('');
        }} />
      </Card>
      <Card><Text style={s.title}>Tạo lại sơ đồ</Text><Muted>Ghế trùng mã giữ nguyên loại và tình trạng. Các vị trí ngoài sơ đồ mới sẽ bị xóa khỏi bản nháp.</Muted>
        <Field label="Số hàng mới (1–26)" value={rows} onChangeText={setRows} keyboardType="number-pad" maxLength={2} editable={!a.busy} />
        <Field label="Ghế mỗi hàng mới (1–40)" value={columns} onChangeText={setColumns} keyboardType="number-pad" maxLength={2} editable={!a.busy} />
        <ConfirmButton disabled={a.busy} title="Tạo lại sơ đồ ghế" message="Thay sơ đồ trong bản nháp bằng số hàng và cột đã nhập?" onConfirm={() => { try { change(generateRoomSeats(rows, columns), configs); } catch (e) { a.setError((e as Error).message); } }} />
      </Card>
      <Accordion title="Quy tắc áp dụng"><Muted>{room.layoutPolicy}</Muted><Muted>Ghế đang giữ hoặc có vé được bảo vệ sẽ chặn thay đổi không an toàn.</Muted></Accordion>
      {review && <View onLayout={event => scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false })}><Card>
        <Text style={s.title}>Xem lại cấu hình</Text><Muted>Sức chứa: {review.before} → {review.after} ghế · {review.scheduledShowtimes} suất chưa kết thúc</Muted>
        <Muted>Ghế thêm: {review.added.join(', ') || 'Không có'}</Muted><Muted>Ghế xóa: {review.removed.join(', ') || 'Không có'}</Muted>
        <Muted>Đổi loại: {review.types.map(v => `${v.seat}: ${typeLabels[v.before]} → ${typeLabels[v.after]}`).join('; ') || 'Không có'}</Muted>
        <Muted>Đổi tình trạng: {review.conditions.map(v => `${v.seat}: ${conditionLabels[v.before]} → ${conditionLabels[v.after]}`).join('; ') || 'Không có'}</Muted>
        {review.conflicts.map((value, i) => <Text key={i} accessibilityRole="alert" style={s.error}>{value}</Text>)}
        {review.canSave && <Muted>Không phát hiện xung đột. Hệ thống sẽ kiểm tra lại khi lưu.</Muted>}
      </Card></View>}
    </>}
    <ConfirmButton disabled={a.busy || loading} title="Tải lại sơ đồ" message="Tải dữ liệu mới nhất và bỏ bản nháp chưa lưu?" onConfirm={() => { a.setError(''); a.setNotice(''); setReload(n => n + 1); }} />
  </Page>
  {room && <StickyBar>
    {selected.length > 0 && <View style={[s.between, { gap: 8 }]}><View style={{ flex: 1 }}><Text style={s.title}>Chỉnh {selected.length} ghế</Text><Text numberOfLines={1} style={s.muted}>{selected.join(', ')}</Text></View><Button secondary disabled={a.busy} title={editorOpen ? 'Thu gọn' : 'Mở chỉnh ghế'} onPress={() => setEditorOpen(!editorOpen)} /></View>}
    {editorOpen && selected.length > 0 && <ScrollView testID="room-seat-controls" nestedScrollEnabled style={{ maxHeight: Math.min(260, height * .28) }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
      <Text style={s.label}>Đổi loại ghế</Text><View style={s.wrap}>{(['Standard', 'VIP'] as SeatType[]).map(value => <Chip key={value} disabled={a.busy} selected={selected.every(seat => configs[seat].type === value)} title={typeLabels[value]} onPress={() => apply({ type: value })} />)}</View>
      <Text style={s.label}>Đổi tình trạng ghế</Text><View style={s.wrap}>{(Object.keys(conditionLabels) as SeatCondition[]).map(value => <Chip key={value} disabled={a.busy} selected={selected.every(seat => configs[seat].status === value)} title={conditionLabels[value]} onPress={() => apply({ status: value })} />)}</View>
      <ConfirmButton disabled={a.busy} title="Xóa ghế đã chọn" message={`Xóa ${selected.length} ghế khỏi bản nháp? Thay đổi chỉ có hiệu lực sau khi xem lại và lưu.`} onConfirm={() => { if (selected.length === seats.length) { a.setError('Sơ đồ phải còn ít nhất 1 ghế.'); return; } change(seats.filter(value => !selected.includes(value)), configs); }} />
    </ScrollView>}
    {review ? <Button busy={a.busy} disabled={!review.canSave} title="Xác nhận và lưu ghế" onPress={() => a.run(save)} /> : <Button busy={a.busy} disabled={loading} title="Xem lại thay đổi" onPress={() => a.run(preview)} />}
  </StickyBar>}
  </View>;
}
