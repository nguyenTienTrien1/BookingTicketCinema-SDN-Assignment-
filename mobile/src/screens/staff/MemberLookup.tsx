import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../services/api';
import { User } from '../../utils/types';
import { useSession } from '../../context/SessionContext';
import { BackButton, Button, Card, Field, Heading, Muted, Page } from '../../components/ui';
import { s } from '../../theme/index';

export default function MemberLookup() {
  const { user } = useSession();
  const [query, setQuery] = useState(''), [result, setResult] = useState<{ members: User[]; hasMore: boolean } | null>(null), [selected, setSelected] = useState<User | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const version = useRef(0);
  function change(value: string) { version.current++; setQuery(value); setResult(null); setSelected(null); setError(''); setBusy(false); }
  async function search() {
    const request = ++version.current; setBusy(true); setError(''); setSelected(null); setResult(null);
    try { const data = await api<{ members: User[]; hasMore: boolean }>('/members/search?q=' + encodeURIComponent(query.trim())); if (request === version.current) setResult(data); }
    catch (e) { if (request === version.current) setError((e as Error).message); }
    finally { if (request === version.current) setBusy(false); }
  }
  async function detail(id: string) {
    const request = ++version.current; setBusy(true); setSelected(null); setError('');
    try { const data = await api<{ member: User }>('/members/' + id); if (request === version.current) setSelected(data.member); }
    catch (e) { if (request === version.current) setError((e as Error).message); }
    finally { if (request === version.current) setBusy(false); }
  }
  return <Page><BackButton disabled={busy} onPress={() => router.navigate('/workspace')} /><Heading>Tra cứu thành viên</Heading>
    <Field label="Email hoặc số điện thoại" value={query} onChangeText={change} autoCapitalize="none" />
    <Muted>Nhập đầy đủ email hoặc số điện thoại. Có thể dùng đầu số 0 hoặc +84.</Muted>
    <Button busy={busy} disabled={!query.trim()} title="Tìm thành viên" onPress={() => void search()} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {result && <Muted>{result.members.length ? `Tìm thấy ${result.members.length} thành viên.` : 'Không tìm thấy thành viên phù hợp.'}{result.hasMore ? ' Chỉ hiển thị 20 kết quả đầu tiên; dùng email để xác định đúng khách.' : ''}</Muted>}
    {result?.members.map(member => <Button key={member._id} secondary disabled={busy} title={`${member.fullName} · ${member.email} · ${member.status}`} onPress={() => void detail(member._id)} />)}
    {selected && <Card><Heading>Thông tin thành viên</Heading><Text style={s.title}>{selected.fullName}</Text><Muted>Email: {selected.email}</Muted><Muted>Số điện thoại: {selected.phone || 'Chưa có thông tin'}</Muted><Muted>Điểm thành viên: {selected.memberPoints || 0}</Muted><Muted>Hạng thành viên: {selected.isVIP ? 'VIP' : 'Thành viên thường'}</Muted><Muted>Trạng thái: {selected.status}</Muted>
      {user?.role === 'admin' && <><Muted>Tuổi: {selected.age ?? 'Chưa cập nhật'}</Muted><Muted>Giới tính: {selected.gender || 'Chưa cập nhật'}</Muted><Muted>Ngày tạo: {selected.createdAt || 'Chưa có thông tin'}</Muted></>}
    </Card>}
  </Page>;
}
