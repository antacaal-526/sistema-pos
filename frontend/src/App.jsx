import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Package, BarChart3, AlertTriangle, LogOut, Trash2, Users, Printer, QrCode, Clock, FileText, CheckCircle2 } from 'lucide-react';

const API_URL = `http://${window.location.hostname}:3001/api`;

// Función para peticiones seguras que evita el error Unexpected token '<'
const safeFetch = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } else {
      return { ok: false, error: "El servidor devolvió HTML. Verifica que 'node server.js' esté encendido en la carpeta backend." };
    }
  } catch (err) {
    return { ok: false, error: "Error de conexión con el Backend (puerto 3001)." };
  }
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  // Auth
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Pestañas
  const [tab, setTab] = useState('pos');

  // Turno de Caja
  const [currentShift, setCurrentShift] = useState(null);
  const [initialCashInput, setInitialCashInput] = useState('50000');
  const [realCashCloseInput, setRealCashCloseInput] = useState('');

  // POS
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [completedInvoice, setCompletedInvoice] = useState(null);

  // Precuentas / Modulos
  const [preaccountsList, setPreaccountsList] = useState([]);
  const [prodForm, setProdForm] = useState({ id: null, barcode: '', internal_code: '', name: '', category: '', cost_price: '', sale_price: '', stock: '', min_stock: '' });
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'empleado' });
  const [reportData, setReportData] = useState({ sales: [], totalSalesSum: 0 });

  const searchInputRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchCurrentShift();
      fetchProducts();
      fetchPreaccounts();
      fetchReports();
      fetchUsers();
    }
  }, [token]);

  useEffect(() => {
    if (tab === 'pos' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [tab, cart]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await safeFetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUser, password: loginPass })
    });

    if (res.ok) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('username', res.data.username);
      setToken(res.data.token);
      setRole(res.data.role);
      setUsername(res.data.username);
      setErrorMsg('');
    } else {
      setErrorMsg(res.data?.error || res.error);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken('');
    setRole('');
    setUsername('');
  };

  const fetchCurrentShift = async () => {
    const res = await safeFetch(`${API_URL}/shifts/current`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setCurrentShift(res.data);
  };

  const handleOpenShift = async () => {
    const res = await safeFetch(`${API_URL}/shifts/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ initial_cash: parseFloat(initialCashInput) || 0 })
    });
    if (res.ok) {
      alert(res.data.message || "Turno abierto.");
      fetchCurrentShift();
    } else {
      alert(res.data?.error || res.error);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    const res = await safeFetch(`${API_URL}/shifts/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ shift_id: currentShift.id, real_cash: parseFloat(realCashCloseInput) || 0 })
    });
    if (res.ok) {
      alert(`Turno cerrado.\nEsperado: $${res.data.expectedCash}\nEntregado: $${res.data.real_cash}\nDiferencia: $${res.data.difference}`);
      setCurrentShift(null);
      setRealCashCloseInput('');
    } else alert(res.data?.error || res.error);
  };

  const fetchProducts = async () => {
    const res = await safeFetch(`${API_URL}/products`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok && Array.isArray(res.data)) setProducts(res.data);
  };

  const fetchPreaccounts = async () => {
    const res = await safeFetch(`${API_URL}/preaccounts`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok && Array.isArray(res.data)) setPreaccountsList(res.data);
  };

  const fetchUsers = async () => {
    const res = await safeFetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok && Array.isArray(res.data)) setUsersList(res.data);
  };

  const fetchReports = async () => {
    const res = await safeFetch(`${API_URL}/reports/daily`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok && res.data) setReportData(res.data);
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const match = products.find(p => p.barcode === search || p.internal_code === search);
      if (match) { addToCart(match); setSearch(''); }
      else alert("Producto no encontrado.");
    }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return alert("Producto agotado en inventario.");
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return alert("Sin stock disponible suficiente.");
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else setCart([...cart, { ...product, quantity: 1 }]);
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));

  const totalCart = cart.reduce((acc, i) => acc + (i.sale_price * i.quantity), 0);
  const taxCart = totalCart * 0.19;
  const numericPaid = paymentMethod === 'EFECTIVO' ? (parseFloat(amountPaid) || 0) : totalCart;
  const changeGiven = numericPaid - totalCart;

  const handleCheckout = async (isPreaccount = false) => {
    if (!currentShift && !isPreaccount) return alert("Debe abrir un turno de caja antes de realizar una venta.");
    if (cart.length === 0) return alert("El carrito está vacío.");
    if (!isPreaccount && paymentMethod === 'EFECTIVO' && numericPaid < totalCart) {
      return alert("El dinero entregado es inferior al total.");
    }

    const res = await safeFetch(`${API_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        shift_id: currentShift ? currentShift.id : null,
        items: cart,
        total: totalCart,
        tax: taxCart,
        payment_method: paymentMethod,
        amount_paid: numericPaid,
        change_given: changeGiven < 0 ? 0 : changeGiven,
        customer_name: customerName || 'Consumidor Final',
        is_preaccount: isPreaccount
      })
    });

    if (res.ok) {
      if (isPreaccount) {
        alert("Precuenta guardada.");
        fetchPreaccounts();
      } else {
        setCompletedInvoice(res.data.invoice);
      }
      setCart([]);
      setAmountPaid('');
      setCustomerName('');
      fetchProducts();
      fetchReports();
    } else alert(res.data?.error || res.error);
  };

  const handleConvertPreaccount = async (id) => {
    const payMethod = prompt("Medio de Pago (EFECTIVO, TARJETA, NEQUI):", "EFECTIVO");
    if (!payMethod) return;

    const res = await safeFetch(`${API_URL}/sales/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ payment_method: payMethod, amount_paid: 0, change_given: 0 })
    });

    if (res.ok) {
      alert("Precuenta convertida a Factura de Venta.");
      fetchPreaccounts();
      fetchProducts();
      fetchReports();
    } else alert(res.data?.error || res.error);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await safeFetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newUser)
    });

    if (res.ok) {
      alert("Empleado creado exitosamente.");
      setNewUser({ username: '', password: '', role: 'empleado' });
      fetchUsers();
    } else alert(res.data?.error || res.error);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const method = prodForm.id ? 'PUT' : 'POST';
    const url = prodForm.id ? `${API_URL}/products/${prodForm.id}` : `${API_URL}/products`;

    const res = await safeFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(prodForm)
    });

    if (res.ok) {
      alert("Producto guardado.");
      setProdForm({ id: null, barcode: '', internal_code: '', name: '', category: '', cost_price: '', sale_price: '', stock: '', min_stock: '' });
      fetchProducts();
    } else alert(res.data?.error || res.error);
  };

  const handleCancelSale = async (saleId) => {
    if (!confirm(`¿Anular la Venta #${saleId}? Esto reajustará el stock.`)) return;
    const res = await safeFetch(`${API_URL}/sales/${saleId}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert("Venta anulada.");
      fetchProducts();
      fetchReports();
    } else alert(res.data?.error || res.error);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h1 className="text-3xl font-black text-amber-600 text-center">TERRA FRUTOS SECOS</h1>
          <p className="text-gray-500 text-sm text-center mb-6">Punto de Venta e Inventario</p>
          {errorMsg && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm mb-4">{errorMsg}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="block text-sm font-semibold">Usuario</label><input type="text" required className="w-full p-3 border rounded-lg" value={loginUser} onChange={e => setLoginUser(e.target.value)} /></div>
            <div><label className="block text-sm font-semibold">Contraseña</label><input type="password" required className="w-full p-3 border rounded-lg" value={loginPass} onChange={e => setLoginPass(e.target.value)} /></div>
            <button type="submit" className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg hover:bg-amber-700">Ingresar al Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  const outOfStockProducts = products.filter(p => p.stock <= (p.min_stock || 5));

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap justify-between items-center shadow-lg print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-amber-500">TERRA FRUTOS SECOS</h1>
          <span className="text-xs px-2 py-1 bg-amber-800 rounded font-bold uppercase">{role}</span>
        </div>

        <nav className="flex flex-wrap gap-2 my-2 sm:my-0">
          <button onClick={() => setTab('pos')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${tab === 'pos' ? 'bg-amber-600' : 'hover:bg-slate-800'}`}>
            <ShoppingCart size={16} /> Caja POS
          </button>
          
          <button onClick={() => setTab('preaccounts')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm relative ${tab === 'preaccounts' ? 'bg-amber-600' : 'hover:bg-slate-800'}`}>
            <FileText size={16} /> Precuentas
            {preaccountsList.length > 0 && <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold ml-1">{preaccountsList.length}</span>}
          </button>

          <button onClick={() => setTab('out_of_stock')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${tab === 'out_of_stock' ? 'bg-red-600' : 'hover:bg-slate-800'}`}>
            <AlertTriangle size={16} /> Agotados
          </button>

          <button onClick={() => setTab('inventory')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${tab === 'inventory' ? 'bg-amber-600' : 'hover:bg-slate-800'}`}>
            <Package size={16} /> Inventario
          </button>

          <button onClick={() => setTab('users')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${tab === 'users' ? 'bg-amber-600' : 'hover:bg-slate-800'}`}>
            <Users size={16} /> Empleados
          </button>

          <button onClick={() => setTab('reports')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${tab === 'reports' ? 'bg-amber-600' : 'hover:bg-slate-800'}`}>
            <BarChart3 size={16} /> Reportes
          </button>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-300"><b>{username}</b></span>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full print:p-0">
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex flex-wrap justify-between items-center gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Clock className={currentShift ? "text-green-600" : "text-amber-600"} size={24} />
            <div>
              <h3 className="font-bold text-gray-800 text-sm">
                Estado de la Caja: {currentShift ? <span className="text-green-600 font-extrabold">TURNO ABIERTO (# {currentShift.id})</span> : <span className="text-red-600 font-extrabold">TURNO CERRADO</span>}
              </h3>
              {currentShift && <p className="text-xs text-gray-500">Apertura: {new Date(currentShift.start_time).toLocaleString()} | Base Dinero: ${currentShift.initial_cash.toLocaleString()}</p>}
            </div>
          </div>

          {!currentShift ? (
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Base dinero ($)" className="p-2 border rounded-lg text-sm w-36" value={initialCashInput} onChange={e => setInitialCashInput(e.target.value)} />
              <button onClick={handleOpenShift} className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-green-700">Abrir Turno</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Dinero real caja ($)" className="p-2 border rounded-lg text-sm w-40" value={realCashCloseInput} onChange={e => setRealCashCloseInput(e.target.value)} />
              <button onClick={handleCloseShift} className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-red-700">Arqueo y Cierre</button>
            </div>
          )}
        </div>

        {/* 1. CAJA POS */}
        {tab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border">
              <div className="relative mb-4">
                <input ref={searchInputRef} type="text" placeholder="Escanear Código de Barras / QR o Nombre..." className="w-full p-3 pl-10 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleBarcodeKeyDown} />
                <QrCode className="absolute left-3 top-3.5 text-gray-400" size={20} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search))).map(product => (
                  <div key={product.id} onClick={() => addToCart(product)} className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between transition ${product.stock <= 0 ? 'bg-gray-100 opacity-50' : 'bg-white hover:border-amber-500 hover:shadow-md'}`}>
                    <div><h3 className="font-bold text-gray-800 text-sm">{product.name}</h3><p className="text-xs text-gray-400">Cód: {product.barcode || 'N/A'}</p></div>
                    <div className="mt-3 flex justify-between items-end">
                      <span className="text-base font-black text-amber-600">${product.sale_price.toLocaleString()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${product.stock <= product.min_stock ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>Stock: {product.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border flex flex-col justify-between h-[600px]">
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><ShoppingCart size={20} /> Factura de Venta</h2>
                <input type="text" placeholder="Nombre Cliente / NIT (Opcional)" className="w-full p-2 border rounded-lg text-xs mb-3" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <div className="space-y-2 overflow-y-auto max-h-[180px] pr-1">
                  {cart.length === 0 ? <p className="text-center text-gray-400 py-6 text-sm">Escanea un producto.</p> : cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-sm">
                      <div><p className="font-semibold">{item.name}</p><p className="text-xs text-gray-500">${item.sale_price.toLocaleString()} x {item.quantity}</p></div>
                      <div className="flex items-center gap-2"><span className="font-bold">${(item.sale_price * item.quantity).toLocaleString()}</span><button onClick={() => removeFromCart(item.id)} className="text-red-500"><Trash2 size={16} /></button></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <div className="flex justify-between text-xl font-black"><span>TOTAL:</span><span className="text-amber-600">${totalCart.toLocaleString()}</span></div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Medio de Pago:</label>
                  <select className="w-full p-2 border rounded-lg font-bold text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="EFECTIVO">💵 Efectivo</option>
                    <option value="TARJETA">💳 Tarjeta (Datáfono)</option>
                    <option value="NEQUI/TRANSFERENCIA">📱 Nequi / Transferencia</option>
                  </select>
                </div>

                {paymentMethod === 'EFECTIVO' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600">Paga con ($):</label>
                    <input type="number" placeholder="Ej: 50000" className="w-full p-2 border rounded-lg text-lg font-bold" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                    <div className="flex justify-between text-sm font-bold mt-1 bg-gray-100 p-2 rounded"><span>Cambio:</span><span className={changeGiven < 0 ? "text-red-600" : "text-green-600"}>${changeGiven >= 0 ? changeGiven.toLocaleString() : '0'}</span></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleCheckout(true)} disabled={cart.length === 0} className="bg-amber-500 text-white font-bold py-3 rounded-xl text-xs hover:bg-amber-600 disabled:opacity-50">
                    Guardar Precuenta
                  </button>
                  <button onClick={() => handleCheckout(false)} disabled={cart.length === 0} className="bg-green-600 text-white font-bold py-3 rounded-xl text-xs hover:bg-green-700 disabled:opacity-50">
                    Facturar y Cobrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. PRECUENTAS */}
        {tab === 'preaccounts' && (
          <div className="bg-white p-6 rounded-2xl border print:hidden">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText /> Precuentas y Pedidos Pendientes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {preaccountsList.length === 0 ? <p className="text-gray-400">No hay precuentas registradas.</p> : preaccountsList.map(p => (
                <div key={p.id} className="p-4 border rounded-xl bg-amber-50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-amber-900">Precuenta #{p.id}</h3>
                    <p className="text-xs text-gray-600">Cliente: {p.customer_name}</p>
                    <p className="text-xs text-gray-500">Fecha: {new Date(p.created_at).toLocaleString()}</p>
                    <p className="text-lg font-black text-amber-600 mt-2">${p.total.toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleConvertPreaccount(p.id)} className="mt-4 w-full bg-green-600 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 hover:bg-green-700">
                    <CheckCircle2 size={16} /> Convertir a Factura
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. AGOTADOS */}
        {tab === 'out_of_stock' && (
          <div className="bg-white p-6 rounded-2xl border print:hidden">
            <h2 className="text-xl font-bold mb-4 text-amber-600 flex items-center gap-2"><AlertTriangle /> Productos Agotados / Stock Crítico</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b"><th className="p-3">Código</th><th className="p-3">Producto</th><th className="p-3">Stock Actual</th><th className="p-3">Stock Mínimo</th><th className="p-3">Estado</th></tr>
                </thead>
                <tbody>
                  {outOfStockProducts.length === 0 ? (
                    <tr><td colSpan="5" className="p-4 text-center text-gray-500">No hay productos agotados actualmente.</td></tr>
                  ) : outOfStockProducts.map(p => (
                    <tr key={p.id} className="border-b">
                      <td className="p-3 font-mono">{p.barcode || p.internal_code || '-'}</td>
                      <td className="p-3 font-bold">{p.name}</td>
                      <td className="p-3 font-black text-red-600">{p.stock}</td>
                      <td className="p-3">{p.min_stock || 5}</td>
                      <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${p.stock === 0 ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{p.stock === 0 ? 'AGOTADO' : 'CRÍTICO'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. INVENTARIO */}
        {tab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="bg-white p-5 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-bold mb-4">{prodForm.id ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <form onSubmit={handleSaveProduct} className="space-y-3">
                <input type="text" placeholder="Código de Barras / QR" required className="w-full p-2 border rounded" value={prodForm.barcode} onChange={e => setProdForm({...prodForm, barcode: e.target.value})} />
                <input type="text" placeholder="Nombre del Producto" required className="w-full p-2 border rounded" value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="0.01" placeholder="Costo ($)" required className="p-2 border rounded" value={prodForm.cost_price} onChange={e => setProdForm({...prodForm, cost_price: e.target.value})} />
                  <input type="number" step="0.01" placeholder="Venta ($)" required className="p-2 border rounded" value={prodForm.sale_price} onChange={e => setProdForm({...prodForm, sale_price: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Stock Actual" required className="p-2 border rounded" value={prodForm.stock} onChange={e => setProdForm({...prodForm, stock: e.target.value})} />
                  <input type="number" placeholder="Stock Mínimo" required className="p-2 border rounded" value={prodForm.min_stock} onChange={e => setProdForm({...prodForm, min_stock: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-amber-600 text-white font-bold py-2 rounded hover:bg-amber-700">Guardar Producto</button>
                {prodForm.id && <button type="button" onClick={() => setProdForm({ id: null, barcode: '', internal_code: '', name: '', category: '', cost_price: '', sale_price: '', stock: '', min_stock: '' })} className="w-full bg-gray-300 text-gray-700 font-bold py-2 rounded mt-1">Cancelar Edición</button>}
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border overflow-x-auto">
              <h2 className="text-lg font-bold mb-4">Gestión General de Productos ({products.length})</h2>
              <table className="w-full text-left text-sm border-collapse">
                <thead><tr className="bg-gray-100 border-b"><th className="p-2">Código</th><th className="p-2">Nombre</th><th className="p-2">Precio Venta</th><th className="p-2">Stock</th><th className="p-2">Acciones</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono">{p.barcode || '-'}</td>
                      <td className="p-2 font-bold">{p.name}</td>
                      <td className="p-2 text-amber-600 font-bold">${p.sale_price ? p.sale_price.toLocaleString() : '0'}</td>
                      <td className="p-2"><span className={`px-2 py-0.5 rounded font-bold ${p.stock <= (p.min_stock || 5) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{p.stock}</span></td>
                      <td className="p-2"><button onClick={() => setProdForm(p)} className="text-amber-600 underline font-semibold">Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. EMPLEADOS */}
        {tab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="bg-white p-5 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users /> Crear Nuevo Empleado</h2>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <input type="text" placeholder="Nombre de usuario" required className="w-full p-2 border rounded" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                <input type="password" placeholder="Contraseña" required className="w-full p-2 border rounded" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                <select className="w-full p-2 border rounded font-semibold" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="empleado">Rol: Empleado (Cajero)</option>
                  <option value="admin">Rol: Administrador (Jefe)</option>
                </select>
                <button type="submit" className="w-full bg-amber-600 text-white font-bold py-2 rounded hover:bg-amber-700">Registrar Usuario</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-bold mb-4">Lista de Empleados Registrados</h2>
              <table className="w-full text-left text-sm border-collapse">
                <thead><tr className="bg-gray-100 border-b"><th className="p-3">ID</th><th className="p-3">Usuario</th><th className="p-3">Rol / Permiso</th></tr></thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} className="border-b">
                      <td className="p-3 font-mono">#{u.id}</td>
                      <td className="p-3 font-bold">{u.username}</td>
                      <td className="p-3"><span className="px-2 py-1 bg-gray-200 rounded text-xs font-bold uppercase">{u.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. REPORTES */}
        {tab === 'reports' && (
          <div className="space-y-4 print:hidden">
            <div className="bg-white p-5 rounded-2xl border flex justify-between items-center shadow-sm">
              <div><h2 className="text-sm font-semibold text-gray-500">Total Ingresos Acumulados</h2><p className="text-3xl font-black text-green-600">${reportData.totalSalesSum ? reportData.totalSalesSum.toLocaleString() : '0'}</p></div>
              <button onClick={fetchReports} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg font-bold text-sm">Actualizar Datos</button>
            </div>

            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <h3 className="font-bold mb-3 text-lg">Historial de Ventas y Auditoría</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead><tr className="bg-gray-50 border-b"><th className="p-3">ID Venta</th><th className="p-3">Fecha</th><th className="p-3">Cajero</th><th className="p-3">Estado</th><th className="p-3">Total</th><th className="p-3 text-center">Acción</th></tr></thead>
                  <tbody>
                    {reportData.sales && reportData.sales.map(s => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-bold">#{s.id}</td>
                        <td className="p-3 text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="p-3 font-medium">{s.user_name}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${s.status === 'COMPLETADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.status}</span></td>
                        <td className="p-3 font-black">${s.total ? s.total.toLocaleString() : '0'}</td>
                        <td className="p-3 text-center">{s.status === 'COMPLETADA' && <button onClick={() => handleCancelSale(s.id)} className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1 rounded-lg text-xs font-bold">Anular Venta</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TICKET DE IMPRESIÓN CON NOMBRE "TERRA FRUTOS SECOS" */}
        {completedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full print:w-full print:max-w-none print:shadow-none">
              <div id="pos-ticket" className="font-mono text-xs text-black space-y-1">
                <div className="text-center font-bold text-sm">TERRA FRUTOS SECOS</div>
                <div className="text-center text-xs">Recibo de Venta POS</div>
                <div className="text-center">--------------------------------</div>
                <div>Factura N°: POS-{completedInvoice.saleId}</div>
                <div>Fecha: {completedInvoice.date}</div>
                <div>Cajero: {completedInvoice.cashier}</div>
                <div>Cliente: {completedInvoice.customer_name}</div>
                <div>Medio de Pago: {completedInvoice.payment_method}</div>
                <div className="text-center">--------------------------------</div>
                
                {completedInvoice.items && completedInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.name} x{item.quantity}</span>
                    <span>${(item.sale_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}

                <div className="text-center">--------------------------------</div>
                <div className="flex justify-between font-bold text-sm"><span>TOTAL FACTURA:</span><span>${completedInvoice.total.toLocaleString()}</span></div>
                <div className="flex justify-between text-[10px] text-gray-600"><span>IVA Incluido (19%):</span><span>${completedInvoice.tax.toLocaleString()}</span></div>
                
                {completedInvoice.payment_method === 'EFECTIVO' && (
                  <>
                    <div className="flex justify-between"><span>Recibido:</span><span>${completedInvoice.amount_paid.toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold"><span>Cambio:</span><span>${completedInvoice.change_given.toLocaleString()}</span></div>
                  </>
                )}

                <div className="text-center">--------------------------------</div>
                <div className="text-[9px] break-all text-gray-500"><b>CUFE:</b> {completedInvoice.cufe}</div>
                
                <div className="flex flex-col items-center my-2">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://factura.dian.gov.co/validador/${completedInvoice.cufe}`} alt="QR Fiscal" className="w-24 h-24" />
                  <span className="text-[8px] text-gray-400 mt-1">Representación Gráfica POS - Terra Frutos Secos</span>
                </div>
                <div className="text-center font-bold">¡Gracias por su compra!</div>
              </div>

              <div className="mt-4 flex gap-2 print:hidden">
                <button onClick={() => window.print()} className="flex-1 bg-amber-600 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1 text-xs hover:bg-amber-700"><Printer size={16} /> Imprimir Tirilla</button>
                <button onClick={() => setCompletedInvoice(null)} className="bg-gray-300 text-gray-800 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-400">Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}