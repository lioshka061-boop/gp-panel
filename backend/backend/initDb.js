const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'users.db');

function initDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const createTableSql = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          login TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_online INTEGER NOT NULL DEFAULT 0,
          session_token TEXT,
          session_expires INTEGER
        )
      `;

      db.run(createTableSql, (createErr) => {
        if (createErr) {
          db.close(() => reject(createErr));
          return;
        }

        db.get('SELECT id FROM users WHERE login = ?', ['admin'], (selectErr, row) => {
          if (selectErr) {
            db.close(() => reject(selectErr));
            return;
          }

          if (row) {
            db.close((closeErr) => {
              if (closeErr) {
                reject(closeErr);
              } else {
                resolve();
              }
            });
            return;
          }

          const passwordHash = bcrypt.hashSync('admingp25', 10);
          db.run(
            `INSERT INTO users (login, password_hash, is_online, session_token, session_expires)
             VALUES (?, ?, 0, NULL, NULL)`,
            ['admin', passwordHash],
            (insertErr) => {
              if (insertErr) {
                db.close(() => reject(insertErr));
                return;
              }

              db.close((closeErr) => {
                if (closeErr) {
                  reject(closeErr);
                } else {
                  resolve();
                }
              });
            }
          );
        });
      });
    });
  });
}

module.exports = {
  initDb,
  DB_PATH
};
