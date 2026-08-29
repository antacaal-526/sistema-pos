const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- INICIALIZACIÓN DE TABLAS Y ADMIN ---
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

  // Tabla de Ventas
  db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL,
      usuario_id INTEGER,
      medio_pago TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      items_json TEXT,
      cliente_cc TEXT
    )
  `);

  db.run(`ALTER TABLE ventas ADD COLUMN items_json TEXT`, (err) => {});
  db.run(`ALTER TABLE ventas ADD COLUMN cliente_cc TEXT`, (err) => {});

  // Tabla de Control de Turnos / Arqueo de Caja
  db.run(`
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      nombre_cajero TEXT,
      base_inicial REAL,
      fecha_inicio TEXT,
      fecha_cierre TEXT,
      total_efectivo REAL DEFAULT 0,
      total_transferencia REAL DEFAULT 0,
      total_ventas REAL DEFAULT 0,
      estado TEXT DEFAULT 'abierto'
    )
  `);
});

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Ingrese usuario y contraseña' });
  }

  db.get(
    'SELECT * FROM usuarios WHERE LOWER(usuario) = LOWER(?)',
    [usuario.trim()],
    (err, userRow) => {
      if (err) return res.status(500).json({ error: 'Error en el servidor' });
      if (!userRow) return res.status(404).json({ error: 'Usuario no encontrado' });
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
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, nombre, usuario, rol FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

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

app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM usuarios WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Error al eliminar usuario' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado con éxito' });
  });
});

// --- RUTAS DE PRODUCTOS E INVENTARIO ---
app.get('/api/productos', (req, res) => {
  db.all('SELECT id, barcode, name AS nombre, sale_price AS precio, stock, COALESCE(min_stock, 5) AS min_stock FROM products', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/productos', (req, res) => {
  const { barcode, nombre, precio, stock, min_stock } = req.body;
  const codigoFinal = barcode ? barcode.trim() : Date.now().toString();

  db.run(
    `INSERT INTO products (barcode, internal_code, name, category, cost_price, sale_price, stock, min_stock)
     VALUES (?, ?, ?, 'General', 0, ?, ?, ?)`,
    [codigoFinal, codigoFinal, nombre, Number(precio), Number(stock), Number(min_stock) || 5],
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

app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const { stock, precio, min_stock } = req.body;

  db.run(
    `UPDATE products SET stock = ?, sale_price = ?, min_stock = ? WHERE id = ?`,
    [Number(stock), Number(precio), Number(min_stock) || 5, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ message: 'Producto actualizado correctamente' });
    }
  );
});

// --- RUTAS DE VENTAS ---
app.post('/api/ventas', (req, res) => {
  const { items, total, usuario_id, medio_pago, cliente_cc } = req.body;
  const itemsJson = JSON.stringify(items || []);

  db.run(
    'INSERT INTO ventas (total, usuario_id, medio_pago, items_json, cliente_cc) VALUES (?, ?, ?, ?, ?)',
    [total, usuario_id, medio_pago || 'efectivo', itemsJson, cliente_cc || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const ventaId = this.lastID;
      const stmt = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      items.forEach((item) => {
        stmt.run(item.cantidad, item.id);
      });
      stmt.finalize();

      res.json({ message: 'Venta registrada con éxito', ventaId });
    }
  );
});

app.get('/api/ventas', (req, res) => {
  db.all('SELECT * FROM ventas ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/ventas/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT items_json FROM ventas WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Venta no encontrada' });

    if (row.items_json) {
      try {
        const items = JSON.parse(row.items_json);
        const stmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        items.forEach((item) => {
          stmt.run(item.cantidad, item.id);
        });
        stmt.finalize();
      } catch (e) {
        console.error('Error devolviendo stock:', e);
      }
    }

    db.run('DELETE FROM ventas WHERE id = ?', [id], function (errDelete) {
      if (errDelete) return res.status(500).json({ error: errDelete.message });
      res.json({ message: 'Venta eliminada y stock devuelto exitosamente' });
    });
  });
});

// --- RUTAS DE GESTIÓN DE TURNOS Y CIERRES DE CAJA ---
app.get('/api/turnos/activo/:usuario_id', (req, res) => {
  const { usuario_id } = req.params;
  db.get(
    "SELECT * FROM turnos WHERE usuario_id = ? AND estado = 'abierto' ORDER BY id DESC LIMIT 1",
    [usuario_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

app.post('/api/turnos/abrir', (req, res) => {
  const { usuario_id, nombre_cajero, base_inicial } = req.body;
  const ahora = new Date();
  const fechaInicio = `${ahora.toLocaleDateString('es-CO')} ${ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

  db.run(
    `INSERT INTO turnos (usuario_id, nombre_cajero, base_inicial, fecha_inicio, estado)
     VALUES (?, ?, ?, ?, 'abierto')`,
    [usuario_id, nombre_cajero, Number(base_inicial) || 200000, fechaInicio],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        message: 'Turno iniciado con éxito',
        turno: {
          id: this.lastID,
          usuario_id,
          nombre_cajero,
          base_inicial: Number(base_inicial) || 200000,
          fecha_inicio: fechaInicio,
          estado: 'abierto'
        }
      });
    }
  );
});

// Cierre de turno: Asocia el stock actual de cada producto a los ítems del historial de ventas
app.post('/api/turnos/cerrar', (req, res) => {
  const { turno_id } = req.body;
  const ahora = new Date();
  const fechaCierre = `${ahora.toLocaleDateString('es-CO')} ${ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

  db.get('SELECT * FROM turnos WHERE id = ?', [turno_id], (err, turno) => {
    if (err || !turno) return res.status(404).json({ error: 'Turno no encontrado' });

    db.all(
      'SELECT * FROM ventas WHERE usuario_id = ? ORDER BY id DESC',
      [turno.usuario_id],
      (errVentas, rowsVentas) => {
        let totalEfectivo = 0;
        let totalTransferencia = 0;

        if (rowsVentas && rowsVentas.length > 0) {
          rowsVentas.forEach((v) => {
            if (v.medio_pago && v.medio_pago.toLowerCase().includes('transferencia')) {
              totalTransferencia += Number(v.total) || 0;
            } else {
              totalEfectivo += Number(v.total) || 0;
            }
          });
        }

        const totalVentas = totalEfectivo + totalTransferencia;

        db.all('SELECT id, name AS nombre, stock FROM products', [], (errProd, rowsProducts) => {
          const stockMap = {};
          if (rowsProducts) {
            rowsProducts.forEach(p => {
              stockMap[p.id] = p.stock;
              stockMap[p.nombre] = p.stock;
            });
          }

          const ventasEnriquecidas = (rowsVentas || []).map(v => {
            let items = [];
            if (v.items_json) {
              try {
                items = JSON.parse(v.items_json).map(item => ({
                  ...item,
                  stockActual: stockMap[item.id] !== undefined ? stockMap[item.id] : (stockMap[item.nombre] ?? 0)
                }));
              } catch (e) {}
            }
            return {
              ...v,
              itemsEnriquecidos: items
            };
          });

          db.run(
            `UPDATE turnos SET fecha_cierre = ?, total_efectivo = ?, total_transferencia = ?, total_ventas = ?, estado = 'cerrado' WHERE id = ?`,
            [fechaCierre, totalEfectivo, totalTransferencia, totalVentas, turno_id],
            function (errUpdate) {
              if (errUpdate) return res.status(500).json({ error: errUpdate.message });
              res.json({
                message: 'Turno cerrado exitosamente',
                resumen: {
                  turnoId: turno_id,
                  cajero: turno.nombre_cajero,
                  baseInicial: turno.base_inicial,
                  fechaInicio: turno.fecha_inicio,
                  fechaCierre: fechaCierre,
                  totalEfectivo,
                  totalTransferencia,
                  totalVentas,
                  efectivoEsperadoEnCaja: turno.base_inicial + totalEfectivo,
                  ventasDelTurno: ventasEnriquecidas
                }
              });
            }
          );
        });
      }
    );
  });
});

app.get('/api/turnos', (req, res) => {
  db.all('SELECT * FROM turnos ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Terra Frutos Secos corriendo en el puerto ${PORT}`);
});