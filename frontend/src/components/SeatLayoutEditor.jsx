import { useState } from 'react';
import { generateSeats } from '../services/roomService';

export const conditionLabels = { Active: 'Hoạt động', Broken: 'Hư hỏng', Maintenance: 'Đang sửa chữa', Disabled: 'Ngừng sử dụng' };
const symbols = { Active: '', Broken: '×', Maintenance: 'M', Disabled: '—' };

export default function SeatLayoutEditor({ seats, configs, onChange, disabled }) {
  const [selection, setSelection] = useState([]), [type, setType] = useState('Standard'), [condition, setCondition] = useState('Active');
  const [rows, setRows] = useState(function () {
    const names = new Set();
    for (const seat of seats) names.add(seat.match(/^[A-Z]+/)[0]);
    return String(Math.min(26, names.size));
  });
  const [columns, setColumns] = useState(function () {
    let largest = 1;
    for (const seat of seats) largest = Math.max(largest, Number(seat.replace(/^[A-Z]+/, '')));
    return String(Math.min(40, largest));
  });
  const [identifier, setIdentifier] = useState(''), [newSeat, setNewSeat] = useState('');
  const [error, setError] = useState('');
  const selected = selection.filter(number => seats.includes(number));
  const groups = {};
  for (const number of seats) {
    const row = number.match(/^[A-Z]+/)[0];
    if (!groups[row]) groups[row] = [];
    groups[row].push(number);
  }
  const rowNames = Object.keys(groups).sort((a, b) => a.length - b.length || a.localeCompare(b));
  function toggle(number) {
    const next = selected.includes(number) ? selected.filter(value => value !== number) : [...selected, number];
    setSelection(next);
    if (next.length === 1) { setIdentifier(next[0]); setType(configs[next[0]].type); setCondition(configs[next[0]].status); }
  }
  function apply(field, value) {
    if (!selected.length) return;
    const next = { ...configs };
    for (const number of selected) next[number] = { ...next[number], [field]: value };
    onChange(seats, next);
    setSelection([]);
    setIdentifier('');
    setError('');
  }
  function validIdentifier(number) { return /^[A-Z]+[1-9][0-9]*$/.test(number) && number.length <= 32; }
  function add() {
    const number = newSeat.trim().toUpperCase();
    if (!validIdentifier(number) || seats.includes(number) || seats.length >= 1000) { setError('Mã ghế không hợp lệ/trùng mã hoặc sơ đồ đã đủ 1000 ghế.'); return; }
    onChange([...seats, number], { ...configs, [number]: { type: 'Standard', status: 'Active' } }); setNewSeat(''); setError('');
  }
  function rename() {
    const number = identifier.trim().toUpperCase(), old = selected[0];
    if (!validIdentifier(number) || (number !== old && seats.includes(number))) { setError('Mã ghế mới không hợp lệ hoặc đã tồn tại.'); return; }
    const next = { ...configs, [number]: configs[old] };
    if (number !== old) delete next[old];
    onChange(seats.map(seat => seat === old ? number : seat), next); setSelection([number]); setError('');
  }
  function remove() {
    if (selected.length === seats.length) { setError('Phòng phải có ít nhất một ghế.'); return; }
    const next = { ...configs };
    for (const number of selected) delete next[number];
    onChange(seats.filter(number => !selected.includes(number)), next); setSelection([]); setError('');
  }
  function generate() {
    try {
      const nextSeats = generateSeats(Number(rows), Number(columns)), nextConfigs = {};
      for (const number of nextSeats) nextConfigs[number] = configs[number] || { type: 'Standard', status: 'Active' };
      onChange(nextSeats, nextConfigs); setSelection([]); setError('');
    } catch (err) { setError(err.message); }
  }
  return <fieldset className="roomSeatEditor" disabled={disabled}>
    <legend className="movieSrOnly">Chỉnh sửa sơ đồ ghế</legend>
    {error && <p className="movieError" role="alert">{error}</p>}
    <div className="roomLayoutTools">
      <label>Hàng (A–Z)<input type="number" min="1" max="26" value={rows} onChange={event => setRows(event.target.value)} /></label>
      <label>Ghế mỗi hàng<input type="number" min="1" max="40" value={columns} onChange={event => setColumns(event.target.value)} /></label>
      <button className="movieSecondary roomAction roomActionWarning" type="button" onClick={generate}>Tạo lại sơ đồ</button>
      <label>Mã ghế mới<input value={newSeat} maxLength={32} onChange={event => setNewSeat(event.target.value)} placeholder="Ví dụ: F9" /></label>
      <button className="movieSecondary roomAction roomActionAdd" type="button" onClick={add}>Thêm ghế</button>
    </div>
    <p className="movieFormHint">Nhấp từng ghế để chọn nhiều ghế; Enter hoặc Space cũng chọn được ghế. Sau mỗi lần áp dụng, nhóm ghế được bỏ chọn; hãy chọn lại nếu muốn chỉnh tiếp. Tạo lại sơ đồ chỉ thay bản nháp.</p>
    <div className="roomSeatWorkspace">
      <section className="roomSeatMap" aria-label="Sơ đồ ghế">
        <div className="roomScreen">MÀN HÌNH / SCREEN</div>
        <div className="roomMapScroll" tabIndex={0} aria-label="Sơ đồ ghế có thể cuộn ngang">
          {rowNames.map(row => {
            const numbers = groups[row].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const max = Math.max(...numbers.map(number => Number(number.slice(row.length))));
            return <div className="roomSeatRow" key={row}>
              <button type="button" className="roomRowLabel" onClick={() => setSelection(numbers)} aria-label={`Chọn hàng ${row}`}>{row}</button>
              <div className="roomSeatRowGrid" style={{ gridTemplateColumns: `repeat(${max <= 100 ? max : numbers.length}, 48px)` }}>
                {numbers.map((number, index) => {
                  const config = configs[number], pressed = selected.includes(number);
                  return <button key={number} type="button" className={`roomSeat roomSeat${config.status}${config.type === 'VIP' ? ' roomSeatVIP' : ''}${pressed ? ' roomSeatSelected' : ''}`}
                    style={{ gridColumn: max <= 100 ? Number(number.slice(row.length)) : index + 1 }} aria-pressed={pressed}
                    aria-label={`${number}, ${config.type}, ${conditionLabels[config.status]}${pressed ? ', đã chọn' : ''}`} onClick={() => toggle(number)}>
                    <span>{number}</span><small aria-hidden="true">{config.type === 'VIP' ? 'V' : 'S'}{symbols[config.status] ? ' · ' + symbols[config.status] : ''}{pressed ? ' ✓' : ''}</small>
                  </button>;
                })}
              </div>
            </div>;
          })}
        </div>
        <p className="roomSeatCount" role="status">{seats.length} ghế · {selected.length} đang chọn</p>
        <div className="roomActions"><button className="movieSecondary" type="button" onClick={() => setSelection([...seats])}>Chọn tất cả</button><button className="movieSecondary" type="button" onClick={() => setSelection([])}>Bỏ chọn</button></div>
        <ul className="roomSeatLegend" aria-label="Chú giải ghế">
          <li><span className="roomTypeChip roomTypeStandard">S: Standard</span></li>
          <li><span className="roomTypeChip roomTypeVIP">V: VIP</span></li>
          <li><span className="roomStatus roomStatusActive">Hoạt động</span></li>
          <li><span className="roomStatus roomStatusBroken">×: Hư hỏng</span></li>
          <li><span className="roomStatus roomStatusMaintenance">M: Sửa chữa</span></li>
          <li><span className="roomStatus roomStatusDisabled">—: Ngừng sử dụng</span></li>
          <li><span className="roomSelectionChip">✓: Đang chọn</span></li>
        </ul>
      </section>
      <aside className="roomSeatProperties" aria-label="Thuộc tính ghế">
        <h2>Thuộc tính ghế</h2><p role="status">{selected.length ? selected.join(', ') : 'Chọn ghế trên sơ đồ để chỉnh sửa.'}</p>
        {selected.length === 1 && <><label>Mã ghế<input value={identifier} maxLength={32} onChange={event => setIdentifier(event.target.value)} /></label><button type="button" className="movieSecondary roomAction roomActionEdit" onClick={rename}>Đổi mã ghế</button></>}
        <label>Loại ghế<select className={`roomTypeSelect roomType${type}`} aria-label="Loại ghế" value={type} onChange={event => setType(event.target.value)}><option className="roomTypeStandard" value="Standard">Standard — Thường</option><option className="roomTypeVIP" value="VIP">VIP</option></select></label>
        <button className="movieSecondary roomAction roomActionEdit" type="button" disabled={!selected.length} onClick={() => apply('type', type)}>Áp dụng loại ghế</button>
        <label>Tình trạng vận hành<select className={`roomStatusSelect roomStatus${condition}`} aria-label="Tình trạng vận hành" value={condition} onChange={event => setCondition(event.target.value)}>{Object.keys(conditionLabels).map(value => <option className={`roomStatus${value}`} key={value} value={value}>{conditionLabels[value]}</option>)}</select></label>
        <button className="movieSecondary roomAction roomActionEdit" type="button" disabled={!selected.length} onClick={() => apply('status', condition)}>Áp dụng tình trạng</button>
        <button className="movieSecondary roomAction roomActionDelete roomDanger" type="button" disabled={!selected.length} onClick={remove}>Xóa ghế đã chọn</button>
        <p className="movieFormHint">VIP chỉ phân loại ghế; giá vé vẫn theo suất chiếu. Mọi thay đổi cần được xem lại và xác nhận.</p>
      </aside>
    </div>
  </fieldset>;
}
