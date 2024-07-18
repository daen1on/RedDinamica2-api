'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { Schema } = mongoose;

const institutionSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String },
    website: { type: String },
    telephone: { type: String },
    city: { type: Schema.Types.ObjectId, ref: 'City'},
    used: { type: Boolean, default: false }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

institutionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Institution', institutionSchema);
