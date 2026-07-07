import { describe, it, expect, beforeAll } from 'vitest';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './user.model.js';

beforeAll(async () => {
  await User.createIndexes();
});

const roleId = new Types.ObjectId();
const baseUser = () => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  password: 'plaintext123',
  role: roleId,
});

describe('User model', () => {
  it('creates a user with all required fields', async () => {
    const user = await User.create(baseUser());
    expect(user.name).toBe('Test User');
    expect(user.isActive).toBe(true);
    expect(user._id).toBeDefined();
  });

  it('fails when name is missing', async () => {
    const data = baseUser();
    await expect(User.create({ ...data, name: undefined })).rejects.toThrow(/name/i);
  });

  it('fails when email is missing', async () => {
    const { email: _email, ...data } = baseUser();
    await expect(User.create(data)).rejects.toThrow(/email/i);
  });

  it('fails when password is missing', async () => {
    const { password: _pw, ...data } = baseUser();
    await expect(User.create(data)).rejects.toThrow(/password/i);
  });

  it('fails when role is missing', async () => {
    const { role: _role, ...data } = baseUser();
    await expect(User.create(data)).rejects.toThrow(/role/i);
  });

  it('enforces unique email constraint', async () => {
    const shared = { ...baseUser(), email: 'duplicate@example.com' };
    await User.create(shared);
    await expect(User.create({ ...shared, email: 'duplicate@example.com' })).rejects.toThrow(
      /duplicate key|E11000/i,
    );
  });

  it('hashes the password before saving', async () => {
    const plainPassword = 'mySecret99';
    const user = await User.create({ ...baseUser(), password: plainPassword });
    expect(user.password).not.toBe(plainPassword);
    const isMatch = await bcrypt.compare(plainPassword, user.password);
    expect(isMatch).toBe(true);
  });

  it('does not include password in toJSON output', async () => {
    const user = await User.create(baseUser());
    const json = user.toJSON() as unknown as Record<string, unknown>;
    expect(json.password).toBeUndefined();
  });

  it('normalises email to lowercase', async () => {
    const user = await User.create({ ...baseUser(), email: 'Upper@Example.COM' });
    expect(user.email).toBe('upper@example.com');
  });
});
