const knex = require('knex');

module.exports = exports = () => {
  return knex(require('../knexfile'));
};