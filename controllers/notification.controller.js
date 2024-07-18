'use strict';

const Notification = require('../models/notification.model');

exports.getNotifications = (req, res) => {
    Notification.find({ user: req.user._id })
        .sort('-created_at')
        .exec((err, notifications) => {
            if (err) return res.status(500).send({ message: 'Error en la petición' });
            if (!notifications) return res.status(404).send({ message: 'No hay notificaciones' });
            return res.status(200).send({ notifications });
        });
};

exports.markAsRead = (req, res) => {
    const notificationId = req.params.id;
    Notification.findByIdAndUpdate(notificationId, { read: true }, { new: true }, (err, notificationUpdated) => {
        if (err) return res.status(500).send({ message: 'Error en la petición' });
        if (!notificationUpdated) return res.status(404).send({ message: 'No se ha podido actualizar la notificación' });
        return res.status(200).send({ notification: notificationUpdated });
    });
};
