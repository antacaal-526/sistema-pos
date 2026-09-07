const db = require('./database');
db.all("SELECT id, name, username, password, role FROM users", [], (err, rows) => {
  console.log("Usuarios en la base de datos:", rows);
  process.exit();
});
