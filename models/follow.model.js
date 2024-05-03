'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const schema = mongoose.Schema;

var followSchema = new schema({
    user: {type: schema.ObjectId, ref: 'User', index: true},
    followed: {type: schema.ObjectId, ref: 'User', index: true}
}, {
    timestamps: true // This adds createdAt and updatedAt fields automatically
});

// Apply the pagination plugin to the schema
followSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Follow', followSchema);