const mongoose = require('mongoose');

let hasConnected = false;

const getDatabaseUri = () =>
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  process.env.MONGO_URL;

const connectDatabase = async () => {
  if (hasConnected) {
    return mongoose.connection;
  }

  const databaseUri = getDatabaseUri();

  if (!databaseUri) {
    throw new Error('Missing database connection string. Set MONGODB_URI or DATABASE_URL.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(databaseUri, {
    serverSelectionTimeoutMS: 10000
  });

  hasConnected = true;
  return mongoose.connection;
};

module.exports = {
  connectDatabase
};
