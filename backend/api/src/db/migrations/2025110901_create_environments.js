exports.up = async function (knex) {
  await knex.schema.createTable('environments', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('bot_id')
      .unsigned()
      .references('id')
      .inTable('bots')
      .onDelete('SET NULL');
    table.string('title').notNullable();
    table.text('notes');
    table.integer('current_step').notNullable().defaultTo(1);
    table.integer('total_steps').notNullable().defaultTo(30);
    table.integer('min_step').notNullable().defaultTo(1);
    table.jsonb('state').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.boolean('brief_locked').notNullable().defaultTo(false);
    table.integer('brief_step').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('environments');
};
