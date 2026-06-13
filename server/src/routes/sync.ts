import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const syncRouter = Router();
syncRouter.use(requireAuth);

// Batch sync: client pushes local changes, server returns conflicts
syncRouter.post('/push', [
  body('documents').isArray(),
  body('documents.*.id').isUUID(),
], validate, async (req: AuthRequest, res, next) => {
  try {
    const { documents } = req.body as {
      documents: Array<{
        id: string; workspaceId: string; title: string; content: string;
        tags: string[]; syncVersion: number; updatedAt: string;
      }>;
    };

    const results: { id: string; status: 'synced' | 'conflict'; serverVersion?: number }[] = [];

    for (const doc of documents) {
      const server = await prisma.document.findFirst({
        where: { id: doc.id, userId: req.user!.userId },
        select: { syncVersion: true, updatedAt: true },
      });

      if (!server) {
        // New doc from client
        await prisma.document.upsert({
          where: { id: doc.id },
          create: {
            id: doc.id, userId: req.user!.userId,
            workspaceId: doc.workspaceId, title: doc.title,
            content: doc.content, tags: doc.tags, syncVersion: doc.syncVersion,
          },
          update: {},
        });
        results.push({ id: doc.id, status: 'synced' });
      } else if (doc.syncVersion >= server.syncVersion) {
        // Client is newer or same version — accept
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            title: doc.title, content: doc.content,
            tags: doc.tags, syncVersion: doc.syncVersion,
          },
        });
        results.push({ id: doc.id, status: 'synced' });
      } else {
        // Server is newer — conflict
        results.push({ id: doc.id, status: 'conflict', serverVersion: server.syncVersion });
      }
    }

    res.json({ success: true, data: { results } });
  } catch (e) { next(e); }
});

// Pull: client fetches changes since last sync
syncRouter.get('/pull', async (req: AuthRequest, res, next) => {
  try {
    const { since, workspaceId } = req.query as { since?: string; workspaceId?: string };
    const sinceDate = since ? new Date(since) : new Date(0);

    const docs = await prisma.document.findMany({
      where: {
        userId: req.user!.userId,
        ...(workspaceId && { workspaceId }),
        updatedAt: { gt: sinceDate },
      },
      orderBy: { updatedAt: 'asc' },
      take: 500,
    });

    res.json({
      success: true,
      data: { documents: docs, serverTime: new Date().toISOString() },
    });
  } catch (e) { next(e); }
});
