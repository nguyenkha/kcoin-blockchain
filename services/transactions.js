const Promise = require('bluebird');
const bitInt = require('big-integer');
const _ = require('lodash');

module.exports = exports = ({ db, utils }) => {
  const TABLE_NAME = 'transactions';

  // Find one transaction by its hash
  let findByHash = async function (hash) {
    return db(TABLE_NAME).where('hash', hash).first();
  };

  // Convert a transaction to binary format for hashing or checking the size
  let toBinary = function (transaction) {
    let version = Buffer.alloc(4);
    version.writeUInt32BE(transaction.version);
    let inputCount = Buffer.alloc(4);
    inputCount.writeUInt32BE(transaction.inputs.length);
    let inputs = Buffer.concat(transaction.inputs.map(input => {
      // Output transaction hash
      let outputHash = Buffer.from(input.hash, 'hex');
      // Output transaction index
      let outputIndex = Buffer.alloc(4);
      outputIndex.writeUInt32BE(input.index);
      // Script length
      let unlockScriptLength = Buffer.alloc(4);
      unlockScriptLength.writeUInt32BE(input.unlockScript.length);
      // Script
      let unlockScript = Buffer.from(input.unlockScript, 'binary');
      return Buffer.concat([outputHash, outputIndex, unlockScriptLength, unlockScript ]);
    }));
    let outputCount = Buffer.alloc(4);
    outputCount.writeUInt32BE(transaction.outputs.length);
    let outputs = Buffer.concat(transaction.outputs.map(output => {
      // Output value
      let value = Buffer.alloc(4);
      value.writeUInt32BE(output.value);
      // Script length
      let lockScriptLength = Buffer.alloc(4);
      lockScriptLength.writeUInt32BE(output.lockScript.length);
      // Script
      let lockScript = Buffer.from(output.lockScript);
      return Buffer.concat([value, lockScriptLength, lockScript ]);
    }));
    return Buffer.concat([ version, inputCount, inputs, outputCount, outputs ]);
  };

  // Convert data back to object
  let fromBinary = function(data) {
    let transaction = {};
    let offset = 0;
    transaction.version = data.readUInt32BE(offset);
    offset += 4;
    transaction.inputs = [];
    let inputCount = data.readUInt32BE(offset);
    offset += 4;
    for (let i = 0; i < inputCount; i++) {
      let input = {};
      input.hash = data.slice(offset, offset + 32).toString('hex');
      offset += 32;
      input.index = data.readUInt32BE(offset);
      offset += 4;
      let unlockScriptLength = data.readUInt32BE(offset);
      offset += 4;
      input.unlockScript = data.slice(offset, offset + unlockScriptLength).toString('binary');
      offset += unlockScriptLength;
      transaction.inputs.push(input);
    };
    transaction.outputs = [];
    let outputCount = data.readUInt32BE(offset);
    offset += 4;
    for (let i = 0; i < outputCount; i++) {
      let output = {};
      output.value = data.readUInt32BE(offset);
      offset += 4;
      let lockScriptLength = data.readUInt32BE(offset);
      offset += 4;
      output.lockScript = data.slice(offset, offset + lockScriptLength).toString('binary');
      offset += lockScriptLength;
      transaction.outputs.push(output);
    }
    return transaction;
  };

  // https://en.bitcoin.it/wiki/Protocol_rules - "tx" messages

  // 1. Check syntactic correctness
  let checkSyntacticCorrectness = async function (transaction) {
    // Check version
    if (transaction.version !== 1) {
      throw Error('Only support version 1');
    }
  };

  // 2. Make sure neither in or out lists are empty
  let checkInOutListNotEmpty = async function (transaction) {
    if (!Array.isArray(transaction.inputs)) {
      throw Error('Inputs must be an array');
    }
    if (transaction.inputs.length === 0) {
      throw Error('Inputs must have at least one reference transaction output');
    }
    if (!Array.isArray(transaction.ouputs)) {
      throw Error('Outputs must be an array');
    }
    if (transaction.outputs.length === 0) {
      throw Error('Outputs must have at least one address to send');
    }
  };

  // 3. Size in bytes <= MAX_BLOCK_SIZE
  let checkSizeInBytes = async function (transaction) {
    // Not implement
  };

  // 4. Each output value, as well as the total, must be in legal money range
  let checkOutputValue = async function (transaction) {
    // Check output value is integer in KCC
    transaction.outputs.each((output) => {
      if (!Number.isInteger(output.value)) {
        throw Error('Output value must be a integer')
      }
    });
  };

  // 5. Make sure none of the inputs have hash=0, n=-1 (coinbase transaction)
  let checkNotCoinbase = async function (transaction) {
    // Check input transaction hash not 0 and index not -1
    transaction.inputs.each((input) => {
      let hashValue = util.hexToBigInt(input.hash);
      if (hashValue.compare(bigInt.zero) === 0) {
        throw Error('Reference transaction output can not be 0 except coinbase transaction');
      }
      if (input.index === -1) {
        throw Error('Reference transaction output index can not be -1 except coinbase transaction');
      }
    });
  };

  // 6. Check that nLockTime <= INT_MAX[1], size in bytes >= 100[2], and sig opcount <= 2[3]
  let checkLockTimeSizeAndSigOpCount = async function (transaction) {
    // Not implement
  };

  // 7. Reject "nonstandard" transactions: scriptSig doing anything other than pushing numbers on the stack, or scriptPubkey not matching the two usual forms
  let checkNoneStandard = async function (transaction) {
    // TODO: Later after determine the signature format
  };

  // 8. Reject if we already have matching tx in the pool, or in a block in the main branch
  let checkInPoolOrBlock = async function (transaction) {
    let found = await exports.findByHash(transaction.hash);
    // TODO: Check only in *main chain*
    if (found) {
      throw Error('Transaction found in pool or block');
    }
  };

  // 9. For each input, if the referenced output exists in any other tx in the pool, reject this transaction.
  let checkOutputInOtherTransactionInPool = async function (transaction) {
    // TODO: Add transaction input and output table
  };

  // 10. For each input, look in the main branch and the transaction pool to find the referenced output transaction. If the output transaction is missing for any input, this will be an orphan transaction. Add to the orphan transactions, if a matching transaction is not in there already.
  let checkOrphanTransaction = async function (transaction) {
    // TODO: Add orphan transaction flag
  };

  // 11. For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject this transaction
  let checkCoinbaseOutputMaturity = async function (transaction) {
    // TODO: Find age and check
  };

  // 12. For each input, if the referenced output does not exist (e.g. never existed or has already been spent), reject this transaction
  let checkOutputExisted = async function (transaction) {
    // TODO: Check spent flag and not exist
  };

  // 13. Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in legal money range
  let checkInputValue = async function (transaction) {
    // Get the value of the referenced output into transaction (note coinbase)
  };

  // 14. Reject if the sum of input values < sum of output values
  let checkSumOfInputAndOutput = async function (transaction) {
    let sumInput = _.sumBy(transaction.inputs, input => input.value);
    let sumOutput = _.sumBy(transaction.outputs, output => output.value);
    if (sumInput < sumOutput) {
      throw Error('Total input must be equal or larger than total output');
    }
  };

  // 15. Reject if transaction fee (defined as sum of input values minus sum of output values) would be too low to get into an empty block
  let checkTransactionFee = async function (transaction) {
    // Not implement
  };

  // 16. Verify the scriptPubKey accepts for each input; reject if any are bad
  let checkInputCanBeUnloked = async function (transaction) {
    // TODO: Later after determine the signature format
  };

  // 17. Add to transaction pool
  let addToTransactionPool = async function (transaction) {
    // Add to database
  };

  // 18. Add to wallet if mine
  let addToWalletIfMine = async function (transaction) {
    // Nothing to do here as a reference implementation
  };

  // 19. Relay transaction to peers
  let relayToPeer = async function (transaction) {
    // Use websocket to broadcast to all peer
  };

  // 20. For each orphan transaction that uses this one as one of its inputs, run all these steps(including this one) recursively on that orphan
  let processOrphanTransactionHasInputIsThis = async function (transaction) {
    // Run through the process all of orphan transaction
  };

  // List of steps how to deal with a transaction
  let STEPS = [
    checkSyntacticCorrectness,
    checkInOutListNotEmpty,
    checkSizeInBytes,
    checkOutputValue,
    checkNotCoinbase,
    checkLockTimeSizeAndSigOpCount,
    checkNoneStandard,
    checkInPoolOrBlock,
    checkOutputInOtherTransactionInPool,
    checkOrphanTransaction,
    checkCoinbaseOutputMaturity,
    checkOutputExisted,
    checkInputValue,
    checkSumOfInputAndOutput,
    checkTransactionFee,
    checkInputCanBeUnloked,
    addToTransactionPool,
    addToWalletIfMine,
    relayToPeer,
    processOrphanTransactionHasInputIsThis
  ];

  // Validate transaction (can unlock the unspent output)
  let add = async function (transaction) {
    await Promise.each(STEPS, step => step(transaction));
    // Return the format transaction with all information
  };

  return { findByHash, add, toBinary, fromBinary };
};