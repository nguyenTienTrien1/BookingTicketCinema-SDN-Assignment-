import DateField from '../../components/DateField';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { api, uploadImage } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { useAction } from '../../utils/hooks';
import { Artwork, Button, Card, Chip, Field, Heading, Muted, Page } from '../../components/ui';
import { s } from '../../theme/index';
type Kind = 'movies' | 'foods' | 'promotions';
const names: Record<Kind, string> = { movies: 'phim', foods: 'F&B', promotions: 'khuyến mãi' };
const isKind = (value: string): value is Kind => ['movies', 'foods', 'promotions'].includes(value);
type Def = {
  key: string;
  label: string;
  options?: [string, string][];
  numeric?: boolean;
  multiline?: boolean;
  boolean?: boolean;
};
// Ba danh mục dùng chung form; cấu hình quyết định kiểu ô nhập của từng trường.
const fields: Record<Kind, Def[]> = {
  movies: [
    { key: 'title', label: 'Tên phim' },
    { key: 'description', label: 'Mô tả', multiline: true },
    { key: 'genre', label: 'Thể loại, phân cách bằng dấu phẩy' },
    { key: 'duration', label: 'Thời lượng (phút)', numeric: true },
    {
      key: 'classification',
      label: 'Phân loại',
      options: ['P', 'K', 'T13', 'T16', 'T18', 'C'].map((v) => [v, v]),
    },
    { key: 'releaseDate', label: 'Ngày khởi chiếu (YYYY-MM-DD)' },
    { key: 'rating', label: 'Điểm đánh giá (0–10)', numeric: true },
    { key: 'featured', label: 'Phim nổi bật', boolean: true },
  ],
  foods: [
    { key: 'name', label: 'Tên F&B' },
    { key: 'description', label: 'Mô tả', multiline: true },
    { key: 'price', label: 'Giá bán (VND)', numeric: true },
    { key: 'stock', label: 'Tồn kho', numeric: true },
    { key: 'available', label: 'Đang bán', boolean: true },
  ],
  promotions: [
    { key: 'name', label: 'Tên khuyến mãi' },
    { key: 'description', label: 'Mô tả', multiline: true },
    { key: 'code', label: 'Mã khuyến mãi' },
    {
      key: 'discountType',
      label: 'Loại giảm',
      options: [
        ['percentage', 'Phần trăm'],
        ['fixed', 'Số tiền'],
      ],
    },
    { key: 'value', label: 'Mức giảm', numeric: true },
    { key: 'minOrder', label: 'Giá trị tối thiểu phần được giảm (VND)', numeric: true },
    { key: 'maxDiscount', label: 'Giảm tối đa (để trống nếu không giới hạn)', numeric: true },
    {
      key: 'scope',
      label: 'Phạm vi',
      options: [
        ['ticket', 'Vé'],
        ['food', 'F&B'],
        ['all', 'Vé và F&B'],
      ],
    },
    { key: 'stackable', label: 'Dùng cùng điểm thành viên', boolean: true },
    { key: 'startsAt', label: 'Bắt đầu (YYYY-MM-DD)' },
    { key: 'endsAt', label: 'Đến hết ngày (YYYY-MM-DD)' },
    { key: 'usageLimit', label: 'Giới hạn lượt (để trống nếu không giới hạn)', numeric: true },
    { key: 'active', label: 'Kích hoạt chương trình', boolean: true },
  ],
};
// Chỉ chia nhóm hiển thị; tên trường gửi lên API vẫn lấy từ fields.
const groups: Record<Kind, { title: string; keys: string[] }[]> = {
  movies: [
    { title: 'Thông tin phim', keys: ['title', 'description', 'genre'] },
    {
      title: 'Phân loại & phát hành',
      keys: ['duration', 'classification', 'releaseDate', 'rating', 'featured'],
    },
  ],
  foods: [
    { title: 'Thông tin sản phẩm', keys: ['name', 'description'] },
    { title: 'Giá bán & tồn kho', keys: ['price', 'stock', 'available'] },
  ],
  promotions: [
    { title: 'Thông tin chương trình', keys: ['name', 'description', 'code'] },
    {
      title: 'Mức giảm & điều kiện',
      keys: ['discountType', 'value', 'minOrder', 'maxDiscount', 'scope', 'stackable'],
    },
    { title: 'Thời hạn & lượt dùng', keys: ['startsAt', 'endsAt', 'usageLimit', 'active'] },
  ],
};
// Ngày mặc định theo giờ Việt Nam, không phụ thuộc múi giờ của điện thoại.
const vnDay = (value = new Date()) =>
  new Date(value.getTime() + 7 * 3600000).toISOString().slice(0, 10);
// Kiểm tra ngày thực tế trước khi cộng/trừ ngày, tránh Date tự sửa ngày không hợp lệ.
function shift(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Ngày phải theo YYYY-MM-DD.');
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    throw new Error('Ngày không hợp lệ.');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function Media({
  kind,
  field,
  value,
  onChange,
  run,
  busy,
}: {
  kind: 'movies' | 'foods';
  field: string;
  value: string;
  onChange: (url: string) => void;
  run: (action: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  async function pick() {
    await run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0],
        extension = asset.name.split('.').pop()?.toLowerCase(),
        extensionMime: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
        },
        mime = asset.mimeType || extensionMime[extension || ''];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime))
        throw new Error('Chọn tệp JPG, PNG hoặc WebP.');
      if (asset.size != null && asset.size > 5 * 1024 * 1024)
        throw new Error('Ảnh phải nhỏ hơn hoặc bằng 5 MB.');
      const base64 =
        asset.base64 ||
        (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        }));
      onChange(await uploadImage(kind, base64));
    });
  }
  return (
    <Card>
      <Text style={s.title}>
        {field === 'image' ? 'Ảnh F&B' : field === 'poster' ? 'Poster' : 'Banner'}
      </Text>
      {!!value && (
        <View style={{ width: field === 'banner' ? '100%' : 120 }}>
          <Artwork uri={value} wide={field === 'banner'} />
        </View>
      )}
      <Button
        icon="plus"
        busy={busy}
        title={value ? 'Chọn ảnh khác trong thư mục' : 'Chạm để duyệt thư mục ảnh'}
        accessibilityLabel={value ? 'Chọn ảnh khác trong thư mục' : 'Duyệt thư mục để chọn ảnh'}
        onPress={pick}
      />
      <Muted>
        Mở trình duyệt tệp để chọn ảnh từ thư mục trên thiết bị. Ảnh sẽ tự tải lên sau khi chọn.
      </Muted>
      <Field label="Hoặc dán URL ảnh" value={value} onChangeText={onChange} autoCapitalize="none" />
      <Muted>Hỗ trợ JPG, PNG, WebP tối đa 5 MB.</Muted>
    </Card>
  );
}
export { default as AdminList } from './CatalogueList';
export function AdminEdit() {
  // id = 'new' mở form thêm; ID khác sẽ tải dữ liệu để cập nhật.
  const { kind: raw, id } = useLocalSearchParams<{ kind: string; id: string }>(),
    kind = isKind(raw) ? raw : null,
    { user } = useSession(),
    editing = id !== 'new',
    a = useAction();
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    name: '',
    description: '',
    genre: '',
    duration: '',
    classification: 'P',
    releaseDate: vnDay(),
    rating: '0',
    featured: false,
    image: '',
    poster: '',
    banner: '',
    price: '',
    stock: '0',
    available: true,
    code: '',
    discountType: 'percentage',
    value: '',
    minOrder: '0',
    maxDiscount: '',
    scope: 'all',
    stackable: true,
    startsAt: vnDay(),
    endsAt: vnDay(),
    usageLimit: '',
    active: true,
  });
  const [loaded, setLoaded] = useState(!editing),
    [hasShows, setHasShows] = useState(false),
    [specific, setSpecific] = useState(false),
    [original, setOriginal] = useState<any>(null);
  async function load() {
    // API phim bọc dữ liệu trong movie; F&B và khuyến mãi trả trực tiếp bản ghi.
    if (!kind) return;
    setLoaded(false);
    const result = await api(`/${kind}/admin/${id}`),
      item = kind === 'movies' ? result.movie : result;
    setHasShows(!!result.hasShowtimes);
    // Giữ phiên bản để backend phát hiện cập nhật đồng thời; ô nhập dùng chuỗi.
    const data: Record<string, any> = { ...item, version: item.__v };
    for (const def of fields[kind])
      if (!def.boolean) data[def.key] = item[def.key] == null ? '' : String(item[def.key]);
    if (kind === 'movies') {
      data.genre = item.genre.join(', ');
      data.releaseDate = item.releaseDate?.slice(0, 10) || '';
      data.classification = item.classification || (item.ageLimit ? 'T' + item.ageLimit : 'P');
    }
    if (kind === 'promotions') {
      // Đổi UTC sang giờ Việt Nam để hiển thị. Mốc kết thúc 00:00 là đầu ngày kế tiếp.
      const start = new Date(new Date(item.startsAt).getTime() + 7 * 3600000).toISOString(),
        end = new Date(new Date(item.endsAt).getTime() + 7 * 3600000).toISOString(),
        custom = !start.endsWith('T00:00:00.000Z') || !end.endsWith('T00:00:00.000Z');
      setSpecific(custom);
      data.startsAt = custom ? start.slice(0, 16) : start.slice(0, 10);
      data.endsAt = custom ? end.slice(0, 16) : shift(end.slice(0, 10), -1);
      setOriginal({
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        startInput: data.startsAt,
        endInput: data.endsAt,
        custom,
      });
    }
    setForm(data);
    setLoaded(true);
  }
  useEffect(() => {
    if (editing) void a.run(load);
  }, [kind, id]);
  if (!kind || user?.role !== 'admin') return <Redirect href="/workspace" />;
  function change(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function save() {
    // Chuyển dữ liệu từ form sang payload; backend vẫn kiểm tra nghiệp vụ lần cuối.
    if (!kind) return;
    const data: Record<string, any> = { version: form.version };
    for (const def of fields[kind]) {
      if (def.numeric) {
        if (form[def.key] !== '' && !/^\d+(\.\d+)?$/.test(String(form[def.key])))
          throw new Error(def.label + ' phải là số không âm.');
        data[def.key] = form[def.key] === '' ? null : Number(form[def.key]);
      } else data[def.key] = form[def.key];
    }
    if (kind === 'movies') {
      data.genre = String(form.genre)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      data.poster = form.poster;
      data.banner = form.banner;
    }
    if (kind === 'foods') data.image = form.image;
    if (kind === 'promotions') {
      data.code = String(form.code).trim().toUpperCase();
      data.maxDiscount = form.discountType === 'percentage' ? data.maxDiscount : null;
      if (specific) {
        // Không sửa giờ thì giữ nguyên timestamp gốc, tránh mất phần giây khi lưu lại.
        for (const key of ['startsAt', 'endsAt']) {
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form[key]))
            throw new Error('Giờ cụ thể theo YYYY-MM-DDTHH:mm.');
          data[key] =
            original?.custom &&
            form[key] === original[key === 'startsAt' ? 'startInput' : 'endInput']
              ? original[key]
              : form[key] + ':00+07:00';
        }
      } else {
        // Chọn "đến hết ngày": gửi 00:00 ngày kế tiếp vì backend dùng now < endsAt.
        shift(form.startsAt, 0);
        data.startsAt = form.startsAt + 'T00:00:00+07:00';
        data.endsAt = shift(form.endsAt, 1) + 'T00:00:00+07:00';
      }
    }
    // Chỉ quay lại sau khi lưu thành công; màn danh sách sẽ tải lại khi nhận focus.
    await api(`/${kind}${editing ? '/' + id : ''}`, editing ? 'PUT' : 'POST', data);
    router.back();
  }
  return (
    <Page>
      <Heading>
        {editing ? 'Cập nhật' : 'Thêm'} {names[kind]}
      </Heading>
      {!!a.error && (
        <Text accessibilityRole="alert" style={s.error}>
          {a.error}
        </Text>
      )}
      {!loaded ? (
        <Button secondary busy={a.busy} title="Tải lại thông tin" onPress={() => a.run(load)} />
      ) : (
        <>
          {hasShows && (
            <Muted>
              Phim đã có suất chiếu. Tên, thời lượng, phân loại và ngày khởi chiếu được khóa.
            </Muted>
          )}
          {kind === 'promotions' && (
            <Card>
              <Muted>
                Thời hạn theo giờ Việt Nam. Mặc định chương trình chạy đến hết ngày kết thúc.
              </Muted>
              <View style={s.wrap}>
                {[1, 7, 30].map((days) => (
                  <Button
                    key={days}
                    secondary
                    title={`${days} ngày từ hôm nay`}
                    onPress={() => {
                      setSpecific(false);
                      change('startsAt', vnDay());
                      change('endsAt', shift(vnDay(), days - 1));
                    }}
                  />
                ))}
              </View>
              <Button
                secondary
                title={specific ? 'Chuyển sang ngày trọn vẹn' : 'Chọn giờ cụ thể'}
                onPress={() => {
                  if (specific) {
                    change('startsAt', form.startsAt.slice(0, 10));
                    change(
                      'endsAt',
                      form.endsAt.endsWith('T00:00')
                        ? shift(form.endsAt.slice(0, 10), -1)
                        : form.endsAt.slice(0, 10),
                    );
                  } else {
                    change('startsAt', form.startsAt + 'T00:00');
                    change('endsAt', shift(form.endsAt, 1) + 'T00:00');
                  }
                  setSpecific(!specific);
                }}
              />
            </Card>
          )}
          {groups[kind].map((group, index) => (
            <Card key={group.title}>
              <View style={s.row}>
                <View
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 8,
                    backgroundColor: '#3c2030',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#ff8a9f' }}>
                    0{index + 1}
                  </Text>
                </View>
                <Text style={s.title}>{group.title}</Text>
              </View>
              {fields[kind]
                .filter(
                  (def) =>
                    group.keys.includes(def.key) &&
                    !(def.key === 'maxDiscount' && form.discountType === 'fixed'),
                )
                .map((def) => {
                  // Khóa trường nhạy cảm khi phim có suất chiếu hoặc mã đã được sử dụng.
                  const disabled =
                    a.busy ||
                    (hasShows &&
                      ['title', 'duration', 'classification', 'releaseDate'].includes(def.key)) ||
                    (kind === 'promotions' &&
                      form.usedCount > 0 &&
                      ['code', 'discountType', 'value', 'scope'].includes(def.key));
                  return (
                    <View key={def.key} style={{ gap: 9 }}>
                      {def.boolean ? (
                        <Button
                          disabled={disabled}
                          secondary={!form[def.key]}
                          title={`${form[def.key] ? '✓' : '○'} ${def.label}`}
                          onPress={() => change(def.key, !form[def.key])}
                        />
                      ) : def.options ? (
                        <>
                          <Text style={s.label}>{def.label}</Text>
                          <View style={s.wrap}>
                            {def.options.map(([value, title]) => (
                              <Chip
                                key={value}
                                disabled={disabled}
                                selected={form[def.key] === value}
                                title={title}
                                onPress={() => change(def.key, value)}
                              />
                            ))}
                          </View>
                        </>
                      ) : ['releaseDate', 'startsAt', 'endsAt'].includes(def.key) ? (
                        <DateField
                          label={def.label}
                          value={String(form[def.key] || '')}
                          onChange={(value) => change(def.key, value)}
                          withTime={specific && kind === 'promotions'}
                          disabled={disabled}
                        />
                      ) : (
                        <Field
                          label={
                            specific && ['startsAt', 'endsAt'].includes(def.key)
                              ? (def.key === 'startsAt' ? 'Bắt đầu' : 'Kết thúc trước') +
                                ' (YYYY-MM-DDTHH:mm)'
                              : def.label
                          }
                          value={String(form[def.key] ?? '')}
                          editable={!disabled}
                          multiline={def.multiline}
                          style={def.multiline ? { minHeight: 100 } : undefined}
                          keyboardType={def.numeric ? 'decimal-pad' : 'default'}
                          onChangeText={(value) => change(def.key, value)}
                        />
                      )}
                    </View>
                  );
                })}
            </Card>
          ))}
          {kind !== 'promotions' &&
            (kind === 'movies' ? ['poster', 'banner'] : ['image']).map((key) => (
              <Media
                key={key}
                kind={kind}
                field={key}
                value={form[key] || ''}
                onChange={(url) => change(key, url)}
                run={a.run}
                busy={a.busy}
              />
            ))}
          <Button busy={a.busy} title={`Lưu ${names[kind]}`} onPress={() => a.run(save)} />
        </>
      )}
    </Page>
  );
}
