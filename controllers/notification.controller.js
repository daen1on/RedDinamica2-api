'use strict';

const Notification = require('../models/notification.model');

// Obtener notificaciones del usuario con paginación y filtros
exports.getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';
        const type = req.query.type;

        // Construir filtro
        let filter = { user: req.user.sub };
        if (unreadOnly) {
            filter.read = false;
        }
        if (type) {
            filter.type = type;
        }

        const notifications = await Notification.find(filter)
            .populate('from', 'name lastname image')
            .sort('-created_at')
            .skip(skip)
            .limit(limit)
            .exec();
        
        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({ 
            user: req.user.sub, 
            read: false 
        });
        
        return res.status(200).send({ 
            notifications,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                count: notifications.length,
                totalItems: total
            },
            unreadCount
        });
    } catch (err) {
        console.error('Error getting notifications:', err);
        return res.status(500).send({ message: 'Error en la petición' });
    }
};

// Marcar notificación como leída
exports.markAsRead = async (req, res) => {
    try {
        const notificationId = req.params.id;
        const notification = await Notification.findOne({
            _id: notificationId,
            user: req.user.sub
        });
        
        if (!notification) {
            return res.status(404).send({ message: 'Notificación no encontrada' });
        }

        await notification.markAsRead();
        
        return res.status(200).send({ 
            message: 'Notificación marcada como leída',
            notification 
        });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        return res.status(500).send({ message: 'Error en la petición' });
    }
};

// Marcar todas las notificaciones como leídas
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.sub, read: false },
            { 
                read: true, 
                read_at: new Date() 
            }
        );
        
        return res.status(200).send({ 
            message: 'Todas las notificaciones marcadas como leídas' 
        });
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
        return res.status(500).send({ message: 'Error en la petición' });
    }
};

// Obtener conteo de notificaciones no leídas
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ 
            user: req.user.sub, 
            read: false 
        });
        
        return res.status(200).send({ unreadCount: count });
    } catch (err) {
        console.error('Error getting unread count:', err);
        return res.status(500).send({ message: 'Error en la petición' });
    }
};

// Eliminar notificación
exports.deleteNotification = async (req, res) => {
    try {
        const notificationId = req.params.id;
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            user: req.user.sub
        });
        
        if (!notification) {
            return res.status(404).send({ message: 'Notificación no encontrada' });
        }
        
        return res.status(200).send({ 
            message: 'Notificación eliminada correctamente' 
        });
    } catch (err) {
        console.error('Error deleting notification:', err);
        return res.status(500).send({ message: 'Error en la petición' });
    }
};

// Crear notificación via HTTP endpoint
exports.createNotification = async (req, res) => {
    try {
        const notificationData = req.body;
        
        // Validar datos requeridos
        if (!notificationData.user || !notificationData.type || !notificationData.title || !notificationData.content) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos: user, type, title, content' 
            });
        }

        const notification = await Notification.createNotification(notificationData);
        
        return res.status(201).send({
            message: 'Notificación creada correctamente',
            notification: notification
        });
    } catch (err) {
        console.error('Error creating notification:', err);
        return res.status(500).send({ message: 'Error creando la notificación' });
    }
};

// Crear notificación (función auxiliar para otros controladores)
exports.createNotificationHelper = async (data) => {
    try {
        return await Notification.createNotification(data);
    } catch (err) {
        console.error('Error creating notification:', err);
        throw err;
    }
};

// Crear notificación múltiple (para notificar a varios usuarios)
exports.createMultipleNotifications = async (users, notificationData) => {
    try {
        const notifications = users.map(userId => ({
            user: userId,
            ...notificationData
        }));
        
        return await Notification.insertMany(notifications);
    } catch (err) {
        console.error('Error creating multiple notifications:', err);
        throw err;
    }
};
