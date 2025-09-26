import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Package, Truck, Calendar } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

interface OrderCompleteProps {
  onNewOrder: () => void;
}

export function OrderComplete({ onNewOrder }: OrderCompleteProps) {
  const { getOrderSummary, shopifyCart } = useCart();
  const orderSummary = getOrderSummary();
  const orderNumber = `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Order Confirmed!
            </h1>
            <p className="text-muted-foreground text-lg">
              Thank you for your purchase. Your order has been received and is being processed.
            </p>
          </div>

          {/* Order Details */}
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Order Details</CardTitle>
                <Badge variant="secondary">#{orderNumber}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderSummary && (
                <>
                  {orderSummary.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        {item.quantity > 1 && (
                          <p className="text-sm text-muted-foreground">
                            Quantity: {item.quantity}
                          </p>
                        )}
                      </div>
                      <span className="font-medium">${item.price}</span>
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Order Confirmed</p>
                    <p className="text-sm text-muted-foreground">Your order has been received</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Processing</p>
                    <p className="text-sm text-muted-foreground">
                      We're preparing your order for shipment
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Shipped</p>
                    <p className="text-sm text-muted-foreground">
                      Estimated delivery: 2-3 business days
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Delivered</p>
                    <p className="text-sm text-muted-foreground">
                      Track your package with the provided tracking number
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="flex items-center gap-2"
            >
              Print Receipt
            </Button>
            <Button
              onClick={onNewOrder}
              className="bg-gradient-primary hover:opacity-90 text-primary-foreground flex items-center gap-2"
            >
              Start New Order
            </Button>
          </div>

          {/* Shopify Integration Note */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              This checkout flow is ready for Shopify integration via iframe embed.
              <br />
              All order data can be seamlessly passed to your Shopify backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}