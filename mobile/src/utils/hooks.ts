import { useRef, useState } from 'react';
export function useAction() {
  // ref khóa ngay lập tức để chặn bấm lặp, không phải chờ state busy render lại.
  const lock = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // Thành công hay thất bại đều mở khóa; error được màn hình đọc để hiển thị.
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, setError, setNotice, run };
}
