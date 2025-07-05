'use strict'

var mongoose = require('mongoose');
var schema = mongoose.Schema;

var commentSchema = schema({
    created_at:String,
    user:{type: schema.ObjectId, ref:'User'},
    text:String,
    score:{type: Number, default:0},
    likes:[{type: schema.ObjectId, ref: 'User'}],
    likesCount:{type: Number, default: 0},
    replies:[{type: schema.ObjectId, ref: 'Comment'}],
    parentId:{type: schema.ObjectId, ref: 'Comment', default: null},
    publication:{type: schema.ObjectId, ref: 'Publication'}
});

module.exports = mongoose.model('Comment', commentSchema);