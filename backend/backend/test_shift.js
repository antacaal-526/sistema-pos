const db = require('./database');

async function testShift() {
  console.log('🧪 Probando apertura de turno directamente en Turso...');
  
  // 1. Probar inserción en shifts
  db.run(
    `INSERT INTO shifts (user_id, user_name, start_amount, status) VALUES (?, ?, ?, 'abierto')`,
    [1, 'ANTHONY CARDENAS', 200000],
    function (err) {
      if (err) {
        console.error('❌ Error en INSERT shifts:', err.message);
        process.exit(1);
      }
      console.log('✅ Turno insertado correctamente. ID:', this.lastID);

      // 2. Probar consulta
      db.get(`SELECT * FROM shifts WHERE id = ?`, [this.lastID], (err2, row) => {
        if (err2) {
          console.error('❌ Error en SELECT shifts:', err2.message);
          process.exit(1);
        }
        console.log('✅ Turno obtenido de Turso:', row);
        
        // 3. Limpiar el turno de prueba
        db.run(`DELETE FROM shifts WHERE id = ?`, [this.lastID], () => {
          console.log('🧹 Limpieza completada.');
          process.exit(0);
        });
      });
    }
  );
}

testShift();