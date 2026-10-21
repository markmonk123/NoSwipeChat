const {
  GENDER_VALUES,
  EDUCATION_VALUES,
  SPIRITUALITY_VALUES,
  ETHNICITY_VALUES,
  RELATIONSHIP_STATUS_VALUES,
  STRING_ARRAY_LIMIT,
  STRING_ARRAY_ITEM_MAX_LENGTH,
  BIO_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  MIN_AGE,
  MAX_AGE
} = require('../config/profileFields');

// Single source of truth mapping enum-backed profile fields to their allowed
// values. The Mongoose schema mirrors these enums, but findByIdAndUpdate does
// not run validators by default, so we validate here before writing.
const ENUM_FIELDS = {
  gender: GENDER_VALUES,
  education: EDUCATION_VALUES,
  spirituality: SPIRITUALITY_VALUES,
  ethnicity: ETHNICITY_VALUES,
  relationshipStatus: RELATIONSHIP_STATUS_VALUES
};

const LIST_FIELDS = ['interests', 'hobbies', 'skillsets'];

const SHORT_TEXT_FIELDS = ['bio', 'hometown', 'locationLabel'];

class ProfileValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ProfileValidationError';
    this.status = 400;
    this.details = details;
  }
}

// A field the caller wants to clear. Empty strings and nulls mean "unset",
// which keeps clients from having to know about $unset semantics.
const isCleared = (value) => value === null || value === '';

const normalizeList = (value, field) => {
  if (!Array.isArray(value)) {
    throw new ProfileValidationError(`${field} must be an array of strings`, {
      field,
      received: typeof value
    });
  }

  if (value.length > STRING_ARRAY_LIMIT) {
    throw new ProfileValidationError(
      `${field} accepts at most ${STRING_ARRAY_LIMIT} entries`,
      { field, max: STRING_ARRAY_LIMIT, received: value.length }
    );
  }

  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new ProfileValidationError(`${field} entries must be strings`, {
        field,
        received: typeof item
      });
    }
    const trimmed = item.trim();
    if (trimmed.length > STRING_ARRAY_ITEM_MAX_LENGTH) {
      throw new ProfileValidationError(
        `${field} entries must be ${STRING_ARRAY_ITEM_MAX_LENGTH} characters or fewer`,
        { field, max: STRING_ARRAY_ITEM_MAX_LENGTH }
      );
    }
    return trimmed;
  }).filter(Boolean);
};

const validateAge = (value) => {
  const age = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  if (typeof age !== 'number' || !Number.isFinite(age)) {
    throw new ProfileValidationError('age must be a number', { field: 'age' });
  }
  if (!Number.isInteger(age)) {
    throw new ProfileValidationError('age must be a whole number', { field: 'age' });
  }
  if (age < MIN_AGE) {
    throw new ProfileValidationError(`Users must be at least ${MIN_AGE} years old`, {
      field: 'age',
      minAge: MIN_AGE
    });
  }
  if (age > MAX_AGE) {
    throw new ProfileValidationError(`age must be ${MAX_AGE} or less`, {
      field: 'age',
      maxAge: MAX_AGE
    });
  }

  return age;
};

const validateShortText = (value, field) => {
  if (typeof value !== 'string') {
    throw new ProfileValidationError(`${field} must be a string`, {
      field,
      received: typeof value
    });
  }
  const maxLength = field === 'bio' ? BIO_MAX_LENGTH : SHORT_TEXT_MAX_LENGTH;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ProfileValidationError(`${field} must be ${maxLength} characters or fewer`, {
      field,
      maxLength
    });
  }
  return trimmed;
};

// Builds the Mongo update document plus the list of fields to unset for a
// profile PATCH-style request. Only keys present in the body are touched, so
// callers can send a single field without wiping the rest of the profile.
const buildProfileUpdate = (body = {}) => {
  const set = {};
  const unset = {};

  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;

    const value = body[field];
    if (isCleared(value)) {
      unset[field] = '';
      continue;
    }
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new ProfileValidationError(`Invalid value for ${field}`, {
        field,
        allowedValues: allowed,
        received: value
      });
    }
    set[field] = value;
  }

  for (const field of LIST_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (isCleared(value)) {
      unset[field] = '';
      continue;
    }
    set[field] = normalizeList(value, field);
  }

  for (const field of SHORT_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (isCleared(value)) {
      unset[field] = '';
      continue;
    }
    set[field] = validateShortText(value, field);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'age')) {
    if (isCleared(body.age)) {
      unset.age = '';
    } else {
      set.age = validateAge(body.age);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'city')) {
    if (isCleared(body.city)) {
      unset.city = '';
    } else {
      set.city = validateShortText(body.city, 'city');
    }
  }

  return { set, unset };
};

module.exports = {
  ENUM_FIELDS,
  LIST_FIELDS,
  SHORT_TEXT_FIELDS,
  ProfileValidationError,
  buildProfileUpdate,
  normalizeList,
  validateAge
};
