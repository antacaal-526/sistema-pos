import React, { useState, useEffect } from 'react';
import { db } from './db';
import { processSyncQueue } from './syncEngine';

const formatCOP = (val) => {
  if (!val) return '0';
  return parseInt(val, 10).toLocaleString('es-CO');
};

export default function Preventista({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('catalogo');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  
  const [clientDoc, setClientDoc] = useState('');
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');

  const [localOrders, setLocalOrders] = useState([]);
  const [syncStatus, setSyncStatus] = useState('Conectado');

  useEffect(() => {
    loadLocalData();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  const updateNetworkStatus = () => {
    if (navigator.onLine) {
      setSyncStatus('Sincronizando...');
      processSyncQueue().then(() => loadLocalData());
    } else {
      setSyncStatus('Sin conexión (Guardando local)');
    }
  };

  const loadLocalData = async () => {
    const prods = await db.products.toArray();
    setProducts(prods);
    const orders = await db.orders_local.toArray();
    setLocalOrders(orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    if (navigator.onLine) setSyncStatus('Conectado y Actualizado');
    else setSyncStatus('Modo Offline Activo');
  };

  const addToCart = (p) => {
    const exist = cart.find(x => x.barcode === p.barcode);
    if (exist) {
      setCart(cart.map(x => x.barcode === p.barcode ? { ...x, quantity: x.quantity + 1 } : x));
    } else {
      setCart([...cart, { ...p, quantity: 1, sale_price: p.wholesale_price || p.sale_price }]);
    }
    alert(`Añadido: ${p.name}`);
  };

  const updateQty = (barcode, qty) => {
    if (qty <= 0) setCart(cart.filter(x => x.barcode !== barcode));
    else setCart(cart.map(x => x.barcode === barcode ? { ...x, quantity: qty } : x));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.sale_price * item.quantity), 0);

  const handleSaveOrder = async () => {
    if (cart.length === 0) return alert('El pedido está vacío');
    if (!clientDoc || !clientName) return alert('Ingrese NIT/Cédula y Nombre del cliente');

    const orderId = crypto.randomUUID();
    const newOrder = {
      id: orderId,
      customer_id: clientDoc,
      customer_name: clientName,
      created_by: user.name,
      total: cartTotal,
      notes: notes,
      items: cart,
      sync_status: 'pending',
      created_at: new Date().toISOString()
    };

    // Guardar en IndexedDB
    await db.orders_local.put(newOrder);
    alert('✅ Pedido Registrado Exitosamente');
    
    setCart([]); setClientDoc(''); setClientName(''); setNotes('');
    setActiveTab('pedidos');
    
    // Intentar sincronizar si hay internet
    if (navigator.onLine) {
      updateNetworkStatus();
    } else {
      loadLocalData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* HEADER FIJO */}
      <div style={{ background: '#1e293b', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div>
          <strong style={{ color: '#38bdf8' }}>🌱 Preventa</strong>
          <div style={{ fontSize: '0.75rem', color: navigator.onLine ? '#4ade80' : '#f87171', marginTop: '4px' }}>
            {syncStatus}
          </div>
        </div>
        <button onClick={onLogout} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold' }}>Salir</button>
      </div>

      {/* ÁREA DE CONTENIDO SCROLLABLE */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '80px' }}>
        
        {/* PESTAÑA CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
              {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CÓD: {p.barcode}</span>
                  <strong style={{ fontSize: '0.85rem', margin: '0.4rem 0' }}>{p.name}</strong>
                  <div style={{ color: '#38bdf8', fontWeight: 'bold' }}>${formatCOP(p.wholesale_price || p.sale_price)}</div>
                  <button style={{ marginTop: '0.5rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>Añadir</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA CARRITO Y REGISTRO */}
        {activeTab === 'carrito' && (
          <div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>📝 Datos del Cliente</h3>
              <input type="text" placeholder="NIT / Cédula" value={clientDoc} onChange={e => setClientDoc(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginBottom: '0.8rem' }} />
              <input type="text" placeholder="Nombre Comercial / Cliente" value={clientName} onChange={e => setClientName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', marginBottom: '0.8rem' }} />
              <textarea placeholder="Observaciones / Dirección" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} rows={2}></textarea>
            </div>

            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>🛒 Productos ({cart.length})</h3>
              {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>No hay productos añadidos.</p> : cart.map(item => (
                <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '0.8rem', borderRadius: '6px', marginBottom: '0.6rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{item.name}</div>
                    <div style={{ color: '#22c55e', fontSize: '0.85rem' }}>${formatCOP(item.sale_price * item.quantity)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button onClick={() => updateQty(item.barcode, item.quantity - 1)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 'bold' }}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQty(item.barcode, item.quantity + 1)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 'bold' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* ESPACIO PARA EL BOTON FLOTANTE */}
            <div style={{ height: '80px' }}></div> 
          </div>
        )}

        {/* PESTAÑA PEDIDOS LOCALES */}
        {activeTab === 'pedidos' && (
          <div>
            <h2 style={{ color: '#38bdf8', marginBottom: '1rem' }}>📋 Mis Pedidos (Local)</h2>
            <button onClick={updateNetworkStatus} style={{ width: '100%', padding: '0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', marginBottom: '1rem' }}>🔄 Forzar Sincronización</button>
            
            {localOrders.length === 0 ? <p>No has registrado pedidos en este dispositivo.</p> : localOrders.map(o => (
              <div key={o.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: `4px solid ${o.sync_status === 'synced' ? '#22c55e' : '#eab308'}`, marginBottom: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>{o.customer_name}</strong>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', background: '#0f172a', borderRadius: '4px', color: o.sync_status === 'synced' ? '#4ade80' : '#facc15' }}>
                    {o.sync_status === 'synced' ? '✅ Sincronizado' : '⏳ Pendiente'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>ID: {o.id.substring(0,8)} | Total: <strong style={{ color: '#fff' }}>${formatCOP(o.total)}</strong></div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>{new Date(o.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE PARA GUARDAR PEDIDO (Solo en tab Carrito) */}
      {activeTab === 'carrito' && cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: '70px', left: 0, right: 0, padding: '1rem', background: 'rgba(15, 23, 42, 0.95)', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Pedido</div><strong style={{ fontSize: '1.2rem', color: '#22c55e' }}>${formatCOP(cartTotal)}</strong></div>
          <button onClick={handleSaveOrder} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '1rem' }}>💾 Registrar Pedido</button>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR FIJA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-around', padding: '0.5rem' }}>
        <button onClick={() => setActiveTab('catalogo')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'catalogo' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'catalogo' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.2rem' }}>📦</span><span style={{ fontSize: '0.7rem' }}>Catálogo</span>
        </button>
        <button onClick={() => setActiveTab('carrito')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'carrito' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'carrito' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
          <span style={{ fontSize: '1.2rem' }}>🛒</span><span style={{ fontSize: '0.7rem' }}>Carrito</span>
          {cart.length > 0 && <span style={{ position: 'absolute', top: '5px', right: '25px', background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px' }}>{cart.length}</span>}
        </button>
        <button onClick={() => setActiveTab('pedidos')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'pedidos' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'pedidos' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.2rem' }}>📋</span><span style={{ fontSize: '0.7rem' }}>Mis Pedidos</span>
        </button>
      </div>

    </div>
  );
}