export interface Product {
  id: string;
  name: string;
  title: string;
  description: string;
  basePrice: number;
  image: string;
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  priceModifier: number;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  popular?: boolean;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  addOns: string[];
}

export interface TreeSizeMapping {
  size: string;
  variant: string;
  treePrice: number;
  standUrl?: string;
  standPrice?: number;
  installationUrl?: string;
  installationPrice?: number;
}

export interface CheckoutStep {
  id: number;
  title: string;
  description: string;
  addOns: AddOn[];
  collectionId?: string | null;
  productIds?: string[];
  isSpecificProducts?: boolean;
  isStandStep?: boolean;
  isInstallationStep?: boolean;
  isTreeRemovalStep?: boolean;
}

export interface OrderSummary {
  subtotal: number;
  tax: number;
  total: number;
  items: {
    name: string;
    price: number;
    quantity: number;
  }[];
}