const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Lista de archivos de base de datos presentes en backend
const dbFiles = ['pos.db', 'database.sqlite'];

dbFiles.forEach((file) => {
  const dbPath = path.join(__dirname, file);
  if (fs.existsSync(dbPath)) {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return console.error(`Error abriendo ${file}:`, err.message);

      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS shifts', (errDrop) => {
          if (errDrop) console.error(`Error borrando shifts en ${file}:`, errDrop.message);

          db.run(
            `CREATE TABLE shifts (
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
            )`,
            (errCreate) => {
              if (errCreate) console.error(`Error creando shifts en ${file}:`, errCreate.message);
              else console.log(`✅ Tabla 'shifts' actualizada correctamente en: ${file}`);
            }
          );
        });
      });
    });
  }
});