const path = require('path');
const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();

// Conversión global para prevenir fallos de JSON.stringify con BigInt en Express
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let db;

function deepClean(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(deepClean);
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    cleaned[key] = deepClean(obj[key]);
  }
  return cleaned;
}

function sanitizeArgs(params) {
  if (params === undefined || params === null) return [];
  if (typeof params === 'function') return [];
  
  if (typeof params !== 'object') {
    return [typeof params === 'bigint' ? Number(params) : params];
  }

  if (!Array.isArray(params)) {
    return deepClean(params);
  }

  return params.map(v => (v === undefined ? null : typeof v === 'bigint' ? Number(v) : v));
}

function parseQueryArgs(rawArgs) {
  const args = Array.from(rawArgs);
  const sql = args.shift();
  
  let callback = null;
  if (args.length > 0 && typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }

  let params = [];
  if (args.length === 1 && Array.isArray(args[0])) {
    params = args[0];
  } else if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    params = args[0];
  } else {
    params = args;
  }

  return { sql, params: sanitizeArgs(params), callback };
}

if (url && authToken) {
  console.log('⚡ Conectando a Base de Datos en la Nube (Turso Cloud)...');
  const client = createClient({ url, authToken });

  // Inicialización de todas las tablas en Turso Cloud
  const initStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '1234',
      role TEXT NOT NULL DEFAULT 'Cajero'
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      internal_code TEXT,
      name TEXT,
      category TEXT DEFAULT 'General',
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5
    )`,
    `CREATE TABLE IF NOT EXISTS shifts (
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
    )`,
    `CREATE TABLE IF NOT EXISTS cash_shifts (
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
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_barcode TEXT,
      product_name TEXT,
      quantity INTEGER,
      unit_price REAL,
      subtotal REAL
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER,
      user_name TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'General',
      payment_method TEXT DEFAULT 'Efectivo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      description TEXT,
      amount REAL NOT NULL,
      user_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  ];

  Promise.all(initStatements.map(stmt => client.execute(stmt).catch(() => {})));

  db = {
    isTurso: true,
    run: function (...rawArgs) {
      const { sql, params, callback } = parseQueryArgs(rawArgs);
      client.execute({ sql, args: params })
        .then(res => {
          const lastID = res.lastInsertRowid != null ? Number(res.lastInsertRowid) : 0;
          const changes = res.rowsAffected != null ? Number(res.rowsAffected) : 0;
          const ctx = { lastID, changes };
          if (callback) callback.call(ctx, null);
        })
        .catch(err => {
          console.error('❌ Error SQL (run):', err.message, '| SQL:', sql, '| Args:', params);
          if (callback) callback(err);
        });
    },
    get: function (...rawArgs) {
      const { sql, params, callback } = parseQueryArgs(rawArgs);
      client.execute({ sql, args: params })
        .then(res => {
          const rawRow = (res.rows && res.rows.length > 0) ? res.rows[0] : undefined;
          const row = deepClean(rawRow);
          if (callback) callback(null, row);
        })
        .catch(err => {
          console.error('❌ Error SQL (get):', err.message, '| SQL:', sql, '| Args:', params);
          if (callback) callback(err);
        });
    },
    all: function (...rawArgs) {
      const { sql, params, callback } = parseQueryArgs(rawArgs);
      client.execute({ sql, args: params })
        .then(res => {
          const rows = deepClean(res.rows || []);
          if (callback) callback(null, rows);
        })
        .catch(err => {
          console.error('❌ Error SQL (all):', err.message, '| SQL:', sql, '| Args:', params);
          if (callback) callback(err, []);
        });
    },
    exec: function (sql, callback) {
      const stmts = sql.split(';').filter(s => s.trim().length > 0);
      client.batch(stmts.map(s => ({ sql: s, args: [] })), 'write')
        .then(() => { if (callback) callback(null); })
        .catch(err => {
          console.error('❌ Error SQL (exec):', err.message);
          if (callback) callback(err);
        });
    },
    serialize: function (fn) { if (fn) fn(); },
    prepare: function(sql) {
      return {
        run: (...args) => {
          let cb = args.pop();
          if (typeof cb !== 'function') { args.push(cb); cb = null; }
          const cleanArgs = sanitizeArgs(args.length === 1 ? args[0] : args);
          client.execute({ sql, args: cleanArgs }).then(res => {
            const lastID = res.lastInsertRowid != null ? Number(res.lastInsertRowid) : 0;
            const changes = res.rowsAffected != null ? Number(res.rowsAffected) : 0;
            if (cb) cb.call({ lastID, changes }, null);
          }).catch(err => {
            console.error('❌ Error SQL (prepare.run):', err.message);
            if (cb) cb(err);
          });
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

// Inicialización de Tablas en SQLite local
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
    CREATE TABLE IF NOT EXISTS cash_shifts (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      subtotal REAL
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