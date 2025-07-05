'use strict';

const NotificationService = require('../services/notification.service');
const Follow = require('../models/follow.model');

class NotificationMiddleware {
    
    // Middleware para notificar cuando se crea un nuevo mensaje
    static async notifyNewMessage(req, res, next) {
        const originalSend = res.send;
        
        res.send = function(data) {
            // Solo procesar si la respuesta es exitosa
            if (res.statusCode === 200 || res.statusCode === 201) {
                try {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    
                    if (responseData.message && responseData.message._id) {
                        // Crear notificación asíncrona
                        NotificationService.createMessageNotification(
                            req.user,
                            responseData.message.receiver,
                            responseData.message._id
                        ).catch(err => console.error('Error creating message notification:', err));
                    }
                } catch (err) {
                    console.error('Error in message notification middleware:', err);
                }
            }
            
            originalSend.call(this, data);
        };
        
        next();
    }

    // Middleware para notificar cuando se crea una nueva lección
    static async notifyNewLesson(req, res, next) {
        const originalSend = res.send;
        
        res.send = async function(data) {
            // Solo procesar si la respuesta es exitosa
            if (res.statusCode === 200 || res.statusCode === 201) {
                try {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    
                    if (responseData.lesson && responseData.lesson._id) {
                        // Obtener seguidores del usuario
                        const follows = await Follow.find({ followed: req.user._id }).select('user');
                        const followerIds = follows.map(follow => follow.user);
                        
                        if (followerIds.length > 0) {
                            // Crear notificaciones asíncrona
                            NotificationService.createLessonNotification(
                                req.user,
                                followerIds,
                                responseData.lesson._id,
                                responseData.lesson.title
                            ).catch(err => console.error('Error creating lesson notification:', err));
                        }
                    }
                } catch (err) {
                    console.error('Error in lesson notification middleware:', err);
                }
            }
            
            originalSend.call(this, data);
        };
        
        next();
    }

    // Middleware para notificar cuando se crea una nueva publicación
    static async notifyNewPublication(req, res, next) {
        const originalSend = res.send;
        
        res.send = async function(data) {
            // Solo procesar si la respuesta es exitosa
            if (res.statusCode === 200 || res.statusCode === 201) {
                try {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    
                    if (responseData.publication && responseData.publication._id) {
                        // Obtener seguidores del usuario
                        const follows = await Follow.find({ followed: req.user._id }).select('user');
                        const followerIds = follows.map(follow => follow.user);
                        
                        if (followerIds.length > 0) {
                            // Crear notificaciones asíncrona
                            NotificationService.createPublicationNotification(
                                req.user,
                                followerIds,
                                responseData.publication._id,
                                responseData.publication.text.substring(0, 50) + '...'
                            ).catch(err => console.error('Error creating publication notification:', err));
                        }
                    }
                } catch (err) {
                    console.error('Error in publication notification middleware:', err);
                }
            }
            
            originalSend.call(this, data);
        };
        
        next();
    }

    // Middleware para notificar cuando alguien comienza a seguir
    static async notifyNewFollow(req, res, next) {
        const originalSend = res.send;
        
        res.send = function(data) {
            // Solo procesar si la respuesta es exitosa
            if (res.statusCode === 200 || res.statusCode === 201) {
                try {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    
                    if (responseData.follow && responseData.follow.followed) {
                        // Crear notificación asíncrona
                        NotificationService.createFollowNotification(
                            req.user,
                            responseData.follow.followed
                        ).catch(err => console.error('Error creating follow notification:', err));
                    }
                } catch (err) {
                    console.error('Error in follow notification middleware:', err);
                }
            }
            
            originalSend.call(this, data);
        };
        
        next();
    }

    // Middleware para notificar cuando se crea un nuevo recurso
    static async notifyNewResource(req, res, next) {
        const originalSend = res.send;
        
        res.send = async function(data) {
            // Solo procesar si la respuesta es exitosa
            if (res.statusCode === 200 || res.statusCode === 201) {
                try {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    
                    if (responseData.resource && responseData.resource._id) {
                        // Obtener seguidores del usuario
                        const follows = await Follow.find({ followed: req.user._id }).select('user');
                        const followerIds = follows.map(follow => follow.user);
                        
                        if (followerIds.length > 0) {
                            // Crear notificaciones asíncrona
                            NotificationService.createResourceNotification(
                                req.user,
                                followerIds,
                                responseData.resource._id,
                                responseData.resource.title
                            ).catch(err => console.error('Error creating resource notification:', err));
                        }
                    }
                } catch (err) {
                    console.error('Error in resource notification middleware:', err);
                }
            }
            
            originalSend.call(this, data);
        };
        
        next();
    }
}

module.exports = NotificationMiddleware; 