const mongoose = require('mongoose');

const REPORT_REASONS = [
  'bot',
  'harassment',
  'inappropriate_content',
  'spam',
  'other'
];

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: REPORT_REASONS,
    required: true
  },
  details: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['open', 'reviewed', 'closed'],
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

reportSchema.index({ reporterId: 1, reportedUserId: 1, reason: 1, createdAt: -1 });

module.exports = {
  Report: mongoose.model('Report', reportSchema),
  REPORT_REASONS
};
