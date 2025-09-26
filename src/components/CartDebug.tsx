import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShopifyCartService, ShopifyProductService } from '@/services/shopifyService';

export function CartDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testCartCreation = async () => {
    setIsTesting(true);
    try {
      // Use a known working variant ID for testing
      const testVariantId = 'gid://shopify/ProductVariant/41360398483536';
      console.log('Testing cart creation with variant ID:', testVariantId);

      const cartId = await ShopifyCartService.createCart(testVariantId, 1);
      console.log('Test cart creation result:', cartId);

      setDebugInfo({
        testVariantId,
        cartId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Test cart creation error:', error);
      setDebugInfo({
        error: error,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Cart Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={testCartCreation}
          disabled={isTesting}
          className="w-full"
        >
          {isTesting ? 'Testing...' : 'Test Cart Creation'}
        </Button>

        {debugInfo && (
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-bold mb-2">Debug Information:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
