const knex = require('../db/knex');

module.exports = {
  async list(req, res) {
    const rows = await knex('environments')
      .where({ user_id: req.user.id, is_active: true })
      .orderBy('updated_at', 'desc');

    const result = rows.map((env) => ({
      id: env.id,
      title: env.title,
      notes: env.notes,
      bot_id: env.bot_id,
      current_step: env.current_step,
      total_steps: env.total_steps,
      min_step: env.min_step,
      updated_at: env.updated_at,
      brief_locked: env.brief_locked,
      brief_step: env.brief_step,
      progressPercent: env.total_steps
        ? Math.round((env.current_step * 100) / env.total_steps)
        : 0,
    }));

    return res.json({ environments: result });
  },

  async getOne(req, res) {
    const env = await knex('environments')
      .where({ id: req.params.id, user_id: req.user.id, is_active: true })
      .first();
    if (!env) {
      return res.status(404).json({ message: 'Environment not found' });
    }
    return res.json(env);
  },

  async create(req, res) {
    const { title, notes } = req.body || {};
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const [created] = await knex('environments')
      .insert({
        user_id: req.user.id,
        title,
        notes: notes || null,
        current_step: 1,
        total_steps: 30,
        min_step: 1,
        state: {},
        brief_locked: false,
        brief_step: null,
      })
      .returning('*');
    return res.status(201).json(created);
  },

  async update(req, res) {
    const id = req.params.id;
    const allowed = [
      'title',
      'notes',
      'bot_id',
      'current_step',
      'total_steps',
      'min_step',
      'state',
      'is_active',
    ];
    const payload = {};
    allowed.forEach((key) => {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        payload[key] = req.body[key];
      }
    });
    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    payload.updated_at = knex.fn.now();
    const [updated] = await knex('environments')
      .where({ id, user_id: req.user.id, is_active: true })
      .update(payload)
      .returning('*');
    if (!updated) {
      return res.status(404).json({ message: 'Environment not found' });
    }
    return res.json(updated);
  },

  async remove(req, res) {
    const id = req.params.id;
    const updated = await knex('environments')
      .where({ id, user_id: req.user.id, is_active: true })
      .update({ is_active: false, updated_at: knex.fn.now() });
    if (!updated) {
      return res.status(404).json({ message: 'Environment not found' });
    }
    return res.json({ success: true });
  },
};
