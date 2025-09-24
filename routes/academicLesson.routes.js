'use strict';

const express = require('express');
const router = express.Router();
const academicLessonController = require('../controllers/academicLesson.controller');
const authMiddleware = require('../middlewares/auth.middleware');

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

// Exportación
router.post('/:id/export', academicLessonController.exportToMain);

module.exports = router;
