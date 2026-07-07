import type { Request, Response, NextFunction } from 'express';
import { Role } from '../modules/role/role.model.js';
import { ApiError } from '../shared/ApiError.js';

type PermissionDoc = { key: string };
type PopulatedRole = { permissions: PermissionDoc[] };

export function requirePermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    try {
      const role = (await Role.findById(req.user.roleId)
        .populate('permissions')
        .lean()) as unknown as PopulatedRole | null;

      if (!role) {
        next(new ApiError(403, 'Role not found'));
        return;
      }

      const hasPermission = role.permissions.some((p) => p.key === permission);

      if (!hasPermission) {
        next(new ApiError(403, `Forbidden: missing permission '${permission}'`));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
