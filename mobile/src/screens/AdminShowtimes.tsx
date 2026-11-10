import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, ApiError, money, when } from '../api';
import DateField from '../DateField';
import OptionPicker from '../OptionPicker';
import { useAction } from '../hooks';
import { Movie } from '../types';
import { Badge, Button, Card, colors, ConfirmButton, Eyebrow, Field, Heading, Muted, Page, s } from '../ui';
import {
  emptyShowtimeForm, getShowtime, getShowtimeRooms, listShowtimes,
  ManagedShowtime, ShowtimeForm, ShowtimePage, ShowtimeRoom, showtimePayload, vietnamTime,
} from '../showtimes';

const emptyPage: ShowtimePage = { showtimes: [], total: 0, page: 1, totalPages: 0 };
const editable = (show: ManagedShowtime) => !show.cancelledAt && new Date(show.startTime).getTime() > Date.now();

export function AdminShowtimes() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const [notice, setNotice] = useState(saved === 'created' ? 'Thêm suất chiếu thành công.' : saved === 'updated' ? 'Cập nhật suất chiếu thành công.' : '');
  const [result, setResult] = useState<ShowtimePage>(emptyPage);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [movie, setMovie] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const action = useAction();

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([listShowtimes(movie, page), api<Movie[]>('/movies')])
      .then(([data, films]) => {
        if (!active) return;
        if (page > Math.max(1, data.totalPages)) { setPage(Math.max(1, data.totalPages)); return; }
        setResult(data); setMovies(films);
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [movie, page, revision]));

  function remove(show: ManagedShowtime) {
    void action.run(async () => {
      setNotice('');
      try {
        await api(`/showtimes/${show._id}`, 'DELETE', { updatedAt: show.updatedAt });
        setNotice('Xóa suất chiếu thành công.');
        setRevision(value => value + 1);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setRevision(value => value + 1);
        throw e;
      }
    });
  }

  return <Page>
    <Eyebrow>CINEMA+ / ADMIN</Eyebrow>
    <Heading>Quản lý suất chiếu</Heading>
    <Muted>Lịch chiếu, phòng và giá vé. Thời gian theo giờ Việt Nam (UTC+7).</Muted>
    <Button icon="calendar" title="Thêm suất chiếu" disabled={action.busy} onPress={() => router.push('/showtimes/edit')} />
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.green }}>{notice}</Text>}
    {!!action.error && <Text accessibilityRole="alert" style={s.error}>{action.error}</Text>}
    <OptionPicker title="Lọc theo phim" value={movie} disabled={action.busy}
      items={[{ value: '', label: 'Tất cả phim' }, ...movies.map(item => ({ value: item._id, label: item.title }))]}
      searchLabel="Tìm phim" searchPlaceholder="Nhập tên phim" emptyLabel="Không có phim phù hợp."
      onChange={value => { setMovie(value); setPage(1); }} />
    <Button secondary title="Tải lại danh sách" busy={loading} disabled={action.busy} onPress={() => setRevision(value => value + 1)} />
    {loading ? <ActivityIndicator accessibilityLabel="Đang tải suất chiếu" color={colors.pink} /> : error ?
      <Text accessibilityRole="alert" style={s.error}>{error}</Text> : <>
        <Muted>{result.total} suất chiếu · Trang {page}/{Math.max(1, result.totalPages)}</Muted>
        {!result.showtimes.length && <Card><Text style={s.title}>Chưa có suất chiếu phù hợp</Text><Muted>Thêm suất chiếu mới hoặc chọn phim khác để xem lịch.</Muted></Card>}
        {result.showtimes.map(show => <Card key={show._id}>
          <Badge tone={show.cancelledAt ? 'red' : editable(show) ? 'green' : 'neutral'}>
            {show.cancelledAt ? 'Đã hủy' : editable(show) ? 'Sắp chiếu' : 'Đã bắt đầu'}
          </Badge>
          <Text style={s.title}>{show.movie?.title || 'Phim không còn tồn tại'}</Text>
          <Muted>{show.cinema} · {show.room}{'\n'}{when(show.startTime)}</Muted>
          <View style={s.between}><Text style={s.title}>{money(show.price)}</Text><Muted>
            {show.seats.filter(seat => seat.status === 'available' && (!seat.condition || seat.condition === 'Active')).length}/{show.seats.length} ghế trống
          </Muted></View>
          {!!show.cancellationReason && <Muted>Lý do hủy: {show.cancellationReason}</Muted>}
          {editable(show) && <>
            <Button secondary title="Sửa suất chiếu" accessibilityLabel={`Sửa suất chiếu ${show.movie?.title} ${when(show.startTime)}`}
              disabled={action.busy} onPress={() => router.push({ pathname: '/showtimes/edit', params: { id: show._id } })} />
            <ConfirmButton title="Xóa suất chiếu" disabled={action.busy}
              message={`Xóa suất ${show.movie?.title || 'phim'} tại ${show.cinema} · ${show.room}, ${when(show.startTime)}? Chỉ xóa được suất chưa bắt đầu, không có giữ ghế hay tham chiếu đặt vé. Thao tác không thể hoàn tác.`}
              onConfirm={() => remove(show)} />
          </>}
        </Card>)}
        {result.totalPages > 1 && <View style={s.wrap}>
          <Button secondary title="Trang trước" disabled={page <= 1 || action.busy} onPress={() => setPage(value => value - 1)} />
          <Button secondary title="Trang sau" disabled={page >= result.totalPages || action.busy} onPress={() => setPage(value => value + 1)} />
        </View>}
      </>}
    <Muted>Suất đã có đặt vé hoặc giữ ghế không thể sửa/xóa trực tiếp. Nếu cần hủy suất và hoàn điểm, dùng trang quản lý suất chiếu trên website.</Muted>
    <Button secondary title="Về tác vụ" onPress={() => router.replace('/workspace')} />
  </Page>;
}

export function EditShowtime() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = typeof rawId === 'string' ? rawId : '';
  const editing = !!id;
  const [form, setForm] = useState<ShowtimeForm>(emptyShowtimeForm);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [rooms, setRooms] = useState<ShowtimeRoom[]>([]);
  const [current, setCurrent] = useState<ManagedShowtime | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [stale, setStale] = useState(false);
  const action = useAction();

  useEffect(() => {
    let active = true;
    setLoaded(false); setLoadError(''); setStale(false); action.setError('');
    Promise.all([api<Movie[]>('/movies'), getShowtimeRooms(), id ? getShowtime(id) : Promise.resolve(null)])
      .then(([films, availableRooms, show]) => {
        if (!active) return;
        setMovies(films); setRooms(availableRooms); setCurrent(show);
        setForm(show ? {
          movie: show.movie?._id || '',
          roomId: availableRooms.find(room => room.cinema === show.cinema && room.name === show.room)?._id || '',
          startTime: vietnamTime(show.startTime), price: String(show.price),
        } : emptyShowtimeForm());
        setLoaded(true);
      }).catch(e => { if (active) setLoadError(e.message); });
    return () => { active = false; };
  }, [id, revision]);

  const films = movies.filter(movie => movie.classification !== 'C' && movie.duration > 0);
  const room = rooms.find(item => item._id === form.roomId);
  const readOnly = editing && !!current && !editable(current);
  const disabled = action.busy || stale || readOnly;
  function change<K extends keyof ShowtimeForm>(key: K, value: ShowtimeForm[K]) {
    setForm(previous => ({ ...previous, [key]: value })); action.setError('');
  }
  function save() {
    void action.run(async () => {
      const payload = showtimePayload(form, rooms);
      if (!films.some(movie => movie._id === form.movie)) throw new Error('Phim đã chọn không thể tạo suất chiếu. Vui lòng chọn phim khác.');
      try {
        await api(editing ? `/showtimes/${id}` : '/showtimes', editing ? 'PUT' : 'POST',
          editing ? { ...payload, updatedAt: current?.updatedAt } : payload);
        router.replace({ pathname: '/showtimes', params: { saved: editing ? 'updated' : 'created' } });
      } catch (e) {
        if (editing && e instanceof ApiError && e.status === 409) setStale(true);
        throw e;
      }
    });
  }

  return <Page>
    <Eyebrow>CINEMA+ / ADMIN</Eyebrow>
    <Heading>{editing ? 'Sửa suất chiếu' : 'Thêm suất chiếu'}</Heading>
    <Muted>Tất cả trường đều bắt buộc. Giờ bắt đầu được tính theo giờ Việt Nam (UTC+7).</Muted>
    {loadError ? <><Text accessibilityRole="alert" style={s.error}>{loadError}</Text><Button secondary title="Thử tải lại" onPress={() => setRevision(value => value + 1)} /></> :
      !loaded ? <ActivityIndicator accessibilityLabel="Đang tải phim và phòng" color={colors.pink} /> : <>
        {!!action.error && <Text accessibilityRole="alert" style={s.error}>{action.error}</Text>}
        {readOnly && <Text style={s.error}>Suất đã bắt đầu hoặc đã hủy nên không thể chỉnh sửa.</Text>}
        {stale && <Card><Muted>Dữ liệu hoặc điều kiện của suất đã thay đổi. Tải lại để xem thông tin mới nhất trước khi sửa tiếp. Thông tin đang nhập sẽ được thay bằng dữ liệu đã lưu.</Muted><Button secondary title="Tải lại suất chiếu" onPress={() => setRevision(value => value + 1)} /></Card>}
        {!films.length && <Text style={s.error}>Chưa có phim đủ điều kiện. Thêm phim có thời lượng hợp lệ và phân loại khác C trước.</Text>}
        {!rooms.length && <Text style={s.error}>Chưa có phòng hoạt động với sơ đồ ghế hợp lệ. Cấu hình phòng trên website trước khi thêm suất chiếu.</Text>}
        <OptionPicker title="Phim" value={form.movie} disabled={disabled}
          placeholder="Chọn phim" searchLabel="Tìm phim" searchPlaceholder="Nhập tên phim" emptyLabel="Không có phim phù hợp."
          items={films.map(movie => ({ value: movie._id, label: movie.title, detail: `${movie.duration} phút · ${movie.classification || 'P'}` }))}
          onChange={value => change('movie', value)} />
        <OptionPicker title="Rạp / Phòng chiếu" value={form.roomId} disabled={disabled}
          placeholder="Chọn phòng đang hoạt động" searchLabel="Tìm phòng" searchPlaceholder="Nhập tên rạp hoặc phòng" emptyLabel="Không có phòng phù hợp."
          items={rooms.map(item => ({ value: item._id, label: `${item.cinema} · ${item.name}`, detail: `${item.seats.length} ghế` }))}
          onChange={value => change('roomId', value)} />
        {!!room && <Muted>Sơ đồ {room.seats.length} ghế được lấy từ cấu hình phòng đã chọn.</Muted>}
        <DateField label="Ngày giờ bắt đầu (UTC+7)" withTime value={form.startTime} disabled={disabled} onChange={value => change('startTime', value)} />
        <Field label="Giá vé (VND)" icon="wallet" keyboardType="number-pad" value={form.price} editable={!disabled} onChangeText={value => change('price', value)} />
        <Muted>Lịch cùng phòng cần đủ thời lượng phim và 15 phút dọn phòng. Không tạo suất trước ngày khởi chiếu. Giá vé áp dụng cho toàn bộ ghế trong suất.</Muted>
        <Button title={editing ? 'Lưu thay đổi' : 'Lưu suất chiếu'} busy={action.busy} disabled={disabled || !films.length || !rooms.length} onPress={save} />
      </>}
    <Button secondary title="Về danh sách suất chiếu" disabled={action.busy} onPress={() => router.replace('/showtimes')} />
  </Page>;
}
