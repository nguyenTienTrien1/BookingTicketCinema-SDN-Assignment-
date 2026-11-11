import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';
import DateField from '../../components/DateField';
import OptionPicker from '../../components/OptionPicker';
import { Accordion, BackButton, Badge, Button, Card, Chip, Eyebrow, Heading, Muted, Page, Section } from '../../components/ui';
import { colors, s } from '../../theme';
import { money } from '../../utils/format';
import { documentUri } from '../../utils/documentUri';
import {
  getRevenueReport, initialRevenueFilters, RevenueFilters, RevenueMetrics,
  RevenuePeriod, RevenueReport, revenueMethods, revenueSources, vietnamDay, exportRevenueReport,
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
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [savedReportUri, setSavedReportUri] = useState('');
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
    setFilters(previous => ({ ...previous, [key]: value })); setError(''); setExportNotice('');
  }
  function quickRange(kind: 'today' | 'week' | 'month') {
    const to = vietnamDay();
    const from = kind === 'today' ? to : kind === 'month' ? to.slice(0, 7) + '-01' :
      new Date(Date.parse(to + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10);
    setFilters(previous => ({ ...previous, from, to })); setError('');
  }
  const dirty = !!report && (Object.keys(filters) as (keyof RevenueFilters)[]).some(key => filters[key] !== report.filters[key]);
  const pages = report ? Math.max(1, Math.ceil(report.series.length / 10)) : 1;

  async function openSavedReport() {
    if (!savedReportUri) return;
    setError('');
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: savedReportUri, type: 'text/csv', flags: 1,
      });
    } catch {
      setError('File đã lưu nhưng không mở được ứng dụng đọc CSV. Hãy vào Quản lý tệp, tìm file vừa lưu và mở bằng Excel.');
    }
  }

  async function exportReport() {
    if (!report || dirty || busy || exporting) return;
    setExporting(true); setError(''); setExportNotice('');
    try {
      const file = await exportRevenueReport(report);
      async function shareFile() {
        if (!await Sharing.isAvailableAsync()) throw new Error('Thiết bị chưa hỗ trợ chia sẻ file CSV. Hãy thử lưu vào thư mục khác.');
        if (!FileSystem.cacheDirectory) throw new Error('Không thể tạo file tạm. Hãy thử xuất báo cáo lại.');
        const uri = `${FileSystem.cacheDirectory}${file.filename}`;
        await FileSystem.writeAsStringAsync(uri, file.csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Lưu hoặc chia sẻ báo cáo doanh thu', UTI: 'public.comma-separated-values-text' });
        setExportNotice(`Đã tạo ${file.filename}. Chọn ứng dụng trong bảng chia sẻ để lưu hoặc mở file.`);
      }
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([file.csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportNotice(`Đã tải ${file.filename}.`);
      } else if (Platform.OS === 'android') {
        const destination = await IntentLauncher.startActivityAsync('android.intent.action.CREATE_DOCUMENT', {
          category: 'android.intent.category.OPENABLE', type: 'text/csv',
          extra: { 'android.intent.extra.TITLE': file.filename },
        });
        if (destination.resultCode !== IntentLauncher.ResultCode.Success || !destination.data) {
          setExportNotice('Đã hủy xuất báo cáo. Chưa lưu file mới.');
          return;
        }
        const uri = documentUri(destination.data);
        try {
          const savedFile = new File(uri);
          savedFile.write(file.csv);
        } catch (cause) {
          console.warn('Revenue CSV write failed:', cause);
          throw new Error('Không ghi được báo cáo vào vị trí đã chọn. Hãy xuất lại và lưu vào bộ nhớ trong của thiết bị.');
        }
        setSavedReportUri(uri);
        setExportNotice(`Đã lưu ${file.filename}. Bấm Mở báo cáo đã lưu để xem bằng Excel.`);
      } else {
        await shareFile();
      }
    } catch (e) { setError((e as Error).message); }
    finally { setExporting(false); }
  }

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
      <Button secondary busy={exporting} disabled={!report || dirty || busy} title="Xuất báo cáo CSV" onPress={() => void exportReport()} />
      {!!exportNotice && <Text accessibilityLiveRegion="polite" style={{ color: colors.green, fontSize: 13 }}>{exportNotice}</Text>}
      {!!savedReportUri && <Button secondary disabled={exporting} title="Mở báo cáo đã lưu" onPress={() => void openSavedReport()} />}
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
