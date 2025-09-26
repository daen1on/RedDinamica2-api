'use strict';

const express = require('express');
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router();

// Crear nueva notificación
router.post('/notifications', authMiddleware.ensureAuth, notificationController.createNotification);

// Obtener notificaciones con paginación y filtros
// GET /api/notifications?page=1&limit=10&unread=true&type=message
router.get('/notifications', authMiddleware.ensureAuth, notificationController.getNotifications);

// Obtener conteo de notificaciones no leídas
router.get('/notifications/unread-count', authMiddleware.ensureAuth, notificationController.getUnreadCount);

// Marcar notificación específica como leída
router.put('/notifications/:id/read', authMiddleware.ensureAuth, notificationController.markAsRead);

// Marcar todas las notificaciones como leídas
router.put('/notifications/mark-all-read', authMiddleware.ensureAuth, notificationController.markAllAsRead);

// Eliminar notificación específica
router.delete('/notifications/:id', authMiddleware.ensureAuth, notificationController.deleteNotification);

module.exports = router;
