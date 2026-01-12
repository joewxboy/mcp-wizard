import express from 'express';
import { researchLimiter } from '../middleware/rateLimit.middleware';
import { createResearchService } from '../services/research/ResearchService';
import { logger } from '../utils/logger';
import { prisma } from '../db/database';

// Create research service instance
const researchService = createResearchService();

const router = express.Router();

// Discover MCP servers
router.post('/discover', researchLimiter, express.json(), async (req, res) => {
  try {
    const { query, limit = 30 } = req.body as { query?: string; limit?: number };

    const options = {
      query: query || 'MCP server',
      maxResults: Math.min(limit || 30, 100), // Max 100 results
      minStars: 5, // Require at least 5 stars
    };

    // Start asynchronous research job
    const jobId = await researchService.startResearchJob(options);

    res.json({
      jobId,
      message: 'Research job started. Use the job ID to check status.',
      status: 'accepted',
    });
  } catch (error) {
    logger.error('Error starting research job:', error);
    res.status(500).json({
      error: 'Failed to start research job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Analyze specific repository
router.post('/analyze', researchLimiter, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Repository URL is required',
      });
    }

    // Analyze the repository directly (not as a search job)
    const result = await researchService.analyzeRepository(url);

    if (!result) {
      return res.status(404).json({
        error: 'Repository not found or not analyzable',
        message:
          'The repository could not be analyzed. It may not exist, may not be a valid MCP server, or may be inaccessible.',
      });
    }

    // Save the analyzed server to database
    try {
      await prisma.mCPServer.upsert({
        where: { id: result.id },
        update: {
          name: result.name,
          description: result.description,
          version: result.version,
          author: result.author,
          license: result.license,
          tags: result.tags,
          readme: result.readme,
          tools: JSON.parse(JSON.stringify(result.tools)),
          resources: JSON.parse(JSON.stringify(result.resources)),
          prompts: JSON.parse(JSON.stringify(result.prompts)),
          configTemplate: JSON.parse(JSON.stringify(result.configTemplate)),
          requiredParams: JSON.parse(JSON.stringify(result.requiredParams)),
          optionalParams: JSON.parse(JSON.stringify(result.optionalParams)),
          popularity: result.popularity,
          lastResearchedAt: new Date(),
        },
        create: {
          id: result.id,
          name: result.name,
          description: result.description,
          source: result.source,
          sourceUrl: result.sourceUrl,
          packageName: result.packageName,
          version: result.version,
          author: result.author,
          license: result.license,
          tags: result.tags,
          readme: result.readme,
          tools: JSON.parse(JSON.stringify(result.tools)),
          resources: JSON.parse(JSON.stringify(result.resources)),
          prompts: JSON.parse(JSON.stringify(result.prompts)),
          configTemplate: JSON.parse(JSON.stringify(result.configTemplate)),
          requiredParams: JSON.parse(JSON.stringify(result.requiredParams)),
          optionalParams: JSON.parse(JSON.stringify(result.optionalParams)),
          popularity: result.popularity,
          verified: result.verified,
          lastResearchedAt: new Date(),
        },
      });
      logger.info(`Saved analyzed server to database: ${result.id}`);
    } catch (saveError) {
      logger.error('Error saving analyzed server to database:', saveError);
      // Don't fail the request if saving fails, just log it
    }

    res.json({
      server: result,
      analyzed: true,
    });
  } catch (error) {
    logger.error('Error analyzing repository:', error);
    res.status(500).json({
      error: 'Failed to analyze repository',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Check research job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = researchService.getResearchJobStatus(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Research job ${jobId} not found or expired`,
      });
    }

    // If job is completed, return results
    if (job.status === 'completed') {
      return res.json({
        jobId: job.id,
        status: job.status,
        query: job.query,
        results: job.results,
        completedAt: job.completedAt,
        resultCount: job.results.length,
      });
    }

    // If job failed, return error
    if (job.status === 'failed') {
      return res.status(500).json({
        jobId: job.id,
        status: job.status,
        query: job.query,
        error: job.error,
        completedAt: job.completedAt,
      });
    }

    // Job is still running or pending
    res.json({
      jobId: job.id,
      status: job.status,
      query: job.query,
      startedAt: job.startedAt,
    });
  } catch (error) {
    logger.error('Error checking job status:', error);
    res.status(500).json({
      error: 'Failed to check job status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get API status (GitHub and npm)
router.get('/status', (req, res) => {
  try {
    const apiStatus = researchService.getAPIStatus();

    res.json({
      apis: apiStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting API status:', error);
    res.status(500).json({
      error: 'Failed to get API status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get GitHub API rate limit status (legacy endpoint)
router.get('/rate-limit', (req, res) => {
  try {
    const rateLimit = researchService.getGitHubRateLimitStatus();

    res.json({
      rateLimit,
      isAvailable: researchService.isGitHubAPIAvailable(),
    });
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    res.status(500).json({
      error: 'Failed to get rate limit status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
