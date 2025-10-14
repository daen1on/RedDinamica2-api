'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        required: true,
        enum: ['message', 'lesson', 'publication', 'comment', 'follow', 'resource', 'system', 'group']
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    link: { type: String },
    relatedId: { type: Schema.Types.ObjectId }, // ID del objeto relacionado (mensaje, lección, etc.)
    relatedModel: { type: String }, // Nombre del modelo relacionado
    from: { type: Schema.Types.ObjectId, ref: 'User' }, // Usuario que generó la notificación
    read: { type: Boolean, default: false },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
    },
    created_at: { type: Date, default: Date.now },
    read_at: { type: Date }
});

// Índices para mejorar rendimiento
notificationSchema.index({ user: 1, created_at: -1 });
notificationSchema.index({ user: 1, read: 1 });

// Método para marcar como leída
notificationSchema.methods.markAsRead = function() {
    this.read = true;
    this.read_at = new Date();
    return this.save();
};

// Método estático para crear notificación
notificationSchema.statics.createNotification = function(data) {
    const notification = new this({
        user: data.user,
        type: data.type,
        title: data.title,
        content: data.content,
        link: data.link,
        relatedId: data.relatedId,
        relatedModel: data.relatedModel,
        from: data.from,
        priority: data.priority || 'medium'
    });
    return notification.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
