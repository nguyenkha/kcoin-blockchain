exports.up = async function(knex) {
  // Block
  await knex.schema.createTable('blocks', t => {
    // Hash as primary key
    t.string('hash', 32).primary();
    // Block height starting starting from 0
    t.integer('height').unsigned().notNullable();
    // Version, 1
    t.integer('version').unsigned().notNullable();
    // Null for genesis block, no need to reference, may be orphan
    t.string('previousBlockHash', 32);
    // Hash of all transaction
    t.string('transactionsHash', 32).notNullable();
    // Timestamp that block was generated, unsigned
    t.integer('timestamp').unsigned().notNullable();
    // Nonce to generate block has with difficulty
    t.integer('nonce').unsigned().notNullable();
    // Difficulty apply for this block
    t.integer('difficulty').unsigned().notNullable();
    // DB timestamp
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  // Transaction
  await knex.schema.createTable('transactions', t => {
    // Hash as primary key
    t.string('hash', 32).primary();
    // Version, 1
    t.integer('version').unsigned().notNullable();
    // Fee
    t.integer('fee').unsigned().notNullable();
    // Hash of block (main branch), null if in pool
    t.string('blockHash', 32).references('blocks.hash');
    // Index of transaction in block (main branch), null if in pool
    t.integer('index').unsigned();
    // DB timestamp
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  // Transaction input
  await knex.schema.createTable('transaction_inputs', t => {
    // Transaction hash
    t.string('transactionHash', 32).notNullable().references('transactions.hash');
    // Input index
    t.integer('index').unsigned().notNullable();
    t.primary(['transactionHash', 'index']);
    // Referenced output transaction, no need to reference
    t.string('referencedOutputHash', 32).notNullable();
    // Referenced output transaction index, signed
    t.integer('referencedOutputIndex').notNullable();
    // Unlock script
    t.text('unlockScript').notNullable();
  });

  // Transaction output
  await knex.schema.createTable('transaction_outputs', t => {
    // Transaction hash
    t.string('transactionHash', 32).notNullable().references('transactions.hash');
    // Input index
    t.integer('index').unsigned().notNullable();
    t.primary(['transactionHash', 'index']);
    // Value
    t.integer('value').unsigned().notNullable();
    // Lock script
    t.text('lockScript').notNullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTable('transaction_inputs');
  await knex.schema.dropTable('transaction_outputs');
  await knex.schema.dropTable('blocks');
  await knex.schema.dropTable('transactions');
};
