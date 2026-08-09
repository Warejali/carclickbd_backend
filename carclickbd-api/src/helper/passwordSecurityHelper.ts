import bcrypt from 'bcrypt';
import config from '../config';

export const convertHashPassword = async (
  password: string,
): Promise<string> => {
  return await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};
