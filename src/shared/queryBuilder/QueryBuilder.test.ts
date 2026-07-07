import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Schema, model, type Document } from 'mongoose';
import { QueryBuilder } from './QueryBuilder.js';

interface IItem {
  name: string;
  sku: string;
  category: string;
  price: number;
}

const itemSchema = new Schema<IItem>({
  name: { type: String, required: true },
  sku: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
});

const Item = model<IItem>('QBItem', itemSchema);

const FIXTURES: IItem[] = [
  { name: 'Widget Alpha', sku: 'WGT-001', category: 'electronics', price: 10 },
  { name: 'Widget Beta', sku: 'WGT-002', category: 'electronics', price: 20 },
  { name: 'Gadget Pro', sku: 'GDG-001', category: 'toys', price: 30 },
  { name: 'Gadget Lite', sku: 'GDG-002', category: 'toys', price: 5 },
  { name: 'Super Tool', sku: 'TL-001', category: 'tools', price: 50 },
];

describe('QueryBuilder', () => {
  beforeAll(async () => {
    await Item.createIndexes();
  });

  beforeEach(async () => {
    await Item.insertMany(FIXTURES);
  });

  describe('search()', () => {
    it('matches partial text case-insensitively across searchable fields', async () => {
      const results = await new QueryBuilder(Item.find(), { search: 'widget' })
        .search(['name', 'sku'])
        .execute();

      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.name.toLowerCase()).toContain('widget'));
    });

    it('searches across multiple fields', async () => {
      // "GDG" appears in sku only
      const results = await new QueryBuilder(Item.find(), { search: 'GDG' })
        .search(['name', 'sku'])
        .execute();

      expect(results).toHaveLength(2);
    });

    it('returns all documents when search is absent', async () => {
      const results = await new QueryBuilder(Item.find(), {}).search(['name', 'sku']).execute();

      expect(results).toHaveLength(FIXTURES.length);
    });
  });

  describe('filter()', () => {
    it('applies exact-match filter on remaining params', async () => {
      const results = await new QueryBuilder(Item.find(), {
        category: 'toys',
        search: undefined,
        sort: undefined,
        page: undefined,
        limit: undefined,
      })
        .filter(['search', 'sort', 'page', 'limit'])
        .execute();

      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.category).toBe('toys'));
    });

    it('ignores excluded fields', async () => {
      const results = await new QueryBuilder(Item.find(), { search: 'widget', sort: '-price' })
        .filter(['search', 'sort', 'page', 'limit'])
        .execute();

      // No extra filter applied — all 5 items returned
      expect(results).toHaveLength(FIXTURES.length);
    });
  });

  describe('sort()', () => {
    it('sorts ascending with plain field name', async () => {
      const results = (await new QueryBuilder(Item.find(), { sort: 'price' })
        .sort()
        .execute()) as (Document & IItem)[];

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].price).toBeLessThanOrEqual(results[i + 1].price);
      }
    });

    it('sorts descending with -field syntax', async () => {
      const results = (await new QueryBuilder(Item.find(), { sort: '-price' })
        .sort()
        .execute()) as (Document & IItem)[];

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].price).toBeGreaterThanOrEqual(results[i + 1].price);
      }
    });

    it('defaults to -createdAt when sort param is absent', async () => {
      // Just verifying it does not throw — ordering by _id insertion is implicitly tested
      const results = await new QueryBuilder(Item.find(), {}).sort().execute();
      expect(results).toHaveLength(FIXTURES.length);
    });
  });

  describe('paginate()', () => {
    it('returns the first page slice', async () => {
      const results = await new QueryBuilder(Item.find(), { page: '1', limit: '2' })
        .paginate()
        .execute();

      expect(results).toHaveLength(2);
    });

    it('returns the second page slice', async () => {
      const results = await new QueryBuilder(Item.find(), { page: '2', limit: '2' })
        .paginate()
        .execute();

      expect(results).toHaveLength(2);
    });

    it('defaults to page 1, limit 10 when params are absent', async () => {
      const results = await new QueryBuilder(Item.find(), {}).paginate().execute();
      expect(results).toHaveLength(FIXTURES.length); // fewer than 10
    });
  });

  describe('countTotal()', () => {
    it('returns total matching documents ignoring pagination', async () => {
      const builder = new QueryBuilder(Item.find(), {
        category: 'electronics',
        page: '1',
        limit: '1',
      })
        .filter(['search', 'sort', 'page', 'limit'])
        .paginate();

      const data = await builder.execute();
      const total = await builder.countTotal();

      expect(data).toHaveLength(1); // paginated slice
      expect(total).toBe(2); // all electronics
    });

    it('counts all documents when no filter is applied', async () => {
      const builder = new QueryBuilder(Item.find(), { page: '1', limit: '2' }).paginate();
      const total = await builder.countTotal();
      expect(total).toBe(FIXTURES.length);
    });
  });
});
