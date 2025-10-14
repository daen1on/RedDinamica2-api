'use strict'

var mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

var schema = mongoose.Schema;

var userSchema = schema({
    name:String,
    surname:String,
    password:String,
    email:String,
    about:String,
    role:String,
    canAdvise:{type:Boolean, default:false},
    actived:{type:Boolean, default:false},
    postgraduate:String,
    picture: String,
    knowledge_area:[String],
    profession:{type: schema.ObjectId, ref: 'Profession'},
    institution: {type: schema.ObjectId, ref: 'Institution'},
    city: {type: schema.ObjectId, ref: 'City'},
    visits:{type:Number, default:0},
    contactNumber:String,
    socialNetworks:String,
    created_at:String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    // Preferencias de comunicación
    emailDigestEnabled: { type: Boolean, default: true },
    
    // Configuraciones de privacidad para lecciones según DESIGN_LESSONS_PROFILE.md
    lessonsPrivacySettings: {
        showLessonsInProfile: { type: Boolean, default: true },
        hiddenLessonIds: [{ type: schema.ObjectId, ref: 'Lesson' }],
        allowCollaborationRequests: { type: Boolean, default: true }
    },
    
    // Campos académicos para RedDinámica-Académica
    academicGroups: [{
        type: schema.ObjectId,
        ref: 'AcademicGroup'
    }],
    teachingGroups: [{
        type: schema.ObjectId,
        ref: 'AcademicGroup'
    }],
    isStudent: {
        type: Boolean,
        default: false
    },
    studentBadge: {
        type: Boolean,
        default: false
    },
    academicProfile: {
        institution: {
            type: schema.ObjectId,
            ref: 'Institution'
        },
        academicYear: {
            type: String
        },
        academicLevel: {
            type: String,
            enum: ['Colegio', 'Universidad']
        },
        grade: {
            type: String
        },
        subjects: [{
            type: String
        }],
        studentId: {
            type: String
        },
        program: {
            type: String
        }
    },
    academicStatistics: {
        totalLessonsCreated: {
            type: Number,
            default: 0
        },
        totalLessonsParticipated: {
            type: Number,
            default: 0
        },
        averageGrade: {
            type: Number,
            default: 0
        },
        lessonsExported: {
            type: Number,
            default: 0
        }
    }
});
userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('User', userSchema);