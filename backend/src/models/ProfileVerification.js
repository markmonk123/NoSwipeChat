const mongoose = require('mongoose');

const profileVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  facebookVerified: {
    type: Boolean,
    default: false
  },
  facebookVerifiedAt: Date,
  googleVerified: {
    type: Boolean,
    default: false
  },
  googleVerifiedAt: Date,
  linkedinVerified: {
    type: Boolean,
    default: false
  },
  linkedinVerifiedAt: Date,
  photoVerified: {
    type: Boolean,
    default: false
  },
  photoVerifiedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProfileVerification', profileVerificationSchema);
