import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';

interface CartButtonProps {
  onCartClick: () => void;
  onStoreClick: () => void;
}

export function CartButton({ onCartClick, onStoreClick }: CartButtonProps) {
  const { shopifyCart, getCheckoutUrl, error } = useCart();
  const checkoutUrl = getCheckoutUrl();

  const itemCount = shopifyCart?.lines?.edges?.length || 0;

  return (
    <div className="flex items-center gap-3">
      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 px-2 py-1 rounded">
          Cart Error: {error}
        </div>
      )}

      {/* Store Link */}
      <Button
        variant="outline"
        onClick={onStoreClick}
        className="flex items-center gap-2"
      >
        <ExternalLink className="w-4 h-4" />
        Visit Store
      </Button>

      {/* Cart Button */}
      <Button
        variant="outline"
        onClick={onCartClick}
        className="relative flex items-center gap-2"
      >
        <ShoppingCart className="w-5 h-5" />
        Cart
        {itemCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {itemCount}
          </Badge>
        )}
      </Button>

      {/* Checkout Button */}
      {checkoutUrl && itemCount > 0 && (
        <Button
          onClick={() => window.location.href = checkoutUrl}
          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Checkout
        </Button>
      )}
    </div>
  );
}
