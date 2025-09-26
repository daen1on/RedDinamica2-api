'use strict'

let express = require('express');
let api = express.Router();

let auth = require('../middlewares/auth.middleware');
let uploadMiddleware = require('../middlewares/multer.middleware');
let controlAccess = require('../middlewares/controlAccess.middleware');

let lessonController = require('../controllers/lesson.controller');

const LESSON_PATH = '../uploads/lessons/';

// ===== RUTA DE VERIFICACIÓN DE TOKEN =====
api.get('/verify-token', auth.ensureAuth, lessonController.verifyToken);

// ===== RUTA DE PRUEBA PARA DEBUGGING =====
api.get('/test', lessonController.testEndpoint);


api.post('/lesson', auth.ensureAuth, lessonController.saveLesson);

api.post('/upload-lesson/:id', [auth.ensureAuth, uploadMiddleware.uploadFiles(LESSON_PATH)],lessonController.uploadLessonFiles);
api.get('/get-lesson/:file', lessonController.getLessonFile);

api.put('/lesson/:id', auth.ensureAuth, lessonController.updateLesson);

api.delete('/lesson/:id', auth.ensureAuth, lessonController.deleteLesson);

api.get('/lesson/:id', auth.ensureAuth , lessonController.getLesson);
api.get('/lessons/:visibleOnes/:page?', auth.ensureAuth, lessonController.getLessons);
api.get('/all-lessons/:visibleOnes/:order?', auth.ensureAuth, lessonController.getAllLessons);
api.get('/my-lessons/:page?', auth.ensureAuth, lessonController.getMyLessons);
api.get('/all-my-lessons', auth.ensureAuth, lessonController.getAllMyLessons);
api.get('/lessons-to-advise/:page?', auth.ensureAuth, lessonController.getLessonsToAdvise);
api.get('/all-lessons-to-advise', auth.ensureAuth, lessonController.getAllLessonsToAdvise);

api.get('/suggest-lessons/:page?', auth.ensureAuth, lessonController.getSuggestLessons);
api.get('/experiences/:page?', auth.ensureAuth, lessonController.getExperiences);
api.get('/calls/:page?', lessonController.getCalls);
api.get('/all-calls', lessonController.getAllCalls);

// ===== NUEVAS RUTAS PARA NOTIFICACIONES =====

// Añadir mensaje a conversación de lección
api.post('/lesson/:id/message', auth.ensureAuth, lessonController.addLessonMessage);

// Cambiar estado de lección
api.put('/lesson/:id/state', auth.ensureAuth, lessonController.changeLessonState);

// Crear convocatoria
api.post('/lesson/:id/call', auth.ensureAuth, lessonController.createCall);

// Mostrar interés en convocatoria
api.post('/lesson/:id/call/interest', auth.ensureAuth, lessonController.showInterestInCall);

// ===== NUEVAS RUTAS PARA PERFIL DE LECCIONES =====

// Obtener lecciones públicas de un usuario específico
api.get('/users/:userId/lessons/public', auth.ensureAuth, lessonController.getUserPublicLessons);

// Obtener estadísticas de lecciones de un usuario
api.get('/users/:userId/lessons/stats', auth.ensureAuth, lessonController.getUserLessonsStats);

// Configuración de privacidad de lecciones
api.get('/users/lessons/privacy', auth.ensureAuth, lessonController.getLessonsPrivacy);
api.put('/users/lessons/privacy', auth.ensureAuth, lessonController.updateLessonsPrivacy);

// Alternar visibilidad de lección específica
api.put('/lessons/:lessonId/visibility', auth.ensureAuth, lessonController.toggleLessonVisibility);

// ===== NUEVAS RUTAS PARA FACILITADOR SUGERIDO =====

// Responder a invitación de facilitador
api.put('/lesson/:id/facilitator-response', auth.ensureAuth, lessonController.respondToFacilitatorInvitation);

// Obtener invitaciones pendientes del facilitador
api.get('/facilitator/invitations', auth.ensureAuth, lessonController.getFacilitatorInvitations);

// ===== NUEVAS RUTAS PARA APROBACIÓN/RECHAZO DE FACILITADOR =====

// Aprobar experiencia como facilitador sugerido
api.put('/lesson/:lessonId/approve-facilitator', auth.ensureAuth, lessonController.approveFacilitatorSuggestion);

// Rechazar experiencia como facilitador sugerido
api.put('/lesson/:lessonId/reject-facilitator', auth.ensureAuth, lessonController.rejectFacilitatorSuggestion);

module.exports = api;
