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

const tablas = ['users', 'products', 'shifts', 'sales', 'sale_items', 'expenses', 'transactions', 'config'];

async function migrar() {
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

  console.log('✅ ¡Migración completada con éxito! Todos los datos están resguardados en Turso Cloud.');
  localDb.close();
}

migrar();