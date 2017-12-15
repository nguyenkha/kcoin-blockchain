const restify = require('restify');
const util = require('./models/util');
const app = restify.createServer();
const errors = require('restify-errors');
const wrap = require('express-async-wrap');
const blocks = require('./models/blocks');
const transactions = require('./models/blocks');
const _ = require('lodash');

// Hello message
app.get('/', function (req, res) {
  res.send(200, {
    message: 'kcoin blockchain api by Kha Do'
  });
});

// Add new transaction. TODO: Add WS
app.post('/transactions', wrap(async function (req, res) {
  // Verify transaction

  // Add transaction into database
}));

// Add new block. TODO: Add WS, Discard alternative brand block has no news
app.post('/blocks', wrap(async function (req, res) {
  // Verify block

  // Add block into database
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
  if (id.length == 32) {
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
  // Find block which transaction was put in
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