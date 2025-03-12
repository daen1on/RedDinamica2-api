'use strict';

const Lesson = require('../models/lesson.model');
const Comment = require('../models/comment.model');
const moment = require('moment');
const LESSON_PATH = './uploads/lessons/';

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
    const lesson = new Lesson(params);
    lesson.created_at = moment().unix();
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
    const lessonId = req.params.id;

    try {
        const lessonRemoved = await Lesson.findByIdAndDelete(lessonId);
        if (!lessonRemoved) {
            return handleError(res, 'Lesson not found', 404);
        }
        await Comment.deleteMany({ _id: { $in: lessonRemoved.comments } });
        return res.status(200).send({ lesson: lessonRemoved });
    } catch (err) {
        console.log(err);
        return handleError(res);
    }
};


const updateLesson = async (req, res) => {
    const { id: lessonId } = req.params;
    const updateData = { ...req.body };

    // Si req.body.call existe, desglosar sus propiedades individualmente para evitar el conflicto
    if (req.body.call) {
        for (const key in req.body.call) {
            updateData[`call.${key}`] = req.body.call[key];
        }
        delete updateData.call; // Eliminar el objeto call del updateData para evitar el conflicto
    }

    console.log("Incoming Request: PUT /api/lesson/:id");
    console.log("Lesson ID:", lessonId);
    console.log("Update Data:", updateData);  // Log de los datos que llegan para depuración

    try {
        const lessonUpdated = await Lesson.findByIdAndUpdate(lessonId, updateData, { new: true })
            .populate(populateLesson());
        if (!lessonUpdated) {
            console.log("Lesson not found");
            return res.status(404).send({ message: 'Lesson not found' });
        }
        console.log("Lesson updated successfully");
        return res.status(200).send({ lesson: lessonUpdated });
    } catch (err) {
        console.error("Error updating lesson:", err);  // Log del error para detalles adicionales
        return res.status(500).send({ message: 'Error updating lesson', error: err.message });
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
    const { page = 1, limit = 10 } = req.query;
    const { visibleOnes } = req.params; // Get visibleOnes from params
    const skip = (page - 1) * limit;
    
    // Determine the value of 'accepted' based on 'visibleOnes'
    const acceptedValue = visibleOnes === 'true'; // Assuming 'true' string for true, anything else for false

    console.log('visibleOnes (from params):', visibleOnes, 'accepted:', acceptedValue);

    try {
        const lessons = await Lesson.find({ accepted: acceptedValue }) // Use the boolean value here
            .skip(skip)
            .limit(limit)
            .populate(populateLesson());

        const total = await Lesson.countDocuments({ accepted: acceptedValue }); // Match the count with the find query
        console.log("Total lessons found:", total);

        return res.status(200).send({
            lessons,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error getting lessons:", err);
        return res.status(500).send({ message: 'Error getting lessons', error: err.message });
    }
};




const getAllLessons = async (req, res) => {
    const order = req.query.order ? { [req.query.order]: -1 } : { created_at: -1 };
    try {
        const lessons = await Lesson.find({}).sort(order);
        const total = await Lesson.countDocuments({});
        console.log("Total lessons found:", total);
        console.log("entered get all lessons", lessons.length);
        res.status(200).send({ lessons, total, pages: Math.ceil(total / ITEMS_PER_PAGE) });
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
function populateLesson() {
    return [
        { path: 'author', select: 'name surname picture role _id' },
        { path: 'leader', select: 'name surname picture role _id' },
        { path: 'expert', select: 'name surname picture role _id' },
        { path: 'development_group', select: 'name surname picture role _id' },
        { path: 'knowledge_area', select: 'name' }, // Assuming you only need the name
        {
            path: 'conversations',
            populate: { path: 'author', select: 'name surname picture role _id' }
        },
        {
            path: 'expert_comments',
            populate: { path: 'author', select: 'name surname picture role _id' }
        },
        {
            path: 'comments',
            populate: { path: 'user', select: 'name surname picture _id' }
        },
        { path: 'son_lesson', select: '_id visible' }
    ];
}




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



