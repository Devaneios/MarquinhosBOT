import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export function checkToken(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token not provided' });
  }
  const expectedKey = process.env.MARQUINHOS_API_KEY;
  if (!expectedKey) {
    return res.status(500).json({ message: 'Server misconfiguration' });
  }
  // Timing-safe comparison to prevent timing-based API key extraction
  const tokenBuf = Buffer.from(token);
  const keyBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== keyBuf.length || !timingSafeEqual(tokenBuf, keyBuf)) {
    return res.status(401).json({ message: 'Token not authorized' });
  }
  next();
}
