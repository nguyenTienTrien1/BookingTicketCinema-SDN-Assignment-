import { useRef, useState } from 'react';

export function useFieldErrors() {
  const [fieldErrors, setFieldErrors] = useState({});
  const scheduled = useRef(false);
  function onInvalid(event) {
    event.preventDefault();
    const field = event.target, form = field.form;
    const validity = field.validity;
    const message = validity.valueMissing ? 'Vui lòng điền trường này.' : validity.rangeUnderflow ? `Giá trị tối thiểu: ${field.min}.` : validity.rangeOverflow ? `Giá trị tối đa: ${field.max}.` : validity.stepMismatch ? 'Nhập giá trị đúng bước cho phép.' : validity.patternMismatch ? (field.title || 'Thông tin chưa đúng định dạng.') : 'Vui lòng kiểm tra giá trị đã nhập.';
    setFieldErrors(current => ({ ...current, [field.id]: message }));
    if (!scheduled.current) {
      scheduled.current = true;
      requestAnimationFrame(() => {
        const first = form?.querySelector(':invalid:not(fieldset)');
        const details = first?.closest('details'); if (details) details.open = true;
        first?.focus({ preventScroll: true }); first?.scrollIntoView({ block: 'center', behavior: 'auto' });
        scheduled.current = false;
      });
    }
  }
  function onChange(event) {
    const field = event.target;
    if (fieldErrors[field.id] && field.validity?.valid) setFieldErrors(current => ({ ...current, [field.id]: '' }));
  }
  return { fieldErrors, onInvalid, onChange, resetFieldErrors: () => setFieldErrors({}) };
}
export default function FormFieldError({ error }) {
  return error ? <small className="adminFieldError" role="alert">{error}</small> : null;
}
