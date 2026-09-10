const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const turso = createClient({
  url: url || "file:pos.db",
  authToken: authToken,
  // Optimización de red y reintentos para evitar bloqueos en la nube
  concurrency: 10,
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

// Inicialización automática y segura de tablas para Turso
async function initDatabase() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        start_amount REAL,
        end_amount REAL,
        cash_sales REAL DEFAULT 0,
        transfer_sales REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        status TEXT DEFAULT 'abierto',
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS products (
        barcode TEXT PRIMARY KEY,
        name TEXT,
        sale_price REAL,
        stock INTEGER,
        min_stock INTEGER DEFAULT 3
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        user_name TEXT,
        invoice_number TEXT,
        customer_doc TEXT,
        customer_name TEXT,
        subtotal REAL,
        tax_amount REAL DEFAULT 0,
        total REAL,
        payment_method TEXT,
        amount_paid REAL,
        change_given REAL,
        sale_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_barcode TEXT,
        product_name TEXT,
        quantity INTEGER,
        unit_price REAL,
        subtotal REAL
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        category TEXT,
        description TEXT,
        amount REAL,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    console.log('📦 Base de datos Turso inicializada y sincronizada correctamente.');
  } catch (err) {
    console.error('⚠️ Error inicializando tablas en Turso:', err);
  }
}

// Ejecutar inicialización al arrancar
initDatabase();

// Adaptador de base de datos optimizado (Sin alteración destructiva de comillas)
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