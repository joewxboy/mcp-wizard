# MCP Wizard - Development Environment Setup

This guide will walk you through setting up your local development environment for the MCP Wizard project.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`
   - Should output: `v18.x.x` or higher

2. **npm** (v9 or higher) or **pnpm** (v8 or higher)
   - npm comes with Node.js
   - For pnpm: `npm install -g pnpm`
   - Verify: `npm --version` or `pnpm --version`

3. **PostgreSQL** (v14 or higher)
   - **macOS**: `brew install postgresql@14`
   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **Linux**: `sudo apt-get install postgresql-14`
   - Verify: `psql --version`

4. **Redis** (v7 or higher)
   - **macOS**: `brew install redis`
   - **Windows**: Use [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL
   - **Linux**: `sudo apt-get install redis-server`
   - Verify: `redis-cli --version`

5. **Docker & Docker Compose** (optional but recommended)
   - Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Verify: `docker --version` and `docker-compose --version`

6. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify: `git --version`

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Prisma
  - Docker
  - GitLens

- **Postman** or **Insomnia** for API testing

## Quick Start with Docker (Recommended)

The fastest way to get started is using Docker Compose, which sets up all services automatically.

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/mcp-wizard.git
cd mcp-wizard
```

### Step 2: Create Environment Files

```bash
# Copy example environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 3: Configure Environment Variables

Edit `backend/.env`:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_wizard"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this"

# GitHub API (optional for development)
GITHUB_TOKEN="your-github-personal-access-token"

# Server
PORT=3001
NODE_ENV=development
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

### Step 4: Start Services with Docker

```bash
# Start all services (PostgreSQL, Redis, Backend, Frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Step 5: Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Manual Setup (Without Docker)

If you prefer to run services manually or Docker isn't available:

### Step 1: Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/your-org/mcp-wizard.git
cd mcp-wizard

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### Step 2: Start PostgreSQL

```bash
# macOS/Linux
brew services start postgresql@14
# or
sudo systemctl start postgresql

# Create database
createdb mcp_wizard

# Or using psql
psql postgres
CREATE DATABASE mcp_wizard;
\q
```

### Step 3: Start Redis

```bash
# macOS/Linux
brew services start redis
# or
sudo systemctl start redis

# Verify Redis is running
redis-cli ping
# Should output: PONG
```

### Step 4: Set Up Database Schema

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed database with sample data
npm run seed
```

### Step 5: Start Backend Server

```bash
# From backend directory
npm run dev

# Backend should start on http://localhost:3001
```

### Step 6: Start Frontend Development Server

```bash
# Open new terminal
cd frontend

# Start Vite dev server
npm run dev

# Frontend should start on http://localhost:5173
```

## Project Structure Setup

Once you have the environment running, you'll need to create the initial project structure:

### Backend Structure

```bash
cd backend
mkdir -p src/{controllers,services,models,routes,middleware,utils,config,types,db}
mkdir -p src/services/{research,config,catalog,version,keychain,auth}
mkdir -p src/services/research
mkdir -p src/services/config/converters
mkdir -p src/db/{migrations,seeds}
mkdir -p tests/{unit,integration,e2e}
```

### Frontend Structure

```bash
cd frontend
mkdir -p src/{components,pages,store,services,hooks,types,utils,styles}
mkdir -p src/components/{common,layout,catalog,wizard,config}
mkdir -p src/store/{slices,middleware}
```

## Development Workflow

### Running Tests

```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage

# Frontend tests
cd frontend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
```

### Linting and Formatting

```bash
# Backend
cd backend
npm run lint               # Check for issues
npm run lint:fix           # Auto-fix issues
npm run format             # Format with Prettier

# Frontend
cd frontend
npm run lint
npm run lint:fix
npm run format
```

### Database Management

```bash
cd backend

# Create a new migration
npx prisma migrate dev --name description_of_changes

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate
```

### Building for Production

```bash
# Backend
cd backend
npm run build              # Compile TypeScript
npm start                  # Run production build

# Frontend
cd frontend
npm run build              # Build for production
npm run preview            # Preview production build
```

## Troubleshooting

### PostgreSQL Connection Issues

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
```bash
# Check if PostgreSQL is running
pg_isready

# Check PostgreSQL status
brew services list | grep postgresql
# or
sudo systemctl status postgresql

# Restart PostgreSQL
brew services restart postgresql@14
# or
sudo systemctl restart postgresql

# Check connection with psql
psql -U postgres -d mcp_wizard
```

### Redis Connection Issues

**Problem**: Cannot connect to Redis

**Solutions**:
```bash
# Check if Redis is running
redis-cli ping

# Check Redis status
brew services list | grep redis
# or
sudo systemctl status redis

# Restart Redis
brew services restart redis
# or
sudo systemctl restart redis
```

### Port Already in Use

**Problem**: Port 3001 or 5173 already in use

**Solutions**:
```bash
# Find process using port
lsof -i :3001
# or
netstat -ano | findstr :3001

# Kill process
kill -9 <PID>

# Or change port in .env files
```

### Node Modules Issues

**Problem**: Module not found or dependency issues

**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force

# For pnpm
pnpm store prune
```

### Prisma Issues

**Problem**: Prisma client out of sync

**Solutions**:
```bash
# Regenerate Prisma client
npx prisma generate

# Reset and regenerate
npx prisma migrate reset
npx prisma generate
```

### Docker Issues

**Problem**: Docker containers not starting

**Solutions**:
```bash
# Check Docker status
docker ps

# View logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Remove volumes and restart
docker-compose down -v
docker-compose up -d
```

## Environment Variables Reference

### Backend Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis
REDIS_URL=redis://host:port

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# External APIs
GITHUB_TOKEN=ghp_your_token_here
NPM_REGISTRY_URL=https://registry.npmjs.org

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=debug

# File Storage
CONFIG_OUTPUT_DIR=./configs
BACKUP_DIR=./backups
```

### Frontend Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true

# External Services
VITE_SENTRY_DSN=your-sentry-dsn
```

## Getting GitHub Personal Access Token

For the research service to work properly, you'll need a GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: "MCP Wizard Development"
4. Select scopes:
   - `repo` (for private repos, optional)
   - `public_repo` (for public repos)
5. Click "Generate token"
6. Copy the token and add it to `backend/.env` as `GITHUB_TOKEN`

**Note**: Keep this token secure and never commit it to version control.

## Next Steps

Once your environment is set up:

1. **Verify Everything Works**
   ```bash
   # Check backend health
   curl http://localhost:3001/api/health
   
   # Check frontend loads
   open http://localhost:5173
   ```

2. **Review the Codebase**
   - Read through [`docs/architecture.md`](architecture.md)
   - Understand the data models in [`docs/technical-spec.md`](technical-spec.md)
   - Review API endpoints

3. **Start Development**
   - Pick a task from [`docs/implementation-plan.md`](implementation-plan.md)
   - Create a feature branch: `git checkout -b feature/your-feature`
   - Write tests first (TDD approach)
   - Implement the feature
   - Submit a pull request

4. **Join the Team**
   - Set up communication channels
   - Attend daily standups
   - Review the project board

## Useful Commands Cheat Sheet

```bash
# Start everything with Docker
docker-compose up -d

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev

# Run tests
npm test

# Database migrations
cd backend && npx prisma migrate dev

# View database
cd backend && npx prisma studio

# Lint and format
npm run lint:fix && npm run format

# Build for production
npm run build

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

## Getting Help

- **Documentation**: Check [`docs/README.md`](README.md) for all documentation
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Team Chat**: Join the project Slack/Discord channel

## Contributing

Before making changes:
1. Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) (to be created)
2. Follow the code style guide
3. Write tests for new features
4. Update documentation as needed
5. Submit pull requests for review

---

**Last Updated**: 2025-11-18  
**Maintained By**: Development Team