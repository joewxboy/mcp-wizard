// Test setup file
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock external dependencies
jest.mock('../src/db/database', () => ({
  prisma: {
    userConfig: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    mCPServer: {
      findUnique: jest.fn(),
    },
    configVersion: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/services/KeychainService', () => ({
  keychainService: {
    storeSecret: jest.fn(),
    getSecret: jest.fn(),
    updateSecret: jest.fn(),
    deleteConfigSecrets: jest.fn(),
  },
}));

jest.mock('../src/services/VersionService', () => ({
  versionService: {
    createVersionSnapshot: jest.fn(),
  },
}));

// Global test utilities
global.testUtils = {
  mockUser: {
    id: 'test-user-123',
    email: 'test@example.com',
    username: 'testuser',
  },
  mockServer: {
    id: 'test-server-456',
    name: 'Test MCP Server',
    description: 'A test MCP server',
    source: 'github',
    sourceUrl: 'https://github.com/test/server',
    version: '1.0.0',
    author: 'Test Author',
    license: 'MIT',
    tags: ['test'],
  },
};