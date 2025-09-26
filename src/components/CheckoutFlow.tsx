import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Plus, ArrowLeft, ArrowRight, Star, ExternalLink, ShoppingBag, Minus, Trash2, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckoutStep, AddOn } from '@/types/checkout';
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
  const { shopifyCart, addAddOn, removeAddOn, getOrderSummary, getCheckoutUrl, isLoading, updateProductSelection, loadCart, updateCartItem, removeFromCart, isInitialized, validateProductInCart, refreshCartState } = useCart();

  // Refs for mobile slider auto-scroll
  const sliderRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const orderSummary = getOrderSummary();
  const checkoutUrl = getCheckoutUrl();

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

  // Load products for current step based on collection ID
  useEffect(() => {
    const loadStepProducts = async () => {
      if (!currentStepData?.collectionId || currentStep >= steps.length - 1) {
        setStepProducts([]);
        return;
      }

      setLoadingProducts(true);
      try {
        console.log('Loading products for collection:', currentStepData.collectionId);
        const products = await ShopifyProductService.getProductsByCollection(currentStepData.collectionId);
        setStepProducts(products.slice(0, 4)); // Show up to 4 products per step
        console.log('Loaded products:', products.length);
      } catch (error) {
        console.error('Error loading step products:', error);
        setStepProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadStepProducts();
  }, [currentStep, currentStepData, steps]);

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
    // Scroll to current step in mobile slider when step changes
    const timer = setTimeout(() => scrollToStep(currentStep), 150);
    return () => clearTimeout(timer);
  }, [currentStep]);

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

    // For base products (step 0), wait for cart operation to complete before advancing
    if (currentStep === 0) {
      // Use existing cart logic from useCart hook instead of creating new cart
      try {
        console.log('CheckoutFlow: Adding base product to existing cart...');
        console.log('Current cart state:', { hasCart: !!shopifyCart, cartId: shopifyCart?.id });

        // Use the updateProductSelection from useCart hook which handles existing cart logic
        await updateProductSelection(product, variantId);
        console.log('CheckoutFlow: Base product added to cart successfully');

        // Wait a moment for cart state to update and then validate
        console.log('Waiting for cart state to sync...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Validate the base product was added
        console.log('Validating base product in cart...');
        const isProductInCart = await validateProductInCart(product.id, variantId);
        console.log('Base product validation result:', isProductInCart);

        if (!isProductInCart) {
          console.error('❌ Base product was not found in cart after adding - retrying...');

          // Try to refresh cart state multiple times
          console.log('Attempting to refresh cart state...');
          let refreshAttempts = 0;
          let maxRefreshAttempts = 3;

          while (refreshAttempts < maxRefreshAttempts) {
            refreshAttempts++;
            console.log(`Refresh attempt ${refreshAttempts}/${maxRefreshAttempts}...`);
            await refreshCartState();
            // Wait for state to update
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check again
            console.log('Re-validating base product in cart after refresh...');
            const recheck = await validateProductInCart(product.id, variantId);
            console.log('Re-validation result:', recheck);

            if (recheck) {
              console.log('✅ Base product found in cart after refresh attempt', refreshAttempts);
              break;
            }

            if (refreshAttempts === maxRefreshAttempts) {
              console.error('❌ Failed to find base product in cart after all refresh attempts');
              const errorMessage = 'Failed to find base product in cart after all refresh attempts. Please try again.';
              setCartValidationError(errorMessage);
              return; // Don't advance if validation fails
            }
          }

          if (!await validateProductInCart(product.id, variantId)) {
            const errorMessage = 'Base product was not found in cart after validation. Please try again.';
            setCartValidationError(errorMessage);
            console.error('❌', errorMessage);
            return; // Don't advance if validation fails
          }
        }

        // Auto-advance to next step after successful cart addition AND validation
        console.log('✅ All validations passed - auto-advancing to next step');
        const nextStep = Math.min(currentStep + 1, steps.length - 1);
        setCurrentStep(nextStep);
        // Scroll to top for the next step
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        console.error('❌ Error adding base product to cart:', error);
        setCartValidationError('Failed to add base product to cart. Please try again.');
        // Don't advance if there was an error
        return;
      }
    } else {
      // For add-on products (other steps), instantly advance and process in background
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

        // Validate the add-on was added
        console.log('Validating add-on product in cart...');
        const isProductInCart = await validateProductInCart(product.id, variantId);
        console.log('Add-on validation result:', isProductInCart);

        if (!isProductInCart) {
          console.warn('⚠️ Add-on product was not found in cart after adding');
          setCartValidationError('Add-on product may not have been added properly. Please check your cart.');
        }
      } catch (error) {
        console.error('❌ Error adding add-on product to cart (non-blocking):', error);
        setCartValidationError('Failed to add add-on product. Please try again.');
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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
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
        {/* Cart Validation Error Alert */}
        {cartValidationError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div className="flex-1">
                <p className="text-red-800 font-medium">Cart Validation Error</p>
                <p className="text-red-600 text-sm">{cartValidationError}</p>
              </div>
              <button
                onClick={() => setCartValidationError(null)}
                className="text-red-600 hover:text-red-800 text-lg font-bold"
              >
                ×
              </button>
            </div>
          </div>
        )}

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
          <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-2" />

          {/* Desktop: Show numbered step names */}
          <div className="hidden md:flex justify-between text-xs text-muted-foreground mt-2">
            {getStepNames().map((stepName, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isUpcoming = index > currentStep;

              return (
                <div key={index} className="flex flex-col items-center">
                  <span className={`font-bold text-sm ${
                    isCompleted ? 'text-primary' :
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <span className={`text-xs mt-1 ${
                    isCompleted ? 'text-primary' :
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {stepName}
                  </span>
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-colors duration-200 ${
                          isCompleted ? 'bg-primary text-primary-foreground' :
                          isCurrent ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className={`text-xs text-center leading-tight px-1 transition-colors duration-200 ${
                          isCompleted ? 'text-primary font-medium' :
                          isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'
                        }`}>
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

                      {loadingProducts ? (
                        <div className="text-center py-8">
                          <div className="text-lg text-gray-600">Loading tree stands...</div>
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
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-600">No tree stands available at the moment.</p>
                          <p className="text-sm text-gray-500 mt-2">Please check back later or contact us for assistance.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 1 && (
                    // Step 2: Tree Installation
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Installation Services</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">Professional Installation</h4>
                            <p className="text-sm text-muted-foreground">Our experts will set up your tree perfectly</p>
                          </div>
                          <span className="font-bold">$75.00</span>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">Basic Setup</h4>
                            <p className="text-sm text-muted-foreground">Tree placement and basic positioning</p>
                          </div>
                          <span className="font-bold">$35.00</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Installation service selection will be implemented in the next phase.</p>
                    </div>
                  )}

                  {currentStep === 2 && (
                    // Step 3: Certificate of Insurance
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Insurance Certificate</h3>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-900">Required for Installation Services</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          An insurance certificate is required when you select professional installation services.
                          This protects both you and our installation team.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="insurance-cert" className="rounded" />
                          <label htmlFor="insurance-cert" className="text-sm">
                            I have obtained the required insurance certificate
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="no-insurance" className="rounded" />
                          <label htmlFor="no-insurance" className="text-sm">
                            I do not need installation services
                          </label>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Insurance certificate handling will be implemented in the next phase.</p>
                    </div>
                  )}

                  {currentStep === 3 && (
                    // Step 4: Delivery Date
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Select Delivery Date</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2">
                          <h4 className="font-medium">December 20</h4>
                          <p className="text-sm text-muted-foreground">Friday</p>
                          <p className="text-xs text-green-600 mt-1">✓ Available</p>
                        </Card>
                        <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2">
                          <h4 className="font-medium">December 21</h4>
                          <p className="text-sm text-muted-foreground">Saturday</p>
                          <p className="text-xs text-green-600 mt-1">✓ Available</p>
                        </Card>
                        <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2">
                          <h4 className="font-medium">December 22</h4>
                          <p className="text-sm text-muted-foreground">Sunday</p>
                          <p className="text-xs text-green-600 mt-1">✓ Available</p>
                        </Card>
                      </div>
                      <p className="text-sm text-muted-foreground">Delivery date selection will be implemented in the next phase.</p>
                    </div>
                  )}

                  {currentStep === 4 && (
                    // Step 5: Delivery Date Time Notes
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Delivery Preferences</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Preferred Time Window</label>
                          <Select>
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Select time preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                              <SelectItem value="afternoon">Afternoon (12 PM - 5 PM)</SelectItem>
                              <SelectItem value="evening">Evening (5 PM - 8 PM)</SelectItem>
                              <SelectItem value="anytime">Anytime</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Special Instructions</label>
                          <textarea
                            className="w-full mt-1 p-3 border rounded-md resize-none"
                            rows={4}
                            placeholder="Enter any special delivery instructions..."
                          />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Delivery time preferences and notes will be implemented in the next phase.</p>
                    </div>
                  )}

                  {currentStep === 5 && (
                    // Step 6: Order Summary - Show actual order summary content
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="flex justify-center mb-6">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <ShoppingBag className="w-8 h-8 text-primary" />
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-4 text-center">Order Summary</h3>
                        <p className="text-muted-foreground text-lg mb-6 text-center">
                          Review your selections before proceeding to checkout
                        </p>
                      </div>

                      {orderSummary && orderSummary.items.length > 0 ? (
                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold">Your Items:</h4>
                          {orderSummary.items.map((item, index) => (
                            <Card key={index} className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h5 className="font-medium">{item.name}</h5>
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

                          <Card className="p-4 bg-gray-50">
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
                          </Card>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Your cart is empty. Please add some products first.
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
                    {isCartSummaryStep ? 'Proceed to Checkout' : 'Continue'}
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
      </div>
    </div>
  );
}
