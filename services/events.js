const EventEmitter = require('events');

module.exports = exports = ({ db }) => {
  return new EventEmitter();
};