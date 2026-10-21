// Display labels for the profile enum values returned by
// GET /users/profile/options. Keys mirror the backend field names so a value
// can be looked up with PROFILE_FIELD_LABELS[fieldName][value].
const PROFILE_FIELD_LABELS = {
  gender: {
    male: 'Male',
    female: 'Female',
    other: 'Other',
    non_binary: 'Non-binary',
    prefer_not_to_say: 'Prefer not to say'
  },
  education: {
    high_school: 'High school',
    some_college: 'Some college',
    associate: 'Associate degree',
    bachelors: "Bachelor's degree",
    masters: "Master's degree",
    doctorate: 'Doctorate',
    trade_school: 'Trade school',
    other: 'Other',
    prefer_not_to_say: 'Prefer not to say'
  },
  spirituality: {
    christian: 'Christian',
    muslim: 'Muslim',
    jewish: 'Jewish',
    hindu: 'Hindu',
    buddhist: 'Buddhist',
    sikh: 'Sikh',
    jain: 'Jain',
    taoist: 'Taoist',
    shinto: 'Shinto',
    spirituality: 'Spiritual, not religious',
    agnostic: 'Agnostic',
    atheist: 'Atheist',
    none: 'No beliefs',
    other: 'Other',
    prefer_not_to_say: 'Prefer not to say'
  },
  ethnicity: {
    asian: 'Asian',
    black: 'Black',
    hispanic_latino: 'Hispanic / Latino',
    indigenous: 'Indigenous',
    middle_eastern_north_african: 'Middle Eastern / North African',
    native_hawaiian_pacific_islander: 'Native Hawaiian / Pacific Islander',
    white: 'White',
    multiracial: 'Multiracial',
    other: 'Other',
    prefer_not_to_say: 'Prefer not to say'
  },
  relationshipStatus: {
    single: 'Single',
    seeing_someone: 'Seeing someone',
    engaged: 'Engaged',
    married: 'Married',
    divorced: 'Divorced',
    widowed: 'Widowed',
    complicated: "It's complicated",
    open_relationship: 'Open relationship',
    prefer_not_to_say: 'Prefer not to say'
  }
};

// Commas inside these values would break the comma-separated text inputs.
const COMMA_SAFE_FIELDS = ['interests', 'hobbies', 'skillsets'];

export const profileFieldLabels = PROFILE_FIELD_LABELS;
export { COMMA_SAFE_FIELDS };

export const toListText = (values) =>
  Array.isArray(values) ? values.filter(Boolean).join(', ') : '';

export const fromListText = (text) =>
  String(text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const labelFor = (field, value) =>
  (PROFILE_FIELD_LABELS[field] && PROFILE_FIELD_LABELS[field][value]) || value || '';
