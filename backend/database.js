const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.trim() : '';
const authToken = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : '';

console.log("Configuración Turso URL:", url ? url.substring(0, 30) + "..." : "¡URL VACÍA O NO DETECTADA!");

const turso = createClient({
  url: url || "file:pos.db",
  authToken: authToken,
  concurrency: 10,
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

// Inicialización de la base de datos
async function initDatabase() {
  try {
    // Tablas Originales
    await turso.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, role TEXT)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT, start_amount REAL, end_amount REAL, cash_sales REAL DEFAULT 0, transfer_sales REAL DEFAULT 0, total_sales REAL DEFAULT 0, status TEXT DEFAULT 'abierto', opened_at DATETIME DEFAULT CURRENT_TIMESTAMP, closed_at DATETIME)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS products (barcode TEXT PRIMARY KEY, name TEXT, sale_price REAL, stock INTEGER, min_stock INTEGER DEFAULT 3)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, shift_id INTEGER, user_name TEXT, invoice_number TEXT, customer_doc TEXT, customer_name TEXT, subtotal REAL, tax_amount REAL DEFAULT 0, total REAL, payment_method TEXT, amount_paid REAL, change_given REAL, sale_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER, product_barcode TEXT, product_name TEXT, quantity INTEGER, unit_price REAL, subtotal REAL)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, category TEXT, description TEXT, amount REAL, user_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);

    // Migración segura: Añadir stock reservado a productos existentes
    try {
      await turso.execute(`ALTER TABLE products ADD COLUMN reserved_stock INTEGER DEFAULT 0`);
    } catch (err) {
      // Se ignora si la columna ya existe
    }

    // --- NUEVAS TABLAS DE PREVENTA (OFFLINE-FIRST) ---
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY, 
        name TEXT, 
        document TEXT, 
        phone TEXT, 
        address TEXT, 
        city TEXT, 
        notes TEXT, 
        created_at DATETIME, 
        sync_status TEXT DEFAULT 'SYNCED'
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        created_by TEXT,
        assigned_to TEXT,
        total REAL,
        status TEXT DEFAULT 'PENDING',
        notes TEXT,
        created_at DATETIME,
        updated_at DATETIME
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        product_barcode TEXT,
        product_name TEXT,
        quantity INTEGER,
        unit_price REAL,
        subtotal REAL
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        collector_id TEXT,
        payment_method TEXT,
        amount REAL,
        collected_at DATETIME,
        synced_at DATETIME
      )
    `);

    console.log('📦 Base de datos Turso y módulo de preventa sincronizados correctamente.');
  } catch (err) {
    console.error('⚠️ Error inicializando tablas en Turso:', err);
  }
}

initDatabase();

const db = {
  get: async (sql, params = [], callback) => {
    try {
      const res = await turso.execute({ sql: sql, args: params });
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
      const res = await turso.execute({ sql: sql, args: params });
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
      const res = await turso.execute({ sql: sql, args: params });
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