exports.up = async function(knex) {
  // Block
  await knex.schema.createTable('blocks', t => {
    // Hash as primary key
    t.string('hash', 32).primary();
    // Block height starting starting from 0
    t.integer('height').unsigned().notNullable();
    // Version, signed, 1
    t.integer('version').notNullable();
    // Null for genesis block
    t.string('hashPrevBlock', 32);
    // Merkle root hash of all transaction
    t.string('hashMerkleRoot', 32).notNullable();
    // Timestamp that block was generated, unsigned
    t.integer('time').unsigned().notNullable();
    // Nonce to generate block has with difficulty
    t.integer('nonce').unsigned().notNullable();
    // DB timestamp
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  // Transaction
  await knex.schema.createTable('transactions', t => {
    // Hash as primary key
    t.string('hash', 32).primary();
    // Version, signed, 1
    t.integer('version').notNullable();
    // Inputs as JSON
    t.jsonb('inputs');
    // Output as JSON
    t.jsonb('outputs');
    // DB timestamp
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  // Transactions in block, if not, transation is waiting to be confirmed
  await knex.schema.createTable('block_transactions', t => {
    // Primary key
    t.string('blockHash', 32).notNullable().references('blocks.hash');
    t.string('transctionHash', 32).notNullable().references('transactions.hash');
    t.primary(['blockHash', 'transctionHash']);
    // DB timestamp
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTable('block_transactions');
  await knex.schema.dropTable('blocks');
  await knex.schema.dropTable('transactions');
};
