'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const LESSON_PATH = './uploads/lessons/';
const mail = require('../services/mail.service');
const mongoosePaginate = require('mongoose-pagination');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const Lesson = require('../models/lesson.model');
const Comment = require('../models/comment.model');

const saveLesson = async (req, res) => {
    const params = req.body;
    const lesson = new Lesson(params);
    lesson.created_at = moment().unix();
    try {
        const lessonStored = await lesson.save();
        switch (params.class) {
            case 'suggest':
                mail.sendMail(
                    'Nueva sugerencia de lección',
                    process.env.EMAIL,
                    ` <h3>Hola ${process.env.NAME}</h3> <p> Se ha registrado una sugerencia para lección con el título: </p> <p> <strong>"${lessonStored.title}"</strong> </p> <p> Ingresa al <strong>panel de administración > Lecciones > Propuestas </strong> de reddinámica para revisar la información de la nueva propuesta. </p> `
                );
                break;
            case 'experience':
                mail.sendMail(
                    'Nueva experencia registrada',
                    process.env.EMAIL,
                    ` <h3>Hola ${process.env.NAME}</h3> <p> Se ha registrado una experiencia con el título: </p> <p> <strong>"${lessonStored.title}"</strong> </p> <p> Ingresa al <strong>panel de administración > Lecciones > Experiencias </strong> de reddinámica para revisar la información de la nueva propuesta. </p> `
                );
                break;
        }
        return res.status(200).send({ lesson: lessonStored });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lesson can not be saved' });
    }
};

const uploadLessonFiles = async (req, res) => {
    if (req.files) {
        return res.status(200).send({ message: 'The files were uploaded correctly' });
    }
};
const getLessonFile = async (req, res) => {
    const file = req.params.file;
    const pathFile = path.resolve(LESSON_PATH, file);
    try {
        fs.statSync(pathFile);
        return res.sendFile(pathFile);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(200).send({ message: 'The file does not exits' });
        } else {
            return res.status(500).send({ message: 'Error requesting the file.' });
        }
    }
};
const deleteLesson = async (req, res) => {
    const lessonId = req.params.id;
    try {
        const lessonRemoved = await Lesson.findByIdAndRemove({ user: req.user.sub, '_id': lessonId });
        await Comment.deleteMany({ '_id': { '$in': lessonRemoved.comments } });
        return res.status(200).send({ lesson: lessonRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. It can not be removed the lesson' });
    }
};
const updateLesson = async (req, res) => {
    const lessonId = req.params.id;
    const updateData = req.body;
    if(updateData.call){
        updateData.call.created_at = moment().unix();
    }
    try {
        const lessonUpdated = await Lesson.findByIdAndUpdate(lessonId, updateData, { new: true })
            .populate('development_group', 'name surname picture role _id')
            .populate('author', 'name surname picture role _id')
            .populate('expert', 'name surname picture role _id')
            .populate('leader', 'name surname picture role _id')
            .populate('call.interested', 'name surname role picture _id created_at')
            .populate('conversations.author', 'name surname picture role _id')
            .populate('expert_comments.author', 'name surname picture role _id')
            .populate({ path: 'comments', populate: { path: 'user', select: 'name surname picture _id' } });
        return res.status(200).send({ lesson: lessonUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lesson can not be updated' });
    }
};
const getLesson = async (req, res) => {
    const lessonId = req.params.id;
    try {
        const lesson = await Lesson.findById(lessonId)
            .populate('development_group', 'name surname picture role _id')
            .populate('author', 'name surname picture role _id')
            .populate('expert', 'name surname picture role _id')
            .populate('leader', 'name surname picture role _id')
            .populate('knowledge_area', 'name')
            .populate('conversations.author', 'name surname picture role _id')
            .populate('expert_comments.author', 'name surname picture role _id')
            .populate({ path: 'comments', populate: { path: 'user', select: 'name surname picture _id' } })
            .populate('son_lesson','_id visible');
        return res.status(200).send({ lesson });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. lesson can not be found' });
    }
};
const getLessons = async (req, res) => {
    const page = req.params.page;
    let findQuery = { accepted: true };
    if (req.params.visibleOnes == 'true') {
        findQuery.visible = true;
    }
    try {
        const lessons = await Lesson.find(findQuery).sort({created_at:-1})
            .populate('development_group', 'name surname picture role _id')
            .populate('author', 'name surname picture role _id')
            .populate('expert', 'name surname picture role _id')
            .populate('leader', 'name surname picture role _id')
            .populate('knowledge_area', 'name')
            .populate('call.interested', 'name surname role picture _id')
            .paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ lessons: lessons, total: total, pages: Math.ceil(total / ITEMS_PER_PAGE) });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lessons were not found' });
    }
};

const getAllLessons = async (req, res) => {
    let order = {};
    let findQuery = { accepted: true };
    if (req.params.visibleOnes == 'true') {
        findQuery.visible = true;
    }
    if (req.params.order) {
        if(req.params.order == 'views'){
            order.views = -1;
        }else{
            order.score = -1;
        }
    }else{
        order.created_at = 1;
    }
    try {
        const lessons = await Lesson.find(findQuery).sort(order).sort({created_at:-1})
            .populate('development_group', 'name surname picture role _id')
            .populate('author', 'name surname picture role _id')
            .populate('expert', 'name surname picture role _id')
            .populate('leader', 'name surname picture role _id')
            .populate('knowledge_area', 'name')
            .populate('call.interested', 'name surname role picture _id');
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lessons were not found' });
    }
};

const getMyLessons = async (req, res) => {
    const page = req.params.page;
    const userId = req.user.sub;
    try {
        const lessons = await Lesson.find({ "accepted": true, $or: [ { "author": userId }, { "development_group": { $all: userId } } ] })
            .sort({created_at:-1})
            .populate('knowledge_area', 'name')
            .populate('development_group', 'name surname picture role _id')
            .paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lessons were not found' });
    }
};

const getAllMyLessons = async (req, res) => {
    const userId = req.user.sub;
    try {
        const lessons = await Lesson.find({ "accepted": true, $or: [ { "author": userId }, { "development_group": { $all: userId } } ] })
            .sort({created_at:-1})
            .populate('knowledge_area', 'name')
            .populate('development_group', 'name surname picture role _id');
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lessons were not found' });
    }
};
const getLessonsToAdvise = async (req, res) => {
    const page = req.params.page;
    const userId = req.user.sub;
    try {
        const lessons = await Lesson.find({ "expert": userId })
            .sort({created_at:-1})
            .populate('knowledge_area', 'name')
            .populate('development_group', 'name surname picture role _id')
            .paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lessons were not found' });
    }
};

const getAllLessonsToAdvise = async (req, res) => {
    const userId = req.user.sub;
    try {
        const lessons = await Lesson.find({ "expert": userId })
            .sort({created_at:-1})
            .populate('knowledge_area', 'name');
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The lessons were not found' });
    }
};

const getSuggestLessons = async (req, res) => {
    const page = req.params.page || 1;
    try {
        const lessons = await Lesson.find({ justification: { $ne: null }, accepted: false })
            .populate('author', 'name surname picture role _id')
            .sort({created_at:-1}).paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. Could not get records' });
    }
};

const getExperiences = async (req, res) => {
    const page = req.params.page || 1;
    try {
        const lessons = await Lesson.find({ development_level: { $ne: null }, type: { $ne: null }, accepted: false })
            .populate('author', 'name surname picture role _id')
            .populate('knowledge_area', 'name')
            .sort({created_at:-1}).paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. Could not get records' });
    }
};

const removeFilesOfUpdates = async (res, httpCode, filePath, message) => {
    try {
        await fs.unlink(filePath);
        return res.status(httpCode).send({ message: message });
    } catch (err) {
        return res.status(httpCode).send({ message: message });
    }
};

const getCalls = async (req, res) => {
    const page = req.params.page || 1;
    try {
        const lessons = await Lesson.find({ "call.visible": true }).sort({created_at:-1})
            .populate('call.interested', 'name surname role picture _id')
            .populate('knowledge_area', 'name')
            .paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. Could not get records' });
    }
};

const getAllCalls = async (req, res) => {
    try {
        const lessons = await Lesson.find({ "call.visible": true }).sort({created_at:-1})
            .populate('call.interested', 'name surname role picture _id')
            .populate('knowledge_area', 'name');
        return res.status(200).send({ lessons });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. Could not get records' });
    }
};
module.exports = {
    saveLesson,
    deleteLesson,
    updateLesson,
    getLessons,
    getLesson,
    getAllLessons,
    getMyLessons,
    getAllMyLessons,
    getLessonsToAdvise,
    getAllLessonsToAdvise,
    getSuggestLessons,
    getCalls,
    getAllCalls,
    getExperiences,
    uploadLessonFiles,
    getLessonFile
}



