module.exports = exports = ({ blocks }) => {
  let generateBlock = function (previousBlockHash, message, outputs, transactions) {
    let block = {};
    block.version = 1;
    block.previousBlockHash = previousBlockHash;
    // Create coinbase transaction
    block.transactions = [];
    block.transactions.push({
      timestamp: Math.floor(Date.now() / 1000),
      version: 1,
      inputs: [
        {
          referencedOutputHash: '0'.repeat(32),
          referencedOutputInex: -1,
          unlockScriptLength: message
        }
      ],
      outputs: outputs
    });
  };

  return { generateBlock };
};