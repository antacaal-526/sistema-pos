const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Recrear la tabla sales con todas las columnas necesarias
  db.run("DROP TABLE IF EXISTS sales", (err) => {
    if (err) console.error("Error al borrar sales:", err);

    db.run(`CREATE TABLE sales (
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
    )`, (errCreate) => {
      if (errCreate) {
        console.error("Error al crear tabla sales:", errCreate.message);
      } else {
        console.log("✅ ¡Tabla 'sales' corregida con la columna customer_doc y estructura completa!");
      }
      process.exit();
    });
  });
});