import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    googleId: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization header is missing or invalid' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-jwt-key') as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authorization token' });
  }
}
