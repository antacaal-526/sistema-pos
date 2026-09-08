const path = require('path');
const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let db;

if (url && authToken) {
  console.log('⚡ Conectando a Base de Datos en la Nube (Turso Cloud)...');
  const client = createClient({ url, authToken });

  db = {
    isTurso: true,
    run: function (sql, params = [], callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      client.execute({ sql, args: params })
        .then(res => {
          const ctx = { lastID: Number(res.lastInsertRowid || 0), changes: res.rowsAffected };
          if (callback) callback.call(ctx, null);
        })
        .catch(err => { if (callback) callback(err); });
    },
    get: function (sql, params = [], callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      client.execute({ sql, args: params })
        .then(res => {
          const row = res.rows.length > 0 ? res.rows[0] : undefined;
          if (callback) callback(null, row);
        })
        .catch(err => { if (callback) callback(err); });
    },
    all: function (sql, params = [], callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      client.execute({ sql, args: params })
        .then(res => {
          if (callback) callback(null, res.rows);
        })
        .catch(err => { if (callback) callback(err); });
    },
    exec: function (sql, callback) {
      const stmts = sql.split(';').filter(s => s.trim().length > 0);
      client.batch(stmts.map(s => ({ sql: s, args: [] })), 'write')
        .then(() => { if (callback) callback(null); })
        .catch(err => { if (callback) callback(err); });
    },
    serialize: function (fn) { if (fn) fn(); },
    prepare: function(sql) {
      return {
        run: (...args) => {
          let cb = args.pop();
          if (typeof cb !== 'function') { args.push(cb); cb = null; }
          client.execute({ sql, args }).then(res => {
            if (cb) cb.call({ lastID: Number(res.lastInsertRowid || 0), changes: res.rowsAffected }, null);
          }).catch(err => { if (cb) cb(err); });
        },
        finalize: (cb) => { if (cb) cb(); }
      };
    }
  };
} else {
  let dbPath;
  try {
    const { app } = require('electron');
    const appPath = (app && typeof app.getPath === 'function') ? app.getPath('userData') : __dirname;
    dbPath = path.join(appPath, 'pos.db');
  } catch (e) {
    dbPath = path.join(__dirname, 'pos.db');
  }

  console.log('📂 Conectando a la Base de Datos local (pos.db)...');
  db = new sqlite3.Database(dbPath);
}

// Inicialización de Tablas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '1234',
      role TEXT NOT NULL DEFAULT 'Cajero'
    )
  `);

  db.run(`INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (1, 'Administrador Principal', 'admin', 'admin123', 'Administrador')`);
  db.run(`INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (2, 'Doña Rosa', 'rosa', '1234', 'Cajero')`);
  db.run(`INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (3, 'ANTHONY CARDENAS', 'ANTHONY', '0526', 'Administrador')`);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      internal_code TEXT,
      name TEXT,
      category TEXT DEFAULT 'General',
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      start_amount REAL NOT NULL,
      end_amount REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      transfer_sales REAL DEFAULT 0,
      total_sales REAL DEFAULT 0,
      status TEXT DEFAULT 'abierto',
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER,
      user_name TEXT,
      invoice_number TEXT,
      customer_doc TEXT DEFAULT '222222222222',
      customer_name TEXT DEFAULT 'Consumidor Final',
      subtotal REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'Efectivo',
      amount_paid REAL DEFAULT 0,
      change_given REAL DEFAULT 0,
      sale_type TEXT DEFAULT 'Facturada',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_id) REFERENCES shifts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_barcode TEXT,
      product_name TEXT,
      quantity INTEGER,
      unit_price REAL,
      subtotal REAL,
      FOREIGN KEY(sale_id) REFERENCES sales(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER,
      user_name TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'General',
      payment_method TEXT DEFAULT 'Efectivo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      description TEXT,
      amount REAL NOT NULL,
      user_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
});

module.exports = db;