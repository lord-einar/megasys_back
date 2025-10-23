// src/modules/remitos/routes/index.js
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');

const router = express.Router();

// Todas las rutas de remitos requieren autenticación
router.use(authenticate);

// Rutas placeholder
router.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Módulo de remitos funcionando',
    data: [],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;