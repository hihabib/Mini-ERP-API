/**
 * Idempotent seed script — safe to run multiple times.
 * Upserts permissions, roles, and the default admin user.
 *
 * Required env vars: MONGO_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Permission } from '../modules/role/permission.model.js';
import { Role } from '../modules/role/role.model.js';
import { User } from '../modules/user/user.model.js';

const MONGO_URI = process.env.MONGO_URI;
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!MONGO_URI || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
  console.error('Missing required env vars: MONGO_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD');
  process.exit(1);
}

// ─── Permission definitions ────────────────────────────────────────────────────

const PERMISSIONS = [
  { key: 'product:create', description: 'Create a new product', module: 'product' },
  { key: 'product:view', description: 'View products', module: 'product' },
  { key: 'product:update', description: 'Update a product', module: 'product' },
  { key: 'product:delete', description: 'Delete a product', module: 'product' },
  { key: 'sale:create', description: 'Create a new sale', module: 'sale' },
  { key: 'sale:view', description: 'View sales history', module: 'sale' },
  { key: 'dashboard:view', description: 'Access the dashboard', module: 'dashboard' },
  { key: 'user:create', description: 'Create a new user', module: 'user' },
  { key: 'user:view', description: 'View users', module: 'user' },
  { key: 'user:update', description: 'Update a user', module: 'user' },
] as const;

// ─── Role definitions ──────────────────────────────────────────────────────────

const ROLES: { name: string; permissionKeys: string[] }[] = [
  {
    name: 'Admin',
    permissionKeys: PERMISSIONS.map((p) => p.key),
  },
  {
    name: 'Manager',
    permissionKeys: [
      'product:create',
      'product:view',
      'product:update',
      'sale:create',
      'sale:view',
    ],
  },
  {
    name: 'Employee',
    permissionKeys: ['product:view', 'sale:create', 'sale:view'],
  },
];

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedPermissions() {
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await Permission.findOneAndUpdate({ key: perm.key }, perm, {
      upsert: true,
      returnDocument: 'after',
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} permissions upserted`);
}

async function seedRoles() {
  console.log('Seeding roles...');
  for (const roleDef of ROLES) {
    const permDocs = await Permission.find({ key: { $in: roleDef.permissionKeys } }, '_id');
    const permIds = permDocs.map((p) => p._id);

    await Role.findOneAndUpdate(
      { name: roleDef.name },
      { name: roleDef.name, permissions: permIds, isSystemRole: true },
      { upsert: true, returnDocument: 'after' },
    );
  }
  console.log(`  ✓ ${ROLES.length} roles upserted`);
}

async function seedAdminUser(email: string, password: string) {
  console.log('Seeding admin user...');
  const adminRole = await Role.findOne({ name: 'Admin' });
  if (!adminRole) {
    throw new Error('Admin role not found — run role seed first');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('  ✓ Admin user already exists, skipping');
    return;
  }

  await User.create({ name: 'Admin', email, password, role: adminRole._id });
  console.log('  ✓ Admin user created');
}

async function seedEmployeeTestUser() {
  console.log('Seeding employee test user...');
  const employeeRole = await Role.findOne({ name: 'Employee' });
  if (!employeeRole) {
    throw new Error('Employee role not found — run role seed first');
  }

  const existing = await User.findOne({ email: 'employee@mini-erp.dev' });
  if (existing) {
    console.log('  ✓ Employee test user already exists, skipping');
    return;
  }

  await User.create({
    name: 'Test Employee',
    email: 'employee@mini-erp.dev',
    password: 'Employee@1234!',
    role: employeeRole._id,
  });
  console.log('  ✓ Employee test user created');
}

async function seedManagerTestUser() {
  console.log('Seeding manager test user...');
  const managerRole = await Role.findOne({ name: 'Manager' });
  if (!managerRole) {
    throw new Error('Manager role not found — run role seed first');
  }

  const existing = await User.findOne({ email: 'manager@mini-erp.dev' });
  if (existing) {
    console.log('  ✓ Manager test user already exists, skipping');
    return;
  }

  await User.create({
    name: 'Test Manager',
    email: 'manager@mini-erp.dev',
    password: 'Manager@1234!',
    role: managerRole._id,
  });
  console.log('  ✓ Manager test user created');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(MONGO_URI!);
  console.log('Connected.\n');

  try {
    await seedPermissions();
    await seedRoles();
    await seedAdminUser(SEED_ADMIN_EMAIL!, SEED_ADMIN_PASSWORD!);
    await seedManagerTestUser();
    await seedEmployeeTestUser();
    console.log('\nSeed complete.\n');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
