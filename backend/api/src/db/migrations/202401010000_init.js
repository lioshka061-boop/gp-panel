exports.up = async function (knex) {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('full_name').notNullable();
    table.string('phone').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.enum('role', ['user', 'admin']).notNullable().defaultTo('user');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('bots', (table) => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.decimal('price', 10, 2).notNullable().defaultTo(0);
    table.string('currency').notNullable().defaultTo('UAH');
    table.boolean('is_free').notNullable().defaultTo(false);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('total_steps').notNullable().defaultTo(30);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('purchases', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .unsigned()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('bot_id')
      .unsigned()
      .references('id')
      .inTable('bots')
      .onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency').notNullable();
    table
      .enum('status', ['pending', 'paid', 'canceled', 'expired'])
      .notNullable()
      .defaultTo('pending');
    table.string('provider').notNullable();
    table.string('order_reference').notNullable().unique();
    table.string('provider_payment_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('paid_at');
  });

  await knex.schema.createTable('progress', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .unsigned()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('bot_id')
      .unsigned()
      .references('id')
      .inTable('bots')
      .onDelete('CASCADE');
    table.integer('current_step').notNullable().defaultTo(0);
    table.integer('max_step_reached').notNullable().defaultTo(0);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'bot_id']);
  });

  await knex.schema.createTable('settings', (table) => {
    table.string('key').primary();
    table.text('value').notNullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('progress');
  await knex.schema.dropTableIfExists('purchases');
  await knex.schema.dropTableIfExists('bots');
  await knex.schema.dropTableIfExists('users');
};
