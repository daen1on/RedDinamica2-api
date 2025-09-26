'use strict';

const Notification = require('../models/notification.model');

class NotificationService {
    
    // Crear notificación de nuevo mensaje
    static async createMessageNotification(fromUser, toUser, messageId) {
        return await Notification.createNotification({
            user: toUser,
            type: 'message',
            title: 'Nuevo mensaje',
            content: `${fromUser.name} ${fromUser.surname} te ha enviado un mensaje`,
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
            content: `${fromUser.name} ${fromUser.surname} comentó: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
            link: `/inicio/publicacion/${publicationId}?highlight=comment`,
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
            content: `${fromUser.name} ${fromUser.surname} escribió en "${lessonTitle}": "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`,
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
    static async createLessonStateChangeNotification(fromUser, lessonParticipants, lessonId, lessonTitle, oldState, newState, reason = '') {
        const reasonText = reason ? ` Motivo: ${reason}` : '';
        const notificationData = {
            type: 'lesson',
            title: 'Cambio de estado en lección',
            content: `${fromUser.name} ${fromUser.surname} cambió el estado de "${lessonTitle}" de ${oldState} a ${newState}.${reasonText}`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: fromUser._id,
            priority: 'high'
        };

        // Notificar a todos los participantes excepto al que cambió el estado
        const participantsToNotify = lessonParticipants.filter(userId => 
            userId.toString() !== fromUser._id.toString()
        );

        const notifications = participantsToNotify.map(userId => ({
            user: userId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 4. Notificación de nuevo seguidor (CORREGIDA)
    static async createFollowNotification(fromUser, toUser) {
        console.log('=== createFollowNotification ===');
        console.log('From user (seguidor):', fromUser.name, fromUser.surname, fromUser._id);
        console.log('To user (seguido):', toUser);
        
        return await Notification.createNotification({
            user: toUser,
            type: 'follow',
            title: 'Nuevo seguidor',
            content: `${fromUser.name} ${fromUser.surname} ha comenzado a seguirte`,
            link: `/perfil/${fromUser._id}/publicaciones`,
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
            content: `${fromUser.name} ${fromUser.surname} ha creado una convocatoria para "${lessonTitle}": "${callText.substring(0, 100)}${callText.length > 100 ? '...' : ''}"`,
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

    // 6. Notificación de recurso enviado para aprobación (al usuario)
    static async createResourceSubmittedNotification(resourceAuthor, resourceId, resourceName) {
        return await Notification.createNotification({
            user: resourceAuthor,
            type: 'resource',
            title: 'Recurso enviado para aprobación',
            content: `Tu recurso "${resourceName}" se ha enviado correctamente y está siendo revisado por el administrador`,
            link: `/inicio/recursos`,
            relatedId: resourceId,
            relatedModel: 'Resource',
            from: resourceAuthor,
            priority: 'medium'
        });
    }

    // 7. Notificación a administradores de nuevo recurso pendiente
    static async createNewResourcePendingNotification(resourceAuthor, resourceId, resourceName, adminUsers) {
        const notificationData = {
            type: 'resource',
            title: 'Nuevo recurso pendiente de aprobación',
            content: `${resourceAuthor.name} ${resourceAuthor.surname} ha enviado un nuevo recurso "${resourceName}" para aprobación`,
            link: `/admin/recursos`,
            relatedId: resourceId,
            relatedModel: 'Resource',
            from: resourceAuthor._id,
            priority: 'medium'
        };

        const notifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 8. Notificación de recurso aprobado
    static async createResourceApprovedNotification(resourceAuthor, resourceId, resourceName, approvedBy) {
        return await Notification.createNotification({
            user: resourceAuthor,
            type: 'resource',
            title: '¡Tu recurso fue aprobado!',
            content: `Tu recurso "${resourceName}" ha sido aprobado y ahora está visible en la red`,
            link: `/inicio/recursos`,
            relatedId: resourceId,
            relatedModel: 'Resource',
            from: approvedBy,
            priority: 'high'
        });
    }

    // 9. Notificación de recurso rechazado
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

    // 10. Notificación de usuario aprobado
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

    // 11. Notificación a administradores de nuevo usuario registrado
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

    // ===== NUEVAS FUNCIONES PARA SUGERENCIAS DE LECCIONES =====

    // 12. Notificación de nueva sugerencia de lección (al usuario que sugiere)
    static async createLessonSuggestionSubmittedNotification(suggestionAuthor, lessonId, lessonTitle) {
        return await Notification.createNotification({
            user: suggestionAuthor,
            type: 'lesson',
            title: 'Sugerencia de lección enviada',
            content: `Tu sugerencia de lección "${lessonTitle}" se ha enviado correctamente y está siendo revisada por el administrador`,
            link: `/inicio/lecciones`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: suggestionAuthor,
            priority: 'medium'
        });
    }

    // 13. Notificación a administradores de nueva sugerencia de lección
    static async createNewLessonSuggestionNotification(suggestionAuthor, lessonId, lessonTitle, adminUsers) {
        const notificationData = {
            type: 'lesson',
            title: 'Nueva sugerencia de lección',
            content: `${suggestionAuthor.name} ${suggestionAuthor.surname} ha sugerido una nueva lección: "${lessonTitle}". Revisa y gestiona la convocatoria.`,
            link: `/admin/lecciones?lesson=${lessonId}&action=review`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: suggestionAuthor._id,
            priority: 'medium'
        };

        const notifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 14. Notificación al facilitador sugerido
    static async createFacilitatorSuggestionNotification(suggestionAuthor, facilitatorId, lessonId, lessonTitle) {
        console.log('=== Creating facilitator suggestion notification ===');
        console.log('Suggestion Author:', suggestionAuthor.name, suggestionAuthor.surname);
        console.log('Facilitator ID:', facilitatorId);
        console.log('Lesson ID:', lessonId);
        console.log('Lesson Title:', lessonTitle);
        console.log('Link will be: /inicio/asesorar-lecciones');
        
        const notification = await Notification.createNotification({
            user: facilitatorId,
            type: 'lesson',
            title: 'Te han sugerido como facilitador',
            content: `${suggestionAuthor.name} ${suggestionAuthor.surname} te ha sugerido como facilitador para la lección "${lessonTitle}". Revisa tus invitaciones para aprobar o rechazar.`,
            link: `/inicio/asesorar-lecciones`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: suggestionAuthor._id,
            priority: 'high'
        });
        
        console.log('Created notification:', notification);
        return notification;
    }

    // 15. Notificación de sugerencia de lección aprobada
    static async createLessonSuggestionApprovedNotification(suggestionAuthor, lessonId, lessonTitle, approvedBy) {
        return await Notification.createNotification({
            user: suggestionAuthor,
            type: 'lesson',
            title: '¡Tu sugerencia de lección fue aprobada!',
            content: `Tu sugerencia de lección "${lessonTitle}" ha sido aprobada y se está preparando para desarrollo`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: approvedBy,
            priority: 'high'
        });
    }

    // 16. Notificación de sugerencia de lección rechazada
    static async createLessonSuggestionRejectedNotification(suggestionAuthor, lessonId, lessonTitle, rejectedBy, reason = '') {
        const reasonText = reason ? ` Motivo: ${reason}` : '';
        return await Notification.createNotification({
            user: suggestionAuthor,
            type: 'lesson',
            title: 'Tu sugerencia de lección necesita revisión',
            content: `Tu sugerencia de lección "${lessonTitle}" necesita ser revisada.${reasonText}`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: rejectedBy,
            priority: 'high'
        });
    }

    // 17. Notificación de facilitador que acepta la invitación
    static async createFacilitatorAcceptedNotification(facilitator, lessonId, lessonTitle, adminUsers, suggestionAuthor) {
        const notificationData = {
            type: 'lesson',
            title: 'Facilitador aceptó invitación',
            content: `${facilitator.name} ${facilitator.surname} ha aceptado ser facilitador de la lección "${lessonTitle}"`,
            link: `/admin/lecciones?lesson=${lessonId}&action=manage`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitator._id,
            priority: 'high'
        };

        // Notificar a administradores
        const adminNotifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        // Notificar al autor de la sugerencia
        const authorNotification = {
            user: suggestionAuthor,
            type: 'lesson',
            title: 'El facilitador aceptó tu sugerencia',
            content: `${facilitator.name} ${facilitator.surname} ha aceptado ser facilitador de tu lección sugerida "${lessonTitle}"`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitator._id,
            priority: 'high'
        };

        const allNotifications = [...adminNotifications, authorNotification];
        return await Notification.insertMany(allNotifications);
    }

    // 18. Notificación de facilitador que rechaza la invitación
    static async createFacilitatorRejectedNotification(facilitator, lessonId, lessonTitle, adminUsers, suggestionAuthor, reason = '') {
        const reasonText = reason ? ` Motivo: ${reason}` : '';
        
        const notificationData = {
            type: 'lesson',
            title: 'Facilitador rechazó invitación',
            content: `${facilitator.name} ${facilitator.surname} ha rechazado ser facilitador de la lección "${lessonTitle}".${reasonText}`,
            link: `/admin/lecciones?lesson=${lessonId}&action=manage`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitator._id,
            priority: 'medium'
        };

        // Notificar a administradores
        const adminNotifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        // Notificar al autor de la sugerencia
        const authorNotification = {
            user: suggestionAuthor,
            type: 'lesson',
            title: 'El facilitador rechazó la invitación',
            content: `${facilitator.name} ${facilitator.surname} ha rechazado ser facilitador de tu lección sugerida "${lessonTitle}".${reasonText}`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitator._id,
            priority: 'medium'
        };

        const allNotifications = [...adminNotifications, authorNotification];
        return await Notification.insertMany(allNotifications);
    }

    // 19. Notificación de lección auto-aprobada por facilitador
    static async createLessonAutoApprovedByFacilitatorNotification(facilitator, lessonId, lessonTitle, adminUsers, suggestionAuthor) {
        const notificationData = {
            type: 'lesson',
            title: 'Lección aprobada automáticamente',
            content: `La lección "${lessonTitle}" ha sido aprobada automáticamente porque el facilitador ${facilitator.name} ${facilitator.surname} aceptó liderar el desarrollo`,
            link: `/admin/lecciones?lesson=${lessonId}&action=manage`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitator._id,
            priority: 'high'
        };

        // Notificar a administradores
        const adminNotifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        // Notificar al autor de la sugerencia
        const authorNotification = {
            user: suggestionAuthor,
            type: 'lesson',
            title: '¡Tu lección fue aprobada automáticamente!',
            content: `Tu lección "${lessonTitle}" ha sido aprobada automáticamente porque ${facilitator.name} ${facilitator.surname} aceptó ser el facilitador`,
            link: `/lessons/${lessonId}`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitator._id,
            priority: 'high'
        };

        const allNotifications = [...adminNotifications, authorNotification];
        return await Notification.insertMany(allNotifications);
    }

    // 20. Notificación al líder cuando facilitador aprueba lección (NUEVO FLUJO AUTÓNOMO)
    static async createFacilitatorApprovedLessonForLeaderNotification(facilitator, lessonId, lessonTitle, leaderId) {
        console.log('=== createFacilitatorApprovedLessonForLeaderNotification ===');
        console.log('Facilitator object:', facilitator);
        console.log('Lesson ID:', lessonId);
        console.log('Leader ID:', leaderId);
        
        const facilitatorId = facilitator._id || facilitator.sub || facilitator.id;
        console.log('Resolved facilitator ID:', facilitatorId);
        
        return await Notification.createNotification({
            user: leaderId,
            type: 'lesson',
            title: '¡Tu lección ha sido aprobada por el facilitador!',
            content: `${facilitator.name} ${facilitator.surname} ha aprobado tu lección "${lessonTitle}". Ahora puedes gestionar la convocatoria y activar la lección cuando tengas suficientes participantes.`,
            link: `/inicio/convocatorias?lesson=${lessonId}&action=manage`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: facilitatorId,
            priority: 'high'
        });
    }

    // ===== FUNCIONES PARA EXPERIENCIAS =====

    // 21. Notificación de experiencia enviada (al usuario)
    static async createExperienceSubmittedNotification(experienceAuthor, experienceId, experienceTitle) {
        return await Notification.createNotification({
            user: experienceAuthor,
            type: 'lesson',
            title: 'Experiencia enviada para revisión',
            content: `Tu experiencia "${experienceTitle}" se ha enviado correctamente y está siendo revisada por el administrador`,
            link: `/inicio/mis-lecciones`,
            relatedId: experienceId,
            relatedModel: 'Lesson',
            from: experienceAuthor,
            priority: 'medium'
        });
    }

    // 22. Notificación a administradores de nueva experiencia
    static async createNewExperiencePendingNotification(experienceAuthor, experienceId, experienceTitle, experienceType, adminUsers) {
        const notificationData = {
            type: 'lesson',
            title: 'Nueva experiencia enviada',
            content: `${experienceAuthor.name} ${experienceAuthor.surname} ha enviado una nueva experiencia "${experienceTitle}" de tipo ${experienceType}`,
            link: `/admin/lecciones`,
            relatedId: experienceId,
            relatedModel: 'Lesson',
            from: experienceAuthor._id,
            priority: 'medium'
        };

        const notifications = adminUsers.map(adminId => ({
            user: adminId,
            ...notificationData
        }));

        return await Notification.insertMany(notifications);
    }

    // 23. Notificación al facilitador sugerido para experiencia
    static async createExperienceFacilitatorSuggestionNotification(experienceAuthor, facilitatorId, experienceId, experienceTitle) {
        return await Notification.createNotification({
            user: facilitatorId,
            type: 'lesson',
            title: 'Te han sugerido como facilitador de una experiencia',
            content: `${experienceAuthor.name} ${experienceAuthor.surname} te ha sugerido como facilitador para la experiencia "${experienceTitle}". ¿Te interesa participar?`,
            link: `/inicio/asesorar-lecciones`,
            relatedId: lessonId,
            relatedModel: 'Lesson',
            from: experienceAuthor._id,
            priority: 'high'
        });
    }

    // 24. Notificación de experiencia aprobada
    static async createExperienceApprovedNotification(experienceAuthor, experienceId, experienceTitle, approvedBy) {
        return await Notification.createNotification({
            user: experienceAuthor,
            type: 'lesson',
            title: '¡Tu experiencia fue aprobada!',
            content: `Tu experiencia "${experienceTitle}" ha sido aprobada y ahora está visible en la red`,
            link: `/lessons/${experienceId}`,
            relatedId: experienceId,
            relatedModel: 'Lesson',
            from: approvedBy,
            priority: 'high'
        });
    }

    // 25. Notificación de experiencia rechazada
    static async createExperienceRejectedNotification(experienceAuthor, experienceId, experienceTitle, rejectedBy, reason = '') {
        const reasonText = reason ? ` Motivo: ${reason}` : '';
        return await Notification.createNotification({
            user: experienceAuthor,
            type: 'lesson',
            title: 'Tu experiencia necesita revisión',
            content: `Tu experiencia "${experienceTitle}" necesita ser revisada.${reasonText}`,
            link: `/lessons/${experienceId}`,
            relatedId: experienceId,
            relatedModel: 'Lesson',
            from: rejectedBy,
            priority: 'high'
        });
    }
    // ===== FUNCIONES ORIGINALES =====

    // Crear notificación de nueva lección
    static async createLessonNotification(fromUser, toUsers, lessonId, lessonTitle) {
        const notificationData = {
            type: 'lesson',
            title: 'Nueva lección disponible',
            content: `${fromUser.name} ${fromUser.surname} ha creado una nueva lección: "${lessonTitle}"`,
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
            content: `${fromUser.name} ${fromUser.surname} ha creado una nueva publicación: "${publicationTitle}"`,
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
            content: `${fromUser.name} ${fromUser.surname} comentó en "${resourceTitle}"`,
            link: `/resources/${commentId}`,
            relatedId: commentId,
            relatedModel: 'Comment',
            from: fromUser._id,
            priority: 'medium'
        });
    }

    // Crear notificación de mención en comentario/respuesta
    static async createMentionNotification(fromUser, mentionedUserId, publicationId, commentText, isReply = false) {
        const contentType = isReply ? 'una respuesta' : 'un comentario';
        
        const notificationData = {
            user: mentionedUserId,
            type: 'comment',
            title: `Te mencionaron en un ${contentType}`,
            content: `${fromUser.name} ${fromUser.surname} te mencionó en ${contentType}: "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
            link: `/inicio/publicacion/${publicationId}?highlight=comment`,
            relatedId: publicationId,
            relatedModel: 'Publication',
            from: fromUser._id,
            priority: 'medium'
        };

        return await Notification.createNotification(notificationData);
    }

    // Crear notificación de respuesta a comentario
    static async createReplyNotification(fromUser, commentOwnerId, publicationId, replyText) {
        const notificationData = {
            user: commentOwnerId,
            type: 'comment',
            title: 'Nueva respuesta a tu comentario',
            content: `${fromUser.name} ${fromUser.surname} respondió a tu comentario: "${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"`,
            link: `/inicio/publicacion/${publicationId}?highlight=comment`,
            relatedId: publicationId,
            relatedModel: 'Publication',
            from: fromUser._id,
            priority: 'medium'
        };

        return await Notification.createNotification(notificationData);
    }

    // Crear notificación de nuevo recurso
    static async createResourceNotification(fromUser, toUsers, resourceId, resourceTitle) {
        const notificationData = {
            type: 'resource',
            title: 'Nuevo recurso disponible',
            content: `${fromUser.name} ${fromUser.surname} ha compartido un nuevo recurso: "${resourceTitle}"`,
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

    // Crear notificación de mención en comentario/respuesta (DEPRECATED - Método duplicado)
    // Este método está duplicado y debería ser eliminado en futuras versiones
    static async createMentionNotificationOld(fromUser, mentionedUserId, publicationId, commentText, isReply = false) {
        console.warn('Using deprecated createMentionNotificationOld method. Use createMentionNotification instead.');
        return await this.createMentionNotification(fromUser, mentionedUserId, publicationId, commentText, isReply);
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