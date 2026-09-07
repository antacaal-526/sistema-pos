const db = require('./database');

db.serialize(() => {
  db.run("DELETE FROM users", (err) => {
    if (err) console.error(err);
    
    // Insertar usuarios limpios con contraseña en texto plano para evitar encriptaciones fallidas
    db.run("INSERT INTO users (id, name, username, password, role) VALUES (1, 'ANTHONY CARDENAS', 'ANTHONY', '0526', 'Administrador')");
    db.run("INSERT INTO users (id, name, username, password, role) VALUES (2, 'Doña Rosa', 'rosa', '1234', 'Cajero')");
    db.run("INSERT INTO users (id, name, username, password, role) VALUES (3, 'Administrador Principal', 'admin', 'admin123', 'Administrador')");
    
    console.log("✅ ¡Usuarios restablecidos correctamente!");
    process.exit();
  });
});