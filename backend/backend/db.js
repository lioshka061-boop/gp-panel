const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('./initDb');

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

async function findUserByLogin(login) {
  return get(
    `SELECT id, login, password_hash, is_online, session_token, session_expires
     FROM users
     WHERE login = ?`,
    [login]
  );
}

async function findUserByToken(token) {
  return get(
    `SELECT id, login, password_hash, is_online, session_token, session_expires
     FROM users
     WHERE session_token = ?`,
    [token]
  );
}

async function createUser(login, passwordHash) {
  await run(
    `INSERT INTO users (login, password_hash, is_online, session_token, session_expires)
     VALUES (?, ?, 0, NULL, NULL)`,
    [login, passwordHash]
  );
  return findUserByLogin(login);
}

async function setUserOnlineStatus(userId, isOnline) {
  await run(
    `UPDATE users
     SET is_online = ?
     WHERE id = ?`,
    [isOnline ? 1 : 0, userId]
  );
}

async function setUserSessionToken(userId, token, expiresMs) {
  const tokenValue = token || null;
  const expiresValue = expiresMs || null;
  await run(
    `UPDATE users
     SET session_token = ?, session_expires = ?
     WHERE id = ?`,
    [tokenValue, expiresValue, userId]
  );
}

module.exports = {
  findUserByLogin,
  findUserByToken,
  createUser,
  setUserOnlineStatus,
  setUserSessionToken
};
