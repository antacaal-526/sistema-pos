const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const JWT_SECRET = 'clave_secreta_terra_frutos_secos_2026';

app.use(cors());
app.use(express.json());

// Middlewares de Seguridad
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Acceso denegado. Se requiere inicio de sesión.' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido o sesión expirada.' });
    req.user = decoded;
    next();
  });
};

const verificarAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso de Administrador requerido.' });
  next();
};

// --- AUTENTICACIÓN Y USUARIOS ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Usuario no encontrado.' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Contraseña incorrecta.' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, role: user.role, username: user.username });
  });
});

app.get('/api/users', [verificarToken, verificarAdmin], (req, res) => {
  db.all("SELECT id, username, role FROM users", [], (err, rows) => res.json(rows || []));
});

app.post('/api/users', [verificarToken, verificarAdmin], (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Debe ingresar usuario y clave.' });
  const hash = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role || 'empleado'], function(err) {
    if (err) return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
    res.json({ message: 'Empleado registrado exitosamente.' });
  });
});

// --- CONTROL DE TURNOS DE CAJA ---
app.get('/api/shifts/current', verificarToken, (req, res) => {
  db.get("SELECT * FROM shifts WHERE user_id = ? AND status = 'ABIERTO'", [req.user.id], (err, row) => {
    res.json(row || null);
  });
});

app.post('/api/shifts/open', verificarToken, (req, res) => {
  const { initial_cash } = req.body;
  db.get("SELECT * FROM shifts WHERE user_id = ? AND status = 'ABIERTO'", [req.user.id], (err, existing) => {
    if (existing) {
      return res.json({ shiftId: existing.id, message: 'Ya tiene un turno abierto activo.' });
    }
    db.run("INSERT INTO shifts (user_id, user_name, initial_cash) VALUES (?, ?, ?)", 
      [req.user.id, req.user.username, initial_cash || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ shiftId: this.lastID, message: 'Turno abierto correctamente.' });
    });
  });
});

app.post('/api/shifts/close', verificarToken, (req, res) => {
  const { shift_id, real_cash } = req.body;
  db.get("SELECT SUM(total) as cash_sales FROM sales WHERE shift_id = ? AND status = 'COMPLETADA' AND payment_method = 'EFECTIVO'", [shift_id], (err, rowSales) => {
    db.get("SELECT initial_cash FROM shifts WHERE id = ?", [shift_id], (err, shift) => {
      const cashSales = rowSales ? (rowSales.cash_sales || 0) : 0;
      const initialCash = shift ? shift.initial_cash : 0;
      const expectedCash = initialCash + cashSales;
      const realCashNum = parseFloat(real_cash) || 0;
      const difference = realCashNum - expectedCash;

      db.run(`UPDATE shifts SET end_time = CURRENT_TIMESTAMP, expected_cash = ?, real_cash = ?, difference = ?, status = 'CERRADO' WHERE id = ?`,
        [expectedCash, realCashNum, difference, shift_id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Turno cerrado con éxito.', expectedCash, real_cash: realCashNum, difference });
      });
    });
  });
});

// --- INVENTARIO Y PRODUCTOS ---
app.get('/api/products', verificarToken, (req, res) => {
  db.all("SELECT * FROM products ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/products', [verificarToken, verificarAdmin], (req, res) => {
  const { barcode, internal_code, name, category, cost_price, sale_price, stock, min_stock } = req.body;
  db.run(`INSERT INTO products (barcode, internal_code, name, category, cost_price, sale_price, stock, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [barcode, internal_code, name, category || 'General', cost_price || 0, sale_price || 0, stock || 0, min_stock || 5], function(err) {
      if (err) return res.status(400).json({ error: 'El código de barras ya existe o datos no válidos.' });
      res.json({ id: this.lastID, message: 'Producto guardado exitosamente.' });
  });
});

app.put('/api/products/:id', [verificarToken, verificarAdmin], (req, res) => {
  const { barcode, internal_code, name, category, cost_price, sale_price, stock, min_stock } = req.body;
  db.run(`UPDATE products SET barcode=?, internal_code=?, name=?, category=?, cost_price=?, sale_price=?, stock=?, min_stock=? WHERE id=?`,
    [barcode, internal_code, name, category, cost_price, sale_price, stock, min_stock, req.params.id], (err) => {
      res.json({ message: 'Producto actualizado.' });
  });
});

// --- VENTAS Y PRECUENTAS ---
app.post('/api/sales', verificarToken, (req, res) => {
  const { shift_id, items, total, tax, payment_method, amount_paid, change_given, customer_name, is_preaccount } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'El carrito está vacío.' });

  const status = is_preaccount ? 'PRECUENTA' : 'COMPLETADA';
  const cufeRaw = `${Date.now()}-${req.user.id}-${total}-${payment_method}`;
  const cufe = crypto.createHash('sha256').update(cufeRaw).digest('hex');

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const sqlSale = `INSERT INTO sales (shift_id, user_id, user_name, total, tax, payment_method, amount_paid, change_given, cufe, status, customer_name) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sqlSale, [shift_id || null, req.user.id, req.user.username, total, tax, payment_method, amount_paid, change_given, cufe, status, customer_name || 'Consumidor Final'], function(err) {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: err.message });
      }

      const saleId = this.lastID;
      const stmtItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`);
      const stmtStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

      for (let item of items) {
        stmtItem.run(saleId, item.id, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price);
        if (!is_preaccount) {
          stmtStock.run(item.quantity, item.id);
        }
      }

      stmtItem.finalize();
      stmtStock.finalize();

      db.run("COMMIT", (err) => {
        if (err) return res.status(500).json({ error: 'Error al finalizar la venta.' });
        res.json({
          message: is_preaccount ? 'Precuenta guardada.' : 'Factura generada exitosamente.',
          invoice: {
            saleId,
            cufe,
            date: new Date().toLocaleString(),
            cashier: req.user.username,
            customer_name: customer_name || 'Consumidor Final',
            items,
            total,
            tax,
            payment_method,
            amount_paid,
            change_given,
            status
          }
        });
      });
    });
  });
});

app.post('/api/sales/:id/convert', verificarToken, (req, res) => {
  const saleId = req.params.id;
  const { payment_method, amount_paid, change_given } = req.body;

  db.get("SELECT * FROM sales WHERE id = ? AND status = 'PRECUENTA'", [saleId], (err, sale) => {
    if (err || !sale) return res.status(404).json({ error: 'Precuenta no encontrada.' });

    db.all("SELECT * FROM sale_items WHERE sale_id = ?", [saleId], (err, items) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmtStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        for (let item of items) {
          stmtStock.run(item.quantity, item.product_id);
        }
        stmtStock.finalize();

        db.run(`UPDATE sales SET status = 'COMPLETADA', payment_method = ?, amount_paid = ?, change_given = ? WHERE id = ?`,
          [payment_method || 'EFECTIVO', amount_paid || sale.total, change_given || 0, saleId]);

        db.run("COMMIT", (err) => {
          res.json({ message: 'Precuenta convertida a Factura de Venta exitosamente.' });
        });
      });
    });
  });
});

app.get('/api/preaccounts', verificarToken, (req, res) => {
  db.all("SELECT * FROM sales WHERE status = 'PRECUENTA' ORDER BY created_at DESC", [], (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/sales/:id/cancel', [verificarToken, verificarAdmin], (req, res) => {
  const saleId = req.params.id;
  db.get("SELECT * FROM sales WHERE id = ?", [saleId], (err, sale) => {
    if (err || !sale) return res.status(404).json({ error: 'Venta no encontrada.' });
    if (sale.status === 'ANULADA') return res.status(400).json({ error: 'La venta ya fue anulada.' });

    db.all("SELECT * FROM sale_items WHERE sale_id = ?", [saleId], (err, items) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("UPDATE sales SET status = 'ANULADA' WHERE id = ?", [saleId]);

        if (sale.status === 'COMPLETADA') {
          const stmtStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
          for (let item of items) {
            stmtStock.run(item.quantity, item.product_id);
          }
          stmtStock.finalize();
        }

        db.run("COMMIT", (err) => res.json({ message: 'Venta anulada e inventario reajustado.' }));
      });
    });
  });
});

app.get('/api/reports/daily', [verificarToken, verificarAdmin], (req, res) => {
  db.all("SELECT * FROM sales ORDER BY created_at DESC", [], (err, rows) => {
    let totalGain = 0;
    (rows || []).forEach(r => { if(r.status === 'COMPLETADA') totalGain += r.total; });
    res.json({ sales: rows || [], totalSalesSum: totalGain });
  });
});

// CONTROLADOR GLOBAL PARA RUTAS INEXISTENTES (Garantiza respuestas JSON y evita error <DOCTYPE)
// CONTROLADOR GLOBAL DE ERRORES (Evita respuestas HTML en el navegador)
app.use((err, req, res, next) => {
  console.error("Error en servidor:", err.stack);
  res.status(500).json({ error: err.message || 'Error interno en el servidor Backend.' });
});

app.use((req, res) => {
  res.status(404).json({ error: `La ruta ${req.originalUrl} no existe en el servidor.` });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor Terra Frutos Secos corriendo en http://localhost:${PORT}`));