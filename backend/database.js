const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.trim() : '';
const authToken = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : '';

console.log("Configuración Turso URL:", url ? url.substring(0, 30) + "..." : "¡URL VACÍA O NO DETECTADA!");

const turso = createClient({
  url: url || "file:pos.db",
  authToken: authToken,
});

// Convierte valores BigInt a Number para evitar fallos de serialización JSON en Express
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
      const res = await turso.execute({ sql: sql, args: params });
      const row = res.rows.length > 0 ? sanitizeRow(res.rows[0]) : null;
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      console.error('DB GET Error:', err.message, 'SQL:', sql);
      if (callback) callback(err, null);
      else throw err;
    }
  },
  all: async (sql, params = [], callback) => {
    try {
      const res = await turso.execute({ sql: sql, args: params });
      const rows = res.rows.map(r => sanitizeRow(r));
      if (callback) callback(null, rows);
      return rows;
    } catch (err) {
      console.error('DB ALL Error:', err.message, 'SQL:', sql);
      if (callback) callback(err, []);
      else throw err;
    }
  },
  run: async (sql, params = [], callback) => {
    try {
      const res = await turso.execute({ sql: sql, args: params });
      const lastID = res.lastInsertRowid ? Number(res.lastInsertRowid) : null;
      const context = { lastID, changes: res.rowsAffected };
      if (callback) callback.call(context, null);
      return context;
    } catch (err) {
      console.error('DB RUN Error:', err.message, 'SQL:', sql);
      if (callback) callback(err);
      else throw err;
    }
  },
  serialize: (fn) => { if (fn) fn(); }
};

module.exports = db;