#!/bin/bash

# MCP Wizard Development Environment Setup
echo "🚀 Starting MCP Wizard development environment..."

# Start Docker services
echo "🐳 Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Run database migrations
echo "🗄️  Running database migrations..."
cd backend && npx prisma migrate dev --name init > /dev/null 2>&1

# Start backend server
echo "🖥️  Starting backend server..."
npm run dev > ../logs/backend.log 2>&1 &
echo $! > backend.pid

# Start frontend (if exists)
if [ -d "../frontend" ]; then
    echo "🌐 Starting frontend server..."
    cd ../frontend && npm run dev > ../logs/frontend.log 2>&1 &
    echo $! > frontend.pid
    cd ..
fi

echo "✅ Development environment ready!"
echo "📊 Backend: http://localhost:3001"
echo "🌐 Frontend: http://localhost:5173"
echo "🗄️  Database: localhost:5432"
echo "🔄 Redis: localhost:6379"
echo "📝 Prisma Studio: npx prisma studio --port 5555"
echo ""
echo "To stop: ./scripts/stop-dev.sh"