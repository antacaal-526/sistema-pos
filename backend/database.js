const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Definición de ruta absoluta para la base de datos
const dbPath = path.resolve(__dirname, 'pos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error conectando a SQLite:', err.message);
  } else {
    console.log('Base de datos conectada en:', dbPath);
  }
});

// Inicializar tablas base
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Cajero'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    start_amount REAL DEFAULT 0,
    end_amount REAL DEFAULT 0,
    cash_sales REAL DEFAULT 0,
    transfer_sales REAL DEFAULT 0,
    total_sales REAL DEFAULT 0,
    status TEXT DEFAULT 'abierto',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    barcode TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sale_price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 3
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sales (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_barcode TEXT,
    product_name TEXT,
    quantity INTEGER,
    unit_price REAL,
    subtotal REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    user_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
});

module.exports = db;
module.exports.dbPath = dbPath;