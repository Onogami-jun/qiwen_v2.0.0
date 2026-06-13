import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';

export const documentRouter = Router();
documentRouter.use(requireAuth);

documentRouter.get('/', [
  query('workspaceId').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('search').optional().trim(),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { workspaceId, page = '1', search } = req.query as any;
    const pageNum = parseInt(page);
    const pageSize = 50;

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: req.user!.userId },
    });
    if (!workspace) throw new AppError('工作区不存在', 404);

    const where: any = { workspaceId, userId: req.user!.userId, isArchived: false };
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];

    const [docs, total] = await prisma.$transaction([
      prisma.document.findMany({
        where, orderBy: { updatedAt: 'desc' },
        take: pageSize, skip: (pageNum - 1) * pageSize,
        select: { id: true, title: true, wordCount: true, charCount: true, tags: true, isFavorite: true, isArchived: true, createdAt: true, updatedAt: true, syncVersion: true },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({ success: true, data: { items: docs, total, page: pageNum, pageSize } });
  } catch (e) { next(e); }
});

documentRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!doc) throw new AppError('文档不存在', 404);
    res.json({ success: true, data: doc });
  } catch (e) { next(e); }
});

documentRouter.post('/', [
  body('workspaceId').isUUID(),
  body('title').optional().trim().isLength({ max: 200 }),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { workspaceId, title = '无标题', content = '', tags = [], contentType = 'markdown' } = req.body;
    const ws = await prisma.workspace.findFirst({ where: { id: workspaceId, userId: req.user!.userId } });
    if (!ws) throw new AppError('工作区不存在', 404);

    const doc = await prisma.document.create({
      data: { userId: req.user!.userId, workspaceId, title, content, contentType, tags },
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e) { next(e); }
});

documentRouter.patch('/:id', [
  body('title').optional().trim().isLength({ max: 200 }),
  body('content').optional(),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!doc) throw new AppError('文档不存在', 404);

    const { title, content, tags, isFavorite, isArchived } = req.body;
    let wordCount = doc.wordCount;
    let charCount = doc.charCount;
    if (content !== undefined) {
      const cn = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
      const en = (content.match(/\b[a-zA-Z]+\b/g) || []).length;
      wordCount = cn + en;
      charCount = content.length;
    }

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content, wordCount, charCount }),
        ...(tags !== undefined && { tags }),
        ...(isFavorite !== undefined && { isFavorite }),
        ...(isArchived !== undefined && { isArchived }),
        syncVersion: { increment: 1 },
      },
      select: { id: true, title: true, updatedAt: true, syncVersion: true },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

documentRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!doc) throw new AppError('文档不存在', 404);
    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});
