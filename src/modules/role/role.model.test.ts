import { describe, it, expect, beforeAll } from 'vitest';
import { Types } from 'mongoose';
import { Role } from './role.model.js';

beforeAll(async () => {
  await Role.createIndexes();
});

describe('Role model', () => {
  it('creates a role with all required fields', async () => {
    const role = await Role.create({ name: 'Admin' });
    expect(role.name).toBe('Admin');
    expect(role.isSystemRole).toBe(false);
    expect(role.permissions).toEqual([]);
  });

  it('fails when name is missing', async () => {
    await expect(Role.create({ permissions: [] })).rejects.toThrow(/name/i);
  });

  it('enforces unique name constraint', async () => {
    await Role.create({ name: 'Manager' });
    await expect(Role.create({ name: 'Manager' })).rejects.toThrow(/duplicate key|E11000/i);
  });

  it('stores array of permission references', async () => {
    const permId1 = new Types.ObjectId();
    const permId2 = new Types.ObjectId();
    const role = await Role.create({ name: 'Employee', permissions: [permId1, permId2] });
    expect(role.permissions).toHaveLength(2);
    expect(role.permissions[0].toString()).toBe(permId1.toString());
  });

  it('marks system roles with isSystemRole flag', async () => {
    const role = await Role.create({ name: 'SuperAdmin', isSystemRole: true });
    expect(role.isSystemRole).toBe(true);
  });
});
