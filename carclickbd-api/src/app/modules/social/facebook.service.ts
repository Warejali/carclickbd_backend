import config from '../../../config';
import { IProduct } from '../product/product.interface';

type FacebookApiResponse = {
  id?: string;
  post_id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeGraphApiVersion = (value: string) =>
  value.startsWith('v') ? value : `v${value}`;

const toAbsoluteUrl = (value: string | undefined, baseUrl?: string) => {
  if (!value) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!baseUrl) {
    return undefined;
  }

  return `${trimTrailingSlash(baseUrl)}${value.startsWith('/') ? value : `/${value}`}`;
};

const formatLocation = (location: IProduct['location']) => {
  if (!location) {
    return '';
  }

  if (typeof location === 'string') {
    return location;
  }

  return [location.city, location.zipCode].filter(Boolean).join(', ');
};

const formatProductCaption = (product: IProduct, productUrl: string) => {
  const title =
    product.title ||
    [product.year || product.productionYear, product.maker, product.model]
      .filter(Boolean)
      .join(' ');
  const grade = product.grade || product.auctionGrade;
  const lines = [
    `🚘 ${title}`,
    `Year: ${product.year || product.productionYear || 'N/A'} | Color: ${product.color || 'N/A'}`,
    grade ? `Grade: ${grade}` : '',
    product.mileage ? `Mileage: ${product.mileage} km` : '',
    product.price ? `Price: BDT ${product.price}` : '',
    formatLocation(product.location)
      ? `Location: ${formatLocation(product.location)}`
      : '',
    '',
    `View details: ${productUrl}`,
  ];

  return lines.filter(Boolean).join('\n');
};

const callFacebook = async (
  endpoint: string,
  fields: Record<string, string>,
): Promise<FacebookApiResponse> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
  });

  const data = (await response.json().catch(() => ({}))) as FacebookApiResponse;

  if (!response.ok || data.error) {
    const error = data.error;
    throw new Error(
      `Facebook API ${response.status}: ${error?.message || 'request failed'}${
        error?.code ? ` (code ${error.code})` : ''
      }`,
    );
  }

  return data;
};

const publishProductToFacebook = async (product: IProduct) => {
  const { page_id: pageId, page_access_token: pageAccessToken } =
    config.facebook;

  if (!config.facebook.auto_post || !pageId || !pageAccessToken) {
    return null;
  }

  const frontendUrl = trimTrailingSlash(
    config.frontend_url || 'https://www.carclickbd.com',
  );
  const productUrl = `${frontendUrl}/auction-details/${product._id.toString()}`;
  const caption = formatProductCaption(product, productUrl);
  const graphVersion = normalizeGraphApiVersion(
    config.facebook.graph_api_version,
  );
  const graphBaseUrl = `https://graph.facebook.com/${graphVersion}/${pageId}`;
  const imageUrl = toAbsoluteUrl(
    product.photos?.mainPhoto,
    config.backend_url || 'https://carclickbd-backend.jdmcarworld.com',
  );

  try {
    if (imageUrl) {
      try {
        const photo = await callFacebook(`${graphBaseUrl}/photos`, {
          url: imageUrl,
          caption,
          published: 'true',
          access_token: pageAccessToken,
        });

        console.log(
          `[facebook] Published product ${product._id.toString()} with image: ${
            photo.post_id || photo.id || 'success'
          }`,
        );
        return photo.post_id || photo.id || null;
      } catch (photoError) {
        console.warn(
          `[facebook] Image post failed for ${product._id.toString()}, trying link post:`,
          photoError instanceof Error ? photoError.message : photoError,
        );
      }
    }

    const post = await callFacebook(`${graphBaseUrl}/feed`, {
      message: caption,
      link: productUrl,
      access_token: pageAccessToken,
    });

    console.log(
      `[facebook] Published product ${product._id.toString()} as link: ${
        post.id || 'success'
      }`,
    );
    return post.id || null;
  } catch (error) {
    console.error(
      `[facebook] Unable to publish product ${product._id.toString()}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

export const facebookService = {
  publishProductToFacebook,
};
