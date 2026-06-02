const mongoose = require('mongoose');

const socialConsentSchema = new mongoose.Schema({
  status: {
    type: Boolean,
    default: false
  },
  available: {
    type: Boolean,
    default: true
  },
  requestedAt: Date,
  grantedAt: Date,
  revokedAt: Date,
  note: String
}, { _id: false });

const facebookFriendSchema = new mongoose.Schema({
  id: String,
  name: String
}, { _id: false });

const facebookPostSchema = new mongoose.Schema({
  id: String,
  message: String,
  createdTime: Date,
  permalinkUrl: String
}, { _id: false });

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
  phoneVerificationContext: {
    lineType: String,
    distanceMiles: Number,
    clientIp: String,
    ipGeo: {
      latitude: Number,
      longitude: Number,
      accuracyRadiusKm: Number,
      city: String,
      subdivision: String,
      country: String
    },
    deviceLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      capturedAt: Date
    },
    lookupSummary: {
      countryCode: String,
      nationalFormat: String
    },
    verifiedAt: Date
  },
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
  socialDataSettings: {
    facebook: {
      requestedScopes: {
        type: [String],
        default: []
      },
      grantedScopes: {
        type: [String],
        default: []
      },
      declinedScopes: {
        type: [String],
        default: []
      },
      friendsList: {
        type: socialConsentSchema,
        default: () => ({})
      },
      timelinePosts: {
        type: socialConsentSchema,
        default: () => ({})
      },
      privateMessages: {
        type: socialConsentSchema,
        default: () => ({
          available: false,
          note: 'Facebook Login does not provide direct access to private messages in this app flow.'
        })
      },
      extendedSocialGraph: {
        type: socialConsentSchema,
        default: () => ({})
      },
      lastUpdatedAt: Date
    }
  },
  socialData: {
    facebook: {
      friendsList: {
        totalCount: Number,
        sample: {
          type: [facebookFriendSchema],
          default: []
        },
        fetchedAt: Date
      },
      timelinePosts: {
        totalCount: Number,
        sample: {
          type: [facebookPostSchema],
          default: []
        },
        fetchedAt: Date
      },
      extendedSocialGraph: {
        connectedFriendsCount: Number,
        note: String,
        fetchedAt: Date
      }
    }
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
