import { shopifyClient, ShopifyProduct } from '../lib/shopify';
import { Product } from '@/types/checkout';

export class ShopifyProductService {
  static async getProductByHandle(handle: string): Promise<Product | null> {
    try {
      const query = `
        query GetProductByHandle($handle: String!) {
          product(handle: $handle) {
            id
            title
            description
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                }
              }
            }
          }
        }
      `;

      const response = await shopifyClient.request(query, {
        variables: { handle }
      });

      if (!response.data?.product) {
        return null;
      }

      return this.transformShopifyProduct(response.data.product);
    } catch (error) {
      console.error('Error fetching product by handle:', error);
      return null;
    }
  }

  static async getProduct(productId: string): Promise<Product | null> {
    try {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                }
              }
            }
          }
        }
      `;

      const response = await shopifyClient.request(query, {
        variables: { id: productId }
      });

      if (!response.data?.product) {
        return null;
      }

      return this.transformShopifyProduct(response.data.product);
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }

  static async getProductsByCollection(collectionId?: string): Promise<Product[]> {
    try {
      const query = `
        query GetProductsByCollection($first: Int!, $collectionId: ID) {
          collection(id: $collectionId) {
            products(first: $first) {
              edges {
                node {
                  id
                  title
                  description
                  images(first: 1) {
                    edges {
                      node {
                        url
                        altText
                      }
                    }
                  }
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        price {
                          amount
                          currencyCode
                        }
                        availableForSale
                      }
                    }
                  }
                  priceRange {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
          products(first: $first) {
            edges {
              node {
                id
                title
                description
                images(first: 1) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      availableForSale
                    }
                  }
                }
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      `;

      const variables: any = { first: 20 };
      if (collectionId) {
        variables.collectionId = collectionId;
      }

      const response = await shopifyClient.request(query, { variables });

      let products = [];
      if (collectionId && response.data?.collection?.products?.edges) {
        products = response.data.collection.products.edges;
      } else if (response.data?.products?.edges) {
        products = response.data.products.edges;
      }

      return products.map((edge: any) =>
        this.transformShopifyProduct(edge.node)
      );
    } catch (error) {
      console.error('Error fetching products by collection:', error);
      return [];
    }
  }

  static async getCollections(): Promise<any[]> {
    try {
      const query = `
        query GetCollections {
          collections(first: 10) {
            edges {
              node {
                id
                title
                description
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      `;

      const response = await shopifyClient.request(query);

      if (!response.data?.collections?.edges) {
        return [];
      }

      return response.data.collections.edges.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Error fetching collections:', error);
      return [];
    }
  }

  private static transformShopifyProduct(shopifyProduct: ShopifyProduct): Product {
    const basePrice = parseFloat(shopifyProduct.priceRange.minVariantPrice.amount);
    const imageUrl = shopifyProduct.images.edges[0]?.node.url || '';

    // Only create variants if the product actually has variants
    const variants = shopifyProduct.variants.edges.length > 0
      ? shopifyProduct.variants.edges.map((edge: any) => ({
          id: edge.node.id,
          name: 'Variant',
          value: edge.node.title,
          priceModifier: parseFloat(edge.node.price.amount) - basePrice
        }))
      : []; // Return empty array for products with no variants

    return {
      id: shopifyProduct.id,
      name: shopifyProduct.title,
      description: shopifyProduct.description,
      basePrice,
      image: imageUrl,
      variants
    };
  }

}

export class ShopifyCartService {
  static async createCart(productVariantId: string, quantity: number = 1): Promise<string | null> {
    try {
      console.log('Creating cart with productVariantId:', productVariantId, 'quantity:', quantity);

      const query = `
        mutation CreateCart($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              lines(first: 10) {
                edges {
                  node {
                    id
                    quantity
                    merchandise {
                      ... on ProductVariant {
                        id
                        title
                        price {
                          amount
                          currencyCode
                        }
                        product {
                          title
                        }
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              code
              message
              field
            }
          }
        }
      `;

      const variables = {
        input: {
          lines: [
            {
              quantity,
              merchandiseId: productVariantId
            }
          ]
        }
      };

      console.log('Cart creation variables:', variables);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMED_OUT')), 10000); // 10 second timeout
      });

      const requestPromise = shopifyClient.request(query, { variables });
      const response = await Promise.race([requestPromise, timeoutPromise]) as any;

      console.log('Cart creation response:', response);
      console.log('Full response data:', response.data);

      if (response.data?.cartCreate?.cart) {
        console.log('Cart created successfully:', response.data.cartCreate.cart.id);

        // Log cart details to verify product was added
        const cart = response.data.cartCreate.cart;
        console.log('Cart details:', {
          id: cart.id,
          checkoutUrl: cart.checkoutUrl || 'none',
          hasLines: !!cart.lines,
          linesCount: cart.lines?.edges?.length || 0
        });

        // Log individual line items to verify product was added
        if (cart.lines?.edges && cart.lines.edges.length > 0) {
          cart.lines.edges.forEach((edge: any, index: number) => {
            console.log(`Line ${index + 1}:`, {
              id: edge.node.id,
              quantity: edge.node.quantity,
              merchandiseId: edge.node.merchandise?.id,
              merchandiseTitle: edge.node.merchandise?.title,
              productTitle: edge.node.merchandise?.product?.title
            });
          });
        } else {
          console.warn('WARNING: Cart created but no line items found!');
        }

        return response.data.cartCreate.cart.id;
      }

      // Check for user errors in the response
      const userErrors = response.data?.cartCreate?.userErrors;
      console.log('Raw user errors from response:', userErrors);

      if (userErrors && Array.isArray(userErrors) && userErrors.length > 0) {
        console.error('Cart creation user errors:', userErrors);
        // Show detailed error messages
        userErrors.forEach((error: any, index: number) => {
          console.error(`User Error ${index + 1}:`, {
            code: error.code,
            message: error.message,
            field: error.field,
            ...error
          });
        });

        // Also show errors in alert for immediate visibility
        const errorMessage = userErrors.map((e: any) => e.message).join(', ');
        throw new Error(`Cart creation failed: ${errorMessage}`);
      }

      console.error('Cart creation failed but no specific errors found in response');
      console.error('Full response structure:', JSON.stringify(response, null, 2));

      throw new Error('Cart creation failed: Unknown error - check console for details');
    } catch (error: any) {
      console.error('Error creating cart:', error);

      // Enhanced error logging
      if (error.message) {
        console.error('Error message:', error.message);
      }
      if (error.response) {
        console.error('Error response:', error.response);
        console.error('Error response data:', error.response.data);
      }
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        console.error('GraphQL errors:', error.graphQLErrors);
        // Show GraphQL errors to user
        const errorMessages = error.graphQLErrors.map((e: any) => e.message).join(', ');
        throw new Error(`Cart creation failed: ${errorMessages}`);
      }
      if (error.networkError) {
        console.error('Network error:', error.networkError);
        throw new Error('Cart creation failed: Network error - check your connection');
      }

      // Re-throw the error with the original message if it's already formatted
      throw error;
    }
  }

  static async addToCart(cartId: string, productVariantId: string, quantity: number = 1): Promise<boolean> {
    try {
      console.log('Adding to cart - cartId:', cartId, 'productVariantId:', productVariantId, 'quantity:', quantity);

      const query = `
        mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
              id
            }
            userErrors {
              code
              message
              field
            }
          }
        }
      `;

      const variables = {
        cartId,
        lines: [
          {
            quantity,
            merchandiseId: productVariantId
          }
        ]
      };

      console.log('Add to cart variables:', variables);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMED_OUT')), 10000); // 10 second timeout
      });

      const requestPromise = shopifyClient.request(query, { variables });
      const response = await Promise.race([requestPromise, timeoutPromise]) as any;

      console.log('Add to cart response:', response);

      if (response.data?.cartLinesAdd?.cart) {
        console.log('Product added to cart successfully');
        return true;
      }

      // Enhanced error handling
      const userErrors = response.data?.cartLinesAdd?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('Add to cart user errors:', userErrors);
        userErrors.forEach((error: any, index: number) => {
          console.error(`User Error ${index + 1}:`, error.code, error.message);
        });
        const errorMessage = userErrors.map((e: any) => e.message).join(', ');
        throw new Error(`Failed to add to cart: ${errorMessage}`);
      } else {
        console.error('Add to cart failed but no specific errors returned');
        throw new Error('Failed to add product to cart. Please try again.');
      }
    } catch (error: any) {
      console.error('Error adding to cart:', error);

      // Enhanced error logging
      if (error.message) {
        console.error('Error message:', error.message);
      }
      if (error.response) {
        console.error('Error response:', error.response);
      }
      if (error.graphQLErrors) {
        console.error('GraphQL errors:', error.graphQLErrors);
      }

      // Re-throw the error with the original message if it's already formatted
      throw error;
    }
  }

  static async updateCartItem(cartId: string, lineId: string, quantity: number): Promise<boolean> {
    try {
      const query = `
        mutation UpdateCartItem($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) {
            cart {
              id
            }
            userErrors {
              code
              message
              field
            }
          }
        }
      `;

      const variables = {
        cartId,
        lines: [
          {
            id: lineId,
            quantity
          }
        ]
      };

      const response = await shopifyClient.request(query, { variables });

      if (response.data?.cartLinesUpdate?.cart) {
        return true;
      }

      const userErrors = response.data?.cartLinesUpdate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('Update cart user errors:', userErrors);
        userErrors.forEach((error: any, index: number) => {
          console.error(`User Error ${index + 1}:`, error.code, error.message);
        });
        alert(`Failed to update cart: ${userErrors.map((e: any) => e.message).join(', ')}`);
      } else {
        console.error('Update cart failed but no specific errors returned');
        alert('Failed to update cart item. Please try again.');
      }

      return false;
    } catch (error) {
      console.error('Error updating cart item:', error);
      return false;
    }
  }

  static async removeFromCart(cartId: string, lineId: string): Promise<boolean> {
    try {
      const query = `
        mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
            cart {
              id
            }
            userErrors {
              code
              message
              field
            }
          }
        }
      `;

      const variables = {
        cartId,
        lineIds: [lineId]
      };

      const response = await shopifyClient.request(query, { variables });

      if (response.data?.cartLinesRemove?.cart) {
        return true;
      }

      const userErrors = response.data?.cartLinesRemove?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('Remove from cart user errors:', userErrors);
        userErrors.forEach((error: any, index: number) => {
          console.error(`User Error ${index + 1}:`, error.code, error.message);
        });
        alert(`Failed to remove from cart: ${userErrors.map((e: any) => e.message).join(', ')}`);
      } else {
        console.error('Remove from cart failed but no specific errors returned');
        alert('Failed to remove item from cart. Please try again.');
      }

      return false;
    } catch (error) {
      console.error('Error removing from cart:', error);
      return false;
    }
  }

  static async getCart(cartId: string): Promise<any> {
    try {
      const query = `
        query GetCart($id: ID!) {
          cart(id: $id) {
            id
            checkoutUrl
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        id
                        title
                        images(first: 1) {
                          edges {
                            node {
                              url
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            cost {
              subtotalAmount {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
              totalTaxAmount {
                amount
                currencyCode
              }
            }
          }
        }
      `;

      const response = await shopifyClient.request(query, {
        variables: { id: cartId }
      });

      return response.data?.cart || null;
    } catch (error) {
      console.error('Error fetching cart:', error);
      return null;
    }
  }

  static async updateCartNote(cartId: string, note: string): Promise<boolean> {
    try {
      const query = `
        mutation UpdateCartNote($cartId: ID!, $note: String) {
          cartNoteUpdate(cartId: $cartId, note: $note) {
            cart { id }
            userErrors { code message field }
          }
        }
      `;

      const variables = { cartId, note };
      const response = await shopifyClient.request(query, { variables });

      if (response.data?.cartNoteUpdate?.cart?.id) {
        return true;
      }

      const userErrors = response.data?.cartNoteUpdate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        console.error('Update cart note user errors:', userErrors);
      }
      return false;
    } catch (error) {
      console.error('Error updating cart note:', error);
      return false;
    }
  }
}
