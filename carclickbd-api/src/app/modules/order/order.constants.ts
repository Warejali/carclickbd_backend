export const orderIdFilterableFields: string[] = [
  'searchTerm',
  'price',
  'sellerId',
];

export const bidSearchableFields: string[] = [
  'price',
  'products',
  'buyer',
  'sellerId',
];

export const bidRelationalFields: string[] = ['products', 'buyer'];
export const bidRelationalFieldsMapper: { [key: string]: string } = {
  productId: 'product',
  buyerId: 'buyer',
};
