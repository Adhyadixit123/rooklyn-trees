import { createStorefrontApiClient } from '@shopify/storefront-api-client';

const storeDomain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;
const accessToken = import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN;

if (!storeDomain || !accessToken) {
  throw new Error('Missing Shopify environment variables');
}

export const shopifyClient = createStorefrontApiClient({
  storeDomain,
  publicAccessToken: accessToken,
  apiVersion: '2024-10', // Use a stable API version
});

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  images: {
    edges: Array<{
      node: {
        url: string;
        altText: string;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: {
          amount: string;
          currencyCode: string;
        };
        availableForSale: boolean;
      };
    }>;
  };
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  lines: {
    edges: Array<{
      node: {
        id: string;
        quantity: number;
        merchandise: {
          id: string;
          title: string;
          price: {
            amount: string;
            currencyCode: string;
          };
          product: {
            title: string;
            images: {
              edges: Array<{
                node: {
                  url: string;
                };
              }>;
            };
          };
        };
      };
    }>;
  };
  cost: {
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    totalTaxAmount: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface ShopifyCheckout {
  id: string;
  webUrl: string;
  order: {
    id: string;
    orderNumber: number;
    totalPrice: {
      amount: string;
      currencyCode: string;
    };
  } | null;
}
