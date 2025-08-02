'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const moment = require('moment');
const Comment = require('../models/comment.model');
const Publication = require('../models/publication.model');
const Resource = require('../models/resource.model');
const User = require('../models/user.model');
const NotificationService = require('../services/notification.service');

// Función auxiliar para extraer menciones del texto
const extractMentions = (text) => {
    if (!text || typeof text !== 'string') {
        return [];
    }
    
    // Regex para capturar menciones con formato @Nombre Apellido
    const mentionRegex = /@([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionName = match[1].trim();
        if (mentionName && mentionName.length > 0) {
            mentions.push(mentionName);
        }
    }
    
    return [...new Set(mentions)]; // Eliminar duplicados
};

// Función auxiliar para encontrar usuarios por nombre completo
const findUsersByMentions = async (mentions) => {
    if (!mentions || mentions.length === 0) {
        return [];
    }
    
    const foundUsers = [];
    
    for (const mention of mentions) {
        const nameParts = mention.toLowerCase().split(' ');
        
        if (nameParts.length >= 2) {
            // Buscar por nombre y apellido
            const firstName = nameParts[0];
            const lastName = nameParts[nameParts.length - 1];
            
            // Buscar con diferentes combinaciones
            const user = await User.findOne({
                $or: [
                    {
                        $and: [
                            { name: { $regex: new RegExp(`^${firstName}$`, 'i') } },
                            { surname: { $regex: new RegExp(`^${lastName}$`, 'i') } }
                        ]
                    },
                    {
                        $and: [
                            { name: { $regex: new RegExp(`^${lastName}$`, 'i') } },
                            { surname: { $regex: new RegExp(`^${firstName}$`, 'i') } }
                        ]
                    }
                ]
            }).select('_id name surname');
            
            if (user) {
                foundUsers.push(user);
            }
        }
    }
    
    return foundUsers;
};

const saveComment = async (req, res) => {
    const params = req.body;
    const comment = new Comment(params);
    comment.user = req.user.sub; // Asegurar que el usuario está asignado
    comment.created_at = moment().unix();
    
    // 🔧 FIX CRÍTICO: Asegurar que el campo publication se establezca correctamente
    if (params.publicationId) {
        comment.publication = params.publicationId;
        console.log('✅ Campo publication asignado:', params.publicationId);
    }
    
    if (params.resourceId) {
        comment.resource = params.resourceId;
        console.log('✅ Campo resource asignado:', params.resourceId);
    }
    
    console.log('📝 Creating comment:', {
        userId: req.user.sub,
        publicationId: params.publicationId,
        resourceId: params.resourceId,
        text: params.text?.substring(0, 50) + '...'
    });
    
    try {
        const commentStored = await comment.save();
        
        // Detectar menciones en el texto del comentario
        const mentions = extractMentions(comment.text);
        const mentionedUsers = await findUsersByMentions(mentions);
        
        // Obtener datos completos del usuario que comenta (una sola vez)
        const fromUser = await User.findById(req.user.sub).select('name surname _id');
        console.log('👤 From user data:', fromUser);
        
        // Determinar si es comentario en publicación o recurso y crear notificación
        if (params.publicationId) {
            console.log('📄 Processing publication comment for publication:', params.publicationId);
            // Es un comentario en publicación
            const publication = await Publication.findById(params.publicationId).populate('user');
            console.log('📄 Publication found:', publication ? {
                id: publication._id,
                authorId: publication.user?._id,
                authorName: publication.user?.name
            } : 'null');
            
            if (publication && publication.user._id.toString() !== req.user.sub.toString()) {
                // Solo notificar si el comentario no es del autor de la publicación
                console.log('Creating publication comment notification for user:', publication.user._id);
                await NotificationService.createPublicationCommentNotification(
                    fromUser,
                    publication.user._id,
                    publication._id,
                    comment.text
                ).catch(err => console.error('Error creating publication comment notification:', err));
            } else {
                console.log('Skipping notification - comment author is publication owner or publication not found');
            }
            
            // Enviar notificaciones a usuarios mencionados
            if (mentionedUsers.length > 0) {
                for (const mentionedUser of mentionedUsers) {
                    // No notificar si se menciona a sí mismo o al autor de la publicación (ya notificado)
                    if (mentionedUser._id.toString() !== req.user.sub.toString() && 
                        mentionedUser._id.toString() !== publication.user._id.toString()) {
                        
                        await NotificationService.createMentionNotification(
                            fromUser,
                            mentionedUser._id,
                            publication._id,
                            comment.text,
                            false // false porque es comentario, no respuesta
                        ).catch(err => console.error('Error creating mention notification:', err));
                    }
                }
            }
            
        } else if (params.resourceId) {
            // Es un comentario en recurso
            const resource = await Resource.findById(params.resourceId).populate('author');
            
            if (resource && resource.author._id.toString() !== req.user.sub.toString()) {
                // Solo notificar si el comentario no es del autor del recurso
                console.log('Creating resource comment notification for user:', resource.author._id);
                await NotificationService.createCommentNotification(
                    fromUser,
                    resource.author._id,
                    comment._id,
                    resource.name
                ).catch(err => console.error('Error creating resource comment notification:', err));
            } else {
                console.log('Skipping notification - comment author is resource owner or resource not found');
            }
            
            // Enviar notificaciones a usuarios mencionados en recursos
            if (mentionedUsers.length > 0) {
                for (const mentionedUser of mentionedUsers) {
                    // No notificar si se menciona a sí mismo o al autor del recurso (ya notificado)
                    if (mentionedUser._id.toString() !== req.user.sub.toString() && 
                        mentionedUser._id.toString() !== resource.author._id.toString()) {
                        
                        await NotificationService.createMentionNotification(
                            fromUser,
                            mentionedUser._id,
                            resource._id,
                            comment.text,
                            false // false porque es comentario, no respuesta
                        ).catch(err => console.error('Error creating mention notification in resource:', err));
                    }
                }
            }
        }
        
        console.log('✅ Comment saved and notifications processed successfully');
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
        // Detectar menciones en el texto de la respuesta
        const mentions = extractMentions(params.text);
        const mentionedUsers = await findUsersByMentions(mentions);
        
        // Crear la respuesta como un nuevo comentario
        const reply = new Comment({
            text: params.text,
            user: req.user.sub,
            publication: params.publication,
            parentId: parentCommentId,
            mentionedUser: params.mentionedUser || null,
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
            .populate('user', 'name surname picture _id')
            .populate('mentionedUser', 'name surname _id');
        
        // Obtener los datos completos del usuario que está respondiendo
        const fromUser = await User.findById(req.user.sub).select('name surname _id');
        
        // Obtener publicación para notificaciones
        const publication = await Publication.findById(params.publication);
        const publicationId = publication ? publication._id : parentComment._id;
        
        // Enviar notificaciones a usuarios mencionados automáticamente detectados
        if (mentionedUsers.length > 0) {
            for (const mentionedUser of mentionedUsers) {
                // No notificar si se menciona a sí mismo o al autor del comentario padre
                if (mentionedUser._id.toString() !== req.user.sub.toString() && 
                    mentionedUser._id.toString() !== parentComment.user._id.toString()) {
                    
                    await NotificationService.createMentionNotification(
                        fromUser,
                        mentionedUser._id,
                        publicationId,
                        reply.text,
                        true // true porque es respuesta
                    ).catch(err => console.error('Error creating auto-detected mention notification:', err));
                }
            }
        }
        
        // Crear notificación para el usuario mencionado manualmente (si existe y es diferente de los auto-detectados)
        if (params.mentionedUser && params.mentionedUser !== req.user.sub) {
            // Verificar si ya fue notificado por auto-detección
            const alreadyNotified = mentionedUsers.some(user => user._id.toString() === params.mentionedUser.toString());
            
            if (!alreadyNotified) {
                await NotificationService.createMentionNotification(
                    fromUser,
                    params.mentionedUser,
                    publicationId,
                    reply.text,
                    true // true porque es respuesta
                ).catch(err => console.error('Error creating manual mention notification:', err));
            }
        }
        
        // Crear notificación para el autor del comentario padre (si es diferente del usuario mencionado)
        const allMentionedIds = [
            ...mentionedUsers.map(u => u._id.toString()),
            ...(params.mentionedUser ? [params.mentionedUser.toString()] : [])
        ];
        
        if (parentComment.user._id.toString() !== req.user.sub.toString() && 
            !allMentionedIds.includes(parentComment.user._id.toString())) {
            
            await NotificationService.createReplyNotification(
                fromUser,
                parentComment.user._id,
                publicationId, // ✅ Usar publicationId en lugar de parentComment._id
                reply.text
            ).catch(err => console.error('Error creating reply notification:', err));
        }
        
        // Notificar al dueño de la publicación si es diferente del autor del comentario y del usuario actual
        if (publication && publication.user && 
            publication.user._id.toString() !== req.user.sub.toString() &&
            publication.user._id.toString() !== parentComment.user._id.toString() &&
            !allMentionedIds.includes(publication.user._id.toString())) {
            
            await NotificationService.createPublicationCommentNotification(
                fromUser,
                publication.user._id,
                publication._id,
                reply.text
            ).catch(err => console.error('Error creating publication owner notification for reply:', err));
        }
        
        return res.status(200).send({ 
            reply: populatedReply,
            message: 'Reply added successfully'
        });
    } catch (err) {
        console.error('Error adding reply:', err);
        return res.status(500).send({ message: 'Error adding reply' });
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
