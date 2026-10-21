/**
 * Backfill the profile fields added for member demographics.
 *
 * Existing documents predate these fields, so they have no values. This adds
 * the array fields with empty defaults and clears any gender value written
 * before the enum was widened.
 *
 * Safe to run more than once: every update is idempotent.
 *
 *   cd backend && node src/scripts/backfillProfileFields.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { GENDER_VALUES } = require('../config/profileFields');

const ARRAY_FIELDS = ['interests', 'hobbies', 'skillsets'];

const connect = async () => {
  const uri =
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URL ||
    'mongodb://localhost:27017/singles-chatroom';

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
};

const run = async () => {
  await connect();

  // Clear any legacy gender value that falls outside the current enum.
  const legacyGenders = await User.distinct('gender', {
    gender: { $nin: GENDER_VALUES, $ne: null }
  });

  let normalized = 0;
  for (const value of legacyGenders.filter(Boolean)) {
    const result = await User.updateMany(
      { gender: value },
      { $unset: { gender: '' } }
    );
    normalized += result.modifiedCount;
  }

  // Ensure the list fields exist on every member.
  const total = await User.countDocuments();
  for (const field of ARRAY_FIELDS) {
    await User.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: [] } }
    );
  }

  const withHobbies = await User.countDocuments({ hobbies: { $exists: true } });
  const withSkills = await User.countDocuments({ skillsets: { $exists: true } });

  console.log('Profile field backfill complete');
  console.log(`  members scanned:        ${total}`);
  console.log(`  legacy genders cleared: ${normalized}`);
  console.log(`  members with hobbies:   ${withHobbies}`);
  console.log(`  members with skillsets: ${withSkills}`);
}

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Backfill failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
