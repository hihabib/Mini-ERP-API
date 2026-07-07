import multer, { type FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import type { Request } from 'express';
import { env } from '../../config/env.js';
import type { StorageAdapter } from './storage.interface.js';

const UPLOAD_PATH = path.resolve(env.UPLOAD_DIR);

// Ensure the upload directory exists before any request arrives
fs.mkdirSync(UPLOAD_PATH, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const diskStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_PATH);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpeg, png, and webp images are allowed'));
  }
}

export const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});

export const localStorageAdapter: StorageAdapter = {
  async saveImage(file) {
    return `/uploads/${file.filename}`;
  },

  async deleteImage(imageUrl) {
    const filename = path.basename(imageUrl);
    const filePath = path.join(UPLOAD_PATH, filename);
    await fsPromises.unlink(filePath).catch(() => {});
  },
};
