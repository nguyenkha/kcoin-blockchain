const Promise = require('bluebird');

module.exports = exports = ({ blocks, transactions, utils }) => {
  let generateBlock = async function (previousBlockHash, message, outputs, transactionList) {
    let block = {};
    block.version = 1;
    block.previousBlockHash = previousBlockHash;
    // Create coinbase transaction
    block.transactions = transactionList;
    block.timestamp = Math.floor(Date.now() / 1000);
    block.difficulty = blocks.FIXED_DIFFICULTY;
    block.transactions.unshift({
      version: 1,
      inputs: [
        {
          referencedOutputHash: '0'.repeat(32),
          referencedOutputIndex: -1,
          unlockScript: message
        }
      ],
      outputs: outputs
    });
    block.transactionsHash = utils.hash(blocks.getTransactionsBinary(block)).toString('hex');
    // Loop to find nonce 
    block.nonce = 0;
    for (;;) {
      block.hash = blocks.calculateHash(block).toString('hex');

      console.log('Generating block with nonce:', block.nonce, ' - hash:', block.hash);
      
      let prefix = '0'.repeat(block.difficulty);
      if (block.hash.toString('hex').indexOf(prefix) !== 0) {
        block.nonce++;
      } else {
        break;
      }

      // Delay 0.01 second for other thing to run
      await Promise.delay(10);
    }
    return block;
  };

  return { generateBlock };
};