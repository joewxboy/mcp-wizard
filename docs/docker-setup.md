# Docker Configuration for MCP Wizard

This document contains the Docker configuration files needed to run MCP Wizard in a containerized environment.

## docker-compose.yml

Create this file in the project root:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    container_name: mcp-wizard-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_wizard
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: mcp-wizard-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: ../docker/Dockerfile.backend
    container_name: mcp-wizard-backend
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/mcp_wizard
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-dev-refresh-secret}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      PORT: 3001
      NODE_ENV: development
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - ./configs:/app/configs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  # Frontend Application
  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/Dockerfile.frontend
    container_name: mcp-wizard-frontend
    environment:
      VITE_API_URL: http://localhost:3001/api
      VITE_WS_URL: ws://localhost:3001
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    command: npm run dev

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: mcp-wizard-network
```

## docker/Dockerfile.backend

Create this file in `docker/Dockerfile.backend`:

```dockerfile
FROM node:18-alpine

# Install build dependencies for native modules (node-keytar)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libsecret-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "run", "dev"]
```

## docker/Dockerfile.frontend

Create this file in `docker/Dockerfile.frontend`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

## Production Docker Configuration

For production deployment, use these optimized Dockerfiles:

### docker/Dockerfile.backend.prod

```dockerfile
# Build stage
FROM node:18-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libsecret-dev

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:18-alpine

RUN apk add --no-cache libsecret

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### docker/Dockerfile.frontend.prod

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### docker/nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## docker-compose.prod.yml

Production docker-compose configuration:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: mcp-wizard-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: mcp-wizard-redis
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: ../docker/Dockerfile.backend.prod
    container_name: mcp-wizard-backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - backend
      - frontend

  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/Dockerfile.frontend.prod
    container_name: mcp-wizard-frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - frontend

volumes:
  postgres_data:
  redis_data:

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
```

## .dockerignore

Create `.dockerignore` files to optimize build times:

### backend/.dockerignore

```
node_modules
npm-debug.log
dist
.env
.env.*
*.log
coverage
.git
.gitignore
README.md
.vscode
.idea
```

### frontend/.dockerignore

```
node_modules
npm-debug.log
dist
.env
.env.*
*.log
coverage
.git
.gitignore
README.md
.vscode
.idea
```

## Environment Variables for Docker

Create a `.env` file in the project root for Docker Compose:

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=mcp_wizard

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# GitHub API
GITHUB_TOKEN=ghp_your_github_token_here

# Optional
LOG_LEVEL=info
```

## Docker Commands Reference

### Development

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres redis

# View logs
docker-compose logs -f
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Rebuild containers
docker-compose build
docker-compose up -d --build

# Execute commands in container
docker-compose exec backend npm run migrate
docker-compose exec backend npx prisma studio
docker-compose exec postgres psql -U postgres -d mcp_wizard

# Shell access
docker-compose exec backend sh
docker-compose exec frontend sh
```

### Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Update services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Maintenance

```bash
# Database backup
docker-compose exec postgres pg_dump -U postgres mcp_wizard > backup.sql

# Database restore
docker-compose exec -T postgres psql -U postgres mcp_wizard < backup.sql

# Clean up unused images
docker image prune -a

# Clean up unused volumes
docker volume prune

# View resource usage
docker stats
```

## Kubernetes Deployment (Advanced)

For Kubernetes deployment, convert docker-compose to k8s manifests:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.28.0/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert docker-compose to k8s
kompose convert -f docker-compose.prod.yml

# Apply to cluster
kubectl apply -f .
```

## Troubleshooting Docker Issues

### Container Won't Start

```bash
# Check container logs
docker-compose logs backend

# Check container status
docker-compose ps

# Inspect container
docker inspect mcp-wizard-backend

# Remove and recreate
docker-compose down
docker-compose up -d --force-recreate
```

### Database Connection Issues

```bash
# Check if postgres is ready
docker-compose exec postgres pg_isready

# Check database exists
docker-compose exec postgres psql -U postgres -l

# Create database manually
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE mcp_wizard;"
```

### Volume Permission Issues

```bash
# Fix volume permissions
docker-compose down
sudo chown -R $USER:$USER ./configs
docker-compose up -d
```

### Network Issues

```bash
# Inspect network
docker network inspect mcp-wizard-network

# Recreate network
docker-compose down
docker network prune
docker-compose up -d
```

## Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use specific image versions** - Avoid `latest` tag in production
3. **Implement health checks** - Ensure services are ready before dependencies start
4. **Use multi-stage builds** - Reduce final image size
5. **Scan images for vulnerabilities** - Use `docker scan` or Trivy
6. **Limit container resources** - Set memory and CPU limits
7. **Use secrets management** - Docker secrets or external vault
8. **Regular backups** - Automate database and volume backups
9. **Monitor containers** - Use Prometheus, Grafana, or similar
10. **Keep images updated** - Regular security updates

## Security Considerations

### Production Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (min 32 characters)
- [ ] Enable HTTPS with valid certificates
- [ ] Restrict database access to backend only
- [ ] Use Docker secrets for sensitive data
- [ ] Enable container security scanning
- [ ] Implement rate limiting
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Regular security updates

### Secrets Management

For production, use Docker secrets:

```yaml
secrets:
  jwt_secret:
    external: true
  postgres_password:
    external: true

services:
  backend:
    secrets:
      - jwt_secret
      - postgres_password
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
```

Create secrets:
```bash
echo "your-secret" | docker secret create jwt_secret -
```

---

**Last Updated**: 2025-11-18  
**Maintained By**: DevOps Team