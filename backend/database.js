const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbPath;
try {
  const { app } = require('electron');
  const appPath = (app && typeof app.getPath === 'function') ? app.getPath('userData') : __dirname;
  dbPath = path.join(appPath, 'pos.db');
} catch (e) {
  dbPath = path.join(__dirname, 'pos.db');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a pos.db:', err.message);
  } else {
    console.log('✅ Base de datos pos.db conectada correctamente en:', dbPath);
  }
});

db.serialize(() => {
  // 1. Usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '1234',
      role TEXT NOT NULL DEFAULT 'Cajero'
    )
  `);

  db.run(`ALTER TABLE users ADD COLUMN name TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN password TEXT DEFAULT '1234'`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'Cajero'`, () => {});

  db.run(`INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (1, 'Administrador Principal', 'admin', 'admin123', 'Administrador')`);
  db.run(`INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (2, 'Doña Rosa', 'rosa', '1234', 'Cajero')`);
  db.run(`INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (3, 'ANTHONY CARDENAS', 'ANTHONY', '0526', 'Administrador')`);
  db.run(`UPDATE users SET password = '0526', role = 'Administrador', name = 'ANTHONY CARDENAS' WHERE username = 'ANTHONY'`);

  // 2. Productos
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

  // 3. Turnos
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

  // 4. Ventas
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

  // 5. Items Venta
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

  // 6. Egresos
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

  // 7. Transacciones
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

  // 8. Configuración
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Cargar productos automáticos si la tabla está vacía
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (!err && row && row.count === 0) {
      console.log('🌱 Poblando productos por primera vez en la base de datos...');
      try {
        require('./seed_excel_products');
      } catch (e) {
        console.error('Error al cargar seed_excel_products:', e.message);
      }
    }
  });
});

module.exports = db;