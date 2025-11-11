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
      description: 'Список справ для команди, нагадування та звіти.',
      price: 0,
      currency: 'USD',
      is_free: true,
      is_active: true,
      total_steps: 33,
    },
    {
      code: 'crm_bot',
      name: 'CRM',
      description: 'Веде клієнтів і завдання, нагадує про угоди.',
      price: 29,
      currency: 'USD',
      is_free: false,
      is_active: true,
      total_steps: 34,
    },
    {
      code: 'faq_bot',
      name: 'FAQ / Support',
      description: 'Відповідає на типові питання клієнтів.',
      price: 19,
      currency: 'USD',
      is_free: false,
      is_active: true,
      total_steps: 30,
    },
    {
      code: 'shop_bot',
      name: 'Shop',
      description: 'Міні-магазин у Telegram з каталогом і оплатами.',
      price: 29,
      currency: 'USD',
      is_free: false,
      is_active: true,
      total_steps: 36,
    },
    {
      code: 'booking_bot',
      name: 'Booking',
      description: 'Запис на послуги, тайм-слоти та підтвердження.',
      price: 29,
      currency: 'USD',
      is_free: false,
      is_active: true,
      total_steps: 34,
    },
    {
      code: 'habit_bot',
      name: 'Habit Tracker',
      description: 'Щоденні звички, нагадування та статистика.',
      price: 19,
      currency: 'USD',
      is_free: false,
      is_active: true,
      total_steps: 32,
    },
    {
      code: 'custom_bot',
      name: 'Custom',
      description: 'Свій сценарій під будь-яку задачу.',
      price: 59,
      currency: 'USD',
      is_free: false,
      is_active: true,
      total_steps: 25,
    },
  ]);

  await knex('settings').insert({ key: 'payments_enabled', value: 'true' });

  console.info('Seeded admin user (login/email: admin@gmail.com, password: admingp25)');
};
