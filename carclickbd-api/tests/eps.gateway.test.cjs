const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
Object.assign(process.env, { EPS_USERNAME: 'test-user', EPS_PASSWORD: 'test-pass', EPS_HASH_KEY: 'test-key', EPS_MERCHANT_ID: 'merchant', EPS_STORE_ID: 'store', EPS_API_BASE_URL: 'https://sandboxpgapi.eps.com.bd' });
const { epsHash, initializeEPS, verifyEPS, verifiedEPSStatus } = require('../dist/app/modules/payment/eps.gateway');
const valid = { MerchantTransactionId: '1234567890123', TotalAmount: '800.00', Status: 'Success', EpsTransactionId: 'EPS123' };

test('HMAC SHA512 uses UTF8 key, UTF8 input and Base64 digest (RFC 4231)', () => {
  const expected = Buffer.from('164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737', 'hex').toString('base64');
  assert.equal(epsHash('what do ya want for nothing?', 'Jefe'), expected);
});
test('only verified success with matching reference, amount and EPS ID is paid', () => {
  assert.equal(verifiedEPSStatus(valid, valid.MerchantTransactionId, 800), 'PAID');
  for (const override of [{ MerchantTransactionId: 'other' }, { TotalAmount: '1.00' }, { TotalAmount: null }, { TotalAmount: '' }, { EpsTransactionId: '' }]) {
    assert.throws(() => verifiedEPSStatus({ ...valid, ...override }, valid.MerchantTransactionId, 800));
  }
  assert.equal(verifiedEPSStatus({ ...valid, Status: 'Pending' }, valid.MerchantTransactionId, 800), 'PENDING');
  assert.equal(verifiedEPSStatus({ ...valid, Status: 'Cancelled' }, valid.MerchantTransactionId, 800), 'FAILED');
  assert.equal(verifiedEPSStatus({ ...valid, Status: 'unrecognized' }, valid.MerchantTransactionId, 800), 'PENDING');
});
test('initialization authenticates, signs merchant reference and uses Web transaction type', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => calls.length === 1 ? { token: 'test-token' } : { TransactionId: 'gateway-id', RedirectURL: 'https://sandboxpg.eps.com.bd/PG?data=gateway-id' } };
  };
  const result = await initializeEPS({ merchantTransactionId: valid.MerchantTransactionId, totalAmount: 800 });
  assert.equal(result.gatewayId, 'gateway-id');
  assert.equal(calls[0].options.headers['x-hash'], epsHash('test-user', 'test-key'));
  assert.equal(calls[1].options.headers['x-hash'], epsHash(valid.MerchantTransactionId, 'test-key'));
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');
  assert.equal(JSON.parse(calls[1].options.body).transactionTypeId, 1);
  assert.equal(JSON.parse(calls[1].options.body).storeId, 'store');
});
test('verification sends GET with the matching signed query reference', async () => {
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => calls.length === 1 ? { token: 'token' } : valid }; };
  await verifyEPS(valid.MerchantTransactionId);
  assert.equal(calls[1].options.method, 'GET');
  assert.ok(calls[1].url.endsWith('?merchantTransactionId=1234567890123'));
  assert.equal(calls[1].options.headers['x-hash'], epsHash(valid.MerchantTransactionId, 'test-key'));
});
test('gateway failures are sanitized and initialization is not automatically retried', async () => {
  let count = 0;
  global.fetch = async () => { count++; throw new Error('secret credentials'); };
  await assert.rejects(initializeEPS({ merchantTransactionId: '1234567890' }), error => !error.message.includes('secret credentials'));
  assert.equal(count, 1);
});
test('checkout redirect must belong to the configured EPS environment', async () => {
  let count = 0;
  global.fetch = async () => ({ ok: true, json: async () => ++count === 1 ? { token: 'token' } : { TransactionId: 'id', RedirectURL: 'https://evil.example/payment' } });
  await assert.rejects(initializeEPS({ merchantTransactionId: '1234567890' }), /invalid checkout URL/);
});
test('definite EPS validation rejection is distinguished from an ambiguous failure', async () => {
 const { EPSRejectedRequest } = require('../dist/app/modules/payment/eps.gateway');
 let calls = 0;
 global.fetch = async () => ({ ok: true, status: 200, json: async () => ++calls === 1 ? { token: 'token' } : { TransactionId: null, RedirectURL: null, ErrorCode: 400, ErrorMessage: 'Invalid customer phone' } });
 await assert.rejects(initializeEPS({ merchantTransactionId: '1234567890' }), e => e instanceof EPSRejectedRequest);
 calls = 0;
 global.fetch = async () => ({ ok: true, status: 200, json: async () => ++calls === 1 ? { token: 'token' } : { ErrorCode: 400, ErrorMessage: 'Transaction already exists' } });
 await assert.rejects(initializeEPS({ merchantTransactionId: '1234567890' }), e => !(e instanceof EPSRejectedRequest));
});
test('actual EPS Cancel status is not treated as success or pending', () => {
 assert.equal(verifiedEPSStatus({ ...valid, Status: 'Cancel' }, valid.MerchantTransactionId, 800), 'FAILED');
});
