const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  facebookId: {
    type: String,
    unique: true,
    sparse: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  linkedinId: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  profilePicture: String,
  bio: String,
  age: Number,
  dateOfBirth: Date,
  phoneNumber: String,
  phoneVerified: {
    type: Boolean,
    default: false
  },
  phoneVerifiedAt: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  city: String,
  blockedUsers: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  preferredDistance: {
    type: Number,
    default: 50 // km
  },
  interests: [String],
  personalityProfile: {
    vector35: [Number],
    vector73: [Number],
    consent: {
      status: {
        type: Boolean,
        default: false
      },
      sources: {
        type: [String],
        default: []
      },
      grantedAt: Date,
      revokedAt: Date
    },
    visibility: {
      type: String,
      enum: ['private', 'matches'],
      default: 'matches'
    },
    updatedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
