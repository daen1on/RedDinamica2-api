'use strict';

const User = require('../models/user.model');
const Lesson = require('../models/lesson.model');
const AcademicLesson = require('../models/academicLesson.model');
const Notification = require('../models/notification.model');
const moment = require('moment');

/**
 * Servicio para generar resumen mensual de actividad
 * Recopila lecciones publicadas y notificaciones no leídas
 */

/**
 * Obtiene todas las lecciones publicadas en el último mes
 * @returns {Promise<Array>} Array de lecciones publicadas
 */
exports.getLastMonthLessons = async () => {
    try {
        const oneMonthAgo = moment().subtract(1, 'months').toDate();
        
        // Lecciones de RedDinámica publicadas y visibles
        const redDinamicaLessons = await Lesson.find({
            visible: true,
            created_at: { 
                $gte: oneMonthAgo.toISOString() 
            }
        })
        .populate('author', 'name surname')
        .populate('knowledge_area', 'name')
        .select('title resume author knowledge_area created_at views')
        .sort({ created_at: -1 })
        .limit(10) // Limitar a las 10 más recientes
        .lean();

        // Lecciones académicas publicadas
        const academicLessons = await AcademicLesson.find({
            createdAt: { $gte: oneMonthAgo },
            state: { $in: ['published', 'ready_for_migration'] }
        })
        .populate('author', 'name surname')
        .populate('academicGroup', 'name')
        .select('title resume author academicGroup createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        return {
            redDinamica: redDinamicaLessons || [],
            academic: academicLessons || [],
            total: (redDinamicaLessons?.length || 0) + (academicLessons?.length || 0)
        };
    } catch (error) {
        console.error('Error obteniendo lecciones del último mes:', error);
        return { redDinamica: [], academic: [], total: 0 };
    }
};

/**
 * Obtiene las notificaciones no leídas de un usuario
 * @param {String} userId - ID del usuario
 * @returns {Promise<Object>} Objeto con notificaciones agrupadas por tipo
 */
exports.getUserUnreadNotifications = async (userId) => {
    try {
        const notifications = await Notification.find({
            user: userId,
            read: false
        })
        .populate('from', 'name surname')
        .sort({ created_at: -1 })
        .limit(20) // Limitar a las 20 más recientes
        .lean();

        // Agrupar por tipo
        const grouped = {
            message: [],
            lesson: [],
            publication: [],
            comment: [],
            follow: [],
            resource: [],
            system: [],
            total: notifications.length
        };

        notifications.forEach(notif => {
            if (grouped[notif.type]) {
                grouped[notif.type].push(notif);
            }
        });

        return grouped;
    } catch (error) {
        console.error(`Error obteniendo notificaciones para usuario ${userId}:`, error);
        return { message: [], lesson: [], publication: [], comment: [], follow: [], resource: [], system: [], total: 0 };
    }
};

/**
 * Genera un resumen completo para un usuario específico
 * @param {String} userId - ID del usuario
 * @returns {Promise<Object>} Objeto con el resumen completo
 */
exports.generateUserDigest = async (userId) => {
    try {
        const user = await User.findById(userId).lean();
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        const [lessons, notifications] = await Promise.all([
            this.getLastMonthLessons(),
            this.getUserUnreadNotifications(userId)
        ]);

        return {
            user: {
                id: user._id,
                name: user.name,
                surname: user.surname,
                email: user.email
            },
            lessons,
            notifications,
            period: {
                start: moment().subtract(1, 'months').format('DD/MM/YYYY'),
                end: moment().format('DD/MM/YYYY')
            },
            hasActivity: lessons.total > 0 || notifications.total > 0
        };
    } catch (error) {
        console.error(`Error generando resumen para usuario ${userId}:`, error);
        throw error;
    }
};

/**
 * Obtiene todos los usuarios activos que deben recibir el resumen
 * @returns {Promise<Array>} Array de usuarios activos
 */
exports.getActiveUsers = async () => {
    try {
        // Solo usuarios activados y que tengan email
        const users = await User.find({
            actived: true,
            email: { $exists: true, $ne: '' }
        })
        .select('_id name surname email')
        .lean();

        return users;
    } catch (error) {
        console.error('Error obteniendo usuarios activos:', error);
        return [];
    }
};

/**
 * Calcula estadísticas generales de la plataforma del último mes
 * @returns {Promise<Object>} Estadísticas generales
 */
exports.getPlatformStats = async () => {
    try {
        const oneMonthAgo = moment().subtract(1, 'months').toDate();
        
        const [
            totalLessons,
            totalAcademicLessons,
            activeUsers
        ] = await Promise.all([
            Lesson.countDocuments({ 
                visible: true, 
                created_at: { $gte: oneMonthAgo.toISOString() } 
            }),
            AcademicLesson.countDocuments({ 
                createdAt: { $gte: oneMonthAgo },
                state: { $in: ['published', 'ready_for_migration'] }
            }),
            User.countDocuments({ 
                actived: true 
            })
        ]);

        return {
            newLessons: totalLessons + totalAcademicLessons,
            totalLessons: totalLessons,
            totalAcademicLessons: totalAcademicLessons,
            activeUsers: activeUsers
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas de la plataforma:', error);
        return {
            newLessons: 0,
            totalLessons: 0,
            totalAcademicLessons: 0,
            activeUsers: 0
        };
    }
};

