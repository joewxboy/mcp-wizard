# AGENTS.md - MCP Wizard Development Guide

This guide is for AI coding agents working in the MCP Wizard repository. Follow these guidelines for consistency and quality.

## Project Overview

MCP Wizard is a web application for discovering, configuring, and managing Model Context Protocol (MCP) servers. It consists of:
- **Backend**: Node.js 18+ with TypeScript, Express.js, PostgreSQL, Redis, Prisma ORM
- **Frontend**: React 18+ with TypeScript, Redux Toolkit, Tailwind CSS, Vite

## Build, Lint & Test Commands

### Backend (from `backend/` directory)
```bash
# Development
npm run dev                    # Start dev server with hot reload (port 3001)
npm run build                  # Compile TypeScript to dist/
npm start                      # Run production build

# Testing
npm test                       # Run all tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage report
npm test -- path/to/test.spec.ts  # Run single test file

# Linting & Formatting
npm run lint                   # Check for lint issues
npm run lint:fix              # Auto-fix lint issues
npm run format                # Format with Prettier

# Database
npx prisma migrate dev        # Run migrations
npx prisma generate          # Generate Prisma client
npx prisma studio            # Open database GUI
npm run seed                 # Seed database with sample data
```

### Frontend (from `frontend/` directory)
```bash
# Development
npm run dev                    # Start Vite dev server (port 5173)
npm run build                  # Build for production
npm run preview               # Preview production build

# Testing
npm test                       # Run all tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage report
npm test -- ComponentName     # Run tests matching pattern

# Linting & Formatting
npm run lint                   # Check for lint issues
npm run lint:fix              # Auto-fix lint issues
npm run format                # Format with Prettier
```

### Docker (from root directory)
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # View logs
docker-compose build --no-cache  # Rebuild containers
```

## Code Style Guidelines

### General Principles
- **TypeScript strict mode**: All code must pass strict type checking
- **Functional programming**: Prefer pure functions, avoid mutations where possible
- **DRY principle**: Extract reusable logic into utilities/services
- **Single responsibility**: Each function/class should do one thing well

### Imports

Import order (enforced by ESLint):
```typescript
// 1. External dependencies (alphabetical)
import express from 'express';
import { z } from 'zod';

// 2. Internal modules (alphabetical by path depth)
import { ConfigService } from '@/services/config';
import { validateRequest } from '@/middleware/validation';

// 3. Type imports (separate)
import type { Request, Response } from 'express';
import type { UserConfig } from '@/types';

// 4. Relative imports
import { helper } from './utils';
```

Use path aliases:
- `@/` for `src/` in both frontend and backend
- No relative imports beyond one level (`../` is max)

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Line length**: 100 characters max
- **Quotes**: Single quotes for strings, double quotes for JSX attributes
- **Semicolons**: Required at end of statements
- **Trailing commas**: Always in multi-line arrays/objects
- **Arrow functions**: Use `() =>` not `function` for anonymous functions

Example:
```typescript
const fetchServers = async (query: string): Promise<MCPServer[]> => {
  const results = await catalogService.search({
    query,
    limit: 10,
    tags: ['verified'],
  });
  
  return results.map((server) => ({
    ...server,
    displayName: formatServerName(server.name),
  }));
};
```

### TypeScript Types

- Use `interface` for object shapes, `type` for unions/intersections
- Avoid `any` - use `unknown` and type guards instead
- Prefer explicit return types for functions
- Use branded types for IDs: `type UserId = string & { __brand: 'UserId' }`

```typescript
// Good
interface ServerConfig {
  id: string;
  name: string;
  enabled: boolean;
}

type ConfigStatus = 'pending' | 'active' | 'failed';

function validateConfig(config: unknown): config is ServerConfig {
  // Type guard implementation
}

// Bad
const data: any = fetchData();
function process(x) { return x; }
```

### Naming Conventions

- **Files**: kebab-case (`config-service.ts`, `server-card.tsx`)
- **Classes**: PascalCase (`ConfigService`, `ServerRepository`)
- **Functions/Variables**: camelCase (`getUserConfig`, `isEnabled`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`UserConfig`, `MCPServer`)
- **React Components**: PascalCase (`ServerCard`, `ConfigWizard`)
- **React Hooks**: camelCase with `use` prefix (`useServerConfig`, `useFetch`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (`isEnabled`, `hasError`)

### Error Handling

Use custom error classes:
```typescript
// Define custom errors
class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

// In services
async function createConfig(data: UserConfig): Promise<UserConfig> {
  try {
    const validated = configSchema.parse(data);
    return await repository.save(validated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid config', error.errors);
    }
    throw error;
  }
}

// In API routes
app.post('/api/configs', async (req, res, next) => {
  try {
    const config = await configService.create(req.body);
    res.json({ config });
  } catch (error) {
    next(error); // Pass to error middleware
  }
});
```

Never swallow errors silently. Always log or propagate them.

### Async/Await

- Prefer `async/await` over promise chains
- Always handle errors with try/catch in route handlers
- Use `Promise.all()` for parallel operations
- Never use `.then()` and `async/await` mixed

```typescript
// Good
async function fetchMultipleServers(ids: string[]): Promise<MCPServer[]> {
  const promises = ids.map((id) => catalogService.getById(id));
  return await Promise.all(promises);
}

// Bad
async function badExample(id: string) {
  return catalogService.getById(id).then(server => server.name); // Don't mix
}
```

### React Components

- Functional components only (no class components)
- Use TypeScript for props
- Keep components small (<200 lines)
- Extract complex logic to custom hooks
- Use React.FC sparingly, prefer explicit types

```typescript
interface ServerCardProps {
  server: MCPServer;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export const ServerCard = ({ server, onSelect, isSelected = false }: ServerCardProps) => {
  const handleClick = () => onSelect(server.id);
  
  return (
    <div className="border rounded-lg p-4" onClick={handleClick}>
      <h3 className="text-lg font-bold">{server.name}</h3>
      <p className="text-gray-600">{server.description}</p>
    </div>
  );
};
```

### State Management (Redux Toolkit)

- Use slices for domain-specific state
- Use `createAsyncThunk` for async operations
- Colocate selectors with slices
- Use TypeScript for state shape

```typescript
const configSlice = createSlice({
  name: 'configs',
  initialState: {
    items: [] as UserConfig[],
    loading: false,
    error: null as string | null,
  },
  reducers: {
    setConfigs: (state, action: PayloadAction<UserConfig[]>) => {
      state.items = action.payload;
    },
  },
});
```

## Testing Guidelines

- Write tests for all services and utilities
- Test components with React Testing Library
- Mock external dependencies (APIs, database)
- Aim for 80%+ coverage overall, 95%+ for critical paths
- Use descriptive test names: `it('should create config when valid data provided')`

```typescript
describe('ConfigService', () => {
  let service: ConfigService;
  let mockRepository: jest.Mocked<ConfigRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new ConfigService(mockRepository);
  });

  it('should create config when valid data provided', async () => {
    const input = createValidConfig();
    mockRepository.save.mockResolvedValue(input);

    const result = await service.create(input);

    expect(result).toEqual(input);
    expect(mockRepository.save).toHaveBeenCalledWith(input);
  });
});
```

## Database & Prisma

- Define all models in `prisma/schema.prisma`
- Run `npx prisma generate` after schema changes
- Create migrations with descriptive names: `npx prisma migrate dev --name add_config_versions`
- Use transactions for multi-step operations
- Always include `createdAt` and `updatedAt` timestamps

## API Design

- RESTful conventions: GET, POST, PUT, DELETE
- Use proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Return consistent response format: `{ data, error?, meta? }`
- Validate request bodies with Zod schemas
- Use middleware for auth, validation, error handling

## Security

- Never commit secrets or API keys
- Store sensitive data in system keychain (via `node-keytar`)
- Validate and sanitize all user inputs
- Use JWT with refresh tokens for authentication
- Implement rate limiting on API endpoints
- Use HTTPS in production

## Performance

- Cache catalog searches in Redis (1 hour TTL)
- Use database indexes on frequently queried fields
- Implement pagination for large lists (default: 20 items)
- Lazy load React components with `React.lazy()`
- Debounce search inputs (300ms delay)

## Git Workflow

- Feature branches: `feature/description-of-feature`
- Bug fixes: `fix/description-of-bug`
- Commit messages: `feat: add config validation` or `fix: resolve keychain error`
- Keep commits atomic (one logical change per commit)
- Write descriptive commit messages (imperative mood)

## Documentation

- Add JSDoc comments for public APIs
- Update README.md when adding features
- Document complex algorithms inline
- Keep this AGENTS.md up to date

---

**Last Updated**: 2026-01-06  
**Version**: 1.0
