const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Corregir/recrear tabla sales con invoice_number
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    user_name TEXT,
    invoice_number TEXT,
    customer_doc TEXT,
    customer_name TEXT,
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    payment_method TEXT,
    amount_paid REAL DEFAULT 0,
    change_given REAL DEFAULT 0,
    sale_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Asegurar que si la tabla ya existía sin la columna, se agregue sin perder datos
  db.run("ALTER TABLE sales ADD COLUMN invoice_number TEXT", (err) => {});

  // 2. Asegurar tabla sale_items
  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_barcode TEXT,
    product_name TEXT,
    quantity INTEGER,
    unit_price REAL,
    subtotal REAL
  )`);

  // 3. Asegurar tabla expenses
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    user_name TEXT,
    description TEXT,
    amount REAL DEFAULT 0,
    category TEXT,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 4. Asegurar tabla config
  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )`, () => {
    db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('dian_nit', '1049635000')");
    db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('dian_nombre', 'TERRA FRUTOS SECOS')");
    db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('dian_direccion', 'Cra 7 #15-63, Tunja, Boyacá')");
    db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('dian_prefijo', 'TF')");
    console.log("✅ Base de datos totalmente estructurada y reparada.");
    process.exit();
  });
});