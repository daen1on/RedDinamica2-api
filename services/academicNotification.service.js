'use strict';

const Notification = require('../models/notification.model');

class AcademicNotificationService {
    static async notifyLessonProposal(lesson, teacher) {
        try {
            const notification = new Notification({
                recipient: teacher,
                type: 'academic_lesson_proposal',
                title: 'Nueva propuesta de lección',
                message: `Se ha propuesto una nueva lección: "${lesson.title}"`,
                data: {
                    lessonId: lesson._id,
                    groupId: lesson.academicGroup,
                    authorId: lesson.author
                },
                priority: 'medium'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de propuesta de lección:', error);
        }
    }

    static async notifyLessonApproval(lesson, author) {
        try {
            const notification = new Notification({
                recipient: author,
                type: 'academic_lesson_approved',
                title: 'Lección aprobada',
                message: `Tu lección "${lesson.title}" ha sido aprobada`,
                data: {
                    lessonId: lesson._id,
                    groupId: lesson.academicGroup
                },
                priority: 'high'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de aprobación:', error);
        }
    }

    static async notifyLessonGraded(lesson, author) {
        try {
            const notification = new Notification({
                recipient: author,
                type: 'academic_lesson_graded',
                title: 'Lección calificada',
                message: `Tu lección "${lesson.title}" ha sido calificada`,
                data: {
                    lessonId: lesson._id,
                    grade: lesson.academicSettings.grade,
                    numericalGrade: lesson.academicSettings.numericalGrade
                },
                priority: 'high'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de calificación:', error);
        }
    }

    static async notifyStudentAdded(student, group) {
        try {
            const notification = new Notification({
                recipient: student,
                type: 'academic_group_joined',
                title: 'Te has unido a un grupo académico',
                message: `Has sido agregado al grupo "${group.name}"`,
                data: {
                    groupId: group._id,
                    teacherId: group.teacher
                },
                priority: 'medium'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de unión al grupo:', error);
        }
    }

    static async notifyLessonRejected(lesson, author, reason) {
        try {
            const notification = new Notification({
                recipient: author,
                type: 'academic_lesson_rejected',
                title: 'Lección rechazada',
                message: `Tu lección "${lesson.title}" ha sido rechazada: ${reason}`,
                data: {
                    lessonId: lesson._id,
                    groupId: lesson.academicGroup,
                    reason: reason
                },
                priority: 'high'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de rechazo:', error);
        }
    }

    static async notifyLessonExported(lesson, author) {
        try {
            const notification = new Notification({
                recipient: author,
                type: 'academic_lesson_exported',
                title: 'Lección exportada',
                message: `Tu lección "${lesson.title}" ha sido exportada a RedDinámica principal`,
                data: {
                    lessonId: lesson._id,
                    groupId: lesson.academicGroup
                },
                priority: 'high'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de exportación:', error);
        }
    }

    static async notifyGroupCreated(group, students) {
        try {
            const notifications = students.map(student => new Notification({
                recipient: student,
                type: 'academic_group_created',
                title: 'Nuevo grupo académico',
                message: `Se ha creado el grupo "${group.name}"`,
                data: {
                    groupId: group._id,
                    teacherId: group.teacher
                },
                priority: 'medium'
            }));

            await Notification.insertMany(notifications);
        } catch (error) {
            console.error('Error al enviar notificaciones de grupo creado:', error);
        }
    }

    static async notifyDeadlineApproaching(lesson, author, daysLeft) {
        try {
            const notification = new Notification({
                recipient: author,
                type: 'academic_deadline_approaching',
                title: 'Fecha límite próxima',
                message: `La fecha límite de tu lección "${lesson.title}" está a ${daysLeft} días`,
                data: {
                    lessonId: lesson._id,
                    groupId: lesson.academicGroup,
                    daysLeft: daysLeft
                },
                priority: 'medium'
            });

            await notification.save();
        } catch (error) {
            console.error('Error al enviar notificación de fecha límite:', error);
        }
    }
}

module.exports = AcademicNotificationService;
