import { useState, useCallback, useEffect } from 'react';
import { Product, AddOn } from '@/types/checkout';
import { ShopifyCartService } from '@/services/shopifyService';

export function useCart() {
  const [cartId, setCartId] = useState<string | null>(() => {
    // Try to get cart ID from localStorage first
    const savedCartId = localStorage.getItem('shopify_cart_id');
    return savedCartId || null;
  });
  const [shopifyCart, setShopifyCart] = useState<any>(() => {
    // Try to get cart data from localStorage first
    const savedCartData = localStorage.getItem('shopify_cart_data');
    if (savedCartData) {
      try {
        return JSON.parse(savedCartData);
      } catch (error) {
        console.error('Error parsing saved cart data:', error);
        return null;
      }
    }
    return null;
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [allAddOns, setAllAddOns] = useState<AddOn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Helper function to save cart data to localStorage
  const saveCartData = useCallback((cartId: string | null, cartData: any) => {
    if (cartId) {
      localStorage.setItem('shopify_cart_id', cartId);
    } else {
      localStorage.removeItem('shopify_cart_id');
    }

    if (cartData) {
      localStorage.setItem('shopify_cart_data', JSON.stringify(cartData));
    } else {
      localStorage.removeItem('shopify_cart_data');
    }
  }, []);

  // Initialize cart on mount
  useEffect(() => {
    const initializeCart = async () => {
      if (isInitialized) return;

      console.log('=== Initializing Cart ===');
      setIsLoading(true);
      setError(null);

      try {
        // If we have a cart ID from localStorage, try to load it
        if (cartId) {
          console.log('Loading existing cart:', cartId);
          const cart = await ShopifyCartService.getCart(cartId);
          if (cart) {
            console.log('Cart loaded successfully');
            setShopifyCart(cart);
            saveCartData(cartId, cart);
          } else {
            console.log('Cart not found, will create new cart on first add');
            // Clear invalid cart ID
            setCartId(null);
            localStorage.removeItem('shopify_cart_id');
            localStorage.removeItem('shopify_cart_data');
          }
        }
      } catch (error) {
        console.error('Error initializing cart:', error);
        // Clear potentially corrupted data
        setCartId(null);
        setShopifyCart(null);
        localStorage.removeItem('shopify_cart_id');
        localStorage.removeItem('shopify_cart_data');
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initializeCart();
  }, [cartId, isInitialized]);

  const loadCart = useCallback(async (id: string) => {
    try {
      // Try multiple times to load cart data
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`Cart load attempt ${attempts}/${maxAttempts} for cart:`, id);

        try {
          const cart = await ShopifyCartService.getCart(id);
          if (cart) {
            console.log('Cart loaded successfully');
            setShopifyCart(cart);
            saveCartData(id, cart);
            setError(null);
            return;
          }
        } catch (error) {
          console.error(`Cart load attempt ${attempts} failed:`, error);
          if (attempts === maxAttempts) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      throw new Error('Failed to load cart after multiple attempts');
    } catch (error: any) {
      console.error('Error loading cart:', error);
      setError('Error loading cart');
    }
  }, [saveCartData]);

  const updateProductSelection = useCallback(async (product: Product, variantId: string) => {
    setSelectedProduct(product);
    setIsLoading(true);
    setError(null);

    // Validate variant ID format
    if (!variantId || !variantId.startsWith('gid://')) {
      console.error('Invalid variant ID format:', variantId);
      setError('Invalid product variant selected. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('=== Updating Product Selection ===');
      console.log('Product:', product.name);
      console.log('Variant ID:', variantId);
      console.log('Retry count:', retryCount);

      // Create or update cart with the selected product
      if (cartId) {
        console.log('Adding to existing cart:', cartId);
        const success = await ShopifyCartService.addToCart(cartId, variantId, 1);
        if (success) {
          console.log('Product added successfully, refreshing cart data...');
          // Add a small delay to ensure the cart is updated on Shopify's side
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadCart(cartId);
          console.log('Cart data refreshed successfully');
          setRetryCount(0); // Reset retry count on success
        } else {
          throw new Error('Failed to add product to cart');
        }
      } else {
        console.log('Creating new cart...');
        const newCartId = await ShopifyCartService.createCart(variantId, 1);
        if (newCartId) {
          console.log('New cart created:', newCartId);
          setCartId(newCartId);
          // Add a small delay to ensure the cart is created on Shopify's side
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadCart(newCartId);
          console.log('Cart data loaded successfully');
          setRetryCount(0); // Reset retry count on success
        } else {
          throw new Error('Failed to create cart');
        }
      }
    } catch (error: any) {
      console.error('=== Product Selection Error ===');
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        retryCount,
        product: product.name,
        variantId
      });

      // Enhanced retry logic with exponential backoff
      if (retryCount < 3) {
        console.log(`Retrying cart operation (attempt ${retryCount + 1}/4)...`);
        setRetryCount(prev => prev + 1);
        // Exponential backoff: wait 1s, 2s, 4s for retries
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return updateProductSelection(product, variantId);
      }

      // Final error handling
      setRetryCount(0);
      const errorMessage = error.message || 'Error updating product selection';
      setError(errorMessage);

      // Enhanced error classification and user-friendly messages
      if (errorMessage.includes('Network error') || errorMessage.includes('timeout') || errorMessage.includes('TIMED_OUT')) {
        setError('Network connection issue. Please check your internet and try again.');
      } else if (errorMessage.includes('Invalid')) {
        setError('Product variant is no longer available. Please refresh and try again.');
      } else {
        setError('Too many requests. Please wait a moment and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [cartId, loadCart, saveCartData, retryCount]);

  const addAddOn = useCallback(async (addOnId: string) => {
    // For now, we'll handle add-ons locally since Shopify doesn't have add-on concept
    // In a real implementation, you might want to use line item properties or metafields
    console.log('Add-on functionality would be implemented here:', addOnId);
  }, [cartId, shopifyCart]);

  const removeAddOn = useCallback(async (addOnId: string) => {
    // For now, we'll handle add-ons locally since Shopify doesn't have add-on concept
    console.log('Remove add-on functionality would be implemented here:', addOnId);
  }, [cartId, shopifyCart]);

  const updateCartItem = useCallback(async (lineId: string, quantity: number) => {
    if (!cartId) {
      setError('No cart available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Updating cart item - cartId:', cartId, 'lineId:', lineId, 'quantity:', quantity);

      const success = await ShopifyCartService.updateCartItem(cartId, lineId, quantity);
      if (success) {
        console.log('Cart item updated successfully, refreshing cart data...');
        // Add a small delay to ensure the cart is updated on Shopify's side
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadCart(cartId);
        console.log('Cart data refreshed successfully');
        return true;
      } else {
        setError('Failed to update cart item');
        return false;
      }
    } catch (error: any) {
      console.error('Error updating cart item:', error);
      setError(error.message || 'Error updating cart item');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [cartId, loadCart, saveCartData]);

  const removeFromCart = useCallback(async (lineId: string) => {
    if (!cartId) {
      setError('No cart available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Removing from cart - cartId:', cartId, 'lineId:', lineId);

      const success = await ShopifyCartService.removeFromCart(cartId, lineId);
      if (success) {
        console.log('Cart item removed successfully, refreshing cart data...');
        // Add a small delay to ensure the cart is updated on Shopify's side
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadCart(cartId);
        console.log('Cart data refreshed successfully');
        return true;
      } else {
        setError('Failed to remove cart item');
        return false;
      }
    } catch (error: any) {
      console.error('Error removing cart item:', error);
      setError(error.message || 'Error removing cart item');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [cartId, loadCart, saveCartData]);

  const calculateTotal = useCallback(() => {
    if (!shopifyCart) return 0;
    return parseFloat(shopifyCart.cost?.totalAmount?.amount || '0');
  }, [shopifyCart]);

  const getOrderSummary = useCallback(() => {
    if (!shopifyCart) return null;

    const items = shopifyCart.lines?.edges?.map((edge: any) => ({
      id: edge.node.id,
      name: `${edge.node.merchandise.product.title} - ${edge.node.merchandise.title}`,
      price: parseFloat(edge.node.merchandise.price.amount) * edge.node.quantity,
      quantity: edge.node.quantity,
      lineId: edge.node.id,
      variantId: edge.node.merchandise.id
    })) || [];

    const subtotal = parseFloat(shopifyCart.cost?.subtotalAmount?.amount || '0');
    const tax = parseFloat(shopifyCart.cost?.totalTaxAmount?.amount || '0');
    const total = parseFloat(shopifyCart.cost?.totalAmount?.amount || '0');

    return {
      subtotal,
      tax,
      total,
      items
    };
  }, [shopifyCart]);

  const clearCartData = useCallback(() => {
    console.log('Clearing cart data...');
    setCartId(null);
    setShopifyCart(null);
    setSelectedProduct(null);
    setError(null);
    setRetryCount(0);
    localStorage.removeItem('shopify_cart_id');
    localStorage.removeItem('shopify_cart_data');
  }, []);

  const getCheckoutUrl = useCallback(() => {
    return shopifyCart?.checkoutUrl || null;
  }, [shopifyCart]);

  const isExternalServiceAvailable = useCallback(async (): Promise<boolean> => {
    try {
      // Simple test to check if external Shopify services are responding
      const testResponse = await fetch('https://shop.app/pay/session?v=1&token=test&shop_id=1', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      console.warn('External Shopify services may be unavailable:', error);
      return false;
    }
  }, []);

  return {
    cartId,
    shopifyCart,
    selectedProduct,
    updateProductSelection,
    addAddOn,
    removeAddOn,
    updateCartItem,
    removeFromCart,
    loadCart,
    calculateTotal,
    getOrderSummary,
    getCheckoutUrl,
    clearCartData,
    isExternalServiceAvailable,
    isLoading,
    error,
    setAllAddOns,
    isInitialized,
    retryCount
  };
}
