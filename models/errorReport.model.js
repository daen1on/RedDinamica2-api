const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    originalName: String,
    mimetype: String,
    size: Number,
    fileName: String,
    groupTitle: String,
    created_at: { type: Date, default: Date.now }
});

const ErrorReportSchema = new Schema({
  category: { 
    type: String, 
    required: true,
    enum: ['technical', 'publication', 'user']
  },
  type: { type: String, required: true },
  module: { type: String, required: false },
  description: { type: String, required: true, maxlength: 2000 },
  steps: { type: String, required: false },
  publicationId: { type: String, required: false },
  reportedUserId: { type: String, required: false },
  attachment: [fileSchema],
  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'in_review', 'resolved', 'dismissed']
  },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ErrorReport', ErrorReportSchema);
