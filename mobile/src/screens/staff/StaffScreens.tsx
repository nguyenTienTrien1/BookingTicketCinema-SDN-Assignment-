import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { api, readDraft, writeDraft } from '../../services/api';
import { money } from '../../utils/format';
import { useSession } from '../../context/SessionContext';
import { useAction } from '../../utils/hooks';
import {
  Artwork,
  BackButton,
  Badge,
  Button,
  Card,
  Chip,
  Eyebrow,
  Field,
  Heading,
  Muted,
  Page,
  Section,
} from '../../components/ui';
import { colors, s } from '../../theme/index';
import { Icon, IconName } from '../../components/Icon';
import { Food } from '../../utils/types';
import { openExternal } from '../../services/browser';
import { appReturnUrl } from '../../services/appReturnUrl';
function Task({
  title,
  detail,
  icon,
  onPress,
  primary = false,
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48%',
        padding: 16,
        borderRadius: 20,
        gap: 11,
        borderWidth: 1,
        borderColor: primary ? '#8d314b' : colors.border,
        backgroundColor: primary ? '#3a1c2c' : colors.panel,
        opacity: pressed ? 0.75 : 1,
        minHeight: 152,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          backgroundColor: primary ? '#683047' : '#272a37',
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} color={primary ? colors.pink : '#c3c8d7'} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={[s.muted, { fontSize: 11, lineHeight: 17 }]}>{detail}</Text>
    </Pressable>
  );
}
export function Workspace() {
  const { user } = useSession();
  if (!user || user.role === 'member') return <Redirect href="/home" />;
  return (
    <Page>
      <Eyebrow>CINEMA+ · TÁC VỤ TẠI RẠP</Eyebrow>
      <Heading>Xin chào, {user.fullName.split(' ').pop()}</Heading>
      <Badge tone="green">
        {user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'} · Đang hoạt động
      </Badge>
      <Muted>Bắt đầu ca làm việc, phục vụ khách nhanh hơn.</Muted>
      {user.role === 'admin' && (
        <>
          <Section title="Quản trị danh mục" />
          <View style={s.wrap}>
            {(['movies', 'foods', 'promotions'] as const).map((kind) => (
              <Task
                key={kind}
                icon={kind === 'movies' ? 'film' : kind === 'foods' ? 'cart' : 'ticket'}
                title={
                  {
                    movies: 'Quản lý phim',
                    foods: 'Quản lý F&B',
                    promotions: 'Quản lý khuyến mãi',
                  }[kind]
                }
                detail={
                  {
                    movies: 'Thông tin, poster và phân loại phim',
                    foods: 'Sản phẩm, giá bán và tồn kho',
                    promotions: 'Mã ưu đãi và thời hạn áp dụng',
                  }[kind]
                }
                onPress={() => router.push({ pathname: '/catalogue/[kind]', params: { kind } })}
              />
            ))}
            <Task icon="seat" title="Quản lý phòng chiếu" detail="Thông tin phòng, sơ đồ và tình trạng ghế" onPress={()=>router.push('/rooms')}/>
            <Task
              icon="calendar"
              title="Quản lý suất chiếu"
              detail="Lịch chiếu, phòng, giá vé và thêm suất mới"
              onPress={() => router.push('/showtimes')}
            />
            <Task
              icon="wallet"
              title="Xem doanh thu"
              detail="Thống kê, bộ lọc và chi tiết theo kỳ"
              onPress={() => router.push('/revenue')}
            />
            <Task
              icon="user"
              title="Quản lý nhân viên"
              detail="Tạo tài khoản và cập nhật trạng thái nhân viên"
              onPress={() => router.push('/admin/accounts')}
            />
            <Task
              icon="star"
              title="Điều chỉnh điểm thành viên"
              detail="Cộng/trừ điểm, ghi lý do và xem lịch sử"
              onPress={() => router.push('/admin/member-points')}
            />
          </View>
        </>
      )}
      <Section title="Nghiệp vụ tại quầy" />
      <View style={s.wrap}>
        <Task
          primary
          icon="ticket"
          title="Bán vé tại quầy"
          detail="Chọn phim, giữ ghế và thu tiền"
          onPress={() => router.push('/staff/booking')}
        />
        {user.role === 'employee' && (
          <>
            <Task
              primary
              icon="cart"
              title="Bán riêng F&B"
              detail="Bắp nước, khuyến mãi và tiền mặt / VNPay"
              onPress={() => router.push('/staff/food-sales')}
            />
            <Task
              icon="qr"
              title="Quét QR / Check-in vé"
              detail="Kiểm tra vé và xác nhận vào rạp"
              onPress={() => router.push('/staff/check-in')}
            />
          </>
        )}
        <Task
          icon="wallet"
          title="Thu tiền & đối soát"
          detail="Tra cứu đơn và xử lý khoản thu"
          onPress={() => router.push('/staff/reconciliation')}
        />
        <Task
          icon="user"
          title="Tra cứu thành viên"
          detail="Tìm khách và kiểm tra điểm"
          onPress={() => router.push('/staff/members')}
        />
      </View>
    </Page>
  );
}

export function FoodSales() {
  // quantities là giỏ tạm trên máy; sale là đơn và tổng tiền chính thức từ backend.
  const { user } = useSession(),
    [foods, setFoods] = useState<Food[]>([]),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [sale, setSale] = useState<any>(null),
    [cash, setCash] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [enabled, setEnabled] = useState(false),
    [ready, setReady] = useState(false),
    [search, setSearch] = useState('');
  const [method, setMethod] = useState<'cash' | 'vnpay'>('cash');
  const [code, setCode] = useState('');
  const [promotions, setPromotions] = useState<{ _id: string; code: string; value: number; discountType: string }[]>([]);
  const [promotionError, setPromotionError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const a = useAction(),
    request = useRef<string>('');
  // Mỗi nhân viên lưu riêng ID đơn đang xử lý để khôi phục khi quay lại ứng dụng.
  const key = 'cinema.foodsale.' + user?._id;
  function newRequest() {
    // Giữ nguyên requestId khi gửi lại cùng giỏ để backend tránh tạo trùng đơn.
    request.current = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
  async function load() {
    // Lấy danh mục mới nhất rồi khôi phục đơn đã lưu, nếu có.
    setReady(false);
    try {
      const data = await api('/food-sales/catalogue');
      setFoods(data.foods);
      setEnabled(data.paymentsEnabled);
      const id = await readDraft(key);
      if (id) {
        const order = await api('/food-sales/' + id);
        setSale(order); setCode(order.promotion?.code || '');
        setMethod(order.paymentMethod === 'vnpay' ? 'vnpay' : 'cash');
      }
      setUncertain(false);
      setReady(true);
    } catch (e) {
      a.setError((e as Error).message);
    }
  }
  useEffect(() => {
    newRequest();
    void Promise.resolve().then(load);
  }, []);
  useEffect(() => {
    let active = true;
    api('/promotions?scope=food').then(data => { if (active) setPromotions(data); })
      .catch(() => { if (active) setPromotionError('Chưa tải được mã gợi ý. Bạn vẫn có thể nhập mã.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && sale?._id && !a.busy) void refresh().catch(e => a.setError((e as Error).message));
    });
    return () => listener.remove();
  }, [sale?._id, a.busy]);
  const onlinePending = sale?.onlinePayment?.status === 'created';
  const codeDirty = code.trim().toUpperCase() !== (sale?.promotion?.code || '');
  const canChangeCode = sale?.status === 'pending' && !sale?.onlinePayment?.ref && !uncertain;
  // Tạm tính để hiển thị; khi tạo đơn, backend tự đọc giá và tính tổng lại.
  const total = foods.reduce((sum, f) => sum + f.price * (quantities[f._id] || 0), 0),
    validCash =
      /^\d+$/.test(cash) &&
      Number.isSafeInteger(Number(cash)) &&
      Number(cash) >= (sale?.total || 0);
  async function refresh() {
    // Dùng cả khi thanh toán lỗi mạng để biết backend đã hoàn tất hay chưa.
    if (sale) {
      const order = await api('/food-sales/' + sale._id);
      setSale(order); setUncertain(false);
      if (order.total !== sale.total) { setCash(''); setConfirmed(false); }
      if (order.onlinePayment?.ref) setCode(order.promotion?.code || '');
      if (order.onlinePayment?.status === 'created') setMethod('vnpay');
    }
  }
  async function applyPromotion(value: string) {
    setSale(await api(`/food-sales/${sale._id}/promotion`, 'PATCH', { code: value.trim() }));
    setCode(value.trim().toUpperCase()); setCash(''); setConfirmed(false);
  }
  async function onlinePay() {
    if (codeDirty) throw new Error('Áp dụng mã hoặc hủy thay đổi mã trước khi thanh toán.');
    setUncertain(true);
    try {
      const result = await api(`/food-sales/${sale._id}/vnpay`, 'POST', { mobileReturnTo: appReturnUrl('/payment-return') });
      await refresh();
      await openExternal(result.paymentUrl);
      await refresh();
    } catch (e) {
      await refresh().catch(() => {});
      throw e;
    }
  }
  function quantity(food: Food, delta: number) {
    // Số lượng nằm trong [0, min(tồn kho, 100)]; đổi giỏ thì tạo requestId mới.
    setQuantities((q) => ({
      ...q,
      [food._id]: Math.max(0, Math.min(food.stock, 100, (q[food._id] || 0) + delta)),
    }));
    newRequest();
  }
  return (
    <Page>
      <BackButton disabled={a.busy} onPress={() => router.navigate('/workspace')} />
      <Heading>Quầy bắp & nước</Heading>
      <Muted>Bán riêng F&B · Tiền mặt hoặc VNPay</Muted>
      {!!a.error && (
        <Text accessibilityRole="alert" style={s.error}>
          {a.error}
        </Text>
      )}
      {!ready && (
        <Button
          secondary
          busy={a.busy}
          title="Tải lại quầy và đơn đang xử lý"
          onPress={() => a.run(load)}
        />
      )}
      {ready && !sale && (
        <>
          <Field label="Tìm món" value={search} onChangeText={setSearch} />
          {foods
            .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
            .map((food) => (
              <Card key={food._id}>
                <View style={s.row}>
                  <View style={{ width: 65 }}>
                    <Artwork uri={food.image} square />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{food.name}</Text>
                    <Muted>
                      {money(food.price)} · Còn {food.stock}
                    </Muted>
                  </View>
                </View>
                <View style={s.row}>
                  <Button
                    secondary
                    disabled={a.busy || !quantities[food._id]}
                    title="−"
                    onPress={() => quantity(food, -1)}
                  />
                  <Text style={s.title}>{quantities[food._id] || 0}</Text>
                  <Button
                    disabled={a.busy || (quantities[food._id] || 0) >= Math.min(food.stock, 100)}
                    title="+"
                    onPress={() => quantity(food, 1)}
                  />
                </View>
              </Card>
            ))}
          <Card>
            <Heading>{money(total)}</Heading>
            <Button
              busy={a.busy}
              disabled={!total}
              title="Xác nhận đơn F&B"
              onPress={() =>
                a.run(async () => {
                  // Chỉ gửi ID và số lượng, không dùng giá từ điện thoại làm giá thanh toán.
                  const result = await api('/food-sales', 'POST', {
                    requestId: request.current,
                    items: foods
                      .filter((f) => quantities[f._id] > 0)
                      .map((f) => ({ food: f._id, quantity: quantities[f._id] })),
                  });
                  // Lưu ID trước khi chuyển sang nhận tiền để có thể khôi phục đơn.
                  await writeDraft(key, result._id);
                  setSale(result);
                  setCode(''); setMethod('cash'); setUncertain(false);
                })
              }
            />
          </Card>
        </>
      )}
      {sale && (
        <Card>
          <Text selectable style={s.muted}>
            Mã đơn {sale._id}
          </Text>
          <Heading>
            {{
              pending: 'Chờ thanh toán',
              payment_received: 'Đã nhận tiền',
              paid: 'Hoàn tất',
              cancelled: 'Đã hủy',
              reconciliation: 'Cần đối soát',
              returned: 'Đã trả tiền',
            }[sale.status as string] || sale.status}
          </Heading>
          {sale.items.map((item: any) => (
            <Text key={item.food} style={s.title}>
              {item.name} × {item.quantity} · {money(item.unitPrice * item.quantity)}
            </Text>
          ))}
          <View style={{ gap: 10, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={s.between}><Muted>Tạm tính</Muted><Text style={s.title}>{money(sale.subtotal ?? sale.total)}</Text></View>
            {!!sale.promotionDiscount && <View style={s.between}><Muted>Mã {sale.promotion?.code}</Muted><Text style={{ color: colors.pink }}>−{money(sale.promotionDiscount)}</Text></View>}
            <View style={s.between}><Text style={s.title}>Tổng thanh toán</Text><Heading>{money(sale.total)}</Heading></View>
          </View>
          {canChangeCode && <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
            <Heading>Khuyến mãi F&B</Heading>
            <Field label="Mã khuyến mãi" value={code} editable={!a.busy} maxLength={40} autoCapitalize="characters" autoCorrect={false} onChangeText={setCode} />
            {!!promotions.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {promotions.map(item => <Chip key={item._id} title={`${item.code} · ${item.discountType === 'percentage' ? item.value + '%' : money(item.value)}`} selected={code.trim().toUpperCase() === item.code} disabled={a.busy} onPress={() => setCode(item.code)} />)}
            </ScrollView>}
            {!!promotionError && <Muted>{promotionError}</Muted>}
            <View style={s.wrap}><Button secondary busy={a.busy} disabled={!code.trim()} title="Áp dụng mã" onPress={() => a.run(() => applyPromotion(code))} />
              {!!sale.promotion && <Button secondary disabled={a.busy} title="Bỏ mã khuyến mãi" onPress={() => a.run(() => applyPromotion(''))} />}
              {codeDirty && <Button secondary disabled={a.busy} title="Hủy thay đổi mã" onPress={() => setCode(sale.promotion?.code || '')} />}
            </View>
            <Muted>Mỗi đơn dùng một mã dành cho F&B hoặc toàn đơn.</Muted>
          </View>}
          {sale.status === 'pending' && (
            <>
              <Heading>Phương thức thanh toán</Heading>
              <View style={s.wrap}>
                <Chip title="Tiền mặt" selected={method === 'cash' && !onlinePending} disabled={a.busy || onlinePending || uncertain} onPress={() => { setMethod('cash'); setConfirmed(false); }} />
                <Chip title="VNPay" selected={method === 'vnpay' || onlinePending} disabled={a.busy || onlinePending || uncertain || sale.total === 0} onPress={() => { setMethod('vnpay'); setConfirmed(false); }} />
              </View>
              {!enabled && <Muted>Thanh toán chưa sẵn sàng. Chưa thu tiền khách.</Muted>}
              {uncertain && <Muted>Chưa xác định kết quả yêu cầu. Kiểm tra trạng thái trước khi thanh toán tiếp.</Muted>}
              {(method === 'vnpay' || onlinePending) && sale.total > 0 ? <>
                <Muted>{onlinePending ? 'Đang chờ kết quả VNPay. Không thu tiền mặt hoặc đổi mã.' : 'Mở VNPay để thanh toán, sau đó quay lại app kiểm tra hóa đơn.'}</Muted>
                {sale.onlinePayment?.status === 'failed' && <Muted>VNPay báo giao dịch chưa thành công. Có thể thử lại hoặc chọn tiền mặt.</Muted>}
                <Button busy={a.busy} disabled={!enabled || codeDirty || uncertain} title={onlinePending ? 'Mở lại VNPay' : 'Thanh toán bằng VNPay'} onPress={() => a.run(onlinePay)} />
              </> : <>
              <Field
                label="Tiền khách đưa (VND)"
                keyboardType="number-pad"
                value={cash}
                editable={!a.busy && !uncertain && enabled}
                onChangeText={(v) => {
                  setCash(v);
                  setConfirmed(false);
                }}
              />
              <View style={s.wrap}>
                {[
                  sale.total,
                  Math.ceil(sale.total / 50000) * 50000,
                  Math.ceil(sale.total / 100000) * 100000,
                ]
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .map((value) => (
                    <Button
                      key={value}
                      secondary
                      disabled={a.busy || uncertain || !enabled}
                      title={money(value)}
                      onPress={() => {
                        setCash(String(value));
                        setConfirmed(false);
                      }}
                    />
                  ))}
              </View>
              <Text style={s.title}>
                {validCash
                  ? 'Tiền thừa: ' + money(Number(cash) - sale.total)
                  : 'Nhập số tiền không nhỏ hơn tổng đơn.'}
              </Text>
              <Button
                secondary={!confirmed}
                disabled={a.busy || uncertain || !enabled || !validCash}
                title={confirmed ? '✓ Đã nhận đủ tiền mặt' : 'Tôi đã nhận đủ tiền mặt'}
                onPress={() => setConfirmed(!confirmed)}
              />
              <Button
                busy={a.busy}
                disabled={!enabled || !validCash || !confirmed || uncertain || codeDirty}
                title="Hoàn tất & xuất hóa đơn"
                onPress={() =>
                  a.run(async () => {
                    try {
                      // Backend ghi nhận khoản thu rồi trừ kho/hoàn tất; mobile không tự đánh dấu paid.
                      setSale(
                        await api(`/food-sales/${sale._id}/pay`, 'POST', {
                          paymentMethod: 'cash',
                          confirmedTotal: sale.total,
                          cashReceived: Number(cash),
                          paymentConfirmed: true,
                        }),
                      );
                    } catch (e) {
                      // Request lỗi không đồng nghĩa chưa thu tiền: đọc trạng thái trước khi báo lỗi.
                      await refresh().catch(() => {});
                      throw e;
                    }
                  })
                }
              />
              </>}
              <Button
                secondary
                busy={a.busy}
                disabled={onlinePending || uncertain}
                title="Hủy đơn chưa thu tiền"
                onPress={() =>
                  a.run(async () =>
                    setSale(await api(`/food-sales/${sale._id}/cancel`, 'POST', {})),
                  )
                }
              />
            </>
          )}
          {['payment_received', 'reconciliation'].includes(sale.status) && (
            <>
              <Muted>Không thu tiền lần nữa. Kiểm tra khoản đã nhận tại màn đối soát.</Muted>
              <Button
                title="Mở đối soát"
                onPress={() =>
                  router.push({ pathname: '/staff/reconciliation', params: { order: sale._id } })
                }
              />
            </>
          )}
          {sale.cashReceived != null && (
            <Muted>
              Khách đưa {money(sale.cashReceived)} · Tiền thừa {money(sale.change)}
            </Muted>
          )}
          {sale.paymentMethod === 'vnpay' && <Muted>Phương thức: VNPay{sale.onlinePayment?.providerRef ? ' · Mã giao dịch: ' + sale.onlinePayment.providerRef : ''}</Muted>}
          <Button
            secondary
            busy={a.busy}
            title="Kiểm tra trạng thái đơn"
            onPress={() => a.run(refresh)}
          />
          {['paid', 'cancelled', 'returned'].includes(sale.status) && (
            <Button
              title="Tạo đơn mới"
              onPress={() =>
                a.run(async () => {
                  await writeDraft(key, null);
                  setSale(null);
                  setQuantities({});
                  setCash('');
                  setConfirmed(false);
                  setCode(''); setMethod('cash'); setUncertain(false);
                  newRequest();
                  await load();
                })
              }
            />
          )}
        </Card>
      )}
    </Page>
  );
}

export { default as MemberLookup } from './MemberLookup';
export { default as CheckIn } from './TicketCheckIn';
