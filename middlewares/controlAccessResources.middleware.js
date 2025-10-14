'use strict'
let Resource = require('../models/resource.model');

// Allow admins and delegated_admins. Otherwise, allow the resource author (only if no file is attached, preserving legacy rule)
exports.isAdmin = async function(req, res, next){
    const resourceId = req.params.id;

    if (req.user && (req.user.role === 'admin' || req.user.role === 'delegated_admin')) {
        return next();
    }

    try {
        const resource = await Resource.findOne({ author: req.user.sub, _id: resourceId });
        if (!resource) {
            return res.status(403).send({ message: 'The user might not have the necessary permissions for a resource' });
        }

        if (resource.file == null) {
            return next();
        }

        return res.status(403).send({ message: 'The user might not have the necessary permissions for a resource' });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. It can not be removed the resource' });
    }
};
