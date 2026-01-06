import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter, authLimiter, researchLimiter } from './middleware/rateLimit.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import catalogRoutes from './routes/catalog.routes';
import configRoutes from './routes/config.routes';
import researchRoutes from './routes/research.routes';
import versionRoutes from './routes/version.routes';
import keychainRoutes from './routes/keychain.routes';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Compression middleware
app.use(compression());

// Rate limiting
app.use('/api', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/configs', versionRoutes);
app.use('/api/keychain', keychainRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const server = createServer(app);

export { app, server };