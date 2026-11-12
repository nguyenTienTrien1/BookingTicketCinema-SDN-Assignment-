import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { useAction } from '../../utils/hooks';
import { money } from '../../utils/format';
import {
  Artwork,
  Badge,
  Button,
  Chip,
  ConfirmButton,
  Eyebrow,
  Heading,
  Muted,
  Page,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, s } from '../../theme';

type Kind = 'movies' | 'foods' | 'promotions';
const names = { movies: 'phim', foods: 'F&B', promotions: 'khuyến mãi' };
const placeholders = {
  movies: 'Tìm tên phim…',
  foods: 'Tìm tên sản phẩm…',
  promotions: 'Tìm mã hoặc tên khuyến mãi…',
};
const dateVN = (value: string) =>
  new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
// Nhãn phục vụ hiển thị; backend kiểm tra lại hiệu lực khi khách áp dụng mã.
function promotionStatus(item: any): { title: string; tone: 'neutral' | 'green' | 'gold' | 'red' } {
  if (!item.active) return { title: 'Tạm tắt', tone: 'neutral' };
  if (Date.now() >= new Date(item.endsAt).getTime()) return { title: 'Hết hạn', tone: 'red' };
  if (item.usageLimit != null && item.usedCount >= item.usageLimit)
    return { title: 'Hết lượt', tone: 'red' };
  if (Date.now() < new Date(item.startsAt).getTime()) return { title: 'Sắp chạy', tone: 'gold' };
  return { title: 'Đang hiệu lực', tone: 'green' };
}

export default function CatalogueList() {
  // Route truyền kind để một màn hình phục vụ cả phim, F&B và khuyến mãi.
  const { kind: raw } = useLocalSearchParams<{ kind: string }>();
  const kind = ['movies', 'foods', 'promotions'].includes(raw) ? (raw as Kind) : null;
  const { user } = useSession(),
    insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]),
    [search, setSearch] = useState('');
  const [filter, setFilter] = useState(''),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState(''),
    [menu, setMenu] = useState<any>(null),
    [focused, setFocused] = useState(false);
  // search là chữ đang gõ; query chỉ đổi khi xác nhận tìm kiếm.
  // request đánh số lần tải để bỏ qua kết quả cũ trả về muộn.
  const query = useRef(''),
    request = useRef(0),
    a = useAction();

  const load = useCallback(async () => {
    if (!kind) return;
    const sequence = ++request.current;
    const q = new URLSearchParams({ page: String(page), limit: '10', search: query.current });
    if (filter)
      q.set(
        kind === 'movies' ? 'classification' : kind === 'foods' ? 'stockState' : 'status',
        filter,
      );
    const result = await api(`/${kind}/admin?${q}`);
    // Không ghi đè danh sách nếu đã có request mới hoặc màn hình đã mất focus.
    if (sequence !== request.current) return;
    setItems(kind === 'movies' ? result.movies : result.items);
    setPages(result.totalPages);
    setTotal(result.total);
  }, [kind, page, filter]);
  // Quay lại từ form thêm/sửa cũng tải lại; cleanup vô hiệu hóa request đang chờ.
  useFocusEffect(
    useCallback(() => {
      void a.run(load);
      return () => {
        request.current++;
      };
    }, [load]),
  );

  if (!kind || user?.role !== 'admin') return <Redirect href="/workspace" />;
  const filters: string[][] =
    kind === 'movies'
      ? [['', 'Tất cả'], ...['P', 'K', 'T13', 'T16', 'T18', 'C'].map((v) => [v, v])]
      : kind === 'foods'
        ? [
            ['', 'Tất cả'],
            ['in-stock', 'Còn hàng'],
            ['low', 'Sắp hết'],
            ['out-of-stock', 'Hết hàng'],
          ]
        : [
            ['', 'Tất cả'],
            ['current', 'Hiệu lực'],
            ['future', 'Sắp chạy'],
            ['expired', 'Hết hạn'],
            ['exhausted', 'Hết lượt'],
            ['paused', 'Tạm tắt'],
          ];
  function find(value = search) {
    // Tìm kiếm mới luôn bắt đầu từ trang 1; không gọi API theo từng ký tự.
    Keyboard.dismiss();
    query.current = value.trim();
    if (page !== 1) setPage(1);
    else void a.run(load);
  }
  function edit(id: string) {
    // Thêm và sửa dùng chung route, khác nhau ở id ('new' hoặc ID bản ghi).
    setMenu(null);
    router.push({ pathname: '/catalogue/edit', params: { kind: kind!, id } });
  }

  return (
    <>
      <Page>
        <View style={{ gap: 10 }}>
          <Eyebrow>CINEMA+ / ADMIN</Eyebrow>
          <View style={[s.between, { flexWrap: 'wrap' }]}>
            <View style={{ flexShrink: 1 }}>
              <Heading>Quản lý {names[kind]}</Heading>
            </View>
            <Button
              icon="plus"
              title="Thêm mới"
              accessibilityLabel={`Thêm ${names[kind]}`}
              onPress={() => edit('new')}
            />
          </View>
          <Muted>
            {
              {
                movies: 'Thông tin, poster và lịch phát hành.',
                foods: 'Giá bán, tồn kho và trạng thái sản phẩm.',
                promotions: 'Mức giảm, thời hạn và lượt sử dụng.',
              }[kind]
            }
          </Muted>
        </View>
        <View style={[s.inputShell, focused && { borderColor: colors.pink }]}>
          <Icon name="search" size={19} />
          <TextInput
            accessibilityLabel="Tìm kiếm"
            placeholder={placeholders[kind]}
            placeholderTextColor="#8790a4"
            value={search}
            onChangeText={setSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => find()}
            returnKeyType="search"
            autoCapitalize="none"
            style={s.input}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa tìm kiếm"
              disabled={a.busy}
              style={c.iconButton}
              onPress={() => {
                setSearch('');
                find('');
              }}
            >
              <Icon name="close" size={17} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tìm kiếm danh sách"
            disabled={a.busy}
            style={c.iconButton}
            onPress={() => find()}
          >
            {a.busy ? (
              <ActivityIndicator color={colors.pink} size="small" />
            ) : (
              <Icon name="arrow" size={20} color={colors.pink} />
            )}
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {filters.map(([value, title]) => (
            <Chip
              key={value}
              selected={filter === value}
              disabled={a.busy}
              title={title}
              onPress={() => {
                setFilter(value);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
        <View style={s.between}>
          <Muted>
            {total} {kind === 'movies' ? 'phim' : kind === 'foods' ? 'sản phẩm' : 'chương trình'}
          </Muted>
          <Muted>
            Trang {page}/{Math.max(1, pages)}
          </Muted>
        </View>
        {!!a.error && (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={s.error}>
              {a.error}
            </Text>
            <Button secondary title="Thử lại" busy={a.busy} onPress={() => a.run(load)} />
          </View>
        )}
        {!items.length && !a.busy && !a.error && (
          <View style={[c.card, { alignItems: 'center', padding: 28, gap: 10 }]}>
            <Icon name="search" size={30} />
            <Text style={s.title}>Không tìm thấy kết quả</Text>
            <Muted>Thử từ khóa hoặc bộ lọc khác.</Muted>
          </View>
        )}
        {items.map((item) => {
          const open = expanded === item._id,
            title = item.title || item.name,
            status = kind === 'promotions' ? promotionStatus(item) : null;
          return (
            <View key={item._id} style={c.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xem thông tin ${title}`}
                accessibilityState={{ expanded: open }}
                onPress={() => setExpanded(open ? '' : item._id)}
                style={({ pressed }) => [c.summary, pressed && { opacity: 0.75 }]}
              >
                {kind !== 'promotions' && (
                  <View style={{ width: kind === 'movies' ? 64 : 72, flexShrink: 0 }}>
                    <Artwork uri={item.poster || item.image} square={kind === 'foods'} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                  <Text numberOfLines={2} style={s.title}>
                    {title}
                  </Text>
                  {kind === 'movies' && (
                    <>
                      <View style={[s.wrap, { alignItems: 'center' }]}>
                        <Badge>{item.classification || 'P'}</Badge>
                        <Muted>{item.duration} phút</Muted>
                        {item.featured && <Badge tone="gold">Nổi bật</Badge>}
                      </View>
                      <Text style={c.meta}>Khởi chiếu {dateVN(item.releaseDate)}</Text>
                    </>
                  )}
                  {kind === 'foods' && (
                    <>
                      <Text style={c.price}>{money(item.price)}</Text>
                      <View style={s.wrap}>
                        <Badge tone={item.stock === 0 ? 'red' : item.stock <= 5 ? 'gold' : 'green'}>
                          {item.stock === 0
                            ? 'Hết hàng'
                            : item.stock <= 5
                              ? `Sắp hết · ${item.stock}`
                              : `Còn ${item.stock}`}
                        </Badge>
                        <Badge tone={item.available ? 'green' : 'neutral'}>
                          {item.available ? 'Đang bán' : 'Ngưng bán'}
                        </Badge>
                      </View>
                    </>
                  )}
                  {kind === 'promotions' && (
                    <>
                      <View style={[s.between, { flexWrap: 'wrap' }]}>
                        <Text style={[c.price, { fontSize: 24 }]}>
                          {item.discountType === 'percentage'
                            ? `Giảm ${item.value}%`
                            : `Giảm ${money(item.value)}`}
                        </Text>
                        {status && <Badge tone={status.tone}>{status.title}</Badge>}
                      </View>
                      <Text selectable style={c.code}>
                        {item.code}
                      </Text>
                      <Text style={c.meta}>
                        {dateVN(item.startsAt)} → trước {dateVN(item.endsAt)}
                      </Text>
                      <Muted>
                        Đã dùng {item.usedCount || 0}
                        {item.usageLimit == null
                          ? ' · Không giới hạn'
                          : ` / ${item.usageLimit} lượt`}
                      </Muted>
                    </>
                  )}
                </View>
              </Pressable>
              {open && (
                <View style={c.details}>
                  <Muted>{item.description || 'Chưa có mô tả.'}</Muted>
                  {kind === 'promotions' && (
                    <>
                      <Muted>
                        Phạm vi: {{ ticket: 'Vé', food: 'F&B', all: 'Vé và F&B' }[item.scope as string] ||
                          item.scope}
                      </Muted>
                      <Muted>
                        Đơn tối thiểu: {money(item.minOrder || 0)}
                        {item.maxDiscount != null
                          ? ` · Giảm tối đa: ${money(item.maxDiscount)}`
                          : ''}
                      </Muted>
                      <Muted>Dùng cùng điểm: {item.stackable ? 'Có' : 'Không'}</Muted>
                      <Muted>
                        Giờ Việt Nam: {new Date(item.startsAt).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })} → trước {new Date(item.endsAt).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </Muted>
                    </>
                  )}
                  {kind === 'movies' && (
                    <Muted>
                      {item.genre?.join(' · ')} · Đánh giá {item.rating || 0}/10
                    </Muted>
                  )}
                </View>
              )}
              <View style={c.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${open ? 'Thu gọn' : 'Xem chi tiết'} ${title}`}
                  accessibilityState={{ expanded: open }}
                  style={c.detailButton}
                  onPress={() => setExpanded(open ? '' : item._id)}
                >
                  <Text style={c.link}>{open ? 'Thu gọn' : 'Xem chi tiết'}</Text>
                  <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
                    <Icon name="chevron" size={15} color={colors.pink} />
                  </View>
                </Pressable>
                <View style={[s.row, { gap: 6 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Sửa ${title}`}
                    disabled={a.busy}
                    style={c.editButton}
                    onPress={() => edit(item._id)}
                  >
                    <Text style={c.editText}>Sửa</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Thao tác khác ${title}`}
                    disabled={a.busy}
                    style={c.moreButton}
                    onPress={() => setMenu(item)}
                  >
                    <Text style={{ color: colors.text, fontSize: 24, lineHeight: 27 }}>⋯</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
        {pages > 1 && (
          <View style={s.between}>
            <Button
              secondary
              disabled={page <= 1 || a.busy}
              title="Trang trước"
              onPress={() => setPage((p) => p - 1)}
            />
            <Button
              secondary
              disabled={page >= pages || a.busy}
              title="Trang sau"
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        )}
      </Page>
      <Modal
        visible={!!menu}
        transparent
        animationType="slide"
        onRequestClose={() => setMenu(null)}
      >
        <View style={c.overlay}>
          <Pressable
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel="Đóng menu"
            onPress={() => setMenu(null)}
          />
          <View style={[c.sheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
            <View style={s.between}>
              <Text style={[s.title, { flex: 1 }]}>{menu?.title || menu?.name}</Text>
              <Pressable
                style={c.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Đóng menu"
                onPress={() => setMenu(null)}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {menu && (
              <ConfirmButton
                title={`Xóa ${names[kind]}`}
                message={`Xác nhận xóa “${menu.title || menu.name}”? Hệ thống sẽ kiểm tra các dữ liệu liên quan trước khi xóa.`}
                disabled={a.busy}
                onConfirm={() => {
                  // Chốt bản ghi trước khi đóng menu; chỉ cập nhật danh sách sau DELETE thành công.
                  const item = menu;
                  setMenu(null);
                  void a.run(async () => {
                    await api(`/${kind}/${item._id}`, 'DELETE', { version: item.__v });
                    if (items.length === 1 && page > 1) setPage((p) => p - 1);
                    else await load();
                  });
                }}
              />
            )}
            <Button secondary title="Đóng" onPress={() => setMenu(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  price: { color: colors.pink, fontSize: 19, lineHeight: 27, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  code: { color: '#e5c7d2', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  actions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    paddingHorizontal: 2,
  },
  link: { color: colors.pink, fontSize: 12, fontWeight: '600' },
  editButton: {
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#232735',
    borderRadius: 10,
  },
  editText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  moreButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  iconButton: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  details: { padding: 14, paddingTop: 0, gap: 8 },
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
    maxHeight: '85%',
  },
});
