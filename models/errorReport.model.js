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
  type: { type: String, required: true },
  module: { type: String, required: true },
  description: { type: String, required: true, maxlength: 2000 },
  steps: { type: String, required: true },
  attachment: [fileSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ErrorReport', ErrorReportSchema);
