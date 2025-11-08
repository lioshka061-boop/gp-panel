const knex = require('../db/knex');
const { ensureBotAccess } = require('../services/accessService');

async function listBots(req, res) {
  const rows = await knex('bots')
    .where({ is_active: true })
    .select('id', 'code', 'name', 'description', 'price', 'currency', 'is_free');
  const bots = rows.map((bot) => ({ ...bot, price: Number(bot.price) }));
  return res.json({ bots });
}

async function botAccess(req, res) {
  const botId = Number(req.params.botId);
  const bot = await knex('bots').where({ id: botId, is_active: true }).first();
  if (!bot) return res.status(404).json({ error: 'bot not found' });

  const isPrivileged =
    req.user && (req.user.role === 'admin' || req.user.role === 'tester');
  if (isPrivileged) {
    const progressPriv = await knex('progress').where({ user_id: req.user.id, bot_id: bot.id }).first();
    return res.json({
      hasAccess: true,
      currentStep: progressPriv ? progressPriv.current_step : null,
      maxStepReached: progressPriv ? progressPriv.max_step_reached : null,
    });
  }

  const hasAccess = await ensureBotAccess(req.user.id, bot, { skipError: true });
  if (!hasAccess) {
    return res.json({ hasAccess: false, currentStep: null, maxStepReached: null });
  }
  const progress = await knex('progress').where({ user_id: req.user.id, bot_id: bot.id }).first();
  return res.json({
    hasAccess: true,
    currentStep: progress ? progress.current_step : null,
    maxStepReached: progress ? progress.max_step_reached : null,
  });
}

async function updateProgress(req, res) {
  const botId = Number(req.params.botId);
  const { step } = req.body || {};
  if (typeof step !== 'number' || step < 0) {
    return res.status(400).json({ error: 'step must be a positive number' });
  }
  const bot = await knex('bots').where({ id: botId, is_active: true }).first();
  if (!bot) return res.status(404).json({ error: 'bot not found' });

  const hasAccess = await ensureBotAccess(req.user.id, bot);
  if (!hasAccess) return res.status(403).json({ error: 'no access to this bot' });

  const existing = await knex('progress').where({ user_id: req.user.id, bot_id: bot.id }).first();
  const value = Math.min(step, bot.total_steps);
  const payload = {
    current_step: value,
    max_step_reached: Math.max(value, existing ? existing.max_step_reached : 0),
    updated_at: knex.fn.now(),
  };
  if (existing) {
    await knex('progress').where({ id: existing.id }).update(payload);
  } else {
    await knex('progress').insert({ user_id: req.user.id, bot_id: bot.id, ...payload });
  }
  return res.json({ success: true, progress: payload });
}

async function resetProgress(req, res) {
  const botId = Number(req.params.botId);
  const bot = await knex('bots').where({ id: botId }).first();
  if (!bot) return res.status(404).json({ error: 'bot not found' });

  const hasAccess = await ensureBotAccess(req.user.id, bot);
  if (!hasAccess) return res.status(403).json({ error: 'no access to this bot' });

  if (!bot.is_free) {
    const latestPurchase = await knex('purchases')
      .where({ user_id: req.user.id, bot_id: bot.id, status: 'paid' })
      .orderBy('created_at', 'desc')
      .first();
    if (!latestPurchase) return res.status(403).json({ error: 'no paid purchase to reset' });
    await knex('purchases').where({ id: latestPurchase.id }).update({ status: 'expired' });
  }
  await knex('progress')
    .insert({ user_id: req.user.id, bot_id: bot.id, current_step: 0, max_step_reached: 0 })
    .onConflict(['user_id', 'bot_id'])
    .merge({ current_step: 0, max_step_reached: 0, updated_at: knex.fn.now() });
  return res.json({ success: true });
}

module.exports = { listBots, botAccess, updateProgress, resetProgress };
