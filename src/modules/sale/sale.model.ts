import { Schema, model, type Types } from 'mongoose';

export interface ISaleItem {
  product: Types.ObjectId;
  productNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  subtotal: number;
}

export interface ISale {
  items: ISaleItem[];
  grandTotal: number;
  soldBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Sale items are embedded (not referenced) for two reasons:
// 1. Sales are read as whole documents far more often than queried item-by-item,
//    so embedding avoids expensive $lookup joins on every read.
// 2. Snapshotting product name and price at sale time protects historical records —
//    if a product is renamed or repriced later, past sale totals remain accurate.
const saleItemSchema = new Schema<ISaleItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productNameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceSnapshot: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true },
  },
  { _id: false },
);

const saleSchema = new Schema<ISale>(
  {
    items: { type: [saleItemSchema], required: true },
    // grandTotal is always calculated server-side from unitPriceSnapshot values;
    // client-supplied totals are never trusted.
    grandTotal: { type: Number, required: true },
    soldBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Sale = model<ISale>('Sale', saleSchema);
