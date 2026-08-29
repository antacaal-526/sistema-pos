const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- INICIALIZACIÓN DE LA BASE DE DATOS Y ADMIN ---
db.serialize(() => {
  // Tabla de Usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      usuario TEXT UNIQUE,
      password TEXT,
      rol TEXT
    )
  `);

  // Asegurar siempre el usuario Administrador (admin / 0526)
  db.run(`
    INSERT INTO usuarios (nombre, usuario, password, rol)
    VALUES ('Administrador', 'admin', '0526', 'admin')
    ON CONFLICT(usuario) DO UPDATE SET password = '0526', rol = 'admin'
  `, (err) => {
    if (err) console.error('Error inicializando admin:', err.message);
    else console.log('✓ Usuario Administrador listo: (admin / 0526)');
  });

  // Tabla de Productos
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      internal_code TEXT,
      name TEXT,
      category TEXT,
      cost_price REAL,
      sale_price REAL,
      stock INTEGER,
      min_stock INTEGER
    )
  `);

  // Tabla de Ventas (Con columna para Medio de Pago)
  db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL,
      usuario_id INTEGER,
      medio_pago TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// --- RUTAS DE AUTENTICACIÓN ---

// Login (Tolera mayúsculas y minúsculas)
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Ingrese usuario y contraseña' });
  }

  db.get(
    'SELECT * FROM usuarios WHERE LOWER(usuario) = LOWER(?)',
    [usuario.trim()],
    (err, userRow) => {
      if (err) {
        return res.status(500).json({ error: 'Error en el servidor' });
      }
      if (!userRow) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      if (userRow.password !== password.trim()) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      res.json({
        message: 'Acceso concedido',
        usuario: {
          id: userRow.id,
          nombre: userRow.nombre,
          usuario: userRow.usuario,
          rol: userRow.rol
        }
      });
    }
  );
});

// --- RUTAS DE GESTIÓN DE USUARIOS ---

// Obtener todos los usuarios
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, nombre, usuario, rol FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear nuevo usuario (Cajero o Admin)
app.post('/api/usuarios', (req, res) => {
  const { nombre, usuario, password, rol } = req.body;
  db.run(
    'INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)',
    [nombre, usuario, password, rol || 'cajero'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Usuario creado exitosamente', id: this.lastID });
    }
  );
});

// Eliminar usuario
app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM usuarios WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado con éxito' });
  });
});

// --- RUTAS DE PRODUCTOS E INVENTARIO ---

// 1. Obtener lista completa de productos
app.get('/api/productos', (req, res) => {
  db.all('SELECT id, barcode, name AS nombre, sale_price AS precio, stock FROM products', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Crear Nuevo Producto en Inventario
app.post('/api/productos', (req, res) => {
  const { barcode, nombre, precio, stock } = req.body;
  const codigoFinal = barcode ? barcode.trim() : Date.now().toString();

  db.run(
    `INSERT INTO products (barcode, internal_code, name, category, cost_price, sale_price, stock, min_stock)
     VALUES (?, ?, ?, 'General', 0, ?, ?, 5)`,
    [codigoFinal, codigoFinal, nombre, Number(precio), Number(stock)],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'El código de barras ya pertenece a otro producto' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Producto creado exitosamente', id: this.lastID });
    }
  );
});

// 3. Modificar Stock y Precio (Entrada de mercancía)
app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const { stock, precio } = req.body;

  db.run(
    `UPDATE products SET stock = ?, sale_price = ? WHERE id = ?`,
    [Number(stock), Number(precio), id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ message: 'Stock y producto actualizados correctamente' });
    }
  );
});

// --- RUTAS DE VENTAS Y REPORTES ---

// Registrar una nueva venta, guardar medio de pago y descontar inventario
app.post('/api/ventas', (req, res) => {
  const { items, total, usuario_id, medio_pago } = req.body;

  db.run(
    'INSERT INTO ventas (total, usuario_id, medio_pago) VALUES (?, ?, ?)',
    [total, usuario_id, medio_pago || 'efectivo'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const ventaId = this.lastID;

      // Descontar la cantidad vendida del stock de cada producto
      const stmt = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      items.forEach((item) => {
        stmt.run(item.cantidad, item.id);
      });
      stmt.finalize();

      res.json({ message: 'Venta registrada con éxito', ventaId });
    }
  );
});

// Obtener historial de ventas
app.get('/api/ventas', (req, res) => {
  db.all('SELECT * FROM ventas ORDER BY fecha DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Terra Frutos Secos corriendo en el puerto ${PORT}`);
});