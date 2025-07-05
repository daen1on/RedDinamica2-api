'use strict'
let { ITEMS_PER_PAGE } = require('../config');
const RESOURCE_PATH = './uploads/resources/';

// Load libraries
let mongoosePaginate = require('mongoose-pagination');
let moment = require('moment');
let fs = require('fs');
let path = require('path');

// Load models
let Resource = require('../models/resource.model');
let Comment = require('../models/comment.model');
const NotificationService = require('../services/notification.service');


const saveResource = async (req, res) => {
    const params = req.body;
    const resource = new Resource();
    resource.name = params.name;
    resource.type = params.type; // [ document, video, link, software]
    resource.description = params.description;
    resource.source = params.source;
    resource.justification = params.justification;
    resource.author = params.author;
    resource.accepted = params.accepted;
    resource.created_at = moment().unix();
    resource.url = params.url;
    try {
        const resourceStored = await resource.save();
        return res.status(200).send({ resource: resourceStored });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The resource can not be saved' });
    }
};
const uploadResourceFile = async (req, res) => {
    const resourceId = req.params.id;
    const filePath = req.file.path;
    const filename = req.file.filename;

    if (req.file) {
        const resource = await Resource.findOne({'_id': resourceId });
        if (resource) {
            try {
                const resourceUpdated = await Resource.findByIdAndUpdate(resourceId, { file: filename }, { new: true });
                return res.status(200).send({ resource: resourceUpdated });
            } catch (err) {
                return removeFilesOfUpdates(res, 500, filePath, 'Error in the request. The resource can not be upadated');
            }
        } else {
            return removeFilesOfUpdates(res, 403, filePath, 'You do not have permission to update user data');
        }
    } else {
        return res.status(200).send({ message: 'No file has been uploaded' });
    }
};
const getResourceFile = async (req, res) => {
    const file = req.params.file;
    const pathFile = path.resolve(RESOURCE_PATH, file);

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
const deleteResource = async (req, res) => {
    const resourceId = req.params.id;
    try {
        const resourceRemoved = await Resource.findOneAndDelete({ user: req.user.sub, _id: resourceId });
        if (!resourceRemoved) {
            return res.status(404).send({ message: 'Resource not found' });
        }
        await Comment.deleteMany({ _id: { $in: resourceRemoved.comments } });
        return res.status(200).send({ resource: resourceRemoved });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The resource cannot be removed' });
    }
};

const updateResource = async (req, res) => {
    const resourceId = req.params.id;
    const updateData = req.body;
    
    try {
        // Obtener el recurso actual para comparar estados
        const currentResource = await Resource.findById(resourceId).populate('author');
        if (!currentResource) {
            return res.status(404).send({ message: 'Resource not found' });
        }

        const resourceUpdated = await Resource.findByIdAndUpdate(resourceId, updateData, {new:true}).populate('author');
        
        // Verificar si cambió el estado de aceptación
        if (updateData.hasOwnProperty('accepted') && currentResource.accepted !== updateData.accepted) {
            if (updateData.accepted === true) {
                // Recurso aprobado
                await NotificationService.createResourceApprovedNotification(
                    currentResource.author._id,
                    resourceId,
                    currentResource.name,
                    req.user.sub
                ).catch(err => console.error('Error creating resource approved notification:', err));
            } else if (updateData.accepted === false) {
                // Recurso rechazado
                await NotificationService.createResourceRejectedNotification(
                    currentResource.author._id,
                    resourceId,
                    currentResource.name,
                    req.user.sub,
                    updateData.rejectionReason || ''
                ).catch(err => console.error('Error creating resource rejected notification:', err));
            }
        }
        
        return res.status(200).send({ resource: resourceUpdated });
    } catch (err) {
        console.error('Error updating resource:', err);
        return res.status(500).send({ message: 'Error in the request. The resource can not be updated' });
    }
};

// Función específica para aprobar recurso
const approveResource = async (req, res) => {
    const resourceId = req.params.id;
    
    try {
        const resource = await Resource.findById(resourceId).populate('author');
        if (!resource) {
            return res.status(404).send({ message: 'Resource not found' });
        }

        resource.accepted = true;
        resource.visible = true; // También hacer visible cuando se aprueba
        const resourceUpdated = await resource.save();
        
        // Crear notificación de aprobación
        await NotificationService.createResourceApprovedNotification(
            resource.author._id,
            resourceId,
            resource.name,
            req.user.sub
        ).catch(err => console.error('Error creating resource approved notification:', err));
        
        return res.status(200).send({ 
            resource: resourceUpdated,
            message: 'Resource approved successfully'
        });
    } catch (err) {
        console.error('Error approving resource:', err);
        return res.status(500).send({ message: 'Error approving resource' });
    }
};

// Función específica para rechazar recurso
const rejectResource = async (req, res) => {
    const resourceId = req.params.id;
    const { reason } = req.body;
    
    try {
        const resource = await Resource.findById(resourceId).populate('author');
        if (!resource) {
            return res.status(404).send({ message: 'Resource not found' });
        }

        resource.accepted = false;
        resource.visible = false;
        const resourceUpdated = await resource.save();
        
        // Crear notificación de rechazo
        await NotificationService.createResourceRejectedNotification(
            resource.author._id,
            resourceId,
            resource.name,
            req.user.sub,
            reason || ''
        ).catch(err => console.error('Error creating resource rejected notification:', err));
        
        return res.status(200).send({ 
            resource: resourceUpdated,
            message: 'Resource rejected successfully'
        });
    } catch (err) {
        console.error('Error rejecting resource:', err);
        return res.status(500).send({ message: 'Error rejecting resource' });
    }
};

const getResources = async (req, res) => {
    const page = req.params.page || 1;
    let findQuery = {
        accepted: true
    };

    if(req.params.visibleOnes == 'true'){
        findQuery.visible = true;
    }

    try {
        const resources = await Resource.find(findQuery)
            .sort('name')
            .populate({
                path: 'comments',
                populate: { path: 'user', select: 'name surname picture _id' }
            })
            .populate('author', 'name surname picture _id')
            .paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({
            resources: resources,
            total: total,
            pages: Math.ceil(total / ITEMS_PER_PAGE)
        });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The resources were not found' });
    }
};
const getAllResources = async (req, res) => {
    let order = `-${req.params.order}`;
    let findQuery = {
        accepted: true
    };

    if(req.params.visibleOnes == 'true'){
        findQuery.visible = true;
    }

    if(!req.params.order){
        order = 'name';
    }    

    try {
        const resources = await Resource.find(findQuery).sort(order)
            .populate({
                path: 'comments',
                populate: { path: 'user', select: 'name surname picture _id' }
            })
            .populate('author', 'name surname picture _id');
        return res.status(200).send({ resources: resources });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The resources were not found' });
    }
};

const getSuggestResources = async (req, res) => {
    const page = req.params.page || 1;

    try {
        const resources = await Resource.find({accepted: false })
            .populate('author', 'name surname picture _id')
            .sort('name').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({
            resources,
            total,
            pages: Math.ceil(total / ITEMS_PER_PAGE)
        });
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

module.exports = {
    saveResource,
    uploadResourceFile,
    getResourceFile,
    deleteResource,
    updateResource,
    getResources,
    getAllResources,
    getSuggestResources,
    approveResource,
    rejectResource
}



