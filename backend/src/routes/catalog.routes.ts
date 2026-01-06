import express from 'express';

const router = express.Router();

// Placeholder catalog routes - to be implemented
router.get('/servers', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.get('/servers/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.post('/servers', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.put('/servers/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

router.delete('/servers/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

export default router;