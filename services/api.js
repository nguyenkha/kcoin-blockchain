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
    let found = await blocks.findGenesis();
    if (!found) {
      try {
        // Generate add address
        let addressWithKeys = utils.generateAddress();
        // Generate genesis block
        let genesisBlock = await miner.generateBlock('0'.repeat(64), 'KCOIN BLOCKCHAIN BY KHA DO @ JAPAN DEC 2017', [
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
      res.send(200, transaction.cache);
    } catch (err) {
      throw new errors.InvalidContentError(err.message);
    }
  }));

  // Add new block. TODO: Add WS, Discard alternative brand block has no news
  // Disabled, single mineer for simple
  // app.post('/blocks', wrap(async function (req, res) {
  //   // Validate and add block into database
  //   try {
  //     let block = await blocks.add(req.body);
  //     res.send(200, block.cache);
  //   } catch (err) {
  //     throw new errors.InvalidContentError(err.message);
  //   }
  // }));

  // Get all block in main branch for genesis to newest. TODO: Pagination
  app.get('/blocks', wrap(async function (req, res) {
    // Get blocks with pagingations limit, offset
    let allBlocks = (await blocks.getAllBlocks()).map(b => b.cache);
    res.send(200, allBlocks);
  }));

  // Get a block by hash or height in main chain
  app.get('/blocks/:id', wrap(async function (req, res) {
    let id = req.params.id;
    let block;
    // Hash
    if (id.length === 64) {
      block = await blocks.findByHash(id);
    } else {
      // Height in main chain
      let height = parseInt(id);
      // TODO: Check height is number
      block = await blocks.findByHeight(height);
    }
    if (!block) {
      throw new errors.ResourceNotFoundError('Block not found');
    }
    // Format response
    res.send(200, block.cache);
  }));

  // Get a transaction by hash (and blocks which transaction was put in if any)
  app.get('/transactions/:id', wrap(async function (req, res) {
    // Hash
    let transaction = await transactions.findByHash(req.params.id);
    if (!transaction) {
      throw new errors.ResourceNotFoundError('Transaction not found');
    }
    // Format response
    res.send(200, transaction.cache);
  }));

  // Get list of unconfirmed transactions. TODO: Sortable by time, date, Add WS for this
  app.get('/unconfirmed-transactions', wrap(async function (req, res) {
    let unconfirmedTransactions = (await transactions.findUnconfirmed()).map(t => t.cache);
    res.send(200, unconfirmedTransactions);
  }));

  // Get difficulty, block reward
  app.get('/info', wrap(async function (req, res) {
    res.send(200, {
      difficulty: blocks.FIXED_DIFFICULTY,
      blockReward: blocks.FIXED_REWARD
    });
  }));

  // Create address
  app.get('/generate-address', wrap(async function (req, res) {
    res.send(200, utils.generateAddress());
  }));

  app.on('restifyError', function(req, res, err, cb) {
    console.log(err);
    return cb();
  });

  const port = process.env.PORT || 5000;

  // Starting HTTP server
  app.listen(port)

  console.log('Server is listening on port', port);

  // Graceful shutdown
  let gracefulShutdown = () => {
    console.log('Shutting down http server');
    app.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  return app;
};