'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const moment = require('moment');
const User = require('../models/user.model');
const Follow = require('../models/follow.model');
const Message = require('../models/message.model');

const saveMessage = async (req, res) => {
    const params = req.body;
    if (!params.text || !params.receiver) {
        return res.status(200).send({ message: 'Send the required data' });
    }
    const message = new Message({
        emitter: req.user.sub,
        receiver: params.receiver,
        text: params.text,
        created_at: moment().unix(),
        viewed: false
    });
    try {
        const messageStored = await message.save();
        return res.status(200).send({ message: messageStored });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The message cannot be saved.' });
    }
};

const getReceiveMessages = async (req, res) => {
    const userId = req.user.sub;
    const page = parseInt(req.params.page || 1);
    const options = {
        page: page,
        limit: ITEMS_PER_PAGE,
        sort: { created_at: -1 },
        populate: 'emitter'
    };
    try {
        const result = await Message.paginate({ receiver: userId }, options);
        return res.status(200).send({ total: result.totalDocs, pages: result.totalPages, messages: result.docs });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The message cannot be obtained.' });
    }
};

const getEmittedMessages = async (req, res) => {
    const userId = req.user.sub;
    const page = parseInt(req.params.page || 1);
    const options = {
        page: page,
        limit: ITEMS_PER_PAGE,
        sort: { created_at: -1 },
        populate: 'receiver'
    };
    try {
        const result = await Message.paginate({ emitter: userId }, options);
        return res.status(200).send({ total: result.totalDocs, pages: result.totalPages, messages: result.docs });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The message cannot be obtained.' });
    }
};

const getUnviewedMessages = async (req, res) => {
    const userId = req.user.sub;
    try {
        const count = await Message.countDocuments({ receiver: userId, viewed: false });
        return res.status(200).send({ 'unviewed': count });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The count cannot be made' });
    }
};

const setViewedMessages = async (req, res) => {
    const userId = req.user.sub;
    try {
        const messagesUpdated = await Message.updateMany({ receiver: userId, viewed: false }, { viewed: true });
        return res.status(200).send({ messagesUpdated });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The message cannot be updated' });
    }
};

const deleteMessage = async (req, res) => {
    const messageId = req.params.id;
    try {
        const messageRemoved = await Message.findByIdAndRemove(messageId);
        return res.status(200).send({ message: messageRemoved });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The message cannot be removed' });
    }
};

module.exports = {
    saveMessage,
    getReceiveMessages,
    getEmittedMessages,
    getUnviewedMessages,
    setViewedMessages,
    deleteMessage
};
