import { Schema, model, type Types } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete (ret as unknown as Record<string, unknown>).password;
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);
