module.exports = exports = ({ db }) => {
  const TABLE_NAME = 'blocks';

  // Find one block by its hash
  let findByHash = async function (hash) {
    return db(TABLE_NAME).where('hash', hash).first();
  };

  // Find one block by height in main chain
  let findByHeight = async function (height) {
    // Find the max height
    let res = await db(TABLE_NAME).max('height as max').first();
    let max = res.max;
    // Block with max height and created first
    return db(TABLE_NAME).where('height', max).orderBy('createdAt').first();
  };

  // Validate block (version, all transaction which use validate output, previous hash, hash)
  let validate = async function (block) {

  };

  return { findByHash, findByHeight, validate };
};