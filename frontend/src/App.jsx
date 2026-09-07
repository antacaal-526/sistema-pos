import React, { useState, useEffect } from 'react';
import './App.css';

const API = `http://${window.location.hostname}:3000`;

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftBaseInput, setShiftBaseInput] = useState('');
  const [activeTab, setActiveTab] = useState('pos');

  // Datos de Configuración del Negocio
  const [storeConfig, setStoreConfig] = useState({
    razon_social: 'TERRA FRUTOS SECOS',
    nit: '40044029-8',
    direccion: 'Cra 7 #15-63, Tunja, Boyacá',
    telefono: '3183142180',
    actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR',
    footer_msg: '¡Gracias por su compra!'
  });

  // Datos de Factura para Impresión
  const [lastInvoice, setLastInvoice] = useState(null);

  // Login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Productos y Carrito POS
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

  // Reportes y Turnos
  const [shiftsList, setShiftsList] = useState([]);
  const [reportType, setReportType] = useState('daily');
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [printShiftData, setPrintShiftData] = useState(null);

  // Carga inicial y control de sesión activa
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

  // Carga de datos únicamente cuando hay un usuario autenticado
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

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setStoreConfig(prev => ({ ...prev, ...data }));
      }
    } catch (e) { console.error('Error cargando configuración:', e); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/config`, {
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
      const res = await fetch(`${API}/api/products`);
      if (res.ok) setProducts(await res.json());
    } catch (e) { console.error('Error cargando productos:', e); }
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch(`${API}/api/transactions`);
      if (res.ok) setTransactions(await res.json());
    } catch (e) { console.error('Error cargando transacciones:', e); }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API}/api/users`);
      if (res.ok) setUsersList(await res.json());
    } catch (e) { console.error('Error cargando usuarios:', e); }
  };

  const loadShifts = async () => {
    try {
      const res = await fetch(`${API}/api/shifts`);
      if (res.ok) setShiftsList(await res.json());
    } catch (e) { console.error('Error cargando turnos:', e); }
  };

  const checkActiveShift = async (userName) => {
    try {
      const res = await fetch(`${API}/api/shifts/active?user_name=${encodeURIComponent(userName)}`);
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
      const res = await fetch(`${API}/api/login`, {
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
      const res = await fetch(`${API}/api/shifts/open`, {
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
      const res = await fetch(`${API}/api/shifts/close`, {
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

  const totalCart = cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const received = parseFloat(amountPaid) || totalCart;
  const changeGiven = received >= totalCart ? received - totalCart : 0;

  const handleProcessSale = async (saleType) => {
    if (cart.length === 0) return alert('El carrito está vacío');
    try {
      const res = await fetch(`${API}/api/sales`, {
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

  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/products`, {
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
      const res = await fetch(`${API}/api/products/${editingProduct.barcode}`, {
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
      const res = await fetch(`${API}/api/products/${barcode}`, { method: 'DELETE' });
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
      const res = await fetch(`${API}/api/transactions`, {
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
      const res = await fetch(`${API}/api/transactions/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`${API}/api/users`, {
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
      const res = await fetch(`${API}/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('🗑️ Usuario eliminado correctamente');
        loadUsers();
      } else { alert(`⚠️ ${data.error || 'Error al eliminar usuario'}`); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

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

      <div className="no-print" style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
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

        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {activeTab === 'pos' && (
            <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
              <div style={{ flex: 1 }}>
                <input type="text" placeholder="🔍 Buscar por código o nombre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {products
                    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
                    .slice(0, 40)
                    .map(p => (
                      <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CÓD: {p.barcode}</span>
                        <h4 style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>{p.name}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <strong style={{ color: '#22c55e' }}>${p.sale_price?.toLocaleString()}</strong>
                          <span style={{ fontSize: '0.7rem', background: '#334155', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>Stock: {p.stock}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div style={{ width: '320px', background: '#1e293b', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 1rem 0' }}>🛒 Carrito de Venta</h3>
                  <div style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                    <label>CLIENTE:</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <input type="text" value={customerDoc} onChange={(e) => setCustomerDoc(e.target.value)} style={{ width: '50%', padding: '0.3rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '50%', padding: '0.3rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {cart.map(item => (
                      <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', background: '#0f172a', padding: '0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                        <div><strong>{item.name}</strong><br /><span style={{ color: '#22c55e' }}>${item.sale_price.toLocaleString()}</span></div>
                        <div>
                          <button onClick={() => updateQty(item.barcode, item.quantity - 1)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.1rem 0.4rem' }}>-</button>
                          <span style={{ margin: '0 0.4rem' }}>{item.quantity}</span>
                          <button onClick={() => updateQty(item.barcode, item.quantity + 1)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.1rem 0.4rem' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Total:</span><span style={{ color: '#22c55e' }}>${totalCart.toLocaleString()}</span>
                  </div>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '0.5rem' }}>
                    <option value="Efectivo">💵 Efectivo</option>
                    <option value="Nequi / Transferencia">📱 Nequi / Transferencia</option>
                  </select>
                  <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={`Recibido: $${totalCart.toLocaleString()}`} style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.85rem', marginBottom: '1rem', color: '#4ade80' }}>Devueltas: <strong>${changeGiven.toLocaleString()}</strong></div>
                  <button onClick={() => handleProcessSale('Registrada')} style={{ width: '100%', padding: '0.6rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', marginBottom: '0.5rem', cursor: 'pointer' }}>📑 Solo Registrar Venta</button>
                  <button onClick={() => handleProcessSale('Facturada')} style={{ width: '100%', padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🧾 Facturar e Imprimir DIAN</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📦 Gestión de Inventario</h2>
                <button onClick={() => setShowAddModal(true)} style={{ padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ➕ Ingresar Nuevo Producto
                </button>
              </div>

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
                    .slice(0, 50)
                    .map(p => (
                      <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem' }}>{p.barcode}</td>
                        <td style={{ padding: '0.75rem' }}>{p.name}</td>
                        <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>${p.sale_price?.toLocaleString()}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: p.stock <= (p.min_stock || 3) ? '#991b1b' : '#166534', color: '#fff' }}>
                            {p.stock} unidades
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{p.min_stock || 3} unidades</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => setEditingProduct({ ...p })} style={{ padding: '0.4rem 0.8rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            ✏️ Modificar
                          </button>
                          <button onClick={() => handleDeleteProduct(p.barcode, p.name)} style={{ padding: '0.4rem 0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            🗑️ Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'out_of_stock' && (
            <div>
              <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>⚠️ Productos Agotados o Stock Bajo (&le; Mínimo)</h2>

              <input
                type="text"
                placeholder="🔍 Buscar producto agotado o crítico..."
                value={outSearch}
                onChange={(e) => setOutSearch(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }}
              />

              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Código</th>
                    <th style={{ padding: '0.75rem' }}>Producto</th>
                    <th style={{ padding: '0.75rem' }}>Stock Actual</th>
                    <th style={{ padding: '0.75rem' }}>Stock Mínimo</th>
                    <th style={{ padding: '0.75rem' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter(p => p.stock <= (p.min_stock || 3))
                    .filter(p => p.name.toLowerCase().includes(outSearch.toLowerCase()) || p.barcode.includes(outSearch))
                    .sort((a, b) => a.stock - b.stock)
                    .map(p => (
                      <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem' }}>{p.barcode}</td>
                        <td style={{ padding: '0.75rem' }}>{p.name}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold', color: p.stock === 0 ? '#f87171' : '#f59e0b' }}>
                          {p.stock}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{p.min_stock || 3}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: p.stock === 0 ? '#dc2626' : '#d97706', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {p.stock === 0 ? 'AGOTADO' : 'STOCK CRÍTICO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'accounting' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📈 Resumen Contable</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowTxModal(true)} style={{ padding: '0.6rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    ➕ Registrar Ingreso / Egreso
                  </button>
                  <button onClick={handleExportCSV} style={{ padding: '0.6rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    📥 Descargar Reporte (Excel / CSV)
                  </button>
                  <button onClick={() => window.print()} style={{ padding: '0.6rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    🖨️ Imprimir PDF
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>VALOR TOTAL INVENTARIO</p>
                  <h3 style={{ color: '#38bdf8', fontSize: '1.3rem', marginTop: '0.4rem' }}>
                    ${inventoryValue.toLocaleString()}
                  </h3>
                </div>
                <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>TOTAL INGRESOS</p>
                  <h3 style={{ color: '#22c55e', fontSize: '1.3rem', marginTop: '0.4rem' }}>
                    ${totalIncomes.toLocaleString()}
                  </h3>
                </div>
                <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>TOTAL EGRESOS</p>
                  <h3 style={{ color: '#f87171', fontSize: '1.3rem', marginTop: '0.4rem' }}>
                    ${totalExpenses.toLocaleString()}
                  </h3>
                </div>
                <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>BALANCE NETO</p>
                  <h3 style={{ color: netBalance >= 0 ? '#4ade80' : '#f87171', fontSize: '1.3rem', marginTop: '0.4rem' }}>
                    ${netBalance.toLocaleString()}
                  </h3>
                </div>
              </div>

              <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>📜 Historial de Ingresos y Egresos</h3>
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
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No hay movimientos registrados.</td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>{t.created_at || new Date().toLocaleString()}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: t.type === 'Ingreso' ? '#166534' : '#991b1b', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{t.category}</td>
                        <td style={{ padding: '0.75rem' }}>{t.description}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold', color: t.type === 'Ingreso' ? '#22c55e' : '#f87171' }}>
                          ${t.amount?.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>{t.user_name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteTransaction(t.id, t.description, t.category)}
                            style={{ padding: '0.3rem 0.6rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                          >
                            🗑️ Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'employees' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>👥 Gestión de Empleados y Permisos</h2>
                <button onClick={() => setShowUserModal(true)} style={{ padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ➕ Registrar Nuevo Empleado
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>ID</th>
                    <th style={{ padding: '0.75rem' }}>Nombre Completo</th>
                    <th style={{ padding: '0.75rem' }}>Nombre de Usuario</th>
                    <th style={{ padding: '0.75rem' }}>Rol / Permisos</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem', color: '#94a3b8' }}>#{u.id}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{u.name}</td>
                      <td style={{ padding: '0.75rem' }}>{u.username}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: u.role === 'Administrador' ? '#1d4ed8' : '#0284c7', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          🔑 {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          style={{ padding: '0.35rem 0.7rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                        >
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reports' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📊 Reportes Generales y Cierres de Turno</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setReportType('daily')} style={{ padding: '0.6rem 1rem', background: reportType === 'daily' ? '#2563eb' : '#334155', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    📅 Reporte Diario / Turnos
                  </button>
                  <button onClick={() => setReportType('monthly')} style={{ padding: '0.6rem 1rem', background: reportType === 'monthly' ? '#2563eb' : '#334155', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    📆 Reporte Mensual
                  </button>
                </div>
              </div>

              {reportType === 'daily' && (
                <div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Filtrar por Empleado / Administrador:</label>
                      <input type="text" placeholder="Ej: Anthony, Doña Rosa..." value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Filtrar por Fecha:</label>
                      <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }} />
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: '#334155', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>ID Turno</th>
                        <th style={{ padding: '0.75rem' }}>Empleado / Usuario</th>
                        <th style={{ padding: '0.75rem' }}>Apertura</th>
                        <th style={{ padding: '0.75rem' }}>Cierre</th>
                        <th style={{ padding: '0.75rem' }}>Base Inicial</th>
                        <th style={{ padding: '0.75rem' }}>Vtas. Efectivo</th>
                        <th style={{ padding: '0.75rem' }}>Vtas. Nequi/Trans.</th>
                        <th style={{ padding: '0.75rem' }}>Total Vendido</th>
                        <th style={{ padding: '0.75rem' }}>Estado</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyShifts.length === 0 ? (
                        <tr><td colSpan="10" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No hay turnos registrados con los filtros seleccionados.</td></tr>
                      ) : (
                        filteredDailyShifts.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #334155' }}>
                            <td style={{ padding: '0.75rem', color: '#94a3b8' }}>#{s.id}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{s.user_name}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>{s.opened_at}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>{s.closed_at || 'Activo'}</td>
                            <td style={{ padding: '0.75rem', color: '#eab308' }}>${s.start_amount?.toLocaleString()}</td>
                            <td style={{ padding: '0.75rem', color: '#22c55e' }}>${s.cash_sales?.toLocaleString() || 0}</td>
                            <td style={{ padding: '0.75rem', color: '#38bdf8' }}>${s.transfer_sales?.toLocaleString() || 0}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4ade80' }}>${s.total_sales?.toLocaleString() || 0}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: s.status === 'abierto' ? '#166534' : '#334155', color: '#fff', fontSize: '0.75rem' }}>
                                {s.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button onClick={() => handlePrintShiftReport(s)} style={{ padding: '0.3rem 0.6rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                🖨️ Imprimir
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'monthly' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                    <label style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Seleccionar Mes / Año:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>TURNOS REGISTRADOS</p>
                      <h3 style={{ color: '#38bdf8', fontSize: '1.4rem', marginTop: '0.4rem' }}>{monthlyShifts.length} turnos</h3>
                    </div>
                    <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>VENTAS EFECTIVO</p>
                      <h3 style={{ color: '#22c55e', fontSize: '1.4rem', marginTop: '0.4rem' }}>${monthlyCash.toLocaleString()}</h3>
                    </div>
                    <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>VENTAS NEQUI / TRANSF.</p>
                      <h3 style={{ color: '#38bdf8', fontSize: '1.4rem', marginTop: '0.4rem' }}>${monthlyTransfer.toLocaleString()}</h3>
                    </div>
                    <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>TOTAL ACUMULADO MES</p>
                      <h3 style={{ color: '#4ade80', fontSize: '1.4rem', marginTop: '0.4rem' }}>${monthlyTotal.toLocaleString()}</h3>
                    </div>
                  </div>

                  <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>📋 Desglose de Turnos en {selectedMonth}</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: '#334155', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>Fecha / Hora</th>
                        <th style={{ padding: '0.75rem' }}>Empleado / Usuario</th>
                        <th style={{ padding: '0.75rem' }}>Efectivo</th>
                        <th style={{ padding: '0.75rem' }}>Transferencia</th>
                        <th style={{ padding: '0.75rem' }}>Total Turno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyShifts.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No hay datos de ventas registrados para el mes seleccionado.</td></tr>
                      ) : (
                        monthlyShifts.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #334155' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>{s.opened_at}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{s.user_name}</td>
                            <td style={{ padding: '0.75rem', color: '#22c55e' }}>${s.cash_sales?.toLocaleString() || 0}</td>
                            <td style={{ padding: '0.75rem', color: '#38bdf8' }}>${s.transfer_sales?.toLocaleString() || 0}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4ade80' }}>${s.total_sales?.toLocaleString() || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dian' && (
            <div>
              <h2 style={{ color: '#38bdf8', marginBottom: '1.5rem' }}>⚙️ Configuración DIAN y Personalización de Recibo</h2>
              <form onSubmit={handleSaveConfig} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155', maxWidth: '600px' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Razón Social / Nombre Comercial:</label>
                  <input
                    type="text"
                    required
                    value={storeConfig.razon_social}
                    onChange={(e) => setStoreConfig({ ...storeConfig, razon_social: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>NIT / Cédula:</label>
                    <input
                      type="text"
                      required
                      value={storeConfig.nit}
                      onChange={(e) => setStoreConfig({ ...storeConfig, nit: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Teléfono / Celular:</label>
                    <input
                      type="text"
                      required
                      value={storeConfig.telefono}
                      onChange={(e) => setStoreConfig({ ...storeConfig, telefono: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Dirección:</label>
                  <input
                    type="text"
                    required
                    value={storeConfig.direccion}
                    onChange={(e) => setStoreConfig({ ...storeConfig, direccion: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Descripción de Actividad / Encabezado:</label>
                  <input
                    type="text"
                    value={storeConfig.actividad}
                    onChange={(e) => setStoreConfig({ ...storeConfig, actividad: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mensaje al Pie del Recibo:</label>
                  <input
                    type="text"
                    value={storeConfig.footer_msg}
                    onChange={(e) => setStoreConfig({ ...storeConfig, footer_msg: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginTop: '0.3rem' }}
                  />
                </div>

                <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
                  💾 Guardar Cambios de Configuración
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveUser} style={{ background: '#1e293b', color: '#fff', padding: '1.5rem', borderRadius: '8px', width: '380px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#38bdf8', marginTop: 0 }}>➕ Registrar Nuevo Empleado</h3>
            
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nombre Completo:</label>
            <input type="text" required placeholder="Ej: Doña Rosa" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Usuario de Acceso:</label>
            <input type="text" required placeholder="Ej: rosa" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Contraseña:</label>
            <input type="password" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Rol / Permisos:</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Cajero">🛒 Cajero (Solo POS)</option>
              <option value="Administrador">🔑 Administrador (Acceso Total)</option>
            </select>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.6rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Empleado</button>
            </div>
          </form>
        </div>
      )}

      {showTxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveTransaction} style={{ background: '#1e293b', color: '#fff', padding: '1.5rem', borderRadius: '8px', width: '380px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#38bdf8', marginTop: 0 }}>➕ Registrar Movimiento Financiero</h3>
            
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tipo de Movimiento:</label>
            <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Ingreso">🟢 Ingreso</option>
              <option value="Egreso">🔴 Egreso / Gasto</option>
            </select>

            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Categoría:</label>
            <input type="text" placeholder="Ej: Proveedores, Arriendo, Servicios, Inyección capital" value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Descripción / Concepto:</label>
            <input type="text" placeholder="Detalle del movimiento" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Monto ($):</label>
            <input type="number" required value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setShowTxModal(false)} style={{ flex: 1, padding: '0.6rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Movimiento</button>
            </div>
          </form>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveNewProduct} style={{ background: '#1e293b', color: '#fff', padding: '1.5rem', borderRadius: '8px', width: '380px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#38bdf8', marginTop: 0 }}>➕ Ingresar Nuevo Producto</h3>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Código de Barras / ID:</label>
            <input type="text" required value={newProd.barcode} onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nombre del Producto:</label>
            <input type="text" required value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Precio de Venta ($):</label>
            <input type="number" required value={newProd.sale_price} onChange={(e) => setNewProd({ ...newProd, sale_price: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Stock Inicial:</label>
                <input type="number" required value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Stock Mínimo:</label>
                <input type="number" required value={newProd.min_stock} onChange={(e) => setNewProd({ ...newProd, min_stock: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '0.6rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {editingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleUpdateProduct} style={{ background: '#1e293b', color: '#fff', padding: '1.5rem', borderRadius: '8px', width: '380px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#38bdf8', marginTop: 0 }}>✏️ Modificar Producto (CÓD: {editingProduct.barcode})</h3>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nombre del Producto:</label>
            <input type="text" required value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Precio de Venta ($):</label>
            <input type="number" required value={editingProduct.sale_price} onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Stock Actual:</label>
                <input type="number" required value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Stock Mínimo:</label>
                <input type="number" required value={editingProduct.min_stock || 3} onChange={(e) => setEditingProduct({ ...editingProduct, min_stock: e.target.value })} style={{ width: '100%', padding: '0.5rem', margin: '0.2rem 0 0.8rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '0.6rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: '0.6rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Actualizar</button>
            </div>
          </form>
        </div>
      )}

      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', color: '#000', padding: '1.5rem', borderRadius: '8px', width: '320px', textAlign: 'center' }}>
            <h3>☀️ Iniciar Turno ({currentUser.name})</h3>
            <input type="number" placeholder="Base Inicial ($)" value={shiftBaseInput} onChange={(e) => setShiftBaseInput(e.target.value)} style={{ width: '100%', padding: '0.75rem', margin: '1rem 0', fontSize: '1.1rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowShiftModal(false)} style={{ flex: 1, padding: '0.5rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleOpenShift} style={{ flex: 1, padding: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>▶️ ABRIR TURNO</button>
            </div>
          </div>
        </div>
      )}

      {shiftSummary && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '2rem', borderRadius: '8px', width: '360px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#38bdf8', textAlign: 'center', margin: '0 0 1rem 0' }}>📄 INFORME DE CIERRE DE TURNO</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Vendedor: <strong>{currentUser.name}</strong></p>
            <hr style={{ borderColor: '#334155', margin: '1rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Base Inicial:</span><strong style={{ color: '#eab308' }}>${shiftSummary.startBase?.toLocaleString()}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Ventas Efectivo:</span><strong style={{ color: '#22c55e' }}>${shiftSummary.cashSales?.toLocaleString()}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Ventas Transferencia:</span><strong style={{ color: '#38bdf8' }}>${shiftSummary.transferSales?.toLocaleString()}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 'bold' }}><span>TOTAL VENDIDO:</span><span style={{ color: '#4ade80' }}>${shiftSummary.totalSales?.toLocaleString()}</span></div>
            <hr style={{ borderColor: '#334155', margin: '1rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.05rem', fontWeight: 'bold' }}><span>TOTAL EN CAJA:</span><span style={{ color: '#38bdf8' }}>${shiftSummary.totalCashInBox?.toLocaleString()}</span></div>
            <button onClick={() => setShiftSummary(null)} style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Aceptar y Finalizar</button>
          </div>
        </div>
      )}
    </>
  );
}