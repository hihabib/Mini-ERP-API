import { z } from 'zod';

const objectIdPattern = /^[a-f\d]{24}$/i;

const saleItemSchema = z.object({
  product: z.string().regex(objectIdPattern, 'Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
