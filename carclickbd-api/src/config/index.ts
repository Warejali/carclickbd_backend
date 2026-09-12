import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT || 5000,
  email: process.env.EMAIL,
  email_secret: process.env.EMAIL_PASSWORD,
  verification_url: process.env.EMAIL_VERIFICATION_URL,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  reset_password_url: process.env.RESET_PASSWORD_URL,
  verify_user_url: process.env.VERIFY_USER_URL,
  super_admin_id: process.env.SUPER_ADMIN_ID,
  stripe_secret_key: process.env.STRIPE_SECRET_KEY,
  stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
  frontend_url:
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL,
  backend_url: process.env.BACKEND_URL || process.env.API_PUBLIC_URL,
  auction_sheet_price_bdt: Number(process.env.AUCTION_SHEET_PRICE_BDT || 800),
  auction_sheet_root:
    process.env.AUCTION_SHEET_ROOT ||
    `${process.env.UPLOAD_ROOT || process.env.UPLOAD_DIR || ''}/auction-sheets`,
  eps: {
    username: process.env.EPS_USERNAME,
    password: process.env.EPS_PASSWORD,
    hash_key: process.env.EPS_HASH_KEY,
    merchant_id: process.env.EPS_MERCHANT_ID,
    store_id: process.env.EPS_STORE_ID,
    api_base_url: process.env.EPS_API_BASE_URL || 'https://pgapi.eps.com.bd',
  },
  jpcenter: {
    api_code:
      process.env.JPCENTER_API_CODE ||
      process.env.JPCENTER_API_KEY ||
      process.env.JPCENTER_CODE,
    api_base_url:
      process.env.JPCENTER_API_BASE_URL || 'https://jpcenter.ru/api/report',
  },
  facebook: {
    page_id: process.env.FACEBOOK_PAGE_ID,
    page_access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    graph_api_version: process.env.FACEBOOK_GRAPH_API_VERSION || 'v26.0',
    auto_post: process.env.FACEBOOK_AUTO_POST !== 'false',
  },
  // google: {
  //   client_id: process.env.GOOGLE_CLIENT_ID,
  //   client_secret: process.env.GOOGLE_CLIENT_SECRET,
  //   callback_url: process.env.GOOGLE_CALLBACK_URL,
  // },

  jwt: {
    accessTokenSecret: process.env.JWT_ACCESSTOKEN_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESHTOKEN_SECRET,
    accessTokenExpireIn: process.env.JWT_ACCESSTOKEN_EXPIRE,
    refreshTokenExpireIn: process.env.JWT_REFRESHTOKEN_EXPIRE,
    tokenSecret: process.env.JWT_TOKEN_SESECRET,
    expires_in: process.env.JWT_EXPIRES_IN,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },
};
