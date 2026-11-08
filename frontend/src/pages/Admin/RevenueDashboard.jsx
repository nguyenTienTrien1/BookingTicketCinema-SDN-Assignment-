import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRevenueReport, exportRevenueReport } from '../../services/revenueService';
import './movies.css';
import './revenue.css';

const sourceNames = { all: 'Tất cả nguồn', tickets: 'Vé và bắp nước đi kèm', food: 'Bắp nước tại quầy' };
const methodNames = { all: 'Tất cả phương thức', cash: 'Tiền mặt', vnpay: 'VNPay', momo: 'MoMo', 'credit-card': 'Thẻ', points: 'Chỉ dùng điểm' };
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const fields = [['gross', 'Giá gốc'], ['discounts', 'Giảm giá'], ['fees', 'Phí'], ['points', 'Điểm quy đổi'], ['payments', 'Tiền thu'], ['refunds', 'Hoàn tiền'], ['net', 'Thu ròng']];

function initialFilters() {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from: today.slice(0, 7) + '-01', to: today, source: 'all', method: 'all', groupBy: 'day' };
}

function displayTime(date) {
  return new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function RevenueChart({ series }) {
  const width = 900;
  const height = 240;
  const padding = 30;
  let min = 0;
  let max = 0;
  for (const row of series) {
    min = Math.min(min, row.net);
    max = Math.max(max, row.net);
  }
  const range = max - min || 1;
  const zero = padding + (max / range) * (height - 2 * padding);
  const points = [];
  for (let i = 0; i < series.length; i += 1) {
    const x = series.length === 1 ? width / 2 : padding + i / (series.length - 1) * (width - 2 * padding);
    const y = padding + (max - series[i].net) / range * (height - 2 * padding);
    points.push(`${x},${y}`);
  }
  return <figure className="revenueChart">
    <figcaption>Xu hướng thu ròng <span>Số liệu chi tiết trong bảng bên dưới</span></figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Thu ròng theo ${series.length} kỳ, từ ${series[0].period} đến ${series[series.length - 1].period}. Giá trị từ ${money.format(min)} đến ${money.format(max)}.`}>
      <line x1={padding} x2={width - padding} y1={zero} y2={zero} stroke="#788296" strokeDasharray="6 5" />
      {series.length > 1 && <polyline points={points.join(' ')} fill="none" stroke="#fb7185" strokeWidth="3" />}
      {series.length === 1 && <circle cx={width / 2} cy={points[0].split(',')[1]} r="5" fill="#fb7185" />}
    </svg>
    <div className="revenueChartLabels"><span>{series[0].period}</span><span>{series[series.length - 1].period}</span></div>
    <p className="revenueHint">Đường đứt nét: mức 0 · Cao nhất {money.format(max)} · Thấp nhất {money.format(min)}</p>
  </figure>;
}

function SourceRevenueChart({ sources }) {
  const [selected, setSelected] = useState(null);
  const items = [
    { key: 'tickets', label: 'Vé và bắp nước đi kèm', value: sources.tickets.payments, color: '#fb7185' },
    { key: 'food', label: 'Bắp nước tại quầy', value: sources.food.payments, color: '#38bdf8' }
  ];
  const total = items[0].value + items[1].value;
  const chosen = items.find(item => item.key === selected);
  const circumference = 2 * Math.PI * 76;
  let offset = 0;
  const slices = [];
  for (const item of items) {
    const ratio = total > 0 ? item.value / total : 0;
    slices.push(<circle key={item.key} cx="110" cy="110" r="76" fill="none" stroke={item.color} strokeWidth="24"
      strokeDasharray={`${ratio * circumference} ${circumference}`} strokeDashoffset={-offset * circumference}
      opacity={selected && selected !== item.key ? 0.25 : 1}>
      <title>{item.label}: {money.format(item.value)} ({(ratio * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)</title>
    </circle>);
    offset += ratio;
  }
  return <figure className="moviePanel revenueInsight revenueSourceChart">
    <figcaption><h2>Cơ cấu tiền thu</h2><p>Tỷ trọng theo nguồn, trước hoàn tiền.</p></figcaption>
    <div className="revenueDonut">
      <svg viewBox="0 0 220 220" role="img" aria-label={`Tiền thu từ vé: ${money.format(items[0].value)}; bắp nước tại quầy: ${money.format(items[1].value)}.`}>
        <circle cx="110" cy="110" r="76" fill="none" stroke="#303644" strokeWidth="24" />
        <g transform="rotate(-90 110 110)">{total > 0 && slices}</g>
      </svg>
      <div className="revenueDonutValue" role="status"><span>{chosen ? chosen.label : 'Tổng tiền thu'}</span><strong>{money.format(chosen ? chosen.value : total)}</strong></div>
    </div>
    <div className="revenueSourceLegend" role="group" aria-label="Chọn nguồn để xem tiền thu">
      {items.map(item => <button type="button" key={item.key} aria-pressed={selected === item.key}
        onClick={() => setSelected(selected === item.key ? null : item.key)}>
        <span className="revenueSourceName"><i aria-hidden="true" style={{ background: item.color }} />{item.label}</span>
        <span><strong>{money.format(item.value)}</strong><small>{(total > 0 ? item.value / total * 100 : 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</small></span>
      </button>)}
    </div>
    <p className="revenueHint">{total === 0 ? 'Chưa có tiền thu trong kỳ; không có tỷ trọng để hiển thị.' : 'Chọn một nguồn để xem chi tiết; chọn lại để trở về tổng.'}</p>
  </figure>;
}

function RevenueBreakdownChart({ totals }) {
  const items = [
    { key: 'gross', label: 'Giá gốc', value: totals.gross },
    { key: 'discounts', label: '− Giảm giá', value: totals.discounts > 0 ? -totals.discounts : 0 },
    { key: 'fees', label: '+ Phí', value: totals.fees },
    { key: 'points', label: '− Điểm quy đổi', value: totals.points > 0 ? -totals.points : 0 },
    { key: 'payments', label: '= Tiền thu', value: totals.payments },
    { key: 'refunds', label: '− Hoàn tiền', value: totals.refunds > 0 ? -totals.refunds : 0 },
    { key: 'net', label: '= Thu ròng', value: totals.net }
  ];
  let min = 0;
  let max = 0;
  for (const item of items) { min = Math.min(min, item.value); max = Math.max(max, item.value); }
  const range = max - min || 1;
  const zero = -min / range * 100;
  return <figure className="moviePanel revenueInsight revenueBreakdownChart">
    <figcaption><h2>Tiền thu và các khoản điều chỉnh</h2><p>Các khoản khấu trừ nằm bên trái mức 0 · Đơn vị VND.</p></figcaption>
    <dl className="revenueBreakdownList">{items.map(item => {
      const left = (Math.min(0, item.value) - min) / range * 100;
      const width = Math.abs(item.value) / range * 100;
      return <div className={`revenueBreakdownRow ${['payments', 'net'].includes(item.key) ? 'revenueBreakdownTotal' : ''}`} key={item.key}>
        <dt>{item.label}</dt><dd>{money.format(item.value)}</dd>
        <div className="revenueBreakdownTrack" aria-hidden="true"><span className="revenueZeroLine" style={{ left: `${zero}%` }} /><span className={`revenueBreakdownBar ${item.value < 0 ? 'negative' : 'positive'}`} style={{ left: `${left}%`, width: `${width}%` }} /></div>
      </div>;
    })}</dl>
    <p className="revenueHint">Giá gốc − giảm giá + phí − điểm = tiền thu. Tiền thu − hoàn tiền = thu ròng. Hoàn về điểm thành viên được thống kê riêng.</p>
  </figure>;
}

function TransactionVolumeChart({ series, totals }) {
  const [selected, setSelected] = useState(null);
  const groups = [];
  const step = Math.max(1, Math.ceil(series.length / 12));
  for (let index = 0; index < series.length; index += step) {
    const last = Math.min(index + step, series.length) - 1;
    const group = { from: series[index].period, to: series[last].period, payments: 0, refunds: 0 };
    for (let item = index; item <= last; item++) {
      group.payments += series[item].paymentCount;
      group.refunds += series[item].refundCount;
    }
    groups.push(group);
  }
  let maximum = 1;
  for (const group of groups) maximum = Math.max(maximum, group.payments, group.refunds);
  function label(group) { return group.from === group.to ? group.from : `${group.from} → ${group.to}`; }
  const active = selected === null ? null : groups[selected];
  const hasTransactions = totals.paymentCount > 0 || totals.refundCount > 0;
  return <figure className="moviePanel revenueInsight revenueVolumeChart">
    <figcaption><h2>Số giao dịch theo kỳ</h2><p>So sánh số thanh toán và hoàn tiền{step > 1 ? ` · Gộp tối đa 12 nhóm, mỗi nhóm tối đa ${step} kỳ liên tiếp` : ''}.</p></figcaption>
    <div className="revenueVolumeLegend"><span><i className="revenuePaymentMark" aria-hidden="true" />Thanh toán</span><span><i className="revenueRefundMark" aria-hidden="true" />Hoàn tiền</span></div>
    {hasTransactions ? <div className="revenueVolumeRegion" role="region" aria-label="Biểu đồ số giao dịch theo kỳ, có thể cuộn ngang" tabIndex={0}>
      <div className="revenueVolumePlot" style={{ minWidth: `${groups.length * 76}px` }}>
        {groups.map((group, index) => <button type="button" className="revenueVolumeColumn" key={group.from}
          aria-pressed={selected === index} aria-label={`${label(group)}: ${group.payments} thanh toán, ${group.refunds} hoàn tiền`}
          title={`${label(group)}: ${group.payments} thanh toán, ${group.refunds} hoàn tiền`}
          onClick={() => setSelected(selected === index ? null : index)}>
          <span className="revenueVolumeBars" aria-hidden="true">
            <span className="revenuePaymentMark" style={{ height: `${group.payments / maximum * 100}%` }}><b>{group.payments > 0 ? group.payments : ''}</b></span>
            <span className="revenueRefundMark" style={{ height: `${group.refunds / maximum * 100}%` }}><b>{group.refunds > 0 ? group.refunds : ''}</b></span>
          </span>
          <span className="revenueVolumePeriod">{group.from}{group.from !== group.to && <><br />→ {group.to}</>}</span>
        </button>)}
      </div>
    </div> : <p className="revenueChartEmpty">Chưa có thanh toán hoặc hoàn tiền để vẽ biểu đồ.</p>}
    <p className="revenueVolumeDetail" role="status">{active ? label(active) : 'Toàn kỳ'}: <strong>{active ? active.payments : totals.paymentCount}</strong> thanh toán · <strong>{active ? active.refunds : totals.refundCount}</strong> hoàn tiền.</p>
    <p className="revenueHint">{hasTransactions ? `Chọn một nhóm để xem số lượng. Cột cùng dùng một thang đo, tối đa ${maximum} giao dịch; số liệu từng kỳ vẫn có đầy đủ trong bảng bên dưới.` : 'Số giao dịch trong các kỳ bằng 0. Bạn có thể thay đổi bộ lọc để xem kỳ khác.'}</p>
  </figure>;
}

export default function RevenueDashboard() {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(Date.now());
  const errorRef = useRef(null);
  const requestRef = useRef(null);
  const defaultFilters = useRef(filters);
  const dirty = report && JSON.stringify(filters) !== JSON.stringify(report.filters);
  const expired = report && new Date(report.expiresAt).getTime() <= clock;

  async function loadReport(values) {
    if (requestRef.current) requestRef.current.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setReport(null);
    setError('');
    setExportError('');
    setMessage('');
    try {
      const data = await getRevenueReport(values, controller.signal);
      if (!controller.signal.aborted) { setReport(data); setClock(Date.now()); }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(defaultFilters.current);
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => { requestRef.current?.abort(); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if ((error || exportError) && errorRef.current) errorRef.current.focus();
  }, [error, exportError]);

  function changeFilter(event) {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setMessage('');
    setExportError('');
  }

  async function download() {
    if (!report || dirty || expired || loading || exporting) return;
    setExporting(true);
    setExportError('');
    setMessage('');
    try {
      const blob = await exportRevenueReport(report.reportId, filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `revenue_${report.filters.from}_${report.filters.to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Đã tạo file CSV từ đúng dữ liệu đang hiển thị.');
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return <main className="movieAdmin revenueAdmin"><div className="movieAdminShell">
    <Link className="movieBack" to="/admin/dashboard">← Trung tâm quản trị</Link>
    <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ · BÁO CÁO</p><h1>Thống kê doanh thu</h1><p>Theo dõi tiền thu và hoàn tiền đã xác minh.</p></div>
      <button type="button" className="moviePrimary" disabled={!report || dirty || expired || loading || exporting} onClick={download}>{exporting ? 'Đang xuất…' : 'Xuất báo cáo CSV'}</button>
    </header>
    <form className="moviePanel revenueFilters" onSubmit={(event) => { event.preventDefault(); loadReport(filters); }}>
      <fieldset disabled={loading || exporting}>
        <legend>Bộ lọc báo cáo · Múi giờ Việt Nam (UTC+07:00)</legend>
        <div className="revenueFilterGrid">
          <label>Từ ngày<input type="date" name="from" required min="2000-01-01" max="2099-12-31" value={filters.from} onChange={changeFilter} /></label>
          <label>Đến ngày<input type="date" name="to" required min={filters.from || '2000-01-01'} max="2099-12-31" value={filters.to} onChange={changeFilter} /></label>
          <label>Nguồn doanh thu<select name="source" value={filters.source} onChange={changeFilter}>{Object.keys(sourceNames).map((key) => <option value={key} key={key}>{sourceNames[key]}</option>)}</select></label>
          <label>Phương thức<select name="method" value={filters.method} onChange={changeFilter}>{Object.keys(methodNames).map((key) => <option value={key} key={key}>{methodNames[key]}</option>)}</select></label>
          <label>Nhóm theo<select name="groupBy" value={filters.groupBy} onChange={changeFilter}><option value="day">Ngày</option><option value="month">Tháng</option></select></label>
          <button className="movieSecondary" type="submit">{loading ? 'Đang tải…' : 'Áp dụng / Làm mới'}</button>
        </div>
        <p className="revenueHint">Bao gồm cả ngày bắt đầu và kết thúc, tối đa 366 ngày. Báo cáo được lưu 30 phút để xuất đúng kết quả.</p>
      </fieldset>
    </form>
    {(error || exportError) && <div className="movieError" role="alert" tabIndex="-1" ref={errorRef}>{error || exportError}</div>}
    {message && <p className="movieSuccess" role="status">{message}</p>}
    {loading && <p className="movieState" role="status">Đang tổng hợp chứng từ doanh thu…</p>}
    {dirty && <p className="movieWarning" role="status">Bộ lọc đã thay đổi. Nhấn Áp dụng / Làm mới trước khi xuất. Số liệu bên dưới vẫn thuộc bộ lọc đã áp dụng.</p>}
    {expired && <p className="movieWarning" role="status">Báo cáo đã hết hạn. Vui lòng làm mới trước khi xuất.</p>}
    {report && !loading && <section aria-label="Kết quả doanh thu">
      <div className="revenueApplied"><p><strong>{report.filters.from} → {report.filters.to}</strong> · {sourceNames[report.filters.source]} · {methodNames[report.filters.method]} · Nhóm theo {report.filters.groupBy === 'day' ? 'ngày' : 'tháng'}</p>
        <p>Dữ liệu lúc {displayTime(report.dataTimestamp)} · {report.timezone} · VND</p></div>
      <div className="revenueCards">{fields.map(([key, label]) => <article className={`moviePanel revenueCard ${key === 'net' ? 'revenueNet' : ''}`} key={key}><h2>{label}</h2><strong>{money.format(report.totals[key])}</strong></article>)}</div>
      <p className="revenueHint">{report.totals.paymentCount} thanh toán · {report.totals.refundCount} hoàn tiền</p>
      {report.pointRefunds && <section className="moviePanel revenueBasis"><h2>Hoàn về điểm thành viên</h2>
        <p>{money.format(report.pointRefunds.value)} được chuyển thành {Number(report.pointRefunds.points).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} điểm · {report.pointRefunds.count} yêu cầu hoàn tất.</p>
        <p>Đây là số dư điểm đã cộng, không phải tiền mặt/VNPay đã chi ra. Khoản thu chưa thành đơn chuyển về điểm: {money.format(report.pointRefunds.unfinalizedCollections)}; không tính vào doanh thu bán vé đã hoàn tất.</p>
      </section>}
      {report.totals.paymentCount === 0 && report.totals.refundCount === 0 ? <div className="moviePanel movieState" role="status"><h2>Chưa có giao dịch được xác minh trong kỳ</h2><p>Tổng ghi nhận là 0. Bạn có thể đổi bộ lọc hoặc xuất báo cáo rỗng.</p></div> : <RevenueChart series={report.series} />}
      <section className="revenueInsights" aria-label="Biểu đồ phân tích doanh thu" key={report.reportId}>
        <SourceRevenueChart sources={report.sources} />
        <RevenueBreakdownChart totals={report.totals} />
        <TransactionVolumeChart series={report.series} totals={report.totals} />
      </section>
      <div className="moviePanel revenueTableWrap" role="region" aria-label="Bảng doanh thu" tabIndex="0"><table className="revenueTable"><caption>Chi tiết theo {report.filters.groupBy === 'day' ? 'ngày' : 'tháng'} · Đơn vị VND</caption><thead><tr><th scope="col">Kỳ</th>{fields.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}<th scope="col">Thanh toán</th><th scope="col">Hoàn tiền</th></tr></thead>
        <tbody>{report.series.map((item) => <tr key={item.period}><th scope="row">{item.period}</th>{fields.map(([key]) => <td key={key}>{money.format(item[key])}</td>)}<td>{item.paymentCount}</td><td>{item.refundCount}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Tổng</th>{fields.map(([key]) => <td key={key}>{money.format(report.totals[key])}</td>)}<td>{report.totals.paymentCount}</td><td>{report.totals.refundCount}</td></tr></tfoot></table></div>
      <div className="moviePanel revenueBasis"><h2>Cơ sở và phạm vi ghi nhận</h2><p>{report.basis}</p><p>{report.sourceNote}</p>{report.excludedFoodSales > 0 && <p className="movieWarning">Có {report.excludedFoodSales} hóa đơn bắp nước thiếu xác minh, đã loại khỏi báo cáo.</p>}
        <p>Thu ròng từ vé và bắp nước đi kèm: <strong>{money.format(report.sources.tickets.net)}</strong> · Bắp nước tại quầy: <strong>{money.format(report.sources.food.net)}</strong></p></div>
    </section>}
  </div></main>;
}
