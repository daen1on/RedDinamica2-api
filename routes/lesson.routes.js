'use strict'

let express = require('express');
let api = express.Router();

let auth = require('../middlewares/auth.middleware');
let uploadMiddleware = require('../middlewares/multer.middleware');
let controlAccess = require('../middlewares/controlAccess.middleware');
let gdpr = require('../middlewares/gdpr.middleware');

let lessonController = require('../controllers/lesson.controller');

const LESSON_PATH = '../uploads/lessons/';

// ===== RUTA DE VERIFICACIÓN DE TOKEN =====
api.get('/verify-token', auth.ensureAuth, lessonController.verifyToken);

// ===== RUTA DE PRUEBA PARA DEBUGGING =====
api.get('/test', lessonController.testEndpoint);


// Crear lección - requiere activación
api.post('/lesson', [auth.ensureAuth, gdpr.ensureActivated], lessonController.saveLesson);

api.post('/upload-lesson/:id', [auth.ensureAuth, gdpr.ensureActivated, uploadMiddleware.uploadFiles(LESSON_PATH)], lessonController.uploadLessonFiles);
api.get('/get-lesson/:file', lessonController.getLessonFile);

// Actualizar lección - requiere activación
api.put('/lesson/:id', [auth.ensureAuth, gdpr.ensureActivated], lessonController.updateLesson);

// Eliminar lección - requiere activación
api.delete('/lesson/:id', [auth.ensureAuth, gdpr.ensureActivated], lessonController.deleteLesson);

// Ver lecciones - requiere activación (protección GDPR)
api.get('/lesson/:id', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getLesson);
api.get('/lessons/:visibleOnes/:page?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getLessons);
api.get('/all-lessons/:visibleOnes/:order?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getAllLessons);
api.get('/my-lessons/:page?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getMyLessons);
api.get('/all-my-lessons', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getAllMyLessons);
api.get('/lessons-to-advise/:page?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getLessonsToAdvise);
api.get('/all-lessons-to-advise', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getAllLessonsToAdvise);

// Sugerir lecciones y ver experiencias - requiere activación
api.get('/suggest-lessons/:page?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getSuggestLessons);
api.get('/experiences/:page?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getExperiences);
api.get('/calls/:page?', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getCalls);
api.get('/all-calls', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getAllCalls);

// ===== NUEVAS RUTAS PARA NOTIFICACIONES =====

// Añadir mensaje a conversación de lección - requiere activación
api.post('/lesson/:id/message', [auth.ensureAuth, gdpr.ensureActivated], lessonController.addLessonMessage);
// Editar mensaje de conversación de lección (30 min window) - requiere activación
api.put('/lesson/:id/message/:messageId', [auth.ensureAuth, gdpr.ensureActivated], lessonController.editLessonMessage);
// Añadir comentario de experto/facilitador con notificaciones - requiere activación
api.post('/lesson/:id/expert-comment', [auth.ensureAuth, gdpr.ensureActivated], lessonController.addExpertComment);

// Cambiar estado de lección - requiere activación
api.put('/lesson/:id/state', [auth.ensureAuth, gdpr.ensureActivated], lessonController.changeLessonState);

// Crear convocatoria - requiere activación
api.post('/lesson/:id/call', [auth.ensureAuth, gdpr.ensureActivated], lessonController.createCall);

// Mostrar interés en convocatoria - requiere activación (protección GDPR)
api.post('/lesson/:id/call/interest', [auth.ensureAuth, gdpr.ensureActivated], lessonController.showInterestInCall);

// ===== NUEVAS RUTAS PARA PERFIL DE LECCIONES =====

// Obtener lecciones públicas de un usuario específico - requiere activación
api.get('/users/:userId/lessons/public', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getUserPublicLessons);

// Obtener estadísticas de lecciones de un usuario - requiere activación
api.get('/users/:userId/lessons/stats', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getUserLessonsStats);

// Configuración de privacidad de lecciones - requiere activación
api.get('/users/lessons/privacy', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getLessonsPrivacy);
api.put('/users/lessons/privacy', [auth.ensureAuth, gdpr.ensureActivated], lessonController.updateLessonsPrivacy);

// Alternar visibilidad de lección específica - requiere activación
api.put('/lessons/:lessonId/visibility', [auth.ensureAuth, gdpr.ensureActivated], lessonController.toggleLessonVisibility);

// ===== NUEVAS RUTAS PARA FACILITADOR SUGERIDO =====

// Responder a invitación de facilitador - requiere activación
api.put('/lesson/:id/facilitator-response', [auth.ensureAuth, gdpr.ensureActivated], lessonController.respondToFacilitatorInvitation);

// Obtener invitaciones pendientes del facilitador - requiere activación
api.get('/facilitator/invitations', [auth.ensureAuth, gdpr.ensureActivated], lessonController.getFacilitatorInvitations);

// ===== NUEVAS RUTAS PARA APROBACIÓN/RECHAZO DE FACILITADOR =====

// Aprobar experiencia como facilitador sugerido - requiere activación
api.put('/lesson/:lessonId/approve-facilitator', [auth.ensureAuth, gdpr.ensureActivated], lessonController.approveFacilitatorSuggestion);

// Rechazar experiencia como facilitador sugerido - requiere activación
api.put('/lesson/:lessonId/reject-facilitator', [auth.ensureAuth, gdpr.ensureActivated], lessonController.rejectFacilitatorSuggestion);

module.exports = api;
