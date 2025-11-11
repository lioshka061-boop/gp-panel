const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  await knex('settings').del();
  await knex('progress').del();
  await knex('purchases').del();
  await knex('bots').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash('admingp25', 10);

  await knex('users').insert({
    full_name: 'Admin',
    phone: '+380000000000',
    email: 'admin@gmail.com',
    password_hash: passwordHash,
    role: 'admin',
  });

  await knex('bots').insert([
    {
      code: 'task_manager',
      name: 'Task Manager',
      description: 'Менеджер задач для команди, включає нагадування і звіти.',
      price: 0,
      currency: 'UAH',
      is_free: true,
      is_active: true,
      total_steps: 33,
    },
    {
      code: 'crm_bot',
      name: 'CRM Sales Bot',
      description: 'Бот для обробки лідів, клієнтів та нагадувань.',
      price: 890,
      currency: 'UAH',
      is_free: false,
      is_active: true,
      total_steps: 34,
    },
    {
      code: 'fitness_bot',
      name: 'Fitness Coach',
      description: 'Онбординг клієнтів для фітнес-напрямку з планом тренувань.',
      price: 690,
      currency: 'UAH',
      is_free: false,
      is_active: true,
      total_steps: 32,
    },
  ]);

  await knex('settings').insert({ key: 'payments_enabled', value: 'true' });

  console.info('Seeded admin user (login/email: admin@gmail.com, password: admingp25)');
};
