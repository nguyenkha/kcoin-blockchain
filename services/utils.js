const crypto = require('crypto');
const _ = require('lodash');
const bitInt = require('big-integer');

module.exports = exports = () => {
  // SHA256 hash
  let hash = function (data) {
    let hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest();
  };

  // Double hash run
  let doubleHash = function (data) {
    return exports.hash(exports.hash(data));
  };

  // Generate merkel root
  let generateMarkelRoot = function (hashes) {
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
  let hexToBigInt = function (hex) {
    return bitInt(hex, 16);
  };

  return { hash, doubleHash, generateMarkelRoot, hexToBigInt };
};