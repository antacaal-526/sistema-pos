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
    razon_social: 'TERRA FRUTOS SECOS',
    nit: '40044029-8',
    direccion: 'Cra 7 #15-63, Tunja, Boyacá',
    telefono: '3183142180',
    actividad: 'VENTA DE FRUTOS SECOS, MANÍ, HABAS, PATACÓN, AL DETAL Y POR MAYOR',
    footer_msg: '¡Gracias por su compra!'
  });

  const [lastInvoice, setLastInvoice] = useState(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerDoc, setCustomerDoc] = useState('222222222222');
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [customerEmail, setCustomerEmail] = useState('');

  const [invSearch, setInvSearch] = useState('');
  const [outSearch, setOutSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProd, setNewProd] = useState({ barcode: '', name: '', sale_price: '', wholesale_price: '', stock: '', min_stock: '3' });

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
      } catch (e) {
        localStorage.removeItem('pos_user');
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (navigator.onLine) {
        checkActiveShift(currentUser.name);
        loadConfig();
        loadProductsOnline();
        loadTransactions();
        loadUsersOnline();
        loadShifts();
      } else {
        // Carga local si no hay internet
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
        await db.products.bulkPut(data); // Actualiza copia local
      }
    } catch (e) { loadProductsLocal(); }
  };

  const loadProductsLocal = async () => {
    const data = await db.products.toArray();
    setProducts(data);
  };

  const loadUsersOnline = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
        await db.users.bulkPut(data);
      }
    } catch (e) { console.error(e); }
  };

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) setStoreConfig((prev) => ({ ...prev, ...await res.json() }));
    } catch (e) { console.log('Sin internet para config'); }
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/transactions`);
      if (res.ok) setTransactions(await res.json());
    } catch (e) {}
  };

  const loadShifts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/shifts`);
      if (res.ok) setShiftsList(await res.json());
    } catch (e) {}
  };

  const checkActiveShift = async (userName) => {
    try {
      const res = await fetch(`${API_URL}/api/shifts/active?user_name=${encodeURIComponent(userName)}`);
      if (res.ok) setActiveShift(await res.json());
    } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    // OFFLINE LOGIN
    if (!navigator.onLine) {
      try {
        const localUser = await db.users.where('username').equals(loginUser.toLowerCase().trim()).first();
        if (localUser && localUser.password === loginPass.trim()) {
          setCurrentUser(localUser);
          localStorage.setItem('pos_user', JSON.stringify(localUser));
          return;
        } else {
          return setLoginError('Sin conexión. Usuario/Clave local incorrectos.');
        }
      } catch (err) {
        return setLoginError('Error validando en base local.');
      }
    }

    // ONLINE LOGIN
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
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (e) {
      setLoginError('Error de red. Intenta nuevamente.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pos_user');
    setCurrentUser(null);
    setActiveShift(null);
    setCart([]);
  };

  const handleOpenShift = async () => {
    const baseValue = parseCOP(shiftBaseInput);
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: currentUser.name, start_amount: baseValue }) });
      if (res.ok) {
        setShowShiftModal(false);
        setShiftBaseInput('');
        checkActiveShift(currentUser.name);
        loadShifts();
      }
    } catch (e) { alert('Error al abrir turno'); }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (!window.confirm('¿Desea cerrar el turno actual?')) return;
    try {
      const res = await fetch(`${API_URL}/api/shifts/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shift_id: activeShift.id }) });
      const data = await res.json();
      if (res.ok && data.success) {
        setShiftSummary(data.summary);
        setActiveShift(null);
        loadShifts();
      }
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
        body: JSON.stringify({ shift_id: activeShift?.id || null, user_name: currentUser.name, customer_doc: customerDoc, customer_name: customerName, customer_email: customerEmail, items: cart, description: desc, total: totalCart, payment_method: paymentMethod, amount_paid: received, change_given: changeGiven, sale_type: saleType })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastInvoice({ number: data.invoice_number, date: new Date().toLocaleString(), customerDoc, customerName, items: [...cart], total: totalCart, paymentMethod, received, changeGiven, seller: currentUser.name });
        alert(`✅ Venta Exitosa. Factura #: ${data.invoice_number}`);
        if (saleType === 'Facturada') setTimeout(() => window.print(), 300);
        setCart([]); setAmountPaid(''); setCustomerEmail(''); loadProductsOnline(); loadTransactions();
      }
    } catch (e) { alert('Error de red'); }
  };

  // MANTENEMOS LAS FUNCIONES DE INVENTARIO Y USUARIOS (REDUCIDAS POR ESPACIO PERO FUNCIONALES)
  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    const payload = { ...newProd, sale_price: parseCOP(newProd.sale_price), wholesale_price: parseCOP(newProd.wholesale_price), stock: parseCOP(newProd.stock), min_stock: parseCOP(newProd.min_stock) || 3 };
    await fetch(`${API_URL}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowAddModal(false); loadProductsOnline();
  };
  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    const payload = { ...editingProduct, sale_price: parseCOP(editingProduct.sale_price), wholesale_price: parseCOP(editingProduct.wholesale_price), stock: parseCOP(editingProduct.stock), min_stock: parseCOP(editingProduct.min_stock) || 3 };
    await fetch(`${API_URL}/api/products/${editingProduct.barcode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setEditingProduct(null); loadProductsOnline();
  };
  const handleDeleteProduct = async (barcode) => {
    if (window.confirm('Eliminar producto?')) { await fetch(`${API_URL}/api/products/${barcode}`, { method: 'DELETE' }); loadProductsOnline(); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeConfig) });
    alert('Configuración guardada');
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

  return (
    <>
      <style>{`
        /* CSS RESPONSIVE REPARADO PARA SCROLL MÓVIL */
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
        
        /* MÓVIL: SE CORRIGE EL SCROLL Y LOS TAMAÑOS */
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
        }
      `}</style>

      {/* COMPROBANTE DE IMPRESIÓN (OCULTO EN PANTALLA) */}
      <div id="print-receipt" className="print-only">
        {lastInvoice ? (
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
        {/* BARRA LATERAL (SUPERIOR EN MÓVIL) */}
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
              <button onClick={() => setActiveTab('pos')} className={`nav-btn ${activeTab === 'pos' ? 'active' : ''}`}>💳 Caja</button>
              {isAdmin && (
                <>
                  <button onClick={() => setActiveTab('inventory')} className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}>📦 Inventario</button>
                  <button onClick={() => setActiveTab('dian')} className={`nav-btn ${activeTab === 'dian' ? 'active' : ''}`}>⚙️ Negocio</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="pos-content">
          {activeTab === 'pos' && (
            <div className="pos-grid-container">
              
              {/* PRODUCTOS */}
              <div className="pos-products-area">
                <input type="text" placeholder="🔍 Buscar por código o nombre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '1rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
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

              {/* CARRITO */}
              <div className="pos-cart">
                <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>🛒 Carrito ({cart.length})</h3>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}><h2 style={{ color: '#38bdf8', margin: 0 }}>📦 Inventario</h2><button onClick={() => setShowAddModal(true)} style={{ padding: '0.8rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Ingresar Producto</button></div>
              <input type="text" placeholder="🔍 Buscar..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th style={{ padding: '0.75rem' }}>Cód</th><th style={{ padding: '0.75rem' }}>Nombre</th><th style={{ padding: '0.75rem' }}>Local</th><th style={{ padding: '0.75rem' }}>Preventa</th><th style={{ padding: '0.75rem' }}>Stock</th><th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {products.filter((p) => p.name.toLowerCase().includes(invSearch.toLowerCase()) || p.barcode.includes(invSearch)).map((p) => (
                      <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem' }}>{p.barcode}</td>
                        <td style={{ padding: '0.75rem', minWidth: '150px' }}>{p.name}</td>
                        <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>${p.sale_price?.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '0.75rem', color: '#38bdf8', fontWeight: 'bold' }}>${p.wholesale_price?.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{p.stock}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', minWidth: '120px' }}><button onClick={() => setEditingProduct(p)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', marginRight: '0.5rem' }}>✏️</button><button onClick={() => handleDeleteProduct(p.barcode)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'dian' && (
            <div style={{ maxWidth: '600px' }}>
              <h2 style={{ color: '#38bdf8', marginBottom: '1.5rem' }}>⚙️ Configuración del Negocio</h2>
              <form onSubmit={handleSaveConfig} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" value={storeConfig.razon_social} onChange={(e) => setStoreConfig({ ...storeConfig, razon_social: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} placeholder="Razón Social" />
                <input type="text" value={storeConfig.nit} onChange={(e) => setStoreConfig({ ...storeConfig, nit: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} placeholder="NIT" />
                <button type="submit" style={{ padding: '1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>💾 Guardar Cambios</button>
              </form>
            </div>
          )}

        </div>
      </div>

      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>☀️ Abrir Turno</h3>
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
            <h3 style={{ margin: 0, color: '#38bdf8' }}>➕ Nuevo Producto</h3>
            <input type="text" placeholder="Código de Barras" value={newProd.barcode} onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Nombre" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Precio Local ($)" value={formatCOP(newProd.sale_price)} onChange={(e) => setNewProd({ ...newProd, sale_price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Precio Mayorista ($)" value={formatCOP(newProd.wholesale_price)} onChange={(e) => setNewProd({ ...newProd, wholesale_price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Stock" value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
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
            <h3 style={{ margin: 0, color: '#38bdf8' }}>✏️ Editar {editingProduct.barcode}</h3>
            <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Precio Local ($)" value={formatCOP(editingProduct.sale_price)} onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="text" placeholder="Precio Mayorista ($)" value={formatCOP(editingProduct.wholesale_price)} onChange={(e) => setEditingProduct({ ...editingProduct, wholesale_price: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <input type="number" placeholder="Stock" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Actualizar</button>
              <button type="button" onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}