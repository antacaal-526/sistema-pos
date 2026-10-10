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

const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
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
  
  const [products, setProducts] = useState([]);
  const [invSearch, setInvSearch] = useState('');
  const [outSearch, setOutSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProd, setNewProd] = useState({ barcode: '', name: '', sale_price: '', stock: '', min_stock: '3' });
  
  const [preventaProducts, setPreventaProducts] = useState([]);
  const [invPreventaSearch, setInvPreventaSearch] = useState('');
  const [showAddPreventaModal, setShowAddPreventaModal] = useState(false);
  const [editingPreventaProduct, setEditingPreventaProduct] = useState(null);
  const [newPreventaProd, setNewPreventaProd] = useState({ barcode: '', name: '', price: '', stock: '', min_stock: '3' });
  const [discountRules, setDiscountRules] = useState([]);
  
  const [preventaOrders, setPreventaOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [customerEmail, setCustomerEmail] = useState('');
  
  const [baskets, setBaskets] = useState([{ id: generateUUID(), name: 'Caja 1', items: [] }]);
  const [activeBasketId, setActiveBasketId] = useState(null);
  const [restockSearch, setRestockSearch] = useState('');
  const [isRestocking, setIsRestocking] = useState(false);
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [restockRequests, setRestockRequests] = useState([]);
  const [subTabRestock, setSubTabRestock] = useState('armar'); 
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isShiftProcessing, setIsShiftProcessing] = useState(false);
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/ping`).catch(() => {});
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
        loadRestockRequests();
      } else {
        loadProductsLocal();
      }
    }
    if (baskets.length > 0 && !activeBasketId) {
      setActiveBasketId(baskets[0].id);
    }
    window.addEventListener('sync-completed', handleSyncCompleted);
    return () => window.removeEventListener('sync-completed', handleSyncCompleted);
  }, [currentUser, baskets, activeBasketId]);

  const handleSyncCompleted = () => { 
    loadTransactions(); 
    loadShifts(); 
    loadPreventaOrders(); 
    loadRestockRequests();
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'restock') setSubTabRestock('armar');
    setIsMobileMenuOpen(false); 
  };

  const loadProductsOnline = async () => { try { const res = await fetch(`${API_URL}/api/products`); if (res.ok) { const data = await res.json(); setProducts(data); await db.products.bulkPut(data); } } catch (e) { loadProductsLocal(); } };
  const loadProductsLocal = async () => { setProducts(await db.products.toArray()); };
  const loadPreventaProductsOnline = async () => { try { const res = await fetch(`${API_URL}/api/preventa-products`); if (res.ok) { const data = await res.json(); setPreventaProducts(data); await db.preventa_products.bulkPut(data); } } catch (e) {} };
  const loadPreventaOrders = async () => { try { const res = await fetch(`${API_URL}/api/orders/detailed`); if (res.ok) setPreventaOrders(await res.json()); } catch (e) {} };
  const loadUsersOnline = async () => { try { const res = await fetch(`${API_URL}/api/users`); if (res.ok) { const data = await res.json(); setUsersList(data); await db.users.bulkPut(data); } } catch (e) {} };
  const loadConfig = async () => { try { const res = await fetch(`${API_URL}/api/config`); if (res.ok) { const data = await res.json(); setStoreConfig((prev) => ({ ...prev, ...data })); } } catch (e) {} };
  const loadTransactions = async () => { try { const res = await fetch(`${API_URL}/api/transactions`); if (res.ok) setTransactions(await res.json()); } catch (e) {} };
  const loadShifts = async () => { try { const res = await fetch(`${API_URL}/api/shifts`); if (res.ok) setShiftsList(await res.json()); } catch (e) {} };
  const checkActiveShift = async (userName) => { try { const res = await fetch(`${API_URL}/api/shifts/active?user_name=${encodeURIComponent(userName)}`); if (res.ok) setActiveShift(await res.json()); } catch (e) {} };
  const loadRestockRequests = async () => { try { const res = await fetch(`${API_URL}/api/restock-requests`); if (res.ok) setRestockRequests(await res.json()); } catch (e) {} };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError('');

    let localFound = false;
    try {
      const localUser = await db.users.where('username').equals(loginUser.toLowerCase().trim()).first();
      if (localUser && localUser.password === loginPass.trim()) {
        setCurrentUser(localUser);
        localStorage.setItem('pos_user', JSON.stringify(localUser));
        localFound = true;
      }
    } catch (err) {
      console.log("Aviso base local:", err);
    }

    if (localFound) {
      setIsLoggingIn(false);
      if (navigator.onLine) processSyncQueue();
      return;
    }

    if (!navigator.onLine) {
      const count = await db.users.count();
      if (count === 0) {
        setLoginError('Modo Offline: Base local vacía. Debes ingresar con internet al menos una vez en este PC.');
      } else {
        setLoginError('Modo Offline: Usuario/Clave incorrectos según los registros locales.');
      }
      setIsLoggingIn(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUser, password: loginPass }) });
      const data = await res.json();
      if (res.ok && data.success) { 
        setCurrentUser(data.user); 
        localStorage.setItem('pos_user', JSON.stringify(data.user)); 
        processSyncQueue(); 
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (e) { 
      setLoginError('Error de red al conectar con el servidor.'); 
    } finally { 
      setIsLoggingIn(false); 
    }
  };

  const handleLogout = () => { localStorage.removeItem('pos_user'); setCurrentUser(null); setActiveShift(null); setCart([]); };

  const handleOpenShift = async () => {
    if (isShiftProcessing) return;
    setIsShiftProcessing(true);
    const baseValue = parseCOP(shiftBaseInput);
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: currentUser.name, start_amount: baseValue }) });
      if (res.ok) { setShowShiftModal(false); setShiftBaseInput(''); checkActiveShift(currentUser.name); loadShifts(); }
    } catch (e) { alert('Error al abrir turno. Revise su conexión.'); }
    finally { setIsShiftProcessing(false); }
  };

  const handleCloseShift = async () => {
    if (!activeShift || isShiftProcessing) return;
    setIsShiftProcessing(true);
    const counted = parseCOP(countedCashInput);
    try {
      const res = await fetch(`${API_URL}/api/shifts/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shift_id: activeShift.id, counted_cash: counted }) });
      const data = await res.json();
      if (res.ok && data.success) { setShiftSummary(data.summary); setActiveShift(null); setShowCloseShiftModal(false); setCountedCashInput(''); loadShifts(); } 
      else { alert('Error al cerrar: ' + (data.error || '')); }
    } catch (e) { alert('Error de red al cerrar el turno'); }
    finally { setIsShiftProcessing(false); }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm(`¿Estás seguro de eliminar el reporte de turno #${id}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/shifts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) { alert('🗑️ Reporte eliminado correctamente.'); loadShifts(); } 
      else { alert(`No se pudo eliminar el reporte. Servidor dice: ${data.error || 'Error desconocido'}`); }
    } catch (e) { alert('Error de red'); }
  };

  const handleDeletePreventaOrderAdmin = async (id, customerName) => {
    if (!window.confirm(`¿Estás seguro de eliminar el pedido de ${customerName || 'este cliente'}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) { alert('🗑️ Pedido eliminado correctamente.'); loadPreventaOrders(); loadPreventaProductsOnline(); } 
      else { const err = await res.json(); alert(`⚠️ No se pudo eliminar: ${err.error}`); }
    } catch (e) { alert('Error de conexión.'); }
  };

  const handleMonthClose = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA DE CIERRE DE MES ⚠️\n\n¿Estás seguro de que deseas ELIMINAR TODO EL HISTORIAL de Ventas, Turnos Cerrados, Pedidos Cobrados y Contabilidad?\n\nEsta acción dejará el sistema en cero para iniciar un nuevo mes y NO se puede deshacer. Asegúrate de haber descargado los CSV primero.")) return;
    if (!window.confirm("¿ÚLTIMA CONFIRMACIÓN? Se borrará el historial viejo para liberar espacio y acelerar el sistema.")) return;
    try {
      const res = await fetch(`${API_URL}/api/clean-history`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) { alert('✅ CIERRE DE MES COMPLETADO. El historial ha sido limpiado y el sistema está optimizado.'); loadShifts(); loadTransactions(); loadPreventaOrders(); } 
      else { alert(`Error al limpiar: ${data.error || 'Desconocido'}`); }
    } catch(e) { alert('Error de conexión.'); }
  };

  const handleDocChange = async (val) => {
    setCustomerDoc(val);
    if (val.length >= 4) {
      const existing = await db.customers.where('id').equals(val).first();
      if (existing) { setCustomerName(existing.name); if (existing.email) setCustomerEmail(existing.email); }
    }
  };

  const addToCart = (p) => {
    if (!activeShift) { alert('⚠️ Inicie un turno para vender.'); setShowShiftModal(true); return; }
    if (p.stock <= 0) { alert(`⚠️ STOCK AGOTADO: No hay inventario de ${p.name}.`); return; }
    const exist = cart.find((x) => x.barcode === p.barcode);
    if (exist) {
      if (exist.quantity + 1 > p.stock) { alert(`⚠️ LÍMITE DE INVENTARIO: Solo quedan ${p.stock} unidades de ${p.name} disponibles.`); return; }
      setCart(cart.map((x) => (x.barcode === p.barcode ? { ...x, quantity: x.quantity + 1 } : x)));
    } else { setCart([...cart, { ...p, quantity: 1, sale_price: p.sale_price }]); }
  };

  const updateQty = (barcode, qty) => {
    if (qty <= 0) { setCart(cart.filter((x) => x.barcode !== barcode)); return; }
    const p = products.find(x => x.barcode === barcode);
    if (p && qty > p.stock) { alert(`⚠️ LÍMITE DE INVENTARIO: Solo quedan ${p.stock} unidades de ${p.name}.`); return; }
    setCart(cart.map((x) => (x.barcode === barcode ? { ...x, quantity: qty } : x)));
  };
  
  const removeFromCart = (barcode) => setCart(cart.filter((x) => x.barcode !== barcode));

  const totalCart = cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const numericAmountPaid = parseCOP(amountPaid);
  const changeGiven = numericAmountPaid > totalCart ? numericAmountPaid - totalCart : 0;
  const receivedToRegister = numericAmountPaid > 0 ? numericAmountPaid : totalCart; 

  const handleProcessSale = async (saleType) => {
    if (cart.length === 0) return alert('El carrito está vacío');
    if (isProcessing) return;
    setIsProcessing(true);

    // 🔴 LIMPIEZA CLAVE: Se limpia cualquier reporte de turno para garantizar que imprima la factura actual
    setPrintShiftData(null);

    const finalDoc = customerDoc || '222222222222';
    const desc = cart.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const invNumber = `TF-${Date.now().toString().slice(-6)}`;
    const payload = { 
      shift_id: activeShift?.id || null, 
      user_name: currentUser.name, 
      customer_doc: finalDoc, 
      customer_name: customerName, 
      customer_email: customerEmail, 
      items: cart, 
      description: desc, 
      total: totalCart, 
      payment_method: paymentMethod, 
      amount_paid: receivedToRegister, 
      change_given: changeGiven, 
      sale_type: saleType, 
      invoice_number: invNumber 
    };

    if (!navigator.onLine) {
      await db.syncQueue.add({ type: 'PROCESS_POS_SALE', payload });
      for (const item of cart) { const p = await db.products.get(item.barcode); if (p) await db.products.update(item.barcode, { stock: p.stock - item.quantity }); }
      setLastInvoice({ number: invNumber, date: new Date().toLocaleString(), customerDoc: finalDoc, customerName, items: [...cart], total: totalCart, paymentMethod, received: receivedToRegister, changeGiven, seller: currentUser.name });
      if (saleType === 'Facturada') { setTimeout(() => window.print(), 250); } else { alert(`💾 Venta Guardada Offline. Factura #: ${invNumber}`); }
      setCart([]); setAmountPaid(''); setCustomerDoc(''); setCustomerName('Consumidor Final'); setCustomerEmail(''); setSearch('');
      loadProductsLocal(); setIsProcessing(false); return;
    }

    try {
      const res = await fetch(`${API_URL}/api/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastInvoice({ number: data.invoice_number, date: new Date().toLocaleString(), customerDoc: finalDoc, customerName, items: [...cart], total: totalCart, paymentMethod, received: receivedToRegister, changeGiven, seller: currentUser.name });
        if (saleType === 'Facturada') { setTimeout(() => window.print(), 250); } else { alert(`✅ Venta Exitosa. Factura #: ${data.invoice_number}`); }
        setCart([]); setAmountPaid(''); setCustomerDoc(''); setCustomerName('Consumidor Final'); setCustomerEmail(''); setSearch('');
        loadProductsOnline(); loadTransactions();
      }
    } catch (e) { alert('Error de red. Verifique su internet o actúe en modo Offline.'); } 
    finally { setIsProcessing(false); }
  };

  const handleAddBasket = () => {
    const newId = generateUUID();
    setBaskets([...baskets, { id: newId, name: `Caja ${baskets.length + 1}`, items: [] }]);
    setActiveBasketId(newId);
  };

  const handleDeleteBasket = (basketId) => {
    if (baskets.length === 1) return alert('Debe haber al menos una caja/canasta.');
    const updated = baskets.filter(b => b.id !== basketId);
    setBaskets(updated);
    if (activeBasketId === basketId) setActiveBasketId(updated[0].id);
  };

  const addToRestockCart = (p) => {
    if (!activeBasketId) return alert('Seleccione una caja primero');
    const updatedBaskets = baskets.map(basket => {
      if (basket.id === activeBasketId) {
        const exist = basket.items.find((x) => x.barcode === p.barcode);
        if (exist) { return basket; } 
        else { return { ...basket, items: [...basket.items, { ...p, quantity: 1 }] }; }
      }
      return basket;
    });
    setBaskets(updatedBaskets);
  };

  const updateRestockQty = (basketId, barcode, qty) => {
    const updatedBaskets = baskets.map(basket => {
      if (basket.id === basketId) {
        if (qty <= 0) return { ...basket, items: basket.items.filter((x) => x.barcode !== barcode) };
        return { ...basket, items: basket.items.map((x) => (x.barcode === barcode ? { ...x, quantity: qty } : x)) };
      }
      return basket;
    });
    setBaskets(updatedBaskets);
  };

  const handleDispatchToRoute = async () => {
    const hasItems = baskets.some(b => b.items.length > 0);
    if (!hasItems) return alert('Las canastas están vacías. No hay nada que despachar.');
    if (!deliveryPerson.trim()) return alert('Debe indicar el nombre del Entregador o Ruta.');
    
    if (!window.confirm("¿Confirmar despacho a ruta? Se enviará la orden pero NO se sumará al inventario del local hasta que el entregador lo marque como recibido.")) return;
    
    if (isRestocking) return;
    setIsRestocking(true);

    try {
      const payloadFormat = baskets.filter(b => b.items.length > 0).map(b => ({ canasta: b.name, items: b.items }));
      const createRes = await fetch(`${API_URL}/api/restock-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadFormat, notes: `Despacho armado por: ${currentUser.name}`, user_name: currentUser.name })
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) throw new Error(createData.error || 'Error al crear el despacho');

      const dispatchRes = await fetch(`${API_URL}/api/restock-requests/${createData.requestId}/dispatch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: currentUser.name, delivery_person: deliveryPerson })
      });
      const dispatchData = await dispatchRes.json();

      if (dispatchRes.ok && dispatchData.success) {
        alert('🚚 ¡Despacho creado y en ruta! Pendiente por entrega.');
        setBaskets([{ id: generateUUID(), name: 'Caja 1', items: [] }]);
        setDeliveryPerson('');
        setRestockSearch('');
        loadRestockRequests();
        setSubTabRestock('recibir');
      } else { alert(`Error al enviar a ruta: ${dispatchData.error || 'Desconocido'}`); }
    } catch (e) { alert(`Error de red al intentar despachar: ${e.message}`); } finally { setIsRestocking(false); }
  };

  const handleConfirmDelivery = async (id) => {
    if (!window.confirm('✅ ¿Seguro que el Local ya recibió las canastas físicamente? Al confirmar, estos productos SE SUMARÁN al inventario de la tienda.')) return;
    try {
      const res = await fetch(`${API_URL}/api/restock-requests/${id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: currentUser.name }) });
      const data = await res.json();
      if (res.ok && data.success) { alert('🎉 ¡Mercancía Ingresada! El inventario del Local se ha actualizado exitosamente.'); loadRestockRequests(); loadProductsOnline(); } 
      else { alert(`Error al confirmar entrega: ${data.error}`); }
    } catch (e) { alert('Error de red al intentar confirmar la entrega'); }
  };

  const handleCancelDelivery = async (id) => {
    if (!window.confirm('❌ ¿Deseas CANCELAR esta entrega en ruta? El pedido se eliminará.')) return;
    try {
      const res = await fetch(`${API_URL}/api/restock-requests/${id}`, { method: 'DELETE' });
      if (res.ok) { alert('Entrega cancelada exitosamente.'); loadRestockRequests(); }
    } catch (e) { alert('Error al cancelar la entrega.'); }
  };

  const handleSaveNewProduct = async (e) => { e.preventDefault(); const payload = { ...newProd, sale_price: parseCOP(newProd.sale_price), stock: parseCOP(newProd.stock), min_stock: parseCOP(newProd.min_stock) || 3 }; await fetch(`${API_URL}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setShowAddModal(false); loadProductsOnline(); };
  const handleUpdateProduct = async (e) => { e.preventDefault(); const payload = { ...editingProduct, sale_price: parseCOP(editingProduct.sale_price), stock: parseCOP(editingProduct.stock), min_stock: parseCOP(editingProduct.min_stock) || 3 }; await fetch(`${API_URL}/api/products/${editingProduct.barcode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setEditingProduct(null); loadProductsOnline(); };
  const handleDeleteProduct = async (barcode) => { if (window.confirm('¿Eliminar producto local?')) { await fetch(`${API_URL}/api/products/${barcode}`, { method: 'DELETE' }); loadProductsOnline(); } };
  const openAddPreventaModal = () => { setNewPreventaProd({ barcode: '', name: '', price: '', stock: '', min_stock: '3' }); setDiscountRules([]); setShowAddPreventaModal(true); };
  const openEditPreventaModal = (p) => { setEditingPreventaProduct(p); try { setDiscountRules(JSON.parse(p.discount_rules) || []); } catch(e) { setDiscountRules([]); } };
  const addDiscountRule = () => setDiscountRules([...discountRules, { min: '', max: '', discount: '' }]);
  const removeDiscountRule = (index) => setDiscountRules(discountRules.filter((_, i) => i !== index));
  const updateDiscountRule = (index, field, value) => { const updated = [...discountRules]; updated[index][field] = value; setDiscountRules(updated); };
  const handleSavePreventaProduct = async (e) => { e.preventDefault(); const payload = { ...newPreventaProd, price: parseCOP(newPreventaProd.price), stock: 999999, min_stock: 0, discount_rules: JSON.stringify(discountRules) }; await fetch(`${API_URL}/api/preventa-products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setShowAddPreventaModal(false); loadPreventaProductsOnline(); };
  const handleUpdatePreventaProduct = async (e) => { e.preventDefault(); const payload = { ...editingPreventaProduct, price: parseCOP(editingPreventaProduct.price), stock: 999999, min_stock: 0, discount_rules: JSON.stringify(discountRules) }; await fetch(`${API_URL}/api/preventa-products/${editingPreventaProduct.barcode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setEditingPreventaProduct(null); loadPreventaProductsOnline(); };
  const handleDeletePreventaProduct = async (barcode) => { if (window.confirm('¿Eliminar producto de fábrica?')) { await fetch(`${API_URL}/api/preventa-products/${barcode}`, { method: 'DELETE' }); loadPreventaProductsOnline(); } };
  const handleSaveTransaction = async (e) => { e.preventDefault(); const numericAmount = parseCOP(newTx.amount); if (numericAmount <= 0) return alert('Monto inválido'); try { const res = await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newTx, amount: numericAmount, user_name: currentUser.name }) }); if (res.ok) { alert(`✅ ${newTx.type} registrado`); setNewTx({ type: 'Ingreso', category: 'Varios', description: '', amount: '' }); setShowTxModal(false); loadTransactions(); } } catch (e) { alert('Error conectando al servidor'); } };
  const handleDeleteTransaction = async (id, description, category) => { if (!window.confirm(`¿Está seguro de eliminar el registro contable "${description}"?`)) return; try { const res = await fetch(`${API_URL}/api/transactions/${id}`, { method: 'DELETE' }); if (res.ok) { alert('🗑 Registro eliminado'); loadTransactions(); } } catch (e) { alert('Error conectando al servidor'); } };
  const handleSaveUser = async (e) => { e.preventDefault(); try { const res = await fetch(`${API_URL}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) }); if (res.ok) { alert('👤 Empleado creado'); setNewUser({ name: '', username: '', password: '', role: 'Cajero' }); setShowUserModal(false); loadUsersOnline(); } } catch (e) { alert('Error conectando al servidor'); } };
  const handleDeleteUser = async (id, name) => { if (currentUser.id === id) return alert('⚠️ No puedes eliminar tu propio usuario actual'); if (!window.confirm(`¿Está seguro de eliminar al usuario "${name}"?`)) return; try { const res = await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' }); if (res.ok) { alert('🗑 Usuario eliminado'); loadUsersOnline(); } } catch (e) { alert('Error conectando al servidor'); } };
  const handleSaveConfig = async (e) => { e.preventDefault(); await fetch(`${API_URL}/api/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeConfig) }); alert('Configuración guardada'); };
  const handlePrintShiftReport = (shift) => { setLastInvoice(null); setPrintShiftData(shift); setTimeout(() => window.print(), 250); };
  const handleExportCSV = () => { let csvContent = 'data:text/csv;charset=utf-8,FECHA,TIPO,CATEGORIA,DESCRIPCION,MONTO,USUARIO\n'; transactions.forEach((t) => { csvContent += `"${t.created_at}","${t.type}","${t.category}","${t.description}",${t.amount},"${t.user_name}"\n`; }); const link = document.createElement('a'); link.setAttribute('href', encodeURI(csvContent)); link.setAttribute('download', `Reporte_Contable_${new Date().toISOString().slice(0, 10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#121824', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', color: '#fff', width: '100%', maxWidth: '360px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)' }}>
          <h2 style={{ color: '#38bdf8', textAlign: 'center' }}>🌱 TERRA FRUTOS SECOS</h2>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>{navigator.onLine ? 'Conectado al Servidor' : '⚠️ Modo Offline (Sin Red)'}</p>
          {loginError && <div style={{ background: '#f87171', color: '#7f1d1d', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>{loginError}</div>}
          <input type="text" placeholder="Usuario" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} required />
          <input type="password" placeholder="Contraseña" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1.5rem 0', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} required />
          <button type="submit" disabled={isLoggingIn} style={{ width: '100%', padding: '0.85rem', background: isLoggingIn ? '#475569' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isLoggingIn ? 'Verificando...' : '🔑 INICIAR SESIÓN'}
          </button>
        </form>
      </div>
    );
  }

  if (currentUser.role.toLowerCase() === 'preventista') return <Preventista user={currentUser} onLogout={handleLogout} />;
  if (currentUser.role.toLowerCase() === 'entregador') return <Entregador user={currentUser} onLogout={handleLogout} />;

  const isAdmin = currentUser && currentUser.role && currentUser.role.toLowerCase().includes('admin');
  const filteredDailyShifts = shiftsList.filter((s) => {
    const matchesUser = filterUser ? s.user_name.toLowerCase().includes(filterUser.toLowerCase()) : true;
    const matchesDate = filterDate ? s.opened_at && s.opened_at.startsWith(filterDate) : true;
    return matchesUser && matchesDate;
  });
  const monthlyShifts = shiftsList.filter((s) => s.opened_at && s.opened_at.startsWith(selectedMonth));
  const totalIncomes = transactions.filter((t) => t.type === 'Ingreso').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpenses = transactions.filter((t) => t.type === 'Egreso').reduce((acc, t) => acc + (t.amount || 0), 0);
  const netBalance = totalIncomes - totalExpenses;
  const getShiftValFormatted = (val) => { const num = Number(val); return isNaN(num) ? '0' : num.toLocaleString('es-CO'); };

  return (
    <>
      <style>{`
        .nav-btn { display: block; width: 100%; padding: 0.9rem 1rem; text-align: left; background: transparent; color: #cbd5e1; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; transition: all 0.2s ease; margin-bottom: 0.4rem; }
        .nav-btn:hover { background: #334155; color: #fff; }
        .nav-btn.active { background: #2563eb; color: #fff; font-weight: bold; }
        
        .pos-grid-container { display: flex; gap: 1.25rem; height: 100%; align-items: stretch; }
        .pos-products-area { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; overflow-y: auto; padding-right: 4px; padding-bottom: 2rem; }
        .pos-cart { width: 400px; background: #1e293b; border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; border: 1px solid #334155; flex-shrink: 0; }
        .cart-items-wrapper { flex: 1; overflow-y: auto; padding-right: 6px; min-height: 150px; }
        
        .responsive-table-wrapper { width: 100%; overflow-x: auto; background: #1e293b; border-radius: 8px; }
        .responsive-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .responsive-table th, .responsive-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }

        .mobile-header { display: none; }
        .mobile-overlay { display: none; }

        @media (max-width: 768px) {
          html, body, #root { height: auto !important; min-height: 100vh !important; overflow-y: auto !important; overflow-x: hidden !important; }
          div[style*="height: 100vh"], div[style*="height:100vh"] { height: auto !important; min-height: 100vh !important; }
          div[style*="overflow: hidden"], div[style*="overflow:hidden"] { overflow-y: auto !important; }

          .mobile-header { display: flex !important; }
          .mobile-close-btn { display: block !important; }
          .mobile-overlay.show { display: block !important; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 9998; }
          
          .pos-layout { flex-direction: column; height: auto; display: block; }
          .pos-sidebar { position: fixed !important; top: 0; left: 0; width: 280px !important; height: 100vh !important; z-index: 9999; transform: translateX(-100%); transition: transform 0.3s ease; box-shadow: 4px 0 15px rgba(0,0,0,0.5); }
          .pos-sidebar.open { transform: translateX(0) !important; }

          .pos-grid-container { flex-direction: column; height: auto; display: flex; gap: 1.5rem; }
          .pos-products-area { min-height: 400px; flex-shrink: 0; }
          .products-grid { max-height: 45vh; padding-bottom: 1rem; }
          .pos-cart { width: 100%; padding-bottom: 60px; }
          .cart-items-wrapper { max-height: 35vh; }
          .stats-grid { grid-template-columns: 1fr; }
          .responsive-table-wrapper { overflow-x: auto; padding-bottom: 60px; }
          .responsive-table th, .responsive-table td { white-space: normal; word-wrap: break-word; }
        }

        @media print {
          .mobile-header { display: none !important; }
          .mobile-overlay { display: none !important; }
          .pos-layout { display: none !important; }
          .no-print { display: none !important; }
          #print-receipt { display: block !important; }
          body, html { margin: 0; padding: 0; background: #fff !important; }
          @page { margin: 0; }
        }
      `}</style>

      <div id="print-receipt" className="print-only" style={{ display: 'none', color: '#000', fontFamily: 'Arial, sans-serif' }}>
        {printShiftData ? (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', margin: '0 0 2px 0', fontSize: '14px', fontWeight: 'bold' }}>🌱 {storeConfig.razon_social}</h3>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '10px' }}>REPORTE DE TURNO #{printShiftData.id || printShiftData.shift_id}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Empleado: <strong>{printShiftData.user_name}</strong></p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Apertura: {printShiftData.opened_at}</p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Cierre: {printShiftData.closed_at || 'En curso'}</p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Ventas Totales: {printShiftData.sales_count || 0}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Base Inicial:</span><span>${getShiftValFormatted(printShiftData.start_amount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Ventas Efectivo:</span><span>${getShiftValFormatted(printShiftData.cash_sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Ventas Transferencia:</span><span>${getShiftValFormatted(printShiftData.transfer_sales)}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}><span>TOTAL VENDIDO:</span><span>${getShiftValFormatted(printShiftData.total_sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}><span>EFECTIVO ESPERADO:</span><span>${getShiftValFormatted(printShiftData.expected_cash || (printShiftData.start_amount + printShiftData.cash_sales))}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}><span>EFECTIVO CONTADO:</span><span>${getShiftValFormatted(printShiftData.counted_cash ?? printShiftData.end_amount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}><span>DIFERENCIA:</span><span>${getShiftValFormatted(printShiftData.difference || 0)}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
          </div>
        ) : lastInvoice ? (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', margin: '0 0 2px 0', fontSize: '14px', fontWeight: 'bold' }}>🌱 {storeConfig.razon_social}</h3>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '10px' }}>NIT: {storeConfig.nit}</p>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '10px' }}>{storeConfig.direccion}</p>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '10px' }}>Tel: {storeConfig.telefono}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Factura #: <strong>{lastInvoice.number}</strong></p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Fecha: {lastInvoice.date}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <tbody>
                {lastInvoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ verticalAlign: 'top', padding: '1px 0' }}>{it.quantity}x {it.name.substring(0, 16)}</td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '1px 0' }}>${(it.quantity * it.sale_price).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}><span>TOTAL:</span><span>${lastInvoice.total.toLocaleString('es-CO')}</span></div>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Pago: {lastInvoice.paymentMethod}</p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Recibido: ${lastInvoice.received.toLocaleString('es-CO')}</p>
            <p style={{ margin: '1px 0', fontSize: '12px' }}>Devueltas: ${lastInvoice.changeGiven.toLocaleString('es-CO')}</p>
            <p style={{ textAlign: 'center', margin: '4px 0 0 0', fontSize: '10px' }}>{storeConfig.footer_msg}</p>
          </div>
        ) : null}
      </div>

      <div className="no-print mobile-header" style={{ background: '#1e293b', padding: '1rem', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <button onClick={() => setIsMobileMenuOpen(true)} style={{ background: '#334155', border: 'none', color: 'white', padding: '0.5rem 0.8rem', fontSize: '1.2rem', borderRadius: '4px', cursor: 'pointer' }}>
             ☰
           </button>
           <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.2rem' }}>🌱 TERRA</h3>
         </div>
         {activeShift && <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 'bold' }}>🟢 Turno Abierto</span>}
      </div>

      <div className="no-print pos-layout" style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
        
        <div className={`mobile-overlay ${isMobileMenuOpen ? 'show' : ''}`} onClick={() => setIsMobileMenuOpen(false)}></div>

        <div className={`pos-sidebar ${isMobileMenuOpen ? 'open' : ''}`} style={{ background: '#1e293b', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', borderRight: '1px solid #334155', flexShrink: 0, overflowY: 'auto' }}>
          <div className="sidebar-top-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ color: '#38bdf8', fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>🌱 {storeConfig.razon_social}</h3>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{currentUser.name} <br/> <span style={{ color: '#38bdf8' }}>{currentUser.role}</span></div>
              </div>
              <button className="mobile-header" onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
            </div>
            <button onClick={handleLogout} style={{ width: '100%', padding: '0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar Sesión</button>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            {!activeShift ? (
              <button onClick={() => setShowShiftModal(true)} style={{ width: '100%', padding: '1rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>▶️ Iniciar Turno</button>
            ) : (
              <button onClick={() => setShowCloseShiftModal(true)} style={{ width: '100%', padding: '1rem', background: '#166534', color: '#4ade80', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>🟢 Cerrar Turno #{activeShift.id}</button>
            )}
          </div>
          
          <div className="nav-buttons">
            <button onClick={() => handleTabSwitch('pos')} className={`nav-btn ${activeTab === 'pos' ? 'active' : ''}`}>💳 POS Local (Caja)</button>
            {isAdmin && (
              <>
                <button onClick={() => handleTabSwitch('inventory')} className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}>📦 Inventario Local</button>
                <button onClick={() => handleTabSwitch('fabrica_inventory')} className={`nav-btn ${activeTab === 'fabrica_inventory' ? 'active' : ''}`}>🏭 Inventario Fábrica</button>
                <button onClick={() => handleTabSwitch('restock')} className={`nav-btn ${activeTab === 'restock' ? 'active' : ''}`}>📥 Logística y Despachos</button>
                <button onClick={() => handleTabSwitch('preventa_orders')} className={`nav-btn ${activeTab === 'preventa_orders' ? 'active' : ''}`}>📋 Pedidos Preventista</button>
                <button onClick={() => handleTabSwitch('out_of_stock')} className={`nav-btn ${activeTab === 'out_of_stock' ? 'active' : ''}`}>⚠️ Agotados</button>
                <button onClick={() => handleTabSwitch('accounting')} className={`nav-btn ${activeTab === 'accounting' ? 'active' : ''}`}>📈 Contabilidad</button>
                <button onClick={() => handleTabSwitch('employees')} className={`nav-btn ${activeTab === 'employees' ? 'active' : ''}`}>👥 Empleados</button>
                <button onClick={() => handleTabSwitch('reports')} className={`nav-btn ${activeTab === 'reports' ? 'active' : ''}`}>📊 Reportes</button>
                <button onClick={() => handleTabSwitch('dian')} className={`nav-btn ${activeTab === 'dian' ? 'active' : ''}`}>⚙️ Config</button>
              </>
            )}
          </div>
        </div>
        
        <div className="pos-content" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', overflowX: 'hidden' }}>
          {activeTab === 'pos' && (
            <div className="pos-grid-container">
              <div className="pos-products-area">
                <input type="text" placeholder="🔍 Buscar o Escanear Código de Barras aquí..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const matched = products.find((p) => p.barcode === search.trim() || p.barcode === search.trim().toUpperCase()); if (matched) { addToCart(matched); setSearch(''); } } }} style={{ width: '100%', boxSizing: 'border-box', padding: '1rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
                <div className="products-grid">
                  {products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map((p) => (
                    <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '1rem', borderRadius: '6px', border: '1px solid #334155', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CÓD: {p.barcode}</span><h4 style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>{p.name}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>${p.sale_price?.toLocaleString('es-CO')}</strong><span style={{ fontSize: '0.75rem', background: '#334155', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>Stk: {p.stock}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pos-cart">
                <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>🛒 Carrito Local ({cart.length})</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}><input type="text" value={customerDoc} onChange={(e) => handleDocChange(e.target.value)} placeholder="NIT / CC" style={{ width: '40%', boxSizing: 'border-box', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} /><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre Cliente" style={{ width: '60%', boxSizing: 'border-box', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} /></div>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="📧 Correo para envío de factura PDF (opcional)" style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginBottom: '1rem' }} />
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
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Total a Pagar:</span><span style={{ color: '#22c55e' }}>${totalCart.toLocaleString('es-CO')}</span></div>
                  {paymentMethod === 'Efectivo' && (
                    <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Efectivo Recibido:</span><input type="text" value={formatCOP(amountPaid)} onChange={(e) => setAmountPaid(e.target.value.replace(/\D/g, ''))} placeholder={`Ej: ${totalCart}`} style={{ width: '50%', padding: '0.4rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', textAlign: 'right' }} /></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Cambio / Vueltas:</span><strong style={{ color: changeGiven > 0 ? '#38bdf8' : '#94a3b8', fontSize: '1.1rem' }}>${changeGiven.toLocaleString('es-CO')}</strong></div>
                    </div>
                  )}
                  <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setAmountPaid(''); }} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', marginBottom: '0.5rem', borderRadius: '6px' }}><option value="Efectivo">💵 Pago en Efectivo</option><option value="Transferencia">📱 Pago por Transferencia / Nequi</option></select>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button disabled={isProcessing} onClick={() => handleProcessSale('Registrada')} style={{ flex: 1, padding: '1rem', background: isProcessing ? '#475569' : '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{isProcessing ? 'Procesando...' : 'Registrar'}</button>
                    <button disabled={isProcessing} onClick={() => handleProcessSale('Facturada')} style={{ flex: 1, padding: '1rem', background: isProcessing ? '#475569' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{isProcessing ? 'Procesando...' : 'Facturar'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'restock' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setSubTabRestock('armar')} 
                  style={{ flex: 1, minWidth: '150px', padding: '0.8rem', background: subTabRestock === 'armar' ? '#10b981' : 'transparent', color: subTabRestock === 'armar' ? '#fff' : '#94a3b8', border: subTabRestock === 'armar' ? 'none' : '1px solid #334155', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📦 1. Armar Despacho (Canastas)
                </button>
                <button 
                  onClick={() => setSubTabRestock('recibir')} 
                  style={{ flex: 1, minWidth: '150px', padding: '0.8rem', background: subTabRestock === 'recibir' ? '#3b82f6' : 'transparent', color: subTabRestock === 'recibir' ? '#fff' : '#94a3b8', border: subTabRestock === 'recibir' ? 'none' : '1px solid #334155', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🚚 2. Entregas en Ruta (Recibir)
                </button>
              </div>

              {subTabRestock === 'armar' && (
                <div className="restock-responsive-container">
                  <div style={{ flex: '2', width: '100%', background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', minHeight: '350px', boxSizing: 'border-box' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: '1rem' }}>Catálogo para Logística y Despachos</h3>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                      Agrega productos a las canastas. En la caja derecha podrás <strong>escribir la cantidad</strong> exacta a enviar.
                    </p>
                    <input
                      type="text"
                      placeholder="🔍 Buscar producto a despachar..."
                      value={restockSearch}
                      onChange={(e) => setRestockSearch(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #10b981', background: '#0f172a', color: '#fff', marginBottom: '1rem' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem', overflowY: 'auto', flex: 1, maxHeight: '50vh' }}>
                      {products.filter((p) => p.name.toLowerCase().includes(restockSearch.toLowerCase()) || p.barcode.includes(restockSearch)).map((p) => (
                        <div key={p.barcode} onClick={() => addToRestockCart(p)} style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', border: `1px solid ${activeBasketId ? '#3b82f6' : '#334155'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CÓD: {p.barcode}</span>
                          <strong style={{ fontSize: '0.85rem', margin: '0.4rem 0' }}>{p.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Stock Actual: {p.stock || '0'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: '1', width: '100%', display: 'flex', flexDirection: 'column', background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', minHeight: '350px', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>📦 Canastas de Envío</h3>
                      <button onClick={handleAddBasket} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>+ Añadir Caja</button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>
                      {baskets.map(basket => (
                        <div key={basket.id} onClick={() => setActiveBasketId(basket.id)} style={{ padding: '0.4rem 0.8rem', background: activeBasketId === basket.id ? '#3b82f6' : '#334155', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem', border: activeBasketId === basket.id ? '1px solid #fff' : 'none' }}>
                          {basket.name} ({basket.items.length})
                        </div>
                      ))}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', background: '#0f172a', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', maxHeight: '30vh' }}>
                      {baskets.find(b => b.id === activeBasketId)?.items.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem' }}>Caja vacía. Clic en la izquierda para agregar.</p>
                      ) : (
                        baskets.find(b => b.id === activeBasketId)?.items.map((item) => (
                          <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', background: '#1e293b', marginBottom: '0.4rem', borderRadius: '4px' }}>
                            <span style={{ fontSize: '0.85rem', flex: 1 }}>{item.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <button onClick={() => updateRestockQty(activeBasketId, item.barcode, item.quantity - 1)} style={{ background: '#334155', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', fontWeight: 'bold' }}>-</button>
                              <input 
                                type="number" 
                                min="0"
                                value={item.quantity === 0 ? '' : item.quantity} 
                                onChange={(e) => updateRestockQty(activeBasketId, item.barcode, e.target.value === '' ? 0 : parseInt(e.target.value, 10))} 
                                style={{ width: '55px', textAlign: 'center', background: '#0f172a', border: '1px solid #3b82f6', color: '#fff', borderRadius: '4px', padding: '0.3rem', fontSize: '0.9rem', fontWeight: 'bold' }} 
                              />
                              <button onClick={() => updateRestockQty(activeBasketId, item.barcode, item.quantity + 1)} style={{ background: '#334155', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', fontWeight: 'bold' }}>+</button>
                              <button onClick={() => updateRestockQty(activeBasketId, item.barcode, 0)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px', marginLeft: '0.2rem' }}>❌</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {baskets.length > 1 && (
                      <button onClick={() => handleDeleteBasket(activeBasketId)} style={{ width: '100%', padding: '0.4rem', marginTop: '0.4rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem' }}>🗑️ Eliminar esta caja</button>
                    )}

                    <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid #334155' }}>
                      <input type="text" placeholder="Entregador / Ruta..." value={deliveryPerson} onChange={(e) => setDeliveryPerson(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginBottom: '0.8rem', fontSize: '0.9rem' }} />
                      <button onClick={handleDispatchToRoute} disabled={isRestocking} style={{ width: '100%', padding: '0.9rem', background: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                        {isRestocking ? 'Enviando...' : '🚚 DESPACHAR A RUTA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {subTabRestock === 'recibir' && (
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ color: '#3b82f6', margin: 0, fontSize: '1.1rem' }}>🚚 Entregas en Ruta (Pendientes)</h3>
                    <button onClick={loadRestockRequests} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}>🔄 Actualizar</button>
                  </div>

                  {restockRequests.filter(r => r.status === 'DISPATCHED').length === 0 ? (
                    <div style={{ background: '#0f172a', padding: '2rem', textAlign: 'center', borderRadius: '8px', border: '1px solid #334155' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0 }}>No hay despachos en ruta pendientes por recibir.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {restockRequests.filter(r => r.status === 'DISPATCHED').map(req => {
                        const parsedBaskets = typeof req.items === 'string' ? JSON.parse(req.items || '[]') : (req.items || []);
                        const isNewFormat = parsedBaskets.length > 0 && parsedBaskets[0].canasta;

                        return (
                          <div key={req.id} style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #3b82f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid #334155' }}>
                              <div>
                                <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.9rem' }}>Entregador: <strong>{req.delivery_person}</strong></p>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Enviado: {new Date(req.dispatched_at).toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleCancelDelivery(req.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '0.6rem 0.8rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={() => handleConfirmDelivery(req.id)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>✅ ENTREGADO</button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                              {isNewFormat ? (
                                parsedBaskets.map((basket, idx) => (
                                  <div key={idx} style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '6px', minWidth: '180px', border: '1px solid #334155' }}>
                                    <h5 style={{ margin: '0 0 0.4rem 0', color: '#38bdf8' }}>📦 {basket.canasta}</h5>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                                      {basket.items.map(i => (<li key={i.barcode}><strong>{i.quantity}x</strong> {i.name}</li>))}
                                    </ul>
                                  </div>
                                ))
                              ) : (
                                <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '6px', minWidth: '180px' }}>
                                  <h5 style={{ margin: '0 0 0.4rem 0', color: '#38bdf8' }}>📦 Productos</h5>
                                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                                    {parsedBaskets.map(i => (<li key={i.barcode}>{i.quantity}x {i.name}</li>))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: '2rem', background: '#0f172a', padding: '1rem', borderRadius: '6px', border: '1px solid #334155' }}>
                    <h4 style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Historial Reciente (Entregados)</h4>
                    {restockRequests.filter(r => r.status === 'CONFIRMED').length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Sin entregas recientes.</p>
                    ) : (
                      restockRequests.filter(r => r.status === 'CONFIRMED').slice(0, 3).map(req => (
                        <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid #1e293b' }}>
                          <span>#{req.id.substring(0,6)}</span>
                          <span style={{ color: '#10b981' }}>✅ Recibido ({req.confirmed_by})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📦 Inventario Local (Caja)</h2><button onClick={() => setShowAddModal(true)} style={{ padding: '0.8rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Ingresar Producto Local</button>
              </div>
              <input type="text" placeholder="🔍 Buscar en caja..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th>Cód</th><th>Nombre</th><th>Precio Local</th><th>Stock</th><th>Mínimo</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {products.filter((p) => p.name.toLowerCase().includes(invSearch.toLowerCase()) || p.barcode.includes(invSearch)).map((p) => (
                      <tr key={p.barcode} style={{ borderBottom: '1px solid #334155' }}>
                        <td>{p.barcode}</td><td style={{ minWidth: '150px' }}>{p.name}</td><td style={{ color: '#22c55e', fontWeight: 'bold' }}>${p.sale_price?.toLocaleString('es-CO')}</td><td style={{ fontWeight: 'bold', color: p.stock <= (p.min_stock || 3) ? '#ef4444' : '#fff' }}>{p.stock}</td><td style={{ color: '#94a3b8' }}>{p.min_stock || 3}</td>
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
                <h2 style={{ color: '#eab308', margin: 0 }}>🏭 Inventario Fábrica</h2><button onClick={openAddPreventaModal} style={{ padding: '0.8rem 1.2rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>➕ Nuevo Producto Fábrica</button>
              </div>
              <input type="text" placeholder="🔍 Buscar producto en fábrica..." value={invPreventaSearch} onChange={(e) => setInvPreventaSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th>Cód</th><th>Nombre</th><th>Precio Base</th><th>Descuentos por Cantidad</th><th style={{ textAlign: 'center' }}>Stock Fábrica</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
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
                          <td style={{ fontWeight: 'bold', color: '#10b981', fontSize: '1.2rem', textAlign: 'center' }}>∞</td>
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
                <h2 style={{ color: '#38bdf8', margin: 0 }}>📋 Trazabilidad Pedidos Preventista</h2><button onClick={loadPreventaOrders} style={{ padding: '0.8rem 1.2rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🔄 Actualizar</button>
              </div>
              <div className="responsive-table-wrapper">
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155', textAlign: 'left' }}><th>ID</th><th>Fecha</th><th>Preventista</th><th>Cliente</th><th>Estado</th><th>Total</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                  <tbody>
                    {preventaOrders.map(o => (
                      <React.Fragment key={o.id}>
                        <tr style={{ borderBottom: expandedOrderId === o.id ? 'none' : '1px solid #334155' }}>
                          <td style={{ fontSize: '0.8rem' }}>{o.id.substring(0,8)}</td><td style={{ fontSize: '0.8rem' }}>{new Date(o.created_at).toLocaleString()}</td><td><strong>{o.created_by}</strong></td><td>{o.customer_name}</td>
                          <td>
                            {o.status === 'PENDING' && <span style={{ background: '#eab308', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>⏳ Pendiente</span>}
                            {o.status === 'DELIVERED' && <span style={{ background: '#38bdf8', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>🚚 Entregado</span>}
                            {o.status === 'PAID' && <span style={{ background: '#22c55e', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ Cobrado</span>}
                          </td>
                          <td style={{ color: '#22c55e', fontWeight: 'bold' }}>${formatCOP(o.total)}</td>
                          <td style={{ textAlign: 'center', display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>{expandedOrderId === o.id ? 'Ocultar' : 'Detalles'}</button>
                            <button onClick={() => handleDeletePreventaOrderAdmin(o.id, o.customer_name)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>🗑️</button>
                          </td>
                        </tr>
                        {expandedOrderId === o.id && (
                          <tr>
                            <td colSpan="7" style={{ padding: 0 }}>
                              <div style={{ background: '#0f172a', padding: '1rem', borderBottom: '1px solid #334155' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}><div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>NIT/CC:</span><br/>{o.customer_doc}</div><div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Correo:</span><br/>{o.customer_email || 'N/A'}</div><div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Teléfono:</span><br/>{o.customer_phone || 'N/A'}</div><div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Notas:</span><br/>{o.notes || 'N/A'}</div></div>
                                <h5 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8' }}>Productos Solicitados:</h5>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                  {o.items.map(it => (
                                    <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '0.5rem', borderRadius: '4px' }}><span>{it.quantity}x {it.product_name} <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>(${formatCOP(it.unit_price)} c/u)</span></span><span style={{ fontWeight: 'bold' }}>${formatCOP(it.subtotal)}</span></li>
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
              <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>⚠️ Agotados (Solo Inventario Local)</h2>
              <input type="text" placeholder="🔍 Buscar agotados..." value={outSearch} onChange={(e) => setOutSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
              
              <div className="responsive-table-wrapper" style={{marginBottom: '2rem'}}>
                <table className="responsive-table">
                  <thead><tr style={{ background: '#334155' }}><th>Código</th><th>Nombre</th><th>Stock Actual</th><th>Mínimo Permitido</th><th style={{ textAlign: 'center' }}>Faltante Real</th></tr></thead>
                  <tbody>
                    {products
                      .filter((p) => Number(p.stock) <= Number(p.min_stock || 3))
                      .filter((p) => p.name.toLowerCase().includes(outSearch.toLowerCase()) || p.barcode.includes(outSearch))
                      .sort((a, b) => (Number(b.min_stock || 3) - Number(b.stock)) - (Number(a.min_stock || 3) - Number(a.stock)))
                      .map((p) => {
                        const deficit = Number(p.min_stock || 3) - Number(p.stock);
                        return (
                          <tr key={p.barcode}><td>{p.barcode}</td><td>{p.name}</td><td style={{ color: '#f87171', fontWeight: 'bold' }}>{p.stock}</td><td style={{ color: '#94a3b8' }}>{p.min_stock || 3}</td><td style={{ textAlign: 'center', color: '#eab308', fontWeight: 'bold', fontSize: '1.1rem' }}>-{deficit}</td></tr>
                        );
                      })}
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
                        <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteTransaction(t.id, t.description, t.category)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>🗑</button></td>
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
                        <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteUser(u.id, u.name)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>🗑</button></td>
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
                          <td style={{ textAlign: 'center', display:'flex', gap:'5px', justifyContent:'center' }}>
                            <button onClick={() => handlePrintShiftReport(s)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>🖨️</button>
                            <button onClick={() => handleDeleteShift(s.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>🗑</button>
                          </td>
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
              <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#ef4444' }}>🧹 Cierre de Mes (Optimización)</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Utiliza esta opción al finalizar el mes para eliminar el historial antiguo (Ventas, Turnos, Pedidos Cobrados y Contabilidad). Esto liberará espacio y hará que el sistema funcione mucho más rápido. ¡Recuerda descargar tus reportes CSV primero!
                </p>
                <button onClick={handleMonthClose} style={{ width: '100%', padding: '1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ⚠️ EJECUTAR CIERRE DE MES
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALES ADICIONALES */}
      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>☀️ Abrir Turno Local</h3>
            <input type="text" value={formatCOP(shiftBaseInput)} onChange={(e) => setShiftBaseInput(e.target.value.replace(/\D/g, ''))} placeholder="Base en Caja ($)" style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={isShiftProcessing} onClick={handleOpenShift} style={{ flex: 1, padding: '0.8rem', background: isShiftProcessing ? '#475569' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isShiftProcessing ? 'Conectando...' : 'Iniciar'}
              </button>
              <button disabled={isShiftProcessing} onClick={() => setShowShiftModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showCloseShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#f87171' }}>🔴 Cerrar Turno</h3>
            <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem'}}>Para cuadrar la caja, ingrese el efectivo total que hay físicamente en la caja registradora en este momento.</p>
            <label style={{ fontSize: '0.85rem' }}>Efectivo Físico Contado ($):</label>
            <input type="text" value={formatCOP(countedCashInput)} onChange={(e) => setCountedCashInput(e.target.value.replace(/\D/g, ''))} placeholder="Efectivo en caja" style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={isShiftProcessing} onClick={handleCloseShift} style={{ flex: 1, padding: '0.8rem', background: isShiftProcessing ? '#475569' : '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isShiftProcessing ? 'Conectando...' : 'Cerrar Turno'}
              </button>
              <button disabled={isShiftProcessing} onClick={() => setShowCloseShiftModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {shiftSummary && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '340px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#4ade80' }}>🔴 Reporte de Cierre de Turno</h3>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', textAlign: 'center' }}>Turno #{shiftSummary.id || shiftSummary.shift_id} - {shiftSummary.user_name}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Número de Ventas:</span><span>{shiftSummary.sales_count || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Ingresos Efectivo:</span><span style={{ color: '#4ade80' }}>${getShiftValFormatted(shiftSummary.cash_sales)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Ingresos Transf:</span><span style={{ color: '#38bdf8' }}>${getShiftValFormatted(shiftSummary.transfer_sales)}</span></div>
              <hr style={{ borderColor: '#334155', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Total Facturado:</span><span>${getShiftValFormatted(shiftSummary.total_sales)}</span></div>
              <hr style={{ borderColor: '#334155', margin: '0.5rem 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Base Inicial (Mañana):</span><span>${getShiftValFormatted(shiftSummary.start_amount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: '#4ade80' }}><span>Efectivo Esperado:</span><span>${getShiftValFormatted(shiftSummary.expected_cash || (shiftSummary.start_amount + shiftSummary.cash_sales))}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 'bold' }}><span>Efectivo Contado:</span><span>${getShiftValFormatted(shiftSummary.counted_cash ?? shiftSummary.end_amount)}</span></div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: shiftSummary.difference < 0 ? '#ef4444' : (shiftSummary.difference > 0 ? '#38bdf8' : '#22c55e') }}>
                <span>Diferencia (Cuadre):</span><span>${getShiftValFormatted(shiftSummary.difference || 0)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setLastInvoice(null); setPrintShiftData(shiftSummary); setTimeout(() => window.print(), 250); }} style={{ flex: 1, padding: '0.8rem', background: '#38bdf8', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Imprimir</button>
              <button onClick={() => setShiftSummary(null)} style={{ flex: 1, padding: '0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Aceptar</button>
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
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stock Inicial</label>
                <input type="number" placeholder="Actual" value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mínimo Permitido</label>
                <input type="number" placeholder="Ej: 3" value={newProd.min_stock} onChange={(e) => setNewProd({ ...newProd, min_stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
              </div>
            </div>

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
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stock Actual</label>
                <input type="number" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mínimo Permitido</label>
                <input type="number" value={editingProduct.min_stock || 3} onChange={(e) => setEditingProduct({ ...editingProduct, min_stock: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
              </div>
            </div>

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
                  <div style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #10b981', color: '#10b981', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                     ∞ Ilimitado
                  </div>
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