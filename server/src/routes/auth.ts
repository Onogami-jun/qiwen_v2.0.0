import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import {
  register, login, logout, refreshToken,
  verifyEmail, forgotPassword, resetPassword, getMe,
} from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('邮箱格式不正确'),
  body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名 3-20 位，只能包含字母、数字、下划线'),
  body('password').isLength({ min: 8 }).withMessage('密码至少 8 位').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('密码需包含大写字母、小写字母和数字'),
  body('displayName').trim().isLength({ min: 1, max: 30 }).withMessage('昵称 1-30 位'),
], validate, register);

authRouter.post('/login', authLimiter, [
  body('emailOrUsername').trim().notEmpty().withMessage('请输入邮箱或用户名'),
  body('password').notEmpty().withMessage('请输入密码'),
], validate, login);

authRouter.post('/logout', logout);
authRouter.post('/refresh', refreshToken);

authRouter.get('/verify-email', [
  query('token').isUUID().withMessage('无效的验证令牌'),
], validate, verifyEmail);

authRouter.post('/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('邮箱格式不正确'),
], validate, forgotPassword);

authRouter.post('/reset-password', [
  body('token').isUUID().withMessage('无效的重置令牌'),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('密码需包含大小写字母和数字，至少 8 位'),
], validate, resetPassword);

authRouter.get('/me', requireAuth, getMe);
