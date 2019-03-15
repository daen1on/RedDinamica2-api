'use strict'

var mongoose = require('mongoose');
var schema = mongoose.Schema;

var userSchema = schema({
    title:String,
    resume:String,
    references:String,
    state:String,
    expert:{type: schema.ObjectId, ref: 'User'},
    leader:{type: schema.ObjectId, ref: 'User'},
    development_group:[{type: schema.ObjectId, ref: 'User'}],
    created_at:String,
    state:String,
    published_at:String,
    knowledge_area:[String],
    grade:[String],
    views:Number,
    rating:Number,
    entries:[{type: schema.ObjectId, ref: 'Entry'}],
    comments:[{type: schema.ObjectId, ref: 'Comment'}],
    files:[{type: schema.ObjectId, ref: 'File'}],
    earlier_version:String,
    next_version:String
});

module.exports = mongoose.model('Lesson', userSchema);