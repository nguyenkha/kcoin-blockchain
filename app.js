const express = require('express');

const app = express();

app.get('/', function (req, res) {
  res.json({
    message: 'kcoin blockchain api by Kha Do'
  });
});

app.listen(process.env.PORT || 5000)

