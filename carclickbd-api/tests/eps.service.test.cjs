const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const id = '123456789012345678901234';
let records, order, sent, remote, paidWrites, configured, prepared;
const matches = (r, f) => r && Object.entries(f).every(([k,v]) => v && typeof v === 'object' && '$ne' in v ? r[k] !== v.$ne : r[k] === v);
const checkoutModel = {
  findById: async key => records.get(key) ? { ...records.get(key) } : null,
  findOne: async f => [...records.values()].find(r => matches(r, f)) || null,
  create: async r => { if (records.has(r._id)) throw Object.assign(new Error('duplicate'), { code: 11000 }); records.set(r._id, { ...r }); },
  updateOne: async (f, u) => { const r = [...records.values()].find(r => matches(r, f)); if (!r) return { modifiedCount: 0 }; Object.assign(r, u.$set || u); return { modifiedCount: 1 }; },
};
const gateway = require('../dist/app/modules/payment/eps.gateway');
const mocks = {
  '../../../config': { __esModule: true, default: { frontend_url: 'https://carclickbd.com', backend_url: 'https://api.carclickbd.com' } },
  '../order/order.model': { Order: { findById: async () => order, updateOne: async () => { paidWrites++; } } },
  '../user/user.model': { User: { findById: async () => ({ name: 'Buyer', email: 'buyer@example.com', contactNo: '01700000000' }) } },
  './payment.model': { Payment: { updateOne: async () => { paidWrites++; } } },
  '../auctionSheet/auctionSheet.model': { AuctionSheetOrder: { updateOne: async () => { paidWrites++; } } },
  '../auctionSheet/auctionSheet.service': { AuctionSheetService: {
    getOrderById: async () => order,
    prepareAuctionSheetFile: async () => { if (!prepared) throw new Error('No report'); },
    getPaymentStatus: async () => ({ paid: false, status: 'PENDING' }),
  } },
  './eps.model': { EPSCheckout: checkoutModel },
  './eps.gateway': {
    EPSRejectedRequest: gateway.EPSRejectedRequest,
    assertEPSConfigured: () => { if (!configured) throw new Error('Credentials missing'); },
    getEPSToken: async () => 'test-token',
    initializeEPS: async p => { sent.push(p); return { paymentUrl: 'https://pg.eps.com.bd/PG?data=id', gatewayId: 'id' }; },
    verifyEPS: async ref => ({ MerchantTransactionId: ref, TotalAmount: '800.00', EpsTransactionId: 'EPS-paid-id', ...remote }),
    verifiedEPSStatus: gateway.verifiedEPSStatus,
  },
};
const original = Module._load;
Module._load = function(name, parent, main) { if (parent?.filename.endsWith('eps.service.js') && mocks[name]) return mocks[name]; return original.call(this, name, parent, main); };
const { EPSService } = require('../dist/app/modules/payment/eps.service');
Module._load = original;
function reset() {
  records = new Map(); sent = []; paidWrites = 0; configured = true; prepared = true; remote = { Status: 'Pending' };
  order = { serverPriced: true, _id: id, user: 'owner', totalAmount: 800, amount: 800, name: 'Buyer', email: 'buyer@example.com', mobileNumber: '01700000000', chassis: 'ABC123', address: 'Dhaka' };
}
test('checkout rejects another user before creating a gateway session', async () => {
  reset(); await assert.rejects(EPSService.init('order', id, 'attacker'), /belongs to another/); assert.equal(sent.length, 0);
});
test('checkout uses stored amount and server-controlled return URLs', async () => {
  reset(); await EPSService.init('order', id, 'owner'); assert.equal(sent[0].totalAmount, 800); assert.ok(sent[0].merchantTransactionId.length <= 30);
  assert.ok(sent[0].successUrl.startsWith('https://api.carclickbd.com/api/v1/payment/eps/return/'));
  assert.ok(sent[0].successUrl.includes(`/eps/return/${sent[0].merchantTransactionId}`));
});
test('simultaneous checkout requests reserve only one gateway session', async () => {
  reset(); await Promise.allSettled([EPSService.init('order', id, 'owner'), EPSService.init('order', id, 'owner')]); assert.equal(sent.length, 1);
});
test('missing configuration does not strand a checkout reservation', async () => {
  reset(); configured = false; await assert.rejects(EPSService.init('order', id, 'owner')); assert.equal(records.size, 0);
});
test('auction sheet must exist before checkout', async () => {
  reset(); prepared = false; await assert.rejects(EPSService.init('auction-sheet', id), /No report/); assert.equal(sent.length, 0); assert.equal(records.size, 0);
});
test('wrong remote amount cannot fulfill an order', async () => {
  reset(); const session = await EPSService.init('order', id, 'owner'); remote = { Status: 'Success', TotalAmount: '1.00' };
  await assert.rejects(EPSService.sync(session.session_token, 'owner'), /does not match/); assert.equal(paidWrites, 0);
});
test('verified success fulfills, and later failure cannot downgrade paid state', async () => {
  reset(); const session = await EPSService.init('order', id, 'owner'); remote = { Status: 'Success' };
  assert.equal((await EPSService.sync(session.session_token, 'owner')).status, 'PAID'); assert.equal(paidWrites, 2);
  remote = { Status: 'Failed' }; assert.equal((await EPSService.sync(session.session_token, 'owner')).status, 'PAID');
});
test('status endpoint rejects a different user', async () => {
  reset(); const session = await EPSService.init('order', id, 'owner'); await assert.rejects(EPSService.sync(session.session_token, 'attacker'), /belongs to another/);
});

test('existing checkout is reused even when EPS reports Cancel before payment', async () => {
  reset(); const first = await EPSService.init('order', id, 'owner');
  const reused = await EPSService.init('order', id, 'owner'); assert.equal(reused.session_token, first.session_token); assert.equal(sent.length, 1);
  remote = { Status: 'Cancel' }; const retry = await EPSService.init('order', id, 'owner'); assert.equal(retry.session_token, first.session_token); assert.equal(sent.length, 1);
});
test('failed auction payment stays unfulfilled, success unlocks it', async () => {
  reset(); const first = await EPSService.init('auction-sheet', id);
  remote = { Status: 'Failed' }; assert.equal((await EPSService.sync(first.session_token)).status, 'FAILED'); assert.equal(paidWrites, 0);
  remote = { Status: 'Success' }; assert.equal((await EPSService.sync(first.session_token)).status, 'PAID'); assert.equal(paidWrites, 1);
});

test('legacy browser-priced order cannot start payment', async () => {
  reset(); order.serverPriced = false;
  await assert.rejects(EPSService.init('order', id, 'owner'), /new order/); assert.equal(sent.length, 0);
});
test('explicit rejection is retryable without verifying a nonexistent transaction', async () => {
  reset(); const normal = mocks['./eps.gateway'].initializeEPS;
  mocks['./eps.gateway'].initializeEPS = async () => { throw new gateway.EPSRejectedRequest(); };
  await assert.rejects(EPSService.init('order', id, 'owner'), /rejected checkout/);
  assert.equal(records.get(`order:${id}`).initializationState, 'REJECTED');
  mocks['./eps.gateway'].initializeEPS = normal;
  await EPSService.init('order', id, 'owner'); assert.equal(sent.length, 1);
});
test('ambiguous connection failure retains checkout reservation', async () => {
  reset(); const normal = mocks['./eps.gateway'].initializeEPS;
  mocks['./eps.gateway'].initializeEPS = async () => { throw new Error('timeout'); };
  await assert.rejects(EPSService.init('order', id, 'owner'), /timeout/);
  assert.equal(records.get(`order:${id}`).initializationState, 'UNKNOWN');
  mocks['./eps.gateway'].initializeEPS = normal;
  await assert.rejects(EPSService.init('order', id, 'owner'), /still being confirmed/); assert.equal(sent.length, 0);
});

test('gateway return verifies payment before redirecting to the fixed frontend origin', async () => {
 reset(); const first = await EPSService.init('order', id, 'owner'); remote = { Status: 'Success' };
 const url = new URL(await EPSService.handleReturn(first.session_token));
 assert.equal(url.origin, 'https://carclickbd.com'); assert.equal(url.searchParams.get('status'), 'paid'); assert.equal(paidWrites, 2);
});
test('legacy numeric Bangladesh phone retains its leading zero in EPS requests', async () => {
 reset(); order.buyerInfo = { phone: 1700000000 };
 await EPSService.init('order', id, 'owner'); assert.equal(sent[0].customerPhone, '01700000000');
});
