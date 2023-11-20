'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const moment = require('moment');
const fs = require('fs');
const User = require('../models/user.model');
const Follow = require('../models/follow.model');
const Message = require('../models/message.model');

const saveMessage = async (req, res) => {
    const params = req.body;
    if(!params.text || !params.receiver) return res.status(200).send({message: 'Send the required data'});
    const message = new Message();
    message.emitter = req.user.sub;
    message.receiver = params.receiver;
    message.text = params.text;
    message.created_at = moment().unix();
    message.viewed = 'false';
    try {
        const messageStored = await message.save();
        return res.status(200).send({message: messageStored});
    } catch (err) {
        return res.status(500).send({message: 'Error in the request. The message cannot be saved.'});
    }
};

const getReceiveMessages = async (req, res) => {
    const userId = req.user.sub;
    const page = req.params.page || 1;
    try {
        const messages = await Message.find({receiver: userId}).sort('-created_at').populate('emitter', 'name surname role picture _id').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ total, pages: Math.ceil(total/ITEMS_PER_PAGE), messages: messages });
    } catch (err) {
        return res.status(500).send({message: 'Error in the request. The message cannot be obtained.'});
    }
};

const getEmittedMessages = async (req, res) => {
    const userId = req.user.sub;
    const page = req.params.page || 1;
    try {
        const messages = await Message.find({emitter: userId}).sort('-created_at').populate('receiver', 'name surname picture role _id').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ total, pages: Math.ceil(total/ITEMS_PER_PAGE), messages: messages });
    } catch (err) {
        return res.status(500).send({message: 'Error in the request. The message cannot be obtained.'});
    }
};

const getUnviewedMessages = async (req, res) => {
    const userId = req.user.sub;
    try {
        const count = await Message.countDocuments({receiver:userId, viewed:'false'});
        return res.status(200).send({ 'unviewed': count });
    } catch (err) {
        return res.status(500).send({message: 'Error in the request. The count can not be made'});
    }
};

const setViewedMessage = async (req, res) => {
    const userId = req.user.sub;
    try {
        const messagesUpdated = await Message.updateMany({receiver:userId, viewed:'false'}, {viewed:'true'}, {multi:'true'});
        return res.status(200).send({ messagesUpdated });
    } catch (err) {
        return res.status(500).send({message: 'Error in the request. The message can not be updated'});
    }
};

const deleteMessage = async (req, res) => {
    const messageId = req.params.id;
    try {
        const messageRemoved = await Message.findByIdAndRemove(messageId);
        return res.status(200).send({ message: messageRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. It can not be removed the message' });
    }
};

module.exports = {
    saveMessage,
    getReceiveMessages,
    getEmittedMessages,
    getUnviewedMessages,
    setViewedMessage,
    deleteMessage
};
