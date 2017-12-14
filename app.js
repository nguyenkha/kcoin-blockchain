const restify = require('restify');
const util = require('./models/util');
const app = restify.createServer();

// Hello message
app.get('/', function (req, res) {
  res.send(200, {
    message: 'kcoin blockchain api by Kha Do'
  });
});

// Add new transaction => Broadcast new transaction

// Add new block => Broadcast new block

// Get all block in main chain. TODO: Pagination

// Get a block by hash or seq in main chain

// Get list of waiting transaction

// Get a transaction by ?

const port = process.env.PORT || 5000;

// Starting HTTP server
app.listen(port)

console.log('Server is listening on port', port);