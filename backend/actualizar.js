const db = require('./database');

db.run("UPDATE users SET password = '0526' WHERE LOWER(username) = LOWER('anthony')", function (err) {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('✅ ¡CONTRASEÑA ACTUALIZADA A 0526!');
  }
  process.exit();
});