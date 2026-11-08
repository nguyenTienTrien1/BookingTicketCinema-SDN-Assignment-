import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const FOOD_IMAGE_DIRECTORY = fileURLToPath(new URL("../../../uploads/foods/", import.meta.url));
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }

function detectedType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function storeFoodImage(buffer, contentType) {
  return storeImage(buffer, contentType, 'foods');
}
async function storeImage(buffer, contentType, folder) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw invalid('Vui lòng chọn một ảnh.');
  if (buffer.length > MAX_IMAGE_BYTES) throw invalid('Ảnh không được vượt quá 5 MB.');
  // Check bytes before decoding: a renamed SVG/script is never accepted as a raster image.
  if (!IMAGE_TYPES.includes(contentType) || detectedType(buffer) !== contentType) {
    throw invalid('Nội dung ảnh không đúng định dạng JPG, PNG hoặc WebP.');
  }
  let output;
  try {
    const image = sharp(buffer, { failOn: 'warning', limitInputPixels: 20000000 });
    const metadata = await image.metadata();
    if (metadata.pages > 1) throw new Error('Animated image');
    // Re-encode, orient and resize; uploaded metadata and original filenames are not kept.
    output = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
  } catch {
    throw invalid('Không đọc được ảnh. Hãy dùng ảnh tĩnh JPG, PNG hoặc WebP hợp lệ, tối đa 20 megapixel.');
  }
  const directory = new URL(`../../../uploads/${folder}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await writeFile(new URL(filename, directory), output, { flag: 'wx' });
  return `/api/uploads/${folder}/${filename}`;
}
