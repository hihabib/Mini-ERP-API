// Dynamic permission check middleware — implementation pending role module
import type { Request, Response, NextFunction } from 'express';

export function requirePermission(
  _permission: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (_req, _res, next) => next();
}
