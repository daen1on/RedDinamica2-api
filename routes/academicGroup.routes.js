'use strict';

const express = require('express');
const router = express.Router();
const academicGroupController = require('../controllers/academicGroup.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware.ensureAuth);

// Listado global (solo admin / lesson_manager)
router.get('/', academicGroupController.getAllGroups);

// Rutas para docentes
router.post('/', academicGroupController.createGroup);
router.get('/teacher', academicGroupController.getTeacherGroups);
router.get('/student', academicGroupController.getStudentGroups);
router.get('/:id', academicGroupController.getGroupById);
router.put('/:id', academicGroupController.updateGroup);
router.delete('/:id', academicGroupController.deleteGroup);

// Utilidades
router.get('/valid-grades/:academicLevel', academicGroupController.getValidGrades);

// Gestión de estudiantes
router.post('/:groupId/students/:studentId', academicGroupController.addStudentToGroup);
router.delete('/:groupId/students/:studentId', academicGroupController.removeStudentFromGroup);
router.get('/:groupId/students', academicGroupController.getGroupStudents);
router.post('/:groupId/invite', academicGroupController.inviteStudentByEmail);

// Estadísticas
router.get('/:groupId/statistics', academicGroupController.getGroupStatistics);

// Permisos del grupo
router.put('/:groupId/permissions', academicGroupController.updateGroupPermissions);
router.get('/:groupId/can-create-lessons', academicGroupController.canStudentCreateLessons);

// Discusión del grupo
router.get('/:groupId/discussion', academicGroupController.getDiscussion);
router.post('/:groupId/discussion', academicGroupController.addDiscussionMessage);
router.delete('/:groupId/discussion/:messageId', academicGroupController.deleteDiscussionMessage);

// Recursos del grupo
router.get('/:groupId/resources', academicGroupController.getGroupResources);
router.post('/:groupId/resources', academicGroupController.addGroupResource);
router.delete('/:groupId/resources/:resourceId', academicGroupController.removeGroupResource);

module.exports = router;
