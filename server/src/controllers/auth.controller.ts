import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { prisma } from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { AppError } from '../middleware/error';
import { config } from '../config';
import { logger } from '../utils/logger';

function cookieOpts(maxAge = config.cookie.maxAge) {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge,
    path: '/',
  };
}

// ── Register ──────────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, username, password, displayName } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      const field = existing.email === email ? '邮箱' : '用户名';
      throw new AppError(`${field} 已被注册`, 409);
    }

    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
    const user = await prisma.user.create({
      data: {
        email, username, passwordHash,
        displayName: displayName || username,
        workspaces: {
          create: {
            name: '我的工作区',
            description: '默认工作区',
            icon: '📁',
            isDefault: true,
          },
        },
      },
      select: { id: true, email: true, username: true, displayName: true, plan: true },
    });

    // Email verification token
    const verToken = await prisma.emailVerification.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(user.email, user.displayName, verToken.token);

    logger.info(`New user registered: ${user.email}`);
    res.status(201).json({
      success: true,
      message: '注册成功！请查收验证邮件以激活账户',
      data: { userId: user.id },
    });
  } catch (err) { next(err); }
}

// ── Login ─────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { emailOrUsername, password, rememberMe } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
        isActive: true,
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('邮箱/用户名或密码错误', 401);
    }

    if (!user.isVerified) {
      throw new AppError('请先验证邮箱后再登录', 403);
    }

    // Access token
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      plan: user.plan,
    });

    // Refresh token
    const tokenId = uuid();
    const refreshToken = signRefreshToken({ userId: user.id, tokenId });
    const refreshExpiry = rememberMe
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiry,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Set refresh token as httpOnly cookie
    res.cookie('qiwen_refresh', refreshToken, cookieOpts(refreshExpiry.getTime() - Date.now()));

    res.json({
      success: true,
      message: '登录成功',
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          plan: user.plan,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (err) { next(err); }
}

// ── Refresh token ─────────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.qiwen_refresh;
    if (!token) throw new AppError('未找到刷新令牌', 401);

    let payload: { userId: string; tokenId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.clearCookie('qiwen_refresh');
      throw new AppError('刷新令牌无效或已过期，请重新登录', 401);
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: { select: { id: true, email: true, plan: true, isActive: true } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date() || !stored.user.isActive) {
      res.clearCookie('qiwen_refresh');
      throw new AppError('令牌已失效，请重新登录', 401);
    }

    // Rotate: revoke old, issue new
    const newTokenId = uuid();
    const newRefresh = signRefreshToken({ userId: stored.user.id, tokenId: newTokenId });
    const newExpiry = new Date(stored.expiresAt);

    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: stored.id }, data: { isRevoked: true } }),
      prisma.refreshToken.create({
        data: { id: newTokenId, token: newRefresh, userId: stored.user.id, expiresAt: newExpiry },
      }),
    ]);

    const accessToken = signAccessToken({
      userId: stored.user.id,
      email: stored.user.email,
      plan: stored.user.plan,
    });

    res.cookie('qiwen_refresh', newRefresh, cookieOpts(newExpiry.getTime() - Date.now()));
    res.json({ success: true, data: { accessToken } });
  } catch (err) { next(err); }
}

// ── Logout ────────────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.qiwen_refresh;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { token }, data: { isRevoked: true },
      });
    }
    res.clearCookie('qiwen_refresh', { path: '/' });
    res.json({ success: true, message: '已安全退出' });
  } catch (err) { next(err); }
}

// ── Verify email ──────────────────────────────────────
export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.query as { token: string };
    const record = await prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('验证链接无效或已过期', 400);
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } }),
      prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    // Redirect to app with success
    res.redirect(`${config.server.clientUrl}/login?verified=true`);
  } catch (err) { next(err); }
}

// ── Forgot password ───────────────────────────────────
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (user) {
      const reset = await prisma.passwordReset.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await sendPasswordResetEmail(user.email, user.displayName, reset.token);
    }

    res.json({ success: true, message: '若该邮箱已注册，重置链接已发送' });
  } catch (err) { next(err); }
}

// ── Reset password ────────────────────────────────────
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = req.body;
    const record = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('重置链接无效或已过期', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke all refresh tokens
      prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { isRevoked: true } }),
    ]);

    res.clearCookie('qiwen_refresh', { path: '/' });
    res.json({ success: true, message: '密码重置成功，请重新登录' });
  } catch (err) { next(err); }
}

// ── Get current user ──────────────────────────────────
export async function getMe(req: any, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatar: true, bio: true, plan: true, isVerified: true,
        lastLoginAt: true, createdAt: true,
        workspaces: { select: { id: true, name: true, icon: true, color: true, isDefault: true } },
      },
    });
    if (!user) throw new AppError('用户不存在', 404);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}
