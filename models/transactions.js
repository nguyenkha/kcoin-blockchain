const db = require('./db');

const TABLE_NAME = 'transactions';

// Find one transaction by its hash
exports.findByHash = async function (hash) {
  return db(TABLE_NAME).where('hash', hash).first();
};