import { useState, useCallback } from 'react';
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

  const loadCart = useCallback(async (id: string) => {
    try {
      const cart = await ShopifyCartService.getCart(id);
      if (cart) {
        setShopifyCart(cart);
        saveCartData(id, cart);
        setError(null);
      } else {
        setError('Failed to load cart');
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      setError('Error loading cart');
    }
  }, [saveCartData]);

  const updateProductSelection = useCallback(async (product: Product, variantId: string) => {
    setSelectedProduct(product);
    setIsLoading(true);
    setError(null);

    try {
      console.log('Updating product selection with variantId:', variantId);
      console.log('Product variants:', product.variants);

      // The variantId passed from ProductCard should already be the Shopify variant ID
      // Let's use it directly since it's coming from the Shopify API
      const actualVariantId = variantId;

      console.log('Using Shopify variant ID:', actualVariantId);

      // Create or update cart with the selected product
      if (cartId) {
        console.log('Adding to existing cart:', cartId);
        const success = await ShopifyCartService.addToCart(cartId, actualVariantId, 1);
        if (success) {
          console.log('Product added successfully, refreshing cart data...');
          // Add a small delay to ensure the cart is updated on Shopify's side
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadCart(cartId);
          console.log('Cart data refreshed successfully');
        } else {
          setError('Failed to add product to cart');
        }
      } else {
        console.log('Creating new cart...');
        const newCartId = await ShopifyCartService.createCart(actualVariantId, 1);
        if (newCartId) {
          console.log('New cart created:', newCartId);
          setCartId(newCartId);
          // Add a small delay to ensure the cart is created on Shopify's side
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadCart(newCartId);
          console.log('Cart data loaded successfully');
        } else {
          setError('Failed to create cart');
        }
      }
    } catch (error: any) {
      console.error('Error updating product selection:', error);
      setError(error.message || 'Error updating product selection');
    } finally {
      setIsLoading(false);
    }
  }, [cartId, loadCart, saveCartData]);

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

  const getCheckoutUrl = useCallback(() => {
    return shopifyCart?.checkoutUrl || null;
  }, [shopifyCart]);

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
    isLoading,
    error,
    setAllAddOns
  };
}
