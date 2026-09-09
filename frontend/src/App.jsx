import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

export default function App() {
  // Mantener el servidor de Render activo
  useEffect(() => {
    const keepAliveInterval = setInterval(() => {
      fetch(`${API_URL}/api/ping`).catch(err => console.log('Ping fallido:', err));
    }, 5 * 60 * 1000);

    return () => clearInterval(keepAliveInterval);
  }, []);

  // Estados generales
  const [currentUser, setCurrentUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftBaseInput, setShiftBaseInput] = useState('');
  const [activeTab, setActiveTab] = useState('pos');

  // Configuración de Tienda / DIAN / Recibo
  const [storeConfig, setStoreConfig] = useState({
    razon_social: 'TERRA FRUTOS SECOS',
    nit: '40044029-8',
    direccion: 'Cra 7 #15-63, Tunja, Boyacá',
    telefono: '3183142180',
    actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR',
    footer_msg: '¡Gracias por su compra!'
  });

  const [lastInvoice, setLastInvoice] = useState(null);

  // Login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // POS / Ventas
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerDoc, setCustomerDoc] = useState('222222222222');
  const [customerName, setCustomerName] = useState('Consumidor Final');

  // Inventario y Agotados
  const [invSearch, setInvSearch] = useState('');
  const [outSearch, setOutSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProd, setNewProd] = useState({ barcode: '', name: '', sale_price: '', stock: '', min_stock: '3' });

  // Contabilidad
  const [transactions, setTransactions] = useState([]);
  const [showTxModal, setShowTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'Ingreso', category: 'Varios', description: '', amount: '' });

  // Empleados
  const [usersList, setUsersList] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Cajero' });

  // Reportes
  const [shiftsList, setShiftsList] = useState([]);
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [printShiftData, setPrintShiftData] = useState(null);

  // Cargar usuario guardado
  useEffect(() => {
    const savedUser = localStorage.getItem('pos_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
      } catch (e) {
        localStorage.removeItem('pos_user');
      }
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    if (currentUser) {
      checkActiveShift(currentUser.name);
      loadConfig();
      loadProducts();
      loadTransactions();
      loadUsers();
      loadShifts();
    }
  }, [currentUser]);

  // --- MÉTODOS DE API ---
  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setStoreConfig(prev => ({ ...prev, ...data }));
      }
    } catch (e) { console.error('Error cargando configuración:', e); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeConfig)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('⚙️ Configuración del Recibo y DIAN actualizada correctamente');
      } else {
        alert('⚠️ Error al guardar la configuración');
      }
    } catch (e) { alert('Error conectando con el servidor'); }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`);
      if (res.ok) setProducts(await res.json());
    } catch (e) { console.error('Error cargando productos:', e); }
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/transactions`);
      if (res.ok) setTransactions(await res.json());
    } catch (e) { console.error('Error cargando transacciones:', e); }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      if (res.ok) setUsersList(await res.json());
    } catch (e) { console.error('Error cargando usuarios:', e); }
  };

  const loadShifts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/shifts`);
      if (res.ok) setShiftsList(await res.json());
    } catch (e) { console.error('Error cargando turnos:', e); }
  };

  const checkActiveShift = async (userName) => {
    try {
      const res = await fetch(`${API_URL}/api/shifts/active?user_name=${encodeURIComponent(userName)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data);
      } else {
        setActiveShift(null);
      }
    } catch (e) { console.error('Error verificando turno:', e); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (e) { setLoginError('Error de conexión con el servidor'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('pos_user');
    setCurrentUser(null);
    setActiveShift(null);
    setCart([]);
  };

  const handleOpenShift = async () => {
    const baseValue = parseFloat(shiftBaseInput) || 0;
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: currentUser.name, start_amount: baseValue })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowShiftModal(false);
        setShiftBaseInput('');
        checkActiveShift(currentUser.name);
        loadShifts();
        alert(`☀️ Turno iniciado con base de $${baseValue.toLocaleString()}`);
      }
    } catch (e) { alert('Error al abrir el turno'); }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (!window.confirm('¿Desea cerrar el turno actual?')) return;

    try {
      const res = await fetch(`${API_URL}/api/shifts/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: activeShift.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShiftSummary(data.summary);
        setActiveShift(null);
        loadShifts();
      } else {
        alert('⚠️ No se pudo cerrar el turno');
      }
    } catch (e) { alert('Error al cerrar el turno'); }
  };

  // --- CARRITO Y VENTAS ---
  const addToCart = (p) => {
    if (!activeShift) { alert('⚠️ Debe iniciar un turno para poder vender.'); setShowShiftModal(true); return; }
    const exist = cart.find(x => x.barcode === p.barcode);
    if (exist) {
      setCart(cart.map(x => x.barcode === p.barcode ? { ...x, quantity: x.quantity + 1 } : x));
    } else {
      setCart([...cart, { ...p, quantity: 1 }]);
    }
  };

  const updateQty = (barcode, qty) => {
    if (qty <= 0) setCart(cart.filter(x => x.barcode !== barcode));
    else setCart(cart.map(x => x.barcode === barcode ? { ...x, quantity: qty } : x));
  };

  const removeFromCart = (barcode) => {
    setCart(cart.filter(x => x.barcode !== barcode));
  };

  const totalCart = cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const received = parseFloat(amountPaid) || totalCart;
  const changeGiven = received >= totalCart ? received - totalCart : 0;

  const handleProcessSale = async (saleType) => {
    if (cart.length === 0) return alert('El carrito está vacío');
    try {
      const res = await fetch(`${API_URL}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: activeShift?.id || null,
          user_name: currentUser.name,
          customer_doc: customerDoc,
          customer_name: customerName,
          items: cart,
          total: totalCart,
          payment_method: paymentMethod,
          amount_paid: received,
          change_given: changeGiven,
          sale_type: saleType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invoiceData = {
          number: data.invoice_number,
          date: new Date().toLocaleString(),
          customerDoc,
          customerName,
          items: [...cart],
          total: totalCart,
          paymentMethod,
          received,
          changeGiven,
          seller: currentUser.name
        };

        setLastInvoice(invoiceData);
        alert(`✅ Venta Registrada con Éxito. Factura #: ${data.invoice_number}`);

        if (saleType === 'Facturada') {
          setTimeout(() => window.print(), 300);
        }

        setCart([]);
        setAmountPaid('');
        loadProducts();
        loadTransactions();
      } else {
        alert(`⚠️ ${data.error || 'Error procesando la venta'}`);
      }
    } catch (e) { alert('Error de conexión al registrar la venta'); }
  };

  // --- ACCIONES DE INVENTARIO Y OTROS ---
  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProd)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ Producto registrado correctamente');
        setNewProd({ barcode: '', name: '', sale_price: '', stock: '', min_stock: '3' });
        setShowAddModal(false);
        loadProducts();
      } else { alert(`⚠️ ${data.error}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/products/${editingProduct.barcode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ Producto actualizado correctamente');
        setEditingProduct(null);
        loadProducts();
      } else { alert(`⚠️ ${data.error}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleDeleteProduct = async (barcode, name) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar "${name}" (CÓD: ${barcode})?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/products/${barcode}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('🗑️ Producto eliminado correctamente');
        loadProducts();
      } else { alert(`⚠️ ${data.error}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.amount || parseFloat(newTx.amount) <= 0) return alert('Monto inválido');

    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTx, user_name: currentUser.name })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ ${newTx.type} registrado correctamente`);
        setNewTx({ type: 'Ingreso', category: 'Varios', description: '', amount: '' });
        setShowTxModal(false);
        loadTransactions();
      } else { alert(`⚠️ ${data.error}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleDeleteTransaction = async (id, description, category) => {
    const isSale = category === 'Venta POS';
    const msg = isSale
      ? `¿Desea anular la venta "${description}"? Esto eliminará el ingreso contable y repondrá las unidades vendidas al stock.`
      : `¿Está seguro de eliminar el registro contable "${description}"?`;

    if (!window.confirm(msg)) return;

    try {
      const res = await fetch(`${API_URL}/api/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('🗑️ Registro eliminado correctamente');
        loadTransactions();
        loadProducts();
      } else { alert(`⚠️ ${data.error || 'Error al eliminar el registro'}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('👤 Empleado / Usuario creado correctamente');
        setNewUser({ name: '', username: '', password: '', role: 'Cajero' });
        setShowUserModal(false);
        loadUsers();
      } else { alert(`⚠️ ${data.error || 'Error al registrar usuario'}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleDeleteUser = async (id, name) => {
    if (currentUser.id === id) return alert('⚠️ No puedes eliminar tu propio usuario actual');
    if (!window.confirm(`¿Está seguro de eliminar al usuario "${name}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('🗑️ Usuario eliminado correctamente');
        loadUsers();
      } else { alert(`⚠️ ${data.error || 'Error al eliminar usuario'}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  // Cálculos de reportes y contabilidad
  const filteredDailyShifts = shiftsList.filter(s => {
    const matchesUser = filterUser ? s.user_name.toLowerCase().includes(filterUser.toLowerCase()) : true;
    const matchesDate = filterDate ? (s.opened_at && s.opened_at.startsWith(filterDate)) : true;
    return matchesUser && matchesDate;
  });

  const monthlyShifts = shiftsList.filter(s => s.opened_at && s.opened_at.startsWith(selectedMonth));
  const monthlyCash = monthlyShifts.reduce((acc, s) => acc + (s.cash_sales || 0), 0);
  const monthlyTransfer = monthlyShifts.reduce((acc, s) => acc + (s.transfer_sales || 0), 0);
  const monthlyTotal = monthlyShifts.reduce((acc, s) => acc + (s.total_sales || 0), 0);

  const handlePrintShiftReport = (shift) => {
    setPrintShiftData(shift);
    setTimeout(() => window.print(), 300);
  };

  const totalIncomes = transactions.filter(t => t.type === 'Ingreso').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'Egreso').reduce((acc, t) => acc + (t.amount || 0), 0);
  const netBalance = totalIncomes - totalExpenses;
  const inventoryValue = products.reduce((acc, p) => acc + ((p.sale_price || 0) * (p.stock || 0)), 0);

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "FECHA,TIPO,CATEGORIA,DESCRIPCION,MONTO,USUARIO\n";

    transactions.forEach(t => {
      csvContent += `"${t.created_at}","${t.type}","${t.category}","${t.description}",${t.amount},"${t.user_name}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Contable_TerraFrutosSecos_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- VISTA LOGIN ---
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121824' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', color: '#fff', width: '320px' }}>
          <h2 style={{ color: '#38bdf8', textAlign: 'center' }}>🌱 TERRA FRUTOS SECOS</h2>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>Sistema POS e Inventario</p>
          {loginError && <div style={{ background: '#f87171', color: '#7f1d1d', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>⚠️ {loginError}</div>}
          <label style={{ fontSize: '0.85rem' }}>Usuario:</label>
          <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0 1rem 0', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} required />
          <label style={{ fontSize: '0.85rem' }}>Contraseña:</label>
          <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0 1rem 0', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} required />
          <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🔑 INICIAR SESIÓN</button>
        </form>
      </div>
    );
  }

  const isAdmin = currentUser.role?.toLowerCase() === 'administrador';

  return (
    <>
      {/* VISTA DE IMPRESIÓN IMPERCEPTIBLE EN PANTALLA */}
      <div id="print-receipt" className="print-only">
        {printShiftData ? (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', margin: '0 0 2px 0', fontSize: '12px' }}>🌱 {storeConfig.razon_social}</h3>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '9px', fontWeight: 'bold' }}>REPORTE DE TURNO #{printShiftData.id}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '1px 0' }}>Empleado: <strong>{printShiftData.user_name}</strong></p>
            <p style={{ margin: '1px 0' }}>Apertura: {printShiftData.opened_at}</p>
            <p style={{ margin: '1px 0' }}>Cierre: {printShiftData.closed_at || 'En curso'}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base Inicial:</span><span>${printShiftData.start_amount?.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ventas Efectivo:</span><span>${printShiftData.cash_sales?.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ventas Transferencia:</span><span>${printShiftData.transfer_sales?.toLocaleString()}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}>
              <span>TOTAL VENDIDO:</span>
              <span>${printShiftData.total_sales?.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}>
              <span>TOTAL EN CAJA:</span>
              <span>${printShiftData.end_amount?.toLocaleString()}</span>
            </div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
          </div>
        ) : lastInvoice ? (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', margin: '0 0 2px 0', fontSize: '12px' }}>🌱 {storeConfig.razon_social}</h3>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '8px' }}>{storeConfig.actividad}</p>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '8px' }}>{storeConfig.direccion}</p>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '8px' }}>TEL: {storeConfig.telefono}</p>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '8px' }}>NIT: {storeConfig.nit}</p>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '8px' }}>Doc. POS - Sistema Local</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '1px 0' }}>Factura #: <strong>{lastInvoice.number}</strong></p>
            <p style={{ margin: '1px 0' }}>Fecha: {lastInvoice.date}</p>
            <p style={{ margin: '1px 0' }}>Atendido por: {lastInvoice.seller}</p>
            <p style={{ margin: '1px 0' }}>Cliente: {lastInvoice.customerName}</p>
            <p style={{ margin: '1px 0' }}>NIT/CC: {lastInvoice.customerDoc}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <tbody>
                {lastInvoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ verticalAlign: 'top', padding: '1px 0' }}>
                      {it.quantity}x {it.name.substring(0, 16)}
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '1px 0', fontWeight: 'bold' }}>
                      ${(it.quantity * it.sale_price).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}>
              <span>TOTAL:</span>
              <span>${lastInvoice.total.toLocaleString()}</span>
            </div>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Pago: {lastInvoice.paymentMethod}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Recibido: ${lastInvoice.received.toLocaleString()}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Devueltas: ${lastInvoice.changeGiven.toLocaleString()}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ textAlign: 'center', margin: '4px 0 0 0', fontSize: '9px' }}>{storeConfig.footer_msg}</p>
          </div>
        ) : null}
      </div>

      {/* VISTA PRINCIPAL DEL SISTEMA POS */}
      <div className="no-print" style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        {/* BARRA LATERAL (SIDEBAR) */}
        <div style={{ width: '240px', background: '#1e293b', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid #334155' }}>
          <div>
            <h3 style={{ color: '#38bdf8', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>🌱 {storeConfig.razon_social}</h3>
            <div style={{ background: '#0f172a', padding: '0.6rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>USUARIO ACTIVO:</span><br />
              <strong>{currentUser.name}</strong><br />
              <span style={{ color: '#38bdf8' }}>🔑 {currentUser.role}</span>
            </div>

            {!activeShift ? (
              <button onClick={() => setShowShiftModal(true)} style={{ width: '100%', padding: '0.6rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1.5rem' }}>
                ▶️ Iniciar Turno / Base
              </button>
            ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ background: '#166534', color: '#4ade80', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  🟢 Turno Activo (#{activeShift.id})
                </div>
                <button onClick={handleCloseShift} style={{ width: '100%', padding: '0.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                  🔴 Terminar Turno
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <button onClick={() => setActiveTab('pos')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'pos' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>💳 POS / Caja</button>
              {isAdmin && (
                <>
                  <button onClick={() => setActiveTab('inventory')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'inventory' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📦 Inventario</button>
                  <button onClick={() => setActiveTab('out_of_stock')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'out_of_stock' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>⚠️ Agotados</button>
                  <button onClick={() => setActiveTab('accounting')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'accounting' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📈 Contabilidad</button>
                  <button onClick={() => setActiveTab('employees')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'employees' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>👥 Empleados</button>
                  <button onClick={() => setActiveTab('reports')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'reports' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📊 Reportes</button>
                  <button onClick={() => setActiveTab('dian')} style={{ padding: '0.6rem', textAlign: 'left', background: activeTab === 'dian' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>⚙️ Configuración DIAN</button>
                </>
              )}
            </div>
          </div>

          <button onClick={handleLogout} style={{ width: '100%', padding: '0.6rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔒 Cerrar Sesión</button>
        </div>

        {/* ÁREA PRINCIPAL DE TRABAJO */}
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {/* TAB: POS / CAJA */}
          {activeTab === 'pos' && (
            <div style={{ display: 'flex', gap: '1.25rem', height: '100%' }}>
              {/* Lado Izquierdo: Buscador y Grilla de Productos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar por código o nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', paddingRight: '4px' }}>
                  {products
                    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
                    .map(p => (
                      <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '6px', border: '1px solid #334155', cursor: 'pointer', transition: 'all 0.15s ease' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CÓD: {p.barcode}</span>
                        <h4 style={{ margin: '0.35rem 0', fontSize: '0.95rem', lineHeight: '1.2' }}>{p.name}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                          <strong style={{ color: '#22c55e', fontSize: '1.05rem' }}>${p.sale_price?.toLocaleString()}</strong>
                          <span style={{ fontSize: '0.75rem', background: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Stock: {p.stock}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Lado Derecho: Carrito de Venta Más Grande (Ancho ampliado a 440px) */}
              <div style={{ width: '440px', background: '#1e293b', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)' }}>
                <div>
                  <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.2rem', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '0.6rem' }}>
                    🛒 Carrito de Venta ({cart.length})
                  </h3>

                  {/* Datos del Cliente */}
                  <div style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>
                    <label style={{ color: '#94a3b8', fontWeight: 'bold' }}>CLIENTE:</label>
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem' }}>
                      <input
                        type="text"
                        value={customerDoc}
                        onChange={(e) => setCustomerDoc(e.target.value)}
                        placeholder="NIT / CC"
                        style={{ width: '45%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nombre"
                        style={{ width: '55%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {/* Lista de Items en Carrito */}
                  <div style={{ maxHeight: 'calc(100vh - 420px)', minHeight: '180px', overflowY: 'auto', paddingRight: '6px' }}>
                    {cart.map(item => (
                      <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', background: '#0f172a', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid #1e293b' }}>
                        <div style={{ flex: 1, marginRight: '0.6rem' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong><br />
                          <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.85rem' }}>${(item.sale_price * item.quantity).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button onClick={() => updateQty(item.barcode, item.quantity - 1)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>-</button>
                          <span style={{ margin: '0 0.4rem', fontWeight: 'bold', fontSize: '0.95rem' }}>{item.quantity}</span>
                          <button onClick={() => updateQty(item.barcode, item.quantity + 1)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>+</button>
                          <button onClick={() => removeFromCart(item.barcode)} title="Eliminar producto" style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', marginLeft: '0.4rem', fontWeight: 'bold' }}>❌</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totales y Botones de Pago */}
                <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                    <span>Total:</span>
                    <span style={{ color: '#22c55e' }}>${totalCart.toLocaleString()}</span>
                  </div>

                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '0.6rem', borderRadius: '6px', fontSize: '0.95rem' }}
                  >
                    <option value="Efectivo">💵 Efectivo</option>
                    <option value="Nequi / Transferencia">📱 Nequi / Transferencia</option>
                  </select>

                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={`Recibido: $${totalCart.toLocaleString()}`}
                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '0.6rem', borderRadius: '6px', fontSize: '0.95rem' }}
                  />

                  <div style={{ fontSize: '0.95rem', marginBottom: '1.2rem', color: '#4ade80', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Devueltas:</span>
                    <strong>${changeGiven.toLocaleString()}</strong>
                  </div>

                  <button
                    onClick={() => handleProcessSale('Registrada')}
                    style={{ width: '100%', padding: '0.75rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '0.6rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
                  >
                    📑 Solo Registrar Venta
                  </button>

                  <button
                    onClick={() => handleProcessSale('Facturada')}
                    style={{ width: '100%', padding: '0.85rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                  >
                    🧾 Facturar e Imprimir DIAN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INVENTARIO (Ordenado por Stock Relativo al Mínimo) */}
          {activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📦 Gestión de Inventario ({products.length} productos)</h2>
                <button onClick={() => setShowAddModal(true)} style={{ padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ➕ Ingresar Nuevo Producto
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                ℹ️ Los productos están ordenados automáticamente mostrando primero aquellos con menor stock respecto a su mínimo establecido.
              </p>

              <input
                type="text"
                placeholder="🔍 Buscar por código o nombre de producto..."
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }}
              />

              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Código</th>
                    <th style={{ padding: '0.75rem' }}>Nombre del Producto</th>
                    <th style={{ padding: '0.75rem' }}>Precio de Venta</th>
                    <th style={{ padding: '0.75rem' }}>Stock Actual</th>
                    <th style={{ padding: '0.75rem' }}>Stock Mínimo</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter(p => p.name.toLowerCase().includes(invSearch.toLowerCase()) || p.barcode.includes(invSearch))
                    // Ordenamiento: Menor stock relativo al mínimo va arriba (stock - min_stock)
                    .sort((a, b) => (a.stock - (a.min_stock || 3)) - (b.stock - (b.min_stock || 3)))
                    .map(p => {
                      const minVal = p.min_stock || 3;
                      const isLow = p.stock <= minVal;
                      return (
                        <tr key={p.barcode} style={{ borderBottom: '1px solid #334155', background: isLow ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem' }}>{p.barcode}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {p.name} {isLow && <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold' }}>(⚠️ Stock Bajo)</span>}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>${p.sale_price?.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: isLow ? '#991b1b' : '#166534', fontWeight: 'bold' }}>
                              {p.stock}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem' }}>{minVal}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button onClick={() => setEditingProduct(p)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>✏️ Editar</button>
                            <button onClick={() => handleDeleteProduct(p.barcode, p.name)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Eliminar</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: AGOTADOS */}
          {activeTab === 'out_of_stock' && (
            <div>
              <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>⚠️ Productos Agotados o Stock Bajo</h2>
              <input
                type="text"
                placeholder="🔍 Buscar agotados por código o nombre..."
                value={outSearch}
                onChange={(e) => setOutSearch(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }}
              />
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Código</th>
                    <th style={{ padding: '0.75rem' }}>Nombre</th>
                    <th style={{ padding: '0.75rem' }}>Precio Venta</th>
                    <th style={{ padding: '0.75rem' }}>Stock Actual</th>
                    <th style={{ padding: '0.75rem' }}>Mínimo</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter(p => p.stock <= (p.min_stock || 3))
                    .filter(p => p.name.toLowerCase().includes(outSearch.toLowerCase()) || p.barcode.includes(outSearch))
                    .sort((a, b) => (a.stock - (a.min_stock || 3)) - (b.stock - (b.min_stock || 3)))
                    .map(p => (
                      <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem' }}>{p.barcode}</td>
                        <td style={{ padding: '0.75rem' }}>{p.name}</td>
                        <td style={{ padding: '0.75rem' }}>${p.sale_price?.toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', color: '#f87171', fontWeight: 'bold' }}>{p.stock}</td>
                        <td style={{ padding: '0.75rem' }}>{p.min_stock || 3}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button onClick={() => setEditingProduct(p)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>🔄 Reponer Stock</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: CONTABILIDAD */}
          {activeTab === 'accounting' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📈 Contabilidad y Caja General</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleExportCSV} style={{ padding: '0.6rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Exportar Excel (CSV)</button>
                  <button onClick={() => setShowTxModal(true)} style={{ padding: '0.6rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>➕ Nuevo Ingreso/Egreso</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TOTAL INGRESOS</span>
                  <h3 style={{ margin: '0.5rem 0 0 0', color: '#22c55e' }}>${totalIncomes.toLocaleString()}</h3>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TOTAL EGRESOS / GASTOS</span>
                  <h3 style={{ margin: '0.5rem 0 0 0', color: '#ef4444' }}>${totalExpenses.toLocaleString()}</h3>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>BALANCE NETO</span>
                  <h3 style={{ margin: '0.5rem 0 0 0', color: netBalance >= 0 ? '#38bdf8' : '#ef4444' }}>${netBalance.toLocaleString()}</h3>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #eab308' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>VALOR EN INVENTARIO</span>
                  <h3 style={{ margin: '0.5rem 0 0 0', color: '#eab308' }}>${inventoryValue.toLocaleString()}</h3>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Fecha</th>
                    <th style={{ padding: '0.75rem' }}>Tipo</th>
                    <th style={{ padding: '0.75rem' }}>Categoría</th>
                    <th style={{ padding: '0.75rem' }}>Descripción</th>
                    <th style={{ padding: '0.75rem' }}>Monto</th>
                    <th style={{ padding: '0.75rem' }}>Usuario</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{t.created_at}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: t.type === 'Ingreso' ? '#166534' : '#991b1b', fontSize: '0.8rem' }}>{t.type}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{t.category}</td>
                      <td style={{ padding: '0.75rem' }}>{t.description}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: t.type === 'Ingreso' ? '#22c55e' : '#ef4444' }}>${t.amount?.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{t.user_name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteTransaction(t.id, t.description, t.category)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          {t.category === 'Venta POS' ? '❌ Anular Venta' : '🗑️ Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: EMPLEADOS */}
          {activeTab === 'employees' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>👥 Gestión de Empleados y Usuarios</h2>
                <button onClick={() => setShowUserModal(true)} style={{ padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>➕ Registrar Nuevo Usuario</button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Nombre Completo</th>
                    <th style={{ padding: '0.75rem' }}>Nombre de Usuario</th>
                    <th style={{ padding: '0.75rem' }}>Rol</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem' }}><strong>{u.name}</strong></td>
                      <td style={{ padding: '0.75rem' }}>{u.username}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: u.role === 'Administrador' ? '#1e40af' : '#334155', fontSize: '0.8rem' }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteUser(u.id, u.name)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: REPORTES */}
          {activeTab === 'reports' && (
            <div>
              <h2 style={{ color: '#38bdf8', marginBottom: '1.5rem' }}>📊 Reportes de Turnos y Ventas</h2>

              {/* FILTROS DIARIOS */}
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#e2e8f0' }}>📅 Consulta de Turnos Diarios</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <input type="text" placeholder="Filtrar por nombre de cajero..." value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', flex: 1 }} />
                  <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#0f172a', borderRadius: '6px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#334155', textAlign: 'left', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.6rem' }}>ID</th>
                      <th style={{ padding: '0.6rem' }}>Cajero</th>
                      <th style={{ padding: '0.6rem' }}>Apertura</th>
                      <th style={{ padding: '0.6rem' }}>Cierre</th>
                      <th style={{ padding: '0.6rem' }}>Base</th>
                      <th style={{ padding: '0.6rem' }}>Efectivo</th>
                      <th style={{ padding: '0.6rem' }}>Transf.</th>
                      <th style={{ padding: '0.6rem' }}>Total Ventas</th>
                      <th style={{ padding: '0.6rem', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDailyShifts.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #1e293b', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.6rem' }}>#{s.id}</td>
                        <td style={{ padding: '0.6rem' }}><strong>{s.user_name}</strong></td>
                        <td style={{ padding: '0.6rem' }}>{s.opened_at}</td>
                        <td style={{ padding: '0.6rem' }}>{s.closed_at || 'En curso'}</td>
                        <td style={{ padding: '0.6rem' }}>${s.start_amount?.toLocaleString()}</td>
                        <td style={{ padding: '0.6rem', color: '#4ade80' }}>${s.cash_sales?.toLocaleString()}</td>
                        <td style={{ padding: '0.6rem', color: '#38bdf8' }}>${s.transfer_sales?.toLocaleString()}</td>
                        <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>${s.total_sales?.toLocaleString()}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                          <button onClick={() => handlePrintShiftReport(s)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>🖨️ Reimprimir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* RESUMEN MENSUAL */}
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: '#e2e8f0' }}>📆 Consolidados Mensuales</h4>
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: '0.4rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>VENTAS EFECTIVO DEL MES</span>
                    <h3 style={{ margin: '0.5rem 0 0 0', color: '#4ade80' }}>${monthlyCash.toLocaleString()}</h3>
                  </div>
                  <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>VENTAS TRANSFERENCIAS DEL MES</span>
                    <h3 style={{ margin: '0.5rem 0 0 0', color: '#38bdf8' }}>${monthlyTransfer.toLocaleString()}</h3>
                  </div>
                  <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #22c55e' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TOTAL FACTURADO EN EL MES</span>
                    <h3 style={{ margin: '0.5rem 0 0 0', color: '#22c55e' }}>${monthlyTotal.toLocaleString()}</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONFIGURACIÓN DIAN */}
          {activeTab === 'dian' && (
            <div style={{ maxWidth: '600px' }}>
              <h2 style={{ color: '#38bdf8', marginBottom: '1.5rem' }}>⚙️ Configuración del Negocio y Documento POS (DIAN)</h2>
              <form onSubmit={handleSaveConfig} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Razón Social / Nombre Comercial:</label>
                  <input type="text" value={storeConfig.razon_social} onChange={(e) => setStoreConfig({ ...storeConfig, razon_social: e.target.value })} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.2rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>NIT / Documento Identificación:</label>
                  <input type="text" value={storeConfig.nit} onChange={(e) => setStoreConfig({ ...storeConfig, nit: e.target.value })} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.2rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Dirección Física:</label>
                  <input type="text" value={storeConfig.direccion} onChange={(e) => setStoreConfig({ ...storeConfig, direccion: e.target.value })} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.2rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Teléfono de Contacto:</label>
                  <input type="text" value={storeConfig.telefono} onChange={(e) => setStoreConfig({ ...storeConfig, telefono: e.target.value })} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.2rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Actividad Económica / Texto Encabezado:</label>
                  <textarea value={storeConfig.actividad} onChange={(e) => setStoreConfig({ ...storeConfig, actividad: e.target.value })} rows={2} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.2rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mensaje del Pie de Página de Recibo:</label>
                  <input type="text" value={storeConfig.footer_msg} onChange={(e) => setStoreConfig({ ...storeConfig, footer_msg: e.target.value })} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.2rem' }} required />
                </div>
                <button type="submit" style={{ padding: '0.75rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>💾 Guardar Cambios en Servidor</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: APERTURA DE TURNO */}
      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>☀️ Abrir Turno de Caja</h3>
            <label style={{ fontSize: '0.85rem' }}>Monto Base Inicial en Caja ($):</label>
            <input type="number" value={shiftBaseInput} onChange={(e) => setShiftBaseInput(e.target.value)} placeholder="Ej: 50000" style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0 1rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleOpenShift} style={{ flex: 1, padding: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Iniciar</button>
              <button onClick={() => setShowShiftModal(false)} style={{ flex: 1, padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESUMEN DE CIERRE DE TURNO */}
      {shiftSummary && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '340px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#4ade80' }}>🔴 Turno Cerrado</h3>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Base Inicial:</span><span>${shiftSummary.start_amount?.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Ventas Efectivo:</span><span style={{ color: '#4ade80' }}>${shiftSummary.cash_sales?.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Ventas Transferencia:</span><span style={{ color: '#38bdf8' }}>${shiftSummary.transfer_sales?.toLocaleString()}</span></div>
              <hr style={{ borderColor: '#334155', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Total Vendido:</span><span>${shiftSummary.total_sales?.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#4ade80', marginTop: '0.4rem' }}><span>Efectivo en Caja:</span><span>${shiftSummary.end_amount?.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setShiftSummary(null)} style={{ width: '100%', padding: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Aceptar</button>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PRODUCTO */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveNewProduct} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>➕ Ingresar Producto</h3>
            <input type="text" placeholder="Código de Barras / ID" value={newProd.barcode} onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Nombre del Producto" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Precio de Venta ($)" value={newProd.sale_price} onChange={(e) => setNewProd({ ...newProd, sale_price: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Stock Inicial" value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Stock Mínimo (Alerta)" value={newProd.min_stock} onChange={(e) => setNewProd({ ...newProd, min_stock: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDITAR PRODUCTO */}
      {editingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleUpdateProduct} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>✏️ Editar / Reponer Stock</h3>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Código: {editingProduct.barcode}</label>
            <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Precio de Venta ($):</label>
            <input type="number" value={editingProduct.sale_price} onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stock Actual:</label>
            <input type="number" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stock Mínimo:</label>
            <input type="number" value={editingProduct.min_stock || 3} onChange={(e) => setEditingProduct({ ...editingProduct, min_stock: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.5rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Actualizar</button>
              <button type="button" onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NUEVA TRANSACCIÓN (CONTABILIDAD) */}
      {showTxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveTransaction} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>➕ Registro Contable</h3>
            <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Ingreso">🟢 Ingreso</option>
              <option value="Egreso">🔴 Egreso / Gasto</option>
            </select>
            <input type="text" placeholder="Categoría (Ej: Servicios, Proveedores, Varios)" value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Descripción breve" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Monto ($)" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
              <button type="button" onClick={() => setShowTxModal(false)} style={{ flex: 1, padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NUEVO EMPLEADO / USUARIO */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveUser} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>👤 Nuevo Usuario</h3>
            <input type="text" placeholder="Nombre Completo" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Usuario para Iniciar Sesión" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="password" placeholder="Contraseña" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Cajero">Cajero</option>
              <option value="Administrador">Administrador</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Crear Usuario</button>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}