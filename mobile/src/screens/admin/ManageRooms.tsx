import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { api } from '../../services/api';
import { RoomList, RoomStatus, roomLabels } from '../../services/rooms';
import { BackButton, Badge, Button, Card, Chip, Eyebrow, Field, Heading, Muted, Page } from '../../components/ui';
import OptionPicker from '../../components/OptionPicker';
import { colors, s } from '../../theme';

export default function ManageRooms() {
  const { user } = useSession();
  const [data, setData] = useState<RoomList>({ rooms: [], cinemas: [], total: 0, totalPages: 0, page: 1 });
  const [keyword, setKeyword] = useState(''), [search, setSearch] = useState('');
  const [cinema, setCinema] = useState(''), [status, setStatus] = useState('');
  const [page, setPage] = useState(1), [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const admin = user?.role === 'admin';

  useFocusEffect(useCallback(() => {
    if (!admin) return;
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams({ search, cinema, status, page: String(page), limit: '10' });
    api<RoomList>(`/rooms?${query}`).then(result => {
      if (!active) return;
      if (page > Math.max(1, result.totalPages)) { setPage(Math.max(1, result.totalPages)); return; }
      setData(result);
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, search, cinema, status, page, reload]));

  if (!admin) return <Redirect href="/workspace" />;
  return <Page>
    <BackButton onPress={() => router.navigate('/workspace')} />
    <Eyebrow>CINEMA+ / ADMIN</Eyebrow>
    <Heading>Quản lý phòng chiếu</Heading>
    <Muted>Thông tin phòng, sơ đồ ghế và tình trạng vận hành.</Muted>
    <Button icon="plus" title="Thêm phòng chiếu" onPress={() => router.push({ pathname: '/rooms/edit', params: { id: 'new' } })} />
    <Card>
      <Field label="Tìm phòng" icon="search" value={keyword} maxLength={200} onChangeText={setKeyword} placeholder="Tên phòng chiếu" returnKeyType="search" onSubmitEditing={() => { setSearch(keyword.trim()); setPage(1); setReload(n => n + 1); }} />
      <OptionPicker title="Lọc theo rạp" value={cinema} items={[{ value: '', label: 'Tất cả rạp' }, ...data.cinemas.map(value => ({ value, label: value }))]} onChange={value => { setCinema(value); setPage(1); }} searchLabel="Tìm rạp" searchPlaceholder="Tên rạp" emptyLabel="Không có rạp phù hợp." />
      <View style={s.wrap}>
        <Chip title="Tất cả trạng thái" selected={!status} onPress={() => { setStatus(''); setPage(1); }} />
        {(Object.keys(roomLabels) as RoomStatus[]).map(value => <Chip key={value} title={roomLabels[value]} selected={status === value} onPress={() => { setStatus(value); setPage(1); }} />)}
      </View>
      <Button secondary busy={loading} title="Tìm kiếm" onPress={() => { setSearch(keyword.trim()); setPage(1); setReload(n => n + 1); }} />
    </Card>
    {loading ? <ActivityIndicator accessibilityLabel="Đang tải phòng chiếu" color={colors.pink} /> : error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : <>
      <Muted>{data.total} phòng chiếu · Trang {page}/{Math.max(1, data.totalPages)}</Muted>
      {!data.rooms.length && <Card><Text style={s.title}>Chưa có phòng phù hợp</Text><Muted>Điều chỉnh bộ lọc hoặc thêm phòng chiếu mới.</Muted></Card>}
      {data.rooms.map(room => <Card key={room._id}>
        <View style={{ gap: 8 }}><Text style={s.title}>{room.name}</Text><Muted>{room.cinema} · {room.capacity} ghế</Muted><Badge tone={room.status === 'Active' ? 'green' : room.status === 'Maintenance' ? 'gold' : 'neutral'}>{roomLabels[room.status]}</Badge></View>
        <Button icon="seat" title={`Cấu hình ghế · ${room.name}`} onPress={() => router.push({ pathname: '/rooms/[id]/seats', params: { id: room._id } })} />
        <Button secondary title={`Sửa / xóa · ${room.name}`} onPress={() => router.push({ pathname: '/rooms/edit', params: { id: room._id } })} />
      </Card>)}
      <View style={s.row}><View style={{ flex: 1 }}><Button secondary disabled={page <= 1} title="Trang trước" onPress={() => setPage(p => p - 1)} /></View><View style={{ flex: 1 }}><Button secondary disabled={page >= data.totalPages} title="Trang sau" onPress={() => setPage(p => p + 1)} /></View></View>
    </>}
    <Button secondary disabled={loading} title="Tải lại danh sách" onPress={() => setReload(n => n + 1)} />
  </Page>;
}
