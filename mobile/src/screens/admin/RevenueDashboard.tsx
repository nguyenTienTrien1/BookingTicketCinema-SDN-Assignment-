import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import DateField from '../../components/DateField';
import OptionPicker from '../../components/OptionPicker';
import { Accordion, BackButton, Badge, Button, Card, Chip, Eyebrow, Heading, Muted, Page, Section } from '../../components/ui';
import { colors, s } from '../../theme';
import { money } from '../../utils/format';
import {
  getRevenueReport, initialRevenueFilters, RevenueFilters, RevenueMetrics,
  RevenuePeriod, RevenueReport, revenueMethods, revenueSources, vietnamDay,
} from '../../services/revenueService';

const dateLabel = (value: string) => value.split('-').reverse().join('/');
const detailFields: [keyof RevenueMetrics, string][] = [
  ['gross', 'Giá gốc'], ['discounts', 'Giảm giá'], ['fees', 'Phí'], ['points', 'Điểm đã quy đổi'],
  ['payments', 'Tiền thu'], ['refunds', 'Hoàn tiền'], ['net', 'Thu ròng'],
];
function Amount({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <View style={[s.between, { alignItems: 'flex-start', flexWrap: 'wrap' }]}>
    <Text style={[s.muted, { flexShrink: 1 }]}>{label}</Text>
    <Text style={[s.title, { color: strong ? (value < 0 ? colors.pink : colors.green) : colors.text }]}>{money(value)}</Text>
  </View>;
}
function RevenueTrend({ series }: { series: RevenuePeriod[] }) {
  if (series.length < 4 || !series.some(item => item.net !== 0)) return null;
  const minimum = Math.min(0, ...series.map(item => item.net));
  const maximum = Math.max(0, ...series.map(item => item.net));
  const y = (value: number) => 15 + (maximum - value) / (maximum - minimum) * 110;
  const points = series.map((item, index) => `${index ? 'L' : 'M'}${10 + index / (series.length - 1) * 300},${y(item.net)}`).join(' ');
  return <Card>
    <Text style={s.title}>Xu hướng thu ròng</Text>
    <View style={[s.between, { flexWrap: 'wrap' }]}><Muted>Cao nhất {money(Math.max(...series.map(item => item.net)))}</Muted><Muted>Thấp nhất {money(Math.min(...series.map(item => item.net)))}</Muted></View>
    <View accessible accessibilityLabel={`Xu hướng thu ròng từ ${series[0].period} đến ${series[series.length - 1].period}. Chi tiết số tiền ở danh sách từng kỳ bên dưới.`}>
      <Svg width="100%" height={140} viewBox="0 0 320 140" accessible={false}>
        <Path d={`M10,${y(0)} L310,${y(0)}`} stroke={colors.muted} strokeDasharray="4 4" />
        <Path d={points} fill="none" stroke={colors.pink} strokeWidth={2.5} />
      </Svg>
    </View>
    <View style={s.between}><Muted>{dateLabel(series[0].period)}</Muted><Muted>{dateLabel(series[series.length - 1].period)}</Muted></View>
    <Muted>Đường đứt nét là mức 0. Số tiền chính xác có trong chi tiết từng kỳ.</Muted>
  </Card>;
}

export default function RevenueDashboard() {
  const [filters, setFilters] = useState<RevenueFilters>(initialRevenueFilters);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const mounted = useRef(false), locked = useRef(false);

  async function load(values: RevenueFilters) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    // Failed refreshes must not show old totals as if they were current.
    setReport(null);
    try {
      const result = await getRevenueReport(values);
      if (mounted.current) { setReport(result); setPage(1); }
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true;
    void load(initialRevenueFilters());
    return () => { mounted.current = false; };
  }, []);

  function change<K extends keyof RevenueFilters>(key: K, value: RevenueFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: value })); setError('');
  }
  function quickRange(kind: 'today' | 'week' | 'month') {
    const to = vietnamDay();
    const from = kind === 'today' ? to : kind === 'month' ? to.slice(0, 7) + '-01' :
      new Date(Date.parse(to + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10);
    setFilters(previous => ({ ...previous, from, to })); setError('');
  }
  const dirty = !!report && (Object.keys(filters) as (keyof RevenueFilters)[]).some(key => filters[key] !== report.filters[key]);
  const pages = report ? Math.max(1, Math.ceil(report.series.length / 10)) : 1;

  return <Page>
    <BackButton disabled={busy} onPress={() => router.replace('/workspace')} />
    <Eyebrow>CINEMA+ / ADMIN</Eyebrow>
    <Heading>Doanh thu</Heading>
    <Muted>Tiền thu đã xác minh theo giờ Việt Nam (UTC+7). Mặc định xem từ đầu tháng đến hôm nay.</Muted>
    <Card>
      <Text style={s.title}>Bộ lọc báo cáo</Text>
      <View style={s.wrap}>
        <Chip title="Hôm nay" disabled={busy} onPress={() => quickRange('today')} />
        <Chip title="7 ngày qua" disabled={busy} onPress={() => quickRange('week')} />
        <Chip title="Tháng này" disabled={busy} onPress={() => quickRange('month')} />
      </View>
      <DateField label="Từ ngày" value={filters.from} disabled={busy} onChange={value => change('from', value)} />
      <DateField label="Đến ngày" value={filters.to} disabled={busy} onChange={value => change('to', value)} />
      <OptionPicker title="Nguồn thu" value={filters.source} disabled={busy} searchLabel="Tìm nguồn thu" searchPlaceholder="Vé hoặc F&B" emptyLabel="Không có nguồn phù hợp."
        items={Object.entries(revenueSources).map(([value, label]) => ({ value, label }))} onChange={value => change('source', value as RevenueFilters['source'])} />
      <OptionPicker title="Phương thức thanh toán" value={filters.method} disabled={busy} searchLabel="Tìm phương thức" searchPlaceholder="Tiền mặt, VNPay…" emptyLabel="Không có phương thức phù hợp."
        items={Object.entries(revenueMethods).map(([value, label]) => ({ value, label }))} onChange={value => change('method', value as RevenueFilters['method'])} />
      <Text style={s.label}>Nhóm số liệu</Text>
      <View style={s.wrap}>
        <Chip title="Theo ngày" selected={filters.groupBy === 'day'} disabled={busy} onPress={() => change('groupBy', 'day')} />
        <Chip title="Theo tháng" selected={filters.groupBy === 'month'} disabled={busy} onPress={() => change('groupBy', 'month')} />
      </View>
      <Button title="Xem báo cáo" busy={busy} onPress={() => void load(filters)} />
      <Muted>Chọn khoảng tối đa 366 ngày, tính cả ngày bắt đầu và kết thúc.</Muted>
    </Card>
    {busy && <View style={s.row}><ActivityIndicator color={colors.pink} /><Muted>Đang tải báo cáo doanh thu…</Muted></View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {dirty && <Text accessibilityLiveRegion="polite" style={s.error}>Bộ lọc chưa áp dụng. Bấm Xem báo cáo để cập nhật; số liệu bên dưới vẫn thuộc bộ lọc đã áp dụng.</Text>}
    {report && <>
      <Section title="Kết quả báo cáo" />
      <Card>
        <Badge tone="green">{dateLabel(report.filters.from)} → {dateLabel(report.filters.to)}</Badge>
        <Muted>{revenueSources[report.filters.source]} · {revenueMethods[report.filters.method]} · Nhóm theo {report.filters.groupBy === 'day' ? 'ngày' : 'tháng'}</Muted>
        <Muted>Dữ liệu lúc {new Date(report.dataTimestamp).toLocaleString('vi-VN', { timeZone: report.timezone })} · VND</Muted>
        <Text style={s.label}>Thu ròng</Text>
        <Text accessibilityLabel={`Thu ròng: ${money(report.totals.net)}`} style={[s.heading, { color: report.totals.net < 0 ? colors.pink : colors.green }]}>{money(report.totals.net)}</Text>
        <Amount label="Tiền thu" value={report.totals.payments} />
        <Amount label="Hoàn tiền" value={report.totals.refunds} />
        <Muted>{report.totals.paymentCount} thanh toán · {report.totals.refundCount} hoàn tiền</Muted>
      </Card>
      {!report.totals.paymentCount && !report.totals.refundCount && <Card>
        <Text style={s.title}>Chưa có giao dịch được xác minh trong kỳ</Text>
        <Muted>Tổng ghi nhận bằng 0. Đơn demo, đơn chờ xử lý và giao dịch chưa được xác minh không được tính.</Muted>
      </Card>}
      <RevenueTrend series={report.series} />
      <Card><Text style={s.title}>Theo nguồn thu</Text>
        <Amount label="Vé và F&B đi kèm · Thu ròng" value={report.sources.tickets.net} />
        <Amount label="F&B tại quầy · Thu ròng" value={report.sources.food.net} />
      </Card>
      <Accordion title="Cơ cấu tiền thu">
        {detailFields.map(([key, label]) => <Amount key={key} label={label} value={report.totals[key]} strong={key === 'net'} />)}
        <Muted>Giá gốc − giảm giá + phí − điểm quy đổi = tiền thu. Tiền thu − hoàn tiền = thu ròng.</Muted>
      </Accordion>
      {!!report.pointRefunds && <Accordion title="Hoàn về điểm thành viên">
        <Amount label="Giá trị đã chuyển thành điểm" value={report.pointRefunds.value} />
        <Muted>{report.pointRefunds.points.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} điểm · {report.pointRefunds.count} yêu cầu hoàn tất.</Muted>
        <Muted>Đây là điểm đã cộng cho thành viên, không phải khoản tiền mặt/VNPay đã chi ra và không được trừ lần nữa khỏi thu ròng.</Muted>
        <Amount label="Khoản thu chưa thành đơn đã chuyển về điểm" value={report.pointRefunds.unfinalizedCollections} />
      </Accordion>}
      <Section title="Chi tiết từng kỳ" detail={`Trang ${page}/${pages}`} />
      {report.series.slice((page - 1) * 10, page * 10).map(item => <Accordion key={`${report.reportId}-${item.period}`} title={dateLabel(item.period)}>
        {detailFields.map(([key, label]) => <Amount key={key} label={label} value={item[key]} strong={key === 'net'} />)}
        <Muted>{item.paymentCount} thanh toán · {item.refundCount} hoàn tiền</Muted>
      </Accordion>)}
      {pages > 1 && <View style={s.wrap}>
        <Button secondary title="Kỳ trước" disabled={page === 1} onPress={() => setPage(value => value - 1)} />
        <Button secondary title="Kỳ sau" disabled={page === pages} onPress={() => setPage(value => value + 1)} />
      </View>}
      <Accordion title="Phạm vi ghi nhận">
        <Muted>{report.basis}</Muted><Muted>{report.sourceNote}</Muted>
        {report.excludedFoodSales > 0 && <Text style={s.error}>{report.excludedFoodSales} hóa đơn F&B thiếu xác minh đã được loại khỏi báo cáo.</Text>}
      </Accordion>
      <Button secondary title="Làm mới số liệu" onPress={() => void load(report.filters)} />
    </>}
  </Page>;
}
