import ApiError from '../../../errors/ApiError';
import { Product } from '../product/product.model';

export const productPrice = (product: any, userId: string): number => {
  if (product.isDraft || product.isSoldOut || product.status === 'sold') {
    throw new ApiError(409, 'This vehicle is unavailable for checkout');
  }
  let price = product.price;
  if (product.isAuction) {
    const ended = new Date(product.endBid).getTime();
    if (
      !Number.isFinite(ended) ||
      ended > Date.now() ||
      String(product.highestBidder?.id) !== userId
    ) {
      throw new ApiError(
        403,
        'Only the winning bidder can purchase a completed auction',
      );
    }
    price = product.highestBid;
  }
  const raw = String(price ?? '').trim();
  if (!/^\d+(?:,\d+)*(?:\.\d{1,2})?$/.test(raw))
    throw new ApiError(400, 'Vehicle price is not configured');
  const amount = Number(raw.replace(/,/g, ''));
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(Math.round(amount * 100))
  ) {
    throw new ApiError(400, 'Vehicle price is not configured');
  }
  return amount;
};

export const priceOrder = async (payload: any) => {
  const requested = payload.productId
    ? [{ productId: payload.productId, quantity: 1 }]
    : payload.items;
  if (
    !Array.isArray(requested) ||
    !requested.length ||
    requested.length > 100
  ) {
    throw new ApiError(400, 'Select the vehicles for this order');
  }
  const items: { product: string; quantity: number; unitAmount: number }[] = [];
  for (const item of requested) {
    const id = String(
      item.productId ||
        item.product?._id ||
        item.product ||
        item._id ||
        item.id ||
        '',
    );
    const quantity = Number(item.quantity ?? 1);
    if (
      !/^[a-f\d]{24}$/i.test(id) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      throw new ApiError(400, 'Invalid vehicle or quantity');
    }
    const product = await Product.findById(id);
    if (!product) throw new ApiError(404, 'Vehicle not found');
    items.push({
      product: id,
      quantity,
      unitAmount: productPrice(product, String(payload.user)),
    });
  }
  const cents = items.reduce(
    (sum, item) => sum + Math.round(item.unitAmount * 100) * item.quantity,
    0,
  );
  if (!Number.isSafeInteger(cents))
    throw new ApiError(400, 'Order total is too large');
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: cents / 100,
  };
};
