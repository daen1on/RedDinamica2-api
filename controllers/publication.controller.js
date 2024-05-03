'use strict'
let { ITEMS_PER_PAGE } = require('../config');

// Load libraries

let moment = require('moment');
let fs = require('fs');
let path = require('path');

// Load models
let Publication = require('../models/publication.model');
let User = require('../models/user.model');
let Follow = require('../models/follow.model');
let Comment = require('../models/comment.model');

const POST_PATH = './uploads/posts/';
const savePublication = async (req, res) => {
    const params = req.body;
    const publication = new Publication();
    publication.text = params.text;
    publication.file = null;
    publication.user = req.user.sub;
    publication.created_at = moment().unix();
    try {
        const publicationStored = await publication.save();
        return res.status(200).send({ publication: publicationStored });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The post can not be saved' });
    }
};
const getPublications = async (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const follows = await Follow.find({ user: req.user.sub }).populate('followed');
    let followsClean = follows.map(follow => follow.followed._id);
    followsClean.push(req.user.sub); // Includes the user's own publications for fetching

    try {
        const options = {
            page,
            limit: ITEMS_PER_PAGE,
            sort: { created_at: -1 },
            populate: [
                { 
                    path: 'comments', 
                    populate: { path: 'user', select: 'name surname picture _id' } 
                },
                { 
                    path: 'user', 
                    select: 'name surname picture _id' 
                }
            ]
        };

        // Execute paginated query
        const result = await Publication.paginate({ user: { "$in": followsClean } }, options);

        return res.status(200).send({
            totalItems: result.totalDocs,
            totalPages: result.totalPages,
            currentPage: result.page,
            itemsPerPage: result.limit,
            publications: result.docs // This is where the actual publications are stored
        });
    } catch (err) {
        console.error(err); // Log the error to the console for debugging
        return res.status(500).send({ message: 'Error in the request. It can not get the publications' });
    }
};


const getUserPublications = async (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const userId = req.params.id;

    try {
        const options = {
            page: page,
            limit: ITEMS_PER_PAGE, 
            sort: { created_at: -1 },
            populate: {
                path: 'comments',
                populate: { path: 'user', select: 'name surname picture _id' }
            }
        };

        // Using paginate method
        const result = await Publication.paginate({ user: userId }, options);

        return res.status(200).send({
            totalItems: result.totalDocs,
            totalPages: result.totalPages,
            currentPage: result.page,
            itemsPerPage: result.limit,
            publications: result.docs // The documents are returned in the docs property
        });
    } catch (err) {
        console.error(err); //log the error to console
        return res.status(500).send({ message: 'Error in the request. It can not get the publications' });
    }
};


const getPublication = async (req, res) => {
    const publicationId = req.params.id;
    try {
        const publication = await Publication.findById(publicationId);
        return res.status(200).send({ publication });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. It can not be get the publication' });
    }
};

const deletePublication = async (req, res) => {
    const publicationId = req.params.id;
    try {
        const publicationRemoved = await Publication.findOneAndDelete({ _id: publicationId, user: req.user.sub });

        if (!publicationRemoved) {
            return res.status(404).send({ message: 'Publication not found or user not authorized to delete this publication.' });
        }

        // If you need to remove related comments
        await Comment.deleteMany({ '_id': { '$in': publicationRemoved.comments } });

        // Example: Calculate last valid page (this will need to be adjusted to your pagination logic)
        const count = await Publication.countDocuments();
        const lastValidPage = Math.ceil(count / ITEMS_PER_PAGE); // Assuming ITEMS_PER_PAGE is defined

        return res.status(200).send({ publication: publicationRemoved, lastValidPage: lastValidPage });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The publication cannot be removed.' });
    }
};
const uploadPublicationFile = async (req, res) => {
    const publicationId = req.params.id;
    const filePath = req.file.path;
    const filename = req.file.filename;

    if (req.file) {
        const publication = await Publication.findOne({ user: req.user.sub, '_id': publicationId });
        if (publication) {
            try {
                const publicationUpdated = await Publication.findByIdAndUpdate(publicationId, { file: filename }, { new: true });
                return res.status(200).send({ publication: publicationUpdated });
            } catch (err) {
                return removeFilesOfUpdates(res, 500, filePath, 'Error in the request. The publication can not be upadated');
            }
        } else {
            return removeFilesOfUpdates(res, 403, filePath, 'You do not have permission to update user data');
        }
    } else {
        return res.status(200).send({ message: 'No file has been uploaded' });
    }
};
const updatePublicationComments = async (req, res) => {
    const publicationId = req.params.id;
    const commentId = req.body._id;

    try {
        const publicationUpdated = await Publication.findByIdAndUpdate(publicationId, { '$addToSet': { comments: commentId } }, { new: true });
        return res.status(200).send({ publication: publicationUpdated });
    } catch (err) {
        return removeFilesOfUpdates(res, 500, filePath, 'Error in the request. The publication can not be upadated');
    }
};
const updatePublication = async (req, res) => {
    const publicationId = req.params.id;    

    try {
        const publicationUpdated = await Publication.findByIdAndUpdate(publicationId, { '$addToSet': { comments: commentId } }, { new: true });
        return res.status(200).send({ publication: publicationUpdated });
    } catch (err) {
        return removeFilesOfUpdates(res, 500, filePath, 'Error in the request. The publication can not be upadated');
    }
};
const getPublicacionFile = async (req, res) => {
    const file = req.params.file;
    const pathFile = path.resolve(POST_PATH, file);

    try {
        fs.statSync(pathFile);
        return res.sendFile(pathFile);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(200).send({ message: 'The image does not exits' });
        } else {
            return res.status(500).send({ message: 'Error requesting the image.' });
        }
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
module.exports = {
    getUserPublications,
    savePublication,
    getPublications,
    getPublication,
    deletePublication,
    updatePublication,
    updatePublicationComments,
    uploadPublicationFile,
    getPublicacionFile
};