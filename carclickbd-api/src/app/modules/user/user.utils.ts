import { Order } from '../order/order.model';

export const findLastOrderNumber = async (): Promise<string | undefined> => {
  const lastOrder = await Order.findOne({}, { orderNumber: 1 }).sort({
    createdAt: -1,
  });

  // Split on "-" and get the numeric part
  return lastOrder?.orderNumber?.split('-')[1];
};

export const generateOrderNumber = async (): Promise<string> => {
  const currentId =
    (await findLastOrderNumber()) || (0).toString().padStart(5, '0');
  let incrementedId = (parseInt(currentId) + 1).toString().padStart(5, '0');
  incrementedId = `order-${incrementedId}`;

  return incrementedId;
};
