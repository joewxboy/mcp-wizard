# MCP Wizard - Technical Specification Summary

## Overview

MCP Wizard is a web application that simplifies the discovery, configuration, and management of Model Context Protocol (MCP) servers. It automates the research process by extracting metadata from GitHub repositories and npm packages, then guides users through a wizard-style interface to create validated configurations compatible with various MCP clients.

## Core Features

### 1. MCP Server Discovery
- Search by keywords, GitHub URL, or npm package name
- Browse curated catalog of known MCP servers
- View detailed server information (tools, resources, prompts)
- Automated metadata extraction from documentation

### 2. Intelligent Configuration Wizard
- Step-by-step guided configuration process
- Smart defaults based on server metadata
- Real-time validation of parameters
- Secure handling of API keys and secrets
- Preview and test configurations before saving

### 3. Configuration Management
- Full CRUD operations for configurations
- Version history with rollback capability
- Export to multiple client formats (Claude Desktop, generic MCP)
- Enable/disable servers without deletion

### 4. Security & Integration
- System keychain integration for sensitive data
- Encrypted storage for credentials
- Compatible with Claude Desktop config format
- Atomic file operations to prevent corruption

## Technology Stack

### Frontend
- **React 18+** with TypeScript
- **Redux Toolkit** for state management
- **Tailwind CSS + Headless UI** for styling
- **React Hook Form + Zod** for validation
- **Vite** for build tooling

### Backend
- **Node.js 18+** with TypeScript
- **Express.js** for API server
- **PostgreSQL** for data persistence
- **Redis** for caching
- **Prisma** as ORM
- **node-keytar** for keychain access

### External APIs
- GitHub API for repository analysis
- npm Registry API for package metadata
- Puppeteer/Cheerio for web scraping

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Frontend (Wizard, Dashboard, Config Manager)  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Express.js REST API + WebSocket              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Research │  │  Config  │  │ Catalog  │  │ Version  │  │
│  │ Service  │  │ Service  │  │ Service  │  │ Control  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │PostgreSQL│  │  Redis   │  │   File   │  │ Keychain │  │
│  │          │  │  Cache   │  │  System  │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### MCPServer (Catalog Entry)
```typescript
{
  id: string
  name: string
  description: string
  source: 'github' | 'npm' | 'manual'
  sourceUrl: string
  version: string
  
  // Extracted metadata
  tools: ToolSchema[]
  resources: ResourceSchema[]
  prompts: PromptSchema[]
  
  // Configuration template
  configTemplate: {
    command: string
    args?: string[]
    env?: Record<string, string>
  }
  
  requiredParams: ConfigParam[]
  optionalParams: ConfigParam[]
}
```

### UserConfig (User's Configuration)
```typescript
{
  id: string
  userId: string
  serverId: string
  name: string
  enabled: boolean
  
  // Runtime configuration
  command: string
  args: string[]
  env: Record<string, string>
  
  // Secret references (stored in keychain)
  secrets: SecretReference[]
  
  // Target format
  targetClient: 'claude-desktop' | 'custom'
  
  // Versioning
  version: number
  createdAt: Date
  updatedAt: Date
}
```

## API Endpoints

### Research & Discovery
- `POST /api/research/discover` - Search for MCP servers
- `POST /api/research/analyze` - Analyze specific URL/package
- `GET /api/research/status/:jobId` - Check analysis status

### Catalog Management
- `GET /api/catalog/servers` - List servers with filters
- `GET /api/catalog/servers/:id` - Get server details
- `POST /api/catalog/servers` - Add new server
- `PUT /api/catalog/servers/:id` - Update server
- `DELETE /api/catalog/servers/:id` - Remove server

### Configuration Management
- `GET /api/configs` - List user configurations
- `GET /api/configs/:id` - Get configuration details
- `POST /api/configs` - Create new configuration
- `PUT /api/configs/:id` - Update configuration
- `DELETE /api/configs/:id` - Delete configuration
- `POST /api/configs/:id/validate` - Validate configuration
- `POST /api/configs/:id/export` - Export to file format

### Version Control
- `GET /api/configs/:id/versions` - List versions
- `GET /api/configs/:id/versions/:version` - Get specific version
- `POST /api/configs/:id/rollback/:version` - Rollback to version

### Keychain Management
- `POST /api/keychain/store` - Store secret
- `GET /api/keychain/:id` - Retrieve secret
- `DELETE /api/keychain/:id` - Delete secret

## Wizard Workflow

```
1. Discovery
   ↓
2. Server Selection
   ↓
3. Basic Configuration
   ↓
4. Advanced Settings (optional)
   ↓
5. Secrets Management
   ↓
6. Validation
   ↓
7. Review & Save
```

### Step Details

**1. Discovery**
- Search or browse catalog
- View server details and capabilities
- Select server to configure

**2. Server Selection**
- Confirm selected server
- Choose target client format
- View configuration requirements

**3. Basic Configuration**
- Server name (auto-generated with override)
- Command and arguments (pre-filled)
- Essential environment variables

**4. Advanced Settings**
- Optional parameters
- Custom environment variables
- Transport configuration (stdio/SSE)

**5. Secrets Management**
- Identify sensitive parameters
- Store in system keychain
- Create secure references

**6. Validation**
- Verify executable exists
- Validate parameter types
- Optional connection test

**7. Review & Save**
- Preview final configuration
- Export or save to database
- Enable/disable server

## Research Service Flow

```
Input (URL/Package) → Identify Source → Extract Metadata → Parse Content
                                                              ↓
Store in Catalog ← Generate Template ← Analyze Schemas ← Extract Docs
```

### Extraction Strategy

**GitHub Repositories:**
1. Fetch repository metadata via GitHub API
2. Read key files (package.json, README.md)
3. Search for MCP schema definitions
4. Extract configuration examples
5. Parse tool/resource/prompt definitions

**npm Packages:**
1. Query npm Registry API
2. Get package metadata
3. Follow repository link to GitHub
4. Continue with GitHub extraction

**Web Documentation:**
1. Fetch page content
2. Extract structured documentation
3. Parse configuration examples
4. Identify API requirements

## Configuration Formats

### Claude Desktop Format
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server/index.js"],
      "env": {
        "API_KEY": "value"
      }
    }
  }
}
```

### Generic MCP Format
```json
{
  "name": "server-name",
  "transport": "stdio",
  "command": "node",
  "args": ["/path/to/server/index.js"],
  "env": {
    "API_KEY": "value"
  }
}
```

## Security Measures

### Authentication
- JWT-based authentication with refresh tokens
- Secure password hashing (bcrypt)
- Rate limiting on API endpoints
- CORS configuration

### Data Protection
- Secrets stored in system keychain (never in database)
- HTTPS for all communications
- Input validation and sanitization
- SQL injection prevention via ORM

### File Operations
- Atomic writes to prevent corruption
- Automatic backups before modifications
- Path validation to prevent traversal
- Secure file permissions

## Performance Optimizations

### Caching Strategy
- Redis cache for catalog searches (TTL: 1 hour)
- Browser cache for static assets
- API response caching for metadata
- Memoization for expensive computations

### Frontend Optimizations
- Code splitting by route
- Lazy loading for large components
- Debounced search inputs
- Virtualized lists for large datasets

### Backend Optimizations
- Database indexing on common queries
- Connection pooling for PostgreSQL
- Batch operations for bulk updates
- Async processing for research jobs

## Deployment Architecture

### Development
- Docker Compose for local environment
- Hot reload for frontend and backend
- Local PostgreSQL and Redis instances

### Production
- Containerized deployment (Docker)
- Load balancer for horizontal scaling
- Database replication for high availability
- CDN for static assets
- Monitoring and logging (APM)

## Testing Strategy

### Unit Tests
- Service layer business logic
- Utility functions
- Data model validation
- Configuration converters

### Integration Tests
- API endpoint testing
- Database operations
- External API mocking
- File system operations

### End-to-End Tests
- Complete wizard workflow
- Configuration export/import
- Version rollback
- Search and discovery

### Test Coverage Goals
- Overall: 80%+
- Critical paths: 95%+
- Service layer: 90%+
- API endpoints: 85%+

## Development Timeline

### Phase 1: Foundation (Weeks 1-2)
- Project setup and tooling
- Database schema
- Authentication system
- Basic API structure

### Phase 2: Research Service (Weeks 3-5)
- GitHub/npm integration
- Metadata extraction
- Catalog management
- Search functionality

### Phase 3: Configuration (Weeks 6-8)
- Config CRUD operations
- Keychain integration
- Version control
- Format converters

### Phase 4: Frontend (Weeks 9-12)
- React application
- Wizard implementation
- Configuration manager
- Discovery interface

### Phase 5: Integration (Weeks 13-15)
- API integration
- State management
- Testing
- Error handling

### Phase 6: Launch (Weeks 16-18)
- UI/UX polish
- Performance optimization
- Documentation
- Deployment

## Success Criteria

### Technical Metrics
- API response time < 200ms (p95)
- Frontend load time < 2s
- Test coverage > 80%
- Zero critical vulnerabilities

### User Metrics
- Configuration time < 5 minutes
- Success rate > 95%
- User satisfaction > 4/5
- Active user growth

### Business Metrics
- Catalog size growth
- Configurations created
- Community engagement
- GitHub stars

## Risk Mitigation

### Technical Risks
1. **API Rate Limits** → Aggressive caching, authenticated requests
2. **Keychain Issues** → Fallback to encrypted storage
3. **File Corruption** → Atomic operations, backups
4. **Performance** → Pagination, indexing, caching
5. **Security** → Regular audits, input validation

### Project Risks
1. **Scope Creep** → Strict MVP, phased approach
2. **Integration Complexity** → Start with popular servers
3. **User Adoption** → Focus on UX, early feedback

## Next Steps

1. **Review** this specification with stakeholders
2. **Set up** development environment
3. **Create** detailed sprint plan
4. **Begin** Phase 1 implementation
5. **Establish** feedback loops with early users

## Questions for Review

1. Does the technology stack align with team capabilities?
2. Is the 18-week timeline realistic?
3. Are there critical features missing from MVP?
4. What is the priority: speed vs completeness?
5. Which MCP servers should we support initially?
6. Who is the target user base?
7. Are there compliance requirements?
8. What is the infrastructure budget?

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-18  
**Status**: Draft for Review