'use strict'

const express = require('express');
const api = express.Router();

const auth = require('../middlewares/auth.middleware');
const controlAccess = require('../middlewares/controlAccess.middleware');
const academicLessonController = require('../controllers/academicLesson.controller');
const lessonController = require('../controllers/lesson.controller');
const resourceController = require('../controllers/resource.controller');
const adminTasksController = require('../controllers/adminTasks.controller');

// Devuelve pestañas del menú admin según rol
api.get('/admin/menu', auth.ensureAuth, (req, res) => {
  const role = req.user.role;
  let tabs = [
    'users','lessons','resources','basicData','errors','tasks'
  ];
  if (role === 'lesson_manager') {
    tabs = ['lessons','resources','tasks'];
  }
  return res.json(tabs);
});

// Resumen de tareas del administrador
api.get('/admin/tasks/summary', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.getTasksSummary);

module.exports = api;

// Movimiento de lección académica a RedDinámica
api.post('/admin/tasks/lecciones/:id/mover-a-reddinamica', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], academicLessonController.moveToRedDinamica);

// Listados para PendingTasks
api.get('/admin/tasks/convocatorias', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.listConvocatorias);

// Convocatorias abiertas (visibles)
api.get('/admin/tasks/convocatorias-abiertas', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.listConvocatoriasAbiertas);

api.get('/admin/tasks/recursos', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.listRecursosPendientes);

api.get('/admin/tasks/lecciones-academicas', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.listLeccionesAcademicas);

api.get('/admin/tasks/sugerencias', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.listSugerencias);

// Avalar y abrir convocatoria (call.visible=true). Si no hay call, crear una por defecto
api.post('/admin/tasks/lecciones/:id/avalar-y-abrir', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.avalarYabrirConvocatoria);

// Versiones 2 disponibles: lecciones completadas con hijo (son_lesson)
api.get('/admin/tasks/versiones', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], adminTasksController.listVersiones);


