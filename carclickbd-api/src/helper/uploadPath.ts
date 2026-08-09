import path from 'path';
import fs from 'fs';
import os from 'os';

export const PUBLIC_UPLOAD_PREFIX = '/uploads';

export const getUploadRoots = () => {
  const configuredPath = process.env.UPLOAD_ROOT || process.env.UPLOAD_DIR;
  const home = os.homedir();
  const candidates = [
    configuredPath ? path.resolve(configuredPath) : null,
    path.join(home, 'domains', 'carclickbd-backend.jdmcarworld.com', 'carclickbd-uploads'),
    path.join(home, 'carclickbd-uploads'),
    path.resolve(process.cwd(), '..', 'carclickbd-uploads'),
    path.resolve(process.cwd(), '..', '..', 'carclickbd-uploads'),
    path.resolve(process.cwd(), 'carclickbd-uploads'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
};

export const getUploadRoot = () => {
  const roots = getUploadRoots();
  return roots.find(candidate => fs.existsSync(candidate)) || roots[0];
};
