'use strict';
const { ITEMS_PER_PAGE } = require('../config');
const mongoosePaginate = require('mongoose-pagination');
const User = require('../models/user.model');
const Follow = require('../models/follow.model');

const saveFollow = async (req, res) => {
    const params = req.body;
    const follow = new Follow(params);
    follow.user = req.user.sub;
    follow.followed = params.followed;
    try {
        const existingFollow = await Follow.find({ user: follow.user, followed: follow.followed });
        if (existingFollow && existingFollow.length >= 1) {
            return res.status(200).send({ message: 'Follow already exists' });
        } else {
            const followStored = await follow.save();
            return res.status(200).send({ follow: followStored });
        }
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The follow can not be saved' });
    }
};

const deleteFollow = async (req, res) => {
    const userId = req.user.sub;
    const followId = req.params.id;
    try {
        const followRemoved = await Follow.findOneAndRemove({ user: userId, followed: followId });
        return res.status(200).send({ follow: followRemoved });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The follow can not be removed' });
    }
};

const getFollowingUsers = async (req, res) => {
    const userId = req.user.sub;
    if (req.params.id && req.params.page) {
        userId = req.params.id;
    }
    const page = req.params.page || req.params.id || 1;
    try {
        const follows = await Follow.find({ user: userId }).populate('followed', 'name surname picture role').paginate(page, ITEMS_PER_PAGE);
        return res.status(200).send({ follows });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The following users can not be found' });
    }
};

const getFollowersUsers = async (req, res) => {
    let userId = req.user.sub;
    if (req.params.id && req.params.page) {
        userId = req.params.id;
    }
    const page = req.params.page || req.params.id || 1;
    try {
        const follows = await Follow.find({ followed: userId }).populate('user', 'name surname picture role').paginate(page, ITEMS_PER_PAGE);
        const following = await followsUserId(req.user.sub);
        return res.status(200).send({ follows, following: following.following });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. The followers users can not be found' });
    }
};

const followsUserId = async (userLogged) => {
    const following = await Follow.find({ user: userLogged }, { '_id': 0, '_v': 0, 'user': 0 });
    const following_clean = [];
    for await (const follow of following) {
        following_clean.push(follow.followed);
    }
    return { following: following_clean };
};

const getMyFollows = async (req, res) => {
    const userId = req.user.sub;
    let find = Follow.find({ user: userId });
    if (req.params.followed) {
        find = Follow.find({ followed: userId });
    }
    try {
        const follows = await find.populate('user followed').exec();
        return res.status(200).send({ follows });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request' });
    }
};

module.exports = {
    saveFollow,
    deleteFollow,
    getFollowingUsers,
    getFollowersUsers,
    getMyFollows
};
