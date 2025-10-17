// script para limpiar referencias de un usuario eliminado
// npm run cleanup:orphan-refs <userId>
// usar en caso de que un usuario haya sido eliminado y quede referencias en otros modelos
'use strict';

const path = require('path'); // <-- 1. Import path module
// 2. Point to the .env file in the parent directory (project root)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');

const User = require('../models/user.model');
const Follow = require('../models/follow.model');
const Message = require('../models/message.model');
const Publication = require('../models/publication.model');
const Comment = require('../models/comment.model');
const Lesson = require('../models/lesson.model');
const AcademicLesson = require('../models/academicLesson.model');
const AcademicGroup = require('../models/academicGroup.model');
const Notification = require('../models/notification.model');
const Resource = require('../models/resource.model');
const ErrorReport = require('../models/errorReport.model');
const NewModel = require('../models/new.model');

async function connect() {
    const MONGO_HOST = process.env.MONGO_HOST;
    const MONGO_PORT = process.env.MONGO_PORT;
    const MONGO_DB = process.env.MONGO_DB;
    const uri = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
    console.log(`[cleanup-orphan-user-refs] Connecting to ${uri}`);
    await mongoose.connect(uri, { family: 4 });
}

function toObjectId(id) {
    try {
        return mongoose.Types.ObjectId(id);
    } catch {
        return null;
    }
}

async function cleanupUserReferences(userId) {
    const targetId = toObjectId(userId);
    if (!targetId) throw new Error('userId inválido');

    const results = {};

    // Follows: eliminar follows donde user o followed es el user
    results.followsRemoved = await Follow.deleteMany({ $or: [{ user: targetId }, { followed: targetId }] });

    // Mensajes directos: eliminar mensajes donde el emisor o receptor es el user
    results.messagesRemoved = await Message.deleteMany({ $or: [{ emitter: targetId }, { receiver: targetId }] });

    // Publications: eliminar publicaciones del user; quitar likes del user en otras publicaciones
    results.publicationsRemoved = await Publication.deleteMany({ user: targetId });
    results.publicationLikesPulled = await Publication.updateMany(
        { likes: targetId },
        { $pull: { likes: targetId } }
    );

    // Comments: eliminar comentarios del user; quitar likes del user en comentarios; anular mentionedUser igual al user
    const userCommentIds = await Comment.find({ user: targetId }).distinct('_id');
    results.commentsRemoved = await Comment.deleteMany({ _id: { $in: userCommentIds } });
    results.commentLikesPulled = await Comment.updateMany(
        { likes: targetId },
        { $pull: { likes: targetId } }
    );
    results.commentsMentionCleared = await Comment.updateMany(
        { mentionedUser: targetId },
        { $set: { mentionedUser: null } }
    );

    // Limpiar referencias a esos comentarios borrados en publicaciones
    if (userCommentIds && userCommentIds.length > 0) {
        results.publicationCommentsPulled = await Publication.updateMany(
            { comments: { $in: userCommentIds } },
            { $pull: { comments: { $in: userCommentIds } } }
        );
    } else {
        results.publicationCommentsPulled = { modifiedCount: 0 };
    }

    // Lessons (modelo legacy): anular campos de usuario y sacar del arreglo development_group; limpiar likes
    results.lessonsUpdated = await Lesson.updateMany(
        { $or: [ { expert: targetId }, { author: targetId }, { leader: targetId }, { suggested_facilitator: targetId }, { development_group: targetId } ] },
        {
            $set: {
                expert: null,
                author: null,
                leader: null,
                suggested_facilitator: null
            },
            $pull: {
                development_group: targetId,
                likes: targetId
            }
        }
    );
    // Conversaciones embebidas en Lesson
    results.lessonConversationsPulled = await Lesson.updateMany(
        { },
        {
            $pull: {
                conversations: { author: targetId },
                expert_comments: { author: targetId }
            }
        }
    );

    // AcademicLesson: campos directos y arrays con refs a User; likes; messages en subdocumentos
    results.academicLessonsUpdated = await AcademicLesson.updateMany(
        { $or: [ { author: targetId }, { teacher: targetId }, { leader: targetId } ] },
        {
            $set: {
                author: null,
                teacher: null,
                leader: null
            }
        }
    );
    results.academicLessonsDevGroupPulled = await AcademicLesson.updateMany(
        { 'development_group.user': targetId },
        { $pull: { development_group: { user: targetId } } }
    );
    results.academicLessonsLikesPulled = await AcademicLesson.updateMany(
        { likes: targetId },
        { $pull: { likes: targetId } }
    );
    // AcademicLesson.calls: separar actualizaciones para evitar conflictos y ser precisos
    results.academicLessonsCallsUpdated = await AcademicLesson.updateMany(
        { 'calls.author': targetId },
        { $set: { 'calls.$[call].author': null } },
        { arrayFilters: [ { 'call.author': targetId } ] }
    );
    results.academicLessonsCallsInterestedPulled = await AcademicLesson.updateMany(
        { 'calls.interested': targetId },
        { $pull: { 'calls.$[].interested': targetId } }
    );
    results.academicLessonsFilesPulled = await AcademicLesson.updateMany(
        { 'files.uploadedBy': targetId },
        { $pull: { files: { uploadedBy: targetId } } }
    );
    results.academicLessonsMessagesPulled = await AcademicLesson.updateMany(
        { 'conversations.messages.author': targetId },
        { $pull: { 'conversations.$[].messages': { author: targetId } } }
    );
    results.academicLessonsParticipantsPulled = await AcademicLesson.updateMany(
        { 'conversations.participants': targetId },
        { $pull: { 'conversations.$[].participants': targetId } }
    );

    // AcademicGroup: dividir operaciones para evitar conflictos en el mismo array
    // 1) teacher/students
    results.academicGroupsBasicUpdated = await AcademicGroup.updateMany(
        { $or: [ { teacher: targetId }, { students: targetId } ] },
        { $set: { teacher: null }, $pull: { students: targetId } }
    );
    // 2) remover mensajes del usuario dentro de cada thread
    results.academicGroupsThreadMessagesPulled = await AcademicGroup.updateMany(
        { 'discussionThreads.messages.author': targetId },
        { $pull: { 'discussionThreads.$[].messages': { author: targetId } } }
    );
    // 3) remover threads cuyo autor es el usuario
    results.academicGroupsThreadsPulled = await AcademicGroup.updateMany(
        { 'discussionThreads.author': targetId },
        { $pull: { discussionThreads: { author: targetId } } }
    );
    // 4) remover entradas en arreglo legacy discussion
    results.academicGroupsDiscussionPulled = await AcademicGroup.updateMany(
        { 'discussion.author': targetId },
        { $pull: { discussion: { author: targetId } } }
    );

    // Notifications: quitar notificaciones emitidas por o para el usuario
    results.notificationsRemoved = await Notification.deleteMany({ $or: [ { user: targetId }, { from: targetId } ] });

    // Resources: anular author
    results.resourcesUpdated = await Resource.updateMany(
        { author: targetId },
        { $set: { author: null } }
    );

    // ErrorReports: anular reporter / reportedUserId
    results.errorReportsUpdated = await ErrorReport.updateMany(
        { $or: [ { reporter: targetId }, { reportedUserId: targetId } ] },
        { $set: { reporter: null, reportedUserId: null } }
    );

    // News: anular author
    results.newsUpdated = await NewModel.updateMany(
        { author: targetId },
        { $set: { author: null } }
    );

    return results;
}

async function main() {
    const userId = process.argv[2];
    if (!userId) {
        console.error('Uso: node scripts/cleanup-orphan-user-refs.js <userId>');
        process.exit(1);
    }

    try {
        await connect();
        const exists = await User.findById(userId).lean();
        if (exists) {
            console.warn('El usuario aún existe. Este script está pensado para limpiar referencias tras su eliminación.');
        }
        const res = await cleanupUserReferences(userId);
        console.log('Resultados limpieza:', Object.fromEntries(
            Object.entries(res).map(([k, v]) => [k, v && v.deletedCount !== undefined ? v.deletedCount : (v && v.modifiedCount !== undefined ? v.modifiedCount : v)])
        ));
    } catch (err) {
        console.error('Error ejecutando limpieza:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = { cleanupUserReferences };


