# MCP Wizard

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](package.json)

A comprehensive web application for discovering, configuring, and managing Model Context Protocol (MCP) servers. MCP Wizard simplifies the process of finding MCP-compatible tools and generating secure configurations for various AI platforms.

## ✨ Key Features

- 🔍 **Intelligent Discovery**: Automatically search and discover MCP servers from GitHub repositories and npm packages
- 🧙‍♂️ **Configuration Wizard**: Step-by-step wizard to generate secure MCP configurations
- 🔐 **Secure Credential Management**: Store sensitive API keys and tokens securely using system keychain
- 📋 **Multi-Format Export**: Export configurations for Claude Desktop, VS Code, and custom clients
- 📚 **Version History**: Track configuration changes with full rollback capabilities
- 🎯 **Quality Assurance**: Verify MCP server compatibility and configuration validity
- ⚡ **Performance Optimized**: Redis caching for fast discovery and search results

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (recommended)
- PostgreSQL and Redis (via Docker)

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd mcp-wizard

# Start all services
./scripts/start-dev.sh

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
# Database GUI: npx prisma studio --port 5555
```

### Manual Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run database migrations
cd backend && npx prisma migrate dev

# Start development servers
./scripts/start-dev.sh
```

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js 18 + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis for performance optimization
- **Security**: JWT authentication + node-keytar for credential storage

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Backend API   │    │   PostgreSQL    │
│   React + TS    │◄──►│ Express + TS    │◄──►│   Database      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discovery     │    │   GitHub API    │    │   Redis Cache    │
│   Service       │◄──►│   npm Registry  │◄──►│                 │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📡 API Documentation

### Research Endpoints

#### Discover MCP Servers

```bash
POST /api/research/discover
Content-Type: application/json

{
  "query": "MCP server",
  "limit": 50
}
```

Returns a job ID for asynchronous processing.

#### Check Job Status

```bash
GET /api/research/status/{jobId}
```

Returns the discovery results when complete.

#### Analyze Specific Repository

```bash
POST /api/research/analyze
Content-Type: application/json

{
  "url": "https://github.com/org/repo"
}
```

Returns detailed analysis of a specific MCP server.

#### API Status

```bash
GET /api/research/status
```

Returns availability status of GitHub and npm APIs.

### Configuration Endpoints

#### Get User Configurations

```bash
GET /api/configs
```

#### Create Configuration

```bash
POST /api/configs
```

#### Export Configuration

```bash
POST /api/configs/{id}/export
```

## 🛠️ Development

### Project Structure

```
mcp-wizard/
├── backend/              # Node.js/Express API server
│   ├── src/
│   │   ├── app.ts       # Express application setup
│   │   ├── server.ts    # Server entry point
│   │   ├── config/      # Configuration modules
│   │   ├── db/          # Database setup (Prisma)
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API route handlers
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utility functions
│   └── prisma/          # Database schema
├── frontend/             # React application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── store/       # Redux state management
│   │   ├── services/    # API client services
│   │   ├── hooks/       # Custom React hooks
│   │   └── types/       # TypeScript types
│   └── public/          # Static assets
├── shared/               # Shared types and utilities
├── docs/                 # Documentation
└── scripts/              # Development scripts
```

### Available Scripts

```bash
# Development
./scripts/start-dev.sh    # Start all services
./scripts/stop-dev.sh     # Stop all services

# Backend (from backend/ directory)
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run test             # Run tests

# Frontend (from frontend/ directory)
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Database
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Run migrations
```

### Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

**Backend (.env)**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_wizard"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
GITHUB_TOKEN="your-github-token"  # Optional, for higher rate limits
```

**Frontend (.env)**

```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run backend tests only
cd backend && npm run test

# Run frontend tests only
cd frontend && npm run test

# Run with coverage
npm run test:coverage
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run linting and tests: `npm run lint && npm run test`
5. Commit with conventional commits: `git commit -m "feat: add new feature"`
6. Push and create a Pull Request

### Code Style

This project uses:

- **ESLint** for JavaScript/TypeScript linting
- **Prettier** for code formatting
- **TypeScript** with strict mode enabled
- **Conventional Commits** for commit messages

## 📚 Documentation

- [Technical Specification](docs/technical-spec.md) - Project overview and requirements
- [Architecture Document](docs/architecture.md) - Detailed system design
- [Implementation Plan](docs/implementation-plan.md) - Development roadmap
- [Development Setup](docs/development-setup.md) - Environment setup guide
- [AGENTS.md](AGENTS.md) - AI coding agent development guide

## 🔒 Security

MCP Wizard takes security seriously:

- Sensitive data is stored in system keychain
- JWT tokens with configurable expiration
- Rate limiting on all API endpoints
- Input validation and sanitization
- HTTPS required in production

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- The MCP community for creating amazing servers and tools
- Open source contributors and maintainers

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/mcp-wizard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/mcp-wizard/discussions)
- **Documentation**: [Project Wiki](https://github.com/your-org/mcp-wizard/wiki)

---

**MCP Wizard** - Making MCP server configuration simple, secure, and scalable.</content>
<parameter name="filePath">/Users/josephapearson/local/mcp-wizard/README.md
