# Plan Mode Rules (Non-Obvious Only)

## Architectural Constraints

### Module System Split
- Backend uses CommonJS, frontend uses ESNext modules
- This affects how imports/exports work across the monorepo
- Shared library accessible differently in each workspace

### Secrets Architecture
- Secrets stored in system keychain via `node-keytar`, never in database
- Double encryption layer (keytar + custom AES-256-GCM)
- Database only stores references: `{ keychainId, description }`
- Must plan for separate keychain storage calls after config creation

### Version Control Pattern
- Config versions created automatically on updates (middleware-level)
- Not explicit in service layer - happens transparently
- Rollback requires specific version number, not just "undo"

### Workspace Dependencies
- Shared library import paths differ by workspace:
  - Backend: `@mcp-wizard/shared`
  - Frontend: `../shared/src/*` (relative paths only)
- Path alias `@/` works in both for their own `src/`

### Testing Infrastructure
- Backend: Jest with `.js` setup file (despite TypeScript)
- Frontend: Vitest with `.ts` setup file
- Different test runners require different approaches

### Development Environment
- Frontend dev server auto-proxies `/api/*` to backend
- No CORS configuration needed in development
- Production requires explicit CORS setup

### Database Workflow
- Prisma commands must run from `backend/` directory
- Schema changes require `npx prisma generate` (not just migrations)
- Seed script uses `tsx` directly, not Prisma CLI