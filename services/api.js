const restify = require('restify');
const errors = require('restify-errors');
const wrap = require('express-async-wrap');
const _ = require('lodash');

module.exports = exports = ({ blocks, transactions, miner, utils }) => {
  const app = restify.createServer();
  // Setup body parser and query parser
  app.use(restify.plugins.queryParser({
    mapParams: true
  }));
  app.use(restify.plugins.bodyParser({
    mapParams: true
  }));

  // Hello message
  app.get('/', function (req, res) {
    res.send(200, {
      message: 'kcoin blockchain api by Kha Do'
    });
  });

  // Init
  app.get('/init', wrap(async function (req, res) {
    // Check genesis block exist
    let height = await blocks.getCurrentHeight();
    if (height === -1) {
      try {
        // Generate add address
        let addressWithKeys = utils.generateAddress();
        // Generate genesis block
        let genesisBlock = miner.generateBlock('0'.repeat(64), 'KCOIN BLOCKCHAIN BY KHA DO', [
          {
            value: blocks.FIXED_REWARD,
            lockScript: 'ADDRESS ' + addressWithKeys.address
          }
        ], []);

        // Add this block to main branch
        await blocks.add(genesisBlock);
        res.send(200, addressWithKeys);
      } catch (err) {
        res.send(400, {
          error: err.stack
        });
      }
    } else {
      res.send(200, {
        message: 'Blockchain has already initialized'
      });
    }
  }));

  // Add new transaction. TODO: Add WS
  app.post('/transactions', wrap(async function (req, res) {
    // Validate and add transaction into database
    try {
      let transaction = await transactions.add(req.body);
      res.send(200, transaction);
    } catch (err) {
      throw new errors.InvalidContentError(err.message);
    }
  }));

  // Add new block. TODO: Add WS, Discard alternative brand block has no news
  app.post('/blocks', wrap(async function (req, res) {
    // Validate and add block into database
  }));

  // Get all block in main chain. TODO: Pagination
  app.get('/blocks', wrap(async function (req, res) {
    // Get blocks with pagingations limit, offset
  }));

  // Get a block by hash or height in main chain
  app.get('/blocks/:id', wrap(async function (req, res) {
    let id = req.params.id;
    let block;
    // Hash
    if (id.length == 64) {
      block = await blocks.findByHash(id);
    } else {
      // Height in main chain
      let height = parseInt(id.height);
      // TODO: Check height is number
      block = await blocks.findByHeight(height);
    }
    if (!block) {
      throw new errors.ResourceNotFoundError('Block not found');
    }
    // Format response
    res.send(200, block);
  }));

  // Get a transaction by hash (and blocks which transaction was put in if any)
  app.get('/transactions/:id', wrap(async function (req, res) {
    // Hash
    let transaction = await transactions.findByHash(req.params.id);
    if (!transaction) {
      throw new errors.ResourceNotFoundError('Transaction not found');
    }
    // Find block which transaction was put in (only return hash of block)
    let blocksContainTransaction = await blocks.findAllByTransactionHash(transaction.hash);
    // Format response
    res.send(200, transaction);
  }));

  // Get list of unconfirmed transactions. TODO: Sortable by time, date, Add WS for this
  app.get('/unconfirmed-transactions', wrap(async function (req, res) {

  }));

  const port = process.env.PORT || 5000;

  // Starting HTTP server
  app.listen(port)

  console.log('Server is listening on port', port);

  return app;
};