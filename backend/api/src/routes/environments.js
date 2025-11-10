const express = require('express');
const router = express.Router();
const knex = require('../db/knex');

router.get('/', async (req, res, next) => {
  try {
    const environments = await knex('environments')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'asc');

    res.json({ environments });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, notes = '' } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const [environment] = await knex('environments')
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        notes,
        bot_id: null,
        current_step: 1,
        total_steps: 1,
        min_step: 1,
        state: {},
        brief_locked: false,
        brief_step: null,
        is_active: true,
      })
      .returning('*');

    res.status(201).json(environment);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
