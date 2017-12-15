const db = require('./db');

const TABLE_NAME = 'blocks';

// Find one block by its hash
exports.findByHash = async function (hash) {
  return db(TABLE_NAME).where('hash', hash).first();
};

// Find one block by height in main chain
exports.findByHeight = async function (height) {
  // Find the max height
  let res = await db(TABLE_NAME).max('height as max').first();
  let max = res.max;
  // Block with max height and created first
  return db(TABLE_NAME).where('height', max).orderBy('createdAt').first();
};