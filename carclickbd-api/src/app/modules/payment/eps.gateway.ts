import crypto from 'crypto';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';

export class EPSRejectedRequest extends ApiError {
  constructor() {
    super(
      502,
      'EPS rejected checkout. Please check customer details and try again.',
    );
  }
}

export const epsHash = (value: string, key: string) =>
  crypto
    .createHmac('sha512', Buffer.from(key, 'utf8'))
    .update(value, 'utf8')
    .digest('base64');

export const assertEPSConfigured = () => {
  const eps = config.eps;
  if (
    !eps.username ||
    !eps.password ||
    !eps.hash_key ||
    !eps.merchant_id ||
    !eps.store_id
  ) {
    throw new ApiError(503, 'EPS credentials are not configured');
  }
  const base = eps.api_base_url.replace(/\/+$/, '');
  if (
    !['https://pgapi.eps.com.bd', 'https://sandboxpgapi.eps.com.bd'].includes(
      base,
    )
  ) {
    throw new ApiError(503, 'Invalid EPS API base URL');
  }
  return { ...eps, base };
};

const request = async (
  path: string,
  hashValue: string,
  body?: unknown,
  token?: string,
): Promise<any> => {
  const eps = assertEPSConfigured();
  try {
    const response = await fetch(`${eps.base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-hash': epsHash(hashValue, eps.hash_key!),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (
      !response.ok ||
      data.ErrorMessage ||
      data.errorMessage ||
      data.ErrorCode ||
      data.errorCode
    ) {
      const detail = String(data.ErrorMessage || data.errorMessage || '');
      if (
        path.endsWith('/InitializeEPS') &&
        response.status < 500 &&
        ![408, 409, 429].includes(response.status) &&
        !data.TransactionId &&
        !data.RedirectURL &&
        !/duplicate|already|exists/i.test(detail) &&
        (data.ErrorMessage ||
          data.errorMessage ||
          [400, 401, 403, 422].includes(response.status))
      ) {
        throw new EPSRejectedRequest();
      }
      throw new Error('EPS rejected request');
    }
    return data;
  } catch (error) {
    if (error instanceof EPSRejectedRequest) throw error;
    // Never include gateway responses, authentication tokens or secrets in errors.
    throw new ApiError(
      502,
      'EPS request could not be completed. Please check payment status before retrying.',
    );
  }
};

export const getEPSToken = async () => {
  const eps = assertEPSConfigured();
  const data = await request('/v1/Auth/GetToken', eps.username!, {
    userName: eps.username,
    password: eps.password,
  });
  if (!data.token || typeof data.token !== 'string')
    throw new ApiError(502, 'EPS authentication failed');
  return data.token as string;
};

export const initializeEPS = async (
  payload: Record<string, unknown>,
  authToken?: string,
) => {
  const eps = assertEPSConfigured();
  const token = authToken || (await getEPSToken());
  const data = await request(
    '/v1/EPSEngine/InitializeEPS',
    String(payload.merchantTransactionId),
    {
      ...payload,
      merchantId: eps.merchant_id,
      storeId: eps.store_id,
      transactionTypeId: 1,
    },
    token,
  );
  const url = new URL(data.RedirectURL);
  const host = eps.base.includes('sandbox')
    ? 'sandboxpg.eps.com.bd'
    : 'pg.eps.com.bd';
  if (
    url.protocol !== 'https:' ||
    url.hostname !== host ||
    !data.TransactionId
  ) {
    throw new ApiError(502, 'EPS returned an invalid checkout URL');
  }
  return { paymentUrl: url.toString(), gatewayId: String(data.TransactionId) };
};

export const verifyEPS = async (reference: string) =>
  request(
    `/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${encodeURIComponent(reference)}`,
    reference,
    undefined,
    await getEPSToken(),
  );

export const verifiedEPSStatus = (
  data: any,
  reference: string,
  amount: number,
): 'PENDING' | 'PAID' | 'FAILED' => {
  if (
    data?.MerchantTransactionId !== reference ||
    !/^\d+(\.\d{1,2})?$/.test(String(data?.TotalAmount)) ||
    Math.round(Number(data.TotalAmount) * 100) !== Math.round(amount * 100)
  ) {
    throw new ApiError(
      502,
      'EPS transaction reference or amount does not match',
    );
  }
  if (data.Status === 'Success') {
    if (!data.EpsTransactionId)
      throw new ApiError(502, 'EPS transaction ID is missing');
    return 'PAID';
  }
  if (
    ['Failed', 'Fail', 'Cancel', 'Cancelled', 'Canceled'].includes(data.Status)
  )
    return 'FAILED';
  return 'PENDING';
};
