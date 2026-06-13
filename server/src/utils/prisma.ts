import { PrismaClient } from '@prisma/client';
import { config } from '../config';

export const prisma = new PrismaClient({
  log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
