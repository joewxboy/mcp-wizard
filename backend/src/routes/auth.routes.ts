import express from 'express';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = express.Router();

// Placeholder auth routes - to be implemented
router.post('/register', authLimiter, (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.post('/login', authLimiter, (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.post('/refresh', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.post('/logout', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

export default router;