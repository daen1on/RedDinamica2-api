'use strict';

const express = require('express');
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router();

router.get('/notifications', authMiddleware.ensureAuth, notificationController.getNotifications);
router.put('/notifications/:id/read', authMiddleware.ensureAuth, notificationController.markAsRead);

module.exports = router;
