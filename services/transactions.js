const Promise = require('bluebird');
const bitInt = require('big-integer');
const _ = require('lodash');

module.exports = exports = ({ db, utils }) => {
  const TABLE_NAME = 'transactions';
  const INPUT_TABLE_NAME = 'transaction_inputs';
  const OUTPUT_TABLE_NAME = 'transaction_outputs';
  // 1MB
  const MAX_SIZE = 1024 * 1024;
  // Max uint32
  const MAX_UINT32 = 2 ** 32;

  // Find one transaction by its hash
  let findByHash = async function (hash) {
    return db(TABLE_NAME).where('hash', hash).first();
  };

  // Convert a transaction to binary format for hashing or checking the size
  let toBinary = function (transaction, withoutUnlockScript) {
    let version = Buffer.alloc(4);
    version.writeUInt32BE(transaction.version);
    let inputCount = Buffer.alloc(4);
    inputCount.writeUInt32BE(transaction.inputs.length);
    let inputs = Buffer.concat(_.sortBy(transaction.inputs, 'index').map(input => {
      // Output transaction hash
      let outputHash = Buffer.from(input.hash, 'hex');
      // Output transaction index
      let outputIndex = Buffer.alloc(4);
      outputIndex.writeUInt32BE(input.index);
      // For signing
      if (withoutUnlockScript) {
        // Script length
        let unlockScriptLength = Buffer.alloc(4);
        unlockScriptLength.writeUInt32BE(input.unlockScript.length);
        // Script
        let unlockScript = Buffer.from(input.unlockScript, 'binary');
        return Buffer.concat([outputHash, outputIndex, unlockScriptLength, unlockScript ]);
      }
    }));
    let outputCount = Buffer.alloc(4);
    outputCount.writeUInt32BE(transaction.outputs.length);
    let outputs = Buffer.concat(_.sortBy(transaction.outputs, 'index').map(output => {
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

  // 1. Check syntactic correctness
  let checkVersion = async function (transaction) {
    if (transaction.version !== 1) {
      throw Error('Only support version 1');
    }
  };

  // 2. Make sure neither in or out lists are empty
  let checkInputOutputNotEmpty = async function (transaction) {
    if (transaction.inputs.length === 0) {
      throw Error('Inputs cannot be empty');
    }
    if (transaction.outputs.length === 0) {
      throw Error('Outputs cannot be empty');
    }
  };

  // 3. Size in bytes <= MAX_BLOCK_SIZE
  let checkSizeInBytes = async function (transaction) {
    transaction.binary = toBinary(transaction);
    if (transaction.binary.length > MAX_SIZE) {
      throw Error('Transaction size > ' + (MAX_SIZE / 1024) + 'kB');
    }
  };

  // 4. Each output value, as well as the total, must be in legal money range
  let checkOutputValue = async function (transaction) {
    transaction.totalOutput = 0;
    transaction.outputs.each(output => {
      // Check output value is integer
      if (!Number.isInteger(output.value)) {
        throw Error('Output value must be a integer');
      }
      // and in range
      if (output.value >= MAX_UINT32) {
        throw Error('Output value must not larger than max uint32');
      }
      transaction.totalOutput += output.value;
    });
    // and in range
    if (transaction.totalOutput >= MAX_UINT32) {
      throw Error('Total output value must not larger than max uint32');
    }
  };

  // 5. Make sure none of the inputs have hash=0, n=-1 (coinbase transaction)
  let checkNotCoinbase = async function (transaction) {
    // Check input transaction hash not 0 and index not -1
    transaction.inputs.each(input => {
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
  // => Not implement

  // 7. Reject "nonstandard" transactions: scriptSig doing anything other than pushing numbers on the stack, or scriptPubkey not matching the two usual forms
  let checkScripts = async function (transaction) {
    // Check unlock script of inputs
    transaction.each(transaction.inputs, input => {
      // PUB [PUBLIC_KEY] SIG [SIGNATURE]
      let parts = input.unlockScript.split(' ');
      if (parts.length !== 4 || parts[0] !== 'PUB' || parts[2] !== 'SIG') {
        throw Error('Unlock script must have format PUB [PUBLIC_KEY] SIG [SIGNATURE]');
      }
    });
    // Check lock script
    transaction.each(transaction.outputs, output => {
      // ADDRESS [ADDRESS]
      let parts = output.lockScript.split(' ');
      if (parts.length !== 2 || parts[0] !== 'ADDRESS') {
        throw Error('Lock script must have format ADDRESS [ADDRESS]');
      }
    });
  };

  // 8. Reject if we already have matching tx in the pool, or in a block in the main branch
  let checkInPoolOrBlock = async function (transaction) {
    transaction.hash = utils.hash(transaction.binary);
    let found = await exports.findByHash(transaction.hash);
    if (found) {
      throw Error('Transaction found in pool or block');
    }
  };

  // 9. For each input, if the referenced output exists in any other tx in the pool, reject this transaction.
  let checkRefecenedOutputInOtherTransactionInPool = async function (transaction) {
    await Promise.each(transaction.inputs, async input => {
      let found = await db(INPUT_TABLE_NAME)
        .join(TABLE_NAME, 'hash', '=', 'transactionHash')
        // Same output and index
        .where('referencedOutputHash', input.referencedOutputHash)
        .where('referencedOutputIndex', input.referencedOutputIndex)
        // Null => in pool
        .whereNull('blockHash')
        .whereNull(TABLE_NAME + '.index')
        .first();
      if (found) {
        throw Error('Referenced output ' + input.hash + '#' + input.index + ' is found in other transaction');
      }
    });
  };

  // 10. For each input, look in the main branch and the transaction pool to find the referenced output transaction. If the output transaction is missing for any input, this will be an orphan transaction. Add to the orphan transactions, if a matching transaction is not in there already.
  // => Not implement

  // 11. For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject this transaction
  // => Not implement

  // 12. For each input, if the referenced output does not exist (e.g. never existed or has already been spent), reject this transaction
  let checkReferencedOutputExisted = async function (transaction) {
    await Promise.each(transaction.inputs, async input => {
      // Existed
      let found = await db(OUTPUT_TABLE_NAME)
        .where('transactionHash', input.referencedOutputHash)
        .where('index', input.referencedOutputIndex)
        .first();
      if (!found) {
        throw Error('Referenced output not found');
      }
      input.referencedOutput = found;
      // Not spent
      found = await db(INPUT_TABLE_NAME)
        .join(TABLE_NAME, 'hash', '=', 'transactionHash')
        .where('referencedOutputHash', input.referencedOutputHash)
        .where('referencedOutputIndex', input.referencedOutputIndex)
        // Null => in pool
        .whereNotNull('blockHash')
        .first();
      if (found) {
        throw Error('Referenced output was spent');
      }
    });
  };

  // 13. Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in legal money range
  let checkInputValue = async function (transaction) {
    // Get the value of the referenced output into transaction (note coinbase)
    transaction.totalInput = 0;
    transaction.inputs.each((input) => {
      // Check input value is integer
      if (!Number.isInteger(input.referencedOutput.value)) {
        throw Error('Inout value must be a integer');
      }
      // and in range
      if (input.referencedOutput.value >= MAX_UINT32) {
        throw Error('Input value must not larger than max uint32');
      }
      transaction.totalInput += input.referencedOutput.value;
    });
    // and in range
    if (transaction.totalInput >= MAX_UINT32) {
      throw Error('Total input value must not larger than max uint32');
    }
  };

  // 14. Reject if the sum of input values < sum of output values
  let checkSumOfInputAndOutput = async function (transaction) {
    if (transaction.totalInput < transaction.totalOutput) {
      throw Error('Total input must be equal or larger than total output');
    }
    transaction.fee = transaction.totalInput - transaction.totalOutput;
  };

  // 15. Reject if transaction fee (defined as sum of input values minus sum of output values) would be too low to get into an empty block
  // => Not implement

  // 16. Verify the scriptPubKey accepts for each input; reject if any are bad
  let checkReferencedOutputCanBeUnloked = async function (transaction) {
    // Create message without unlock script
    let message = toBinary(transaction, true);
    // TODO: Later after determine the signature format
    transaction.inputs.each(input => {
      let lockScript = input.referencedOutput.lockScript;
      let unlockScript = input.unlockScript;
      let parts = unlockScript.split(' ');
      let publicKey = parts[1];
      let signature = parts[3];
      parts = lockScript.split(' ');
      let address = parts[1];
      // Check address is hash of public key
      if (utils.hash(publicKey) !== address) {
        throw Error('Address and public cannot match');
      }
      // Check signature with public key
      if (!utils.verify(message, publicKey, signature)) {
        throw Error('Cannot unlock the reference output ' + input.referencedOutputHash + '#' + input.referencedOutputIndex);
      }
    });
  };

  // 17. Add to transaction pool
  let addToTransactionPool = async function (transaction) {
    // Add to database
    await db(TABLE_NAME).insert({
      hash: transaction.hash,
      version: transaction.version,
      blockHash: null,
      index: null
    });
    // Add inputs/ouputs
    await Promise.each(transaction.inputs, async input => {
      await db(INPUT_TABLE_NAME).insert({
        transactionHash: transaction.hash,
        index: input.index,
        referencedOutputHash: input.referencedOutputHash,
        referencedOutputIndex: input.referencedOutputIndex,
        unlockScript: input.unlockScript
      });
    });
    await Promise.each(transaction.outputs, async output => {
      await db(OUTPUT_TABLE_NAME).insert({
        transactionHash: transaction.hash,
        index: output.index,
        value: output.value,
        lockScript: output.lockScript
      });
    });
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
  // => Not implement

  // Validate transaction (can unlock the unspent output)
  let add = async function (transaction) {
    // Verify transaction
    return Promise.each([
      checkVersion,
      checkInputOutputNotEmpty,
      checkSizeInBytes,
      checkOutputValue,
      checkNotCoinbase,
      checkScripts,
      checkInPoolOrBlock,
      checkRefecenedOutputInOtherTransactionInPool,
      checkReferencedOutputExisted,
      checkInputValue,
      checkSumOfInputAndOutput,
      checkReferencedOutputCanBeUnloked,
      addToTransactionPool,
      addToWalletIfMine,
      relayToPeer
    ], step => step(transaction));
  };

  return { findByHash, add, toBinary, fromBinary };
};