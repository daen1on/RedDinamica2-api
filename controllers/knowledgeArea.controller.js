'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const KnowledgeArea = require('../models/knowledge-area.model');

const saveArea = async (req, res) => {
    const params = req.body;
    const knowledgeArea = new KnowledgeArea(params);
    try {
        const areaStored = await knowledgeArea.save();
        return res.status(200).send({ area: areaStored });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The area can not be saved' });
    }
};

const saveAreas = async (req, res) => {
    const params = req.body;
    try {
        const areasStored = await KnowledgeArea.insertMany(params);
        return res.status(200).send({ areas: areasStored });
    } catch (error) {
        return res.status(500).send({ message: 'Error in the request. The areas can not be saved' });
    }
};

const updateArea = async (req, res) => {
    const areaId = req.params.id;
    const updateData = req.body;
    try {
        const areaUpdated = await KnowledgeArea.findByIdAndUpdate(areaId, updateData, { new: true });
        return res.status(200).send({ area: areaUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The area can not be updated' });
    }
};

const getAreas = async (req, res) => {
    const page = req.params.page || 1;
    try {
        const areas = await KnowledgeArea.find().sort('name').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ areas });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The areas were not found' });
    }
};

const getAllAreas = async (req, res) => {
    try {
        const areas = await KnowledgeArea.find().sort('name').exec();
        return res.status(200).send({ areas });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The areas were not found' });
    }
};

const deleteArea = async (req, res) => {
    const areaId = req.params.id;
    try {
        const areaRemoved = await KnowledgeArea.findOneAndRemove({ _id: areaId });
        return res.status(200).send({ area: areaRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The area can not be removed' });
    }
};

module.exports = {
    saveArea,
    saveAreas,
    deleteArea,
    updateArea,
    getAreas,
    getAllAreas
};
