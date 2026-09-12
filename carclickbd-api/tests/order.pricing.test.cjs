const test = require('node:test');
const assert = require('node:assert/strict');
const { Product } = require('../dist/app/modules/product/product.model');
const { productPrice, priceOrder } = require('../dist/app/modules/order/order.pricing');
test('stored vehicle price is used instead of browser totals and unit prices', async () => {
 const original = Product.findById;
 Product.findById = async () => ({ price: '1,250.50' });
 try {
  const result = await priceOrder({ user: 'owner', totalAmount: 1, items: [{ id: '123456789012345678901234', quantity: 2, price: 1 }] });
  assert.equal(result.totalAmount, 2501); assert.equal(result.totalQuantity, 2); assert.equal(result.items[0].unitAmount, 1250.5);
 } finally { Product.findById = original; }
});
test('unconfigured and unavailable vehicle prices are rejected', () => {
 for (const product of [{ price: 'Call for price' }, { price: '0' }, { price: '-5' }, { price: '1.234' }, { price: 100, isSoldOut: true }]) assert.throws(() => productPrice(product, 'owner'));
});
test('completed auction uses the stored winning bid and checks its owner', () => {
 const product = { isAuction: true, price: '1', highestBid: 1500, endBid: '2020-01-01', highestBidder: { id: 'owner' } };
 assert.equal(productPrice(product, 'owner'), 1500);
 assert.throws(() => productPrice(product, 'other'), /winning bidder/);
 assert.throws(() => productPrice({ ...product, endBid: '2099-01-01' }, 'owner'), /completed auction/);
});
test('invalid item references and quantities are rejected', async () => {
 await assert.rejects(priceOrder({ totalAmount: 1 }), /Select the vehicles/);
 for (const quantity of [0, -1, 1.5, 101]) await assert.rejects(priceOrder({ items: [{ id: '123456789012345678901234', quantity }] }), /quantity/);
});
