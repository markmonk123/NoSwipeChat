const GENDER_VALUES = ['male', 'female', 'other', 'non_binary', 'prefer_not_to_say'];

const EDUCATION_VALUES = [
  'high_school',
  'some_college',
  'associate',
  'bachelors',
  'masters',
  'doctorate',
  'trade_school',
  'other',
  'prefer_not_to_say'
];

// Spirituality / religious belief. Covers religious affiliation and
// spiritual-but-not-religious / agnostic / atheist positions.
const SPIRITUALITY_VALUES = [
  'christian',
  'muslim',
  'jewish',
  'hindu',
  'buddhist',
  'sikh',
  'jain',
  'taoist',
  'shinto',
  'spirituality',
  'agnostic',
  'atheist',
  'none',
  'other',
  'prefer_not_to_say'
];

const ETHNICITY_VALUES = [
  'asian',
  'black',
  'hispanic_latino',
  'indigenous',
  'middle_eastern_north_african',
  'native_hawaiian_pacific_islander',
  'white',
  'multiracial',
  'other',
  'prefer_not_to_say'
];

const RELATIONSHIP_STATUS_VALUES = [
  'single',
  'seeing_someone',
  'engaged',
  'married',
  'divorced',
  'widowed',
  'complicated',
  'open_relationship',
  'prefer_not_to_say'
];

const HOBBY_LIMIT = 25;
const STRING_ARRAY_LIMIT = 25;
const STRING_ARRAY_ITEM_MAX_LENGTH = 60;
const BIO_MAX_LENGTH = 1000;
const SHORT_TEXT_MAX_LENGTH = 120;

const MIN_AGE = 18;
const MAX_AGE = 120;

const listFields = ['interests', 'hobbies', 'skillsets'];

const profileFields = {
  GENDER_VALUES,
  EDUCATION_VALUES,
  SPIRITUALITY_VALUES,
  ETHNICITY_VALUES,
  RELATIONSHIP_STATUS_VALUES,
  HOBBY_LIMIT,
  STRING_ARRAY_LIMIT,
  STRING_ARRAY_ITEM_MAX_LENGTH,
  BIO_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  MIN_AGE,
  MAX_AGE,
  listFields
};

module.exports = profileFields;
