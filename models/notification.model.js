'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // 'message', 'lesson', 'publication', etc.
    content: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
