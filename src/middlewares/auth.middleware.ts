// JWT verification middleware — implementation pending auth module
import type { Request, Response, NextFunction } from 'express';

export function authenticate(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
