import { useEffect, useState } from 'react';
import { api } from '../services/api';
import './counterPromotion.css';

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ';
const scopeName = { food: 'Bắp nước', ticket: 'Vé', all: 'Toàn đơn' };

export default function CounterPromotion({ booking, editable, disabled, onApply, onRemove, onDraftChange, onCancelDraft }) {
    const applied = booking.promotion;
    const [code, setCode] = useState(applied?.code || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const normalized = code.trim().toUpperCase();
    const dirty = normalized !== (applied?.code || '');
    useEffect(() => { setCode(applied?.code || ''); }, [booking._id, applied?.code]);
    useEffect(() => { onDraftChange(dirty); }, [dirty, onDraftChange]);
    useEffect(() => {
        if (!editable) return;
        const controller = new AbortController(); setLoadError(false);
        api('/promotions', { signal: controller.signal })
            .then(data => { if (!controller.signal.aborted) { if (!Array.isArray(data)) throw new Error('Invalid catalogue'); setSuggestions(data); } })
            .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
        return () => controller.abort();
    }, [booking._id, editable, retry]);
    if (!editable && !applied) return null;
    return <section className="paymentPanel counterPromotion" aria-labelledby="counter-promotion-heading">
        <div className="panelHeading"><h3 id="counter-promotion-heading">Khuyến mãi tại quầy</h3><span className="counterPromotionPolicy">1 mã / đơn</span></div>
        {editable && <form onSubmit={event => { event.preventDefault(); if (normalized && !disabled) onApply(normalized); }}>
            <fieldset disabled={disabled}>
                <label htmlFor="counter-promotion-code">Mã khuyến mãi</label>
                <div className="counterPromotionControl">
                    <input id="counter-promotion-code" list="counter-promotion-options" value={code} onChange={event => setCode(event.target.value)} maxLength={40} autoComplete="off" spellCheck={false} placeholder="Nhập hoặc chọn mã" aria-describedby="counter-promotion-hint" />
                    <datalist id="counter-promotion-options">{suggestions.map(p => <option key={p._id} value={p.code}>{p.name} · {scopeName[p.scope]}</option>)}</datalist>
                    <button className="ghost" type="submit" disabled={!normalized}>{!dirty && applied ? 'Kiểm tra lại mã' : 'Áp dụng mã'}</button>
                </div>
                <p id="counter-promotion-hint" className="helperText">Khuyến mãi được tính trước điểm. Chỉ mã cho phép cộng dồn mới dùng cùng điểm thành viên.</p>
                <div className="counterPromotionActions">
                    {dirty && <button type="button" className="paymentTextButton" onClick={() => { setCode(applied?.code || ''); onCancelDraft(); }}>Hủy thay đổi mã</button>}
                    {applied && <button type="button" className="paymentTextButton" onClick={onRemove}>Bỏ mã khuyến mãi</button>}
                </div>
            </fieldset>
            {loadError && <p className="helperText" role="status">Chưa tải được danh sách gợi ý; bạn vẫn có thể nhập mã. <button type="button" className="paymentTextButton" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Tải lại mã gợi ý</button></p>}
        </form>}
        {applied ? <div className="counterPromotionApplied" role="status">
            <div><strong>{applied.code}</strong><span>−{money(booking.promotionDiscount)}</span></div>
            <p>{applied.name}</p>
            <p>Giảm {applied.discountType === 'percentage' ? `${applied.value}%` : money(applied.value)}{applied.maxDiscount != null ? `, tối đa ${money(applied.maxDiscount)}` : ''}</p>
            <p>{scopeName[applied.scope]} · Tối thiểu {money(applied.minOrder)} · {applied.stackable ? 'Được dùng cùng điểm' : 'Không dùng cùng điểm'}</p>
        </div> : <p className="helperText">Chưa áp dụng mã khuyến mãi.</p>}
    </section>;
}
