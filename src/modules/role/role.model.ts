import { Schema, model, type Types } from 'mongoose';

export interface IRole {
  name: string;
  permissions: Types.ObjectId[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Role = model<IRole>('Role', roleSchema);
