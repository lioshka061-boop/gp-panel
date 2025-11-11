const express = require('express');
const router = express.Router();
const knex = require('../db/knex');

router.get('/', async (req, res) => {
  try {
    const envs = await knex('environments')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'asc');

    res.json({ envs });
  } catch (error) {
    console.error('Env route error', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, notes, botId } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title_required' });
    }

    const [env] = await knex('environments')
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        notes: notes ? notes : null,
        bot_id: botId || null,
        current_step: 1,
        brief_locked: false,
        brief_step: null,
      })
      .returning('*');

    res.status(201).json({ env });
  } catch (error) {
    console.error('Env route error', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const envId = Number(req.params.id);
    if (!envId) {
      return res.status(400).json({ error: 'Invalid env id' });
    }

    const env = await knex('environments')
      .where({ id: envId, user_id: req.user.id })
      .first();

    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'bot_id')) {
      const incomingBotId = req.body.bot_id;
      if (incomingBotId === null || incomingBotId === undefined) {
        updates.bot_id = null;
      } else {
        const numericBotId = Number(incomingBotId);
        if (!Number.isInteger(numericBotId)) {
          return res.status(400).json({ error: 'invalid_bot_id' });
        }
        updates.bot_id = numericBotId;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'current_step')) {
      const incomingStep = Number(req.body.current_step);
      if (!Number.isInteger(incomingStep) || incomingStep < 1) {
        return res.status(400).json({ error: 'invalid_current_step' });
      }
      updates.current_step = incomingStep;
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'brief_locked') &&
      req.body.brief_locked === true &&
      !env.brief_locked
    ) {
      updates.brief_locked = true;
      if (
        Object.prototype.hasOwnProperty.call(req.body || {}, 'brief_step') &&
        Number.isInteger(Number(req.body.brief_step))
      ) {
        updates.brief_step = Number(req.body.brief_step);
      } else {
        updates.brief_step = env.current_step || 1;
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'nothing_to_update' });
    }

    updates.updated_at = knex.fn.now();

    const [updated] = await knex('environments')
      .where({ id: envId, user_id: req.user.id })
      .update(updates)
      .returning('*');

    return res.json({ env: updated });
  } catch (error) {
    console.error('Env update error', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.put('/:id/step', async (req, res) => {
  try {
    const envId = Number(req.params.id);
    if (!envId) {
      return res.status(400).json({ error: 'Invalid env id' });
    }

    const env = await knex('environments')
      .where({ id: envId, user_id: req.user.id })
      .first();

    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    const step = Number(req.body?.currentStep);
    if (!Number.isInteger(step) || step < 1) {
      return res.status(400).json({ error: 'Invalid currentStep' });
    }

    const lockBrief = Boolean(req.body?.lockBrief);
    const requestedBriefStep = Number(req.body?.briefStep);
    const normalizedBriefStep = Number.isInteger(requestedBriefStep)
      ? requestedBriefStep
      : env.brief_step || step;
    const shouldLockBrief =
      lockBrief &&
      !env.brief_locked &&
      normalizedBriefStep > 0 &&
      step > normalizedBriefStep;

    const updatePayload = {
      current_step: step,
      updated_at: knex.fn.now(),
    };

    if (shouldLockBrief) {
      updatePayload.brief_locked = true;
      updatePayload.brief_step = normalizedBriefStep;
    }

    const [updated] = await knex('environments')
      .where({ id: envId, user_id: req.user.id })
      .update(updatePayload)
      .returning('*');

    return res.json({
      ok: true,
      current_step: updated.current_step,
      brief_locked: updated.brief_locked,
      brief_step: updated.brief_step,
    });
  } catch (error) {
    console.error('Env route error', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
