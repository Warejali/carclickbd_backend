import path from 'path';

export const PUBLIC_UPLOAD_PREFIX = '/uploads';

export const getUploadRoot = () => {
  const configuredPath = process.env.UPLOAD_ROOT || process.env.UPLOAD_DIR;

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), '..', 'carclickbd-uploads');
};
