import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './db';
import { processSyncQueue } from './syncEngine';
import Preventista from './Preventista';
import Entregador from './Entregador';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

const formatCOP = (val) => {
  if (!val) return '';
  const cleanNum = String(val).replace(/\D/g, '');
  if (!cleanNum) return '';
  return parseInt(cleanNum, 10).toLocaleString('es-CO');
};

const parseCOP = (val) => {
  if (!val) return 0;
  const cleanNum = String(val).replace(/\D/g, '');
  return cleanNum ? parseInt(cleanNum, 10) : 0;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftBaseInput, setShiftBaseInput] = useState('');
  const [activeTab, setActiveTab] = useState('pos');

  const [storeConfig, setStoreConfig] = useState({
    razon_social: 'TERRA FRUTOS SECOS', nit: '40044029-8', direccion: 'Cra 7 #15-63, Tunja, Boyacá', telefono: '3183142180', actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR', footer_msg: '¡Gracias por su compra!'
  });

  const [lastInvoice, setLastInvoice] = useState(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // CATALOGO CAJA LOCAL
  const [products, setProducts] = useState([]);
  const [invSearch, setInvSearch] = useState('');
  const [outSearch, setOutSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProd, setNewProd] = useState({ barcode: '', name: '', sale_price: '', stock: '', min_stock: '3' });

  // CATALOGO FABRICA (PREVENTA)
  const [preventaProducts, setPreventaProducts] = useState([]);
  const [invPreventaSearch, setInvPreventaSearch] = useState('');
  const [showAddPreventaModal, setShowAddPreventaModal] = useState(false);
  const [editingPreventaProduct, setEditingPreventaProduct] = useState(null);
  const [newPreventaProd, setNewPreventaProd] = useState({ barcode: '', name: '', price: '', stock: '', min_stock: '3' });
  const [discountRules, setDiscountRules] = useState([]);
  
  // PEDIDOS PREVENTA (TRAZABILIDAD ADMIN)
  const [preventaOrders, setPreventaOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // CAJA / VENTAS
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerDoc, setCustomerDoc] = useState('222222222222');
  const [customerName, setCustomerName] = useState('Consumidor Final');

  const [transactions, setTransactions] = useState([]);
  const [showTxModal, setShowTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'Ingreso', category: 'Varios', description: '', amount: '' });

  const [usersList, setUsersList] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Cajero' });

  const [shiftsList, setShiftsList] = useState([]);
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [printShiftData, setPrintShiftData] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('pos_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        processSyncQueue();
      } catch (e) { localStorage.removeItem('pos_user'); }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (navigator.onLine) {
        checkActiveShift(currentUser.name);
        loadConfig();
        loadProductsOnline();
        loadPreventaProductsOnline();
        loadPreventaOrders();
        loadTransactions();
        loadUsersOnline();
        loadShifts();
      } else {
        loadProductsLocal();
      }
    }
  }, [currentUser]);

  const loadProductsOnline = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        await db.products.bulkPut(data);
      }
    } catch (e) { loadProductsLocal(); }
  };
  const loadProductsLocal = async () => { setProducts(await db.products.toArray()); };

  const loadPreventaProductsOnline = async () => {
    try {
      const res = await fetch(`${API_URL}/api/preventa-products`);
      if (res.ok) {
        const data = await res.json();
        setPreventaProducts(data);
        await db.preventa_products.bulkPut(data);
      }
    } catch (e) {}
  };

  const loadPreventaOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/detailed`);
      if (res.ok) setPreventaOrders(await res.json());
    } catch (e) {}
  };

  const loadUsersOnline = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      if (res.ok) { const data = await res.json(); setUsersList(data); await db.users.bulkPut(data); }
    } catch (e) {}
  };

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setStoreConfig((prev) => ({ ...prev, ...data }));
      }
    } catch (e) {}
  };

  const loadTransactions = async () => {
    try { const res = await fetch(`${API_URL}/api/transactions`); if (res.ok) setTransactions(await res.json()); } catch (e) {}
  };

  const loadShifts = async () => {
    try { const res = await fetch(`${API_URL}/api/shifts`); if (res.ok) setShiftsList(await res.json()); } catch (e) {}
  };

  const checkActiveShift = async (userName) => {
    try { const res = await fetch(`${API_URL}/api/shifts/active?user_name=${encodeURIComponent(userName)}`); if (res.ok) setActiveShift(await res.json()); } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!navigator.onLine) {
      try {
        const localUser = await db.users.where('username').equals(loginUser.toLowerCase().trim()).first();
        if (localUser && localUser.password === loginPass.trim()) {
          setCurrentUser(localUser);
          localStorage.setItem('pos_user', JSON.stringify(localUser));
          return;
        } else return setLoginError('Sin conexión. Usuario/Clave local incorrectos.');
      } catch (err) { return setLoginError('Error validando en base local.'); }
    }
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
        processSyncQueue();
      } else setLoginError(data.error || 'Credenciales incorrectas');
    } catch (e) { setLoginError('Error de red.'); }
  };

  const handleLogout = () => { localStorage.removeItem('pos_user'); setCurrentUser(null); setActiveShift(null); setCart([]); };

  const handleOpenShift = async () => {
    const baseValue = parseCOP(shiftBaseInput);
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: currentUser.name, start_amount: baseValue }) });
      if (res.ok) { setShowShiftModal(false); setShiftBaseInput(''); checkActiveShift(currentUser.name); loadShifts(); }
    } catch (e) { alert('Error al abrir turno'); }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (!window.confirm('¿Desea cerrar el turno actual?')) return;
    try {
      const res = await fetch(`${API_URL}/api/shifts/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shift_id: activeShift.id }) });
      const data = await res.json();
      if (res.ok && data.success) { setShiftSummary(data.summary); setActiveShift(null); loadShifts(); }
    } catch (e) { alert('Error al cerrar el turno'); }
  };

  const addToCart = (p) => {
    if (!activeShift) { alert('⚠️ Inicie un turno para vender.'); setShowShiftModal(true); return; }
    const exist = cart.find((x) => x.barcode === p.barcode);
    if (exist) setCart(cart.map((x) => (x.barcode === p.barcode ? { ...x, quantity: x.quantity + 1 } : x)));
    else setCart([...cart, { ...p, quantity: 1, sale_price: p.sale_price }]);
  };
  const updateQty = (barcode, qty) => {
    if (qty <= 0) setCart(cart.filter((x) => x.barcode !== barcode));
    else setCart(cart.map((x) => (x.barcode === barcode ? { ...x, quantity: qty } : x)));
  };
  const removeFromCart = (barcode) => setCart(cart.filter((x) => x.barcode !== barcode));

  const totalCart = cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const numericAmountPaid = parseCOP(amountPaid);
  const received = numericAmountPaid > 0 ? numericAmountPaid : totalCart;
  const changeGiven = received >= totalCart ? received - totalCart : 0;

  const handleProcessSale = async (saleType) => {
    if (cart.length === 0) return;
    const desc = cart.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    try {
      const res = await fetch(`${API_URL}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: activeShift?.id || null, user_name: currentUser.name, customer_doc: customerDoc, customer_name: customerName, items: cart, description: desc, total: totalCart, payment_method: paymentMethod, amount_paid: received, change_given: changeGiven, sale_type: saleType })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastInvoice({ number: data.invoice_number, date: new Date().toLocaleString(), customerDoc, customerName, items: [...cart], total: totalCart, paymentMethod, received, changeGiven, seller: currentUser.name });
        alert(`✅ Venta Exitosa. Factura #: ${data.invoice_number}`);
        if (saleType === 'Facturada') setTimeout(() => window.print(), 300);
        setCart([]); setAmountPaid(''); loadProductsOnline(); loadTransactions();
      }
    } catch (e) { alert('Error de red'); }
  };

  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    const payload = { ...newProd, sale_price: parseCOP(newProd.sale_price), stock: parseCOP(newProd.stock), min_stock: parseCOP(newProd.min_stock) || 3 };
    await fetch(`${API_URL}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowAddModal(false); loadProductsOnline();
  };
  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    const payload = { ...editingProduct, sale_price: parseCOP(editingProduct.sale_price), stock: parseCOP(editingProduct.stock), min_stock: parseCOP(editingProduct.min_stock) || 3 };
    await fetch(`${API_URL}/api/products/${editingProduct.barcode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setEditingProduct(null); loadProductsOnline();
  };
  const handleDeleteProduct = async (barcode) => {
    if (window.confirm('¿Eliminar producto local?')) { await fetch(`${API_URL}/api/products/${barcode}`, { method: 'DELETE' }); loadProductsOnline(); }
  };

  const openAddPreventaModal = () => { setNewPreventaProd({ barcode: '', name: '', price: '', stock: '', min_stock: '3' }); setDiscountRules([]); setShowAddPreventaModal(true); };
  const openEditPreventaModal = (p) => {
    setEditingPreventaProduct(p);
    try { setDiscountRules(JSON.parse(p.discount_rules) || []); } catch(e) { setDiscountRules([]); }
  };
  const addDiscountRule = () => setDiscountRules([...discountRules, { min: '', max: '', discount: '' }]);
  const removeDiscountRule = (index) => setDiscountRules(discountRules.filter((_, i) => i !== index));
  const updateDiscountRule = (index, field, value) => { const updated = [...discountRules]; updated[index][field] = value; setDiscountRules(updated); };

  const handleSavePreventaProduct = async (e) => {
    e.preventDefault();
    const payload = { ...newPreventaProd, price: parseCOP(newPreventaProd.price), stock: parseCOP(newPreventaProd.stock), min_stock: parseCOP(newPreventaProd.min_stock) || 3, discount_rules: JSON.stringify(discountRules) };
    await fetch(`${API_URL}/api/preventa-products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowAddPreventaModal(false); loadPreventaProductsOnline();
  };
  const handleUpdatePreventaProduct = async (e) => {
    e.preventDefault();
    const payload = { ...editingPreventaProduct, price: parseCOP(editingPreventaProduct.price), stock: parseCOP(editingPreventaProduct.stock), min_stock: parseCOP(editingPreventaProduct.min_stock) || 3, discount_rules: JSON.stringify(discountRules) };
    await fetch(`${API_URL}/api/preventa-products/${editingPreventaProduct.barcode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setEditingPreventaProduct(null); loadPreventaProductsOnline();
  };
  const handleDeletePreventaProduct = async (barcode) => {
    if (window.confirm('¿Eliminar producto de fábrica?')) { await fetch(`${API_URL}/api/preventa-products/${barcode}`, { method: 'DELETE' }); loadPreventaProductsOnline(); }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    const numericAmount = parseCOP(newTx.amount);
    if (numericAmount <= 0) return alert('Monto inválido');
    try {
      const res = await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newTx, amount: numericAmount, user_name: currentUser.name }) });
      if (res.ok) { alert(`✅ ${newTx.type} registrado`); setNewTx({ type: 'Ingreso', category: 'Varios', description: '', amount: '' }); setShowTxModal(false); loadTransactions(); }
    } catch (e) { alert('Error conectando al servidor'); }
  };
  const handleDeleteTransaction = async (id, description, category) => {
    if (!window.confirm(`¿Está seguro de eliminar el registro contable "${description}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) { alert('🗑️ Registro eliminado'); loadTransactions(); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
      if (res.ok) { alert('👤 Empleado creado'); setNewUser({ name: '', username: '', password: '', role: 'Cajero' }); setShowUserModal(false); loadUsersOnline(); }
    } catch (e) { alert('Error conectando al servidor'); }
  };
  const handleDeleteUser = async (id, name) => {
    if (currentUser.id === id) return alert('⚠️ No puedes eliminar tu propio usuario actual');
    if (!window.confirm(`¿Está seguro de eliminar al usuario "${name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) { alert('🗑️ Usuario eliminado'); loadUsersOnline(); }
    } catch (e) { alert('Error conectando al servidor'); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeConfig) });
    alert('Configuración guardada');
  };

  const handlePrintShiftReport = (shift) => { setPrintShiftData(shift); setTimeout(() => window.print(), 300); };
  
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,FECHA,TIPO,CATEGORIA,DESCRIPCION,MONTO,USUARIO\n';
    transactions.forEach((t) => { csvContent += `"${t.created_at}","${t.type}","${t.category}","${t.description}",${t.amount},"${t.user_name}"\n`; });
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Reporte_Contable_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#121824', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', color: '#fff', width: '100%', maxWidth: '360px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)' }}>
          <h2 style={{ color: '#38bdf8', textAlign: 'center' }}>🌱 TERRA FRUTOS SECOS</h2>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>{navigator.onLine ? 'Conectado al Servidor' : '⚠️ Modo Offline (Sin Red)'}</p>
          {loginError && <div style={{ background: '#f87171', color: '#7f1d1d', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>{loginError}</div>}
          <input type="text" placeholder="Usuario" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} required />
          <input type="password" placeholder="Contraseña" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1.5rem 0', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} required />
          <button type="submit" style={{ width: '100%', padding: '0.85rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🔑 INICIAR SESIÓN</button>
        </form>
      </div>
    );
  }

  if (currentUser.role.toLowerCase() === 'preventista') return <Preventista user={currentUser} onLogout={handleLogout} />;
  if (currentUser.role.toLowerCase() === 'entregador') return <Entregador user={currentUser} onLogout={handleLogout} />;

  const isAdmin = currentUser.role?.toLowerCase() === 'administrador';

  const filteredDailyShifts = shiftsList.filter((s) => {
    const matchesUser = filterUser ? s.user_name.toLowerCase().includes(filterUser.toLowerCase()) : true;
    const matchesDate = filterDate ? s.opened_at && s.opened_at.startsWith(filterDate) : true;
    return matchesUser && matchesDate;
  });

  const monthlyShifts = shiftsList.filter((s) => s.opened_at && s.opened_at.startsWith(selectedMonth));
  const monthlyCash = monthlyShifts.reduce((acc, s) => acc + (s.cash_sales || 0), 0);
  const monthlyTransfer = monthlyShifts.reduce((acc, s) => acc + (s.transfer_sales || 0), 0);
  const monthlyTotal = monthlyShifts.reduce((acc, s) => acc + (s.total_sales || 0), 0);
  const getShiftValFormatted = (val) => { const num = Number(val); return isNaN(num) ? '0' : num.toLocaleString('es-CO'); };

  const totalIncomes = transactions.filter((t) => t.type === 'Ingreso').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpenses = transactions.filter((t) => t.type === 'Egreso').reduce((acc, t) => acc + (t.amount || 0), 0);
  const netBalance = totalIncomes - totalExpenses;

  return (
    <>
      <style>{`
        html, body, #root { height: 100%; min-height: 100vh; margin: 0; padding: 0; background: #0f172a; color: #fff; font-family: sans-serif; overflow-x: hidden; }
        .pos-layout { display: flex; flex-direction: row; min-height: 100vh; height: 100%; }
        .pos-sidebar { width: 240px; background: #1e293b; padding: 1rem; display: flex; flex-direction: column; border-right: 1px solid #334155; flex-shrink: 0; overflow-y: auto; }
        .pos-content { flex: 1; padding: 1.5rem; overflow-y: auto; overflow-x: hidden; }
        .pos-grid-container { display: flex; gap: 1.25rem; height: 100%; align-items: stretch; }
        .pos-products-area { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; overflow-y: auto; padding-right: 4px; padding-bottom: 2rem; }
        .pos-cart { width: 400px; background: #1e293b; border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; border: 1px solid #334155; flex-shrink: 0; }
        .cart-items-wrapper { flex: 1; overflow-y: auto; padding-right: 6px; min-height: 150px; }
        .nav-btn { padding: 0.8rem; text-align: left; background: transparent; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 0.3rem; }
        .nav-btn.active { background: #2563eb; font-weight: bold; }
        .responsive-table-wrapper { width: 100%; overflow-x: auto; background: #1e293b; border-radius: 8px; }
        .responsive-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .responsive-table th, .responsive-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        
        @media (max-width: 768px) {
          .pos-layout { flex-direction: column; height: auto; display: block; }
          .pos-sidebar { width: 100%; box-sizing: border-box; border-right: none; border-bottom: 1px solid #334155; padding: 1rem; position: relative; }
          .sidebar-top-section { display: flex; justify-content: space-between; align-items: flex-start; }
          .nav-buttons { display: flex; flex-direction: row; overflow-x: auto; gap: 0.5rem; padding-bottom: 0.5rem; border-top: 1px solid #334155; margin-top: 0.8rem; padding-top: 0.8rem; }
          .nav-btn { white-space: nowrap; text-align: center; padding: 0.6rem 1rem; margin-bottom: 0; }
          .pos-content { padding: 0.8rem; overflow: visible; height: auto; }
          .pos-grid-container { flex-direction: column; height: auto; display: block; }
          .pos-products-area { overflow: visible; height: auto; }
          .products-grid { overflow: visible; max-height: none; }
          .pos-cart { width: 100%; box-sizing: border-box; margin-top: 1.5rem; height: auto; }
          .cart-items-wrapper { max-height: none; overflow: visible; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* COMPROBANTE DE IMPRESIÓN */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base Inicial:</span><span>${getShiftValFormatted(printShiftData.start_amount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ventas Efectivo:</span><span>${getShiftValFormatted(printShiftData.cash_sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ventas Transferencia:</span><span>${getShiftValFormatted(printShiftData.transfer_sales)}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}><span>TOTAL VENDIDO:</span><span>${getShiftValFormatted(printShiftData.total_sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}><span>TOTAL EN CAJA:</span><span>${getShiftValFormatted(printShiftData.end_amount)}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
          </div>
        ) : lastInvoice ? (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', margin: '0 0 2px 0', fontSize: '12px' }}>🌱 {storeConfig.razon_social}</h3>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '8px' }}>NIT: {storeConfig.nit}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '1px 0' }}>Factura #: <strong>{lastInvoice.number}</strong></p>
            <p style={{ margin: '1px 0' }}>Fecha: {lastInvoice.date}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <tbody>
                {lastInvoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ verticalAlign: 'top', padding: '1px 0' }}>{it.quantity}x {it.name.substring(0, 16)}</td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '1px 0', fontWeight: 'bold' }}>${(it.quantity * it.sale_price).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}><span>TOTAL:</span><span>${lastInvoice.total.toLocaleString('es-CO')}</span></div>
            <p style={{ textAlign: 'center', margin: '4px 0 0 0', fontSize: '9px' }}>{storeConfig.footer_msg}</p>
          </div>
        ) : null}
      </div>

      <div className="no-print pos-layout">
        <div className="pos-sidebar">
          <div>
            <div className="sidebar-top-section">
              <div>
                <h3 style={{ color: '#38bdf8', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>🌱 {storeConfig.razon_social}</h3>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  {currentUser.name} <span style={{ color: '#38bdf8', marginLeft: '5px' }}>({currentUser.role})</span>
                </div>
              </div>
              <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Salir</button>
            </div>

            {!activeShift ? (
              <button onClick={() => setShowShiftModal(true)} style={{ width: '100%', padding: '0.8rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>▶️ Iniciar Turno</button>
            ) : (
              <div style={{ background: '#166534', color: '#4ade80', padding: '0.8rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer' }} onClick={handleCloseShift}>
                🟢 Cerrar Turno #{activeShift.id}
              </div>
            )}

            <div className="nav-buttons">
              <button onClick={() => setActiveTab('pos')} className={`nav-btn ${activeTab === 'pos' ? 'active' : ''}`}>💳 POS Local</button>
              {isAdmin && (
                <>
                  <button onClick={() => setActiveTab('inventory')} className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}>📦 Inventario Local</button>
                  <button onClick={() => setActiveTab('fabrica_inventory')} className={`nav-btn ${activeTab === 'fabrica_inventory' ? 'active' : ''}`}>🏭 Inventario Fábrica</button>
                  <button onClick={() => setActiveTab('preventa_orders')} className={`nav-btn ${activeTab === 'preventa_orders' ? 'active' : ''}`}>📋 Pedidos Preventista</button>
                  <button onClick={() => setActiveTab('out_of_stock')} className={`nav-btn ${activeTab === 'out_of_stock' ? 'active' : ''}`}>⚠️ Agotados</button>
                  <button onClick={() => setActiveTab('accounting')} className={`nav-btn ${activeTab === 'accounting' ? 'active' : ''}`}>📈 Contabilidad</button>
                  <button onClick={() => setActiveTab('employees')} className={`nav-btn ${activeTab === 'employees' ? 'active' : ''}`}>👥 Empleados</button>
                  <button onClick={() => setActiveTab('reports')} className={`nav-btn ${activeTab === 'reports' ? 'active' : ''}`}>📊 Reportes</button>
                  <button onClick={() => setActiveTab('dian')} className={`nav-btn ${activeTab === 'dian' ? 'active' : ''}`}>⚙️ Config</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pos-content">
          {activeTab === 'pos' && (
            <div className="pos-grid-container">
              <div className="pos-products-area">
                <input type="text" placeholder="🔍 Buscar en caja local..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '1rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
                <div className="products-grid">
                  {products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map((p) => (
                    <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '1rem', borderRadius: '6px', border: '1px solid #334155', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CÓD: {p.barcode}</span>
                      <h4 style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>{p.name}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>${p.sale_price?.toLocaleString('es-CO')}</strong>
                        <span style={{ fontSize: '0.75rem', background: '#334155', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>Stk: {p.stock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pos-cart">
                <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>🛒 Carrito Local ({cart.length})</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input type="text" value={customerDoc} onChange={(e) => setCustomerDoc(e.target.value)} placeholder="NIT / CC" style={{ width: '40%', boxSizing: 'border-box', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre Cliente" style={{ width: '60%', boxSizing: 'border-box', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                </div>
                
                <div className="cart-items-wrapper">
                  {cart.map((item) => (
                    <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', background: '#0f172a', padding: '0.8rem', borderRadius: '6px' }}>
                      <div style={{ flex: 1 }}><strong style={{ fontSize: '0.9rem' }}>{item.name}</strong><br /><span style={{ color: '#22c55e', fontWeight: 'bold' }}>${(item.sale_price * item.quantity).toLocaleString('es-CO')}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={() => updateQty(item.barcode, item.quantity - 1)} style={{ background: '#334155', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '4px', fontWeight: 'bold' }}>-</button>
                        <span style={{ fontWeight: 'bold' }}>{item.quantity}</span>
                        <button onClick={() => updateQty(item.barcode, item.quantity + 1)} style={{ background: '#334155', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '4px', fontWeight: 'bold' }}>+</button>
                        <button onClick={() => removeFromCart(item.barcode)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.4rem', borderRadius: '4px' }}>❌</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}><span>Total:</span><span style={{ color: '#22c55e' }}>${totalCart.toLocaleString('es-CO')}</span></div>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '0.5rem', borderRadius: '6px' }}>
                    <option value="Efectivo">💵 Efectivo</option>
                    <option value="Transferencia">📱 Transferencia</option>
                  </select>
                  <input type="text" value={formatCOP(amountPaid)} onChange={(e) => setAmountPaid(e.target.value.replace(/\D/g, ''))} placeholder={`Recibido ($)`} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '1rem', borderRadius: '6px' }} />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleProcessSale('Registrada')} style={{ flex: 1, padding: '1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Registrar</button>
                    <button onClick={() => handleProcessSale('Facturada')} style={{ flex: 1, padding: '1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Facturar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📦 Inventario Local (Caja)</h2>
                <button onClick={() => setShowAddModal(true)} style={{ padding: '0.8rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Ingresar Producto Local</button>
              </div>
              <input type="text" placeholder="🔍 Buscar en caja..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th>Cód</th><th>Nombre</th><th>Precio Local</th><th>Stock</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {products.filter((p) => p.name.toLowerCase().includes(invSearch.toLowerCase()) || p.barcode.includes(invSearch)).map((p) => (
                      <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                        <td>{p.barcode}</td>
                        <td style={{ minWidth: '150px' }}>{p.name}</td>
                        <td style={{ color: '#22c55e', fontWeight: 'bold' }}>${p.sale_price?.toLocaleString('es-CO')}</td>
                        <td style={{ fontWeight: 'bold' }}>{p.stock}</td>
                        <td style={{ textAlign: 'center', minWidth: '120px' }}><button onClick={() => setEditingProduct(p)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', marginRight: '0.5rem' }}>✏️</button><button onClick={() => handleDeleteProduct(p.barcode)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'fabrica_inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: '#eab308', margin: 0 }}>🏭 Inventario Fábrica (Catálogo Preventistas)</h2>
                <button onClick={openAddPreventaModal} style={{ padding: '0.8rem 1.2rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Nuevo Producto Fábrica</button>
              </div>
              <input type="text" placeholder="🔍 Buscar producto en fábrica..." value={invPreventaSearch} onChange={(e) => setInvPreventaSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th>Cód</th><th>Nombre</th><th>Precio Base</th><th>Descuentos por Cantidad</th><th>Stock Fábrica</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {preventaProducts.filter((p) => p.name.toLowerCase().includes(invPreventaSearch.toLowerCase()) || p.barcode.includes(invPreventaSearch)).map((p) => {
                      let rulesPreview = "Sin descuento";
                      try {
                        const rules = JSON.parse(p.discount_rules);
                        if (rules && rules.length > 0) rulesPreview = rules.map(r => `${r.min}${r.max ? ` a ${r.max}` : '+'}: -${r.discount}%`).join(' | ');
                      } catch(e){}

                      return (
                        <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                          <td>{p.barcode}</td>
                          <td style={{ minWidth: '150px' }}>{p.name}</td>
                          <td style={{ color: '#eab308', fontWeight: 'bold' }}>${p.price?.toLocaleString('es-CO')}</td>
                          <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{rulesPreview}</td>
                          <td style={{ fontWeight: 'bold' }}>{p.stock}</td>
                          <td style={{ textAlign: 'center', minWidth: '120px' }}><button onClick={() => openEditPreventaModal(p)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', marginRight: '0.5rem' }}>✏️ Configurar</button><button onClick={() => handleDeletePreventaProduct(p.barcode)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px' }}>🗑️</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'preventa_orders' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📋 Trazabilidad Pedidos Preventista</h2>
                <button onClick={loadPreventaOrders} style={{ padding: '0.8rem 1.2rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🔄 Actualizar</button>
              </div>
              
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th>ID</th><th>Fecha</th><th>Preventista</th><th>Cliente</th><th>Estado</th><th>Total</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {preventaOrders.map(o => (
                      <React.Fragment key={o.id}>
                        <tr style={{ borderBottom: expandedOrderId === o.id ? 'none' : '1px solid #334155' }}>
                          <td style={{ fontSize: '0.8rem' }}>{o.id.substring(0,8)}</td>
                          <td style={{ fontSize: '0.8rem' }}>{new Date(o.created_at).toLocaleString()}</td>
                          <td><strong>{o.created_by}</strong></td>
                          <td>{o.customer_name}</td>
                          <td>
                            {o.status === 'PENDING' && <span style={{ background: '#eab308', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>⏳ Pendiente</span>}
                            {o.status === 'DELIVERED' && <span style={{ background: '#38bdf8', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>🚚 Entregado</span>}
                            {o.status === 'PAID' && <span style={{ background: '#22c55e', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ Cobrado</span>}
                          </td>
                          <td style={{ color: '#22c55e', fontWeight: 'bold' }}>${formatCOP(o.total)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              {expandedOrderId === o.id ? 'Ocultar' : 'Detalles'}
                            </button>
                          </td>
                        </tr>
                        {expandedOrderId === o.id && (
                          <tr>
                            <td colSpan="7" style={{ padding: 0 }}>
                              <div style={{ background: '#0f172a', padding: '1rem', borderBottom: '1px solid #334155' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>NIT/CC:</span><br/>{o.customer_doc}</div>
                                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Correo:</span><br/>{o.customer_email || 'N/A'}</div>
                                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Notas:</span><br/>{o.notes || 'N/A'}</div>
                                </div>
                                <h5 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8' }}>Productos de Fábrica Solicitados:</h5>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                  {o.items.map(it => (
                                    <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '0.5rem', borderRadius: '4px' }}>
                                      <span>{it.quantity}x {it.product_name} <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>(${formatCOP(it.unit_price)} c/u)</span></span>
                                      <span style={{ fontWeight: 'bold' }}>${formatCOP(it.subtotal)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'out_of_stock' && (
            <div>
              <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>⚠️ Agotados (Ambos Inventarios)</h2>
              <input type="text" placeholder="🔍 Buscar agotados..." value={outSearch} onChange={(e) => setOutSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              
              <h4 style={{color:'#38bdf8', borderBottom:'1px solid #334155', paddingBottom:'0.5rem'}}>Inventario Local (Caja)</h4>
              <div className="responsive-table-wrapper" style={{marginBottom: '2rem'}}>
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155' }}><th>Código</th><th>Nombre</th><th>Stock</th><th>Mínimo</th></tr></thead>
                  <tbody>
                    {products.filter((p) => p.stock <= (p.min_stock || 3)).filter((p) => p.name.toLowerCase().includes(outSearch.toLowerCase()) || p.barcode.includes(outSearch)).map((p) => (
                      <tr key={p.barcode}><td>{p.barcode}</td><td>{p.name}</td><td style={{ color: '#f87171', fontWeight: 'bold' }}>{p.stock}</td><td>{p.min_stock || 3}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{color:'#eab308', borderBottom:'1px solid #334155', paddingBottom:'0.5rem'}}>Inventario Fábrica</h4>
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155' }}><th>Código</th><th>Nombre</th><th>Stock</th><th>Mínimo</th></tr></thead>
                  <tbody>
                    {preventaProducts.filter((p) => p.stock <= (p.min_stock || 3)).filter((p) => p.name.toLowerCase().includes(outSearch.toLowerCase()) || p.barcode.includes(outSearch)).map((p) => (
                      <tr key={p.barcode}><td>{p.barcode}</td><td>{p.name}</td><td style={{ color: '#f87171', fontWeight: 'bold' }}>{p.stock}</td><td>{p.min_stock || 3}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'accounting' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📈 Contabilidad Central</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleExportCSV} style={{ padding: '0.6rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>📥 CSV</button>
                  <button onClick={() => setShowTxModal(true)} style={{ padding: '0.6rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Ingreso/Egreso</button>
                </div>
              </div>
              <div className="stats-grid">
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TOTAL INGRESOS</span><h3 style={{ margin: '0.5rem 0 0 0', color: '#22c55e' }}>${totalIncomes.toLocaleString('es-CO')}</h3></div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TOTAL EGRESOS</span><h3 style={{ margin: '0.5rem 0 0 0', color: '#ef4444' }}>${totalExpenses.toLocaleString('es-CO')}</h3></div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>BALANCE NETO</span><h3 style={{ margin: '0.5rem 0 0 0', color: netBalance >= 0 ? '#38bdf8' : '#ef4444' }}>${netBalance.toLocaleString('es-CO')}</h3></div>
              </div>
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155' }}><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Usuario</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontSize: '0.85rem' }}>{t.created_at}</td>
                        <td><span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: t.type === 'Ingreso' ? '#166534' : '#991b1b', fontSize: '0.8rem' }}>{t.type}</span></td>
                        <td>{t.category}</td>
                        <td style={{ fontSize: '0.85rem' }}><strong>{t.description}</strong></td>
                        <td style={{ fontWeight: 'bold', color: t.type === 'Ingreso' ? '#22c55e' : '#ef4444' }}>${t.amount?.toLocaleString('es-CO')}</td>
                        <td style={{ fontSize: '0.85rem' }}>{t.user_name}</td>
                        <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteTransaction(t.id, t.description, t.category)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'employees' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>👥 Usuarios</h2>
                <button onClick={() => setShowUserModal(true)} style={{ padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Nuevo Usuario</button>
              </div>
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155' }}><th>Nombre</th><th>Usuario</th><th>Rol</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.username}</td>
                        <td><span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: u.role === 'Administrador' ? '#1e40af' : '#334155', fontSize: '0.8rem' }}>{u.role}</span></td>
                        <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteUser(u.id, u.name)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div>
              <h2 style={{ color: '#38bdf8', marginBottom: '1.5rem' }}>📊 Reportes de Turnos Locales</h2>
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#e2e8f0' }}>📅 Turnos Diarios (Caja)</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Filtrar por cajero..." value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ padding: '0.5rem', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', flex: 1, minWidth: '150px' }} />
                  <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: '0.5rem', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', flex: 1, minWidth: '150px' }} />
                </div>
                <div className="responsive-table-wrapper">
                  <table className="responsive-table">
                    <thead><tr style={{ background: '#334155', fontSize: '0.85rem' }}><th>ID</th><th>Cajero</th><th>Cierre</th><th>Efectivo</th><th>Transf.</th><th>Total</th><th style={{ textAlign: 'center' }}>Acción</th></tr></thead>
                    <tbody>
                      {filteredDailyShifts.map((s) => (
                        <tr key={s.id} style={{ fontSize: '0.85rem' }}>
                          <td>#{s.id}</td><td><strong>{s.user_name}</strong></td><td>{s.closed_at || 'En curso'}</td>
                          <td style={{ color: '#4ade80' }}>${getShiftValFormatted(s.cash_sales)}</td><td style={{ color: '#38bdf8' }}>${getShiftValFormatted(s.transfer_sales)}</td><td style={{ fontWeight: 'bold' }}>${getShiftValFormatted(s.total_sales)}</td>
                          <td style={{ textAlign: 'center' }}><button onClick={() => handlePrintShiftReport(s)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>🖨️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dian' && (
            <div style={{ maxWidth: '600px' }}>
              <h2 style={{ color: '#38bdf8', marginBottom: '1.5rem' }}>⚙️ Configuración del Negocio</h2>
              <form onSubmit={handleSaveConfig} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" value={storeConfig.razon_social} onChange={(e) => setStoreConfig({ ...storeConfig, razon_social: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} placeholder="Razón Social" />
                <input type="text" value={storeConfig.nit} onChange={(e) => setStoreConfig({ ...storeConfig, nit: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} placeholder="NIT" />
                <input type="text" value={storeConfig.direccion} onChange={(e) => setStoreConfig({ ...storeConfig, direccion: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} placeholder="Dirección" />
                <input type="text" value={storeConfig.telefono} onChange={(e) => setStoreConfig({ ...storeConfig, telefono: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} placeholder="Teléfono" />
                <button type="submit" style={{ padding: '1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>💾 Guardar Cambios</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>☀️ Abrir Turno Local</h3>
            <input type="text" value={formatCOP(shiftBaseInput)} onChange={(e) => setShiftBaseInput(e.target.value.replace(/\D/g, ''))} placeholder="Base en Caja ($)" style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleOpenShift} style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Iniciar</button>
              <button onClick={() => setShowShiftModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <form onSubmit={handleSaveNewProduct} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>➕ Producto Local (Caja)</h3>
            <input type="text" placeholder="Código de Barras" value={newProd.barcode} onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Nombre" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Precio Local ($)" value={formatCOP(newProd.sale_price)} onChange={(e) => setNewProd({ ...newProd, sale_price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Stock Local Inicial" value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Guardar</button>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {editingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <form onSubmit={handleUpdateProduct} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>✏️ Editar Local</h3>
            <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Precio Local ($)" value={formatCOP(editingProduct.sale_price)} onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Stock" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Actualizar</button>
              <button type="button" onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {(showAddPreventaModal || editingPreventaProduct) && (() => {
        const prod = editingPreventaProduct || newPreventaProd;
        const setProd = editingPreventaProduct ? setEditingPreventaProduct : setNewPreventaProd;
        const onSubmit = editingPreventaProduct ? handleUpdatePreventaProduct : handleSavePreventaProduct;
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <form onSubmit={onSubmit} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '400px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ margin: 0, color: '#eab308' }}>{editingPreventaProduct ? '✏️ Editar' : '➕ Nuevo'} Preventista</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" placeholder="Cód Único" value={prod.barcode} readOnly={!!editingPreventaProduct} onChange={(e) => setProd({ ...prod, barcode: e.target.value })} style={{ width: '40%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
                <input type="text" placeholder="Nombre" value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} style={{ width: '60%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Precio Base 1 Unidad ($)</label>
                  <input type="text" value={formatCOP(prod.price)} onChange={(e) => setProd({ ...prod, price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stock de Ruta</label>
                  <input type="number" value={prod.stock} onChange={(e) => setProd({ ...prod, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
                </div>
              </div>
              <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#38bdf8' }}>Descuentos Automáticos (%)</strong>
                  <button type="button" onClick={addDiscountRule} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>+ Rango</button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.8rem' }}>Ej: De 2 a 5 uds = 5% desc. Dejar Max vacío para "En adelante".</div>
                {discountRules.map((rule, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input type="number" placeholder="Min" value={rule.min} onChange={(e) => updateDiscountRule(index, 'min', e.target.value)} style={{ width: '30%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
                    <span style={{ color: '#94a3b8' }}>a</span>
                    <input type="number" placeholder="Max" value={rule.max} onChange={(e) => updateDiscountRule(index, 'max', e.target.value)} style={{ width: '30%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                    <input type="number" placeholder="%" value={rule.discount} onChange={(e) => updateDiscountRule(index, 'discount', e.target.value)} style={{ width: '25%', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
                    <button type="button" onClick={() => removeDiscountRule(index)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '4px', fontWeight: 'bold' }}>X</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>{editingPreventaProduct ? 'Actualizar' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowAddPreventaModal(false); setEditingPreventaProduct(null); }} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
              </div>
            </form>
          </div>
        );
      })()}

      {showTxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <form onSubmit={handleSaveTransaction} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>➕ Registro Contable</h3>
            <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Ingreso">🟢 Ingreso</option>
              <option value="Egreso">🔴 Egreso / Gasto</option>
            </select>
            <input type="text" placeholder="Categoría (Ej: Servicios)" value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Descripción" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Monto ($)" value={formatCOP(newTx.amount)} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Guardar</button>
              <button type="button" onClick={() => setShowTxModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <form onSubmit={handleSaveUser} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '340px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#38bdf8' }}>👤 Nuevo Usuario</h3>
            <input type="text" placeholder="Nombre Completo" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Usuario" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="password" placeholder="Contraseña" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Cajero">Cajero</option>
              <option value="Preventista">Preventista</option>
              <option value="Entregador">Entregador</option>
              <option value="Administrador">Administrador</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Crear</button>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}