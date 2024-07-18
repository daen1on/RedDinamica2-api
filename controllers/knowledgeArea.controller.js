'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const KnowledgeArea = require('../models/knowledge-area.model');
const levenshtein = require('fast-levenshtein');
const natural = require('natural');
const SoundEx = natural.SoundEx;
const soundex = new SoundEx(); // Crear instancia de SoundEx
const normalizeString = (str) => {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const levenshteinThreshold = (name) => {
    const length = name.length;
    if (length <= 5) return 2;
    if (length <= 10) return 3;
    return 4;
};
const saveArea = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).send({ message: 'The name field is required' });
    }

    const normalizedName = normalizeString(name);
    const soundexName = soundex.process(normalizedName); // Usar el método process de la instancia
    const threshold = levenshteinThreshold(normalizedName);

    try {
        const existingAreas = await KnowledgeArea.find({});
        for (const area of existingAreas) {
            const existingSoundex = soundex.process(normalizeString(area.name)); // Usar el método process de la instancia
            if (existingSoundex === soundexName || levenshtein.get(normalizedName, normalizeString(area.name)) <= threshold) {
                return res.status(400).send({ message: 'Knowledge area already exists or is too similar to an existing one' });
            }
        }

        const knowledgeArea = new KnowledgeArea({ name });
        const areaStored = await knowledgeArea.save();
        return res.status(200).send({ area: areaStored });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The area can not be saved' });
    }
};

const saveAreas = async (req, res) => {
    const params = req.body;
    try {
        for (const param of params) {
            const normalizedName = normalizeString(param.name);
            const existingAreas = await KnowledgeArea.find({});
            for (const area of existingAreas) {
                if (normalizeString(area.name) === normalizedName || levenshtein.get(normalizedName, normalizeString(area.name)) <= 2) {
                    return res.status(400).send({ message: `Knowledge area ${param.name} already exists or is too similar to an existing one` });
                }
            }
        }

        const areasStored = await KnowledgeArea.insertMany(params);
        return res.status(200).send({ areas: areasStored });
    } catch (error) {
        console.log(error);
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
    const page = parseInt(req.params.page) || 1;
    try {
        const options = {
            page: page,
            limit: ITEMS_PER_PAGE,
            sort: { name: 1 }
        };
        const result = await KnowledgeArea.paginate({}, options);
        return res.status(200).send({ areas: result.docs, total: result.totalDocs });
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
        const areaRemoved = await KnowledgeArea.findOneAndDelete({ _id: areaId });
        if (!areaRemoved) {
            return res.status(404).send({ message: 'Area not found' });
        }
        return res.status(200).send({ area: areaRemoved });
    } catch (err) {
        console.log(err);
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
