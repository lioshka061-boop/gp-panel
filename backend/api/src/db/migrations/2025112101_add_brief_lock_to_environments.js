exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('environments');
  if (!exists) return;

  const hasBriefLocked = await knex.schema.hasColumn('environments', 'brief_locked');
  const hasBriefStep = await knex.schema.hasColumn('environments', 'brief_step');

  await knex.schema.alterTable('environments', (table) => {
    if (!hasBriefLocked) {
      table.boolean('brief_locked').notNullable().defaultTo(false);
    }
    if (!hasBriefStep) {
      table.integer('brief_step').nullable();
    }
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('environments');
  if (!exists) return;

  const hasBriefLocked = await knex.schema.hasColumn('environments', 'brief_locked');
  const hasBriefStep = await knex.schema.hasColumn('environments', 'brief_step');

  await knex.schema.alterTable('environments', (table) => {
    if (hasBriefLocked) {
      table.dropColumn('brief_locked');
    }
    if (hasBriefStep) {
      table.dropColumn('brief_step');
    }
  });
};
