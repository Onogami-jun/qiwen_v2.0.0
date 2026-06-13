import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { AppError } from './error';

export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return next(new AppError('未授权，请先登录', 401));
  }
  const token = auth.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError('访问令牌无效或已过期', 401));
  }
}

export function requirePlan(...plans: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('未授权', 401));
    if (!plans.includes(req.user.plan)) {
      return next(new AppError('当前套餐不支持此功能，请升级', 403));
    }
    next();
  };
}
