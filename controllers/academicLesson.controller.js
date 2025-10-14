'use strict';

const AcademicLesson = require('../models/academicLesson.model');
const AcademicGroup = require('../models/academicGroup.model');
const User = require('../models/user.model');
const Lesson = require('../models/lesson.model');
const NotificationService = require('../services/notification.service');
const path = require('path');

// Crear una nueva lección académica
exports.createLesson = async (req, res) => {
    try {
        const { 
            title, 
            resume, 
            academicGroup, 
            justification,
            references,
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
            references: references,
            status: 'draft',
            academicSettings: {
                academicLevel: group.academicLevel,
                grade: group.grade,
                subjects: group.subjects
            }
        });

        const savedLesson = await lesson.save();

        // Asociar la lección al grupo (array lessons) y actualizar estadísticas
        const updatedGroup = await AcademicGroup.findByIdAndUpdate(
            academicGroup,
            { $addToSet: { lessons: savedLesson._id } },
            { new: true }
        );
        if (updatedGroup && typeof updatedGroup.updateStatistics === 'function') {
            await updatedGroup.updateStatistics();
        } else if (group && typeof group.updateStatistics === 'function') {
            // Fallback si no se retornó el documento actualizado
            await group.updateStatistics();
        }

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
            // Incluir students con populate anidado para obtener datos completos
            .populate({
                path: 'academicGroup',
                select: 'name academicLevel grade teacher students',
                populate: {
                    path: 'students',
                    select: 'name surname email avatar'
                }
            })
            .populate('teacher', 'name email avatar')
            .populate('messages.author', 'name email avatar picture')
            .populate('conversations.messages.author', 'name email avatar picture')
            .populate('development_group.user', 'name surname email avatar')
            .populate('comments.author', 'name surname email avatar')
            .populate('files.uploadedBy', 'name surname email avatar');

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

// Editar mensaje del chat principal (autor dentro de 30 minutos)
exports.updateChatMessage = async (req, res) => {
    try {
        const { id, messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });
        const msg = (lesson.messages || []).id(messageId);
        if (!msg) return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado' });
        if (msg.author.toString() !== userId) return res.status(403).json({ status: 'error', message: 'Solo el autor puede editar' });

        const THIRTY_MIN = 30 * 60 * 1000;
        const createdAt = msg.timestamp || msg.createdAt || new Date();
        if (Date.now() - new Date(createdAt).getTime() > THIRTY_MIN) {
            return res.status(403).json({ status: 'error', message: 'El tiempo para editar ha expirado' });
        }
        msg.content = String(content || msg.content);
        msg.edited = true;
        msg.editedAt = new Date();
        await lesson.save();
        const updated = await AcademicLesson.findById(id).populate('messages.author', 'name email avatar picture');
        return res.status(200).json({ status: 'success', message: 'Mensaje actualizado', data: updated });
    } catch (error) {
        console.error('Error editando mensaje de chat:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Borrar mensaje del chat principal (autor dentro de 30 minutos)
exports.deleteChatMessage = async (req, res) => {
    try {
        const { id, messageId } = req.params;
        const userId = req.user.sub || req.user.id;
        const lesson = await AcademicLesson.findById(id);
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });
        const msg = (lesson.messages || []).id(messageId);
        if (!msg) return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado' });
        if (msg.author.toString() !== userId) return res.status(403).json({ status: 'error', message: 'Solo el autor puede eliminar' });

        const THIRTY_MIN = 30 * 60 * 1000;
        const createdAt = msg.timestamp || msg.createdAt || new Date();
        if (Date.now() - new Date(createdAt).getTime() > THIRTY_MIN) {
            return res.status(403).json({ status: 'error', message: 'El tiempo para eliminar ha expirado' });
        }
        msg.remove();
        await lesson.save();
        const updated = await AcademicLesson.findById(id).populate('messages.author', 'name email avatar picture');
        return res.status(200).json({ status: 'success', message: 'Mensaje eliminado', data: updated });
    } catch (error) {
        console.error('Error eliminando mensaje de chat:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Subir archivo/recurso a la lección (solo líder)
exports.uploadLessonResource = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;
        const file = req.file;

        if (!file) return res.status(400).json({ status: 'error', message: 'Archivo requerido' });

        const lesson = await AcademicLesson.findById(id).populate('leader', '_id');
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección no encontrada' });

        const isLeader = lesson.leader && lesson.leader._id && lesson.leader._id.toString() === userId;
        const isAdmin = req.user && (req.user.role === 'admin' || (Array.isArray(req.user.roles) && req.user.roles.includes('admin')));
        if (!(isLeader || isAdmin)) return res.status(403).json({ status: 'error', message: 'Solo el líder puede subir archivos' });

        lesson.files.push({
            name: file.filename,
            originalName: file.originalname,
            fileName: file.filename,
            groupTitle: file.filename,
            path: file.path || path.join('uploads/lessons/', file.filename),
            size: file.size,
            mimeType: file.mimetype,
            uploadedBy: userId
        });
        await lesson.save();

        const updated = await AcademicLesson.findById(id).populate('files.uploadedBy', 'name surname email avatar');
        return res.status(200).json({ status: 'success', message: 'Archivo subido', data: updated });
    } catch (error) {
        console.error('Error subiendo recurso:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Eliminar archivo (solo líder)
exports.deleteLessonResource = async (req, res) => {
    try {
        const { id, fileId } = req.params;
        const userId = req.user.sub || req.user.id;
        const lesson = await AcademicLesson.findById(id).populate('leader', '_id');
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección no encontrada' });
        const isLeader = lesson.leader && lesson.leader._id && lesson.leader._id.toString() === userId;
        const isAdmin = req.user && (req.user.role === 'admin' || (Array.isArray(req.user.roles) && req.user.roles.includes('admin')));
        if (!(isLeader || isAdmin)) return res.status(403).json({ status: 'error', message: 'Solo el líder puede eliminar archivos' });

        const before = lesson.files.length;
        lesson.files = (lesson.files || []).filter(f => f._id.toString() !== fileId);
        if (lesson.files.length === before) return res.status(404).json({ status: 'error', message: 'Archivo no encontrado' });
        await lesson.save();
        const updated = await AcademicLesson.findById(id).populate('files.uploadedBy', 'name surname email avatar');
        return res.status(200).json({ status: 'success', message: 'Archivo eliminado', data: updated });
    } catch (error) {
        console.error('Error eliminando recurso:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Actualizar metadatos de archivo (nombre/descr) - simple
exports.updateLessonResource = async (req, res) => {
    try {
        const { id, fileId } = req.params;
        const { originalName } = req.body;
        const userId = req.user.sub || req.user.id;
        const lesson = await AcademicLesson.findById(id).populate('leader', '_id');
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección no encontrada' });
        const isLeader = lesson.leader && lesson.leader._id && lesson.leader._id.toString() === userId;
        const isAdmin = req.user && (req.user.role === 'admin' || (Array.isArray(req.user.roles) && req.user.roles.includes('admin')));
        if (!(isLeader || isAdmin)) return res.status(403).json({ status: 'error', message: 'Solo el líder puede actualizar archivos' });

        const file = (lesson.files || []).id(fileId);
        if (!file) return res.status(404).json({ status: 'error', message: 'Archivo no encontrado' });
        if (originalName) file.originalName = String(originalName);
        await lesson.save();
        const updated = await AcademicLesson.findById(id).populate('files.uploadedBy', 'name surname email avatar');
        return res.status(200).json({ status: 'success', message: 'Archivo actualizado', data: updated });
    } catch (error) {
        console.error('Error actualizando recurso:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};
// Crear conversación del equipo (solo líder o admin)
exports.createConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        const userId = req.user.sub || req.user.id;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ status: 'error', message: 'Título requerido' });
        }

        const lesson = await AcademicLesson.findById(id).populate('leader');
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });

        const isLeader = lesson.leader && lesson.leader._id && lesson.leader._id.toString() === userId;
        const isAdmin = req.user && (req.user.role === 'admin' || (Array.isArray(req.user.roles) && req.user.roles.includes('admin')));
        if (!(isLeader || isAdmin)) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para crear conversaciones' });
        }

        const newConversation = { title: String(title).trim(), participants: [], messages: [] };
        lesson.conversations.push(newConversation);
        await lesson.save();

        const created = lesson.conversations[lesson.conversations.length - 1];
        const updated = await AcademicLesson.findById(id)
            .populate('conversations.messages.author', 'name email avatar picture');

        return res.status(200).json({ status: 'success', message: 'Conversación creada', data: { conversationId: created._id, lesson: updated } });
    } catch (error) {
        console.error('Error creando conversación:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Agregar mensaje a una conversación
exports.addConversationMessage = async (req, res) => {
    try {
        const { id, conversationId } = req.params;
        const { content } = req.body;
        const userId = req.user.sub || req.user.id;

        if (!content || !String(content).trim()) {
            return res.status(400).json({ status: 'error', message: 'Contenido del mensaje requerido' });
        }

        const lesson = await AcademicLesson.findById(id).populate('academicGroup', 'teacher students');
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });

        // Permisos iguales al chat simple
        const group = lesson.academicGroup;
        const isAuthor = lesson.author && lesson.author.toString() === userId;
        const isTeacher = group && group.teacher && group.teacher.toString() === userId;
        const isStudent = group && Array.isArray(group.students) && group.students.some(s => s.toString() === userId);
        const isDevMember = Array.isArray(lesson.development_group) && lesson.development_group.some(m => (m.user || m).toString() === userId);
        if (!(isAuthor || isTeacher || isStudent || isDevMember)) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para enviar mensajes' });
        }

        const conv = (lesson.conversations || []).id(conversationId);
        if (!conv) return res.status(404).json({ status: 'error', message: 'Conversación no encontrada' });

        conv.messages.push({ content: String(content), author: userId });
        await lesson.save();

        const updated = await AcademicLesson.findById(id)
            .populate('conversations.messages.author', 'name email avatar picture');
        return res.status(200).json({ status: 'success', message: 'Mensaje enviado', data: updated });
    } catch (error) {
        console.error('Error agregando mensaje a conversación:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Editar mensaje de una conversación (autor dentro de 30 minutos)
exports.updateConversationMessage = async (req, res) => {
    try {
        const { id, conversationId, messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });
        const conv = (lesson.conversations || []).id(conversationId);
        if (!conv) return res.status(404).json({ status: 'error', message: 'Conversación no encontrada' });
        const msg = (conv.messages || []).id(messageId);
        if (!msg) return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado' });

        if (msg.author.toString() !== userId) {
            return res.status(403).json({ status: 'error', message: 'Solo el autor puede editar este mensaje' });
        }

        const THIRTY_MIN = 30 * 60 * 1000;
        const createdAt = msg.timestamp || msg.createdAt || new Date();
        if (Date.now() - new Date(createdAt).getTime() > THIRTY_MIN) {
            return res.status(403).json({ status: 'error', message: 'El tiempo para editar ha expirado' });
        }

        msg.content = String(content || msg.content);
        msg.edited = true;
        msg.editedAt = new Date();
        await lesson.save();

        const updated = await AcademicLesson.findById(id)
            .populate('conversations.messages.author', 'name email avatar picture');
        return res.status(200).json({ status: 'success', message: 'Mensaje actualizado', data: updated });
    } catch (error) {
        console.error('Error actualizando mensaje:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Eliminar mensaje de una conversación (autor dentro de 30 minutos)
exports.deleteConversationMessage = async (req, res) => {
    try {
        const { id, conversationId, messageId } = req.params;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) return res.status(404).json({ status: 'error', message: 'Lección académica no encontrada' });
        const conv = (lesson.conversations || []).id(conversationId);
        if (!conv) return res.status(404).json({ status: 'error', message: 'Conversación no encontrada' });
        const msg = (conv.messages || []).id(messageId);
        if (!msg) return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado' });

        if (msg.author.toString() !== userId) {
            return res.status(403).json({ status: 'error', message: 'Solo el autor puede eliminar este mensaje' });
        }

        const THIRTY_MIN = 30 * 60 * 1000;
        const createdAt = msg.timestamp || msg.createdAt || new Date();
        if (Date.now() - new Date(createdAt).getTime() > THIRTY_MIN) {
            return res.status(403).json({ status: 'error', message: 'El tiempo para eliminar ha expirado' });
        }

        msg.remove();
        await lesson.save();

        const updated = await AcademicLesson.findById(id)
            .populate('conversations.messages.author', 'name email avatar picture');
        return res.status(200).json({ status: 'success', message: 'Mensaje eliminado', data: updated });
    } catch (error) {
        console.error('Error eliminando mensaje:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};
// Actualizar lección
exports.updateLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id)
            .populate('author', 'name surname email avatar')
            .populate('teacher', 'name surname email')
            .populate('leader', 'name surname')
            .populate('development_group.user', 'name surname');
            
        if (!lesson) {
            return res.status(404).json({
                status: 'error',
                message: 'Lección académica no encontrada'
            });
        }

        // Verificar permisos - el líder puede editar la lección
        const isLeader = lesson.leader && lesson.leader._id.toString() === userId;
        const isAuthor = lesson.author && lesson.author._id.toString() === userId;
        
        if (!isLeader && !isAuthor && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para modificar esta lección'
            });
        }

        // Capturar el estado anterior para notificaciones
        const oldStatus = lesson.status;
        const newStatus = updateData.status || oldStatus;

        // Validaciones según el estado
        // Solo permitir actualización de campos si está en draft, approved o in_development
        if (oldStatus !== 'draft' && oldStatus !== 'rejected' && oldStatus !== 'in_development' && oldStatus !== 'proposed') {
            // Si está en otro estado, solo permitir cambio de estado específico
            if (updateData.status && updateData.status !== oldStatus) {
                return res.status(400).json({
                    status: 'error',
                    message: `No se puede cambiar el estado desde ${oldStatus}`
                });
            }
        }

        // Actualizar datos
        Object.keys(updateData).forEach(key => {
            if (key !== '_id' && key !== 'author' && key !== 'teacher' && key !== 'createdAt') {
                lesson[key] = updateData[key];
            }
        });

        // Si está cambiando de draft a proposed, notificar al profesor
        if (oldStatus === 'draft' && newStatus === 'proposed') {
            lesson.status = 'proposed';
            lesson.state = 'proposed';
            await lesson.save();
            
            // Notificar al profesor
            try {
                if (lesson.teacher && lesson.teacher._id) {
                    await NotificationService.createSystemNotification(
                        [lesson.teacher._id],
                        'Nueva lección propuesta para revisión',
                        `${lesson.author.name} ${lesson.author.surname} ha propuesto la lección "${lesson.title}" para tu revisión`,
                        `/academia/lessons/${lesson._id}`,
                        'high'
                    );
                }
            } catch (notifError) {
                console.error('Error enviando notificación al profesor:', notifError);
            }
        }

        // Si está cambiando a completed, notificar al profesor para calificar
        if (newStatus === 'completed' && oldStatus !== 'completed') {
            lesson.status = 'completed';
            lesson.state = 'completed';
            await lesson.save();
            
            // Notificar al profesor
            try {
                if (lesson.teacher && lesson.teacher._id) {
                    await NotificationService.createSystemNotification(
                        [lesson.teacher._id],
                        'Lección completada lista para calificar',
                        `La lección "${lesson.title}" ha sido marcada como completada y está lista para tu calificación`,
                        `/academia/lessons/${lesson._id}`,
                        'high'
                    );
                }
            } catch (notifError) {
                console.error('Error enviando notificación al profesor:', notifError);
            }

            // Notificar a admins y lesson_managers que una nueva lección está completada
            try {
                const admins = await User.find({ 
                    $or: [
                        { role: 'admin' },
                        { role: 'delegated_admin' },
                        { role: 'lesson_manager' }
                    ]
                }).select('_id');

                const adminIds = admins.map(admin => admin._id.toString());
                
                if (adminIds.length > 0) {
                    await NotificationService.createSystemNotification(
                        adminIds,
                        '✅ Nueva lección académica completada',
                        `La lección académica "${lesson.title}" ha sido completada por el estudiante y está lista para revisión del profesor. Podrás visualizarla desde el panel de administración una vez sea calificada.`,
                        `/academia/lessons/${lesson._id}`,
                        'high'
                    );
                    console.log('✅ Notificaciones enviadas a administradores y lesson managers sobre lección completada');
                }
            } catch (notifError) {
                console.error('Error enviando notificación a administradores:', notifError);
            }
        }

        await lesson.save();

        const updatedLesson = await AcademicLesson.findById(id)
            .populate('author', 'name email avatar')
            .populate('academicGroup', 'name academicLevel grade')
            .populate('teacher', 'name email avatar')
            .populate('leader', 'name surname')
            .populate('development_group.user', 'name surname email');

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
       
        //if the request comes from the teacher from lesson continue else error
        if (lesson.teacher.toString() !== userId) {
                if (lesson.status !== 'draft') {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Solo se pueden eliminar lecciones en borrador'
                    });
            }
            else {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para eliminar esta lección'
                });
            }
        }
        await AcademicLesson.findByIdAndDelete(id);

        // Quitar referencia del grupo y actualizar estadísticas
        const group = await AcademicGroup.findByIdAndUpdate(
            lesson.academicGroup,
            { $pull: { lessons: lesson._id } },
            { new: true }
        );
        if (group && typeof group.updateStatistics === 'function') {
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

        // Al aprobar, pasa directamente a in_development para comenzar
        lesson.status = 'in_development';
        lesson.state = 'in_development';
        lesson.teacher = teacherId;
        lesson.feedback = feedback;
        lesson.approvedAt = new Date();

        // Registrar feedback del docente como comentario en la lección
        if (feedback && String(feedback).trim()) {
            try {
                lesson.comments.push({
                    content: String(feedback).trim(),
                    author: teacherId,
                    type: 'feedback',
                    isFromTeacher: true
                });
            } catch {}
        }

        const updatedLesson = await lesson.save();

        // Notificar al equipo sobre la aprobación
        try {
            const participants = new Set();
            if (lesson.author) participants.add(lesson.author.toString());
            const refreshed = await AcademicLesson.findById(id).populate('leader development_group.user', '_id');
            if (refreshed?.leader) participants.add(refreshed.leader._id.toString());
            if (Array.isArray(refreshed?.development_group)) {
                refreshed.development_group.forEach(m => m?.user?._id && participants.add(m.user._id.toString()));
            }
            const uniqueParticipants = [...new Set(Array.from(participants))].filter(p => !!p);
            
            if (uniqueParticipants.length > 0) {
                const teacher = await User.findById(teacherId).select('name surname');
                await NotificationService.createSystemNotification(
                    uniqueParticipants,
                    '¡Lección aprobada y en desarrollo!',
                    `Tu lección "${lesson.title}" fue aprobada y pasó automáticamente a desarrollo. ${feedback ? 'Comentarios: ' + feedback : ''}`,
                    `/academia/lessons/${lesson._id}`,
                    'high'
                ).catch(err => console.error('Error creating approval notification:', err));
            }
        } catch (notifError) {
            console.error('Error enviando notificaciones de aprobación:', notifError);
        }

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

        // Rechazar vuelve a borrador
        lesson.status = 'draft';
        lesson.state = 'draft';
        lesson.teacher = teacherId;
        lesson.feedback = reason;
        lesson.rejectedAt = new Date();

        const updatedLesson = await lesson.save();

        // Notificar al equipo sobre el rechazo
        try {
            const participants = new Set();
            if (lesson.author) participants.add(lesson.author.toString());
            const refreshed = await AcademicLesson.findById(id).populate('leader development_group.user', '_id');
            if (refreshed?.leader) participants.add(refreshed.leader._id.toString());
            if (Array.isArray(refreshed?.development_group)) {
                refreshed.development_group.forEach(m => m?.user?._id && participants.add(m.user._id.toString()));
            }
            const uniqueParticipants = [...new Set(Array.from(participants))].filter(p => !!p);
            
            if (uniqueParticipants.length > 0) {
                const teacher = await User.findById(teacherId).select('name surname');
                await NotificationService.createSystemNotification(
                    uniqueParticipants,
                    'Lección rechazada',
                    `Tu lección "${lesson.title}" ha sido rechazada. Motivo: ${reason || 'No especificado'}. Puedes editarla y volver a proponerla.`,
                    `/academia/lessons/${lesson._id}`,
                    'high'
                ).catch(err => console.error('Error creating rejection notification:', err));
            }
        } catch (notifError) {
            console.error('Error enviando notificaciones de rechazo:', notifError);
        }

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
                message: 'No tienes permisos para calificar esta lección'
            });
        }

        // Solo permitir calificación si la lección está completada
        if (lesson.status !== 'completed') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se pueden calificar lecciones completadas'
            });
        }

        lesson.grade = grade;
        lesson.feedback = feedback;
        lesson.status = 'graded';
        lesson.gradedAt = new Date();


        // Notificar a estudiantes (autor, equipo) que la lección fue calificada
        try {
            const refreshed = await AcademicLesson.findById(id).populate('author leader teacher development_group.user', '_id name surname');
            const participants = new Set();
            if (refreshed?.author?._id) participants.add(refreshed.author._id.toString());
            if (refreshed?.leader?._id) participants.add(refreshed.leader._id.toString());
            if (Array.isArray(refreshed?.development_group)) {
                refreshed.development_group.forEach(m => m?.user?._id && participants.add(m.user._id.toString()));
            }
            const NotificationService = require('../services/notification.service');
            await NotificationService.createLessonStateChangeNotification(
                { _id: group.teacher, name: 'Teacher', surname: '' },
                Array.from(participants),
                lesson._id,
                lesson.title,
                'completed',
                'graded',
                feedback || ''
            ).catch(() => {});
        } catch {}

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

// Agregar miembro al grupo de desarrollo
exports.addToDevelopmentGroup = async (req, res) => {
    try {
        const { id } = req.params;
        let { userId, userEmail } = req.body;
        // Forzar rol colaborador (revisor siempre será el docente)
        const role = 'collaborator';
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
        
        if (!isLeader && !isTeacher && (req.user.role !== 'admin' || req.user.role !== 'lesson_manager' || req.user.role !== 'delegated_admin')) {
            return res.status(403).json({
                status: 'error',
                message: 'Solo el líder de la lección o el profesor pueden agregar miembros'
            });
        }

        // Permitir búsqueda por email si no llega userId
        if (!userId && userEmail) {
            const found = await User.findOne({ email: String(userEmail).toLowerCase() }).select('_id');
            if (found) userId = found._id.toString();
        }
        if (!userId) {
            return res.status(400).json({ status: 'error', message: 'userId requerido' });
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
        lesson.development_group.push({ user: userId, role, status: 'active' });

        await lesson.save();
        await lesson.populate('development_group.user', 'name surname email');

        // Notificar al usuario invitado
        try {
            await NotificationService.createSystemNotification(
                [userId],
                'Invitación a colaborar en una lección',
                `Has sido agregado al equipo de la lección "${lesson.title}"`,
                `/academia/lessons/${lesson._id}`,
                'medium'
            );
        } catch (e) {
            // No romper flujo por error de notificación
            console.warn('No se pudo crear la notificación de invitación:', e?.message || e);
        }

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

// Permitir que un miembro abandone el equipo de desarrollo
exports.leaveDevelopmentGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id);
        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lección no encontrada' });
        }

        // El líder no puede abandonar usando esta ruta
        if (lesson.leader && lesson.leader.toString() === userId) {
            return res.status(400).json({ status: 'error', message: 'El líder no puede abandonar el equipo' });
        }

        const initialLength = Array.isArray(lesson.development_group) ? lesson.development_group.length : 0;
        lesson.development_group = (lesson.development_group || []).filter(m => (m.user || m).toString() !== userId);

        if (lesson.development_group.length === initialLength) {
            return res.status(400).json({ status: 'error', message: 'No perteneces al equipo de desarrollo' });
        }

        await lesson.save();
        await lesson.populate('development_group.user', 'name surname email');

        return res.status(200).json({ status: 'success', message: 'Has salido del equipo de desarrollo', data: lesson.development_group });
    } catch (error) {
        console.error('Error al salir del equipo de desarrollo:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
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

        const validStates = ['draft', 'proposed', 'in_development', 'review_requested', 'under_review', 'approved', 'rejected', 'completed', 'ready_for_migration'];
        if (!validStates.includes(state)) {
            return res.status(400).json({
                status: 'error',
                message: 'Estado inválido'
            });
        }

        const oldState = lesson.state;
        lesson.state = state;
        // Mantener status alineado cuando aplique
        const statusStates = ['draft', 'proposed', 'in_development', 'completed', 'graded', 'ready_for_migration', 'approved', 'rejected'];
        if (statusStates.includes(state)) {
            lesson.status = state;
        }
        
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
        console.log("debugging",req.body);
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

// Eliminar comentario del profesor (autor del comentario o admin)
exports.deleteTeacherComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.sub || req.user.id;

        const lesson = await AcademicLesson.findById(id).populate('comments.author', '_id name surname email role');
        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lección no encontrada' });
        }

        const comment = lesson.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ status: 'error', message: 'Comentario no encontrado' });
        }

        const isAuthor = comment.author && comment.author._id ? comment.author._id.toString() === String(userId) : String(comment.author) === String(userId);
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'lesson_manager');
        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para eliminar este comentario' });
        }

        // Eliminar usando pull para evitar problemas con versiones de Mongoose
        lesson.comments.pull({ _id: commentId });
        await lesson.save();
        await lesson.populate('comments.author', '_id name surname email');

        return res.status(200).json({ status: 'success', message: 'Comentario eliminado', data: lesson.comments });
    } catch (error) {
        console.error('Error al eliminar comentario del profesor:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: error.message });
    }
};

// Mover lección académica a RedDinámica (solo admin o lesson_manager)
exports.moveToRedDinamica = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔵 [moveToRedDinamica] Intentando mover lección académica ID:', id);
        
        const al = await AcademicLesson.findById(id)
            .populate('author', '_id name surname email picture')
            .populate('leader', '_id name surname email picture')
            .populate('teacher', '_id name surname email picture')
            .populate('knowledge_areas', '_id name')
            .populate('development_group.user', '_id name surname email picture')
            .populate('files.uploadedBy', '_id name surname email');
        
        if (!al) {
            console.error('❌ [moveToRedDinamica] Lección académica no encontrada');
            return res.status(404).json({ message: 'Academic lesson not found' });
        }

        console.log('📌 [moveToRedDinamica] Lección encontrada:', {
            title: al.title,
            state: al.state,
            isExported: al.isExported,
            author: al.author?._id,
            leader: al.leader?._id,
            teacher: al.teacher?._id
        });

        if (al.state !== 'ready_for_migration' || al.isExported) {
            console.error('❌ [moveToRedDinamica] Lección no está lista para migrar');
            return res.status(400).json({ message: 'Academic lesson not ready for migration' });
        }

        // Mapear archivos
        const mappedFiles = Array.isArray(al.files) ? al.files.map(f => ({
            originalName: f.originalName || f.name,
            mimetype: f.mimeType,
            size: f.size,
            groupTitle: f.groupTitle,
            fileName: f.name,
            created_at: new Date()
        })) : [];

        console.log('📁 [moveToRedDinamica] Archivos mapeados:', mappedFiles.length);

        // Mapear áreas de conocimiento - buscar ObjectIds por nombre si es necesario
        let knowledgeAreaIds = [];
        if (Array.isArray(al.knowledge_areas) && al.knowledge_areas.length > 0) {
            const KnowledgeArea = require('../models/knowledge-area.model');
            
            // Separar ObjectIds ya válidos de strings (nombres)
            const validIds = [];
            const nameStrings = [];
            
            for (const ka of al.knowledge_areas) {
                if (ka && ka._id) {
                    // Ya es un objeto con _id
                    validIds.push(ka._id);
                } else if (typeof ka === 'string') {
                    // Es un string, puede ser un nombre o un ObjectId en string
                    try {
                        // Intentar validar si es un ObjectId válido
                        const mongoose = require('mongoose');
                        if (mongoose.Types.ObjectId.isValid(ka) && String(new mongoose.Types.ObjectId(ka)) === ka) {
                            validIds.push(ka);
                        } else {
                            // Es un nombre, buscar el ID
                            nameStrings.push(ka);
                        }
                    } catch {
                        // Es un nombre
                        nameStrings.push(ka);
                    }
                }
            }
            
            // Buscar ObjectIds para los nombres
            if (nameStrings.length > 0) {
                const foundAreas = await KnowledgeArea.find({ 
                    name: { $in: nameStrings } 
                }).select('_id name');
                
                console.log('🔍 [moveToRedDinamica] Áreas encontradas por nombre:', foundAreas.map(a => ({ id: a._id, name: a.name })));
                
                foundAreas.forEach(area => {
                    validIds.push(area._id);
                });
            }
            
            knowledgeAreaIds = validIds;
        }

        console.log('🎓 [moveToRedDinamica] Knowledge area IDs finales:', knowledgeAreaIds);

        // Mapear niveles académicos: Colegio -> [Secundaria, Bachillerato], Universidad -> [Universitario]
        let mappedLevels = [];
        if (Array.isArray(al.level) && al.level.length > 0) {
            al.level.forEach(lvl => {
                const normalized = String(lvl).toLowerCase().trim();
                if (normalized === 'colegio') {
                    mappedLevels.push('Secundaria', 'Bachillerato');
                } else if (normalized === 'universidad') {
                    mappedLevels.push('Universitario');
                } else {
                    // Si viene otro valor, mantenerlo
                    mappedLevels.push(lvl);
                }
            });
        }
        // Eliminar duplicados
        mappedLevels = [...new Set(mappedLevels)];
        
        console.log('📊 [moveToRedDinamica] Niveles originales:', al.level);
        console.log('📊 [moveToRedDinamica] Niveles mapeados:', mappedLevels);

        // Crear la lección en RedDinámica
        // Mapeo de roles: author (académico) -> author (RedDinámica), leader (académico) -> leader (RedDinámica), teacher (académico) -> expert (RedDinámica)
        const lesson = new Lesson({
            title: al.title,
            resume: al.resume || '',
            references: al.references || '',
            justification: (al.justification && (al.justification.methodology || al.justification.objectives)) 
                ? `${al.justification.methodology || ''}\n\n${al.justification.objectives || ''}`.trim()
                : '',
            level: mappedLevels,
            state: 'completed',
            type: 'academic',
            author: al.author?._id || al.author, // El author académico se mantiene como author
            leader: al.leader?._id || al.leader, // El leader académico se mantiene como leader
            expert: al.teacher?._id || al.teacher, // El teacher académico se convierte en expert
            created_at: new Date().toISOString(),
            visible: true,
            accepted: true,
            knowledge_area: knowledgeAreaIds,
            views: 0,
            files: mappedFiles,
            score: 0,
            version: 1,
            academicLessonId: al._id
        });

        await lesson.save();
        console.log('✅ [moveToRedDinamica] Lección guardada en RedDinámica con ID:', lesson._id);

        // Marcar como exportada
        al.isExported = true;
        al.exportedLesson = lesson._id;
        await al.save();
        console.log('✅ [moveToRedDinamica] Lección académica marcada como exportada');

        // Enviar notificaciones a todos los participantes
        try {
            const participants = new Set();
            
            // Agregar author, leader y teacher
            if (al.author?._id) participants.add(String(al.author._id));
            if (al.leader?._id) participants.add(String(al.leader._id));
            if (al.teacher?._id) participants.add(String(al.teacher._id));
            
            // Agregar miembros del equipo de desarrollo
            if (Array.isArray(al.development_group)) {
                al.development_group.forEach(member => {
                    if (member?.user?._id) {
                        participants.add(String(member.user._id));
                    }
                });
            }

            const targetIds = Array.from(participants);
            console.log('📧 [moveToRedDinamica] Enviando notificaciones a:', targetIds.length, 'participantes');

            if (targetIds.length > 0) {
                await NotificationService.createSystemNotification(
                    targetIds,
                    '¡Lección publicada en RedDinámica!',
                    `La lección "${al.title}" ha sido publicada exitosamente en la RedDinámica principal. ¡Ya está disponible para la comunidad!`,
                    `/inicio/lecciones/${lesson._id}`,
                    'high'
                );
                console.log('✅ [moveToRedDinamica] Notificaciones enviadas exitosamente');
            }
        } catch (notificationError) {
            console.error('⚠️ [moveToRedDinamica] Error enviando notificaciones (no crítico):', notificationError);
            // No fallar la operación por errores de notificación
        }

        return res.status(200).json({ 
            status: 'success',
            message: 'Lección movida a RedDinámica exitosamente',
            data: {
                lessonId: lesson._id,
                title: lesson.title
            }
        });
    } catch (err) {
        console.error('❌ [moveToRedDinamica] Error crítico:', err);
        return res.status(500).json({ 
            status: 'error',
            message: 'Error moviendo lección a RedDinámica',
            error: err.message 
        });
    }
};

// Solicitar exportación a RedDinámica (profesor marca la lección como ready_for_migration)
exports.requestExportToRedDinamica = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;
        
        console.log('🔵 [requestExportToRedDinamica] Solicitando exportación de lección ID:', id);
        console.log('🔵 [requestExportToRedDinamica] Usuario solicitante:', userId);
        
        const lesson = await AcademicLesson.findById(id)
            .populate('author', '_id name surname email')
            .populate('leader', '_id name surname email')
            .populate('teacher', '_id name surname email')
            .populate('academicGroup', 'teacher')
            .populate('development_group.user', '_id name surname email');
        
        if (!lesson) {
            console.error('❌ [requestExportToRedDinamica] Lección no encontrada');
            return res.status(404).json({ 
                status: 'error',
                message: 'Lección académica no encontrada' 
            });
        }

        // Verificar que el usuario es el profesor del grupo
        const group = lesson.academicGroup;
        const teacherId = group?.teacher?._id?.toString() || group?.teacher?.toString();
        
        if (!teacherId || teacherId !== userId) {
            console.error('❌ [requestExportToRedDinamica] Usuario no es el profesor del grupo');
            return res.status(403).json({ 
                status: 'error',
                message: 'Solo el profesor puede solicitar la exportación de la lección' 
            });
        }

        // Verificar que la lección está calificada
        if (lesson.status !== 'graded') {
            console.error('❌ [requestExportToRedDinamica] La lección no está calificada');
            return res.status(400).json({ 
                status: 'error',
                message: 'Solo se pueden exportar lecciones calificadas' 
            });
        }

        // Verificar que no está ya exportada o en proceso
        if (lesson.isExported || lesson.state === 'ready_for_migration') {
            console.error('❌ [requestExportToRedDinamica] La lección ya fue exportada o está en proceso');
            return res.status(400).json({ 
                status: 'error',
                message: 'Esta lección ya fue exportada o está en proceso de exportación' 
            });
        }

        // Cambiar el estado a ready_for_migration
        lesson.state = 'ready_for_migration';
        await lesson.save();

        console.log('✅ [requestExportToRedDinamica] Lección marcada como ready_for_migration');

        // Notificar a admins, delegated_admins y lesson_managers
        try {
            const User = require('../models/user.model');
            const admins = await User.find({ 
                $or: [
                    { role: 'admin' },
                    { role: 'delegated_admin' },
                    { role: 'lesson_manager' }
                ]
            }).select('_id');

            const adminIds = admins.map(admin => admin._id.toString());
            
            if (adminIds.length > 0) {
                const NotificationService = require('../services/notification.service');
                await NotificationService.createSystemNotification(
                    adminIds,
                    '📚 Nueva lección lista para exportar',
                    `El profesor ha solicitado exportar la lección "${lesson.title}" a RedDinámica. Revísala en Mejores Lecciones.`,
                    `/admin/tareas?tab=mejores-lecciones`,
                    'high'
                );
                console.log('✅ [requestExportToRedDinamica] Notificaciones enviadas a administradores');
            }
        } catch (notificationError) {
            console.error('⚠️ [requestExportToRedDinamica] Error enviando notificaciones (no crítico):', notificationError);
            // No fallar la operación por errores de notificación
        }

        return res.status(200).json({ 
            status: 'success',
            message: 'Solicitud de exportación enviada exitosamente. Los administradores revisarán tu lección.',
            data: lesson
        });

    } catch (err) {
        console.error('❌ [requestExportToRedDinamica] Error crítico:', err);
        return res.status(500).json({ 
            status: 'error',
            message: 'Error al solicitar la exportación',
            error: err.message 
        });
    }
};
