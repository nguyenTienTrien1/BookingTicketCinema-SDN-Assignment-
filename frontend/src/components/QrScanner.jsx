import { useEffect, useRef, useState } from 'react';

export default function QrScanner({ onDecoded, disabled }) {
    const [active, setActive] = useState(false);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState('');
    const video = useRef(null);
    const imageRequest = useRef(0);
    const callback = useRef(onDecoded);
    callback.current = onDecoded;
    useEffect(() => () => { imageRequest.current++; }, []);
    useEffect(() => {
        if (disabled) { imageRequest.current++; setActive(false); setReading(false); }
    }, [disabled]);
    useEffect(() => {
        if (!active || disabled) return;
        let cancelled = false, controls;
        async function start() {
            try {
                const { BrowserQRCodeReader } = await import('@zxing/browser');
                if (cancelled) return;
                controls = await new BrowserQRCodeReader().decodeFromVideoDevice(undefined, video.current, (result, _error, scanner) => {
                    if (!result || cancelled) return;
                    cancelled = true;
                    scanner.stop(); setActive(false); callback.current(result.getText());
                });
                if (cancelled) controls.stop();
            } catch {
                if (!cancelled) { setActive(false); setError('Không mở được camera. Bạn có thể chọn ảnh QR hoặc nhập mã vé.'); }
            }
        }
        start();
        return () => { cancelled = true; controls?.stop(); };
    }, [active, disabled]);

    async function readImage(event) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        const request = ++imageRequest.current;
        setError(''); setActive(false);
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
            setError('Chọn ảnh PNG/JPEG/WebP không quá 8 MB.'); return;
        }
        const url = URL.createObjectURL(file);
        setReading(true);
        try {
            const { BrowserQRCodeReader } = await import('@zxing/browser');
            if (request !== imageRequest.current) return;
            const image = new Image();
            image.src = url;
            await image.decode();
            if (request !== imageRequest.current) return;
            const result = await new BrowserQRCodeReader().decodeFromImageElement(image);
            if (request === imageRequest.current) callback.current(result.getText());
        } catch { if (request === imageRequest.current) setError('Không đọc được QR trong ảnh. Hãy chọn ảnh rõ hơn hoặc nhập mã vé.'); }
        finally { URL.revokeObjectURL(url); if (request === imageRequest.current) setReading(false); }
    }

    return <section className="qrScanner" aria-label="Đọc mã QR">
        <div className="qrScannerActions">
            <button type="button" className="movieSecondary" disabled={disabled || reading} onClick={() => { setError(''); setActive((value) => !value); }}>
                {active ? 'Tắt camera' : 'Bật camera quét QR'}
            </button>
            <label>Chọn ảnh QR<input type="file" accept="image/png,image/jpeg,image/webp" onChange={readImage} disabled={disabled || reading} /></label>
        </div>
        {active && <video ref={video} muted playsInline aria-label="Camera quét vé" />}
        {reading && <p role="status">Đang đọc ảnh QR…</p>}
        {error && <p className="movieError" role="alert">{error}</p>}
    </section>;
}
