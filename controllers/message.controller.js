'use strict'

var mongoosePaginate = require('mongoose-pagination');
var moment = require('moment');

var MessageModel = require('../models/message.model');
var UserModel = require('../models/user.model');
var FollowModel = require('../models/follow.model');

function probando(req, res){
    res.status(200).send({message: 'Hola que tal'});
}

function saveMessage(req, res){
    var params = req.body;

    if(!params.text || !params.receiver) return res.status(200).send({message: 'Envía los datos necesarios'});

    var message = new MessageModel();

    message.emitter = req.user.sub;
    message.receiver = params.receiver;
    message.text = params.text;
    message.created_at = moment().unix();
    message.viewed = 'false';

    message.save((err, messageStored) => {
        if(err) return res.status(500).send({message: 'Error almacenando el mensaje'});

        if(!messageStored) return res.status(404).send({message: 'Error al guardar el mensaje'});

        return res.status(200).send({message: messageStored});
    });
}

function getReceiveMessages(req, res){
    var userId = req.user.sub;

    var page = 1;

    if(req.params.page){
        page = req.params.page;
    }

    var itemsPerPage = 4;

    MessageModel.find({receiver: userId}).populate('emitter', 'name surname nick image _id').paginate(page, itemsPerPage, (err, messages, total) =>{
        if(err) return res.status(500).send({message: 'Error en la petición'});

        if(!messages) return res.status(404).send({message: 'No hay mensajes'});

        
        return res.status(200).send({
            total,
            pages: Math.ceil(total/itemsPerPage),
            messages: messages
        });
    });
}

function getEmittedMessages(req, res){
    var userId = req.user.sub;

    var page = 1;

    if(req.params.page){
        page = req.params.page;
    }

    var itemsPerPage = 4;

    MessageModel.find({emitter: userId}).populate('emitter receiver', 'name surname nick image _id').paginate(page, itemsPerPage, (err, messages, total) =>{
        if(err) return res.status(500).send({message: 'Error en la petición'});

        if(!messages) return res.status(404).send({message: 'No hay mensajes'});

        
        return res.status(200).send({
            total,
            pages: Math.ceil(total/itemsPerPage),
            messages: messages
        });
    });
}

function getUnviewedMessages(req, res){
    var userId = req.user.sub;

    MessageModel.count({receiver:userId, viewed:'false'}, (err, count) => {
        if(err) return res.status(500).send({message: 'Error en la petición'});

        return res.status(200).send({
            'unviewed': count
        });        
    });
}

function setViewedMessage(req, res){
    var userId = req.user.sub;

    MessageModel.update({receiver:userId, viewed:'false'}, {viewed:'true'}, {multi:'true'}, (err, messagesUpdated) => {
        if(err) return res.status(500).send({message: 'Error en la petición'});

        return res.status(200).send({
            messagesUpdated
        });    
    });
}


module.exports = {
    probando,
    saveMessage,
    getReceiveMessages,
    getEmittedMessages,
    getUnviewedMessages,
    setViewedMessage
};