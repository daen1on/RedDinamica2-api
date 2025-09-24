'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Esquemas reutilizados del modelo Lesson
const callSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    participants: [{
        type: Schema.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    }
});

const fileSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

const messageSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    edited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    }
});

const academicLessonSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    resume: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    academicGroup: {
        type: Schema.ObjectId,
        ref: 'AcademicGroup',
        required: true
    },
    author: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    teacher: {
        type: Schema.ObjectId,
        ref: 'User'
    },
    level: {
        type: String,
        required: true,
        enum: ['Básico', 'Intermedio', 'Avanzado', 'Colegio']
    },
    objectives: {
        type: String,
        required: true,
        trim: true
    },
    methodology: {
        type: String,
        required: true,
        trim: true
    },
    evaluation: {
        type: String,
        required: true,
        trim: true
    },
    resources: {
        type: String,
        trim: true
    },
    duration: {
        type: Number,
        required: true,
        min: 1,
        max: 480 // 8 horas máximo
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['Fácil', 'Moderado', 'Difícil']
    },
    status: {
        type: String,
        required: true,
        enum: ['draft', 'proposed', 'approved', 'rejected', 'completed', 'graded'],
        default: 'draft'
    },
    grade: {
        type: Number,
        min: 0,
        max: 5
    },
    feedback: {
        type: String,
        trim: true
    },
    isExported: {
        type: Boolean,
        default: false
    },
    exportedLesson: {
        type: Schema.ObjectId,
        ref: 'Lesson'
    },
    academicSettings: {
        academicLevel: {
            type: String,
            enum: ['Colegio', 'Universidad']
        },
        grade: {
            type: String
        },
        subjects: [{
            type: String
        }]
    },
    progress: {
        completed: {
            type: Boolean,
            default: false
        },
        completedAt: {
            type: Date
        },
        timeSpent: {
            type: Number,
            default: 0
        }
    },
    // Herencia de funcionalidades de Lesson
    calls: [callSchema],
    files: [fileSchema],
    messages: [messageSchema],
    views: {
        type: Number,
        default: 0
    },
    likes: [{
        type: Schema.ObjectId,
        ref: 'User'
    }],
    comments: [{
        content: {
            type: String,
            required: true
        },
        author: {
            type: Schema.ObjectId,
            ref: 'User',
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        replies: [{
            content: {
                type: String,
                required: true
            },
            author: {
                type: Schema.ObjectId,
                ref: 'User',
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }]
    }],
    // Timestamps para seguimiento
    proposedAt: {
        type: Date
    },
    approvedAt: {
        type: Date
    },
    rejectedAt: {
        type: Date
    },
    gradedAt: {
        type: Date
    },
    exportedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Índices para optimizar consultas
academicLessonSchema.index({ academicGroup: 1 });
academicLessonSchema.index({ author: 1 });
academicLessonSchema.index({ teacher: 1 });
academicLessonSchema.index({ status: 1 });
academicLessonSchema.index({ isExported: 1 });
academicLessonSchema.index({ 'academicSettings.academicLevel': 1, 'academicSettings.grade': 1 });

// Middleware pre-save para actualizar timestamps
academicLessonSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        switch (this.status) {
            case 'proposed':
                this.proposedAt = new Date();
                break;
            case 'approved':
                this.approvedAt = new Date();
                break;
            case 'rejected':
                this.rejectedAt = new Date();
                break;
            case 'graded':
                this.gradedAt = new Date();
                break;
        }
    }
    next();
});

// Método para proponer lección
academicLessonSchema.methods.propose = function() {
    if (this.status !== 'draft') {
        throw new Error('Solo se pueden proponer lecciones en borrador');
    }
    this.status = 'proposed';
    this.proposedAt = new Date();
    return this.save();
};

// Método para completar lección
academicLessonSchema.methods.complete = function() {
    if (this.status !== 'approved') {
        throw new Error('Solo se pueden completar lecciones aprobadas');
    }
    this.status = 'completed';
    this.progress.completed = true;
    this.progress.completedAt = new Date();
    return this.save();
};

// Método para agregar vista
academicLessonSchema.methods.addView = function() {
    this.views += 1;
    return this.save();
};

// Método para agregar like
academicLessonSchema.methods.addLike = function(userId) {
    if (!this.likes.includes(userId)) {
        this.likes.push(userId);
    }
    return this.save();
};

// Método para remover like
academicLessonSchema.methods.removeLike = function(userId) {
    this.likes = this.likes.filter(id => id.toString() !== userId.toString());
    return this.save();
};

// Método para agregar comentario
academicLessonSchema.methods.addComment = function(content, authorId) {
    this.comments.push({
        content,
        author: authorId
    });
    return this.save();
};

// Método para agregar respuesta a comentario
academicLessonSchema.methods.addReply = function(commentIndex, content, authorId) {
    if (this.comments[commentIndex]) {
        this.comments[commentIndex].replies.push({
            content,
            author: authorId
        });
    }
    return this.save();
};

// Método para agregar mensaje al chat
academicLessonSchema.methods.addMessage = function(content, authorId) {
    this.messages.push({
        content,
        author: authorId
    });
    return this.save();
};

// Método para agregar archivo
academicLessonSchema.methods.addFile = function(fileData) {
    this.files.push(fileData);
    return this.save();
};

// Método para programar llamada
academicLessonSchema.methods.scheduleCall = function(callData) {
    this.calls.push(callData);
    return this.save();
};

module.exports = mongoose.model('AcademicLesson', academicLessonSchema);
