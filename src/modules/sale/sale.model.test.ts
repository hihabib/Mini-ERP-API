import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { Sale } from './sale.model.js';

const soldById = new Types.ObjectId();
const productId = new Types.ObjectId();

const baseSaleItem = () => ({
  product: productId,
  productNameSnapshot: 'Widget A',
  quantity: 2,
  unitPriceSnapshot: 50,
  subtotal: 100,
});

const baseSale = () => ({
  items: [baseSaleItem()],
  grandTotal: 100,
  soldBy: soldById,
});

describe('Sale model', () => {
  it('creates a sale with embedded items', async () => {
    const sale = await Sale.create(baseSale());
    expect(sale.items).toHaveLength(1);
    expect(sale.grandTotal).toBe(100);
    expect(sale._id).toBeDefined();
  });

  it('preserves productNameSnapshot and price snapshots after save and retrieve', async () => {
    const sale = await Sale.create({
      items: [
        {
          product: productId,
          productNameSnapshot: 'Legacy Widget',
          quantity: 3,
          unitPriceSnapshot: 25.5,
          subtotal: 76.5,
        },
      ],
      grandTotal: 76.5,
      soldBy: soldById,
    });

    const retrieved = await Sale.findById(sale._id).lean();
    expect(retrieved?.items[0].productNameSnapshot).toBe('Legacy Widget');
    expect(retrieved?.items[0].unitPriceSnapshot).toBe(25.5);
    expect(retrieved?.items[0].subtotal).toBe(76.5);
  });

  it('supports multiple embedded items', async () => {
    const sale = await Sale.create({
      items: [
        {
          product: productId,
          productNameSnapshot: 'Item 1',
          quantity: 1,
          unitPriceSnapshot: 10,
          subtotal: 10,
        },
        {
          product: new Types.ObjectId(),
          productNameSnapshot: 'Item 2',
          quantity: 2,
          unitPriceSnapshot: 15,
          subtotal: 30,
        },
      ],
      grandTotal: 40,
      soldBy: soldById,
    });
    expect(sale.items).toHaveLength(2);
  });

  it('fails when soldBy is missing', async () => {
    const { soldBy: _s, ...data } = baseSale();
    await expect(Sale.create(data)).rejects.toThrow(/soldBy/i);
  });

  it('fails when grandTotal is missing', async () => {
    const { grandTotal: _g, ...data } = baseSale();
    await expect(Sale.create(data)).rejects.toThrow(/grandTotal/i);
  });

  it('fails when a sale item has quantity below 1', async () => {
    await expect(
      Sale.create({
        ...baseSale(),
        items: [{ ...baseSaleItem(), quantity: 0 }],
      }),
    ).rejects.toThrow();
  });

  it('records createdAt timestamp', async () => {
    const sale = await Sale.create(baseSale());
    expect(sale.createdAt).toBeInstanceOf(Date);
  });
});
