import { Product } from '../product/product.model.js';
import { Sale } from './sale.model.js';
import { NotFoundError, InsufficientStockError } from '../../shared/ApiError.js';
import { QueryBuilder } from '../../shared/queryBuilder/QueryBuilder.js';
import { emitStockUpdated, emitSaleCreated } from '../../config/socket.js';
import type { CreateSaleInput } from './sale.validation.js';

export async function createSale(data: CreateSaleInput, userId: string) {
  // Fetch all referenced products
  const productIds = data.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });

  // Validate existence
  for (const item of data.items) {
    const found = products.find((p) => p._id.toString() === item.product);
    if (!found) throw new NotFoundError(`Product '${item.product}' not found`);
  }

  // Validate stock
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

  // Build embedded sale items with price snapshots
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

  const grandTotal = saleItems.reduce((sum, i) => sum + i.subtotal, 0);

  // Decrement stock for all items atomically
  const decrementResults = await Promise.all(
    data.items.map((item) =>
      Product.findOneAndUpdate(
        { _id: item.product, stockQuantity: { $gte: item.quantity } },
        { $inc: { stockQuantity: -item.quantity } },
        { new: true },
      ),
    ),
  );

  // If any product failed to update (concurrent stock depletion)
  if (decrementResults.includes(null)) {
    // Manually rollback the ones that succeeded
    await Promise.all(
      decrementResults.map((result, index) => {
        if (result) {
          return Product.findByIdAndUpdate(result._id, {
            $inc: { stockQuantity: data.items[index].quantity },
          });
        }
        return Promise.resolve();
      }),
    );
    throw new InsufficientStockError(
      'One or more products had insufficient stock during checkout.',
    );
  }

  // Create the sale document
  const createdSales = await Sale.create([{ items: saleItems, grandTotal, soldBy: userId }]);
  const saleDoc = createdSales[0];

  // Capture socket payload
  const saleId = saleDoc._id.toString();
  const itemCount = saleItems.length;
  const createdAt = saleDoc.createdAt;
  const stockUpdates = data.items.map((item) => {
    const p = products.find((p) => p._id.toString() === item.product)!;
    return { productId: item.product, newStock: p.stockQuantity - item.quantity };
  });

  // Emit real-time events
  emitStockUpdated(stockUpdates);
  emitSaleCreated({ saleId, grandTotal, itemCount, createdAt });

  return saleDoc;
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
