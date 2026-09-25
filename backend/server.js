const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const db = require('./database');

const app = express();

app.use(cors());
app.use(express.json());

function getColombiaTimestamp() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace('T', ' ');
}

function createInvoicePDFBuffer(invoice, config) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text(config.razon_social || 'TERRA FRUTOS SECOS', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(config.actividad || '', { align: 'center' });
    doc.text(`NIT: ${config.nit || ''} | TEL: ${config.telefono || ''}`, { align: 'center' });
    doc.text(config.direccion || '', { align: 'center' });
    doc.moveDown(0.5);
    doc.text('----------------------------------------------------------------------------------------------------', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text(`FACTURA POS: #${invoice.invoice_number}`);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Fecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    doc.text(`Cliente: ${invoice.customer_name || 'Consumidor Final'} (Doc: ${invoice.customer_doc || '222222222222'})`);
    doc.text(`Atendido por: ${invoice.user_name}`);
    doc.text(`Método de Pago: ${invoice.payment_method}`);
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold');
    doc.text('Descripción', 36, doc.y, { width: 260 });
    const headerY = doc.y - 11;
    doc.text('Cant.', 310, headerY, { width: 50, align: 'center' });
    doc.text('Precio Unit.', 370, headerY, { width: 80, align: 'right' });
    doc.text('Subtotal', 460, headerY, { width: 80, align: 'right' });
    doc.moveDown(0.4);
    doc.font('Helvetica');

    invoice.items.forEach((item) => {
      const itemY = doc.y;
      doc.text(item.name, 36, itemY, { width: 260 });
      doc.text(String(item.quantity), 310, itemY, { width: 50, align: 'center' });
      doc.text(`$${Number(item.sale_price).toLocaleString('es-CO')}`, 370, itemY, { width: 80, align: 'right' });
      doc.text(`$${(item.quantity * item.sale_price).toLocaleString('es-CO')}`, 460, itemY, { width: 80, align: 'right' });
      doc.moveDown(0.3);
    });

    doc.moveDown(0.5);
    doc.text('----------------------------------------------------------------------------------------------------', { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`TOTAL: $${Number(invoice.total).toLocaleString('es-CO')}`, { align: 'right' });
    doc.fontSize(9).font('Helvetica');
    doc.text(`Recibido: $${Number(invoice.amount_paid).toLocaleString('es-CO')}`, { align: 'right' });
    doc.text(`Devueltas: $${Number(invoice.change_given).toLocaleString('es-CO')}`, { align: 'right' });
    doc.moveDown(1);
    doc.text(config.footer_msg || '¡Gracias por su compra!', { align: 'center' });

    doc.end();
  });
}

async function sendInvoiceByBrevo(toEmail, customerName, invoiceNumber, total, pdfBuffer, config) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;
  const payload = {
    sender: { name: config.razon_social || 'TERRA FRUTOS SECOS', email: process.env.EMAIL_USER || 'terratunja2026@gmail.com' },
    to: [{ email: toEmail, name: customerName || 'Cliente' }],
    subject: `Factura de Venta #${invoiceNumber} - ${config.razon_social || 'TERRA FRUTOS SECOS'}`,
    htmlContent: `
      <div style="font-family: sans-serif; color: #333; line-height: 1.5;">
        <h2>🌱 ${config.razon_social || 'TERRA FRUTOS SECOS'}</h2>
        <p>Hola <strong>${customerName || 'Cliente'}</strong>,</p>
        <p>Adjuntamos el comprobante electrónico en formato PDF correspondiente a tu compra por valor de <strong>$${Number(total).toLocaleString('es-CO')}</strong>.</p>
        <p>Número de Factura: <strong>#${invoiceNumber}</strong></p>
        <hr style="border: 0; border-top: 1px solid #ddd;" />
        <p style="font-size: 0.85rem; color: #777;">${config.direccion || ''} | Tel: ${config.telefono || ''}</p>
      </div>
    `,
    attachment: [{ name: `Factura_${invoiceNumber}.pdf`, content: pdfBuffer.toString('base64') }]
  };
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': apiKey.trim(), 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

app.get('/api/ping', (req, res) => res.send('pong'));

// --- CLIENTES ---
app.get('/api/customers', (req, res) => {
  db.all('SELECT * FROM customers ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/customers', async (req, res) => {
  const { id, name, document, phone, address, city, notes, created_at } = req.body;
  try {
    const existing = await new Promise(r => db.get('SELECT id FROM customers WHERE id = ?', [id], (e, row) => r(row)));
    if (existing) return res.json({ success: true, message: 'Cliente ya sincronizado' });

    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO customers (id, name, document, phone, address, city, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, document, phone, address, city, notes, created_at || getColombiaTimestamp()],
        (err) => err ? reject(err) : resolve()
      );
    });
    res.json({ success: true, customerId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NUEVO ENDPOINT PARA TRAZABILIDAD (ENTREGADOR) ---
app.get('/api/orders/detailed', async (req, res) => {
  try {
    // Obtenemos pedidos con el nombre del cliente
    const orders = await new Promise(r => db.all(`
      SELECT o.*, c.name as customer_name, c.document as customer_doc 
      FROM orders o 
      LEFT JOIN customers c ON o.customer_id = c.id 
      ORDER BY o.created_at DESC`, [], (e, d) => r(d || [])));
    
    // Obtenemos los items de esos pedidos
    const items = await new Promise(r => db.all('SELECT * FROM order_items', [], (e, d) => r(d || [])));
    
    // Anidamos los items en su pedido respectivo
    const detailedOrders = orders.map(order => ({
      ...order,
      items: items.filter(i => i.order_id === order.id)
    }));
    
    res.json(detailedOrders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PEDIDOS (PREVENTA) ---
app.post('/api/orders', async (req, res) => {
  const { id, customer_id, created_by, assigned_to, total, notes, items, created_at } = req.body;
  const horaCol = getColombiaTimestamp();

  try {
    const existing = await new Promise(r => db.get('SELECT id FROM orders WHERE id = ?', [id], (e, row) => r(row)));
    if (existing) return res.json({ success: true, message: 'Pedido ya procesado', orderId: id });

    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO orders (id, customer_id, created_by, assigned_to, total, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
        [id, customer_id, created_by, assigned_to || null, total, notes, created_at || horaCol, horaCol],
        (err) => err ? reject(err) : resolve()
      );
    });

    for (const item of items) {
      const itemId = crypto.randomUUID();
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO order_items (id, order_id, product_barcode, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, item.barcode, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price],
          (err) => err ? reject(err) : resolve()
        );
      });
      await new Promise((resolve, reject) => {
        db.run('UPDATE products SET reserved_stock = reserved_stock + ? WHERE barcode = ?', [item.quantity, item.barcode], (err) => err ? reject(err) : resolve());
      });
    }
    res.json({ success: true, orderId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 
  const horaCol = getColombiaTimestamp();

  try {
    const order = await new Promise(r => db.get('SELECT * FROM orders WHERE id = ?', [id], (e, row) => r(row)));
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const items = await new Promise(r => db.all('SELECT product_barcode, quantity FROM order_items WHERE order_id = ?', [id], (e, rows) => r(rows || [])));

    if (status === 'DELIVERED') {
      for (const item of items) {
        await new Promise(r => db.run('UPDATE products SET stock = stock - ?, reserved_stock = reserved_stock - ? WHERE barcode = ?', [item.quantity, item.quantity, item.product_barcode], r));
      }
    } else if (status === 'CANCELLED' && order.status === 'PENDING') {
      for (const item of items) {
        await new Promise(r => db.run('UPDATE products SET reserved_stock = reserved_stock - ? WHERE barcode = ?', [item.quantity, item.product_barcode], r));
      }
    }
    await new Promise((resolve, reject) => {
      db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, horaCol, id], (err) => err ? reject(err) : resolve());
    });
    res.json({ success: true, newStatus: status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payments', async (req, res) => {
  const { id, order_id, collector_id, payment_method, amount, collected_at } = req.body;
  const horaCol = getColombiaTimestamp();

  try {
    const existing = await new Promise(r => db.get('SELECT id FROM payments WHERE id = ?', [id], (e, row) => r(row)));
    if (existing) return res.json({ success: true });

    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO payments (id, order_id, collector_id, payment_method, amount, collected_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, order_id, collector_id, payment_method, amount, collected_at || horaCol, horaCol],
        (err) => err ? reject(err) : resolve()
      );
    });

    await new Promise(r => db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', ['PAID', horaCol, order_id], r));

    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO transactions (type, category, description, amount, user_name, created_at) VALUES ('Ingreso', 'Cobro Ruta', ?, ?, ?, ?)`,
        [`Cobro Preventa #${order_id.substring(0, 8)} (${payment_method})`, amount, collector_id, horaCol],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({ success: true, paymentId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- USUARIOS, LOGIN ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT id, name, username, role FROM users WHERE LOWER(username) = LOWER(?) AND password = ?',
    [username.trim(), password.trim()],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      res.json({ success: true, user });
    }
  );
});

app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, username, password, role FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});
app.post('/api/users', (req, res) => {
  const { name, username, password, role } = req.body;
  db.run('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)',
    [name.trim(), username.trim().toLowerCase(), password.trim(), role || 'Cajero'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, userId: this.lastID });
    }
  );
});
app.delete('/api/users/:id', (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- RUTINAS ESTANDAR ---
app.get('/api/shifts', (req, res) => {
  db.all('SELECT * FROM shifts ORDER BY id DESC', [], (err, rows) => res.json(rows || []));
});
app.get('/api/shifts/active', (req, res) => {
  const userName = req.query.user_name ? req.query.user_name.trim() : null;
  const query = userName ? "SELECT * FROM shifts WHERE LOWER(user_name) = LOWER(?) AND status = 'abierto' ORDER BY id DESC LIMIT 1" : "SELECT * FROM shifts WHERE status = 'abierto' ORDER BY id DESC LIMIT 1";
  db.get(query, userName ? [userName] : [], (err, row) => res.json(row || null));
});
app.post('/api/shifts/open', (req, res) => {
  const { user_name, start_amount } = req.body;
  db.run("INSERT INTO shifts (user_name, start_amount, status, opened_at) VALUES (?, ?, 'abierto', ?)", [user_name, parseFloat(start_amount) || 0, getColombiaTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, shiftId: this.lastID });
  });
});
app.post('/api/shifts/close', (req, res) => {
  const { shift_id } = req.body;
  const horaCol = getColombiaTimestamp();
  db.get('SELECT * FROM shifts WHERE id = ?', [shift_id], (errShift, shift) => {
    if (!shift) return res.status(500).json({ error: 'Turno no encontrado' });
    db.all(`SELECT payment_method, SUM(total) as total_sales FROM sales WHERE shift_id = ? GROUP BY payment_method`, [shift_id], (err, rows) => {
      let cashSales = 0; let transferSales = 0;
      if (rows) rows.forEach((r) => { if (r.payment_method === 'Efectivo') cashSales += r.total_sales; else transferSales += r.total_sales; });
      const totalSales = cashSales + transferSales;
      const totalCashInBox = (shift.start_amount || 0) + cashSales;
      db.run(`UPDATE shifts SET status = 'cerrado', end_amount = ?, cash_sales = ?, transfer_sales = ?, total_sales = ?, closed_at = ? WHERE id = ?`,
        [totalCashInBox, cashSales, transferSales, totalSales, horaCol, shift_id],
        function (errClose) { res.json({ success: true, summary: { start_amount: shift.start_amount, cash_sales: cashSales, transfer_sales: transferSales, total_sales: totalSales, end_amount: totalCashInBox } }); }
      );
    });
  });
});

app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY CAST(barcode AS INTEGER) ASC', [], (err, rows) => res.json(rows || []));
});
app.post('/api/products', (req, res) => {
  const { barcode, name, sale_price, wholesale_price, stock, min_stock } = req.body;
  db.run(`INSERT INTO products (barcode, name, sale_price, wholesale_price, stock, min_stock) VALUES (?, ?, ?, ?, ?, ?)`,
    [barcode, name, sale_price || 0, wholesale_price || 0, stock || 0, min_stock || 3], function (err) {
      if (err) return res.status(500).json({ error: err.message }); res.json({ success: true });
    });
});
app.put('/api/products/:barcode', (req, res) => {
  const { name, sale_price, wholesale_price, stock, min_stock } = req.body;
  db.run(`UPDATE products SET name = ?, sale_price = ?, wholesale_price = ?, stock = ?, min_stock = ? WHERE barcode = ?`,
    [name, sale_price || 0, wholesale_price || 0, stock || 0, min_stock || 3, req.params.barcode], function (err) {
      if (err) return res.status(500).json({ error: err.message }); res.json({ success: true });
    });
});
app.delete('/api/products/:barcode', (req, res) => {
  db.run('DELETE FROM products WHERE barcode = ?', [req.params.barcode], function (err) {
    if (err) return res.status(500).json({ error: err.message }); res.json({ success: true });
  });
});

app.post('/api/sales', async (req, res) => {
  const { shift_id, user_name, customer_doc, customer_name, items, description, total, payment_method, amount_paid, change_given } = req.body;
  const invNumber = `TF-${Date.now().toString().slice(-6)}`;
  const horaCol = getColombiaTimestamp();
  try {
    const saleRes = await new Promise((resolve, reject) => {
      db.run(`INSERT INTO sales (shift_id, user_name, invoice_number, customer_doc, customer_name, subtotal, tax_amount, total, payment_method, amount_paid, change_given, sale_type, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'Facturada', ?)`,
        [shift_id || null, user_name, invNumber, customer_doc, customer_name, total, total, payment_method, amount_paid, change_given, horaCol],
        function (err) { err ? reject(err) : resolve(this); }
      );
    });
    for (const item of items) {
      await new Promise((r) => db.run('UPDATE products SET stock = stock - ? WHERE barcode = ?', [item.quantity, item.barcode], r));
      await new Promise((r) => db.run('INSERT INTO sale_items (sale_id, product_barcode, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)', [saleRes.lastID, item.barcode, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price], r));
    }
    await new Promise((r) => db.run(`INSERT INTO transactions (type, category, description, amount, user_name, created_at) VALUES ('Ingreso', 'Venta POS', ?, ?, ?, ?)`, [`Venta POS Factura #${invNumber}`, total, user_name, horaCol], r));
    return res.json({ success: true, invoice_number: invNumber });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY id DESC', [], (err, rows) => res.json(rows || []));
});
app.post('/api/transactions', (req, res) => {
  const { type, category, description, amount, user_name } = req.body;
  db.run(`INSERT INTO transactions (type, category, description, amount, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [type, category, description, amount, user_name, getColombiaTimestamp()], function (err) {
      if (err) return res.status(500).json({ error: err.message }); res.json({ success: true });
    });
});
app.delete('/api/transactions/:id', (req, res) => {
  db.run('DELETE FROM transactions WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

app.get('/api/config', (req, res) => {
  db.all('SELECT * FROM config', [], (err, rows) => {
    const configObj = { razon_social: 'TERRA FRUTOS SECOS', nit: '40044029-8', direccion: 'Cra 7 #15-63, Tunja, Boyacá', telefono: '3183142180', actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR', footer_msg: '¡Gracias por su compra!' };
    if (rows) rows.forEach((r) => configObj[r.key] = r.value);
    res.json(configObj);
  });
});
app.post('/api/config', (req, res) => {
  const config = req.body;
  let completed = 0;
  Object.keys(config).forEach((key) => {
    db.run(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, config[key]], () => {
      completed++; if (completed === Object.keys(config).length) res.json({ success: true });
    });
  });
});

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor Backend ejecutándose en el puerto ${PORT}`));