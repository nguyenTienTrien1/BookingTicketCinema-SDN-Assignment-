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
      {report.totals.paymentCount === 0 && report.totals.refundCount === 0 ? <div className="moviePanel movieState" role="status"><h2>Chưa có giao dịch được xác minh trong kỳ</h2><p>Tổng ghi nhận là 0. Bạn có thể đổi bộ lọc hoặc xuất báo cáo rỗng.</p></div> : <RevenueChart series={report.series} />}
      <div className="moviePanel revenueTableWrap" role="region" aria-label="Bảng doanh thu" tabIndex="0"><table className="revenueTable"><caption>Chi tiết theo {report.filters.groupBy === 'day' ? 'ngày' : 'tháng'} · Đơn vị VND</caption><thead><tr><th scope="col">Kỳ</th>{fields.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}<th scope="col">Thanh toán</th><th scope="col">Hoàn tiền</th></tr></thead>
        <tbody>{report.series.map((item) => <tr key={item.period}><th scope="row">{item.period}</th>{fields.map(([key]) => <td key={key}>{money.format(item[key])}</td>)}<td>{item.paymentCount}</td><td>{item.refundCount}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Tổng</th>{fields.map(([key]) => <td key={key}>{money.format(report.totals[key])}</td>)}<td>{report.totals.paymentCount}</td><td>{report.totals.refundCount}</td></tr></tfoot></table></div>
      <div className="moviePanel revenueBasis"><h2>Cơ sở và phạm vi ghi nhận</h2><p>{report.basis}</p><p>{report.sourceNote}</p>{report.excludedFoodSales > 0 && <p className="movieWarning">Có {report.excludedFoodSales} hóa đơn bắp nước thiếu xác minh, đã loại khỏi báo cáo.</p>}
        <p>Thu ròng từ vé và bắp nước đi kèm: <strong>{money.format(report.sources.tickets.net)}</strong> · Bắp nước tại quầy: <strong>{money.format(report.sources.food.net)}</strong></p></div>
    </section>}
  </div></main>;
}
