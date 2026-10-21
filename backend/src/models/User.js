const mongoose = require('mongoose');
const {
  GENDER_VALUES,
  EDUCATION_VALUES,
  SPIRITUALITY_VALUES,
  ETHNICITY_VALUES,
  RELATIONSHIP_STATUS_VALUES,
  BIO_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  MIN_AGE,
  MAX_AGE
} = require('../config/profileFields');

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
  bio: {
    type: String,
    trim: true,
    maxlength: BIO_MAX_LENGTH
  },
  // Self-reported age. dateOfBirth remains the source of truth for the
  // adult compliance check; this is a convenience display value.
  age: {
    type: Number,
    min: MIN_AGE,
    max: MAX_AGE
  },
  dateOfBirth: Date,
  /** Education level. */
  education: {
    type: String,
    enum: EDUCATION_VALUES
  },
  /**
   * Spirituality / religious belief. Covers religious affiliation as well as
   * spiritual-but-not-religious, agnostic, and atheist positions.
   */
  spirituality: {
    type: String,
    enum: SPIRITUALITY_VALUES
  },
  ethnicity: {
    type: String,
    enum: ETHNICITY_VALUES
  },
  relationshipStatus: {
    type: String,
    enum: RELATIONSHIP_STATUS_VALUES
  },
  hometown: {
    type: String,
    trim: true,
    maxlength: SHORT_TEXT_MAX_LENGTH
  },
  phoneNumber: String,
  phoneVerified: {
    type: Boolean,
    default: false
  },
  phoneVerifiedAt: Date,
  gender: {
    type: String,
    enum: GENDER_VALUES
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
  // Human-readable location label, e.g. 'Brooklyn, NY' or 'Remote (EST)'.
  // Distinct from the city field and from the GeoJSON point below.
  locationLabel: {
    type: String,
    trim: true,
    maxlength: SHORT_TEXT_MAX_LENGTH
  },
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
  hobbies: {
    type: [String],
    default: []
  },
  skillsets: {
    type: [String],
    default: []
  },
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
