'use strict'

var mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

var schema = mongoose.Schema;

var messageSchema = schema({    
    emitter:{type: schema.ObjectId, ref: 'User'},
    receiver:{type: schema.ObjectId, ref: 'User'},
    viewed:Boolean,
    text:String,
    created_at:String
});
// Apply the pagination plugin to the schema
messageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Message', messageSchema);