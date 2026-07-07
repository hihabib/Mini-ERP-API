import { Schema, model, type Types } from 'mongoose';

export interface IProduct {
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQuantity: number;
  imageUrl: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Full-text search on name and sku
productSchema.index({ name: 'text', sku: 'text' });
// Dashboard queries filter on stock thresholds within a category
productSchema.index({ category: 1, stockQuantity: 1 });

export const Product = model<IProduct>('Product', productSchema);
