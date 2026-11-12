import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import './counterPromotion.css';

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ';
const scopeName = { food: 'Bắp nước', ticket: 'Vé', all: 'Toàn đơn' };

export default function CounterPromotion({ booking, editable, disabled, onApply, onReplacePoints, onRemove, onDraftChange, onCancelDraft, heading = 'Khuyến mãi tại quầy', foodOnly = false }) {
    const applied = booking.promotion;
    const [code, setCode] = useState(applied?.code || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [activeOption, setActiveOption] = useState(-1);
    const inputRef = useRef(null);
    const normalized = code.trim().toUpperCase();
    const dirty = normalized !== (applied?.code || '');
    const matches = suggestions.filter(p => !normalized || p.code.includes(normalized) || p.name.toLocaleUpperCase('vi-VN').includes(normalized));
    const dropdownOpen = optionsOpen && !disabled && matches.length > 0;
    function selectCode(value) {
        setCode(value); setOptionsOpen(false); setActiveOption(-1);
    }
    function navigateOptions(event) {
        if (event.key === 'Escape') { setOptionsOpen(false); setActiveOption(-1); return; }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
            event.preventDefault(); setOptionsOpen(true);
            const index = event.key === 'ArrowDown' ? (activeOption + 1) % matches.length : (activeOption <= 0 ? matches.length - 1 : activeOption - 1);
            setActiveOption(index);
            requestAnimationFrame(() => document.getElementById('promotion-option-' + index)?.scrollIntoView({ block: 'nearest' }));
        }
        if (event.key === 'Enter' && dropdownOpen && activeOption >= 0 && activeOption < matches.length) {
            event.preventDefault(); selectCode(matches[activeOption].code);
        }
    }
    const replacesPoints = !!onReplacePoints && booking.pointsUsed > 0 && suggestions.some(p => p.code === normalized && p.stackable === false);
    useEffect(() => { setCode(applied?.code || ''); }, [booking._id, applied?.code]);
    useEffect(() => { onDraftChange(dirty); }, [dirty, onDraftChange]);
    useEffect(() => {
        if (!editable) return;
        const controller = new AbortController(); setLoadError(false);
        api(foodOnly ? '/promotions?scope=food' : '/promotions', { signal: controller.signal })
            .then(data => { if (!controller.signal.aborted) { if (!Array.isArray(data)) throw new Error('Invalid catalogue'); setSuggestions(data); } })
            .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
        return () => controller.abort();
    }, [booking._id, editable, retry, foodOnly]);
    if (!editable && !applied) return null;
    return <section className="paymentPanel counterPromotion" aria-labelledby="counter-promotion-heading">
        <div className="panelHeading"><h3 id="counter-promotion-heading">{heading}</h3><span className="counterPromotionPolicy">1 mã / đơn</span></div>
        {editable && <form onSubmit={event => { event.preventDefault(); setOptionsOpen(false); if (normalized && !disabled) (replacesPoints ? onReplacePoints : onApply)(normalized); }}>
            <fieldset disabled={disabled}>
                <label htmlFor="counter-promotion-code">Mã khuyến mãi</label>
                <div className="counterPromotionControl">
                    <div className="counterPromotionInput" onBlur={event => { if (!event.currentTarget.parentElement.contains(event.relatedTarget)) { setOptionsOpen(false); setActiveOption(-1); } }}>
                        <input ref={inputRef} id="counter-promotion-code" role="combobox" aria-autocomplete="list" aria-expanded={dropdownOpen} aria-controls="counter-promotion-options" aria-activedescendant={dropdownOpen && activeOption >= 0 ? 'promotion-option-' + activeOption : undefined}
                            value={code} onChange={event => { setCode(event.target.value); setOptionsOpen(true); setActiveOption(-1); }} onFocus={() => setOptionsOpen(true)} onKeyDown={navigateOptions}
                            maxLength={40} autoComplete="off" spellCheck={false} placeholder="Nhập mã khuyến mãi" aria-describedby="counter-promotion-hint" />
                        <button type="button" className="counterPromotionToggle" aria-label="Hiện mã gợi ý" aria-expanded={dropdownOpen} disabled={!suggestions.length} onMouseDown={event => event.preventDefault()} onClick={() => { inputRef.current?.focus(); setOptionsOpen(!dropdownOpen); setActiveOption(-1); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        <div id="counter-promotion-options" className="counterPromotionOptions" role="listbox" aria-label="Mã khuyến mãi gợi ý" hidden={!dropdownOpen}>
                            {matches.map((p, index) => <button key={p._id} id={'promotion-option-' + index} type="button" role="option" aria-selected={index === activeOption} tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => selectCode(p.code)}>
                                <strong>{p.code}</strong><span>{p.name} · {scopeName[p.scope]}</span>
                                <small>{p.discountType === 'percentage' ? `Giảm ${p.value}%` : `Giảm ${money(p.value)}`}{p.minOrder > 0 ? ` · Từ ${money(p.minOrder)}` : ''}</small>
                            </button>)}
                        </div>
                    </div>
                    <button className="ghost" type="submit" disabled={!normalized}>{replacesPoints ? 'Bỏ điểm và áp dụng mã' : !dirty && applied ? 'Kiểm tra lại mã' : 'Áp dụng mã'}</button>
                </div>
                <p id="counter-promotion-hint" className="helperText">{foodOnly ? 'Áp dụng một mã dành cho F&B hoặc toàn đơn trước khi thanh toán.' : 'Khuyến mãi được tính trước điểm. Chỉ mã cho phép cộng dồn mới dùng cùng điểm thành viên.'}</p>
                {replacesPoints && <p className="promotionPointsConflict" role="status">Mã {normalized} không dùng cùng {booking.pointsUsed} điểm đang áp dụng. Chọn “Bỏ điểm và áp dụng mã” để dùng mã và giữ lại điểm trong tài khoản.</p>}
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
