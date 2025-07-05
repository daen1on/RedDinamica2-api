'use strict'

var express = require('express');
var api = express.Router();

var auth = require('../middlewares/auth.middleware');

var commentController = require('../controllers/comment.controller');

api.post('/comment', auth.ensureAuth, commentController.saveComment);
api.put('/comment/:id', auth.ensureAuth, commentController.updateComment);
api.delete('/comment/:id', auth.ensureAuth, commentController.deleteComment);

// Rutas para likes en comentarios
api.post('/comment-like/:id', auth.ensureAuth, commentController.toggleLikeComment);
api.get('/comment-likes/:id', auth.ensureAuth, commentController.getCommentLikes);

// Rutas para respuestas anidadas
api.post('/comment/:id/reply', auth.ensureAuth, commentController.addReply);
api.get('/comment/:id/replies', auth.ensureAuth, commentController.getReplies);

module.exports = api;
