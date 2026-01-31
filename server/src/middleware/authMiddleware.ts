import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const [, token] = header.split(' ');
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
}
