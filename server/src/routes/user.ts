import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';
import bcrypt from 'bcryptjs';
import { config } from '../config';

export const userRouter = Router();
userRouter.use(requireAuth);

// Get profile
userRouter.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, username: true, displayName: true, avatar: true, bio: true, plan: true, createdAt: true },
    });
    if (!user) throw new AppError('用户不存在', 404);
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// Update profile
userRouter.patch('/profile', [
  body('displayName').optional().trim().isLength({ min: 1, max: 30 }),
  body('bio').optional().trim().isLength({ max: 200 }),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { displayName, bio } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { ...(displayName && { displayName }), ...(bio !== undefined && { bio }) },
      select: { id: true, displayName: true, bio: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// Change password
userRouter.post('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError('当前密码不正确', 401);
    }
    const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ success: true, message: '密码已更新' });
  } catch (e) { next(e); }
});

// Get usage stats
userRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const stats = await prisma.usageStat.findMany({
      where: { userId: req.user!.userId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    const totals = await prisma.document.aggregate({
      where: { userId: req.user!.userId },
      _count: { id: true },
      _sum: { wordCount: true },
    });
    res.json({
      success: true,
      data: {
        daily: stats,
        total: {
          documents: totals._count.id,
          words: totals._sum.wordCount || 0,
        },
      },
    });
  } catch (e) { next(e); }
});

// Delete account
userRouter.delete('/account', [
  body('password').notEmpty().withMessage('请输入密码确认删除'),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('密码不正确', 401);
    }
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    res.clearCookie('qiwen_refresh', { path: '/' });
    res.json({ success: true, message: '账户已注销' });
  } catch (e) { next(e); }
});
