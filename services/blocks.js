const _ = require('lodash');
const Promise = require('bluebird');

const FIXED_DIFFICULTY = 5;

// Reward for each block
const FIXED_REWARD = 281190;

module.exports = exports = ({ db, transactions }) => {
  const TABLE_NAME = 'blocks';

  // Find one block by its hash
  let findByHash = async function (hash) {
    return db(TABLE_NAME).where('hash', hash).first();
  };

  // Find one block by height in main chain
  let findByHeight = async function (height) {
    // Block with max height and created first
    return db(TABLE_NAME).where('height', height).first();
  };

  // Get the current height
  let getCurrentHeight = async function () {
    return db(TABLE_NAME).max('height AS max').first()['max'];
  };

  // Transactions to binary
  let getTransactionsBinary = function (transactions) {
    return Buffer.concat(_.sortBy(block.transactions, 'index').map(transaction => transactions.toBinary));
  };

  // Only for hash
  let toHeaderBinary = function (block) {
    // Version
    let version = Buffer.alloc(4);
    version.writeUInt32BE(block.version);
    // Previous block has
    let previousBlockHash = Buffer.from(block.previousBlockHash, 'hex');
    // Timestamp
    let timestamp = Buffer.alloc(4);
    timestamp.writeUInt32BE(block.timestamp);
    // Nonce
    let nonce = Buffer.alloc(4);
    nonce.writeUInt32BE(block.nonce);
    // Transaction count, = 0 when get header
    let transactionCount = Buffer.alloc(4);
    // Number of zero prefix the hash
    let difficulty = Buffer.alloc(4);
    difficulty.writeUInt32BE(block.difficulty);
    // Binary format of transaction
    let transactionsBinary = getTransactionsBinary(block.transactions);
    // Hash of all transactiion
    let transactionsHash = util.hash(transactionsBinary);
    // Always zero
    transactionCount.writeUInt32BE(0);
    return Buffer.concat([ version, previousBlockHash, transactionsHash, timestamp, difficulty, nounce, transactionCount ]);
  };

  let calculateHash = function (block) {
    return util.hash(toHeaderBinary(block));
  };

  // 1. Check syntactic correctness
  let checkVersion = async function (block) {
    if (block.version !== 1) {
      throw Error('Only support version 1');
    }
  };

  // 2. Reject if duplicate of block we have in any of the three categories
  let checkExisted = async function (block) {
    block.hash = calculateHash(toHeaderBinary(block));
    let found = findByHash(hash);
    if (found) {
      throw Error('Block existed');
    }
  };

  // 3. Transaction list must be non-empty
  let checkEmptyTransactions = async function (block) {
    if (block.transactions.length === 0) {
      throw Error('Transaction list is empty');
    }
  };

  // 4. Block hash must satisfy claimed nBits proof of work
  let checkDifficulty = async function (block) {
    let prefix = '0'.repeat(block.difficulty);
    if (block.hash.toString('hex').indexOf(prefix) !== 0) {
      throw Error('Block hash ' + block.hash + ' does not meet difficulty ' + block.difficulty);
    }
  };

  // 5. Block timestamp must not be more than two hours in the future
  // => Not implement

  // 6. First transaction must be coinbase (i.e. only 1 input, with hash=0, n=-1), the rest must not be
  let checkCoinbase = function (block) {
    block.transactions.forEach((transaction, index) => {
      // Check coinbase
      if (index === 0) {
        // 1 input, hash = 0, index = -1
        if (transaction.inputs.length !== 1) {
          throw Error('Coinbase transaction can only have 1 input');
        }
        let input = transaction.inputs[0];
        let hashValue = util.hexToBigInt(input.referencedOutputHash);
        if (hashValue.compare(bigInt.zero) === 0) {
          throw Error('Coinbase transaction must have referenced output hash = 0');
        }
        if (input.referencedOutputIndex !== -1) {
          throw Error('Coinbase transaction must have referenced output index = -1');
        }
      } else {
        transaction.inputs.forEach(input => {
          let hashValue = util.hexToBigInt(input.referencedOutputHash);
          if (hashValue.compare(bigInt.zero) === 0) {
            throw Error('Normal transaction must not have referenced output hash = 0');
          }
          if (input.referencedOutputIndex === -1) {
            throw Error('Coinbase transaction must not have referenced output index = -1');
          }
        });
      }
    });
  };

  // 7. For each transaction, apply "tx" checks 2-4
  let checkTransactions2To4 = async function (block) {
    await Promise.each(blocks.transactions, transactions.check2To4);
  };

  // 8. For the coinbase (first) transaction, scriptSig length must be 2-100
  // => Not implement

  // 9. Reject if sum of transaction sig opcounts > MAX_BLOCK_SIGOPS
  // => Not implement

  // 10. Verify Merkle hash
  let checkTransactionsHash = async function (block) {
    if (block.transactionsHash !== util.hash(getTransactionsBinary(block.transactions).toString('hex'))) {
       throw Error('Transactions hash does not match');
    }
  };

  // 11. Check if prev block (matching prev hash) is in main branch or side branches. If not, add this to orphan blocks, then query peer we got this from for 1st missing orphan block in prev chain; done with block
  // => Simply check the block append to main chain
  let checkLatestBlock = async function (block) {
    let height = getCurrentHeight();
    let latestBlock = findByHeight(height);
    if (latestBlock.hash !== block.previousBlockHash) {
      throw Error('Block must append main branch');
    }
  };

  // 12. Check that nBits value matches the difficulty rules
  let checkDifficultyWithSystem = async function (block) {
    if (block.difficulty < FIXED_DIFFICULTY) {
      throw Error('Block difficulty must be equal or larger than system ' + FIXED_DIFFICULTY);
    };
  };

  // 13. Reject if timestamp is the median time of the last 11 blocks or before
  // => Not implement

  // 14. For certain old blocks (i.e. on initial block download) check that hash matches known values
  // => Not implement

  // 15. Add block into the tree. There are three cases: 1. block further extends the main branch; 2. block extends a side branch but does not add enough difficulty to make it become the new main branch; 3. block extends a side branch and makes it the new main branch.
  let addToMainBranch = async function (block) {
    // Assume all transactions is taken from the pool
    // 1. For all but the coinbase transaction, apply the following:...
    // Just check transactions are in pool except coinbase
    let transactionsInPool = await transactions.findByHashes(block.transactions.map(t => utils.hash(transactions.toBinary(t))));
    // Except coinbase
    if (transactionsInPool.length != block.transactions.length - 1) {
      throw Error('Some transactions not found in pool');
    }
    // 2. Reject if coinbase value > sum of block creation fee and transaction fees
    // Calculate fee
    let totalFee = _.sumBy(transactionsInPool, 'fee');
    let coinbase = blocks.transactions[0];
    let totalValue = _.sumBy(coinbase.outputs, 'value');
    if (totalValue > totalFee + FIXED_REWARD) {
      throw Error('Coinbase transaction cannot larger than reward + fee');
    }
    await transactions.addCoinbase(coinbase);
    // Add coinbase to array for add to block
    transactionsInPool.unshift(await transactions.findByHash(coinbase.hash));
    // Add transactions to block, remove from pool
    await Promise.each(transactionsInPool, (t, i) => {
      return transactions.addToBlock(t.hash, block.hash, i);
    });
  };

  // 3. (If we have not rejected):
  // => Not implement

  // 4. For each transaction, "Add to wallet if mine"
  let addToWalletIfMine = async function (block) {
    // Nothing to do here as a reference implementation
  };

  // 5. For each transaction in the block, delete any matching transaction from the transaction pool
  // => Already done

  // 6. Relay block to our peers
  let relayToPeer = async function (block) {
    // Use websocket to broadcast to all peer
  };

  // 7. If we rejected, the block is not counted as part of the main branch
  // => Not implement

  let add = async function (block) {
    await Promise.each([
      checkVersion,
      checkExisted,
      checkEmptyTransactions,
      checkDifficulty,
      checkCoinbase,
      checkTransactions2To4,
      checkTransactionsHash,
      checkLatestBlock,
      checkDifficultyWithSystem,
      addToMainBranch,
      addToWalletIfMine,
      relayToPeer
    ], step => step(block));
    return block;
  };

  return { findByHash, findByHeight, getCurrentHeight, add };
};