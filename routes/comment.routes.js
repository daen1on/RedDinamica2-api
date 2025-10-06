'use strict'

var express = require('express');
var api = express.Router();

var auth = require('../middlewares/auth.middleware');
var gdpr = require('../middlewares/gdpr.middleware');

var commentController = require('../controllers/comment.controller');

// Crear comentario - requiere activación (protección GDPR)
api.post('/comment', [auth.ensureAuth, gdpr.ensureActivated], commentController.saveComment);
// Actualizar comentario - requiere activación
api.put('/comment/:id', [auth.ensureAuth, gdpr.ensureActivated], commentController.updateComment);
// Eliminar comentario - requiere activación
api.delete('/comment/:id', [auth.ensureAuth, gdpr.ensureActivated], commentController.deleteComment);

// Rutas para likes en comentarios - requiere activación
api.post('/comment-like/:id', [auth.ensureAuth, gdpr.ensureActivated], commentController.toggleLikeComment);
api.get('/comment-likes/:id', [auth.ensureAuth, gdpr.ensureActivated], commentController.getCommentLikes);

// Rutas para respuestas anidadas - requiere activación (protección GDPR)
api.post('/comment/:id/reply', [auth.ensureAuth, gdpr.ensureActivated], commentController.addReply);
api.get('/comment/:id/replies', [auth.ensureAuth, gdpr.ensureActivated], commentController.getReplies);

module.exports = api;
