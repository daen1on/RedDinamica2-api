'use strict';

const AcademicGroup = require('../models/academicGroup.model');
const User = require('../models/user.model');
const AcademicLesson = require('../models/academicLesson.model');
const Resource = require('../models/resource.model');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mail = require('../services/mail.service');
const NotificationService = require('../services/notification.service');
const mongoose = require('mongoose');

// Listar todos los grupos (solo admin o lesson_manager). Soporta filtro active=true
exports.getAllGroups = async (req, res) => {
    try {
        const role = req.user.role;
        if (role !== 'admin' && role !== 'lesson_manager' && role !=='delegated_admin') {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para listar todos los grupos' });
        }

        const { active } = req.query;
        const filter = {};
        if (typeof active !== 'undefined') {
            const isActive = String(active).toLowerCase() === 'true';
            filter.isActive = isActive;
        }

        const groups = await AcademicGroup.find(filter)
            .populate('teacher', 'name surname email avatar')
            .populate('students', 'name surname email avatar')
            .sort({ createdAt: -1 });

        return res.status(200).json({ status: 'success', data: groups });
    } catch (error) {
        console.error('Error al listar grupos académicos:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Crear un nuevo grupo académico
exports.createGroup = async (req, res) => {
    try {
        const { name, description, academicLevel, grade, maxStudents, subjects } = req.body;
        const teacherId = req.user.sub || req.user.id;

        // Admin, teacher and facilitator can create groups 

     
        const group = new AcademicGroup({
            name,
            description,
            academicLevel,
            grade,
            maxStudents: maxStudents || 30,
            subjects: subjects || [],
            teacher: teacherId,
            students: [],
            statistics: {
                totalStudents: 0,
                totalLessons: 0,
                averageGrade: 0,
                activeLessons: 0
            },
            permissions: {
                studentsCanCreateLessons: true,
                studentsCanEditLessons: true,
                studentsCanDeleteLessons: false,
                studentsCanViewAllLessons: true
            }
        });

        const savedGroup = await group.save();

        // Actualizar el usuario (docente o estudiante) con el nuevo grupo
        await User.findByIdAndUpdate(teacherId, {
            $push: { teachingGroups: savedGroup._id },
            // Si es un estudiante, también marcarlo como docente para este grupo
            ...(req.user.role === 'student' && { role: 'teacher' })
        });

        res.status(201).json({
            status: 'success',
            message: 'Grupo académico creado exitosamente',
            data: savedGroup
        });
    } catch (error) {
        console.error('Error al crear grupo académico:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener grupos del docente
exports.getTeacherGroups = async (req, res) => {
    try {
        const teacherId = req.user.sub || req.user.id;
        const groups = await AcademicGroup.find({ teacher: teacherId })
            .populate('students', 'name surname email avatar')
            .populate('teacher', 'name surname email avatar')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: groups
        });
    } catch (error) {
        console.error('Error al obtener grupos del docente:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener grupos del estudiante
exports.getStudentGroups = async (req, res) => {
    try {
        const studentId = req.user.sub || req.user.id;
        const groups = await AcademicGroup.find({$or: [{students: studentId}, {teacher: studentId}]})
            .populate('teacher', 'name surname email avatar')
            .populate('students', 'name surname email avatar')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: groups
        });
    } catch (error) {
        console.error('Error al obtener grupos del estudiante:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener grupo por ID
exports.getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await AcademicGroup.findById(id)
            .populate('teacher', 'name surname email avatar')
            .populate('students', 'name surname email avatar academicProfile')
            .populate({
                path: 'lessons',
                populate: {
                    path: 'author',
                    select: 'name surname email avatar'
                }
            });

        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        res.status(200).json({
            status: 'success',
            data: group
        });
    } catch (error) {
        console.error('Error al obtener grupo:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar grupo
exports.updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, academicLevel, grade, maxStudents, subjects, teacher } = req.body;
        const teacherId = req.user.sub || req.user.id;
        console.log(teacher);
        const group = await AcademicGroup.findById(id);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        if (group.teacher.toString() !== teacherId && (req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin')) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para modificar este grupo'
            });
        }

      

        // Construir actualización parcial
        const update = {
            ...(typeof name !== 'undefined' && { name }),
            ...(typeof description !== 'undefined' && { description }),
            ...(typeof academicLevel !== 'undefined' && { academicLevel }),
            ...(typeof grade !== 'undefined' && { grade }),
            ...(typeof maxStudents !== 'undefined' && { maxStudents }),
            ...(Array.isArray(subjects) && { subjects })
        };

        // Cambio de dueño (solo admin/lesson_manager)
        if (typeof teacher !== 'undefined' && (req.user.role === 'admin' || req.user.role === 'lesson_manager')) {
            // Aceptar teacher como string o como objeto {_id}
            let newOwnerId = null;
            if (teacher && typeof teacher === 'object') {
                newOwnerId = teacher._id || teacher.id || null;
            } else if (typeof teacher === 'string') {
                newOwnerId = teacher;
            }
            if (!newOwnerId || !mongoose.Types.ObjectId.isValid(newOwnerId)) {
                return res.status(400).json({ status: 'error', message: 'ID de nuevo dueño inválido' });
            }
            if (newOwnerId.toString() !== group.teacher.toString()) {
                const newOwner = await User.findById(newOwnerId.toString());
                if (!newOwner) {
                    return res.status(404).json({ status: 'error', message: 'Nuevo dueño no encontrado' });
                }
                // actualizar teachingGroups de usuarios
                await User.findByIdAndUpdate(group.teacher, { $pull: { teachingGroups: group._id } });
                await User.findByIdAndUpdate(newOwnerId.toString(), { $addToSet: { teachingGroups: group._id } });
                update.teacher = newOwnerId.toString();
            }
        }

        const updatedGroup = await AcademicGroup.findByIdAndUpdate(id, update, { new: true })
            .populate('teacher', 'name surname email avatar')
            .populate('students', 'name surname email avatar');

        res.status(200).json({
            status: 'success',
            message: 'Grupo académico actualizado exitosamente',
            data: updatedGroup
        });
    } catch (error) {
        console.error('Error al actualizar grupo:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Eliminar grupo
exports.deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const teacherId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(id);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        if (group.teacher.toString() !== teacherId && (req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin')) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para eliminar este grupo'
            });
        }

        // Eliminar referencias del grupo en usuarios
        await User.updateMany(
            { $or: [{ academicGroups: id }, { teachingGroups: id }] },
            { $pull: { academicGroups: id, teachingGroups: id } }
        );

        // Eliminar lecciones asociadas al grupo
        await AcademicLesson.deleteMany({ academicGroup: id });

        // Eliminar el grupo
        await AcademicGroup.findByIdAndDelete(id);

        res.status(200).json({
            status: 'success',
            message: 'Grupo académico eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar grupo:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Agregar estudiante al grupo
exports.addStudentToGroup = async (req, res) => {
    try {
        const { groupId, studentId } = req.params;
        const teacherId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        if (group.teacher.toString() !== teacherId && (req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin')) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para modificar este grupo'
            });
        }

        // Verificar que el estudiante existe
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({
                status: 'error',
                message: 'Estudiante no encontrado'
            });
        }

        // Verificar que no esté ya en el grupo
        if (group.students.includes(studentId)) {
            return res.status(400).json({
                status: 'error',
                message: 'El estudiante ya está en este grupo'
            });
        }

        // Verificar límite de estudiantes
        if (group.students.length >= group.maxStudents) {
            return res.status(400).json({
                status: 'error',
                message: 'El grupo ha alcanzado su límite máximo de estudiantes'
            });
        }

        // Agregar estudiante al grupo
        group.students.push(studentId);
        group.statistics.totalStudents = group.students.length;
        await group.save();

        // Actualizar el usuario estudiante
        await User.findByIdAndUpdate(studentId, {
            $push: { academicGroups: groupId },
            isStudent: true,
            studentBadge: true
        });

        // Notificar al estudiante
        try {
            await NotificationService.createGroupInvitationNotification(
                req.user,
                studentId,
                group._id,
                group.name
            );
        } catch (notifyErr) {
            console.error('Error creando notificación de grupo (addStudentToGroup):', notifyErr);
        }

        res.status(200).json({
            status: 'success',
            message: 'Estudiante agregado al grupo exitosamente'
        });
    } catch (error) {
        console.error('Error al agregar estudiante:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Invitar/agregar estudiante por email. Si no existe, crear usuario invitado (guest) activado
exports.inviteStudentByEmail = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { email, name = '', surname = '' } = req.body;
        const teacherId = req.user.sub || req.user.id;

        if (!email) {
            return res.status(400).json({ status: 'error', message: 'El correo electrónico es requerido' });
        }

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        // Solo docente del grupo o admin pueden invitar
        if (group.teacher.toString() !== teacherId && (req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin')) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para modificar este grupo' });
        }

        // Buscar usuario por email
        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Crear usuario invitado
            const tempPassword = uuidv4().slice(0, 8);
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(tempPassword, salt);

            user = new User({
                name: name || email.split('@')[0],
                surname: surname || '',
                email: email.toLowerCase(),
                password: hash,
                role: 'guest',
                actived: true,
                isStudent: true,
                studentBadge: true
            });

            await user.save();

            // Enviar correo con acceso
            try {
                const baseUrl = process.env.NODE_ENV === 'production' ? (process.env.HASH_URL || '') : 'http://localhost:4200';
                const loginUrl = `${baseUrl}/login`;
                await mail.sendMail(
                    'Invitación a RedDinámica Académica',
                    user.email,
                    `
                    <h3>Hola ${user.name ||user.surname || ''}</h3>
                    <p>Has sido invitado a participar en un grupo de <strong>RedDinámica Académica</strong>.</p>
                    <p>Tu acceso ha sido creado con rol <strong>Invitado</strong>.</p>
                    <p>Ingresa a <a href="${loginUrl}">RedDinámica</a> con:</p>
                    <ul>
                      <li><strong>Email:</strong> ${user.email}</li>
                      <li><strong>Contraseña temporal:</strong> ${tempPassword}</li>
                    </ul>
                    <p>Una vez inicies sesión, podrás cambiar tu contraseña en <strong>Opciones de seguridad</strong>.</p>
                    `
                );
            } catch (mailErr) {
                console.error('Error enviando invitación:', mailErr);
            }
        }

        // Verificar no duplicado en el grupo
        if (group.students.some(sid => sid.toString() === user._id.toString())) {
            return res.status(400).json({ status: 'error', message: 'El estudiante ya está en este grupo' });
        }

        group.students.push(user._id);
        await group.save();

        await User.findByIdAndUpdate(user._id, {
            $addToSet: { academicGroups: group._id },
            isStudent: true,
            studentBadge: true
        });

        // Notificar al estudiante (exista o recién creado)
        try {
            await NotificationService.createGroupInvitationNotification(
                req.user,
                user._id,
                group._id,
                group.name
            );
        } catch (notifyErr) {
            console.error('Error creando notificación de grupo (inviteStudentByEmail):', notifyErr);
        }

        return res.status(200).json({ status: 'success', message: 'Estudiante agregado/invitado exitosamente', data: { userId: user._id } });
    } catch (error) {
        console.error('Error al invitar/agregar estudiante:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Remover estudiante del grupo
exports.removeStudentFromGroup = async (req, res) => {
    try {
        const { groupId, studentId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar permisos:
        // 1. El docente del grupo puede remover a cualquiera
        // 2. Admin o lesson_manager pueden remover a cualquiera
        // 3. Un estudiante puede removerse a sí mismo (abandonar el grupo)
        const isTeacher = group.teacher.toString() === userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        const isSelfRemoval = userId === studentId;

        if (!isTeacher && !isAdmin && !isSelfRemoval) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para remover a este estudiante'
            });
        }

        // Verificar que el estudiante esté en el grupo
        const isStudentInGroup = group.students.some(id => id.toString() === studentId);
        if (!isStudentInGroup) {
            return res.status(404).json({
                status: 'error',
                message: 'El estudiante no está en este grupo'
            });
        }

        // Remover estudiante del grupo
        group.students = group.students.filter(id => id.toString() !== studentId);
        group.statistics.totalStudents = group.students.length;
        await group.save();

        // Actualizar el usuario estudiante
        await User.findByIdAndUpdate(studentId, {
            $pull: { academicGroups: groupId }
        });

        const message = isSelfRemoval 
            ? 'Has abandonado el grupo exitosamente' 
            : 'Estudiante removido del grupo exitosamente';

        res.status(200).json({
            status: 'success',
            message: message
        });
    } catch (error) {
        console.error('Error al remover estudiante:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener estudiantes del grupo
exports.getGroupStudents = async (req, res) => {
    try {
        const { groupId } = req.params;
        const teacherId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar permisos
        const userId = req.user.sub || req.user.id;
        if (group.teacher.toString() !== teacherId && 
            !group.students.includes(userId) && 
            req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin') {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para ver este grupo'
            });
        }

        const students = await User.find({ _id: { $in: group.students } })
            .select('name surname email picture academicProfile academicStatistics');

        res.status(200).json({
            status: 'success',
            data: students
        });
    } catch (error) {
        console.error('Error al obtener estudiantes:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener estadísticas del grupo
exports.getGroupStatistics = async (req, res) => {
    try {
        const { groupId } = req.params;
        const teacherId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        if (group.teacher.toString() !== teacherId && (req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin')) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para ver las estadísticas de este grupo'
            });
        }

        // Obtener lecciones del grupo
        const lessons = await AcademicLesson.find({ academicGroup: groupId });
        
        // Calcular estadísticas
        const totalLessons = lessons.length;
        const activeLessons = lessons.filter(lesson => lesson.status === 'active').length;
        const completedLessons = lessons.filter(lesson => lesson.status === 'completed').length;
        const averageGrade = lessons.length > 0 
            ? lessons.reduce((sum, lesson) => sum + (lesson.grade || 0), 0) / lessons.length 
            : 0;

        const statistics = {
            totalStudents: group.students.length,
            totalLessons,
            activeLessons,
            completedLessons,
            averageGrade: Math.round(averageGrade * 100) / 100
        };

        res.status(200).json({
            status: 'success',
            data: statistics
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener grados válidos por nivel académico
exports.getValidGrades = async (req, res) => {
    try {
        const { academicLevel } = req.params;
        const validGrades = AcademicGroup.getValidGrades(academicLevel);

        res.status(200).json({
            status: 'success',
            data: validGrades
        });
    } catch (error) {
        console.error('Error al obtener grados válidos:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar permisos del grupo
exports.updateGroupPermissions = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { permissions } = req.body;
        const userId = req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo no encontrado'
            });
        }

        // Solo el docente del grupo puede actualizar permisos
        if (group.teacher.toString() !== userId && (req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin')) {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para actualizar los permisos de este grupo'
            });
        }

        // Actualizar permisos
        group.permissions = {
            ...group.permissions,
            ...permissions
        };

        await group.save();

        res.json({
            status: 'success',
            message: 'Permisos actualizados correctamente',
            data: {
                group: group,
                permissions: group.permissions
            }
        });
    } catch (error) {
        console.error('Error updating group permissions:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor'
        });
    }
};

// Verificar si un estudiante puede crear lecciones en un grupo
exports.canStudentCreateLessons = async (req, res) => {
    console.log("canStudentCreateLessons");
    try {
        const { groupId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo no encontrado'
            });
        }
        console.log("group", group);
        console.log("userId", userId);
        // Verificar si el usuario es estudiante del grupo
        const isStudent = group.students.some(studentId => studentId.toString() === userId);
        console.log("isStudent", isStudent);
        if (!isStudent) {
            const isTeacher = group.teacher.toString() === userId;
            console.log("isTeacher", isTeacher);
            if (!isTeacher) {
                return res.json({
                    status: 'success',
                    canCreate: false,
                    message: 'No eres estudiante de este grupo'
                });
            }
        }

        // Verificar permisos
        const canCreate = group.permissions.studentsCanCreateLessons;
        console.log("canCreate", canCreate);
        res.json({
            status: 'success',
            canCreate: canCreate,
            message: canCreate ? 'Puedes crear lecciones' : 'No tienes permisos para crear lecciones en este grupo'
        });
    } catch (error) {
        console.error('Error checking student permissions:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor'
        });
    }
};

// =====================
// Sistema de Foro/Discusión del Grupo (Threads)
// =====================

// Obtener todos los threads de discusión del grupo
exports.getDiscussionThreads = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId)
            .populate('discussionThreads.author', 'name surname email picture')
            .populate('discussionThreads.messages.author', 'name surname email picture');
        
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        // Solo miembros del grupo, docente o admin pueden ver
        const isMember = group.teacher.toString() === userId || group.students.some(s => s.toString() === userId) || req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        if (!isMember) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para ver esta discusión' });
        }

        // Inicializar thread general si no existe
        if (!group.discussionThreads || group.discussionThreads.length === 0) {
            group.initializeGeneralThread();
            await group.save();
            await group.populate('discussionThreads.author', 'name surname email picture');
        }

        // Ordenar threads: primero los pinned, luego por fecha de actualización
        const threads = group.discussionThreads.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        return res.status(200).json({ status: 'success', data: threads });
    } catch (error) {
        console.error('Error al obtener threads de discusión:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Crear nuevo thread de discusión
exports.createDiscussionThread = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { title, description } = req.body;
        const userId = req.user.sub || req.user.id;

        if (!title || !title.trim()) {
            return res.status(400).json({ status: 'error', message: 'Título requerido' });
        }

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        // Solo miembros del grupo, docente o admin pueden crear threads
        const isTeacherOfGroup = group.teacher.toString() === userId;
        const isStudentOfGroup = group.students.some(s => s.toString() === userId);
        const isAdmin = req.user.role === 'admin' || req.user.role === 'delegated_admin';
        const isMember = isTeacherOfGroup || isStudentOfGroup || isAdmin;
        
        console.log('[createDiscussionThread] Verificación de permisos:', {
            userId,
            userRole: req.user.role,
            groupTeacher: group.teacher.toString(),
            studentsCount: group.students.length,
            isTeacherOfGroup,
            isStudentOfGroup,
            isAdmin,
            isMember
        });
        
        if (!isMember) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'No tienes permisos para crear threads en este grupo. Debes ser miembro del grupo.' 
            });
        }

        const newThread = {
            title: title.trim(),
            description: description ? description.trim() : '',
            author: userId,
            isPinned: false,
            isLocked: false,
            messages: []
        };

        group.discussionThreads.push(newThread);
        await group.save();
        await group.populate('discussionThreads.author', 'name surname email picture');

        return res.status(201).json({ 
            status: 'success', 
            message: 'Thread creado exitosamente', 
            data: group.discussionThreads 
        });
    } catch (error) {
        console.error('Error al crear thread de discusión:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Obtener un thread específico con sus mensajes
exports.getDiscussionThread = async (req, res) => {
    try {
        const { groupId, threadId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId)
            .populate('discussionThreads.author', 'name surname email picture')
            .populate('discussionThreads.messages.author', 'name surname email picture');
        
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        // Solo miembros del grupo, docente o admin pueden ver
        const isMember = group.teacher.toString() === userId || group.students.some(s => s.toString() === userId) || req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        if (!isMember) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para ver este thread' });
        }

        let thread = group.discussionThreads.id ? group.discussionThreads.id(threadId) : null;
        if (!thread) {
            thread = (group.discussionThreads || []).find(t => String(t?._id) === String(threadId));
        }
        if (!thread) {
            return res.status(404).json({ status: 'error', message: 'Thread no encontrado' });
        }

        return res.status(200).json({ status: 'success', data: thread });
    } catch (error) {
        console.error('Error al obtener thread:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Agregar mensaje a un thread
exports.addMessageToThread = async (req, res) => {
    try {
        const { groupId, threadId } = req.params;
        const { content } = req.body;
        const userId = req.user.sub || req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ status: 'error', message: 'Contenido requerido' });
        }

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        // Solo miembros del grupo, docente o admin pueden publicar
        const isTeacherOfGroup = group.teacher.toString() === userId;
        const isStudentOfGroup = group.students.some(s => s.toString() === userId);
        const isAdmin = req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        const isMember = isTeacherOfGroup || isStudentOfGroup || isAdmin;
        
        console.log('[addMessageToThread] Verificación de permisos:', {
            userId,
            userRole: req.user.role,
            groupTeacher: group.teacher.toString(),
            studentsCount: group.students.length,
            isTeacherOfGroup,
            isStudentOfGroup,
            isAdmin,
            isMember
        });
        
        if (!isMember) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'No tienes permisos para publicar en este thread. Debes ser miembro del grupo.' 
            });
        }

        const thread = group.discussionThreads.id(threadId);
        if (!thread) {
            return res.status(404).json({ status: 'error', message: 'Thread no encontrado' });
        }

        if (thread.isLocked) {
            const isTeacher = group.teacher.toString() === userId;
            const isAdmin = req.user.role === 'admin';
            if (!isTeacher && !isAdmin) {
                return res.status(403).json({ status: 'error', message: 'Este thread está bloqueado' });
            }
        }

        thread.messages.push({ content: content.trim(), author: userId });
        thread.updatedAt = new Date();
        await group.save();
        await group.populate('discussionThreads.author', 'name surname email picture');
        await group.populate('discussionThreads.messages.author', 'name surname email picture');

        const updatedThread = group.discussionThreads.id(threadId);
        return res.status(201).json({ 
            status: 'success', 
            message: 'Mensaje agregado', 
            data: updatedThread 
        });
    } catch (error) {
        console.error('Error al agregar mensaje al thread:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Eliminar mensaje de un thread (docente, admin o autor)
exports.deleteMessageFromThread = async (req, res) => {
    try {
        const { groupId, threadId, messageId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        const thread = group.discussionThreads.id(threadId);
        if (!thread) {
            return res.status(404).json({ status: 'error', message: 'Thread no encontrado' });
        }

        let message = thread.messages.id ? thread.messages.id(messageId) : null;
        if (!message) {
            // Fallback en caso de que messages no sea un subdocument array de Mongoose
            message = (thread.messages || []).find(m => String(m?._id) === String(messageId));
        }
        if (!message) {
            return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado' });
        }

        const isTeacher = group.teacher.toString() === userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        const authorId = (message.author && message.author._id)
            ? message.author._id.toString()
            : String(message.author);
        const isAuthor = authorId === userId;
        if (!isTeacher && !isAdmin && !isAuthor) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para eliminar este mensaje' });
        }

        if (typeof message.remove === 'function') {
            // Subdocument de Mongoose
            message.remove();
        } else {
            // Array plano de objetos
            thread.messages = (thread.messages || []).filter(m => String(m?._id) !== String(messageId));
        }
        thread.updatedAt = new Date();
        await group.save();
        
        return res.status(200).json({ status: 'success', message: 'Mensaje eliminado' });
    } catch (error) {
        console.error('Error al eliminar mensaje del thread:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Eliminar thread completo (solo docente o admin)
exports.deleteDiscussionThread = async (req, res) => {
    try {
        const { groupId, threadId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        const thread = group.discussionThreads.id(threadId);
        if (!thread) {
            return res.status(404).json({ status: 'error', message: 'Thread no encontrado' });
        }

        const isTeacher = group.teacher.toString() === userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        if (!isTeacher && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para eliminar este thread' });
        }

        // No permitir eliminar el thread General (el primero)
        if (thread.isPinned && thread.title === 'Conversación General') {
            return res.status(400).json({ status: 'error', message: 'No se puede eliminar el thread General' });
        }

        // Eliminar thread de manera segura (subdocumento o array plano)
        if (typeof thread.remove === 'function') {
            thread.remove();
        } else {
            group.discussionThreads = (group.discussionThreads || []).filter(t => String(t?._id) !== String(threadId));
        }
        await group.save();
        
        return res.status(200).json({ status: 'success', message: 'Thread eliminado' });
    } catch (error) {
        console.error('Error al eliminar thread:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Toggle pin thread (solo docente o admin)
exports.togglePinThread = async (req, res) => {
    try {
        const { groupId, threadId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        const isTeacher = group.teacher.toString() === userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        if (!isTeacher && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para fijar threads' });
        }

        const thread = group.discussionThreads.id(threadId);
        if (!thread) {
            return res.status(404).json({ status: 'error', message: 'Thread no encontrado' });
        }

        thread.isPinned = !thread.isPinned;
        await group.save();
        
        return res.status(200).json({ 
            status: 'success', 
            message: thread.isPinned ? 'Thread fijado' : 'Thread desfijado',
            data: { isPinned: thread.isPinned }
        });
    } catch (error) {
        console.error('Error al fijar/desfijar thread:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Toggle lock thread (solo docente o admin)
exports.toggleLockThread = async (req, res) => {
    try {
        const { groupId, threadId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        const isTeacher = group.teacher.toString() === userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin';
        if (!isTeacher && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para bloquear threads' });
        }

        const thread = group.discussionThreads.id(threadId);
        if (!thread) {
            return res.status(404).json({ status: 'error', message: 'Thread no encontrado' });
        }

        thread.isLocked = !thread.isLocked;
        await group.save();
        
        return res.status(200).json({ 
            status: 'success', 
            message: thread.isLocked ? 'Thread bloqueado' : 'Thread desbloqueado',
            data: { isLocked: thread.isLocked }
        });
    } catch (error) {
        console.error('Error al bloquear/desbloquear thread:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// ===== MÉTODOS ANTIGUOS (para compatibilidad) =====
exports.getDiscussion = exports.getDiscussionThreads;

exports.addDiscussionMessage = async (req, res) => {
    // Redirigir al thread general
    try {
        const { groupId } = req.params;
        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }
        
        if (!group.discussionThreads || group.discussionThreads.length === 0) {
            group.initializeGeneralThread();
            await group.save();
        }
        
        const generalThread = group.discussionThreads[0];
        req.params.threadId = generalThread._id;
        return exports.addMessageToThread(req, res);
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

exports.deleteDiscussionMessage = async (req, res) => {
    // Redirigir al método de thread
    try {
        const { groupId, messageId } = req.params;
        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }
        
        // Buscar el thread que contiene el mensaje
        let threadId = null;
        for (const thread of group.discussionThreads) {
            if (thread.messages.id(messageId)) {
                threadId = thread._id;
                break;
            }
        }
        
        if (!threadId) {
            return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado' });
        }
        
        req.params.threadId = threadId;
        return exports.deleteMessageFromThread(req, res);
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// =====================
// Recursos del Grupo
// =====================

// Listar recursos del grupo
exports.getGroupResources = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId).populate({
            path: 'resources',
            populate: { path: 'author', select: 'name surname email' }
        });
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        // Solo miembros del grupo, docente o admin pueden ver
        const isMember = group.teacher.toString() === userId || group.students.some(s => s.toString() === userId) || req.user.role === 'admin' || req.user.role === 'lesson_manager' || req.user.role === 'delegated_admin' ;
        if (!isMember) {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para ver estos recursos' });
        }

        return res.status(200).json({ status: 'success', data: group.resources || [] });
    } catch (error) {
        console.error('Error al obtener recursos del grupo:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Agregar (importar) recurso existente al grupo (solo docente o admin)
exports.addGroupResource = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { resourceId } = req.body;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        if (group.teacher.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin') {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para modificar recursos del grupo' });
        }

        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ status: 'error', message: 'Recurso no encontrado' });
        }

        // Evitar duplicados
        const already = group.resources.some(rid => rid.toString() === resourceId);
        if (!already) {
            group.resources.push(resourceId);
            await group.save();
        }

        await group.populate({ path: 'resources', populate: { path: 'author', select: 'name surname email' } });
        return res.status(200).json({ status: 'success', message: 'Recurso agregado al grupo', data: group.resources });
    } catch (error) {
        console.error('Error al agregar recurso al grupo:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};

// Remover recurso del grupo (solo docente o admin)
exports.removeGroupResource = async (req, res) => {
    try {
        const { groupId, resourceId } = req.params;
        const userId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ status: 'error', message: 'Grupo académico no encontrado' });
        }

        if (group.teacher.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'lesson_manager' && req.user.role !== 'delegated_admin') {
            return res.status(403).json({ status: 'error', message: 'No tienes permisos para modificar recursos del grupo' });
        }

        group.resources = group.resources.filter(rid => rid.toString() !== resourceId);
        await group.save();
        return res.status(200).json({ status: 'success', message: 'Recurso removido del grupo' });
    } catch (error) {
        console.error('Error al remover recurso del grupo:', error);
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};
