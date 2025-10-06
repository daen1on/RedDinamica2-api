'use strict'

var express = require('express');
var messageController = require('../controllers/message.controller');

var authMiddleware = require('../middlewares/auth.middleware');
var gdpr = require('../middlewares/gdpr.middleware');

var api = express.Router();

// Enviar mensaje privado - requiere activación (protección GDPR)
api.post('/message', [authMiddleware.ensureAuth, gdpr.ensureActivated], messageController.saveMessage);
// Eliminar mensaje - requiere activación
api.delete('/message/:id', [authMiddleware.ensureAuth, gdpr.ensureActivated], messageController.deleteMessage);
// Ver mensajes recibidos - requiere activación
api.get('/my-messages/:page?', [authMiddleware.ensureAuth, gdpr.ensureActivated], messageController.getReceiveMessages);
// Ver mensajes enviados - requiere activación
api.get('/messages/:page?', [authMiddleware.ensureAuth, gdpr.ensureActivated], messageController.getEmittedMessages);
// Ver mensajes no vistos - requiere activación
api.get('/unviewed-messages', [authMiddleware.ensureAuth, gdpr.ensureActivated], messageController.getUnviewedMessages);

// Marcar mensajes como vistos - requiere activación
api.put('/setviewed_messages', [authMiddleware.ensureAuth, gdpr.ensureActivated], messageController.setViewedMessages);

module.exports = api;