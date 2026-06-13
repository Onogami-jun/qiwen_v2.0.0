import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);

workspaceRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { userId: req.user!.userId },
      include: { _count: { select: { documents: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: workspaces });
  } catch (e) { next(e); }
});

workspaceRouter.post('/', [
  body('name').trim().isLength({ min: 1, max: 50 }),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { name, description, icon, color, profession } = req.body;
    const workspace = await prisma.workspace.create({
      data: { userId: req.user!.userId, name, description, icon, color, profession },
    });
    res.status(201).json({ success: true, data: workspace });
  } catch (e) { next(e); }
});

workspaceRouter.patch('/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 50 }),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const ws = await prisma.workspace.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!ws) throw new AppError('工作区不存在', 404);
    const { name, description, icon, color } = req.body;
    const updated = await prisma.workspace.update({
      where: { id: ws.id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(icon && { icon }), ...(color && { color }) },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

workspaceRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const ws = await prisma.workspace.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!ws) throw new AppError('工作区不存在', 404);
    if (ws.isDefault) throw new AppError('不能删除默认工作区', 400);
    await prisma.workspace.delete({ where: { id: ws.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});
