const { MongoClient } = require("mongodb");
const config = require("./config");

let client;
let database;

async function connectDb() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI environment variable is required.");
  }
  if (database) return database;

  client = new MongoClient(config.mongoUri);
  await client.connect();
  database = client.db(config.mongoDbName);
  return database;
}

function getDb() {
  if (!database) {
    throw new Error("Database is not connected. Call connectDb() first.");
  }
  return database;
}

async function closeDb() {
  if (client) {
    await client.close();
  }
  client = null;
  database = null;
}

module.exports = {
  connectDb,
  getDb,
  closeDb,
};

