// The picker may re-encode an image while retaining its original MIME metadata.
// Send the type of the actual upload bytes, not the original filename/metadata.
export function decodeImageUpload(base64: string) {
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
  catch { throw new Error('Không đọc được dữ liệu ảnh. Vui lòng chọn lại ảnh.'); }
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Ảnh phải nhỏ hơn hoặc bằng 5 MB.');
  const startsWith = (signature: number[]) => bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  const contentType = startsWith([255, 216, 255]) ? 'image/jpeg'
    : startsWith([137, 80, 78, 71, 13, 10, 26, 10]) ? 'image/png'
      : bytes.length >= 12 && startsWith([82, 73, 70, 70]) && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value) ? 'image/webp' : null;
  if (!contentType) throw new Error('Nội dung ảnh phải là JPG, PNG hoặc WebP. Vui lòng chọn ảnh khác.');
  return { bytes, contentType };
}
