'use strict'

const express = require('express');
const api = express.Router();

const auth = require('../middlewares/auth.middleware');
const controlAccess = require('../middlewares/controlAccess.middleware');
const academicLessonController = require('../controllers/academicLesson.controller');
const lessonController = require('../controllers/lesson.controller');
const resourceController = require('../controllers/resource.controller');

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
api.get('/admin/tasks/summary', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Resource = require('../models/resource.model');
    const AcademicLesson = require('../models/academicLesson.model');
    const Lesson = require('../models/lesson.model');

    const [recursosPorAprobar, leccionesPorMover] = await Promise.all([
      Resource.countDocuments({ accepted: false, visible: false }),
      AcademicLesson.countDocuments({ state: 'ready_for_migration', isExported: false })
    ]);

    // Convocatorias por gestionar: incluye varios tipos
    const convocatoriasPorAbrir = await Lesson.countDocuments({ 
      $or: [
        { 'call.visible': false },
        { 
          state: 'completed',
          call: { $exists: true, $ne: null },
          son_lesson: { $exists: false }
        },
        {
          state: 'proposed',
          accepted: true
        }
      ]
    });
    const sugerenciasPorHacer = await Lesson.countDocuments({ state: 'proposed', accepted: false });

    return res.json({
      convocatoriasPorAbrir,
      sugerenciasPorHacer,
      recursosPorAprobar,
      leccionesPorMover
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error obteniendo resumen de tareas' });
  }
});

module.exports = api;

// Movimiento de lección académica a RedDinámica
api.post('/admin/tasks/lecciones/:id/mover-a-reddinamica', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], academicLessonController.moveToRedDinamica);

// Listados para PendingTasks
// Convocatorias por gestionar: incluye lecciones con call.visible=false (por abrir)
// y lecciones completed con call y sin son_lesson (para nueva versión)
// y lecciones proposed con accepted=true (aceptadas por admin, esperando gestión)
api.get('/admin/tasks/convocatorias', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Lesson = require('../models/lesson.model');
    const lessons = await Lesson.find({ 
      $or: [
        // Convocatorias con call.visible=false (pendientes de abrir)
        { 'call.visible': false },
        // Lecciones completed con call y sin hijo (pueden crear nueva versión)
        { 
          state: 'completed',
          call: { $exists: true, $ne: null },
          son_lesson: { $exists: false }
        },
        // Lecciones proposed ya aceptadas (esperando gestión de convocatoria)
        {
          state: 'proposed',
          accepted: true
        }
      ]
    })
      .populate('leader', 'name surname email')
      .populate('expert', 'name surname email')
      .select('title call leader expert version created_at son_lesson state accepted');
    return res.json({ lessons });
  } catch (e) { return res.status(500).json({ message: 'Error listando convocatorias' }); }
});

// Convocatorias abiertas (visibles)
api.get('/admin/tasks/convocatorias-abiertas', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Lesson = require('../models/lesson.model');
    const lessons = await Lesson.find({ 'call.visible': true }).select('title call leader created_at');
    console.log(lessons);
    return res.json({ items: lessons });
  } catch (e) { return res.status(500).json({ message: 'Error listando convocatorias abiertas' }); }
});

api.get('/admin/tasks/recursos', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Resource = require('../models/resource.model');
    const resources = await Resource.find({ accepted: false, visible: false })
      .populate('author', 'name surname email')
      .select('name author type created_at');
    return res.json({ resources });
  } catch (e) { return res.status(500).json({ message: 'Error listando recursos' }); }
});

api.get('/admin/tasks/lecciones-academicas', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const AcademicLesson = require('../models/academicLesson.model');
    const items = await AcademicLesson.find({ state: 'ready_for_migration', isExported: false }).select('title author createdAt');
    return res.json({ items });
  } catch (e) { return res.status(500).json({ message: 'Error listando lecciones académicas' }); }
});

// Sugerencias por hacer: lecciones propuestas (proposed) y no aceptadas
api.get('/admin/tasks/sugerencias', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Lesson = require('../models/lesson.model');
    const lessons = await Lesson.find({ state: 'proposed', accepted: false })
      .populate('author', 'name surname email')
      .select('title author created_at');
    return res.json({ lessons });
  } catch (e) { return res.status(500).json({ message: 'Error listando sugerencias' }); }
});

// Avalar y abrir convocatoria (call.visible=true). Si no hay call, crear una por defecto
api.post('/admin/tasks/lecciones/:id/avalar-y-abrir', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Lesson = require('../models/lesson.model');
    const id = req.params.id;
    const lesson = await Lesson.findById(id);
    if(!lesson) return res.status(404).json({ message: 'Lesson not found' });
    if(lesson.state !== 'proposed' || lesson.accepted === true){
      return res.status(400).json({ message: 'Solo se puede avalar lecciones en estado proposed y accepted=false' });
    }
    lesson.accepted = true;
    const defaultText = `Convocatoria abierta para la lección "${lesson.title}". Si te interesa participar, únete al grupo desde esta convocatoria.`;
    lesson.call = {
      ...(lesson.call || {}),
      text: (lesson.call && lesson.call.text) ? lesson.call.text : defaultText,
      visible: true,
      author: req.user.sub,
      interested: (lesson.call && lesson.call.interested) ? lesson.call.interested : [],
      created_at: new Date()
    };
    await lesson.save();
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(500).json({ message: 'Error al avalar y abrir convocatoria' }); }
});

// Versiones 2 disponibles: lecciones completadas con hijo (son_lesson)
api.get('/admin/tasks/versiones', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], async (req, res) => {
  try {
    const Lesson = require('../models/lesson.model');
    const items = await Lesson.find({ state: 'completed', son_lesson: { $exists: true, $ne: null } }).select('title son_lesson');
    return res.json({ items });
  } catch (e) { return res.status(500).json({ message: 'Error listando versiones' }); }
});


