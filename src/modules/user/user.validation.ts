import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ID format',
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: objectIdSchema,
});

export const updateUserSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name is too long'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    role: objectIdSchema,
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const getUserSchema = z.object({
  id: objectIdSchema,
});
