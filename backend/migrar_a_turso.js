const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');
const path = require('path');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('❌ Error: Debes definir TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.');
  process.exit(1);
}

const localDb = new sqlite3.Database(path.join(__dirname, 'pos.db'));
const cloudDb = createClient({ url, authToken });

const createTablesStatements = [
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shift_id) REFERENCES shifts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_barcode TEXT,
    product_name TEXT,
    quantity INTEGER,
    unit_price REAL,
    subtotal REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id)
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

const tablas = ['users', 'products', 'shifts', 'sales', 'sale_items', 'expenses', 'transactions', 'config'];

async function migrar() {
  console.log('🛠️ Creando tablas en Turso Cloud...');
  for (const stmt of createTablesStatements) {
    await cloudDb.execute(stmt);
  }
  console.log('✅ Tablas creadas correctamente en la nube.');

  console.log('🚀 Iniciando migración de datos hacia Turso Cloud...');
  for (const tabla of tablas) {
    await new Promise((resolve) => {
      localDb.all(`SELECT * FROM ${tabla}`, async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          console.log(`⚠️ Tabla '${tabla}' vacía o no existe en pos.db local.`);
          return resolve();
        }

        console.log(`📦 Migrando ${rows.length} registros de '${tabla}'...`);
        for (const row of rows) {
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(row);
          const sql = `INSERT OR REPLACE INTO ${tabla} (${keys.join(', ')}) VALUES (${placeholders})`;

          try {
            await cloudDb.execute({ sql, args: values });
          } catch (e) {
            console.error(`Error insertando en ${tabla}:`, e.message);
          }
        }
        resolve();
      });
    });
  }

  console.log('🎉 ¡Migración completada con éxito! Todos tus productos y datos están seguros en Turso Cloud.');
  localDb.close();
}

migrar();