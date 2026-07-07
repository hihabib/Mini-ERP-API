import { Product } from '../product/product.model.js';
import { Sale } from '../sale/sale.model.js';

const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_CAP = 10;

export async function getDashboardStats() {
  const [totalProducts, totalSales, revenueAgg, lowStockProducts, lowStockCount] =
    await Promise.all([
      Product.countDocuments(),
      Sale.countDocuments(),
      Sale.aggregate<{ total: number }>([
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
      ]),
      Product.find({ stockQuantity: { $lt: LOW_STOCK_THRESHOLD } })
        .sort({ stockQuantity: 1 })
        .limit(LOW_STOCK_CAP)
        .select('name sku stockQuantity'),
      Product.countDocuments({ stockQuantity: { $lt: LOW_STOCK_THRESHOLD } }),
    ]);

  const totalRevenue = revenueAgg[0]?.total ?? 0;

  return { totalProducts, totalSales, totalRevenue, lowStockProducts, lowStockCount };
}
