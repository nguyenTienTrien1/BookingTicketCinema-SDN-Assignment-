import { useEffect, useId, useRef } from 'react';
import placeholder from '../assets/foods/placeholder.svg';
export function AdminMediaImage({ src, alt, ...props }) {
  return <img {...props} src={src || placeholder} alt={alt} loading="lazy" onError={event => { if (event.currentTarget.src !== new URL(placeholder, window.location.href).href) event.currentTarget.src = placeholder; }} />;
}
export default function AdminDetailDialog({ title, onClose, children }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="adminDetailDialog" aria-labelledby={titleId} onClose={event => { if (!event.currentTarget.open) onClose(); }} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="adminDetailContent"><header><div><p>CHI TIẾT DANH MỤC</p><h2 id={titleId}>{title}</h2></div><button type="button" aria-label="Đóng chi tiết" onClick={onClose}>×</button></header>{children}</div>
  </dialog>;
}
