const knex = require('../db/knex');
const { setSetting } = require('../services/settingsService');
const { upsertProgress } = require('../controllers/paymentsController');

async function listBots(req, res) {
  const bots = await knex('bots').select('*').orderBy('id');
  return res.json({ bots });
}

async function createBot(req, res) {
  const payload = extractBotPayload(req.body);
  const [bot] = await knex('bots').insert(payload).returning('*');
  return res.status(201).json({ bot });
}

async function updateBot(req, res) {
  const botId = Number(req.params.botId);
  const payload = extractBotPayload(req.body, true);
  const [bot] = await knex('bots').where({ id: botId }).update(payload).returning('*');
  if (!bot) return res.status(404).json({ error: 'bot not found' });
  return res.json({ bot });
}

async function listUsers(req, res) {
  const users = await knex('users')
    .select('id', 'full_name', 'phone', 'email', 'role', 'created_at')
    .orderBy('created_at', 'desc');
  return res.json({ users });
}

async function userPurchases(req, res) {
  const userId = Number(req.params.userId);
  const purchases = await knex('purchases').where({ user_id: userId });
  return res.json({ purchases });
}

async function markPurchasePaid(req, res) {
  const purchaseId = Number(req.params.purchaseId);
  const purchase = await knex('purchases').where({ id: purchaseId }).first();
  if (!purchase) return res.status(404).json({ error: 'purchase not found' });
  await knex('purchases').where({ id: purchaseId }).update({ status: 'paid', paid_at: knex.fn.now() });
  await upsertProgress(purchase.user_id, purchase.bot_id);
  return res.json({ success: true });
}

async function getSettings(req, res) {
  const rows = await knex('settings').select('key', 'value');
  const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  return res.json({ settings });
}

async function updateSetting(req, res) {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key is required' });
  await setSetting(key, String(value));
  return res.json({ success: true });
}

async function resetUserProgress(req, res) {
  const userId = Number(req.params.userId);
  const { botId } = req.body || {};
  if (!botId) return res.status(400).json({ error: 'botId required' });
  const bot = await knex('bots').where({ id: botId }).first();
  if (!bot) return res.status(404).json({ error: 'bot not found' });
  await knex('progress')
    .insert({ user_id: userId, bot_id: botId, current_step: 0, max_step_reached: 0 })
    .onConflict(['user_id', 'bot_id'])
    .merge({ current_step: 0, max_step_reached: 0, updated_at: knex.fn.now() });
  if (!bot.is_free) {
    const latest = await knex('purchases')
      .where({ user_id: userId, bot_id: botId, status: 'paid' })
      .orderBy('created_at', 'desc')
      .first();
    if (latest) {
      await knex('purchases').where({ id: latest.id }).update({ status: 'expired' });
    }
  }
  return res.json({ success: true });
}

function extractBotPayload(body = {}, partial = false) {
  const fields = ['code', 'name', 'description', 'price', 'currency', 'is_free', 'is_active', 'total_steps'];
  const payload = {};
  fields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  if (!partial && (!payload.code || !payload.name)) {
    throw Object.assign(new Error('code and name required'), { status: 400 });
  }
  return payload;
}

module.exports = {
  listBots,
  createBot,
  updateBot,
  listUsers,
  userPurchases,
  markPurchasePaid,
  getSettings,
  updateSetting,
  resetUserProgress,
};
