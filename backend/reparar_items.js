const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

console.log("🛠️ Reestructurando tabla 'sale_items'...");

db.serialize(() => {
  // 1. Eliminar la tabla problemática si existe
  db.run("DROP TABLE IF EXISTS sale_items", (err) => {
    if (err) console.error("Error al eliminar sale_items:", err);

    // 2. Volver a crearla con la columna product_barcode correcta
    db.run(`CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_barcode TEXT,
      product_name TEXT,
      quantity INTEGER,
      unit_price REAL,
      subtotal REAL
    )`, (errCreate) => {
      if (errCreate) {
        console.error("❌ Error creando la tabla:", errCreate.message);
      } else {
        console.log("✅ ¡Tabla 'sale_items' recreada correctamente con la columna product_barcode!");
      }
      process.exit();
    });
  });
});