import type { Model, Query, QueryFilter } from 'mongoose';

export class QueryBuilder<T> {
  private modelQuery: Query<T[], T>;
  private readonly queryParams: Record<string, unknown>;

  constructor(query: Query<T[], T>, queryParams: Record<string, unknown>) {
    this.modelQuery = query;
    this.queryParams = queryParams;
  }

  search(searchableFields: string[]) {
    const search = this.queryParams['search'];
    if (typeof search === 'string' && search.trim() && searchableFields.length > 0) {
      const regex = new RegExp(search.trim(), 'i');
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map((field) => ({ [field]: { $regex: regex } })),
      } as QueryFilter<T>);
    }
    return this;
  }

  filter(excludeFields: string[]) {
    const raw = { ...this.queryParams };
    excludeFields.forEach((f) => delete raw[f]);

    const filters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value !== undefined && value !== null && value !== '') {
        filters[key] = value;
      }
    }

    if (Object.keys(filters).length > 0) {
      this.modelQuery = this.modelQuery.find(filters as QueryFilter<T>);
    }
    return this;
  }

  sort() {
    const sortParam = this.queryParams['sort'];
    const sortStr = typeof sortParam === 'string' && sortParam.trim() ? sortParam : '-createdAt';
    const sortObj: Record<string, 1 | -1> = {};
    sortStr.split(',').forEach((field) => {
      const trimmed = field.trim();
      if (trimmed.startsWith('-')) {
        sortObj[trimmed.slice(1)] = -1;
      } else if (trimmed) {
        sortObj[trimmed] = 1;
      }
    });
    this.modelQuery = this.modelQuery.sort(sortObj);
    return this;
  }

  paginate() {
    const page = Math.max(1, Number(this.queryParams['page']) || 1);
    const limit = Math.min(100, Math.max(1, Number(this.queryParams['limit']) || 10));
    this.modelQuery = this.modelQuery.skip((page - 1) * limit).limit(limit);
    return this;
  }

  async execute(): Promise<T[]> {
    return this.modelQuery;
  }

  async countTotal(): Promise<number> {
    // getFilter() returns conditions without skip/limit — gives the true unpagianted count
    const m = this.modelQuery.model as Model<T>;
    return m.countDocuments(this.modelQuery.getFilter() as QueryFilter<T>);
  }
}
