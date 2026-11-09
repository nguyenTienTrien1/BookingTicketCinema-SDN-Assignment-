import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, money, statusText } from '../api';
import { useAction } from '../hooks';
import { BackButton, Button, Card, Chip, ConfirmButton, Field, Heading, Muted, Page, s } from '../ui';

export default function Reconciliation() {
  const params = useLocalSearchParams<{ order?: string; section?: string }>();
  const [section, setSection] = useState(params.section === 'reconciliation' ? 'reconciliation' : 'payment');
  const [id, setId] = useState(params.order || ''), [found, setFound] = useState<any>(null);
  const [foods, setFoods] = useState<any[]>([]), [receipts, setReceipts] = useState<any[]>([]), [refunds, setRefunds] = useState<any[]>([]);
  const [ready, setReady] = useState(false), [notes, setNotes] = useState<Record<string, string>>({});
  const a = useAction();
  async function load() {
    setReady(false);
    const [f, r, p] = await Promise.all([api('/payments/food-sales/reconciliation'), api('/payments/reconciliation'), api('/payments/refunds')]);
    setFoods(f); setReceipts(r); setRefunds(p); setReady(true);
  }
  async function lookup(value = id) {
    setFound(null);
    if (!/^[a-fA-F0-9]{24}$/.test(value.trim())) throw new Error('Mã đơn gồm 24 ký tự chữ số và chữ cái a–f.');
    setFound(await api('/payments/orders/' + encodeURIComponent(value.trim())));
  }
  useEffect(() => {
    void a.run(async () => {
      await load();
      if (params.order) { setId(params.order); await lookup(params.order); }
      setSection(params.section === 'reconciliation' ? 'reconciliation' : 'payment');
    });
  }, [params.order, params.section]);
  async function resolve(item: any, type: 'food' | 'ticket', action: string) {
    const key = type === 'food' ? item._id : item.ref, reason = (notes[key] || '').trim();
    if (reason.length < 3) throw new Error('Nhập lý do tối thiểu 3 ký tự.');
    const result = await api(type === 'food' ? '/payments/food-sales/' + item._id + '/reconciliation' : '/payments/reconciliation/' + item.ref, 'POST', {
      action, reason, returnedAmount: action === 'cash-returned' ? (type === 'food' ? item.total : item.amount) : undefined
    });
    a.setNotice(result.message || 'Đã xử lý.'); await load(); if (found) await lookup();
  }
  function controls(item: any, type: 'food' | 'ticket') {
    const key = type === 'food' ? item._id : item.ref;
    const verified = type === 'food' || (!!item.collectedAt && (item.method === 'cash' || !!item.providerRef));
    return <>
      <Field label="Lý do đối soát" value={notes[key] || ''} maxLength={500} editable={!a.busy} onChangeText={value => setNotes(current => ({ ...current, [key]: value }))} />
      <Button secondary busy={a.busy} title="Lưu ghi chú đối soát" onPress={() => a.run(() => resolve(item, type, 'note'))} />
      <ConfirmButton disabled={a.busy || !verified} title="Thử hoàn tất khoản đã thu" message="Không thu thêm tiền. Hệ thống kiểm tra lại điều kiện trước khi hoàn tất." onConfirm={() => a.run(() => resolve(item, type, 'retry'))} />
      {(type === 'food' || (item.method === 'cash' && !item.booking?.user)) && <ConfirmButton disabled={a.busy || !verified} title="Ghi nhận đã trả tiền khách" message={'Chỉ xác nhận sau khi đã trả lại khoản thực thu ' + money(type === 'food' ? item.total : item.amount) + '; không trả tiền thừa lần nữa.'} onConfirm={() => a.run(() => resolve(item, type, 'cash-returned'))} />}
      {type === 'ticket' && !!item.booking?.user && <ConfirmButton disabled={a.busy || !verified} title="Hoàn 100% về điểm" message="Hoàn khoản thu đã xác minh về điểm thành viên; không hoàn thêm tiền mặt/VNPay." onConfirm={() => a.run(() => resolve(item, type, 'refund-points'))} />}
    </>;
  }
  return <Page><BackButton disabled={a.busy} onPress={() => router.navigate('/workspace')} /><Heading>Thu tiền & đối soát</Heading>
    <Muted>Tra cứu đơn vé và F&B. Kiểm tra khoản đã thu trước khi xử lý.</Muted>
    <View style={s.wrap}><Chip title="Thu tiền" selected={section === 'payment'} disabled={a.busy} onPress={() => setSection('payment')} /><Chip title="Đối soát" selected={section === 'reconciliation'} disabled={a.busy} onPress={() => setSection('reconciliation')} /></View>
    {!!a.error && <Text accessibilityRole="alert" style={s.error}>{a.error}</Text>}{!!a.notice && <Muted>{a.notice}</Muted>}
    {section === 'payment' ? <Card><Heading>Tra cứu đơn cần thanh toán</Heading>
      <Field label="Mã đơn vé hoặc F&B" value={id} editable={!a.busy} maxLength={24} onChangeText={value => { setId(value.trim()); setFound(null); }} autoCapitalize="none" />
      <Button busy={a.busy} disabled={!/^[a-fA-F0-9]{24}$/.test(id)} title="Tra cứu đơn" onPress={() => a.run(() => lookup())} />
      {found && <><Text style={s.title}>{found.type === 'food-sale' ? 'Đơn F&B' : 'Đơn vé'} · {statusText(found.order.status)}</Text><Heading>{money(found.order.total)}</Heading><Text selectable style={s.muted}>{found.order._id}</Text>
        {found.type === 'booking' ? <Button title="Mở đơn & thu tiền" onPress={() => router.push({ pathname: '/order/[id]', params: { id: found.order._id, collection: 'true' } })} /> : <>
          {found.order.items?.map((item: any, index: number) => <Muted key={index}>{item.name} × {item.quantity} · {money(item.unitPrice * item.quantity)}</Muted>)}
          <Muted>Khách đưa {money(found.order.cashReceived)} · Tiền thừa {money(found.order.change)}</Muted>
          {['payment_received', 'reconciliation'].includes(found.order.status) && <Button secondary title="Đối soát đơn F&B" onPress={() => setSection('reconciliation')} />}
        </>}
      </>}
    </Card> : <>
      <Card><Muted>Vé cần đối soát: {ready ? receipts.length : '…'}</Muted><Muted>F&B cần đối soát: {ready ? foods.length : '…'}</Muted><Muted>Hoàn điểm chờ xử lý: {ready ? refunds.length : '…'}</Muted></Card>
      <Button secondary busy={a.busy} title="Tải lại danh sách đối soát" onPress={() => a.run(load)} />
      {!ready && <Muted>Chưa tải xong danh sách đối soát.</Muted>}
      {ready && <><Heading>Đối soát thanh toán vé</Heading>{!receipts.length && <Muted>Không có khoản thu đang chờ đối soát.</Muted>}{receipts.map(item => <Card key={item.ref}><Text selectable style={s.title}>{item.ref} · {item.method}</Text><Muted>Mã đơn: {item.booking?._id}</Muted><Heading>{money(item.amount)}</Heading><Muted>{item.message || 'Khoản thu chưa hoàn tất.'}</Muted>{item.receivedAmount != null && <Muted>Khách đưa: {money(item.receivedAmount)} · Tiền thừa đã trả: {money(item.change)}</Muted>}{controls(item, 'ticket')}</Card>)}
        <Heading>Đối soát F&B</Heading>{!foods.length && <Muted>Không có đơn F&B cần đối soát.</Muted>}{foods.map(item => <Card key={item._id}><Text selectable style={s.title}>{item._id}</Text><Heading>{money(item.total)}</Heading><Muted>{item.issue || 'Khoản đã nhận chưa hoàn tất.'}</Muted>{controls(item, 'food')}</Card>)}
        <Heading>Đối soát hoàn điểm</Heading>{!refunds.length && <Muted>Không có yêu cầu hoàn điểm bị lỗi.</Muted>}{refunds.map(item => <Card key={item.reference}><Text selectable style={s.title}>{item.reference}</Text><Muted>{item.user?.fullName} · {item.status} · {item.points} điểm</Muted><ConfirmButton title="Thử lại cộng điểm" disabled={a.busy} message="Máy chủ xử lý lại yêu cầu hoàn điểm hiện có, không tạo khoản hoàn mới." onConfirm={() => a.run(async () => { const result = await api('/payments/refunds/' + item.reference + '/retry', 'POST', {}); a.setNotice(result.refund.status === 'completed' ? 'Đã hoàn điểm.' : 'Yêu cầu vẫn chờ xử lý.'); await load(); })} /></Card>)}
      </>}
    </>}
  </Page>;
}
