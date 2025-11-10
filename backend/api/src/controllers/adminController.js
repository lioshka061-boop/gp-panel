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

async function getAnalyticsOverview(req, res) {
  const [{ totalUsers }] = await knex('users').count({ totalUsers: '*' });
  const [{ totalPaidPurchases }] = await knex('purchases')
    .where({ status: 'paid' })
    .count({ totalPaidPurchases: '*' });

  const totalRevenueByCurrencyRows = await knex('purchases')
    .where({ status: 'paid' })
    .select('currency')
    .sum({ total: 'amount' })
    .groupBy('currency');

  const totalRevenueByCurrency = totalRevenueByCurrencyRows.map((row) => ({
    currency: row.currency,
    total: Number(row.total) || 0,
  }));

  const bots = await knex('bots').select('id', 'code', 'name', 'price', 'currency');

  const envCounts = await knex('environments')
    .select('bot_id')
    .count({ envCount: '*' })
    .whereNotNull('bot_id')
    .groupBy('bot_id');

  const envCountMap = {};
  envCounts.forEach((row) => {
    if (!row.bot_id) return;
    envCountMap[row.bot_id] = Number(row.envCount) || 0;
  });

  const paidUsersRows = await knex('purchases')
    .select('bot_id')
    .countDistinct({ paidUsers: 'user_id' })
    .where({ status: 'paid' })
    .groupBy('bot_id');

  const paidUsersMap = {};
  paidUsersRows.forEach((row) => {
    if (!row.bot_id) return;
    paidUsersMap[row.bot_id] = Number(row.paidUsers) || 0;
  });

  const revenueRows = await knex('purchases')
    .select('bot_id', 'currency')
    .sum({ total: 'amount' })
    .where({ status: 'paid' })
    .groupBy('bot_id', 'currency');

  const revenueMap = {};
  revenueRows.forEach((row) => {
    if (!row.bot_id) return;
    if (!revenueMap[row.bot_id]) revenueMap[row.bot_id] = [];
    revenueMap[row.bot_id].push({
      currency: row.currency,
      total: Number(row.total) || 0,
    });
  });

  const botsStats = bots.map((bot) => ({
    id: bot.id,
    code: bot.code,
    name: bot.name,
    price: bot.price,
    currency: bot.currency,
    envCount: envCountMap[bot.id] || 0,
    paidUsers: paidUsersMap[bot.id] || 0,
    revenueByCurrency: revenueMap[bot.id] || [],
  }));

  return res.json({
    totalUsers: Number(totalUsers) || 0,
    totalPaidPurchases: Number(totalPaidPurchases) || 0,
    totalRevenueByCurrency,
    botsStats,
  });
}

async function getUserAnalytics(req, res) {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'invalid_user_id' });
  }

  const user = await knex('users')
    .select('id', 'full_name', 'email', 'phone', 'created_at')
    .where({ id: userId })
    .first();

  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const [{ totalEnvs }] = await knex('environments')
    .where({ user_id: userId })
    .count({ totalEnvs: '*' });

  const envs = await knex('environments as e')
    .leftJoin('bots as b', 'b.id', 'e.bot_id')
    .where('e.user_id', userId)
    .select(
      'e.id',
      'e.title',
      'e.bot_id as botId',
      'b.code as botCode',
      'b.name as botName',
      'e.current_step as currentStep',
      'e.created_at as createdAt',
      'e.updated_at as updatedAt'
    )
    .orderBy('e.updated_at', 'desc');

  const paidPurchases = await knex('purchases')
    .where({ user_id: userId, status: 'paid' });

  const totalPaidPurchases = paidPurchases.length;

  const revenueByCurrencyRows = await knex('purchases')
    .where({ user_id: userId, status: 'paid' })
    .select('currency')
    .sum({ total: 'amount' })
    .groupBy('currency');

  const revenueByCurrency = revenueByCurrencyRows.map((row) => ({
    currency: row.currency,
    total: Number(row.total) || 0,
  }));

  const botsBreakdownRows = await knex('purchases as p')
    .leftJoin('bots as b', 'b.id', 'p.bot_id')
    .where({ 'p.user_id': userId, 'p.status': 'paid' })
    .groupBy('p.bot_id', 'b.code', 'b.name')
    .select(
      'p.bot_id as botId',
      'b.code as botCode',
      'b.name as botName'
    )
    .count({ paidPurchases: 'p.id' })
    .sum({ totalAmount: 'p.amount' });

  const botsBreakdown = botsBreakdownRows.map((row) => ({
    botId: row.botId,
    botCode: row.botCode,
    botName: row.botName,
    paidPurchases: Number(row.paidPurchases) || 0,
    totalAmount: Number(row.totalAmount) || 0,
  }));

  return res.json({
    user,
    totalEnvs: Number(totalEnvs) || 0,
    envs,
    totalPaidPurchases,
    revenueByCurrency,
    botsBreakdown,
  });
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
  getAnalyticsOverview,
  getUserAnalytics,
};
