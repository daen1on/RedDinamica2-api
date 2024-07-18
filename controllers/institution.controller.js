'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const Institution = require('../models/institution.model');

const saveInstitution = async (req, res) => {
    const params = req.body;
    const institution = new Institution(params);
    try {
        const institutionStored = await institution.save();
        return res.status(200).send({ institution: institutionStored });
    } catch (err) {
        console.error('Error saving institution:', err);
        return res.status(500).send({ message: 'The institution cannot be saved' });
    }
};

const getInstitutions = async (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const itemsPerPage = parseInt(ITEMS_PER_PAGE) || 10;

    try {
        const options = {
            page: page,
            limit: itemsPerPage,
            sort: { name: 1 },
            populate: 'city'
        };
        const result = await Institution.paginate({}, options);

        return res.status(200).send({
            institutions: result.docs,
            total: result.totalDocs,
            pages: result.totalPages
        });
    } catch (err) {
        console.error('Error fetching institutions:', err);
        return res.status(500).send({ message: 'Error in the request. The institutions were not found' });
    }
};

const updateInstitution = async (req, res) => {
    const institutionId = req.params.id;
    const updateData = req.body;
    try {
        const institutionUpdated = await Institution.findByIdAndUpdate(institutionId, updateData, { new: true });
        if (!institutionUpdated) {
            return res.status(404).send({ message: 'Institution not found' });
        }
        return res.status(200).send({ institution: institutionUpdated });
    } catch (err) {
        console.error('Error updating institution:', err);
        return res.status(500).send({ message: 'Error in the request. The institution cannot be updated' });
    }
};

const deleteInstitution = async (req, res) => {
    const institutionId = req.params.id;
    try {
        const institutionRemoved = await Institution.findByIdAndDelete(institutionId);
        if (!institutionRemoved) {
            return res.status(404).send({ message: 'Institution not found' });
        }
        return res.status(200).send({ institution: institutionRemoved });
    } catch (err) {
        console.error('Error removing institution:', err);
        return res.status(500).send({ message: 'Error in the request. The institution cannot be removed' });
    }
};

const getAllInstitutions = async (req, res) => {
    try {
        const institutions = await Institution.find().sort('name').populate('city').exec();
        return res.status(200).send({ institutions });
    } catch (err) {
        console.error('Error fetching all institutions:', err);
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
