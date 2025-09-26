import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, ShoppingCart, Loader2 } from 'lucide-react';
import { Product } from '@/types/checkout';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, variantId: string) => void;
  availableProducts?: Product[];
  showBaseProductSelector?: boolean;
}

export function ProductCard({ product, onAddToCart, availableProducts = [], showBaseProductSelector = true }: ProductCardProps) {
  // Only use variant selection if there are multiple variants and a product is selected (not none)
  const hasMultipleVariants = product.variants.length > 1;

  // If there's only one variant, use it directly
  const defaultVariantId = product.variants.length > 0 ? product.variants[0].id : '';
  const [selectedVariant, setSelectedVariant] = useState(defaultVariantId);
  const [selectedBaseProductId, setSelectedBaseProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVariantData = product.variants.find(v => v.id === selectedVariant);
  const selectedBaseProduct = availableProducts.find(p => p.id === selectedBaseProductId);
  const finalPrice = (selectedBaseProduct?.basePrice || product.basePrice) + (selectedVariantData?.priceModifier || 0);
  const isProductSelected = selectedBaseProductId !== null;

  const handleAddToCart = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // For add-on products (when showBaseProductSelector is false), use the current product directly
      if (!showBaseProductSelector) {
        // Instantly call without awaiting - let cart processing happen in background
        onAddToCart(product, selectedVariant);
      } else if (selectedBaseProductId && selectedVariant) {
        // For main products, find the actual product to add to cart
        const productToAdd = availableProducts.find(p => p.id === selectedBaseProductId) || product;
        // Instantly call without awaiting - let cart processing happen in background
        onAddToCart(productToAdd, selectedVariant);
      }
    } catch (error) {
      console.error('Error in ProductCard handleAddToCart:', error);
    } finally {
      // Brief delay for UX feedback, then allow another selection
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
        <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
          Best Seller
        </Badge>
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
                  {product.variants.map((variant) => {
                    const variantPrice = product.basePrice + variant.priceModifier;
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
            disabled={(showBaseProductSelector ? !isProductSelected : false) || !selectedVariant || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Selecting...
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