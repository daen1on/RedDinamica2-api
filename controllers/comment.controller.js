'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const moment = require('moment');
const Comment = require('../models/comment.model');
const Publication = require('../models/publication.model');
const Resource = require('../models/resource.model');
const User = require('../models/user.model');
const NotificationService = require('../services/notification.service');

const saveComment = async (req, res) => {
    const params = req.body;
    const comment = new Comment(params);
    comment.user = req.user.sub; // Asegurar que el usuario está asignado
    comment.created_at = moment().unix();
    
    try {
        const commentStored = await comment.save();
        
        // Determinar si es comentario en publicación o recurso y crear notificación
        if (params.publicationId) {
            // Es un comentario en publicación
            const publication = await Publication.findById(params.publicationId).populate('user');
            if (publication && publication.user._id.toString() !== req.user.sub.toString()) {
                // Solo notificar si el comentario no es del autor de la publicación
                await NotificationService.createPublicationCommentNotification(
                    req.user,
                    publication.user._id,
                    publication._id,
                    comment.text
                ).catch(err => console.error('Error creating publication comment notification:', err));
            }
        } else if (params.resourceId) {
            // Es un comentario en recurso
            const resource = await Resource.findById(params.resourceId).populate('author');
            if (resource && resource.author._id.toString() !== req.user.sub.toString()) {
                // Solo notificar si el comentario no es del autor del recurso
                await NotificationService.createCommentNotification(
                    req.user,
                    resource.author._id,
                    comment._id,
                    resource.name
                ).catch(err => console.error('Error creating resource comment notification:', err));
            }
        }
        
        return res.status(200).send({ comment: commentStored });
    } catch (err) {
        console.error('Error saving comment:', err);
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

// Métodos para likes en comentarios
const toggleLikeComment = async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.sub;

    try {
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).send({ message: 'Comment not found' });
        }

        // Verificar si el usuario ya dio like
        const hasLiked = comment.likes && comment.likes.includes(userId);
        
        let action;
        if (hasLiked) {
            // Quitar like
            comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
            action = 'unliked';
        } else {
            // Agregar like
            if (!comment.likes) comment.likes = [];
            comment.likes.push(userId);
            action = 'liked';
        }

        // Actualizar contador
        comment.likesCount = comment.likes.length;
        
        const updatedComment = await comment.save();
        
        return res.status(200).send({ 
            message: `Comment ${action} successfully`,
            action: action,
            likesCount: updatedComment.likesCount,
            comment: updatedComment
        });
    } catch (err) {
        console.error('Error toggling comment like:', err);
        return res.status(500).send({ message: 'Error in the request. Could not toggle like' });
    }
};

const getCommentLikes = async (req, res) => {
    const commentId = req.params.id;

    try {
        const comment = await Comment.findById(commentId)
            .populate('likes', 'name surname picture _id');
        
        if (!comment) {
            return res.status(404).send({ message: 'Comment not found' });
        }

        return res.status(200).send({ 
            likes: comment.likes || [],
            likesCount: comment.likesCount || 0
        });
    } catch (err) {
        console.error('Error getting comment likes:', err);
        return res.status(500).send({ message: 'Error in the request. Could not get likes' });
    }
};

// Métodos para respuestas anidadas
const addReply = async (req, res) => {
    const parentCommentId = req.params.id;
    const params = req.body;
    
    try {
        // Crear la respuesta como un nuevo comentario
        const reply = new Comment({
            text: params.text,
            user: req.user.sub,
            publication: params.publication,
            parentId: parentCommentId,
            created_at: moment().unix()
        });
        
        const replyStored = await reply.save();
        
        // Agregar la respuesta al comentario padre
        const parentComment = await Comment.findById(parentCommentId).populate('user');
        if (!parentComment) {
            return res.status(404).send({ message: 'Parent comment not found' });
        }
        
        if (!parentComment.replies) parentComment.replies = [];
        parentComment.replies.push(replyStored._id);
        await parentComment.save();
        
        // Populate la respuesta con datos del usuario
        const populatedReply = await Comment.findById(replyStored._id)
            .populate('user', 'name surname picture _id');
        
        // Crear notificación para el autor del comentario padre
        if (parentComment.user._id.toString() !== req.user.sub.toString()) {
            // Obtener los datos completos del usuario que está respondiendo
            const fromUser = await User.findById(req.user.sub).select('name surname _id');
            
            await NotificationService.createReplyNotification(
                fromUser,
                parentComment.user._id,
                parentComment._id,
                reply.text
            ).catch(err => console.error('Error creating reply notification:', err));
        }
        
        return res.status(200).send({ 
            reply: populatedReply,
            message: 'Reply added successfully'
        });
    } catch (err) {
        console.error('Error adding reply:', err);
        return res.status(500).send({ message: 'Error in the request. Could not add reply' });
    }
};

const getReplies = async (req, res) => {
    const commentId = req.params.id;

    try {
        const comment = await Comment.findById(commentId)
            .populate({
                path: 'replies',
                populate: { path: 'user', select: 'name surname picture _id' }
            });
        
        if (!comment) {
            return res.status(404).send({ message: 'Comment not found' });
        }

        return res.status(200).send({ 
            replies: comment.replies || []
        });
    } catch (err) {
        console.error('Error getting replies:', err);
        return res.status(500).send({ message: 'Error in the request. Could not get replies' });
    }
};

module.exports = {
    saveComment,
    updateComment,
    deleteComment,
    toggleLikeComment,
    getCommentLikes,
    addReply,
    getReplies
};
