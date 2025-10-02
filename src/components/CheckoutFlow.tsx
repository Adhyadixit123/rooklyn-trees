import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Plus, ArrowLeft, ArrowRight, Star, ExternalLink, ShoppingBag, Minus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { validateTreeSize, validateStandForTree, validateInstallationForTree } from '@/utils/treeValidation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckoutStep, AddOn } from '@/types/checkout';
import { treeSizeMappings, getTreeSizeMapping } from '@/lib/treeSizeMapping';
import { useCart } from '@/hooks/useCart';
import { ShopifyProductService, ShopifyCartService } from '@/services/shopifyService';
import { ProductCard } from '@/components/ProductCard';

interface CheckoutFlowProps {
  steps: CheckoutStep[];
  onComplete: () => void;
  onBack: () => void;
}

export function CheckoutFlow({ steps, onComplete, onBack }: CheckoutFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProducts, setStepProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [cartValidationError, setCartValidationError] = useState<string | null>(null);
  const { shopifyCart, addAddOn, removeAddOn, getOrderSummary, getCheckoutUrl, isLoading, updateProductSelection, loadCart, updateCartItem, removeFromCart, isInitialized, validateProductInCart, refreshCartState, setCartNote, getRecommendedStandCategory } = useCart();

  // Refs for mobile slider auto-scroll
  const sliderRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];
  const [progress, setProgress] = useState(0);
  const orderSummary = getOrderSummary();
  const checkoutUrl = getCheckoutUrl();
  // Persist last known tree selection so step loaders don't break on transient cart order/sync
  const [lastSelectedTreeType, setLastSelectedTreeType] = useState<string | null>(null);
  const [lastSelectedTreeVariant, setLastSelectedTreeVariant] = useState<string | null>(null);
  const loadRetryRef = useRef(0);

  // Handle progress animation
  useEffect(() => {
    // Start from 0 when changing steps
    setProgress(0);
    // Animate to the current step's progress
    const timer = setTimeout(() => {
      setProgress(((currentStep + 1) / steps.length) * 100);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep, steps.length]);

  // Delivery details to be stored as Shopify cart note
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  const composeCartNote = () => {
    const parts: string[] = [];
    if (deliveryDate) parts.push(`Delivery Date: ${deliveryDate}`);
    if (deliveryTime) parts.push(`Time: ${deliveryTime}`);
    if (deliveryNotes) parts.push(`Notes: ${deliveryNotes}`);
    return parts.join(' | ');
  };

  // Delivery time window logic based on New York time and selected date
  const getNYNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const pad = (n: number) => n.toString().padStart(2, '0');
  const nyNow = getNYNow();
  const nyTodayStr = `${nyNow.getFullYear()}-${pad(nyNow.getMonth() + 1)}-${pad(nyNow.getDate())}`;
  const isTodayNY = deliveryDate && deliveryDate === nyTodayStr;
  const minutesNowNY = nyNow.getHours() * 60 + nyNow.getMinutes();
  const cutoff1130 = 11 * 60 + 30;
  const cutoff1400 = 14 * 60;

  const availableTimeSlots: string[] = (() => {
    if (!deliveryDate) return [];
    if (isTodayNY) {
      if (minutesNowNY < cutoff1130) return ['8 AM – 2 PM', '2 PM – 8 PM'];
      if (minutesNowNY < cutoff1400) return ['2 PM – 8 PM'];
      // After 2 PM same-day not available
      return [];
    }
    // Future date: both slots available
    return ['8 AM – 2 PM', '2 PM – 8 PM'];
  })();

  const isTimeSelectDisabled = !deliveryDate || availableTimeSlots.length === 0;
  const after2pmSameDay = Boolean(isTodayNY && availableTimeSlots.length === 0 && minutesNowNY >= cutoff1400);

  // If the currently selected time is no longer valid for the chosen date/time, clear it
  useEffect(() => {
    if (deliveryTime && !availableTimeSlots.includes(deliveryTime)) {
      setDeliveryTime('');
    }
  }, [deliveryDate, minutesNowNY]);

  // Refresh cart data when component mounts to sync with Index component
  useEffect(() => {
    const refreshCartData = async () => {
      // Small delay to ensure any pending cart operations are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      if (shopifyCart?.id) {
        console.log('Refreshing cart data in CheckoutFlow...');
        await loadCart(shopifyCart.id);
      }
    };

    refreshCartData();
  }, [loadCart, shopifyCart?.id]);

  // Validate cart state after step changes
  useEffect(() => {
    const validateCartAfterStepChange = async () => {
      // If we're not on step 0 (base product step) and we have a cart, validate it
      if (currentStep > 0 && shopifyCart?.id) {
        console.log('Validating cart state after step change...');
        const isValid = await refreshCartState();
        if (!isValid) {
          console.warn('Cart state validation failed, cart may have been lost');
          // Try to refresh the entire cart state
          await refreshCartState();
        }
      }
    };

    validateCartAfterStepChange();
  }, [currentStep, shopifyCart?.id, refreshCartState]);

  // Get selected tree type and size from cart (robust across line order)
  const getSelectedTreeType = (): string | null => {
    const edges = shopifyCart?.lines?.edges || [];
    for (const edge of edges) {
      const productTitle = edge?.node?.merchandise?.product?.title || '';
      if (productTitle.includes('Fraser Fir')) return 'Fraser Fir';
      if (productTitle.includes('Balsam Fir')) return 'Balsam Fir';
    }
    return lastSelectedTreeType;
  };

  const getSelectedTreeVariant = () => {
    const edges = shopifyCart?.lines?.edges || [];
    for (const edge of edges) {
      const productTitle = edge?.node?.merchandise?.product?.title || '';
      if (!productTitle) continue;
      if (!productTitle.includes('Fraser Fir') && !productTitle.includes('Balsam Fir')) continue;
      const title = edge?.node?.merchandise?.title || '';
      const variantNumber = title.replace(/[^0-9]/g, '');
      return variantNumber ? `${variantNumber}'` : title;
    }
    return lastSelectedTreeVariant;
  };

  // Keep last-known selection in sync whenever cart lines update
  useEffect(() => {
    const type = getSelectedTreeType();
    const size = getSelectedTreeVariant();
    if (type) setLastSelectedTreeType(type);
    if (size) setLastSelectedTreeVariant(size);
  }, [shopifyCart?.lines?.edges?.length]);

  // Load products for current step based on collection ID, specific product IDs, or tree size
  useEffect(() => {
    // reset retry counter whenever step changes
    loadRetryRef.current = 0;
    const loadStepProducts = async () => {
      if (currentStep >= steps.length - 1) {
        setStepProducts([]);
        return;
      }

      setLoadingProducts(true);
      try {
        let products: any[] = [];
        
        if (currentStepData.isSpecificProducts && currentStepData.productIds) {
          // Load specific products for insurance certificates
          const productPromises = currentStepData.productIds.map(id => 
            ShopifyProductService.getProduct(id)
          );
          const loadedProducts = await Promise.all(productPromises);
          products = loadedProducts.filter(p => p !== null);
        } else if (currentStepData.isStandStep || currentStepData.isInstallationStep) {
          // Get the selected tree variant and type from the cart
          let selectedVariant = getSelectedTreeVariant();
          let selectedType = getSelectedTreeType();

          // If cart hasn't synced yet when navigating back, try a quick refresh once
          if (!selectedVariant || !selectedType) {
            try {
              await refreshCartState();
            } catch {}
            selectedVariant = getSelectedTreeVariant();
            selectedType = getSelectedTreeType();
          }

          // If still unavailable, keep previous products instead of clearing to avoid UI flicker
          if (!selectedVariant || !selectedType) {
            // schedule a short retry (max 3 attempts)
            if (loadRetryRef.current < 3) {
              loadRetryRef.current += 1;
              setTimeout(() => {
                // re-run loading by setting state dependency (toggle progress slightly)
                // simply call the loader again
                loadStepProducts();
              }, 250);
              return;
            }
            setLoadingProducts(false);
            return;
          }

          if (selectedVariant && selectedType) {
            // Get the mapping for the selected tree type and size
            const mapping = getTreeSizeMapping(selectedType as keyof typeof treeSizeMappings, selectedVariant);
            if (mapping) {
              if (currentStepData.isStandStep) {
                const standLinks = mapping.treeStand; // ProductLink[] | null
                if (!standLinks || standLinks.length === 0) {
                  setStepProducts([]);
                  setCartValidationError("Tree stand is included with this size. You can proceed to the next step.");
                  return;
                }

                // Debug logging for specific tree sizes
                if (selectedType === "Fraser Fir" && (selectedVariant === "9'" || selectedVariant === "11'")) {
                  console.log(`Debug - Loading stand products for ${selectedType} ${selectedVariant}`);
                  console.log("Stand links:", JSON.stringify(standLinks, null, 2));
                }

                // Fetch all stand products
                const fetchedStandProducts: any[] = [];
                for (const link of standLinks) {
                  if (!link?.url) continue;
                  
                  // Extract handle from URL - handle different URL formats
                  let handle = '';
                  const productMatch = link.url.match(/\/products\/([^?]+)/);
                  if (productMatch && productMatch[1]) {
                    handle = productMatch[1];
                  } else {
                    console.error('Could not extract handle from URL:', link.url);
                    continue;
                  }
                  
                  try {
                    console.log(`Fetching product by handle: ${handle} (from URL: ${link.url})`);
                    const product = await ShopifyProductService.getProductByHandle(handle);
                    if (product) {
                      fetchedStandProducts.push(product);
                      console.log('Successfully fetched product:', product.title);
                    } else {
                      console.error('Product not found for handle:', handle);
                    }
                  } catch (err) {
                    console.error('Error fetching product for handle:', handle, 'Error:', err);
                  }
                }

                if (fetchedStandProducts.length > 0) {
                  products = fetchedStandProducts;
                  setCartValidationError(null);
                } else {
                  if (loadRetryRef.current < 2) {
                    loadRetryRef.current += 1;
                    setTimeout(() => { loadStepProducts(); }, 300);
                    return;
                  }
                  setStepProducts([]);
                  setCartValidationError("This add-on is currently unavailable. You can proceed to the next step.");
                }
              } else if (currentStepData.isInstallationStep) {
                const installLinks = mapping.installation; // ProductLink[] | null
                if (!installLinks || installLinks.length === 0) {
                  setStepProducts([]);
                  setCartValidationError("Installation service is not available for this size. You can proceed to the next step.");
                  return;
                }

                // Fetch all installation products
                const fetchedProducts: any[] = [];
                for (const link of installLinks) {
                  if (!link?.url) continue;
                  const urlParts = link.url.split('/products/');
                  if (urlParts.length !== 2) continue;
                  const handle = urlParts[1].split('?')[0];
                  try {
                    console.log('Fetching product by handle:', handle);
                    const product = await ShopifyProductService.getProductByHandle(handle);
                    if (product) {
                      fetchedProducts.push(product);
                    }
                  } catch (err) {
                    console.error('Error fetching product for handle:', handle, err);
                  }
                }

                if (fetchedProducts.length > 0) {
                  products = fetchedProducts;
                  setCartValidationError(null);
                } else {
                  if (loadRetryRef.current < 2) {
                    loadRetryRef.current += 1;
                    setTimeout(() => { loadStepProducts(); }, 300);
                    return;
                  }
                  setStepProducts([]);
                  setCartValidationError("This add-on is currently unavailable. You can proceed to the next step.");
                }
              }
            } else {
              // No mapping found - product is not needed for this size
              setStepProducts([]);
              setCartValidationError(
                currentStepData.isStandStep 
                  ? "Tree stand is included with this size. You can proceed to the next step." 
                  : "This service is not needed for this size. You can proceed to the next step."
              );
            }
          }
        } else if (currentStepData.collectionId) {
          // Load products from collection for other steps
          products = await ShopifyProductService.getProductsByCollection(currentStepData.collectionId);
        }

        const isPenultimateStep = currentStep === steps.length - 2;
        setStepProducts(isPenultimateStep ? products : products.slice(0, 4));
        console.log('Loaded products:', products.length);
      } catch (error) {
        console.error('Error loading step products:', error);
        // On transient errors, keep previous products and retry a few times
        if (loadRetryRef.current < 3) {
          loadRetryRef.current += 1;
          setTimeout(() => {
            loadStepProducts();
          }, 300);
          return;
        }
      } finally {
        setLoadingProducts(false);
      }
    };

    loadStepProducts();
  }, [currentStep, currentStepData, steps, shopifyCart?.id, shopifyCart?.lines?.edges?.length, lastSelectedTreeType, lastSelectedTreeVariant]);

  // Auto-scroll to top when step changes (proceed to next step)
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, [currentStep]);

  // Scroll to step function (accessible to onClick handlers)
  const scrollToStep = (stepIndex: number) => {
    if (currentStepRef.current && sliderRef.current) {
      const stepElement = currentStepRef.current;
      const sliderElement = sliderRef.current;

      // Calculate the position to scroll to (center the current step)
      const stepWidth = 80; // min-w-[80px]
      const gap = 8; // gap-2 = 0.5rem = 8px
      const scrollPosition = stepIndex * (stepWidth + gap) - (sliderElement.clientWidth / 2) + (stepWidth / 2);

      sliderElement.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  };

  // Enhanced debug logging for cart state changes
  useEffect(() => {
    console.log('CheckoutFlow - Cart state updated:', {
      hasCart: !!shopifyCart,
      cartId: shopifyCart?.id,
      itemsCount: shopifyCart?.lines?.edges?.length || 0,
      orderSummaryItems: orderSummary?.items?.length || 0,
      currentStep,
      stepName: currentStepData?.title
    });

    // If we're on step 0 and cart is empty, but we just added a product, there might be a sync issue
    if (currentStep === 0 && !shopifyCart && orderSummary?.items?.length === 0) {
      console.warn('Cart appears to be empty on base product step - this might indicate a sync issue');
    }
  }, [shopifyCart, orderSummary, currentStep, currentStepData]);

  // Auto-scroll to current step in mobile slider when step changes
  useEffect(() => {
    // First update progress to 0
    setProgress(0);
    
    // Then scroll to the step
    const scrollTimer = setTimeout(() => scrollToStep(currentStep), 100);
    
    // Finally animate the progress
    const progressTimer = setTimeout(() => {
      setProgress(((currentStep + 1) / steps.length) * 100);
    }, 300);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(progressTimer);
    };
  }, [currentStep, steps.length]);

  const isAddOnSelected = (addOnId: string) => {
    // For now, add-ons are handled locally since Shopify doesn't have add-on concept
    return false;
  };

  const handleAddOnToggle = (addOnId: string) => {
    if (isAddOnSelected(addOnId)) {
      removeAddOn(addOnId);
    } else {
      addAddOn(addOnId);
    }
  };

  const handleQuantityChange = async (lineId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item if quantity is 0 or less
      await removeFromCart(lineId);
    } else {
      // Update item quantity
      await updateCartItem(lineId, newQuantity);
    }
  };

  const handleProductAddToCart = async (product: any, variantId: string) => {
    console.log('=== CheckoutFlow: handleProductAddToCart called ===');
    console.log('Product:', product.name, 'Variant ID:', variantId);
    console.log('Current step:', currentStep, 'Step name:', currentStepData?.title);

    // Check if we're on the Additional Accessories step (second to last step)
    const isAccessoriesStep = currentStep === steps.length - 2;
    
    if (isAccessoriesStep) {
      // For accessories step: don't auto-advance, allow multiple selections
      console.log('Processing accessory addition without auto-advance...');
      try {
        console.log('Calling updateProductSelection for accessory...');
        await updateProductSelection(product, variantId);
        console.log('✅ Accessory added to cart successfully');
      } catch (error) {
        console.error('❌ Error adding accessory to cart:', error);
        // Show error but don't block the flow
      }
    } else {
      // For other steps: advance immediately, add in background (existing behavior)
      console.log('Processing add-on product addition...');
      const nextStep = Math.min(currentStep + 1, steps.length - 1);
      setCurrentStep(nextStep);
      // Scroll to top for the next step immediately
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Process cart addition in the background - user doesn't need to wait for this
      try {
        console.log('Calling updateProductSelection for add-on...');
        await updateProductSelection(product, variantId);
        console.log('✅ Add-on product added to cart successfully in background');
        // Skip immediate validation to avoid transient false negatives while Shopify state syncs.
        // The final summary and sidebar will reflect the true cart state after sync.
      } catch (error) {
        console.error('❌ Error adding add-on product to cart (non-blocking):', error);
        // Do not surface a blocking error here; user has already advanced.
        // Don't interrupt the user flow - they can continue with the checkout process
        // The cart sync will happen when they reach the final step
      }
    }
  };

  const handleRemoveItem = async (lineId: string) => {
    await removeFromCart(lineId);
  };

  const handleIncreaseQuantity = async (lineId: string, currentQuantity: number) => {
    await handleQuantityChange(lineId, currentQuantity + 1);
  };

  const handleDecreaseQuantity = async (lineId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      await handleRemoveItem(lineId);
    } else {
      await handleQuantityChange(lineId, currentQuantity - 1);
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      // Validate current step before proceeding
      const selectedVariant = getSelectedTreeVariant();
      const selectedType = getSelectedTreeType();
      
      // No validation needed here - if products aren't mapped, they're not required

      // Persist order notes when leaving Step 4 (index 3) and Step 5 (index 4)
      try {
        if (currentStep === 3 || currentStep === 4) {
          const note = composeCartNote();
          if (note) {
            await setCartNote(note);
          }
        }
      } catch (e) {
        console.warn('Failed to update cart note (non-blocking):', e);
      }

      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      // Auto-scroll will happen via useEffect
    } else {
      // Final step - redirect to Shopify checkout
      if (checkoutUrl) {
        setIsProcessingCheckout(true);
        // Small delay to show loading state
        setTimeout(() => {
          try {
            window.top.location.href = checkoutUrl;
          } catch (error) {
            try {
              // Fallback to parent if top is not accessible
              window.parent.location.href = checkoutUrl;
            } catch (fallbackError) {
              // Final fallback to current window
              window.location.href = checkoutUrl;
            }
          } finally {
            setIsProcessingCheckout(false);
          }
        }, 500);
      } else {
        onComplete();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      // Auto-scroll will happen via useEffect
    } else {
      onBack();
    }
  };

  // Check if current step is the cart summary step (last step)
  const isCartSummaryStep = currentStep === steps.length - 1;

  // Get step names for progress bar
  const getStepNames = () => {
    return steps.map(step => step.title);
  };

  return (
    <div className="w-full bg-white">
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 max-w-7xl mx-auto">
        {/* Cart Validation Messages - Removed as per request */}

        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">
              {isCartSummaryStep ? 'Review Your Order' : 'Customize Your Order'}
            </h1>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                Step {currentStep + 1} of {steps.length}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {steps.length - currentStep - 1 > 0 ? `${steps.length - currentStep - 1} more steps to checkout` : 'Final step'}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2 transition-all duration-500 ease-in-out" />

          {/* Desktop: Show numbered step names */}
          <div className="hidden md:flex justify-between text-xs text-muted-foreground mt-2">
            {getStepNames().map((stepName, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isUpcoming = index > currentStep;

              return (
                <div key={index} className="flex flex-col items-center relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center 
                    transform transition-all duration-500 ease-in-out ${
                      isCompleted ? 'bg-primary/10' :
                      isCurrent ? 'bg-primary/20 scale-110' : 'bg-gray-100'
                    }`}>
                    <span className={`font-bold text-sm transform transition-all duration-500 ${
                      isCompleted ? 'text-primary scale-100' :
                      isCurrent ? 'text-primary scale-110' : 'text-muted-foreground'
                    }`}>
                      {isCompleted ? (
                        <svg
                          className="w-4 h-4 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                  </div>
                  <span className={`text-xs mt-2 text-center transition-all duration-500 ${
                    isCompleted ? 'text-primary font-medium' :
                    isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>
                    {stepName}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`absolute top-4 left-[calc(100%+8px)] w-[calc(100%-24px)] h-[2px] -ml-2
                      transform transition-all duration-500 ${
                        isCompleted ? 'bg-primary' : 'bg-gray-200'
                      }`} 
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: Show horizontal slider with arrows */}
          <div className="md:hidden mt-2">
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={() => {
                  const newStep = Math.max(0, currentStep - 1);
                  setCurrentStep(newStep);
                  // Auto-scroll to the new current step
                  setTimeout(() => scrollToStep(newStep), 100);
                }}
                disabled={currentStep === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </button>

              {/* Slider Container */}
              <div
                ref={sliderRef}
                className="overflow-x-auto scrollbar-hide mx-10"
                onScroll={() => {
                  // Optional: Add scroll-based step detection if needed
                }}
              >
                <div className="flex gap-2 pb-2 px-2">
                  {getStepNames().map((stepName, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isUpcoming = index > currentStep;

                    return (
                      <div
                        key={index}
                        ref={index === currentStep ? currentStepRef : null}
                        className="flex-shrink-0 flex flex-col items-center min-w-[80px]"
                      >
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 
                          transform transition-all duration-500 ease-in-out ${
                            isCompleted ? 'bg-primary text-primary-foreground scale-100' :
                            isCurrent ? 'bg-primary text-primary-foreground scale-110' : 'bg-gray-200 text-gray-600 scale-100'
                          }`}
                        >
                          {isCompleted ? (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span 
                          className={`text-xs text-center leading-tight px-1 
                          transform transition-all duration-500 ease-in-out ${
                            isCompleted ? 'text-primary font-medium opacity-100' :
                            isCurrent ? 'text-primary font-medium scale-105 opacity-100' : 'text-muted-foreground opacity-70'
                          }`}
                        >
                          {stepName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Arrow */}
              <button
                onClick={() => {
                  const newStep = Math.min(steps.length - 1, currentStep + 1);
                  setCurrentStep(newStep);
                  // Auto-scroll to the new current step
                  setTimeout(() => scrollToStep(newStep), 100);
                }}
                disabled={currentStep === steps.length - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 xl:grid-cols-3 gap-6 lg:gap-8 w-full max-w-full overflow-hidden">
          {/* Main Content Area */}
          <div className={`${isCartSummaryStep ? "lg:col-span-2 xl:col-span-2 space-y-6" : "lg:col-span-3 xl:col-span-3 space-y-6"} max-w-full`}>
            {isCartSummaryStep ? (
              // Final Step - Order Summary
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2 text-center">
                  Order Summary
                </h2>
                <p className="text-muted-foreground text-lg mb-8 text-center">
                  Review your selections before proceeding to checkout
                </p>

                {orderSummary && orderSummary.items.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Your Items:</h3>
                    {orderSummary.items.map((item, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Quantity: {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">${item.price.toFixed(2)}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveItem(item.lineId)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDecreaseQuantity(item.lineId, item.quantity)}
                            disabled={isLoading}
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleIncreaseQuantity(item.lineId, item.quantity)}
                            disabled={isLoading}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Your cart is empty. Please add some products first.
                  </div>
                )}
              </div>
            ) : (
              // Individual Steps (1-5)
              <>
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-foreground mb-2 text-center">
                    {currentStepData.title}
                  </h2>
                  <p className="text-muted-foreground text-lg text-center">
                    {currentStepData.description}
                  </p>
                </div>

                {/* Step-specific content */}
                <div className="bg-card p-6 rounded-lg border">
                  {currentStep === 0 && (
                    // Step 1: Tree Stand
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Tree Stand Options</h3>
                      {(() => {
                        const rec = getRecommendedStandCategory?.();
                        return rec ? (
                          <div className="p-3 border rounded-md bg-green-50 text-green-800 text-sm">
                            Recommended for your tree size: <strong>{rec.label}</strong>
                          </div>
                        ) : null;
                      })()}

                      {loadingProducts ? (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">Loading tree stands...</div>
                        </div>
                      ) : stepProducts.length > 0 ? (
                        (() => {
                          const rec = getRecommendedStandCategory?.();
                          const recLabel = rec?.label?.toLowerCase() || '';
                          const filteredProducts = recLabel
                            ? stepProducts.filter(p => p.variants?.some((v: any) => (v.value || '').toLowerCase().includes(recLabel)))
                            : stepProducts;

                          if (!filteredProducts || filteredProducts.length === 0) {
                            const selectedVariant = getSelectedTreeVariant();
                            const selectedType = getSelectedTreeType();
                            const mapping = selectedType && selectedVariant 
                              ? getTreeSizeMapping(selectedType as keyof typeof treeSizeMappings, selectedVariant)
                              : null;
                            
                            if (mapping && mapping.treeStand === null) {
                              return (
                                <div className="text-center py-8">
                                  <p className="text-gray-600">No stand required for this tree size.</p>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="text-center py-8">
                                <p className="text-gray-600">No tree stand available for the selected tree size.</p>
                                <p className="text-sm text-gray-500 mt-2">Please adjust your tree size or contact us for assistance.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                              {filteredProducts.map((product) => (
                                <div key={product.id} className="w-full h-full flex">
                                  <ProductCard
                                    product={product}
                                    onAddToCart={handleProductAddToCart}
                                    availableProducts={filteredProducts}
                                    showBaseProductSelector={false}
                                    isCartInitialized={isInitialized}
                                    preferredVariantLabel={getRecommendedStandCategory?.()?.label || null}
                                    lockVariantLabel={getRecommendedStandCategory?.()?.label || null}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-600">No tree stand required for this product .</p>
                          <p className="text-sm text-gray-500 mt-2">Proceed firther to next step.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 1 && (
                    // Step 2: Tree Installation - Real products based on tree size
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Installation Services</h3>
                      {loadingProducts ? (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">Loading installation options...</div>
                        </div>
                      ) : stepProducts.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                          {stepProducts.map((product) => (
                            <div key={product.id} className="w-full h-full flex">
                              <ProductCard
                                product={product}
                                onAddToCart={handleProductAddToCart}
                                availableProducts={stepProducts}
                                showBaseProductSelector={false}
                                isCartInitialized={isInitialized}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">No installation options required for your tree size.</div>
                          <p className="text-sm text-gray-500 mt-2">Please continue to the next step.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 2 && (
                    // Step 3: Certificate of Insurance - Show only the two specified products
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Certificate of Insurance</h3>
                      {loadingProducts ? (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">Loading insurance certificate options...</div>
                        </div>
                      ) : stepProducts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {stepProducts.map((product) => (
                            <div key={product.id} className="w-full h-full flex">
                              <ProductCard
                                product={product}
                                onAddToCart={handleProductAddToCart}
                                availableProducts={stepProducts}
                                showBaseProductSelector={false}
                                isCartInitialized={isInitialized}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">No insurance certificate options available.</div>
                          <p className="text-sm text-gray-500 mt-2">Please contact support for assistance.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 3 && (
                    // Step 4: Delivery Date
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Select Delivery Date</h3>
                      
                      {/* Warning Message */}
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                        <div className="text-yellow-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-yellow-800">Delivery Information</h4>
                          <p className="text-sm text-yellow-700">Deliveries will begin from November 22, 2025. Please select a date on or after this date.</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="delivery-date">Delivery Date</label>
                        <input
                          id="delivery-date"
                          type="date"
                          className="w-full mt-1 p-3 border rounded-md"
                          value={deliveryDate}
                          min="2025-11-22" // Set minimum date
                          onChange={(e) => {
                            const selectedDate = new Date(e.target.value);
                            const minDate = new Date('2025-11-22');

                            if (selectedDate < minDate) {
                              setCartValidationError('Please select a date on or after November 22, 2025');
                              return;
                            }

                            setCartValidationError(null);
                            setDeliveryDate(e.target.value);
                          }}
                          onFocus={(e) => {
                            // Ensure the min date is properly enforced for mobile browsers
                            const minDate = new Date('2025-11-22');
                            e.target.min = minDate.toISOString().split('T')[0];
                          }}
                          onClick={(e) => {
                            // For mobile browsers that don't respect min attribute in date picker
                            const minDate = new Date('2025-11-22');
                            const selectedDate = e.target.value ? new Date(e.target.value) : null;

                            // If no date selected or selected date is before min, set to min date
                            if (!selectedDate || selectedDate < minDate) {
                              e.target.value = minDate.toISOString().split('T')[0];
                              setDeliveryDate(minDate.toISOString().split('T')[0]);
                              setCartValidationError(null);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Select your preferred delivery date (available from November 22, 2025)
                        </p>
                      </div>
                    </div>
                  )}

                  {currentStep === 4 && (
                    // Step 5: Delivery Time & Notes
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Delivery Preferences</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Preferred Time Window</label>
                          <Select value={deliveryTime} onValueChange={(v) => setDeliveryTime(v)} disabled={isTimeSelectDisabled}>
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder={deliveryDate ? (after2pmSameDay ? 'Same-day unavailable — choose next day' : 'Select time preference') : 'Select delivery date first'} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTimeSlots.map((slot) => (
                                <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!deliveryDate && (
                            <p className="text-xs text-muted-foreground mt-1">Please select a delivery date first.</p>
                          )}
                          {after2pmSameDay && (
                            <p className="text-xs text-amber-700 mt-2">Same-day cut-off has passed in New York. Please select tomorrow or a later date to see available time windows.</p>
                          )}
                        </div>
                        <div>
                          <label className="text-sm font-medium" htmlFor="delivery-notes">Special Instructions</label>
                          <textarea
                            id="delivery-notes"
                            className="w-full mt-1 p-3 border rounded-md resize-none"
                            rows={4}
                            placeholder="Enter any special delivery instructions..."
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Your selected date, time, and notes will be saved to your order notes.</p>
                      
                      <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-700">
                        <p className="font-medium">⚠️ Same-Day Delivery Cut-Off Times</p>
                        <p className="text-sm mt-2">
                          We offer same-day delivery, but please note the following cut-off rules:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                          <li>Orders must be placed before 11:30 AM to qualify for the 8 AM – 2 PM delivery slot.</li>
                          <li>Orders placed after 11:30 AM but before 2:00 PM qualify only for the 2 PM – 8 PM delivery slot.</li>
                          <li>After 2:00 PM, same-day delivery is no longer available. Orders placed after this time will be scheduled for delivery the next day.</li>
                        </ul>
                        <p className="text-sm mt-2">
                          Thank you for understanding — this helps us ensure timely deliveries for everyone.
                        </p>
                      </div>
                    </div>
                  )}

                  {currentStep === steps.length - 2 && (
                    // New Step: Additional Accessories from specified collection
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Additional Accessories</h3>

                      {loadingProducts ? (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">Loading accessories...</div>
                        </div>
                      ) : stepProducts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                          {stepProducts.map((product) => (
                            <div key={product.id} className="w-full h-full flex">
                              <ProductCard
                                product={product}
                                onAddToCart={handleProductAddToCart}
                                availableProducts={stepProducts}
                                showBaseProductSelector={false}
                                isCartInitialized={isInitialized}
                                cartData={shopifyCart}
                                showQuantityCounter={true}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-600">No accessories available at the moment.</p>
                          <p className="text-sm text-gray-500 mt-2">Please check back later or contact us for assistance.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {currentStep === 0 ? 'Back to Product' : 'Previous'}
              </Button>

              <Button
                onClick={handleNext}
                className="bg-gradient-primary hover:opacity-90 text-primary-foreground flex items-center gap-2 px-8"
                disabled={isCartSummaryStep && (!orderSummary || orderSummary.items.length === 0) || isProcessingCheckout}
              >
                {isProcessingCheckout ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {isCartSummaryStep ? 'Proceed to Checkout' : (currentStep === 3 || currentStep === 4 ? 'Continue' : (currentStep === steps.length - 2 ? 'Continue' : 'Skip'))}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Order Summary Sidebar - Only show on final step */}
          {isCartSummaryStep && (
            <div className="lg:col-span-1">
              <Card className="sticky top-4 shadow-lg">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderSummary && (
                    <>
                      {orderSummary.items.map((item, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.name}</p>
                              {item.quantity > 1 && (
                                <p className="text-xs text-muted-foreground">
                                  Qty: {item.quantity}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-sm">${item.price.toFixed(2)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(item.lineId)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDecreaseQuantity(item.lineId, item.quantity)}
                              disabled={isLoading}
                              className="h-6 w-6 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium min-w-[1.5rem] text-center">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleIncreaseQuantity(item.lineId, item.quantity)}
                              disabled={isLoading}
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          {index < orderSummary.items.length - 1 && <Separator />}
                        </div>
                      ))}

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>${orderSummary.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span>${orderSummary.tax.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span>${orderSummary.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {checkoutUrl && currentStep === steps.length - 1 && (
                        <div className="pt-4">
                          <Button
                            onClick={() => {
                              // Always redirect to top window for checkout
                              setIsProcessingCheckout(true);
                              setTimeout(() => {
                                try {
                                  window.top.location.href = checkoutUrl;
                                } catch (error) {
                                  try {
                                    // Fallback to parent if top is not accessible
                                    window.parent.location.href = checkoutUrl;
                                  } catch (fallbackError) {
                                    // Final fallback to current window
                                    window.location.href = checkoutUrl;
                                  }
                                } finally {
                                  setIsProcessingCheckout(false);
                                }
                              }, 500);
                            }}
                            disabled={isProcessingCheckout}
                            className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                          >
                            {isProcessingCheckout ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4" />
                                Complete Purchase
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Bottom Order Summary visible on all steps */}
        <div className="mt-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Updated Order</CardTitle>
            </CardHeader>
            <CardContent>
              {orderSummary && orderSummary.items && orderSummary.items.length > 0 ? (
                <>
                  {orderSummary.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-2">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator className="my-3" />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>${orderSummary.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>${orderSummary.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span>${orderSummary.total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
