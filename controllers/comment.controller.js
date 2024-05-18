'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const moment = require('moment');
const Comment = require('../models/comment.model');

const saveComment = async (req, res) => {
    const params = req.body;
    const comment = new Comment(params);
    comment.created_at = moment().unix();
    try {
        const commentStored = await comment.save();
        return res.status(200).send({ comment: commentStored });
    } catch (err) {
        return res.status(500).send({ message: 'The comment can not be saved' });
    }
};

const updateComment = async (req, res) => {
    const commentId = req.params.id;
    const updateData = req.body;
    updateData.created_at = moment().unix();
    try {
        const commentUpdated = await Comment.findByIdAndUpdate(commentId, updateData, { new: true });
        return res.status(200).send({ comment: commentUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The comment can not be updated' });
    }
};

const deleteComment = async (req, res) => {
    const commentId = req.params.id;
    try {
        const commentRemoved = await Comment.findByIdAndDelete(commentId);
        if (!commentRemoved) {
            return res.status(404).send({ message: 'Comment not found' });
        }
        return res.status(200).send({ comment: commentRemoved });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The comment cannot be removed' });
    }
};

module.exports = {
    saveComment,
    updateComment,
    deleteComment
};
