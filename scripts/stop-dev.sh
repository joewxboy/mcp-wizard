#!/bin/bash

# MCP Wizard Development Environment Shutdown
echo "🛑 Stopping MCP Wizard development environment..."

# Stop backend server
if [ -f "backend/backend.pid" ]; then
    kill $(cat backend/backend.pid) 2>/dev/null || true
    rm -f backend/backend.pid
    echo "✅ Backend server stopped"
fi

# Stop frontend server
if [ -f "frontend/frontend.pid" ]; then
    kill $(cat frontend/frontend.pid) 2>/dev/null || true
    rm -f frontend/frontend.pid
    echo "✅ Frontend server stopped"
fi

# Stop Docker services
echo "🐳 Stopping Docker services..."
docker-compose down

echo "✅ All services stopped"