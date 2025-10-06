'use strict';

const express = require('express');
const cronController = require('../controllers/cron.controller');
const auth = require('../middlewares/auth.middleware');

const api = express.Router();

/**
 * Rutas para gestión de tareas programadas (Cron Jobs)
 * Todas las rutas requieren autenticación de administrador
 */

// Ejecutar manualmente el envío de resúmenes mensuales (solo admin)
api.get('/execute-monthly-digest', auth.ensureAuth, cronController.manualExecuteDigest);

// Enviar resumen de prueba a un usuario específico (solo admin)
api.post('/test-digest/:userId', auth.ensureAuth, cronController.testDigestForUser);

module.exports = api;

