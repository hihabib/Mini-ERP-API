import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodIssue } from 'zod';
import { BadRequestError } from '../shared/ApiError.js';

type RequestPart = 'body' | 'query' | 'params';

function issuesToErrors(issues: ZodIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!map[key]) {
      map[key] = issue.message;
    }
  }
  return map;
}

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new BadRequestError('Validation failed', issuesToErrors(result.error.issues)));
      return;
    }
    req[part] = result.data;
    next();
  };
}
