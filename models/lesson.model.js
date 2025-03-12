'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const callSchema = new Schema({
    text: String,
    visible: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    interested: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    created_at: { type: Date, default: Date.now }
});

const fileSchema = new Schema({
    originalName: String,
    mimetype: String,
    size: Number,
    fileName: String,
    groupTitle: String,
    created_at: { type: Date, default: Date.now }
});

const messageSchema = new Schema({
    text: String,
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    file: fileSchema,
    conversationTitle: String,
    created_at: { type: Date, default: Date.now }
});

const lessonSchema = new Schema({
    title: String,
    resume: String,
    references: String,
    justification: String,
    development_level: String,
    level: [String],
    state: String,
    type: String,
    call: callSchema,
    expert: { type: Schema.Types.ObjectId, ref: 'User' },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    leader: { type: Schema.Types.ObjectId, ref: 'User' },
    development_group: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    created_at:String,
    visible: { type: Boolean, default: false },
    accepted: { type: Boolean, default: false },
    knowledge_area: [{ type: Schema.Types.ObjectId, ref: 'Knowledge-area' }],
    views: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    conversations: [messageSchema],
    expert_comments: [messageSchema],
    comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    files: [fileSchema],
    father_lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    son_lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    version: { type: Number, default: 1 }
});

// Enable pagination
lessonSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Lesson', lessonSchema);
