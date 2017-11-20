const express = require('express');

const app = express();

app.get('/', function (req, res) {
  res.json({
    message: 'kcoin blockchain api by Kha Do'
  });
});

const port = process.env.PORT || 5000;

app.listen(port)

console.log('Server is listening on port', port);