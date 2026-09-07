const db = require('./database');

db.serialize(() => {
  // Recrear la tabla shifts con estructura flexible
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT,
    start_amount REAL DEFAULT 0,
    end_amount REAL DEFAULT 0,
    cash_sales REAL DEFAULT 0,
    transfer_sales REAL DEFAULT 0,
    total_sales REAL DEFAULT 0,
    status TEXT DEFAULT 'abierto',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  )`, (err) => {
    if (err) console.error('Error al verificar tabla shifts:', err.message);
    else console.log('✅ Tabla shifts verfica/reparada correctamente.');
    process.exit();
  });
});