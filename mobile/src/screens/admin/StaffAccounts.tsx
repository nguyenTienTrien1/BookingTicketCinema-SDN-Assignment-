import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackButton, Badge, Button, Card, Eyebrow, Field, Heading, Muted, Page, Section } from '../../components/ui';
import { api } from '../../services/api';
import { useAction } from '../../utils/hooks';
import { s } from '../../theme';

type Staff = { _id: string; fullName: string; email: string; phone?: string; role: string; status: string; credentialsEmailStatus?: string };
const statusName: Record<string, string> = { Active: 'Đang hoạt động', Deactivated: 'Ngừng hoạt động', Banned: 'Đã khóa', 'Pending Activation': 'Chờ kích hoạt', 'Pending Verification': 'Chờ xác minh' };

export default function StaffAccounts() {
  const [users, setUsers] = useState<Staff[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const action = useAction();
  const load = useCallback(async () => { const result = await api<Staff[]>('/users'); setUsers(result.filter(item => item.role === 'employee')); setLoaded(true); }, []);
  useEffect(() => { void Promise.resolve().then(load).catch(error => { action.setError((error as Error).message); setLoaded(true); }); }, [load]);

  const filtered = users.filter(user => `${user.fullName} ${user.email} ${user.phone || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  async function create() {
    if (!fullName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Nhập họ tên và email hợp lệ.');
    const result = await api<{ user: Staff; emailSent: boolean; message: string }>('/users', 'POST', { fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), role: 'employee' });
    setFullName(''); setEmail(''); setPhone('');
    action.setNotice(result.message);
    await load();
  }
  async function changeStatus(user: Staff, status: 'Active' | 'Deactivated' | 'Banned') {
    const updated = await api<Staff>(`/users/${user._id}/status`, 'PATCH', { status, expectedStatus: user.status });
    setUsers(current => current.map(item => item._id === updated._id ? updated : item));
    action.setNotice(`Đã cập nhật trạng thái ${updated.fullName}.`);
  }
  return <Page>
    <BackButton disabled={action.busy} onPress={() => router.navigate('/workspace')} />
    <Eyebrow>ADMIN · NHÂN SỰ</Eyebrow><Heading>Quản lý nhân viên</Heading><Muted>Tạo tài khoản nhân viên và cập nhật trạng thái làm việc.</Muted>
    {!!action.error && <Text accessibilityRole="alert" style={s.error}>{action.error}</Text>}
    {!!action.notice && <Card><Text accessibilityLiveRegion="polite" style={s.title}>{action.notice}</Text></Card>}
    <Section title="Thêm nhân viên" />
    <Card><Field label="Họ và tên" value={fullName} onChangeText={setFullName} maxLength={100} autoComplete="name"/><Field label="Email đăng nhập" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254}/><Field label="Số điện thoại (không bắt buộc)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={16}/><Muted>Hệ thống tự tạo tài khoản chờ kích hoạt và gửi mật khẩu đăng nhập qua email.</Muted><Button busy={action.busy} title="Tạo nhân viên và gửi email" onPress={() => void action.run(create)}/></Card>
    <Section title="Danh sách nhân viên" detail={`${users.length} tài khoản`} />
    <Card><Field label="Tìm theo tên, email hoặc số điện thoại" value={query} onChangeText={setQuery} autoCapitalize="none"/><Button secondary busy={action.busy} title="Làm mới danh sách" onPress={() => action.run(load)}/></Card>
    {!loaded && <Card><Muted>Đang tải danh sách nhân viên…</Muted></Card>}
    {loaded && filtered.length === 0 && <Card><Muted>Không tìm thấy nhân viên phù hợp.</Muted></Card>}
    {filtered.map(user => <Card key={user._id}><View style={s.between}><View style={{flex:1,gap:5}}><Text style={s.title}>{user.fullName}</Text><Text style={s.muted}>{user.email}{user.phone ? ` · ${user.phone}` : ''}</Text></View><Badge tone={user.status === 'Active' ? 'green' : user.status === 'Banned' ? 'red' : 'gold'}>{statusName[user.status] || user.status}</Badge></View>
      {user.status.startsWith('Pending') ? <Muted>Nhân viên cần hoàn tất kích hoạt qua email trước khi được đăng nhập.</Muted> : <View style={{gap:10}}>{user.status === 'Active' ? <Button secondary disabled={action.busy} title="Tạm ngừng nhân viên" onPress={() => void action.run(() => changeStatus(user, 'Deactivated'))}/> : <Button disabled={action.busy} title="Kích hoạt nhân viên" onPress={() => void action.run(() => changeStatus(user, 'Active'))}/ >}{user.status !== 'Banned' && <Button secondary disabled={action.busy} title="Khóa tài khoản" onPress={() => void action.run(() => changeStatus(user, 'Banned'))}/>}</View>}
    </Card>)}
  </Page>;
}
