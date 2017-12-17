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
    // Type: 0 - Side branch, 1 - Main chain, -1 - Orphan
    t.integer('type').notNullable();
  });

  // Transaction
  await knex.schema.createTable('transactions', t => {
    // Hash as primary key
    t.string('hash', 32).primary();
    // Version, signed, 1
    t.integer('version').notNullable();
    // Total input
    t.integer('totalInput').notNullable();
    // Total output
    t.integer('totalOutput').notNullable();
    // Type: 0 - Pool, 1 - Main chain, -1 - Orphan
    t.integer('type').notNullable();
  });

  // Transaction input
  await knex.schema.createTable('transaction_inputs', t => {
    // Transaction hash
    t.string('transactionHash', 32).notNullable();
    // Input index
    t.integer('index').unsigned().notNullable();
    t.primary(['transactionHash', 'index']);
    // Referenced output transaction
    t.string('referencedOutputHash', 32).notNullable();
    // Referenced output transaction index
    t.integer('referencedOutputIndex').notNullable();
    // Unlock script
    t.text('unlockScript').notNullable();
  });

  // Transaction output
  await knex.schema.createTable('transaction_outputs', t => {
    // Transaction hash
    t.string('transactionHash', 32).notNullable();
    // Input index
    t.integer('index').unsigned().notNullable();
    t.primary(['transactionHash', 'index']);
    // Value, be careful with biginteger
    t.biginteger('value').notNullable();
    // Lock script
    t.text('lockScript').notNullable();
  });
  
  // Transactions in block, if not, transation is waiting to be confirmed
  await knex.schema.createTable('block_transactions', t => {
    // Primary key
    t.string('blockHash', 32).notNullable().references('blocks.hash');
    t.string('transctionHash', 32).notNullable().references('transactions.hash');
    t.primary(['blockHash', 'transctionHash']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTable('transaction_inputs');
  await knex.schema.dropTable('transaction_outputs');
  await knex.schema.dropTable('block_transactions');
  await knex.schema.dropTable('blocks');
  await knex.schema.dropTable('transactions');
};
