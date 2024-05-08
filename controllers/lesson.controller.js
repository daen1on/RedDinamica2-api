'use strict';

const Lesson = require('../models/lesson.model');
const Comment = require('../models/comment.model');
const mail = require('../services/mail.service');
const fs = require('fs').promises; // Use promise-based version of fs
const path = require('path');
const { ITEMS_PER_PAGE } = require('../config');

// Simplify error handling with a middleware-like approach
const handleError = (res, message = 'Request failed', statusCode = 500) => {
    return res.status(statusCode).send({ message });
};
const sendPaginatedResponse = (res, data) => {
    if (!data || !data.docs || data.docs.length === 0) {
        return res.status(200).send({
            message: 'No lessons found',
            lessons: [],
            total: 0,
            pages: 0,
            currentPage: data.page || 1
        });
    }
    return res.status(200).send({
        lessons: data.docs,
        total: data.totalDocs,
        pages: data.totalPages,
        currentPage: data.page
    });
};

const saveLesson = async (req, res) => {
    const { body: params } = req;
    const lesson = new Lesson({ ...params, created_at: new Date() });

    try {
        const lessonStored = await lesson.save();
        const emailSubject = params.class === 'suggest' ? 'Nueva sugerencia de lección' : 'Nueva experencia registrada';
        const emailBody = `<h3>Hola</h3><p>Se ha registrado una ${params.class === 'suggest' ? 'sugerencia' : 'experiencia'} con el título:</p><p><strong>"${lessonStored.title}"</strong></p><p>Ingresa al panel de administración para revisar la información de la nueva propuesta.</p>`;

        mail.sendMail(emailSubject, process.env.EMAIL, emailBody);

        return res.status(200).send({ lesson: lessonStored });
    } catch (err) {
        console.error(err);
        return handleError(res, 'Error in the request. The lesson cannot be saved');
    }
};

const uploadLessonFiles = async (req, res) => {
    if (req.files) {
        return res.status(200).send({ message: 'The files were uploaded correctly' });
    }
    return handleError(res, 'No files uploaded', 400);
};

const getLessonFile = async (req, res) => {
    const { file } = req.params;
    const pathFile = path.resolve(LESSON_PATH, file);

    try {
        await fs.access(pathFile);
        return res.sendFile(pathFile);
    } catch (err) {
        const message = err.code === 'ENOENT' ? 'The file does not exist' : 'Error requesting the file.';
        return handleError(res, message, err.code === 'ENOENT' ? 404 : 500);
    }
};

const deleteLesson = async (req, res) => {
    const { id: lessonId } = req.params;

    try {
        const lessonRemoved = await Lesson.findByIdAndRemove(lessonId);
        if (!lessonRemoved) {
            return handleError(res, 'Lesson not found', 404);
        }
        await Comment.deleteMany({ _id: { $in: lessonRemoved.comments } });
        return res.status(200).send({ lesson: lessonRemoved });
    } catch (err) {
        return handleError(res);
    }
};

const updateLesson = async (req, res) => {
    const { id: lessonId } = req.params;
    const updateData = { ...req.body, ...(req.body.call && { 'call.created_at': new Date() }) };

    try {
        const lessonUpdated = await Lesson.findByIdAndUpdate(lessonId, updateData, { new: true })
            .populate(populateLesson());
        return res.status(200).send({ lesson: lessonUpdated });
    } catch (err) {
        return handleError(res);
    }
};

const getLesson = async (req, res) => {
    const { id: lessonId } = req.params;

    try {
        const lesson = await Lesson.findById(lessonId).populate(populateLesson());
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }
        return res.status(200).send({ lesson });
    } catch (err) {
        return handleError(res);
    }
};

const getLessons = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({}, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching lessons');
    }
};

const getAllLessons = async (req, res) => {
    const order = req.query.order ? { [req.query.order]: -1 } : { created_at: -1 };
    try {
        const lessons = await Lesson.find({}).sort(order);
        res.status(200).send({ lessons });
    } catch (err) {
        handleError(res);
    }
};

const getMyLessons = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({ author: req.user._id }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching your lessons');
    }
};

const getAllMyLessons = async (req, res) => {
    try {
        const lessons = await Lesson.find({ author: req.user._id });
        res.status(200).send({ lessons });
    } catch (err) {
        handleError(res, 'Error fetching all your lessons');
    }
};

const getLessonsToAdvise = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({ expert: req.user._id }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching lessons to advise');
    }
};

const getAllLessonsToAdvise = async (req, res) => {
    try {
        const lessons = await Lesson.find({ expert: req.user._id });
        res.status(200).send({ lessons });
    } catch (err) {
        handleError(res, 'Error fetching all lessons to advise');
    }
};

const getSuggestLessons = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({ justification: { $ne: null }, accepted: false }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching suggested lessons');
    }
};

const getCalls = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({ "call.visible": true }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching calls');
    }
};

const getAllCalls = async (req, res) => {
    try {
        const lessons = await Lesson.find({ "call.visible": true });
        res.status(200).send({ lessons });
    } catch (err) {
        handleError(res, 'Error fetching all calls');
    }
};

const getExperiences = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({ development_level: { $ne: null }, type: { $ne: null }, accepted: false }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching experiences');
    }
};




// Helper to populate lesson fields consistently
const populateLesson = () => [
    { path: 'development_group', select: 'name surname picture role _id' },
    { path: 'author', select: 'name surname picture role _id' },
    // Add other necessary populate fields
];




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



