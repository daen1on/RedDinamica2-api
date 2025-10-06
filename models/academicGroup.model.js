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
        type: String,
        required: true
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
            default: false
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
    // Discusión general del grupo
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

// Método estático para validar un grado específico
academicGroupSchema.statics.validateGrade = function(academicLevel, grade) {
    const validGrades = this.getValidGrades(academicLevel);
    return validGrades.includes(grade);
};

// Middleware pre-save para validar el grado
academicGroupSchema.pre('save', function(next) {
    if (!this.constructor.validateGrade(this.academicLevel, this.grade)) {
        const validGrades = this.constructor.getValidGrades(this.academicLevel);
        return next(new Error(`Grado inválido para el nivel ${this.academicLevel}. Grados válidos: ${validGrades.join(', ')}`));
    }
    next();
});

// Método para actualizar estadísticas del grupo
academicGroupSchema.methods.updateStatistics = async function() {
    this.statistics.totalStudents = this.students.length;
    
    // Contar lecciones del grupo
    const lessonCount = await mongoose.model('AcademicLesson').countDocuments({ academicGroup: this._id });
    this.statistics.totalLessons = lessonCount;
    
    // Contar lecciones activas
    const activeLessonCount = await mongoose.model('AcademicLesson').countDocuments({ 
        academicGroup: this._id, 
        status: 'active' 
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
