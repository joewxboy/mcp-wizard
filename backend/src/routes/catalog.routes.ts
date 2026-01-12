import express from 'express';
import { prisma } from '../db/database';
import { logger } from '../utils/logger';

const router = express.Router();

// Get all MCP servers
router.get('/servers', async (req, res) => {
  try {
    const { limit = '50', offset = '0', search } = req.query;

    const where = search
      ? {
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } },
            { tags: { has: search as string } },
          ],
        }
      : {};

    const servers = await prisma.mCPServer.findMany({
      where,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { popularity: 'desc' },
    });

    const total = await prisma.mCPServer.count({ where });

    res.json({
      servers,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    logger.error('Error getting MCP servers:', error);
    res.status(500).json({
      error: 'Failed to retrieve MCP servers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get specific MCP server
router.get('/servers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const server = await prisma.mCPServer.findUnique({
      where: { id },
    });

    if (!server) {
      return res.status(404).json({
        error: 'MCP server not found',
      });
    }

    res.json({ server });
  } catch (error) {
    logger.error('Error getting MCP server:', error);
    res.status(500).json({
      error: 'Failed to retrieve MCP server',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/servers', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.put('/servers/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.delete('/servers/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

export default router;