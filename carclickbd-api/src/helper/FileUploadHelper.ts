/* eslint-disable @typescript-eslint/no-explicit-any */
import multer from 'multer';
import * as fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { IUploadFile } from '../inerfaces/file';
import ApiError from '../errors/ApiError';
import httpStatus from 'http-status';
import { getUploadRoot, PUBLIC_UPLOAD_PREFIX } from './uploadPath';

const UPLOAD_ROOT = getUploadRoot();
const TEMP_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'tmp');
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(UPLOAD_ROOT);
ensureDir(TEMP_UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDir(TEMP_UPLOAD_DIR);
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const parsed = path.parse(file.originalname || 'image');
    const safeBaseName =
      parsed.name
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'image';
    const suffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

    cb(null, `${safeBaseName}-${suffix}${parsed.ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fieldSize: 1024 * 1024 * 1024,
    fields: 100,
    files: 50,
    parts: 200,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(
        new ApiError(
          httpStatus.BAD_REQUEST,
          'Only JPG, PNG, WebP, or AVIF images are allowed',
        ) as any,
      );
    }

    return cb(null, true);
  },
});

const getSafeFolder = (folder = 'products') =>
  folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'products';

const getFolderFromField = (fieldname?: string) =>
  fieldname === 'file' || fieldname === 'profilePhoto' ? 'users' : 'products';

const createUniqueFileName = (originalName: string) => {
  const parsed = path.parse(originalName || 'image');
  const baseName =
    parsed.name
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'image';
  const suffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

  return `${baseName}-${suffix}.webp`;
};

const cleanupTempFile = async (file: IUploadFile) => {
  if (!file.path) {
    return;
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path);
      }
      return;
    } catch (error: any) {
      if (attempt === 3) {
        console.warn(
          `Unable to remove temporary upload file: ${file.path}`,
          error?.message || error,
        );
        return;
      }

      await new Promise(resolve => setTimeout(resolve, attempt * 150));
    }
  }
};

const uploadSingleImage = async (
  file: IUploadFile,
  folder = getFolderFromField(file?.fieldname),
): Promise<string> => {
  if (!file?.path) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Image file is missing');
  }

  const safeFolder = getSafeFolder(folder);
  const uploadDir = path.join(UPLOAD_ROOT, safeFolder);
  ensureDir(uploadDir);

  const filename = createUniqueFileName(file.originalname);
  const outputPath = path.join(uploadDir, filename);
  const publicPath =
    `${PUBLIC_UPLOAD_PREFIX}/${safeFolder}/${filename}`.replace(/\\/g, '/');

  try {
    await sharp(file.path, { limitInputPixels: false })
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(outputPath);
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      await fs.promises.unlink(outputPath);
    }

    await cleanupTempFile(file);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Image upload failed');
  }

  await cleanupTempFile(file);
  return publicPath;
};

const uploadMultipleImages = async (
  files: IUploadFile[],
  folder = 'products',
): Promise<string[]> =>
  Promise.all(files.map(file => uploadSingleImage(file, folder)));

const resolveLocalPathFromUrl = (url: string): string | null => {
  if (!url) {
    return null;
  }

  let pathname = url;

  try {
    if (/^https?:\/\//i.test(url)) {
      pathname = new URL(url).pathname;
    }
  } catch {
    pathname = url;
  }

  if (!pathname.startsWith(PUBLIC_UPLOAD_PREFIX)) {
    return null;
  }

  const relativePath = pathname
    .replace(PUBLIC_UPLOAD_PREFIX, '')
    .replace(/^\/+/, '');
  const resolvedPath = path.resolve(UPLOAD_ROOT, relativePath);

  if (!resolvedPath.startsWith(path.resolve(UPLOAD_ROOT))) {
    return null;
  }

  return resolvedPath;
};

const deleteImageByUrl = async (url: string) => {
  const localPath = resolveLocalPathFromUrl(url);

  if (localPath && fs.existsSync(localPath)) {
    await fs.promises.unlink(localPath);
  }
};

const deleteMultipleImagesByUrl = async (urls: string[]) => {
  await Promise.all(urls.filter(Boolean).map(url => deleteImageByUrl(url)));
};

export const FileUploadHelper = {
  deleteImageByUrl,
  deleteMultipleImagesByUrl,
  uploadSingleImage,
  uploadMultipleImages,
  upload,
};
