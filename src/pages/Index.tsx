import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProductCard } from '@/components/ProductCard';
import { CheckoutFlow } from '@/components/CheckoutFlow';
import { OrderComplete } from '@/components/OrderComplete';
import { CartButton } from '@/components/CartButton';
import { ShopifyProductService } from '@/services/shopifyService';
import { useCart } from '@/hooks/useCart';
import { Product, CheckoutStep } from '@/types/checkout';
import { Menu, X, ShoppingBag, User, Search, Heart } from 'lucide-react';

type AppState = 'product' | 'checkout' | 'complete';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('product');
  const { updateProductSelection, setAllAddOns, isLoading, error, isInitialized } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [checkoutSteps, setCheckoutSteps] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Load the specific products from Shopify
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        // Load the first product: https://admin.shopify.com/store/brooklyn-christmas-tree-delivery/products/7119040610384
        const baseProductId = 'gid://shopify/Product/7119040610384';
        const baseProduct = await ShopifyProductService.getProduct(baseProductId);

        // Load the second product: https://admin.shopify.com/store/brooklyn-christmas-tree-delivery/products/7119041560656
        const secondProductId = 'gid://shopify/Product/7119041560656';
        const secondProduct = await ShopifyProductService.getProduct(secondProductId);

        const loadedProducts: Product[] = [];

        if (baseProduct) {
          loadedProducts.push(baseProduct);
        }

        if (secondProduct) {
          loadedProducts.push(secondProduct);
        }

        if (loadedProducts.length > 0) {
          setProducts(loadedProducts);
          setSelectedProduct(loadedProducts[0]); // Set the first product as default
        } else {
          console.error('No products found');
          setProducts([]);
          setSelectedProduct(null);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        setProducts([]);
        setSelectedProduct(null);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    // Create the 5-step checkout flow (skip tree selection since it's done on main page)
    const createCheckoutSteps = async () => {
      try {
        // Define the 6 specific checkout steps (including order summary)
        const steps = [
          {
            id: 1,
            title: 'Tree Stand',
            description: 'Select a sturdy tree stand for your tree',
            addOns: [],
            collectionId: 'gid://shopify/Collection/155577745488'
          },
          {
            id: 2,
            title: 'Tree Installation',
            description: 'Professional tree installation services',
            addOns: [],
            collectionId: null
          },
          {
            id: 3,
            title: 'Certificate of Insurance',
            description: 'Insurance certificate for your tree installation',
            addOns: [],
            collectionId: null
          },
          {
            id: 4,
            title: 'Delivery Date',
            description: 'Choose your preferred delivery date',
            addOns: [],
            collectionId: null
          },
          {
            id: 5,
            title: 'Delivery Date Time Notes',
            description: 'Specify delivery time preferences and special notes',
            addOns: [],
            collectionId: null
          },
          {
            id: 6,
            title: 'Order Summary',
            description: 'Review your selections before proceeding to checkout',
            addOns: [],
            collectionId: null
          }
        ];

        setCheckoutSteps(steps);
      } catch (error) {
        console.error('Error creating checkout steps:', error);
        setCheckoutSteps([]);
      }
    };

    createCheckoutSteps();
  }, []);

  // Auto-scroll to top when component mounts (page refresh)
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, []);

  // Iframe height adjustment for Shopify embedding
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    const sendHeight = () => {
      const height = document.body.scrollHeight;
      try {
        window.parent.postMessage({ type: 'setHeight', height }, '*');
      } catch (error) {
        console.warn('Failed to send height to parent:', error);
      }
    };

    const setupHeightAdjustment = () => {
      // Send height on load
      window.addEventListener('load', sendHeight);

      // Send height on resize or content changes
      window.addEventListener('resize', sendHeight);

      // Use ResizeObserver for more reliable height detection
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          // Debounce height updates
          setTimeout(sendHeight, 100);
        });

        resizeObserver.observe(document.body);
      }

      // Send initial height
      sendHeight();
    };

    // Setup height adjustment
    setupHeightAdjustment();

    // Cleanup
    return () => {
      window.removeEventListener('load', sendHeight);
      window.removeEventListener('resize', sendHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Checkout link interceptor for Shopify iframe
  useEffect(() => {
    let mutationObserver: MutationObserver | null = null;

    const handleCheckoutClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href*="/checkout"]') as HTMLAnchorElement;

      if (link) {
        event.preventDefault();
        event.stopPropagation();

        // Always redirect to top window for checkout with complete fallback chain
        try {
          window.top.location.href = link.href;
        } catch (error) {
          try {
            // Fallback to parent if top is not accessible
            window.parent.location.href = link.href;
          } catch (fallbackError) {
            // Final fallback to current window
            window.location.href = link.href;
          }
        }
      }
    };

    const setupCheckoutInterception = () => {
      // Handle existing checkout links
      const checkoutLinks = document.querySelectorAll('a[href*="/checkout"]');
      checkoutLinks.forEach(link => {
        link.addEventListener('click', handleCheckoutClick);
        // Add target="_top" for explicit checkout links
        link.setAttribute('target', '_top');
      });

      // Set up MutationObserver for dynamically created checkout links
      if (window.MutationObserver) {
        mutationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                const checkoutLinks = element.querySelectorAll ?
                  element.querySelectorAll('a[href*="/checkout"]') :
                  [];

                checkoutLinks.forEach((link: Element) => {
                  (link as HTMLAnchorElement).addEventListener('click', handleCheckoutClick);
                  (link as HTMLAnchorElement).setAttribute('target', '_top');
                });
              }
            });
          });
        });

        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }

      // Global click listener as fallback
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target && target.closest && target.closest('a[href*="/checkout"]')) {
          handleCheckoutClick(event);
        }
      }, true); // Use capture phase
    };

    // Setup checkout interception
    setupCheckoutInterception();

    // Cleanup
    return () => {
      if (mutationObserver) {
        mutationObserver.disconnect();
      }

      document.removeEventListener('click', handleCheckoutClick, true);
    };
  }, []);

  const handleProductChange = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleAddToCart = async (product: Product, variantId: string) => {
    // Ensure the cart is created and saved before navigating to checkout
    // This prevents CheckoutFlow from initializing without a cart and creating a new one
    try {
      await updateProductSelection(product, variantId);
      console.log('Base product added to cart successfully');
    } catch (error) {
      console.error('Error adding base product to cart:', error);
      // Even on error, proceed to checkout to allow user to retry from there
    } finally {
      setAppState('checkout');
    }
  };

  const handleCartClick = () => {
    setAppState('checkout');
  };

  const handleStoreClick = () => {
    const storeDomain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;
    if (storeDomain) {
      window.open(`https://${storeDomain}`, '_blank');
    }
  };

  const handleCheckoutComplete = () => {
    setAppState('complete');
  };

  const handleBackToProduct = () => {
    setAppState('product');
  };

  const handleNewOrder = () => {
    setAppState('product');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white w-full">
      {/* Main Content - iframe friendly, no header/footer, no side paddings */}
      <main className="w-full bg-white">
        {appState === 'product' && (
          <div className="w-full py-4">
            <div className="w-full">
              <div className="text-center">
                {loadingProducts ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-64 h-64 mb-4 rounded-lg overflow-hidden shadow-lg">
                      <img
                        src="/WhatsApp Image 2025-09-25 at 15.54.25_8ce0d4fb.jpg"
                        alt="Loading Christmas tree selection..."
                        className="w-full h-full object-cover opacity-30"
                        onError={(e) => {
                          // Fallback to text if image fails to load
                          e.currentTarget.style.display = 'none';
                          const fallbackText = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallbackText) {
                            fallbackText.style.display = 'block';
                          }
                        }}
                      />
                      <div className="hidden text-lg text-gray-600 text-center p-4">
                        Loading your Christmas tree selection...
                      </div>
                    </div>
                    <div className="text-lg text-gray-600 text-center">
                      Loading your Christmas tree selection...
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-lg text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                    Error: {error}
                  </div>
                ) : products.length > 0 ? (
                  <div className="w-full flex justify-center">
                    <ProductCard
                      product={selectedProduct || products[0]}
                      onAddToCart={handleAddToCart}
                      availableProducts={products}
                      showBaseProductSelector={true}
                      isCartInitialized={isInitialized}
                    />
                  </div>
                ) : (
                  <div className="text-lg text-red-600">Failed to load product</div>
                )}
              </div>
            </div>
          </div>
        )}

        {appState === 'checkout' && checkoutSteps.length > 0 && (
          <CheckoutFlow
            steps={checkoutSteps}
            onComplete={handleCheckoutComplete}
            onBack={handleBackToProduct}
          />
        )}

        {appState === 'complete' && (
          <OrderComplete onNewOrder={handleNewOrder} />
        )}
      </main>

      {/* No footer in iframe mode */}
    </div>
  );
};

export default Index;
