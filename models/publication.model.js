'use strict'

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate-v2');

var schema = mongoose.Schema;

var publicationSchema = schema({
    text:String,
    user:{type: schema.ObjectId, ref: 'User'},
    created_at:String,
    comments:[{type: schema.ObjectId, ref: 'Comment'}],
    file:String,
    likes:[{type: schema.ObjectId, ref: 'User'}],
    likesCount:{type: Number, default: 0}
});

// Apply the pagination plugin to the publication schema
publicationSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Publication', publicationSchema);