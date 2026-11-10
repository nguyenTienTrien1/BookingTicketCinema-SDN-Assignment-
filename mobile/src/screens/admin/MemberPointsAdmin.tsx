import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackButton, Button, Card, Eyebrow, Field, Heading, Muted, Page, Section } from '../../components/ui';
import { api } from '../../services/api';
import { useAction } from '../../utils/hooks';
import { s } from '../../theme';

type Member = { _id: string; fullName: string; email: string; phone?: string; role: string; memberPoints: number };
type Entry = { requestId: string; delta: number; before: number; after: number; reason: string; createdAt: string; admin?: { fullName?: string } };
type History = { balance: number; entries: Entry[] };
const number = (value: number) => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const requestId = () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

export default function MemberPointsAdmin() {
  const [users, setUsers] = useState<Member[]>([]), [selectedId, setSelectedId] = useState(''), [query, setQuery] = useState('');
  const [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [direction, setDirection] = useState<1 | -1>(1);
  const [history, setHistory] = useState<History | null>(null), [loaded, setLoaded] = useState(false);
  const action = useAction();
  const selected = users.find(user => user._id === selectedId);
  const load = useCallback(async () => { const result = await api<Member[]>('/users'); setUsers(result.filter(user => user.role === 'member')); setLoaded(true); }, []);
  useEffect(() => { void Promise.resolve().then(load).catch(error => { action.setError((error as Error).message); setLoaded(true); }); }, [load]);
  const filtered = users.filter(user => `${user.fullName} ${user.email} ${user.phone || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  async function select(member: Member) {
    setSelectedId(member._id); setHistory(null); setAmount(''); setReason(''); action.setError(''); action.setNotice('');
    const result = await api<History>(`/users/${member._id}/points-history`);
    setHistory(result); setUsers(current => current.map(user => user._id === member._id ? { ...user, memberPoints: result.balance } : user));
  }
  async function save() {
    if (!selected || !history) throw new Error('Chọn thành viên và tải số dư trước.');
    const points = Number(amount) * direction;
    if (!/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount)) || Number(amount) < 1) throw new Error('Số điểm phải là số nguyên dương.');
    if (reason.trim().length < 5 || reason.trim().length > 500) throw new Error('Lý do cần từ 5 đến 500 ký tự.');
    if (history.balance + points < 0) throw new Error('Không thể trừ nhiều hơn số điểm hiện có.');
    const result = await api<Member>(`/users/${selected._id}/points`, 'PATCH', { points, reason: reason.trim(), expectedBalance: history.balance, requestId: requestId() });
    setUsers(current => current.map(user => user._id === result._id ? result : user));
    setAmount(''); setReason(''); action.setNotice(`Đã ${points > 0 ? 'cộng' : 'trừ'} ${number(Math.abs(points))} điểm cho ${result.fullName}.`);
    setHistory(await api<History>(`/users/${selected._id}/points-history`));
  }
  const amountNumber = Number(amount || 0), after = (history?.balance || 0) + amountNumber * direction;
  return <Page>
    <BackButton disabled={action.busy} onPress={() => router.navigate('/workspace')} />
    <Eyebrow>ADMIN · THÀNH VIÊN</Eyebrow><Heading>Điều chỉnh điểm thưởng</Heading><Muted>Cộng hoặc trừ điểm có ghi lý do và lịch sử người thực hiện.</Muted>
    {!!action.error && <Text accessibilityRole="alert" style={s.error}>{action.error}</Text>}
    {!!action.notice && <Card><Text accessibilityLiveRegion="polite" style={s.title}>{action.notice}</Text></Card>}
    <Section title="Chọn tài khoản thành viên" detail={`${users.length} thành viên`} />
    <Card><Field label="Tìm thành viên" value={query} onChangeText={setQuery} autoCapitalize="none" placeholder="Tên, email hoặc số điện thoại"/><Button secondary busy={action.busy} title="Làm mới danh sách" onPress={() => action.run(load)}/></Card>
    {!loaded && <Card><Muted>Đang tải danh sách thành viên…</Muted></Card>}
    {filtered.map(member => <Button key={member._id} secondary={!selectedId || selectedId !== member._id} disabled={action.busy} title={`${member.fullName} · ${member.email} · ${number(member.memberPoints)} điểm`} onPress={() => void action.run(() => select(member))}/>)}
    {loaded && filtered.length === 0 && <Card><Muted>Không tìm thấy thành viên phù hợp.</Muted></Card>}
    {selected && history && <>
      <Section title={selected.fullName} detail={selected.email}/>
      <Card><Heading>{number(history.balance)} điểm</Heading><Muted>Số dư hiện tại</Muted>
        <View style={s.wrap}><Button secondary={direction === 1} title="Cộng điểm" onPress={() => setDirection(1)}/><Button secondary={direction === -1} title="Trừ điểm" onPress={() => setDirection(-1)}/></View>
        <Field label={`Số điểm ${direction === 1 ? 'cộng' : 'trừ'}`} value={amount} onChangeText={value => { if (/^\d*$/.test(value)) setAmount(value); }} keyboardType="number-pad"/>
        <Field label="Lý do điều chỉnh" value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Ghi rõ lý do để tra cứu sau này"/>
        <Muted>Số dư sau điều chỉnh: {amount && after >= 0 ? `${number(after)} điểm` : '—'}</Muted>
        <Button busy={action.busy} disabled={!amount || !reason.trim() || reason.trim().length < 5 || (direction < 0 && amountNumber > history.balance)} title={`Xác nhận ${direction === 1 ? 'cộng' : 'trừ'} điểm`} onPress={() => void action.run(save)}/>
      </Card>
      <Section title="Lịch sử điều chỉnh" detail="20 lần gần nhất" />
      {!history.entries.length && <Card><Muted>Chưa có điều chỉnh thủ công.</Muted></Card>}
      {history.entries.map(entry => <Card key={entry.requestId}><View style={s.between}><Text style={[s.title,{color:entry.delta > 0 ? '#a8e6b4' : '#ff9fab'}]}>{entry.delta > 0 ? '+' : '−'}{number(Math.abs(entry.delta))} điểm</Text><Text style={s.muted}>{new Date(entry.createdAt).toLocaleString('vi-VN')}</Text></View><Text style={s.label}>{entry.reason}</Text><Muted>{number(entry.before)} → {number(entry.after)} điểm · {entry.admin?.fullName || 'Admin'}</Muted></Card>)}
    </>}
  </Page>;
}
