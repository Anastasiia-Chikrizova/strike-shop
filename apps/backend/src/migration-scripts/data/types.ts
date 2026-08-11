import { ProductStatus } from "@medusajs/framework/utils";

export interface SeedProductVariant {
  title: string;
  sku: string;
  options?: Record<string, string>;
  prices: { amount: number; currency_code: string }[];
}

export interface SeedProduct {
  title: string;
  category_ids: string[];
  description: string;
  handle: string;
  weight: number;
  status: ProductStatus;
  shipping_profile_id: string;
  options?: { id: string }[];
  variants: SeedProductVariant[];
  sales_channels: { id: string }[];
}
