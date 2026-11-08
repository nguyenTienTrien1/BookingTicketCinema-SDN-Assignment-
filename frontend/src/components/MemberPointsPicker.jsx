import { memberPointsQuote } from '../utils/memberPoints';

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ';

export default function MemberPointsPicker({ wallet, value, onChange, subtotal, busy = false }) {
    const step = wallet.step;
    const { maxPoints: max, selectedPoints: points, pointsValid: valid, discount } = memberPointsQuote(wallet.balance, subtotal, value, step);
    // Refreshing the balance must not blur or lock an input being edited.
    // Checkout separately validates the latest balance before creating an order.
    const disabled = busy;
    const suggestions = step === 1 && max < 100 ? [0, Math.floor(max / 2), max] : [0, Math.max(step, 100), Math.max(step * 2, 200), max];
    const choices = [...new Set(suggestions)].filter(amount => amount <= max && amount % step === 0);

    return <section className="memberPointsCard" aria-labelledby="member-points-title">
        <div className="memberPointsHeading">
            <div><h3 id="member-points-title">Dùng điểm giảm tiền</h3><p>1 điểm = 1.000đ · {step === 1 ? 'Dùng từng điểm, không cần đủ 100 điểm' : `Đổi theo bội số ${step} điểm`}</p></div>
            <div className="memberPointsBalance"><span>Điểm của bạn</span><strong>{wallet.balance.toLocaleString('vi-VN')} <small>điểm</small></strong></div>
        </div>
        <div className="memberPointsChoices" role="group" aria-label="Chọn nhanh số điểm">
            {choices.map(amount => <button key={amount} type="button" aria-pressed={valid && points === amount}
                className={valid && points === amount ? 'selected' : ''}
                disabled={disabled} onClick={() => onChange(String(amount))}>
                <strong>{amount === 0 ? 'Không dùng' : `${amount.toLocaleString('vi-VN')} điểm`}</strong>
                <span>{amount === 0 ? 'Giữ lại điểm' : `Giảm ${money(amount * 1000)}`}</span>
            </button>)}
        </div>
        <div className="memberPointsInputRow">
            <div className="memberPointsField"><label htmlFor="online-member-points">Hoặc nhập số điểm</label>
                <div className="memberPointsInput"><input id="online-member-points" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                    value={value} onChange={event => { if (/^\d*$/.test(event.target.value)) onChange(event.target.value); }} disabled={disabled}
                    onFocus={event => event.target.select()}
                    aria-invalid={!valid} aria-describedby="member-points-help member-points-feedback" /><span>điểm</span></div>
            </div>
            <button className="memberPointsMax" type="button" onClick={() => onChange(String(max))} disabled={disabled || max === 0}>Dùng tối đa ({max})</button>
        </div>
        <p id="member-points-help" className="memberPointsHint">{wallet.refreshing ? 'Đang cập nhật số dư điểm…' : max > 0 ? `Bạn có thể dùng từ 0 đến ${max} điểm${step === 1 ? '.' : `, theo bội số ${step}.`}` : wallet.balance < step ? `Cần ít nhất ${step} điểm để đổi. Bạn có thể tiếp tục thanh toán và giữ lại điểm.` : `Đơn từ ${money(step * 1000)} mới dùng được ${step} điểm.`}</p>
        <div id="member-points-feedback" aria-live="polite">
            {wallet.error && <p className="memberPointsError" role="alert">{wallet.error}</p>}
            {!valid && <p className="memberPointsError" role="alert">{step === 1 ? `Nhập số điểm nguyên từ 0 đến ${max}.` : `Nhập 0 hoặc bội số ${step}, không vượt quá ${max} điểm.`}</p>}
            {valid && points > 0 && <p className="memberPointsApplied">✓ Đã chọn {points} điểm · Sau thanh toán còn {wallet.balance - points} điểm</p>}
        </div>
        <div className="memberPointsSavings" aria-live="polite"><div><span>Giảm từ điểm</span><strong>{discount > 0 ? '−' : ''}{money(discount)}</strong></div><div><span>Còn thanh toán</span><strong>{money(subtotal - discount)}</strong></div></div>
        <div className="memberPointsFooter"><small>Điểm chỉ bị trừ khi thanh toán thành công.</small><button type="button" disabled={busy || wallet.refreshing} onClick={wallet.refresh}>Làm mới số dư</button></div>
    </section>;
}
