'use strict';

const AcademicLesson = require('../models/academicLesson.model');
const AcademicGroup = require('../models/academicGroup.model');
const User = require('../models/user.model');
const Lesson = require('../models/lesson.model');

// Crear una nueva lección académica
exports.createLesson = async (req, res) => {
    try {
        const { 
            title, 
            resume, 
            academicGroup, 
            justification,
            tags,
            knowledge_areas
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
    
        // Verificar permisos basado en membresía del grupo, no en el rol global
        const isGroupStudent = group.students.some(sid => sid.toString() === authorId);
        const isGroupTeacher = group.teacher && group.teacher.toString() === authorId;
        const isAdmin = req.user.role === 'admin';

        if (isGroupStudent) {
            // El usuario es miembro estudiante del grupo: respetar permisos del grupo
            const studentsCanCreate = (group.permissions && typeof group.permissions.studentsCanCreateLessons !== 'undefined')
                ? group.permissions.studentsCanCreateLessons
                : true; // Fallback permisivo
            if (!studentsCanCreate) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tienes permisos para crear lecciones en este grupo. Contacta al docente para habilitar esta funcionalidad.'
                });
            }
        } else if (isGroupTeacher || isAdmin) {
            // Docente del grupo o admin: permitido
        } else {
            // No pertenece al grupo ni es docente/admin
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para crear lecciones en este grupo. Debes pertenecer al grupo o ser su docente.'
            });
        }

        // Determinar el teacher del grupo
        const teacher = await User.findById(group.teacher);
        
        const lesson = new AcademicLesson({
            title,
            resume,
            academicGroup,
            author: authorId,
            teacher: group.teacher,
            leader: authorId, // El creador es el líder por defecto
            justification: {
                methodology: justification?.methodology || '',
                objectives: justification?.objectives || ''
            },
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            // Guardar knowledge_areas como nombres; si vienen ids, resolverlos
            knowledge_areas: Array.isArray(knowledge_areas) ? knowledge_areas : [],
            
            // Nuevos campos inicializados
            files: [],
            conversations: [],
            // level debe reflejar el nivel académico del grupo (no materias)
            level: [group.academicLevel],
            state: 'draft',
            development_group: [{
                user: authorId,
                role: 'leader',
                status: 'active'
            }],
            comments: [],
            
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

        // Populate los datos para la respuesta
        // Si knowledge_areas fueron ids, obtener nombres para almacenarlos como strings
        if (Array.isArray(knowledge_areas) && knowledge_areas.length > 0 && typeof knowledge_areas[0] === 'string') {
            try {
                const KnowledgeArea = require('../models/knowledge-area.model');
                const found = await KnowledgeArea.find({ _id: { $in: knowledge_areas } }, 'name').lean();
                const names = found.map(k => k.name).filter(Boolean);
                if (names.length > 0) {
                    savedLesson.knowledge_areas = names;
                    await savedLesson.save();
                }
            } catch (err) {
                // Continuar sin bloquear la creación si falla la resolución de nombres
            }
        }

        await savedLesson.populate([
            { path: 'author', select: 'name surname email' },
            { path: 'teacher', select: 'name surname email' },
            { path: 'leader', select: 'name surname email' },
            { path: 'development_group.user', select: 'name surname email' }
        ]);

        res.status(201).json({
            status: 'success',
            message: 'Lección académica creada exitosamente. Ahora puedes invitar colaboradores al grupo de desarrollo.',
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

        const isAdmin = req.user && (req.user.role === 'admin' || (Array.isArray(req.user.roles) && req.user.roles.includes('admin')));
        if (!isAdmin && group.teacher.toString() !== userId && !group.students.some(sid => sid.toString() === userId)) {
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
            // Incluir students para que el frontend pueda verificar pertenencia sin llamada extra
            .populate('academicGroup', 'name academicLevel grade teacher students')
            .populate('teacher', 'name email avatar')
            .populate('messages.author', 'name email avatar');

        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar permisos
        const groupId = lesson.academicGroup && lesson.academicGroup._id ? lesson.academicGroup._id : lesson.academicGroup;
        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Permitir acceso a admin global
        const isAdmin = req.user && (req.user.role === 'admin' || (Array.isArray(req.user.roles) && req.user.roles.includes('admin')));
        const lessonAuthorId = lesson.author && lesson.author._id ? lesson.author._id.toString() : lesson.author.toString();
        if (!isAdmin &&
            group.teacher.toString() !== userId && 
            !group.students.some(sid => sid.toString() === userId) && 
            lessonAuthorId !== userId) {
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

// Añadir mensaje de chat a la lección académica
exports.addChatMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.sub || req.user.id;

        if (!content || !String(content).trim()) {
            return res.status(400).json({ status: 'error', message: 'Contenido del mensaje requerido' });
        }

        const lesson = await AcademicLesson.findById(id).populate('academicGroup', 'teacher students');
        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });
        }

        // Verificación de permisos: autor, docente del grupo, estudiante del grupo o miembro del equipo de desarrollo
        const group = lesson.academicGroup;
        const isAuthor = lesson.author && lesson.author.toString() === userId;
        const isTeacher = group && group.teacher && group.teacher.toString() === userId;
        const isStudent = group && Array.isArray(group.students) && group.students.some(sid => sid.toString() === userId);
        const isDevMember = Array.isArray(lesson.development_group) && lesson.development_group.some(m => (m.user || m).toString() === userId);

        if (!(isAuthor || isTeacher || isStudent || isDevMember)) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para enviar mensajes en esta lección' });
        }

        lesson.messages.push({ content: String(content), author: userId });
        await lesson.save();

        const updated = await AcademicLesson.findById(id)
            .populate('author', 'name email avatar academicProfile')
            .populate('academicGroup', 'name academicLevel grade teacher students')
            .populate('teacher', 'name email avatar')
            .populate('messages.author', 'name email avatar');

        return res.status(200).json({ status: 'success', message: 'Mensaje enviado', data: updated });
    } catch (error) {
        console.error('Error al enviar mensaje de chat:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
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

// Agregar miembro al grupo de desarrollo
exports.addToDevelopmentGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role = 'collaborator' } = req.body;
        const requesterId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección no encontrada'
            });
        }

        // Verificar permisos (solo el líder o profesor puede agregar miembros)
        const isLeader = lesson.leader.toString() === requesterId;
        const isTeacher = lesson.teacher.toString() === requesterId;
        
        if (!isLeader && !isTeacher && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Solo el líder de la lección o el profesor pueden agregar miembros'
            });
        }

        // Verificar que el usuario no esté ya en el grupo
        const existingMember = lesson.development_group.find(
            member => member.user.toString() === userId
        );

        if (existingMember) {
            return res.status(400).json({
                status: 'error',
                message: 'El usuario ya es miembro del grupo de desarrollo'
            });
        }

        // Agregar al grupo
        lesson.development_group.push({
            user: userId,
            role: role,
            status: 'active'
        });

        await lesson.save();
        await lesson.populate('development_group.user', 'name surname email');

        res.status(200).json({
            status: 'success',
            message: 'Miembro agregado al grupo de desarrollo exitosamente',
            data: lesson.development_group
        });

    } catch (error) {
        console.error('Error al agregar miembro al grupo de desarrollo:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar estado de la lección (solo el líder puede hacerlo)
exports.updateLessonState = async (req, res) => {
    try {
        const { id } = req.params;
        const { state, message } = req.body;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id)
            .populate('author', 'name surname')
            .populate('leader', 'name surname')
            .populate('teacher', 'name surname')
            .populate('development_group.user', 'name surname');
            
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección no encontrada'
            });
        }

        // Verificar que el usuario sea el líder
        if (lesson.leader._id.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Solo el líder de la lección puede cambiar su estado'
            });
        }

        const validStates = ['draft', 'in_development', 'review_requested', 'under_review', 'approved', 'rejected', 'completed', 'ready_for_migration'];
        if (!validStates.includes(state)) {
            return res.status(400).json({
                status: 'error',
                message: 'Estado inválido'
            });
        }

        const oldState = lesson.state;
        lesson.state = state;
        
        // Si hay un mensaje, agregarlo como comentario del sistema
        if (message) {
            lesson.comments.push({
                content: `Estado cambiado a "${state}": ${message}`,
                author: userId,
                type: 'feedback',
                isFromTeacher: false
            });
        }

        await lesson.save();

        // Enviar notificaciones a todos los miembros del grupo de desarrollo y al profesor
        try {
            const participants = new Set();
            
            // Agregar autor
            if (lesson.author) participants.add(lesson.author._id.toString());
            
            // Agregar líder (si es diferente del autor)
            if (lesson.leader && lesson.leader._id.toString() !== userId) {
                participants.add(lesson.leader._id.toString());
            }
            
            // Agregar profesor
            if (lesson.teacher) participants.add(lesson.teacher._id.toString());
            
            // Agregar miembros del grupo de desarrollo
            if (lesson.development_group && lesson.development_group.length > 0) {
                lesson.development_group.forEach(member => {
                    if (member.user && member.user._id) {
                        participants.add(member.user._id.toString());
                    }
                });
            }

            // Filtrar al usuario que hizo el cambio
            participants.delete(userId);

            const participantIds = Array.from(participants);

            // Crear notificaciones usando el servicio de notificaciones
            if (participantIds.length > 0 && oldState !== state) {
                const NotificationService = require('../services/notification.service');
                const User = require('../models/user.model');
                const currentUser = await User.findById(userId).select('name surname');
                
                await NotificationService.createLessonStateChangeNotification(
                    currentUser,
                    participantIds,
                    lesson._id,
                    lesson.title,
                    oldState,
                    state,
                    message || ''
                ).catch(err => console.error('Error creating academic lesson state change notification:', err));
            }
        } catch (notificationError) {
            console.error('Error enviando notificaciones de cambio de estado:', notificationError);
            // No fallar la operación principal por errores de notificación
        }

        res.status(200).json({
            status: 'success',
            message: `Estado de la lección actualizado a: ${state}`,
            data: { state: lesson.state, comments: lesson.comments }
        });

    } catch (error) {
        console.error('Error al actualizar estado de la lección:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Agregar comentario del profesor
exports.addTeacherComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, type = 'feedback' } = req.body;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id)
            .populate('author', 'name surname')
            .populate('leader', 'name surname')
            .populate('teacher', 'name surname')
            .populate('development_group.user', 'name surname');
            
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección no encontrada'
            });
        }

        // Verificar que el usuario sea el profesor del grupo
        if (lesson.teacher._id.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Solo el profesor puede agregar comentarios'
            });
        }

        lesson.comments.push({
            content,
            author: userId,
            type,
            isFromTeacher: true
        });

        await lesson.save();
        await lesson.populate('comments.author', 'name surname email');

        // Enviar notificaciones a todos los miembros del grupo de desarrollo
        try {
            const participants = new Set();
            
            // Agregar autor
            if (lesson.author) participants.add(lesson.author._id.toString());
            
            // Agregar líder
            if (lesson.leader) participants.add(lesson.leader._id.toString());
            
            // Agregar miembros del grupo de desarrollo
            if (lesson.development_group && lesson.development_group.length > 0) {
                lesson.development_group.forEach(member => {
                    if (member.user && member.user._id) {
                        participants.add(member.user._id.toString());
                    }
                });
            }

            const participantIds = Array.from(participants);

            // Crear notificaciones usando el servicio de notificaciones
            if (participantIds.length > 0) {
                const NotificationService = require('../services/notification.service');
                await NotificationService.createLessonMessageNotification(
                    lesson.teacher,
                    participantIds,
                    lesson._id,
                    lesson.title,
                    content
                ).catch(err => console.error('Error creating teacher comment notification:', err));
            }
        } catch (notificationError) {
            console.error('Error enviando notificaciones de comentario del profesor:', notificationError);
            // No fallar la operación principal por errores de notificación
        }

        res.status(200).json({
            status: 'success',
            message: 'Comentario agregado exitosamente',
            data: lesson.comments
        });

    } catch (error) {
        console.error('Error al agregar comentario:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Mover lección académica a RedDinámica (solo admin o lesson_manager)
exports.moveToRedDinamica = async (req, res) => {
    try {
        const { id } = req.params;
        const al = await AcademicLesson.findById(id);
        if (!al) {
            return res.status(404).send({ message: 'Academic lesson not found' });
        }

        if (al.state !== 'ready_for_migration' || al.isExported) {
            return res.status(400).send({ message: 'Academic lesson not ready for migration' });
        }

        const lesson = new Lesson({
            title: al.title,
            resume: al.resume,
            references: '',
            justification: '',
            development_level: '',
            level: al.level,
            state: 'draft',
            type: 'academic',
            author: al.author,
            leader: al.leader,
            created_at: new Date().toISOString(),
            visible: false,
            accepted: false,
            knowledge_area: [],
            views: 0,
            score: 0,
            version: 1
        });
        await lesson.save();

        al.isExported = true;
        al.exportedLesson = lesson._id;
        await al.save();

        return res.status(200).send({ ok: true, lessonId: lesson._id });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ message: 'Error moving lesson to RedDinámica' });
    }
};
