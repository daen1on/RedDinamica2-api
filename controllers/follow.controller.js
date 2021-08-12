'use strict'
let { ITEMS_PER_PAGE } = require('../config');

// Load libraries
let mongoosePaginate = require('mongoose-pagination');

// Load models
let User = require('../models/user.model');
let Follow = require('../models/follow.model');

function saveFollow(req, res) {
    let params = req.body;

    let follow = new Follow();

    follow.user = req.user.sub;
    follow.followed = params.followed;

    follow.save((err, followStored) => {
        if (err) return res.status(500).send({ message: 'Error in the request. The follow can not be saved' });

        if (!followStored) return res.status(404).send({ message: 'The follow has not been saved' });

        return res.status(200).send(followStored);
    });

}

function deleteFollow(req, res) {
    let userId = req.user.sub;
    let followId = req.params.id;

    Follow.findOneAndRemove({ user: userId, followed: followId }, (err, followRemoved) => {
        if (err) return res.status(500).send({ message: 'Error in the request. The follow can not be removed ' });

        if (!followRemoved) return res.status(404).send({ message: 'The follow can not be removed, it has not been found' });

        return res.status(200).send(followRemoved);
    });
}

function getFollowingUsers(req, res) {
    let userId = req.user.sub;

    if (req.params.id && req.params.page) {
        userId = req.params.id;
    }

    let page = 1;

    if (req.params.page) {
        page = req.params.page;
    } else {
        page = req.params.id;
    }

    Follow.find({ user: userId }).populate('followed').paginate(page, ITEMS_PER_PAGE, (err, follows, total) => {
        if (err) return res.status(500).send({ message: 'Error in the request. The following users can not be found ' });

        if (!follows) return res.status(404).send({ message: 'There are no followings users' });
        
        return res.status(200).send({
            total: total,
            pages: Math.ceil(total / ITEMS_PER_PAGE),
            itemsPerPage: ITEMS_PER_PAGE,
            follows
            
        })
    });
}


function getFollowersUsers(req, res) {
    let userId; //usuario al que se le ve el perfil
    
    let loggeduser=req.user.sub; //usuario loggeado
    
    //console.log("userloged:",loggeduser);
    if (req.params.id && req.params.page) {
        //userId = req.params.id;
        userId = req.params.id; //en
        
        //console.log("entró al if: ",userId);
        //hay un else?
    }

    let page = 1;

    if (req.params.page) {
        page = req.params.page;
    } else {
        page = req.params.id; // no entiendo para qué lo hace
    }
    
    Follow.find({ followed: userId }).populate('user').paginate(page, ITEMS_PER_PAGE, (err, follows, total) => {
        if (err) return res.status(500).send({ message: 'Error in the request. The followers users can not be found ' });

        if (!follows) return res.status(404).send({ message: 'There are no followers users' });

        followsUserId(loggeduser).then((value) => {
            return res.status(200).send({
                total: total,
                pages: Math.ceil(total / ITEMS_PER_PAGE),
                itemsPerPage: ITEMS_PER_PAGE,
                follows,
                following: value.following
                
            });
        });
    });
}

async function followsUserId(userLogged) {
    //trae los que esta siguiend el usuario logueado
    
    
    let following = await Follow.find({ user: userLogged }, { '_id': 0, '_v': 0, 'user': 0 }, (err, follows) => {
        return follows; 
    }); 

    
    let following_clean = [];
    
    for await (const follow of following){
        following_clean.push(follow.followed); 
        }
       
    return {
        
        following: following_clean,
        //followers: followers_clean,
    
    };
}

function getMyFollows(req, res) {
    var userId = req.user.sub;

    var find = Follow.find({ user: userId });

    if (req.params.followed) {
        find = Follow.find({ followed: userId });
    }

    find.populate('user followed').exec((err, follows) => {
        if (err) return res.status(500).send({ message: 'Error in the request' });

        if (!follows) return res.status(404).send({ message: 'You are not following any user' });

        return res.status(200).send({ follows });
    });
}


module.exports = {
    saveFollow,
    deleteFollow,
    getFollowingUsers,
    getFollowersUsers,
    getMyFollows

}



