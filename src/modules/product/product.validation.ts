import { z } from 'zod';

const productFields = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200).trim(),
  sku: z.string().min(2, 'SKU must be at least 2 characters').max(50).trim(),
  category: z.string().min(2, 'Category must be at least 2 characters').max(100).trim(),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be ≥ 0'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be ≥ 0'),
  stockQuantity: z.coerce.number().int().min(0, 'Stock quantity must be ≥ 0'),
});

// stockQuantity defaults to 0 on create; Mongoose schema also enforces this as a fallback.
// sellingPrice below purchasePrice is intentionally allowed — a store may sell at a loss
// (e.g. clearance). Enforce a business rule here if the policy changes.
export const createProductSchema = productFields.extend({
  stockQuantity: z.coerce.number().int().min(0).default(0),
});

export const updateProductSchema = productFields.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
