const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const db = require('./database');

const app = express();

app.use(cors());
app.use(express.json());

// Generación del PDF en memoria (Buffer)
function createInvoicePDFBuffer(invoice, config) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    const buffers = [];

    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Encabezado
    doc.fontSize(16).font('Helvetica-Bold').text(config.razon_social || 'TERRA FRUTOS SECOS', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(config.actividad || '', { align: 'center' });
    doc.text(`NIT: ${config.nit || ''} | TEL: ${config.telefono || ''}`, { align: 'center' });
    doc.text(config.direccion || '', { align: 'center' });
    doc.moveDown(0.5);
    doc.text('----------------------------------------------------------------------------------------------------', { align: 'center' });
    doc.moveDown(0.5);

    // Datos de la factura
    doc.fontSize(10).font('Helvetica-Bold').text(`FACTURA POS: #${invoice.invoice_number}`);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Fecha: ${new Date().toLocaleString('es-CO')}`);
    doc.text(`Cliente: ${invoice.customer_name || 'Consumidor Final'} (Doc: ${invoice.customer_doc || '222222222222'})`);
    doc.text(`Atendido por: ${invoice.user_name}`);
    doc.text(`Método de Pago: ${invoice.payment_method}`);
    doc.moveDown(0.8);

    // Tabla de productos
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

    // Totales
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

// Envío de correo mediante API HTTP de Brevo (Puerto 443 HTTPS - Cero bloqueos)
async function sendInvoiceByBrevo(toEmail, customerName, invoiceNumber, total, pdfBuffer, config) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('BREVO_API_KEY no está configurada en Render.');
    return;
  }

  const payload = {
    sender: {
      name: config.razon_social || 'TERRA FRUTOS SECOS',
      email: process.env.EMAIL_USER || 'terratunja2026@gmail.com'
    },
    to: [
      {
        email: toEmail,
        name: customerName || 'Cliente'
      }
    ],
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
    attachment: [
      {
        name: `Factura_${invoiceNumber}.pdf`,
        content: pdfBuffer.toString('base64')
      }
    ]
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey.trim(),
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(result));
  }
  console.log(`Factura #${invoiceNumber} enviada por Brevo HTTP API a: ${toEmail}`);
}

// Ping keep-alive
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Descarga respaldo local
app.get('/api/backup-db', (req, res) => {
  try {
    const possiblePaths = [
      path.join(__dirname, 'pos.db'),
      path.join(__dirname, '../pos.db'),
      path.join(process.cwd(), 'pos.db')
    ];

    let foundPath = possiblePaths.find((p) => fs.existsSync(p));

    if (!foundPath) {
      return res.status(404).send('<h1>Base de datos en la nube (Turso) activa.</h1>');
    }

    const fileBuffer = fs.readFileSync(foundPath);
    const fileName = `pos_backup_${new Date().toISOString().slice(0, 10)}.db`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBuffer);
  } catch (error) {
    console.error('Error al descargar respaldo:', error);
    return res.status(500).send('Error interno del servidor.');
  }
});

// Frontend estático
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

// --- USUARIOS ---
app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, username, role FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/users', (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Todos los campos son obligatorios' });

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

// --- TURNOS ---
app.get('/api/shifts', (req, res) => {
  db.all('SELECT * FROM shifts ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/shifts/active', (req, res) => {
  const userName = req.query.user_name ? req.query.user_name.trim() : null;
  const query = userName
    ? "SELECT * FROM shifts WHERE LOWER(user_name) = LOWER(?) AND status = 'abierto' ORDER BY id DESC LIMIT 1"
    : "SELECT * FROM shifts WHERE status = 'abierto' ORDER BY id DESC LIMIT 1";

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
    "INSERT INTO shifts (user_name, start_amount, status) VALUES (?, ?, 'abierto')",
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
            if (r.payment_method === 'Efectivo') cashSales += r.total_sales || 0;
            else transferSales += r.total_sales || 0;
          });
        }

        const totalSales = cashSales + transferSales;
        const startBase = shift.start_amount || 0;
        const totalCashInBox = startBase + cashSales;

        db.run(
          `UPDATE shifts SET status = 'cerrado', end_amount = ?, cash_sales = ?, transfer_sales = ?, total_sales = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [totalCashInBox, cashSales, transferSales, totalSales, shift_id],
          function (errClose) {
            if (errClose) return res.status(500).json({ error: errClose.message });
            res.json({
              success: true,
              summary: {
                shift_id,
                start_amount: startBase,
                startBase,
                cash_sales: cashSales,
                cashSales,
                transfer_sales: transferSales,
                transferSales,
                total_sales: totalSales,
                totalSales,
                end_amount: totalCashInBox,
                totalCashInBox,
                cash_in_hand: totalCashInBox
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
    res.json(rows || []);
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

// --- VENTAS Y ENVÍO DE FACTURA HTTP ---
app.post('/api/sales', async (req, res) => {
  const {
    shift_id,
    user_name,
    customer_doc,
    customer_name,
    customer_email,
    items,
    description,
    total,
    payment_method,
    amount_paid,
    change_given,
    sale_type
  } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ error: 'Carrito vacío' });

  const prefijo = 'TF';
  const invNumber = `${prefijo}-${Date.now().toString().slice(-6)}`;
  const txDescription = description || `Venta POS Factura #${invNumber} (${payment_method})`;

  try {
    const saleRes = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO sales (shift_id, user_name, invoice_number, customer_doc, customer_name, subtotal, tax_amount, total, payment_method, amount_paid, change_given, sale_type)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          shift_id || null,
          user_name || 'ANTHONY CARDENAS',
          invNumber,
          customer_doc || '222222222222',
          customer_name || 'Consumidor Final',
          total,
          total,
          payment_method || 'Efectivo',
          amount_paid || total,
          change_given || 0,
          sale_type || 'Facturada'
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });

    const saleId = saleRes.lastID;

    for (const item of items) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE products SET stock = stock - ? WHERE barcode = ?', [item.quantity, item.barcode], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO sale_items (sale_id, product_barcode, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
          [saleId, item.barcode, item.name, item.quantity, item.sale_price, item.quantity * item.sale_price],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transactions (type, category, description, amount, user_name) VALUES ('Ingreso', 'Venta POS', ?, ?, ?)`,
        [txDescription, total, user_name || 'ANTHONY CARDENAS'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Envío seguro por HTTP API en segundo plano
    if (customer_email && customer_email.trim()) {
      (async () => {
        try {
          const rows = await new Promise((r) => db.all('SELECT * FROM config', [], (e, d) => r(d || [])));
          const configObj = {
            razon_social: 'TERRA FRUTOS SECOS',
            nit: '40044029-8',
            direccion: 'Cra 7 #15-63, Tunja, Boyacá',
            telefono: '3183142180',
            actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR',
            footer_msg: '¡Gracias por su compra!'
          };
          rows.forEach((row) => {
            configObj[row.key] = row.value;
          });

          const pdfBuffer = await createInvoicePDFBuffer(
            {
              invoice_number: invNumber,
              customer_name,
              customer_doc,
              user_name: user_name || 'ANTHONY CARDENAS',
              payment_method: payment_method || 'Efectivo',
              items,
              total,
              amount_paid: amount_paid || total,
              change_given: change_given || 0
            },
            configObj
          );

          await sendInvoiceByBrevo(
            customer_email.trim(),
            customer_name,
            invNumber,
            total,
            pdfBuffer,
            configObj
          );
        } catch (emailErr) {
          console.error('Error enviando correo por Brevo HTTP API:', emailErr.message);
        }
      })();
    }

    return res.json({ success: true, saleId, invoice_number: invNumber });
  } catch (err) {
    console.error('Error procesando la venta:', err);
    return res.status(500).json({ error: err.message || 'Error procesando la venta' });
  }
});

// --- CONTABILIDAD ---
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
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    return res.status(400).json({ error: 'ID de movimiento inválido' });
  }

  db.get('SELECT * FROM transactions WHERE id = ?', [numericId], (err, tx) => {
    if (err || !tx) return res.status(400).json({ error: 'Movimiento no encontrado' });

    if (tx.category === 'Venta POS' && tx.description.includes('Factura #')) {
      const parts = tx.description.split('Factura #');
      if (parts[1]) {
        const invNumber = parts[1].split(' ')[0].trim().replace(/[^a-zA-Z0-9-]/g, '');

        db.get('SELECT id FROM sales WHERE invoice_number = ?', [invNumber], (errSale, sale) => {
          if (sale && sale.id) {
            db.all('SELECT product_barcode, quantity FROM sale_items WHERE sale_id = ?', [sale.id], (errItems, items) => {
              if (items && items.length > 0) {
                items.forEach((item) => {
                  db.run('UPDATE products SET stock = stock + ? WHERE barcode = ?', [item.quantity, item.product_barcode]);
                });
              }
              db.run('DELETE FROM sale_items WHERE sale_id = ?', [sale.id], () => {
                db.run('DELETE FROM sales WHERE id = ?', [sale.id], () => {
                  db.run('DELETE FROM transactions WHERE id = ?', [numericId], (errDel) => {
                    if (errDel) return res.status(500).json({ error: errDel.message });
                    return res.json({ success: true });
                  });
                });
              });
            });
          } else {
            db.run('DELETE FROM transactions WHERE id = ?', [numericId], (errDel) => {
              if (errDel) return res.status(500).json({ error: errDel.message });
              return res.json({ success: true });
            });
          }
        });
        return;
      }
    }

    db.run('DELETE FROM transactions WHERE id = ?', [numericId], function (errDel) {
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
      rows.forEach((r) => {
        configObj[r.key] = r.value;
      });
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
      () => {
        completed++;
        if (completed === keys.length) {
          res.json({ success: true });
        }
      }
    );
  });
});

// Comodín React
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Backend ejecutándose en el puerto ${PORT}`);
});