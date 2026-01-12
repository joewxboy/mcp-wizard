# Ask Mode Rules (Non-Obvious Only)

## Project Context

### Architecture Quirks
- Monorepo with different module systems per workspace (CommonJS backend, ESNext frontend)
- Shared library has different import paths depending on workspace
- Secrets never stored in database - always in system keychain

### Directory Structure Surprises
- `backend/tests/setup.js` is JavaScript despite TypeScript project (Jest requirement)
- `frontend/src/test/setup.ts` is TypeScript (Vitest supports it)
- Prisma commands must run from `backend/` directory, not root

### Hidden Behaviors
- Config versions created automatically on updates (not explicit in service methods)
- Frontend dev server proxies `/api/*` to backend automatically
- Keychain uses double encryption (keytar + custom AES-256-GCM layer)

### Import Patterns
- Backend can use `@mcp-wizard/shared` alias
- Frontend must use relative paths `../shared/src/*` for shared code
- Both workspaces use `@/` for their own `src/` directory

### Testing Setup
- Backend: Jest with ts-jest, setup in `.js` file
- Frontend: Vitest with jsdom, setup in `.ts` file
- Single test execution differs between workspaces (see main AGENTS.md)