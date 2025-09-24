'use strict';

const AcademicGroup = require('../models/academicGroup.model');
const User = require('../models/user.model');
const AcademicLesson = require('../models/academicLesson.model');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mail = require('../services/mail.service');

// Crear un nuevo grupo académico
exports.createGroup = async (req, res) => {
    try {
        const { name, description, academicLevel, grade, maxStudents, subjects } = req.body;
        const teacherId = req.user.sub || req.user.id;

        // Admin, teacher and facilitator can create groups 

        // Validar el nivel académico y grado
        const validGrades = AcademicGroup.getValidGrades(academicLevel);
        if (!validGrades.includes(grade)) {
            return res.status(400).json({
                status: 'error',
                message: `Grado inválido para el nivel ${academicLevel}. Grados válidos: ${validGrades.join(', ')}`
            });
        }

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
                studentsCanCreateLessons: false,
                studentsCanEditLessons: false,
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
            .populate('students', 'name email avatar')
            .populate('teacher', 'name email avatar')
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
        const groups = await AcademicGroup.find({ students: studentId })
            .populate('teacher', 'name email avatar')
            .populate('students', 'name email avatar')
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
            .populate('teacher', 'name email avatar')
            .populate('students', 'name email avatar academicProfile')
            .populate({
                path: 'lessons',
                populate: {
                    path: 'author',
                    select: 'name email avatar'
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
        const { name, description, academicLevel, grade, maxStudents, subjects } = req.body;
        const teacherId = req.user.sub || req.user.id;

        const group = await AcademicGroup.findById(id);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        if (group.teacher.toString() !== teacherId && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para modificar este grupo'
            });
        }

        // Validar el nivel académico y grado si se proporcionan
        if (academicLevel && grade) {
            const validGrades = AcademicGroup.getValidGrades(academicLevel);
            if (!validGrades.includes(grade)) {
                return res.status(400).json({
                    status: 'error',
                    message: `Grado inválido para el nivel ${academicLevel}. Grados válidos: ${validGrades.join(', ')}`
                });
            }
        }

        const updatedGroup = await AcademicGroup.findByIdAndUpdate(
            id,
            {
                name,
                description,
                academicLevel,
                grade,
                maxStudents,
                subjects
            },
            { new: true }
        ).populate('teacher', 'name email avatar')
         .populate('students', 'name email avatar');

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
        if (group.teacher.toString() !== teacherId && req.user.role !== 'admin') {
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
        if (group.teacher.toString() !== teacherId && req.user.role !== 'admin') {
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
        if (group.teacher.toString() !== teacherId && req.user.role !== 'admin') {
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
                const baseUrl = process.env.NODE_ENV === 'production' ? (process.env.URL || '') : 'http://localhost:4200';
                const loginUrl = `${baseUrl}/login`;
                await mail.sendMail(
                    'Invitación a RedDinámica Académica',
                    user.email,
                    `
                    <h3>Hola ${user.name || ''}</h3>
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
        const teacherId = req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo académico no encontrado'
            });
        }

        // Verificar que el usuario sea el docente del grupo
        if (group.teacher.toString() !== teacherId && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para modificar este grupo'
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

        res.status(200).json({
            status: 'success',
            message: 'Estudiante removido del grupo exitosamente'
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
        if (group.teacher.toString() !== teacherId && 
            !group.students.includes(req.user.id) && 
            req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'No tienes permisos para ver este grupo'
            });
        }

        const students = await User.find({ _id: { $in: group.students } })
            .select('name email avatar academicProfile academicStatistics');

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
        if (group.teacher.toString() !== teacherId && req.user.role !== 'admin') {
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
        if (group.teacher.toString() !== userId && req.user.role !== 'admin') {
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
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const group = await AcademicGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: 'error',
                message: 'Grupo no encontrado'
            });
        }

        // Verificar si el usuario es estudiante del grupo
        const isStudent = group.students.some(studentId => studentId.toString() === userId);
        
        if (!isStudent) {
            return res.json({
                status: 'success',
                canCreate: false,
                message: 'No eres estudiante de este grupo'
            });
        }

        // Verificar permisos
        const canCreate = group.permissions.studentsCanCreateLessons;

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
