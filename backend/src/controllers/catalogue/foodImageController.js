import express from 'express';
import { FOOD_IMAGE_DIRECTORY, IMAGE_TYPES, MAX_IMAGE_BYTES, storeFoodImage } from "../../services/catalogue/foodImageService.js";

export function protectImageUpload(req, res, next) {
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (req.get('Sec-Fetch-Site') === 'cross-site' || (req.get('Origin') && req.get('Origin') !== allowedOrigin)) {
    return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
  }
  if (!IMAGE_TYPES.includes(req.get('Content-Type')?.split(';')[0].trim().toLowerCase())) {
    return res.status(415).json({ message: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' });
  }
  next();
}

const rawImage = express.raw({ type: () => true, limit: MAX_IMAGE_BYTES });
export function readImage(req, res, next) {
  rawImage(req, res, (error) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Ảnh không được vượt quá 5 MB.' });
    next(error);
  });
}

export async function uploadImage(req, res, next) {
  try {
    const image = await storeFoodImage(req.body, req.get('Content-Type').split(';')[0].trim().toLowerCase());
    res.status(201).json({ image });
  } catch (error) { next(error); }
}

export function serveImage(req, res, next) {
  return serveFromDirectory(req, res, next, FOOD_IMAGE_DIRECTORY);
}
function serveFromDirectory(req, res, next, directory) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(req.params.filename)) {
    return res.status(404).json({ message: 'Không tìm thấy ảnh.' });
  }
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(req.params.filename, { root: directory, maxAge: '1y', immutable: true, dotfiles: 'deny' }, (error) => {
    if (!error) return;
    if (error.status === 404 || error.code === 'ENOENT') return res.status(404).json({ message: 'Không tìm thấy ảnh.' });
    next(error);
  });
}
