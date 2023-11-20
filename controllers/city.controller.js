'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const City = require('../models/city.model');

const saveCity = async (req, res) => {
    const params = req.body;
    const city = new City(params);
    try {
        const cityStored = await city.save();
        return res.status(200).send({ city: cityStored });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The city can not be saved' });
    }
};

const getCities = async (req, res) => {
    const page = req.params.page || 1;
    try {
        const cities = await City.find().sort('name').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ cities });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The cities were not found' });
    }
};

const updateCity = async (req, res) => {
    const cityId = req.params.id;
    const updateData = req.body;
    try {
        const cityUpdated = await City.findByIdAndUpdate(cityId, updateData, { new: true });
        return res.status(200).send({ city: cityUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The city can not be updated' });
    }
};

const deleteCity = async (req, res) => {
    const cityId = req.params.id;
    try {
        const cityRemoved = await City.findOneAndRemove({ _id: cityId });
        return res.status(200).send({ city: cityRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The city can not be removed' });
    }
};

const getAllCities = async (req, res) => {
    try {
        const cities = await City.find().sort('name').exec();
        return res.status(200).send({ cities });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The cities were not found' });
    }
};

module.exports = {
    saveCity,
    updateCity,
    deleteCity,
    getCities,
    getAllCities
};
