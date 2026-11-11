import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
              detail="Bắp, nước và thanh toán tiền mặt"
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
      if (id) setSale(await api('/food-sales/' + id));
      setReady(true);
    } catch (e) {
      a.setError((e as Error).message);
    }
  }
  useEffect(() => {
    newRequest();
    void Promise.resolve().then(load);
  }, []);
  // Tạm tính để hiển thị; khi tạo đơn, backend tự đọc giá và tính tổng lại.
  const total = foods.reduce((sum, f) => sum + f.price * (quantities[f._id] || 0), 0),
    validCash =
      /^\d+$/.test(cash) &&
      Number.isSafeInteger(Number(cash)) &&
      Number(cash) >= (sale?.total || 0);
  async function refresh() {
    // Dùng cả khi thanh toán lỗi mạng để biết backend đã hoàn tất hay chưa.
    if (sale) setSale(await api('/food-sales/' + sale._id));
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
      <Muted>Bán riêng F&B · Thanh toán tiền mặt</Muted>
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
              pending: 'Chờ nhận tiền',
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
          <Heading>{money(sale.total)}</Heading>
          {sale.status === 'pending' && (
            <>
              <Field
                label="Tiền khách đưa (VND)"
                keyboardType="number-pad"
                value={cash}
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
                title={confirmed ? '✓ Đã nhận đủ tiền mặt' : 'Tôi đã nhận đủ tiền mặt'}
                onPress={() => setConfirmed(!confirmed)}
              />
              <Button
                busy={a.busy}
                disabled={!enabled || !validCash || !confirmed}
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
              <Button
                secondary
                busy={a.busy}
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
