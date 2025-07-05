'use strict';

const Notification = require('../models/notification.model');

class NotificationService {
    
    // Crear notificación de nuevo mensaje
    static async createMessageNotification(fromUser, toUser, messageId) {
        return await Notification.createNotification({
            user: toUser,
            type: 'message',
            title: 'Nuevo mensaje',
            content: `${fromUser.name} ${fromUser.lastname} te ha enviado un mensaje`,
            link: `/messages/${messageId}`,
            relatedId: messageId,
            relatedModel: 'Message',
            from: fromUser._id,
            priority: 'medium'
        });
    }

    // ===== NUEVAS FUNCIONES ESPECÍFICAS =====

    // 1. Notificación de comentario en publicación
    static async createPublicationCommentNotification(fromUser, publicationOwner, publicationId, commentText) {
        return await Notification.createNotification({
            user: publicationOwner,
            type: 'comment',
            title: 'Nuevo comentario en tu publicación',
            content: `${fromUser.name} ${fromUser.lastname} comentó: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
            link: `/publications/${publicationId}`,
            relatedId: publicationId,
            relatedModel: 'Publication',
            from: fromUser._id,
            priority: 'medium'
        });
    }

    // 2. Notificación de nuevo mensaje en lección
    static async createLessonMessageNotification(fromUser, lessonParticipants, lessonId, lessonTitle, messageText) {
        const notificationData = {
            type: 'lesson',
            title: 'Nuevo mensaje en lección',
            content: `${fromUser.name} ${fromUser.lastname} escribió en "${lessonTitle}": "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: fromUser._id,
            priority: 'medium'
        };

        // Notificar a todos los participantes excepto al autor del mensaje
        const participantsToNotify = lessonParticipants.filter(userId => 
            userId.toString() !== fromUser._id.toString()
        );

        const notifications = participantsToNotify.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 3. Notificación de cambio de estado en lección
    static async createLessonStateChangeNotification(lessonParticipants, lessonId, lessonTitle, oldState, newState, changedBy) {
        const stateMessages = {
            'pending': 'pendiente de revisión',
            'in_progress': 'en progreso',
            'completed': 'completada',
            'cancelled': 'cancelada',
            'approved': 'aprobada',
            'rejected': 'rechazada'
        };

        const notificationData = {
            type: 'lesson',
            title: 'Cambio de estado en lección',
            content: `La lección "${lessonTitle}" cambió de ${stateMessages[oldState] || oldState} a ${stateMessages[newState] || newState}`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: changedBy,
            priority: 'high'
        };

        const notifications = lessonParticipants.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 4. Notificación de nuevo seguidor (mejorada)
    static async createFollowNotification(fromUser, toUser) {
        return await Notification.createNotification({
            user: toUser,
            type: 'follow',
            title: 'Nuevo seguidor',
            content: `${fromUser.name} ${fromUser.lastname} ha comenzado a seguirte`,
            link: `/profile/${fromUser._id}`,
            relatedId: fromUser._id,
            relatedModel: 'User',
            from: fromUser._id,
            priority: 'low'
        });
    }

    // 5. Notificación de nueva convocatoria creada
    static async createCallNotification(fromUser, interestedUsers, lessonId, lessonTitle, callText) {
        const notificationData = {
            type: 'lesson',
            title: 'Nueva convocatoria disponible',
            content: `${fromUser.name} ${fromUser.lastname} ha creado una convocatoria para "${lessonTitle}": "${callText.substring(0, 100)}${callText.length > 100 ? '...' : ''}"`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: fromUser._id,
            priority: 'high'
        };

        const notifications = interestedUsers.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 6. Notificación de recurso aprobado
    static async createResourceApprovedNotification(resourceAuthor, resourceId, resourceName, approvedBy) {
        return await Notification.createNotification({
            user: resourceAuthor,
            type: 'resource',
            title: '¡Tu recurso fue aprobado!',
            content: `Tu recurso "${resourceName}" ha sido aprobado y ahora está visible en la red`,
            link: `/resources/${resourceId}`,
            relatedId: resourceId,
            relatedModel: 'Resource',
            from: approvedBy,
            priority: 'high'
        });
    }

    // 7. Notificación de recurso rechazado
    static async createResourceRejectedNotification(resourceAuthor, resourceId, resourceName, rejectedBy, reason = '') {
        return await Notification.createNotification({
            user: resourceAuthor,
            type: 'resource',
            title: 'Tu recurso necesita revisión',
            content: `Tu recurso "${resourceName}" necesita ser revisado${reason ? `: ${reason}` : ''}`,
            link: `/resources/${resourceId}`,
            relatedId: resourceId,
            relatedModel: 'Resource',
            from: rejectedBy,
            priority: 'high'
        });
    }

    // 8. Notificación de usuario aprobado
    static async createUserApprovedNotification(approvedUserId, approvedBy) {
        return await Notification.createNotification({
            user: approvedUserId,
            type: 'system',
            title: '¡Bienvenido a RedDinámica!',
            content: 'Tu cuenta ha sido aprobada. Ya puedes acceder a todas las funcionalidades de la plataforma.',
            link: '/home',
            relatedId: approvedUserId,
            relatedModel: 'User',
            from: approvedBy,
            priority: 'high'
        });
    }

    // 9. Notificación a administradores de nuevo usuario registrado
    static async createNewUserRegistrationNotification(newUser, adminUsers) {
        const notificationData = {
            type: 'system',
            title: 'Nuevo usuario registrado',
            content: `${newUser.name} ${newUser.surname} se ha registrado y está pendiente de aprobación`,
            link: `/admin/users/new`,
            relatedId: newUser._id,
            relatedModel: 'User',
            from: newUser._id,
            priority: 'medium'
        };

        const notifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // ===== FUNCIONES ORIGINALES =====

    // Crear notificación de nueva lección
    static async createLessonNotification(fromUser, toUsers, lessonId, lessonTitle) {
        const notificationData = {
            type: 'lesson',
            title: 'Nueva lección disponible',
            content: `${fromUser.name} ${fromUser.lastname} ha creado una nueva lección: "${lessonTitle}"`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: fromUser._id,
            priority: 'medium'
        };

        const notifications = toUsers.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // Crear notificación de nueva publicación
    static async createPublicationNotification(fromUser, toUsers, publicationId, publicationTitle) {
        const notificationData = {
            type: 'publication',
            title: 'Nueva publicación',
            content: `${fromUser.name} ${fromUser.lastname} ha creado una nueva publicación: "${publicationTitle}"`,
            link: `/publications/${publicationId}`,
            relatedId: publicationId,
            relatedModel: 'Publication',
            from: fromUser._id,
            priority: 'low'
        };

        const notifications = toUsers.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // Crear notificación de comentario en recurso
    static async createCommentNotification(fromUser, toUser, commentId, resourceTitle) {
        return await Notification.createNotification({
            user: toUser,
            type: 'comment',
            title: 'Nuevo comentario en tu recurso',
            content: `${fromUser.name} ${fromUser.lastname} comentó en "${resourceTitle}"`,
            link: `/resources/${commentId}`,
            relatedId: commentId,
            relatedModel: 'Comment',
            from: fromUser._id,
            priority: 'medium'
        });
    }

    // Crear notificación de respuesta a comentario
    static async createReplyNotification(fromUser, toUser, commentId, replyText) {
        return await Notification.createNotification({
            user: toUser,
            type: 'comment',
            title: 'Nueva respuesta a tu comentario',
            content: `${fromUser.name} ${fromUser.lastname} respondió a tu comentario: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
            link: `/comments/${commentId}`,
            relatedId: commentId,
            relatedModel: 'Comment',
            from: fromUser._id,
            priority: 'medium'
        });
    }

    // Crear notificación de nuevo recurso
    static async createResourceNotification(fromUser, toUsers, resourceId, resourceTitle) {
        const notificationData = {
            type: 'resource',
            title: 'Nuevo recurso disponible',
            content: `${fromUser.name} ${fromUser.lastname} ha compartido un nuevo recurso: "${resourceTitle}"`,
            link: `/resources/${resourceId}`,
            relatedId: resourceId,
            relatedModel: 'Resource',
            from: fromUser._id,
            priority: 'medium'
        };

        const notifications = toUsers.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // Crear notificación del sistema
    static async createSystemNotification(toUsers, title, content, link = null, priority = 'medium') {
        const notificationData = {
            type: 'system',
            title,
            content,
            link,
            priority
        };

        const notifications = toUsers.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // Limpiar notificaciones antiguas (más de 30 días)
    static async cleanOldNotifications() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return await Notification.deleteMany({
            created_at: { $lt: thirtyDaysAgo },
            read: true
        });
    }

    // Obtener estadísticas de notificaciones
    static async getNotificationStats(userId) {
        const stats = await Notification.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: 1 },
                    unread: {
                        $sum: {
                            $cond: [{ $eq: ['$read', false] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        return stats;
    }
}

module.exports = NotificationService; 