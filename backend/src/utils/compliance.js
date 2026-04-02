const MIN_AGE = 18;

const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  const normalized = String(phone).trim();
  return /^\+?[1-9]\d{7,14}$/.test(normalized);
};

const getAge = (dateOfBirth, now = new Date()) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
};

const isAdult = (dateOfBirth) => {
  const age = getAge(dateOfBirth);
  return typeof age === 'number' && age >= MIN_AGE;
};

const getComplianceStatus = (user) => {
  const hasFacebook = Boolean(user?.facebookId);
  const phoneVerified = Boolean(user?.phoneVerified);
  const adult = isAdult(user?.dateOfBirth);

  return {
    hasFacebook,
    phoneVerified,
    adult,
    isCompliant: hasFacebook && phoneVerified && adult,
    minAge: MIN_AGE
  };
};

module.exports = {
  MIN_AGE,
  isValidPhoneNumber,
  getAge,
  isAdult,
  getComplianceStatus
};
