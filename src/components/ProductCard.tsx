import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, ShoppingCart, Loader2 } from 'lucide-react';
import { Product } from '@/types/checkout';
import { ShopifyCartService } from '@/services/shopifyService';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, variantId: string) => void;
  availableProducts?: Product[];
  showBaseProductSelector?: boolean;
  isCartInitialized?: boolean;
  preferredVariantLabel?: string | null;
  lockVariantLabel?: string | null;
}

export function ProductCard({ product, onAddToCart, availableProducts = [], showBaseProductSelector = true, isCartInitialized = true, preferredVariantLabel = null, lockVariantLabel = null }: ProductCardProps) {
  // If there's only one variant, use it directly for initial state (will update on base product change)
  const defaultVariantId = product.variants.length > 0 ? product.variants[0].id : '';
  const [selectedVariant, setSelectedVariant] = useState(defaultVariantId);
  const [selectedBaseProductId, setSelectedBaseProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to prevent multiple API calls
  const isApiCallInProgress = useRef(false);

  const selectedBaseProduct = availableProducts.find(p => p.id === selectedBaseProductId);
  const effectiveProduct = (showBaseProductSelector && selectedBaseProduct) ? selectedBaseProduct : product;
  // Apply optional lock to restrict visible/selectable variants
  const visibleVariants = lockVariantLabel
    ? effectiveProduct.variants.filter(v => (v.value || '').toLowerCase().includes(lockVariantLabel.toLowerCase()))
    : effectiveProduct.variants;

  const hasMultipleVariants = visibleVariants.length > 1;
  const selectedVariantData = visibleVariants.find(v => v.id === selectedVariant) || visibleVariants[0];
  const finalPrice = (effectiveProduct.basePrice) + (selectedVariantData?.priceModifier || 0);
  const isProductSelected = selectedBaseProductId !== null;

  // Auto-select preferred or locked variant if provided and available on the effective product
  useEffect(() => {
    const targetLabel = lockVariantLabel || preferredVariantLabel;
    if (!targetLabel) return;
    if (!visibleVariants || visibleVariants.length === 0) return;
    const match = visibleVariants.find(v => (v.value || '').toLowerCase().includes(targetLabel.toLowerCase()));
    if (match && match.id !== selectedVariant) {
      setSelectedVariant(match.id);
    } else if (!match && visibleVariants[0] && visibleVariants[0].id !== selectedVariant) {
      // Fallback to first visible
      setSelectedVariant(visibleVariants[0].id);
    }
  }, [preferredVariantLabel, lockVariantLabel, effectiveProduct?.id, visibleVariants.length]);

  const handleAddToCart = async () => {
    // Prevent multiple clicks and API calls
    if (isSubmitting || !isCartInitialized || isApiCallInProgress.current) return;

    setIsSubmitting(true);
    isApiCallInProgress.current = true;

    try {
      // For main products, call parent callback to handle cart logic properly
      const productToAdd = availableProducts.find(p => p.id === selectedBaseProductId) || product;
      
      // Find selected variant details
      const selectedVariantDetails = productToAdd.variants.find(v => v.id === selectedVariant);
      
      console.log('ProductCard: Adding product to cart...', {
        productName: productToAdd.name,
        productId: productToAdd.id,
        variantId: selectedVariant,
        variantValue: selectedVariantDetails?.value || 'unknown',
        variantTitle: selectedVariantDetails?.name || 'unknown'
      });

      // Call the parent callback to trigger validation and auto-forward
      onAddToCart(productToAdd, selectedVariant);
      
      console.log('ProductCard: Successfully added to cart');
    } catch (error) {
      console.error('ProductCard: Error adding to cart:', error);
    } finally {
      // Reset the API call flag and loading state
      isApiCallInProgress.current = false;
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  const handleBaseProductChange = (baseProductId: string) => {
    if (baseProductId === 'none') {
      setSelectedBaseProductId(null);
      setSelectedVariant('');
    } else {
      const selectedProduct = availableProducts.find(p => p.id === baseProductId);
      if (selectedProduct) {
        setSelectedBaseProductId(baseProductId);
        // Set default variant for the selected product
        const defaultVariantId = selectedProduct.variants.length > 0 ? selectedProduct.variants[0].id : '';
        setSelectedVariant(defaultVariantId);
      }
    }
  };

  // Don't render if no variants are available
  if (product.variants.length === 0) {
    return (
      <Card className="overflow-hidden shadow-lg border-0 bg-card">
        <div className="relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-80 object-cover"
          />
          <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
            Best Seller
          </Badge>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-warning text-warning" />
            ))}
            <span className="text-sm text-muted-foreground">(2,847 reviews)</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{product.name}</h2>
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold text-foreground">${finalPrice}</span>
              </div>
            </div>

            <Button
              disabled
              className="w-full bg-muted text-muted-foreground cursor-not-allowed"
            >
              Product Unavailable
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden shadow-lg border-0 bg-card ${showBaseProductSelector ? 'w-fit mx-auto' : 'w-full h-full'}`}>
      <div className="relative">
        {showBaseProductSelector ? (
          // Base product card behavior
          isProductSelected ? (
            <img
              src={"/WhatsApp Image 2025-09-25 at 15.54.25_8ce0d4fb.jpg"}
              alt="Selected Tree"
              className="max-h-[400px] object-contain"
            />
          ) : (
            <img
              src={"/WhatsApp Image 2025-09-25 at 15.54.25_8ce0d4fb.jpg"}
              alt="Choose Your Tree"
              className="max-h-[400px] object-contain"
            />
          )
        ) : (
          // Add-on product cards keep existing behavior
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-80 object-cover"
          />
        )}
      </div>

      <CardContent className="px-2 py-2 space-y-3">
        <div className="flex items-center gap-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-warning text-warning" />
          ))}
          <span className="text-sm text-muted-foreground">(2,847 reviews)</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {showBaseProductSelector && !isProductSelected ? "Choose Your Tree" : product.name}
          </h2>
          {/* Product description hidden as requested */}
        </div>

        <div className="space-y-3">
          {/* Base Product Selection Dropdown - Only show if multiple products are available and showBaseProductSelector is true */}
          {showBaseProductSelector && availableProducts.length > 1 && (
            <div key={`base-selector-${selectedBaseProductId || 'none'}`}>
              {!isProductSelected && (
                <div className="mb-2 text-sm text-muted-foreground">
                  <p className="mb-1">• <span className="font-medium text-foreground">Fraser Fir:</span> Premium choice</p>
                  <p className="mb-1">  Excellent needle retention & strong branches</p>
                  <p className="mb-1">• <span className="font-medium text-foreground">Balsam Fir:</span> Classic choice</p>
                  <p>  Soft needles & traditional holiday scent</p>
                </div>
              )}
              <label className="text-sm font-medium text-foreground">Select Tree Type</label>
              <Select value={selectedBaseProductId || 'none'} onValueChange={handleBaseProductChange}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a tree type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span>None</span>
                  </SelectItem>
                  {availableProducts.map((availableProduct) => (
                    <SelectItem key={availableProduct.id} value={availableProduct.id}>
                      <div className="flex justify-between items-center w-full">
                        <span>{availableProduct.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ${availableProduct.basePrice}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show variant selector based on product type */}
          {hasMultipleVariants && (
            showBaseProductSelector ? isProductSelected : true
          ) && (
            <div key={`variant-selector-${selectedBaseProductId}`}>
              <label className="text-sm font-medium text-foreground">Select Size</label>
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {effectiveProduct.variants.map((variant) => {
                    const variantPrice = effectiveProduct.basePrice + variant.priceModifier;
                    const isSamePrice = variant.priceModifier === 0;
                    return (
                      <SelectItem key={variant.id} value={variant.id}>
                        <div className="flex justify-between items-center w-full">
                          <span>{variant.value}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ${variantPrice.toFixed(2)}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleAddToCart}
            className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground font-medium py-3 transition-all duration-normal shadow-primary"
            size="lg"
            disabled={(showBaseProductSelector ? !isProductSelected : false) || !selectedVariant || isSubmitting || !isCartInitialized}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Selecting...
              </>
            ) : !isCartInitialized ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 mr-2" />
                Select
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-muted-foreground">Free Shipping</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-muted-foreground">30-Day Returns</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}