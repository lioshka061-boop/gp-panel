const knex = require('../db/knex');

async function getSetting(key, defaultValue = null) {
  const record = await knex('settings').where({ key }).first();
  return record ? record.value : defaultValue;
}

async function setSetting(key, value) {
  await knex('settings')
    .insert({ key, value })
    .onConflict('key')
    .merge({ value });
}

async function paymentsEnabled() {
  const value = await getSetting('payments_enabled', 'true');
  return value === 'true';
}

module.exports = { getSetting, setSetting, paymentsEnabled };
