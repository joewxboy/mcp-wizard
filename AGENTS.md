# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-Obvious Project Patterns

### Module Systems (Critical)
- **Backend**: Uses CommonJS (`module: "CommonJS"`) despite TypeScript - affects imports/exports
- **Frontend**: Uses ESNext modules (`module: "ESNext"`) - different from backend
- **Shared library**: Import as `@mcp-wizard/shared` in backend only; frontend must use relative paths from `../shared/src/*`

### Secrets Architecture
- Secrets are **never stored in database** - always in system keychain via `node-keytar`
- Double encryption: keytar storage + custom AES-256-GCM layer in [`KeychainService`](backend/src/services/KeychainService.ts)
- Secret references stored in DB as `{ keychainId, description }` objects, not actual values
- Must call [`keychainService.storeSecret()`](backend/src/services/KeychainService.ts) separately after creating configs

### Version Control Pattern
- Config versions created **automatically** on every update via [`VersionService`](backend/src/services/VersionService.ts)
- Not explicit - happens in middleware, not in service methods
- Rollback requires calling [`versionService.rollbackConfig()`](backend/src/services/VersionService.ts) with specific version number

### Test Setup Quirk
- Backend: Uses `.js` setup file ([`tests/setup.js`](backend/tests/setup.js)) despite TypeScript project
- Frontend: Uses `.ts` setup file ([`src/test/setup.ts`](frontend/src/test/setup.ts))
- Reason: Jest vs Vitest configuration differences

### Development Proxy
- Frontend dev server auto-proxies `/api/*` to `http://localhost:3001` (backend)
- Configured in [`vite.config.ts`](frontend/vite.config.ts:17-22) - no need for CORS in dev
- Production requires explicit CORS configuration

### Path Aliases
- `@/` works in both frontend and backend for `src/`
- `@mcp-wizard/shared` only resolves in backend (tsconfig paths)
- Frontend must use relative imports for shared: `import { X } from '../shared/src/types'`

### Prisma Workflow
- Must run `npx prisma generate` after **any** schema change (not just migrations)
- Migrations must be run from `backend/` directory, not root
- Seed script uses `tsx` directly: `npm run prisma:seed` (not via Prisma CLI)

## Single Test Execution

Backend (Jest):
```bash
npm test -- tests/unit/ServiceName.test.ts
npm test -- --testNamePattern="should create config"
```

Frontend (Vitest):
```bash
npm test -- src/components/ComponentName.test.tsx
npm test -- --reporter=verbose
