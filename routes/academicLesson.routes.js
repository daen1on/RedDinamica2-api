'use strict';

const express = require('express');
const router = express.Router();
const academicLessonController = require('../controllers/academicLesson.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const uploadMiddleware = require('../middlewares/multer.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware.ensureAuth);

// Rutas para lecciones académicas
router.post('/', academicLessonController.createLesson);
router.get('/group/:groupId', academicLessonController.getGroupLessons);
router.get('/my-lessons', academicLessonController.getMyLessons);
router.get('/teacher-lessons', academicLessonController.getTeacherLessons);
router.get('/:id', academicLessonController.getLessonById);
router.put('/:id', academicLessonController.updateLesson);
router.delete('/:id', academicLessonController.deleteLesson);

// Acciones del docente
router.post('/:id/approve', academicLessonController.approveLesson);
router.post('/:id/reject', academicLessonController.rejectLesson);
router.post('/:id/grade', academicLessonController.gradeLesson);
// Cambio de estado por el líder
router.put('/:id/state', academicLessonController.updateLessonState);
router.post('/:id/teacher-comments', academicLessonController.addTeacherComment);
router.delete('/:id/teacher-comments/:commentId', academicLessonController.deleteTeacherComment);
// Gestión de equipo de desarrollo
router.post('/:id/invite', academicLessonController.addToDevelopmentGroup);
router.post('/:id/leave', academicLessonController.leaveDevelopmentGroup);

// Exportación
router.post('/:id/request-export', academicLessonController.requestExportToRedDinamica); 


// Chat de la lección (mensajes simples)
router.post('/:id/chat', academicLessonController.addChatMessage);
router.put('/:id/chat/:messageId', academicLessonController.updateChatMessage);
router.delete('/:id/chat/:messageId', academicLessonController.deleteChatMessage);
// Conversaciones del equipo (mensajes por conversación)
router.post('/:id/conversations', academicLessonController.createConversation);
router.post('/:id/conversations/:conversationId/messages', academicLessonController.addConversationMessage);
router.put('/:id/conversations/:conversationId/messages/:messageId', academicLessonController.updateConversationMessage);
router.delete('/:id/conversations/:conversationId/messages/:messageId', academicLessonController.deleteConversationMessage);

// Archivos/recursos de la lección (subida simple con multer)
const LESSON_UPLOAD_PATH = '../uploads/lessons/';
router.post('/:id/resources', uploadMiddleware.uploadFile(LESSON_UPLOAD_PATH), academicLessonController.uploadLessonResource);
router.delete('/:id/resources/:fileId', academicLessonController.deleteLessonResource);
router.put('/:id/resources/:fileId', academicLessonController.updateLessonResource);

module.exports = router;
