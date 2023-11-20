'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const Profession = require('../models/profession.model');

const saveProfession = async (req, res) => {
    const params = req.body;
    const profession = new Profession(params);
    try {
        const professionStored = await profession.save();
        return res.status(200).send({ profession: professionStored });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The profession can not be saved' });
    }
};

const getProfessions = async (req, res) => {
    const page = req.params.page || 1;
    try {
        const professions = await Profession.find().sort('name').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ professions });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The professions were not found' });
    }
};

const updateProfession = async (req, res) => {
    const professionId = req.params.id;
    const updateData = req.body;
    try {
        const professionUpdated = await Profession.findByIdAndUpdate(professionId, updateData, { new: true });
        return res.status(200).send({ profession: professionUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The profession can not be updated' });
    }
};

const deleteProfession = async (req, res) => {
    const professionId = req.params.id;
    try {
        const professionRemoved = await Profession.findOneAndRemove({ _id: professionId });
        return res.status(200).send({ profession: professionRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The profession can not be removed' });
    }
};

const getAllProfessions = async (req, res) => {
    try {
        const professions = await Profession.find().sort('name').exec();
        return res.status(200).send({ professions });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The professions were not found' });
    }
};

module.exports = {
    saveProfession,
    updateProfession,
    deleteProfession,
    getProfessions,
    getAllProfessions
};
