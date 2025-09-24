'use strict';

const AcademicLesson = require('../models/academicLesson.model');
const AcademicGroup = require('../models/academicGroup.model');
const User = require('../models/user.model');

// Crear una nueva lección académica
exports.createLesson = async (req, res) => {
    try {
        const { 
            title, 
            resume, 
            academicGroup, 
            level, 
            objectives, 
            methodology, 
            evaluation, 
            resources, 
            duration, 
            difficulty 
        } = req.body;
        const authorId = req.user.sub || req.user.id;

        // Verificar que el grupo existe
        const group = await AcademicGroup.findById(academicGroup);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar permisos según el rol del usuario
        if (req.user.role === 'student' || req.user.isStudent) {
            // Si es estudiante, verificar que pertenece al grupo y tiene permisos
            if (!group.students.some(sid => sid.toString() === authorId)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No perteneces a este grupo académico'
                });
            }

            // Verificar si el grupo permite que los estudiantes creen lecciones
            if (!group.permissions.studentsCanCreateLessons) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tienes permisos para crear lecciones en este grupo. Contacta al docente para habilitar esta funcionalidad.'
                });
            }
        } else if (req.user.role === 'teacher' || req.user.role === 'admin' || req.user.role === 'facilitator' || req.user.role === 'expert') {
            // Si es docente/admin, verificar que es el docente del grupo o admin
            if (group.teacher.toString() !== authorId && req.user.role !== 'admin') {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tienes permisos para crear lecciones en este grupo'
                });
            }
        } else {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para crear lecciones académicas'
            });
        }

        const lesson = new AcademicLesson({
            title,
            resume,
            academicGroup,
            author: authorId,
            level,
            objectives,
            methodology,
            evaluation,
            resources,
            duration,
            difficulty,
            status: 'draft',
            academicSettings: {
                academicLevel: group.academicLevel,
                grade: group.grade,
                subjects: group.subjects
            }
        });

        const savedLesson = await lesson.save();

        // Actualizar estadísticas del grupo
        await group.updateStatistics();

        // Actualizar estadísticas del usuario
        await User.findByIdAndUpdate(authorId, {
            $inc: { 'academicStatistics.totalLessonsCreated': 1 }
        });

        res.status(201).json({
            status: 'success',
            message: 'Lección académica creada exitosamente',
            data: savedLesson
        });
    } catch (error) {
        console.error('Error al crear lección académica:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener lecciones del grupo
exports.getGroupLessons = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.sub || req.user.id;

        // Verificar que el usuario tiene acceso al grupo
        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        if (group.teacher.toString() !== userId && !group.students.some(sid => sid.toString() === userId)) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para ver las lecciones de este grupo'
            });
        }

        const lessons = await AcademicLesson.find({ academicGroup: groupId })
            .populate('author', 'name email avatar')
            .populate('academicGroup', 'name academicLevel grade')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: lessons
        });
    } catch (error) {
        console.error('Error al obtener lecciones del grupo:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener mis lecciones (para estudiantes)
exports.getMyLessons = async (req, res) => {
    try {
        const authorId = req.user.sub || req.user.id;
        const lessons = await AcademicLesson.find({ author: authorId })
            .populate('academicGroup', 'name academicLevel grade')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: lessons
        });
    } catch (error) {
        console.error('Error al obtener mis lecciones:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener lecciones del docente
exports.getTeacherLessons = async (req, res) => {
    try {
        const teacherId = req.user.sub || req.user.id;
        
        // Obtener grupos del docente
        const groups = await AcademicGroup.find({ teacher: teacherId });
        const groupIds = groups.map(group => group._id);
        
        const lessons = await AcademicLesson.find({ academicGroup: { $in: groupIds } })
            .populate('author', 'name email avatar')
            .populate('academicGroup', 'name academicLevel grade')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: lessons
        });
    } catch (error) {
        console.error('Error al obtener lecciones del docente:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener lección por ID
exports.getLessonById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id)
            .populate('author', 'name email avatar academicProfile')
            .populate('academicGroup', 'name academicLevel grade teacher')
            .populate('teacher', 'name email avatar');

        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar permisos
        const group = await AcademicGroup.findById(lesson.academicGroup);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        if (group.teacher.toString() !== userId && 
            !group.students.some(sid => sid.toString() === userId) && 
            lesson.author.toString() !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para ver esta lección'
            });
        }

        res.status(200).json({
            status: 'success',
            data: lesson
        });
    } catch (error) {
        console.error('Error al obtener lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar lección
exports.updateLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar que el usuario sea el autor de la lección
        if (lesson.author.toString() !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para modificar esta lección'
            });
        }

        // Solo permitir actualización si la lección está en borrador
        if (lesson.status !== 'draft') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden modificar lecciones en borrador'
            });
        }

        const updatedLesson = await AcademicLesson.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('author', 'name email avatar')
         .populate('academicGroup', 'name academicLevel grade');

        res.status(200).json({
            status: 'success',
            message: 'Lección académica actualizada exitosamente',
            data: updatedLesson
        });
    } catch (error) {
        console.error('Error al actualizar lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Eliminar lección
exports.deleteLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar que el usuario sea el autor de la lección
        if (lesson.author.toString() !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para eliminar esta lección'
            });
        }

        // Solo permitir eliminación si la lección está en borrador
        if (lesson.status !== 'draft') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden eliminar lecciones en borrador'
            });
        }

        await AcademicLesson.findByIdAndDelete(id);

        // Actualizar estadísticas del grupo
        const group = await AcademicGroup.findById(lesson.academicGroup);
        if (group) {
            await group.updateStatistics();
        }

        // Actualizar estadísticas del usuario
        await User.findByIdAndUpdate(userId, {
            $inc: { 'academicStatistics.totalLessonsCreated': -1 }
        });

        res.status(200).json({
            status: 'success',
            message: 'Lección académica eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Aprobar lección
exports.approveLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedback, grade } = req.body;
        const teacherId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        const group = await AcademicGroup.findById(lesson.academicGroup);
        if (!group || group.teacher.toString() !== teacherId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para aprobar esta lección'
            });
        }

        // Solo permitir aprobación si la lección está propuesta
        if (lesson.status !== 'proposed') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden aprobar lecciones propuestas'
            });
        }

        lesson.status = 'approved';
        lesson.teacher = teacherId;
        lesson.feedback = feedback;
        lesson.grade = grade;
        lesson.approvedAt = new Date();

        const updatedLesson = await lesson.save();

        res.status(200).json({
            status: 'success',
            message: 'Lección académica aprobada exitosamente',
            data: updatedLesson
        });
    } catch (error) {
        console.error('Error al aprobar lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Rechazar lección
exports.rejectLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const teacherId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        const group = await AcademicGroup.findById(lesson.academicGroup);
        if (!group || group.teacher.toString() !== teacherId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para rechazar esta lección'
            });
        }

        // Solo permitir rechazo si la lección está propuesta
        if (lesson.status !== 'proposed') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden rechazar lecciones propuestas'
            });
        }

        lesson.status = 'rejected';
        lesson.teacher = teacherId;
        lesson.feedback = reason;
        lesson.rejectedAt = new Date();

        const updatedLesson = await lesson.save();

        res.status(200).json({
            status: 'success',
            message: 'Lección académica rechazada',
            data: updatedLesson
        });
    } catch (error) {
        console.error('Error al rechazar lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Calificar lección
exports.gradeLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const { grade, feedback } = req.body;
        const teacherId = req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        const group = await AcademicGroup.findById(lesson.academicGroup);
        if (!group || group.teacher.toString() !== teacherId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para calificar esta lección'
            });
        }

        // Solo permitir calificación si la lección está aprobada
        if (lesson.status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden calificar lecciones aprobadas'
            });
        }

        lesson.grade = grade;
        lesson.feedback = feedback;
        lesson.status = 'graded';
        lesson.gradedAt = new Date();

        const updatedLesson = await lesson.save();

        // Actualizar estadísticas del grupo
        await group.updateStatistics();

        res.status(200).json({
            status: 'success',
            message: 'Lección académica calificada exitosamente',
            data: updatedLesson
        });
    } catch (error) {
        console.error('Error al calificar lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Exportar lección a RedDinámica principal
exports.exportToMain = async (req, res) => {
    try {
        const { id } = req.params;
        const teacherId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        const group = await AcademicGroup.findById(lesson.academicGroup);
        if (!group || group.teacher.toString() !== teacherId) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para exportar esta lección'
            });
        }

        // Solo permitir exportación si la lección está calificada con buena nota
        if (lesson.status !== 'graded' || lesson.grade < 4.0) {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden exportar lecciones calificadas con nota mayor a 4.0'
            });
        }

        // Aquí se implementaría la lógica para crear una lección en RedDinámica principal
        // Por ahora, solo marcamos como exportada
        lesson.isExported = true;
        lesson.exportedAt = new Date();

        const updatedLesson = await lesson.save();

        // Actualizar estadísticas del usuario
        await User.findByIdAndUpdate(lesson.author, {
            $inc: { 'academicStatistics.lessonsExported': 1 }
        });

        res.status(200).json({
            status: 'success',
            message: 'Lección académica exportada exitosamente',
            data: updatedLesson
        });
    } catch (error) {
        console.error('Error al exportar lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};
