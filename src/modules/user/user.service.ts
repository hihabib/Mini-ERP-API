import { Types } from 'mongoose';
import { User } from './user.model.js';
import { Role } from '../role/role.model.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../shared/ApiError.js';
import { QueryBuilder } from '../../shared/queryBuilder/QueryBuilder.js';

interface CreateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: string;
}

interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
}

export async function createUser(data: CreateUserPayload) {
  // Check if email is already taken
  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) {
    throw new ConflictError(`Email ${data.email} is already in use`);
  }

  // Validate the role exists
  const role = await Role.findById(data.role);
  if (!role) {
    throw new BadRequestError('Invalid role ID');
  }

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password, // Handled by pre-save hook for hashing
    role: data.role,
  });

  return await user.populate('role', 'name');
}

export async function updateUser(userId: string, data: UpdateUserPayload, currentUserId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent self-deactivation
  if (data.isActive === false && userId === currentUserId) {
    throw new BadRequestError('Cannot deactivate your own account');
  }

  // Check email conflict if updating email
  if (data.email && data.email !== user.email) {
    const existingEmail = await User.findOne({ email: data.email });
    if (existingEmail) {
      throw new ConflictError(`Email ${data.email} is already in use`);
    }
  }

  // Check role validity if updating role
  if (data.role && data.role !== user.role.toString()) {
    const role = await Role.findById(data.role);
    if (!role) {
      throw new BadRequestError('Invalid role ID');
    }
  }

  if (data.name !== undefined) user.name = data.name;
  if (data.email !== undefined) user.email = data.email;
  if (data.password !== undefined) user.password = data.password; // Handled by pre-save hook
  if (data.role !== undefined) user.role = new Types.ObjectId(data.role);
  if (data.isActive !== undefined) user.isActive = data.isActive;

  await user.save();
  return await user.populate('role', 'name');
}

export async function getUsers(query: Record<string, unknown>) {
  const queryBuilder = new QueryBuilder(User.find().populate('role', 'name'), query)
    .search(['name', 'email'])
    .filter(['search', 'page', 'limit', 'sort'])
    .sort()
    .paginate();

  const users = await queryBuilder.execute();
  const total = await queryBuilder.countTotal();

  return { users, total };
}

export async function getUser(userId: string) {
  const user = await User.findById(userId).populate('role', 'name permissions');
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}
