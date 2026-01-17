// src/modules/proveedores/routes/index.js
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';

const router = express.Router();

// Todas las rutas de proveedores requieren autenticación
router.use(authenticate);

// Rutas placeholder
router.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Módulo de proveedores funcionando',
    data: [],
    timestamp: new Date().toISOString()
  });
});

export default router;