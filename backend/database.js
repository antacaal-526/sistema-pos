const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const turso = createClient({
  url: url || "file:pos.db",
  authToken: authToken,
});

function sanitizeRow(row) {
  if (!row) return row;
  const sanitized = {};
  for (const key in row) {
    if (typeof row[key] === 'bigint') {
      sanitized[key] = Number(row[key]);
    } else {
      sanitized[key] = row[key];
    }
  }
  return sanitized;
}

const db = {
  get: async (sql, params = [], callback) => {
    try {
      const res = await turso.execute({ sql: sql.replace(/"/g, "'"), args: params });
      const row = res.rows.length > 0 ? sanitizeRow(res.rows[0]) : null;
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      if (callback) callback(err, null);
      else throw err;
    }
  },
  all: async (sql, params = [], callback) => {
    try {
      const res = await turso.execute({ sql: sql.replace(/"/g, "'"), args: params });
      const rows = res.rows.map(r => sanitizeRow(r));
      if (callback) callback(null, rows);
      return rows;
    } catch (err) {
      if (callback) callback(err, []);
      else throw err;
    }
  },
  run: async (sql, params = [], callback) => {
    try {
      const res = await turso.execute({ sql: sql.replace(/"/g, "'"), args: params });
      const lastID = res.lastInsertRowid ? Number(res.lastInsertRowid) : null;
      const context = { lastID, changes: res.rowsAffected };
      if (callback) callback.call(context, null);
      return context;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  },
  serialize: (fn) => { if (fn) fn(); }
};

module.exports = db;