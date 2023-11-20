'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const Institution = require('../models/institution.model');

const saveInstitution = async (req, res) => {
    const params = req.body;
    const institution = new Institution(params);
    try {
        const institutionStored = await institution.save();
        return res.status(200).send({ institution: institutionStored });
    } catch (err) {
        return res.status(500).send({ message: 'The institution can not be saved' });
    }
};

const getInstitutions = async (req, res) => {
    const page = req.params.page || 1;
    const itemsPerPage = ITEMS_PER_PAGE;
    try {
        const institutions = await Institution.find().sort('name').populate('city').paginate(page, itemsPerPage);
        return res.status(200).send({ institutions });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The institutions were not found' });
    }
};

const updateInstitution = async (req, res) => {
    const institutionId = req.params.id;
    const updateData = req.body;
    try {
        const institutionUpdated = await Institution.findByIdAndUpdate(institutionId, updateData, { new: true });
        return res.status(200).send({ institution: institutionUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The institution can not be updated' });
    }
};

const deleteInstitution = async (req, res) => {
    const institutionId = req.params.id;
    try {
        const institutionRemoved = await Institution.findOneAndRemove({ _id: institutionId });
        return res.status(200).send({ institution: institutionRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The institution can not be removed' });
    }
};

const getAllInstitutions = async (req, res) => {
    try {
        const institutions = await Institution.find().sort('name').populate('city').exec();
        return res.status(200).send({ institutions });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The institutions were not found' });
    }
};

module.exports = {
    saveInstitution,
    updateInstitution,
    deleteInstitution,
    getInstitutions,
    getAllInstitutions
};
