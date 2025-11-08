const knex = require('../db/knex');
const { paymentsEnabled } = require('./settingsService');

async function hasPaidPurchase(userId, botId) {
  const purchase = await knex('purchases')
    .where({ user_id: userId, bot_id: botId, status: 'paid' })
    .first();
  return Boolean(purchase);
}

async function ensureBotAccess(userId, bot, options = {}) {
  const paymentsOff = !(await paymentsEnabled());
  const autoAccess = bot.is_free || Number(bot.price) === 0 || paymentsOff;
  if (autoAccess) return true;
  const paid = await hasPaidPurchase(userId, bot.id);
  if (!paid && !options.skipError) {
    throw Object.assign(new Error('payment required'), { status: 403 });
  }
  return paid;
}

module.exports = { ensureBotAccess, hasPaidPurchase };
