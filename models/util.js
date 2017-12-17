const crypto = require('crypto');
const _ = require('lodash');
const bitInt = require('big-integer');

// SHA256 hash
exports.hash = function (data) {
  let hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest();
};

// Double hash run
exports.doubleHash = function (data) {
  return exports.hash(exports.hash(data));
};

// Generate merkel root
exports.generateMarkelRoot = function (hashes) {
  // No node
  if (hashes.length == 0) {
    throw Error('Merkel tree must have at least one node');
  }
  // Odd number of nodes
  if (hashes.length % 2 == 1) {
    // Add one more
    hashes = _.concat(hashes, hashes[hashes.length - 1]);
  } 
  // Group by two
  let newHashes = [];
  for (let i = 0; i < hashes.length; i = i + 2) {
    newHashes.push(exports.doubleHash(Buffer.concat([hashes[i], hashes[i + 1]])));
  }
  // Final
  if (newHashes.length == 1) {
    return newHashes[0]; 
  }
  return exports.generateMarkelRoot(newHashes);
};

// Convert hex to big int
exports.hexToBigInt = function (hex) {
  return bitInt(hex, 16);
};