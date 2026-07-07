import mongoose from 'mongoose';
import { Product } from '../product/product.model.js';
import { Sale } from './sale.model.js';
import { NotFoundError, InsufficientStockError } from '../../shared/ApiError.js';
import { QueryBuilder } from '../../shared/queryBuilder/QueryBuilder.js';
import { emitStockUpdated, emitSaleCreated } from '../../config/socket.js';
import type { CreateSaleInput } from './sale.validation.js';

export async function createSale(data: CreateSaleInput, userId: string) {
  const session = await mongoose.connection.startSession();

  // Variables populated inside the transaction callback and read after commit.
  let saleId = '';
  let grandTotal = 0;
  let itemCount = 0;
  let createdAt = new Date();
  let stockUpdates: Array<{ productId: string; newStock: number }> = [];
  let saleDoc: Awaited<ReturnType<typeof Sale.create>>[number] | undefined;

  try {
    await session.withTransaction(async () => {
      // Fetch all referenced products inside the transaction for snapshot isolation.
      const productIds = data.items.map((i) => i.product);
      const products = await Product.find({ _id: { $in: productIds } }).session(session);

      // Validate existence — name the first missing product ID.
      for (const item of data.items) {
        const found = products.find((p) => p._id.toString() === item.product);
        if (!found) throw new NotFoundError(`Product '${item.product}' not found`);
      }

      // Validate stock — collect all failures so the error names every problem.
      const stockProblems: string[] = [];
      for (const item of data.items) {
        const p = products.find((p) => p._id.toString() === item.product)!;
        if (p.stockQuantity < item.quantity) {
          stockProblems.push(
            `Insufficient stock for '${p.name}': ${p.stockQuantity} available, ${item.quantity} requested`,
          );
        }
      }
      if (stockProblems.length > 0) {
        throw new InsufficientStockError(stockProblems.join('; '));
      }

      // Build embedded sale items with price snapshots.
      const saleItems = data.items.map((item) => {
        const p = products.find((p) => p._id.toString() === item.product)!;
        return {
          product: p._id,
          productNameSnapshot: p.name,
          quantity: item.quantity,
          unitPriceSnapshot: p.sellingPrice,
          subtotal: p.sellingPrice * item.quantity,
        };
      });

      grandTotal = saleItems.reduce((sum, i) => sum + i.subtotal, 0);

      // Decrement stock for all items atomically within the transaction.
      await Promise.all(
        data.items.map((item) =>
          Product.findByIdAndUpdate(
            item.product,
            { $inc: { stockQuantity: -item.quantity } },
            { session },
          ),
        ),
      );

      // Create the sale document within the same transaction.
      [saleDoc] = await Sale.create([{ items: saleItems, grandTotal, soldBy: userId }], {
        session,
      });

      // Capture socket payload from transaction-consistent data.
      saleId = saleDoc._id.toString();
      itemCount = saleItems.length;
      createdAt = saleDoc.createdAt;
      stockUpdates = data.items.map((item) => {
        const p = products.find((p) => p._id.toString() === item.product)!;
        return { productId: item.product, newStock: p.stockQuantity - item.quantity };
      });
    });
  } finally {
    await session.endSession();
  }

  // Emit real-time events after the transaction commits — outside the session so
  // a socket error cannot trigger a transaction rollback.
  emitStockUpdated(stockUpdates);
  emitSaleCreated({ saleId, grandTotal, itemCount, createdAt });

  return saleDoc!;
}

export async function listSales(queryParams: Record<string, unknown>) {
  const builder = new QueryBuilder(Sale.find(), queryParams)
    .filter(['sort', 'page', 'limit'])
    .sort()
    .paginate();

  const [data, total] = await Promise.all([builder.execute(), builder.countTotal()]);
  const page = Math.max(1, Number(queryParams['page']) || 1);
  const limit = Math.min(100, Math.max(1, Number(queryParams['limit']) || 10));

  return { data, meta: { page, limit, total } };
}

export async function getSale(id: string) {
  const sale = await Sale.findById(id).populate('soldBy', 'name email');
  if (!sale) throw new NotFoundError('Sale not found');
  return sale;
}
