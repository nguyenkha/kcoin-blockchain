const Promise = require('bluebird');
const bigInt = require('big-integer');
const _ = require('lodash');

module.exports = exports = ({ db, utils, events }) => {
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

  // Find transactions by hashes
  let findByHashes = async function (hashes) {
    return db(TABLE_NAME).whereIn('hash', hashes);
  };

  // Find by block hash
  let findByBlockHash = async function (blockHash) {
    return db(TABLE_NAME).whereIn('blockHash', blockHash).orderBy('index');
  };

  // Find unconfirm transaction
  let findUnconfirmed = async function () {
    return db(TABLE_NAME).whereNull('blockHash').whereNull('index');
  };

  // Update for faster access
  let updateCache = async function (hash) {
    let transaction = await findByHash(hash);
    if (!transaction) {
      throw Error('Transaction not found');
    }
    let cache = _.pick(transaction, 'hash', 'version');
    cache.inputs = (await db(INPUT_TABLE_NAME).where('transactionHash', hash).orderBy('index')).map(input => {
      return _.pick(input, 'referencedOutputHash', 'referencedOutputIndex', 'unlockScript');
    });
    cache.outputs = (await db(OUTPUT_TABLE_NAME).where('transactionHash', hash).orderBy('index')).map(output => {
      return _.pick(output, 'value', 'lockScript');
    });
    await db(TABLE_NAME).where('hash', hash).update({ cache: JSON.stringify(cache) });
  };

  // Update block
  let addToBlock = async function (hash, blockHash, index) {
    await db(TABLE_NAME).where('hash', hash).update({
      blockHash: blockHash,
      index: index
    });
    await updateCache(hash);
  };

  // Convert a transaction to binary format for hashing or checking the size
  let toBinary = function (transaction, withoutUnlockScript) {
    let version = Buffer.alloc(4);
    version.writeUInt32BE(transaction.version);
    let inputCount = Buffer.alloc(4);
    inputCount.writeUInt32BE(transaction.inputs.length);
    let inputs = Buffer.concat(transaction.inputs.map(input => {
      // Output transaction hash
      let outputHash = Buffer.from(input.referencedOutputHash, 'hex');
      // Output transaction index
      let outputIndex = Buffer.alloc(4);
      // Signed may be -1
      outputIndex.writeInt32BE(input.referencedOutputIndex);
      let unlockScriptLength = Buffer.alloc(4);
      // For signing
      if (!withoutUnlockScript) {
        // Script length
        unlockScriptLength.writeUInt32BE(input.unlockScript.length);
        // Script
        let unlockScript = Buffer.from(input.unlockScript, 'binary');
        return Buffer.concat([ outputHash, outputIndex, unlockScriptLength, unlockScript ]);
      }
      // 0 input
      unlockScriptLength.writeUInt32BE(0);
      return Buffer.concat([ outputHash, outputIndex, unlockScriptLength]);
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

  // Sign transaction
  let sign = function (transaction, keys) {
    let message = toBinary(transaction, true);
    transaction.inputs.forEach((input, index) => {
      let key = keys[index];
      let signature = utils.sign(message, key.privateKey);
      // Genereate unlock script
      input.unlockScript = 'PUB ' + key.publicKey + ' SIG ' + signature;
    });
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
    transaction.hash = utils.hash(transaction.binary).toString('hex');
    if (transaction.binary.length > MAX_SIZE) {
      throw Error('Transaction size > ' + (MAX_SIZE / 1024) + 'kB');
    }
  };

  // 4. Each output value, as well as the total, must be in legal money range
  let checkOutputValue = async function (transaction) {
    transaction.totalOutput = 0;
    transaction.outputs.forEach(output => {
      // Check output value is integer
      if (!Number.isInteger(output.value)) {
        throw Error('Output value must be a integer');
      }
      // and in range
      if (output.value >= MAX_UINT32) {
        throw Error('Output value must not larger than max uint32');
      }
      // > 0
      if (output.value <= 0) {
        throw Error('Output value must be at least 1');
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
    transaction.inputs.forEach(input => {
      let hashValue = utils.hexToBigInt(input.referencedOutputHash);
      if (hashValue.compare(bigInt.zero) === 0) {
        throw Error('Reference transaction output can not be 0 except coinbase transaction');
      }
      if (input.referencedOutputIndex === -1) {
        throw Error('Reference transaction output index can not be -1 except coinbase transaction');
      }
    });
  };

  let checkLockScript = async function (transaction) {
    // Check lock script
    transaction.outputs.forEach(output => {
      // ADD [ADDRESS]
      let parts = output.lockScript.split(' ');
      if (parts.length !== 2 || parts[0] !== 'ADD') {
        throw Error('Lock script must have format ADD [ADDRESS]');
      }
    });
  }; 

  // 6. Check that nLockTime <= INT_MAX[1], size in bytes >= 100[2], and sig opcount <= 2[3]
  // => Not implement

  // 7. Reject "nonstandard" transactions: scriptSig doing anything other than pushing numbers on the stack, or scriptPubkey not matching the two usual forms
  let checkScripts = async function (transaction) {
    // Check unlock script of inputs
    transaction.inputs.forEach(input => {
      // PUB [PUBLIC_KEY] SIG [SIGNATURE]
      let parts = input.unlockScript.split(' ');
      if (parts.length !== 4 || parts[0] !== 'PUB' || parts[2] !== 'SIG') {
        throw Error('Unlock script must have format PUB [PUBLIC_KEY] SIG [SIGNATURE]');
      }
    });
    await checkLockScript(transaction);
  };

  // 8. Reject if we already have matching tx in the pool, or in a block in the main branch
  let checkInPoolOrBlock = async function (transaction) {
    let found = await findByHash(transaction.hash);
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
        throw Error('Referenced output ' + input.referencedOutputHash + '#' + input.referencedOutputIndex + ' is found in other transaction');
      }
    });
  };

  // 10. For each input, look in the main branch and the transaction pool to find the referenced output transaction. If the output transaction is missing for any input, this will be an orphan transaction. Add to the orphan transactions, if a matching transaction is not in there already.
  // => Not implement

  // 11. For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject this transaction
  // => Not implement

  // 12. For each input, if the referenced output does not exist (e.g. never existed or has already been spent), reject this transaction
  let checkReferencedOutputExisted = async function (transaction) {
    await Promise.each(transaction.inputs, async (input, i) => {
      // Existed
      let found = await db(OUTPUT_TABLE_NAME)
        .join(TABLE_NAME, 'hash', '=', 'transactionHash')
        .where('transactionHash', input.referencedOutputHash)
        .where(OUTPUT_TABLE_NAME + '.index', input.referencedOutputIndex)
        // Confirmed
        .whereNotNull('blockHash')
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
        // Confirmed
        .whereNotNull('blockHash')
        .first();
      if (found) {
        throw Error('Referenced output was spent');
      }
      // Duplicated
      found = _.find(transaction.inputs, (input2, j) => input2.referencedOutputHash === input.referencedOutputHash && input2.referencedOutputIndex === input.referencedOutputIndex && i !== j);
      if (found) {
        throw Error('Referenced output are spent on same transaction');
      }
    });
  };

  // 13. Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in legal money range
  let checkInputValue = async function (transaction) {
    // Get the value of the referenced output into transaction (note coinbase)
    transaction.totalInput = 0;
    transaction.inputs.forEach((input) => {
      // Check input value is integer
      if (!Number.isInteger(input.referencedOutput.value)) {
        throw Error('Input value must be a integer');
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
    transaction.inputs.forEach(input => {
      let lockScript = input.referencedOutput.lockScript;
      let unlockScript = input.unlockScript;
      let parts = unlockScript.split(' ');
      let publicKey = parts[1];
      let signature = parts[3];
      parts = lockScript.split(' ');
      let address = parts[1];
      // Check address is hash of public key
      if (utils.hash(Buffer.from(publicKey, 'hex')).toString('hex') !== address) {
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
      fee: transaction.fee,
      blockHash: null,
      index: null,
      cache: '{}'
    });
    // Add inputs/ouputs
    await Promise.each(transaction.inputs, async (input, index) => {
      await db(INPUT_TABLE_NAME).insert({
        transactionHash: transaction.hash,
        index: index,
        referencedOutputHash: input.referencedOutputHash,
        referencedOutputIndex: input.referencedOutputIndex,
        unlockScript: input.unlockScript
      });
    });
    await Promise.each(transaction.outputs, async (output, index) => {
      await db(OUTPUT_TABLE_NAME).insert({
        transactionHash: transaction.hash,
        index: index,
        value: output.value,
        lockScript: output.lockScript
      });
    });
    // Update cache
    await updateCache(transaction.hash);
  };

  // 18. Add to wallet if mine
  let addToWalletIfMine = async function (transaction) {
    // Nothing to do here as a reference implementation
  };

  // 19. Relay transaction to peers
  let relayToPeer = async function (transaction) {
    // Use websocket to broadcast to all peer
    events.emit('transaction', transaction);
  };

  // 20. For each orphan transaction that uses this one as one of its inputs, run all these steps(including this one) recursively on that orphan
  // => Not implement

  // Validate transaction (can unlock the unspent output)
  let add = async function (transaction) {
    // Verify transaction
    await Promise.each([
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
    return findByHash(transaction.hash);
  };

  // For block check
  let check2To4 = async function(transaction) {
    await Promise.each([
      checkInputOutputNotEmpty,
      checkSizeInBytes,
      checkOutputValue
    ], step => step(transaction));
    return findByHash(transaction.hash);
  };

  // Add coinbase transaction
  let addCoinbase = async function (transaction) {
    transaction.fee = 0;
    await Promise.each([
      checkLockScript,
      addToTransactionPool
    ], step => step(transaction));
    return findByHash(transaction.hash);
  };

  return { findByHash, findByHashes, findByBlockHash, findUnconfirmed, add, addCoinbase, toBinary, check2To4, addToBlock, sign };
};