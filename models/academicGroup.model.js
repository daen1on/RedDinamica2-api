'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const academicGroupSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    teacher: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    students: [{
        type: Schema.ObjectId,
        ref: 'User'
    }],
    academicLevel: {
        type: String,
        required: true,
        enum: ['Colegio', 'Universidad']
    },
    grade: {
        type: String
    },
    maxStudents: {
        type: Number,
        default: 30,
        min: 1,
        max: 100
    },
    subjects: [{
        type: String,
        trim: true
    }],
    lessons: [{
        type: Schema.ObjectId,
        ref: 'AcademicLesson'
    }],
    statistics: {
        totalStudents: {
            type: Number,
            default: 0
        },
        totalLessons: {
            type: Number,
            default: 0
        },
        averageGrade: {
            type: Number,
            default: 0
        },
        activeLessons: {
            type: Number,
            default: 0
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    permissions: {
        studentsCanCreateLessons: {
            type: Boolean,
            default: true
        },
        studentsCanEditLessons: {
            type: Boolean,
            default: false
        },
        studentsCanDeleteLessons: {
            type: Boolean,
            default: false
        },
        studentsCanViewAllLessons: {
            type: Boolean,
            default: true
        }
    },
    // Sistema de discusión con hilos/threads
    discussionThreads: [{
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500
        },
        author: {
            type: Schema.ObjectId,
            ref: 'User',
            required: true
        },
        isPinned: {
            type: Boolean,
            default: false
        },
        isLocked: {
            type: Boolean,
            default: false
        },
        messages: [{
            content: {
                type: String,
                required: true,
                trim: true,
                maxlength: 2000
            },
            author: {
                type: Schema.ObjectId,
                ref: 'User',
                required: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Mantener discussion para compatibilidad con datos existentes
    discussion: [{
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
        author: {
            type: Schema.ObjectId,
            ref: 'User',
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Recursos asociados/importados al grupo
    resources: [{
        type: Schema.ObjectId,
        ref: 'Resource'
    }]
}, {
    timestamps: true
});

// Índices para optimizar consultas
academicGroupSchema.index({ teacher: 1 });
academicGroupSchema.index({ students: 1 });
academicGroupSchema.index({ academicLevel: 1, grade: 1 });
academicGroupSchema.index({ isActive: 1 });

// Método estático para obtener grados válidos según el nivel académico
academicGroupSchema.statics.getValidGrades = function(academicLevel) {
    const grades = {
        'Colegio': ['Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Undécimo'],
        'Universidad': ['Primer Semestre', 'Segundo Semestre', 'Tercer Semestre', 'Cuarto Semestre', 
                      'Quinto Semestre', 'Sexto Semestre', 'Séptimo Semestre', 'Octavo Semestre', 
                      'Noveno Semestre', 'Décimo Semestre']
    };
    
    return grades[academicLevel] || [];
};

// Método para inicializar thread general
academicGroupSchema.methods.initializeGeneralThread = function() {
    if (!this.discussionThreads || this.discussionThreads.length === 0) {
        this.discussionThreads = [{
            title: 'Conversación General',
            description: '¡Bienvenidos al foro del grupo! Este es un espacio para compartir dudas generales, ideas y colaborar con tus compañeros. No dudes en participar, tu opinión es importante para todos. 💬',
            author: this.teacher,
            isPinned: true,
            isLocked: false,
            messages: []
        }];
    }
};

// Método para actualizar estadísticas del grupo
academicGroupSchema.methods.updateStatistics = async function() {
    this.statistics.totalStudents = this.students.length;
    
    // Contar lecciones del grupo
    const lessonCount = await mongoose.model('AcademicLesson').countDocuments({ academicGroup: this._id });
    this.statistics.totalLessons = lessonCount;
    
    // Contar lecciones activas (todas excepto completed/graded)
    const activeLessonCount = await mongoose.model('AcademicLesson').countDocuments({ 
        academicGroup: this._id, 
        status: { $nin: ['completed', 'graded'] }
    });
    this.statistics.activeLessons = activeLessonCount;
    
    // Calcular promedio de calificaciones
    const lessons = await mongoose.model('AcademicLesson').find({ 
        academicGroup: this._id, 
        grade: { $exists: true, $ne: null } 
    });
    
    if (lessons.length > 0) {
        const totalGrade = lessons.reduce((sum, lesson) => sum + (lesson.grade || 0), 0);
        this.statistics.averageGrade = Math.round((totalGrade / lessons.length) * 100) / 100;
    } else {
        this.statistics.averageGrade = 0;
    }
    
    await this.save();
};

module.exports = mongoose.model('AcademicGroup', academicGroupSchema);
