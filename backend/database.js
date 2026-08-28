const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error al conectar la base de datos:', err);
  else console.log('Conectado exitosamente a la base de datos SQLite.');
});

db.serialize(() => {
  // 1. Usuarios
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  // 2. Productos
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    internal_code TEXT,
    name TEXT,
    category TEXT,
    cost_price REAL,
    sale_price REAL,
    stock INTEGER,
    min_stock INTEGER
  )`);

  // 3. Turnos de Caja (Apertura y Arqueo)
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    initial_cash REAL DEFAULT 0,
    expected_cash REAL DEFAULT 0,
    real_cash REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    status TEXT DEFAULT 'ABIERTO'
  )`);

  // 4. Ventas y Facturación Electrónica (CUFE, QR, Medios de Pago)
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    user_id INTEGER,
    user_name TEXT,
    total REAL,
    tax REAL,
    payment_method TEXT DEFAULT 'EFECTIVO',
    amount_paid REAL DEFAULT 0,
    change_given REAL DEFAULT 0,
    cufe TEXT,
    status TEXT DEFAULT 'COMPLETADA',
    customer_name TEXT DEFAULT 'Consumidor Final',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 5. Ítems de la Venta / Precuenta
  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    product_name TEXT,
    quantity INTEGER,
    unit_price REAL,
    subtotal REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id)
  )`);

  // Crear usuarios por defecto si la tabla está vacía
  db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
    if (row && row.count === 0) {
      const adminPass = bcrypt.hashSync('123456', 10);
      const cajeroPass = bcrypt.hashSync('123456', 10);

      db.run("INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')", [adminPass]);
      db.run("INSERT INTO users (username, password, role) VALUES ('cajero', ?, 'empleado')", [cajeroPass]);
    }
  });
});

module.exports = db;