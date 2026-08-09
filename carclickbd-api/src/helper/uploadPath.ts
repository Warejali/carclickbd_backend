import path from 'path';
import fs from 'fs';
import os from 'os';

export const PUBLIC_UPLOAD_PREFIX = '/uploads';

export const getUploadRoot = () => {
  const configuredPath = process.env.UPLOAD_ROOT || process.env.UPLOAD_DIR;

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  // Hostinger Web Apps may run from a deployment/build directory while the
  // persistent upload folder lives at the hosting account's home directory.
  // Prefer that persistent location, then support the older relative layout.
  const candidates = [
    path.join(os.homedir(), 'carclickbd-uploads'),
    path.resolve(process.cwd(), '..', 'carclickbd-uploads'),
    path.resolve(process.cwd(), '..', '..', 'carclickbd-uploads'),
    path.resolve(process.cwd(), 'carclickbd-uploads'),
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
};
