'use strict'

var mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

var schema = mongoose.Schema;

var userSchema = schema({
    name:String,
    surname:String,
    password:String,
    email:String,
    about:String,
    role:String,
    canAdvise:{type:Boolean, default:false},
    actived:{type:Boolean, default:false},
    postgraduate:String,
    picture: String,
    knowledge_area:[String],
    profession:{type: schema.ObjectId, ref: 'Profession'},
    institution: {type: schema.ObjectId, ref: 'Institution'},
    city: {type: schema.ObjectId, ref: 'City'},
    visits:{type:Number, default:0},
    contactNumber:String,
    socialNetworks:String,
    created_at:String
});
userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('User', userSchema);