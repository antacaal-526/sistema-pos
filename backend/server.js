const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend/dist')));

// --- LOGIN ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Ingrese usuario y contraseña' });

  db.get(
    'SELECT id, name, username, role FROM users WHERE LOWER(username) = LOWER(?) AND password = ?',
    [username.trim(), password.trim()],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      res.json({ success: true, user });
    }
  );
});

// --- GESTIÓN DE EMPLEADOS Y USUARIOS ---
app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, username, role FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/users', (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  db.run(
    'INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)',
    [name.trim(), username.trim().toLowerCase(), password.trim(), role || 'Cajero'],
    function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, userId: this.lastID });
    }
  );
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- TURNOS Y REPORTES DE TURNOS ---
app.get('/api/shifts', (req, res) => {
  db.all('SELECT * FROM shifts ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/shifts/active', (req, res) => {
  const userName = req.query.user_name ? req.query.user_name.trim() : null;
  const query = userName 
    ? 'SELECT * FROM shifts WHERE LOWER(user_name) = LOWER(?) AND status = "abierto" ORDER BY id DESC LIMIT 1'
    : 'SELECT * FROM shifts WHERE status = "abierto" ORDER BY id DESC LIMIT 1';

  db.get(query, userName ? [userName] : [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

app.post('/api/shifts/open', (req, res) => {
  const { user_name, start_amount } = req.body;
  const usuario = user_name ? user_name.trim() : 'ANTHONY CARDENAS';
  const base = parseFloat(start_amount) || 0;

  db.run(
    'INSERT INTO shifts (user_name, start_amount, status) VALUES (?, ?, "abierto")',
    [usuario, base],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, shiftId: this.lastID, user_name: usuario, start_amount: base });
    }
  );
});

app.post('/api/shifts/close', (req, res) => {
  const { shift_id } = req.body;

  db.get('SELECT * FROM shifts WHERE id = ?', [shift_id], (errShift, shift) => {
    if (errShift || !shift) return res.status(500).json({ error: 'Turno no encontrado' });

    db.all(
      `SELECT payment_method, SUM(total) as total_sales FROM sales WHERE shift_id = ? GROUP BY payment_method`,
      [shift_id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let cashSales = 0;
        let transferSales = 0;

        if (rows) {
          rows.forEach((r) => {
            if (r.payment_method === 'Efectivo') cashSales += (r.total_sales || 0);
            else transferSales += (r.total_sales || 0);
          });
        }

        const totalSales = cashSales + transferSales;
        const startBase = shift.start_amount || 0;
        const totalCashInBox = startBase + cashSales;

        db.run(
          `UPDATE shifts SET status = "cerrado", end_amount = ?, cash_sales = ?, transfer_sales = ?, total_sales = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [totalCashInBox, cashSales, transferSales, totalSales, shift_id],
          function (errClose) {
            if (errClose) return res.status(500).json({ error: errClose.message });
            res.json({
              success: true,
              summary: {
                shift_id,
                startBase,
                cashSales,
                transferSales,
                totalSales,
                totalCashInBox
              }
            });
          }
        );
      }
    );
  });
});

// --- PRODUCTOS ---
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY CAST(barcode AS INTEGER) ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', (req, res) => {
  const { barcode, name, sale_price, stock, min_stock } = req.body;
  if (!barcode || !name) return res.status(400).json({ error: 'El código y nombre son requeridos' });

  db.run(
    `INSERT INTO products (barcode, name, sale_price, stock, min_stock) VALUES (?, ?, ?, ?, ?)`,
    [barcode.trim(), name.trim(), parseFloat(sale_price) || 0, parseInt(stock) || 0, parseInt(min_stock) || 3],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.put('/api/products/:barcode', (req, res) => {
  const { barcode } = req.params;
  const { name, sale_price, stock, min_stock } = req.body;

  db.run(
    `UPDATE products SET name = ?, sale_price = ?, stock = ?, min_stock = ? WHERE barcode = ?`,
    [name.trim(), parseFloat(sale_price) || 0, parseInt(stock) || 0, parseInt(min_stock) || 3, barcode.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/products/:barcode', (req, res) => {
  const { barcode } = req.params;
  db.run('DELETE FROM products WHERE barcode = ?', [barcode.trim()], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- VENTAS E INTEGRACIÓN AUTOMÁTICA CON CONTABILIDAD ---
app.post('/api/sales', (req, res) => {
  const { shift_id, user_name, customer_doc, customer_name, items, total, payment_method, amount_paid, change_given, sale_type } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ error: 'Carrito vacío' });

  const prefijo = 'TF';
  const invNumber = `${prefijo}-${Date.now().toString().slice(-6)}`;

  db.run(
    `INSERT INTO sales (shift_id, user_name, invoice_number, customer_doc, customer_name, subtotal, tax_amount, total, payment_method, amount_paid, change_given, sale_type)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [shift_id || null, user_name || 'ANTHONY CARDENAS', invNumber, customer_doc || '222222222222', customer_name || 'Consumidor Final', total, total, payment_method || 'Efectivo', amount_paid || total, change_given || 0, sale_type || 'Facturada'],
    function (errSale) {
      if (errSale) return res.status(500).json({ error: errSale.message });

      const saleId = this.lastID;

      items.forEach((item) => {
        db.run('UPDATE products SET stock = stock - ? WHERE barcode = ?', [item.quantity, item.barcode]);
        db.run('INSERT INTO sale_items (sale_id, product_barcode, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
          [saleId, item.barcode, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price]
        );
      });

      db.run(
        `INSERT INTO transactions (type, category, description, amount, user_name) VALUES ('Ingreso', 'Venta POS', ?, ?, ?)`,
        [`Venta POS Factura #${invNumber} (${payment_method})`, total, user_name || 'ANTHONY CARDENAS']
      );

      res.json({ success: true, saleId, invoice_number: invNumber });
    }
  );
});

// --- MOVIMIENTOS CONTABLES (INGRESOS Y EGRESOS) ---
app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/transactions', (req, res) => {
  const { type, category, description, amount, user_name } = req.body;
  if (!type || !amount) return res.status(400).json({ error: 'Tipo y monto requeridos' });

  db.run(
    `INSERT INTO transactions (type, category, description, amount, user_name) VALUES (?, ?, ?, ?, ?)`,
    [type, category || 'Varios', description || '', parseFloat(amount) || 0, user_name || 'ANTHONY CARDENAS'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM transactions WHERE id = ?', [id], (err, tx) => {
    if (err || !tx) return res.status(400).json({ error: 'Movimiento no encontrado' });

    if (tx.category === 'Venta POS' && tx.description.includes('Factura #')) {
      const parts = tx.description.split('Factura #');
      if (parts[1]) {
        const invNumber = parts[1].split(' ')[0].trim();
        db.get('SELECT id FROM sales WHERE invoice_number = ?', [invNumber], (errSale, sale) => {
          if (sale) {
            db.all('SELECT product_barcode, quantity FROM sale_items WHERE sale_id = ?', [sale.id], (errItems, items) => {
              if (items) {
                items.forEach((item) => {
                  db.run('UPDATE products SET stock = stock + ? WHERE barcode = ?', [item.quantity, item.product_barcode]);
                });
              }
              db.run('DELETE FROM sale_items WHERE sale_id = ?', [sale.id]);
              db.run('DELETE FROM sales WHERE id = ?', [sale.id]);
            });
          }
        });
      }
    }

    db.run('DELETE FROM transactions WHERE id = ?', [id], function (errDel) {
      if (errDel) return res.status(500).json({ error: errDel.message });
      res.json({ success: true });
    });
  });
});

// --- CONFIGURACIÓN DIAN Y RECIBO ---
app.get('/api/config', (req, res) => {
  db.all('SELECT * FROM config', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const configObj = {
      razon_social: 'TERRA FRUTOS SECOS',
      nit: '40044029-8',
      direccion: 'Cra 7 #15-63, Tunja, Boyacá',
      telefono: '3183142180',
      actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR',
      footer_msg: '¡Gracias por su compra!'
    };
    if (rows) {
      rows.forEach((r) => { configObj[r.key] = r.value; });
    }
    res.json(configObj);
  });
});

app.post('/api/config', (req, res) => {
  const config = req.body;
  const keys = Object.keys(config);

  if (keys.length === 0) return res.status(400).json({ error: 'Datos no válidos' });

  let completed = 0;
  keys.forEach((key) => {
    db.run(
      `INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, config[key]],
      (err) => {
        completed++;
        if (completed === keys.length) {
          res.json({ success: true });
        }
      }
    );
  });
});

// --- RUTA DE RESPALDO DE LA BASE DE DATOS ---
app.get('/api/backup-db', (req, res) => {
  const dbPath = path.join(__dirname, 'pos.db');
  res.download(dbPath, `pos_backup_${new Date().toISOString().slice(0, 10)}.db`, (err) => {
    if (err) {
      console.error('Error al descargar la base de datos:', err);
      res.status(500).json({ error: 'No se pudo generar la copia de seguridad' });
    }
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Backend ejecutándose en el puerto ${PORT}`);
});