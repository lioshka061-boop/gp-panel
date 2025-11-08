const crypto = require('crypto');
const knex = require('../db/knex');
const { paymentsEnabled } = require('../services/settingsService');
const { createInvoice, validateCallbackSignature, callbackResponse } = require('../services/payments/wayforpay');

async function createPayment(req, res) {
  const botId = Number(req.body.botId);
  if (!botId) return res.status(400).json({ error: 'botId required' });
  const bot = await knex('bots').where({ id: botId, is_active: true }).first();
  if (!bot) return res.status(404).json({ error: 'bot not found' });

  const paymentsOff = !(await paymentsEnabled());
  const isPrivileged =
    req.user && (req.user.role === 'admin' || req.user.role === 'tester');

  if (isPrivileged) {
    await knex('purchases').insert({
      user_id: req.user.id,
      bot_id: bot.id,
      amount: bot.price,
      currency: bot.currency,
      status: 'paid',
      provider: req.user.role,
      order_reference: `${req.user.id}-${bot.id}-tester-${Date.now()}`,
      paid_at: knex.fn.now(),
    });
    await upsertProgress(req.user.id, bot.id);
    return res.json({ status: 'test_mode' });
  }

  if (bot.is_free || Number(bot.price) === 0 || paymentsOff) {
    const purchase = await grantAccessForFree(req.user.id, bot, paymentsOff ? 'test_mode' : 'free');
    return res.json({ status: purchase.statusLabel, redirectUrl: null });
  }

  const orderReference = `${req.user.id}-${bot.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  await knex('purchases').insert({
    user_id: req.user.id,
    bot_id: bot.id,
    amount: bot.price,
    currency: bot.currency,
    status: 'pending',
    provider: 'wayforpay',
    order_reference: orderReference,
  });

  const invoice = await createInvoice({
    orderReference,
    orderDate: Math.floor(Date.now() / 1000),
    bot,
    user: req.user,
    amount: Number(bot.price),
    currency: bot.currency || 'UAH',
  });
  return res.json({ status: 'pending', redirectUrl: invoice.invoiceUrl });
}

async function wayforpayCallback(req, res) {
  const body = req.body;
  if (!validateCallbackSignature(body)) {
    return res.status(400).json({ error: 'invalid signature' });
  }
  const purchase = await knex('purchases').where({ order_reference: body.orderReference }).first();
  if (!purchase) {
    return res.status(404).json({ error: 'order not found' });
  }

  if (body.transactionStatus === 'Approved' && body.reasonCode === '1100') {
    await knex('purchases').where({ id: purchase.id }).update({
      status: 'paid',
      paid_at: knex.fn.now(),
      provider_payment_id: body.paymentId,
    });
    await upsertProgress(purchase.user_id, purchase.bot_id);
    return res.json(callbackResponse(body.orderReference, 'OK', 1100));
  }

  const status = body.transactionStatus === 'Pending' ? 'pending' : 'canceled';
  await knex('purchases').where({ id: purchase.id }).update({ status });
  return res.json(callbackResponse(body.orderReference, body.transactionStatus, Number(body.reasonCode)));
}

async function listMyPurchases(req, res) {
  const purchases = await knex('purchases')
    .where({ user_id: req.user.id })
    .orderBy('created_at', 'desc');
  return res.json({ purchases });
}

async function grantAccessForFree(userId, bot, label) {
  const [purchase] = await knex('purchases')
    .insert({
      user_id: userId,
      bot_id: bot.id,
      amount: 0,
      currency: bot.currency,
      status: 'paid',
      provider: label === 'test_mode' ? 'test' : 'free',
      order_reference: `${userId}-${bot.id}-free-${Date.now()}`,
      paid_at: knex.fn.now(),
    })
    .returning('*');
  await upsertProgress(userId, bot.id);
  purchase.statusLabel = label;
  return purchase;
}

async function upsertProgress(userId, botId) {
  await knex('progress')
    .insert({ user_id: userId, bot_id: botId, current_step: 0, max_step_reached: 0 })
    .onConflict(['user_id', 'bot_id'])
    .merge({ updated_at: knex.fn.now() });
}

module.exports = { createPayment, wayforpayCallback, listMyPurchases, upsertProgress };
