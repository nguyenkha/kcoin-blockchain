const restify = require('restify');

const app = restify.createServer();

app.get('/', function (req, res) {
  res.send(200, {
    message: 'kcoin blockchain api by Kha Do'
  });
});

const port = process.env.PORT || 5000;

app.listen(port)

console.log('Server is listening on port', port);