'use strict';
const { ITEMS_PER_PAGE } = require('../config');
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
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The follow can not be saved' });
    }
};
const deleteFollow = async (req, res) => {
    const userId = req.user.sub;
    const followId = req.params.id;
    try {
        const followRemoved = await Follow.findOneAndDelete({ user: userId, followed: followId });
        return res.status(200).send({ follow: followRemoved });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Error in the request. The follow can not be removed' });
    }
};


const getFollowingUsers = async (req, res) => {
    let userId = req.user.sub; // Default to logged-in user
    if (req.params.id && req.params.page) {
        userId = req.params.id; // Override with URL parameter if present
    }

    const page = parseInt(req.params.page || 1); // Default to page 1 if not specified
    const options = {
        page: page,
        limit: ITEMS_PER_PAGE,
        populate: { path: 'followed', select: 'name surname picture role' }
    };

    try {
        const result = await Follow.paginate({ user: userId }, options);
        return res.status(200).send({ follows: result.docs, totalPages: result.totalPages });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ message: 'Error in the request. The following users cannot be found' });
    }
};

const getFollowersUsers = async (req, res) => {
    let userId = req.user.sub;
    if (req.params.id && req.params.page) {
        userId = req.params.id;
    }
    const page = parseInt(req.params.page || req.params.id || 1); // Ensure the page number is an integer
    const options = {
        page: page,
        limit: ITEMS_PER_PAGE,
        populate: { path: 'user', select: 'name surname picture role' }
    };

    try {
        // Use the paginate method provided by mongoose-paginate-v2
        const result = await Follow.paginate({ followed: userId }, options);
        const following = await followsUserId(req.user.sub); // This function must be reviewed for performance and necessity.
        return res.status(200).send({
            follows: result.docs,
            totalPages: result.totalPages,
            following: following.following
        });
    } catch (err) {
        console.error(err); // It's good practice to log the actual error for debugging purposes.
        return res.status(500).send({ message: 'Error in the request. The followers users cannot be found' });
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
