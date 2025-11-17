'use strict'

// Controlador para endpoints de tareas de administración

async function getTasksSummary(req, res) {
  try {
    const Resource = require('../models/resource.model');
    const AcademicLesson = require('../models/academicLesson.model');
    const Lesson = require('../models/lesson.model');

    const [recursosPorAprobar, leccionesPorMover] = await Promise.all([
      // Alinear con listRecursosPendientes (accepted: false)
      Resource.countDocuments({ accepted: false }),
      AcademicLesson.countDocuments({ state: 'ready_for_migration', isExported: false })
    ]);

    // Alinear con listConvocatorias + reglas de filtro:
    // - completed sin hijo (independiente de call)
    // - proposed aceptadas y sin call o con call.visible=false
    // - cualquier lección con call.visible=false
    const convocatoriasPorAbrir = await Lesson.countDocuments({
      $or: [
        { state: 'completed', son_lesson: { $exists: false } },
        { state: 'proposed', accepted: true, $or: [ { call: { $exists: false } }, { 'call.visible': false } ] },
        { 'call.visible': false }
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
}

async function listConvocatorias(req, res) {
  try {
    const Lesson = require('../models/lesson.model');

    // Candidatos: convocatorias ocultas, propuestas aceptadas, y completadas (se filtran abajo)
    const lessons = await Lesson.find({
      $or: [
        { 'call.visible': false },
        { state: 'proposed', accepted: true },
        { state: 'completed' }
      ]
    })
      .populate('leader', 'name surname email')
      .populate('expert', 'name surname email')
      .populate('son_lesson', 'state call')
      .select('title call leader expert version created_at son_lesson state accepted');

    // Filtro final según reglas:
    // - Lección completed:
    //   - Si NO tiene hijo => mostrar (abrir nueva versión)
    //   - Si tiene hijo => NO mostrar el padre (si el hijo está en proposed+call.visible=false, el hijo ya entra por call.visible=false)
    // - Lección proposed (aceptada): mostrar solo si no tiene call o call.visible=false
    // - Lección con call.visible=false: mostrar
    const filtered = lessons.filter((l) => {
      if (l.state === 'completed') {
        return !l.son_lesson; // Solo padres sin hijo
      }
      if (l.state === 'proposed') {
        return l.accepted === true && (!l.call || l.call.visible === false);
      }
      return !!(l.call && l.call.visible === false);
    });

    return res.json({ lessons: filtered });
  } catch (e) {
    return res.status(500).json({ message: 'Error listando convocatorias' });
  }
}

async function listConvocatoriasAbiertas(req, res) {
  try {
    const Lesson = require('../models/lesson.model');
    const lessons = await Lesson.find({ 'call.visible': true }).select('title call leader created_at');
    return res.json({ items: lessons });
  } catch (e) {
    return res.status(500).json({ message: 'Error listando convocatorias abiertas' });
  }
}

async function listRecursosPendientes(req, res) {
  try {
    const Resource = require('../models/resource.model');
    const resources = await Resource.find({ accepted: false })
      .populate('author', 'name surname email')
      .select('name author type created_at rejected');
    return res.json({ resources });
  } catch (e) {
    return res.status(500).json({ message: 'Error listando recursos' });
  }
}

async function listLeccionesAcademicas(req, res) {
  try {
    const AcademicLesson = require('../models/academicLesson.model');
    const items = await AcademicLesson.find({ state: 'ready_for_migration', isExported: false })
      .populate('author', 'name surname email picture')
      .populate('leader', 'name surname email picture')
      .populate('teacher', 'name surname email picture')
      .populate('knowledge_areas', 'name')
      .populate('development_group.user', 'name surname email picture')
      .populate('files.uploadedBy', 'name surname email')
      .select('title resume references justification knowledge_areas level files development_group author leader teacher createdAt');
    return res.json({ items });
  } catch (e) {
    console.error('Error listando lecciones académicas:', e);
    return res.status(500).json({ message: 'Error listando lecciones académicas' });
  }
}

async function listSugerencias(req, res) {
  try {
    const Lesson = require('../models/lesson.model');
    const lessons = await Lesson.find({ state: 'proposed', accepted: false })
      .populate('author', 'name surname email')
      .select('title author created_at');
    return res.json({ lessons });
  } catch (e) {
    return res.status(500).json({ message: 'Error listando sugerencias' });
  }
}

async function avalarYabrirConvocatoria(req, res) {
  try {
    const Lesson = require('../models/lesson.model');
    const id = req.params.id;
    const lesson = await Lesson.findById(id);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    if (lesson.state !== 'proposed' || lesson.accepted === true) {
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
  } catch (e) {
    return res.status(500).json({ message: 'Error al avalar y abrir convocatoria' });
  }
}

async function listVersiones(req, res) {
  try {
    const Lesson = require('../models/lesson.model');
    const items = await Lesson.find({ state: 'completed', son_lesson: { $exists: true, $ne: null } }).select('title son_lesson');
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ message: 'Error listando versiones' });
  }
}

module.exports = {
  getTasksSummary,
  listConvocatorias,
  listConvocatoriasAbiertas,
  listRecursosPendientes,
  listLeccionesAcademicas,
  listSugerencias,
  avalarYabrirConvocatoria,
  listVersiones
}


