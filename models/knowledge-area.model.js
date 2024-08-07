'use strict';

var mongoose = require('mongoose');
var schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

var knowledgeAreaSchema = schema({
    name: { type: String, required: true },
    used: { type: Boolean, default: false }
});

knowledgeAreaSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('KnowledgeArea', knowledgeAreaSchema);
