# Advance Mode Rules (Non-Obvious Only)

## Critical Patterns

### Shared Library Imports
- Backend: Use `@mcp-wizard/shared` for shared types
- Frontend: Must use relative paths `../shared/src/*` (alias doesn't work)
- Never mix - will cause import errors

### Secrets Handling
- Always call [`keychainService.storeSecret()`](../../backend/src/services/KeychainService.ts) after creating configs
- Secrets stored in system keychain, not database
- DB only stores `{ keychainId, description }` references
- Double encryption: keytar + AES-256-GCM

### Version Snapshots
- Config versions created automatically on updates (not explicit)
- Happens in middleware, not service methods
- Don't manually create versions - they're auto-generated

### Module System Mismatch
- Backend: CommonJS (`require`/`module.exports` style)
- Frontend: ESNext (`import`/`export` style)
- Affects how you write imports/exports in each workspace

### Test Files
- Backend: Setup in `.js` file despite TypeScript ([`tests/setup.js`](../../backend/tests/setup.js))
- Frontend: Setup in `.ts` file ([`src/test/setup.ts`](../../frontend/src/test/setup.ts))
- Don't try to "fix" this - it's intentional for Jest vs Vitest

### Prisma Commands
- Always run from `backend/` directory, not root
- Must run `npx prisma generate` after schema changes (not just migrations)
- Seed uses `tsx` directly: `npm run prisma:seed`

### Development Proxy
- Frontend auto-proxies `/api/*` to backend in dev mode
- Configured in [`vite.config.ts`](../../frontend/vite.config.ts:17-22)
- No CORS needed in development