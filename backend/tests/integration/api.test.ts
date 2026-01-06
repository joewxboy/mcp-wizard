import request from 'supertest';
import { app, server } from '../../src/app';
import { prisma } from '../../src/db/database';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect();
  });

  afterAll(async () => {
    // Close server and database connection
    server.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.configVersion.deleteMany();
    await prisma.userConfig.deleteMany();
    await prisma.user.deleteMany();
    await prisma.mCPServer.deleteMany();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });

  describe('Research API', () => {
    describe('GET /api/research/status', () => {
      it('should return API status information', async () => {
        const response = await request(app)
          .get('/api/research/status')
          .expect(200);

        expect(response.body).toHaveProperty('apis');
        expect(response.body.apis).toHaveProperty('github');
        expect(response.body.apis).toHaveProperty('npm');
        expect(response.body).toHaveProperty('timestamp');
      });
    });

    describe('POST /api/research/discover', () => {
      it('should start discovery job with valid parameters', async () => {
        const response = await request(app)
          .post('/api/research/discover')
          .send({ query: 'test', limit: 5 })
          .expect(200);

        expect(response.body).toHaveProperty('jobId');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toMatchObject({
          status: 'accepted',
          message: expect.stringContaining('Research job started'),
        });
      });

      it('should accept empty query', async () => {
        const response = await request(app)
          .post('/api/research/discover')
          .send({})
          .expect(200);

        expect(response.body).toHaveProperty('jobId');
      });
    });

    describe('GET /api/research/status/:jobId', () => {
      it('should return 404 for non-existent job', async () => {
        const response = await request(app)
          .get('/api/research/status/non-existent-job')
          .expect(404);

        expect(response.body).toMatchObject({
          error: 'Job not found',
        });
      });

      it('should return job status for valid job', async () => {
        // First create a job
        const createResponse = await request(app)
          .post('/api/research/discover')
          .send({ query: 'test', limit: 1 });

        const jobId = createResponse.body.jobId;

        // Then check its status
        const statusResponse = await request(app)
          .get(`/api/research/status/${jobId}`)
          .expect(200);

        expect(statusResponse.body).toHaveProperty('jobId', jobId);
        expect(statusResponse.body).toHaveProperty('status');
        expect(statusResponse.body).toHaveProperty('query');
      });
    });
  });

  describe('Catalog API', () => {
    beforeEach(async () => {
      // Create test server
      await prisma.mCPServer.create({
        data: {
          id: 'test-server-1',
          name: 'Test MCP Server',
          description: 'A test server for integration tests',
          source: 'github',
          sourceUrl: 'https://github.com/test/server',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT',
          tags: ['test', 'integration'],
          readme: '# Test Server\n\nThis is a test MCP server.',
          tools: [],
          resources: [],
          prompts: [],
          configTemplate: { command: 'node', args: ['server.js'] },
          requiredParams: [],
          optionalParams: [],
        },
      });
    });

    describe('GET /api/catalog/servers', () => {
      it('should return list of MCP servers', async () => {
        const response = await request(app)
          .get('/api/catalog/servers')
          .expect(200);

        expect(response.body).toHaveProperty('servers');
        expect(response.body).toHaveProperty('total');
        expect(response.body.total).toBeGreaterThan(0);
        expect(Array.isArray(response.body.servers)).toBe(true);
      });

      it('should support search parameter', async () => {
        const response = await request(app)
          .get('/api/catalog/servers?search=test')
          .expect(200);

        expect(response.body.total).toBeGreaterThan(0);
        expect(response.body.servers.some((s: any) => s.name.includes('Test'))).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/catalog/servers?limit=1&offset=0')
          .expect(200);

        expect(response.body.servers).toHaveLength(1);
        expect(response.body.limit).toBe(1);
        expect(response.body.offset).toBe(0);
      });
    });

    describe('GET /api/catalog/servers/:id', () => {
      it('should return specific server', async () => {
        const response = await request(app)
          .get('/api/catalog/servers/test-server-1')
          .expect(200);

        expect(response.body.server).toMatchObject({
          id: 'test-server-1',
          name: 'Test MCP Server',
          source: 'github',
        });
      });

      it('should return 404 for non-existent server', async () => {
        const response = await request(app)
          .get('/api/catalog/servers/non-existent')
          .expect(404);

        expect(response.body).toMatchObject({
          error: 'MCP server not found',
        });
      });
    });
  });

  describe('Configuration API', () => {
    let testUserId: string;
    let testServerId: string;

    beforeEach(async () => {
      // Create test user and server
      const user = await prisma.user.create({
        data: {
          id: 'test-user-integration',
          email: 'integration@test.com',
          username: 'integrationtest',
          password: 'hashed-password',
        },
      });
      testUserId = user.id;

      const server = await prisma.mCPServer.create({
        data: {
          id: 'integration-test-server',
          name: 'Integration Test Server',
          description: 'Server for integration tests',
          source: 'github',
          sourceUrl: 'https://github.com/test/integration',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT',
          tags: ['test'],
          readme: '# Integration Test Server',
          tools: [],
          resources: [],
          prompts: [],
          configTemplate: { command: 'node', args: ['server.js'] },
          requiredParams: [],
          optionalParams: [],
        },
      });
      testServerId = server.id;
    });

    // Note: Configuration endpoints require authentication which isn't set up in these integration tests
    // In a real scenario, we'd mock authentication or use a test authentication system

    describe('Authentication Required Endpoints', () => {
      it('should require authentication for config endpoints', async () => {
        const response = await request(app)
          .get('/api/configs')
          .expect(401);

        // Should return authentication error (exact format depends on auth middleware)
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to research endpoints', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(15).fill().map(() =>
        request(app).post('/api/research/discover').send({})
      );

      const responses = await Promise.all(promises);

      // At least some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('not found'),
      });
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/research/discover')
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});