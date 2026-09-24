import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { processSyncQueue } from './syncEngine';

export default function Preventista({ user, onLogout }) {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const syncQueue = useLiveQuery(() => db.sync_queue.toArray()) || [];
  
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');

  const isOnline = navigator.onLine;
  const pendingTasks = syncQueue.filter(t => t.status === 'PENDING').length;
  const errorTasks = syncQueue.filter(t => t.status === 'ERROR').length;

  useEffect(() => {
    window.addEventListener('online', processSyncQueue);
    return () => window.removeEventListener('online', processSyncQueue);
  }, []);

  const addToCart = (p) => {
    const exist = cart.find(x => x.barcode === p.barcode);
    if (exist) setCart(cart.map(x => x.barcode === p.barcode ? { ...x, quantity: x.quantity + 1 } : x));
    else setCart([...cart, { ...p, quantity: 1, unit_price: p.sale_price, subtotal: p.sale_price }]);
  };

  const updateQty = (barcode, qty) => {
    if (qty <= 0) setCart(cart.filter(x => x.barcode !== barcode));
    else setCart(cart.map(x => x.barcode === barcode ? { ...x, quantity: qty, subtotal: qty * x.sale_price } : x));
  };

  const totalCart = cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);

  const handleSaveOrder = async () => {
    if (cart.length === 0) return alert('El carrito está vacío');
    if (!customerDoc || !customerName) return alert('Ingrese documento y nombre del cliente');

    const orderId = crypto.randomUUID(); // Genera un ID único incluso sin internet
    const horaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace('T', ' ');

    const newOrder = {
      id: orderId,
      customer_id: customerDoc,
      customer_name: customerName,
      created_by: user.name,
      assigned_to: '',
      total: totalCart,
      status: 'PENDING',
      notes: notes,
      items: cart,
      created_at: horaLocal,
      synced: 0
    };

    try {
      // 1. Guardar en base de datos local para que el preventista lo vea
      await db.orders.put(newOrder);
      
      // 2. Enviar a la cola de sincronización
      await db.sync_queue.add({ action: 'CREATE_ORDER', payload: newOrder, status: 'PENDING', created_at: Date.now() });
      
      alert('✅ Pedido guardado. Se enviará a tienda automáticamente.');
      setCart([]); setCustomerDoc(''); setCustomerName(''); setNotes('');
      processSyncQueue(); // Intenta enviar de inmediato si hay internet
    } catch (err) {
      alert('Error guardando pedido localmente: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ width: '250px', background: '#1e293b', padding: '1rem', display: 'flex', flexDirection: 'column', borderRight: '1px solid #334155' }}>
        <h3 style={{ color: '#38bdf8', margin: '0 0 1rem 0' }}>🌱 Preventa Ruta</h3>
        <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>PREVENTISTA:</span><br/>
          <strong>{user.name}</strong>
        </div>
        
        <div style={{ background: isOnline ? '#166534' : '#991b1b', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
          {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
        </div>

        <div style={{ background: '#334155', padding: '0.8rem', borderRadius: '6px', marginBottom: 'auto', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>Sincronización Pendiente:</span><br/>
          <strong style={{ fontSize: '1.5rem', color: pendingTasks > 0 ? '#fbbf24' : '#4ade80' }}>{pendingTasks}</strong>
          {errorTasks > 0 && <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠️ {errorTasks} con error</div>}
          <button onClick={processSyncQueue} style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Forzar Sync</button>
        </div>

        <button onClick={onLogout} style={{ width: '100%', padding: '0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🔒 Salir</button>
      </div>

      <div style={{ flex: 1, padding: '1.5rem', display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <input type="text" placeholder="🔍 Buscar producto del catálogo offline..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', overflowY: 'auto' }}>
            {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
              <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{p.name}</h4>
                <div style={{ color: '#22c55e', fontWeight: 'bold' }}>${p.sale_price?.toLocaleString('es-CO')}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: '380px', background: '#1e293b', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: '#38bdf8', marginTop: 0 }}>📝 Pedido de Ruta</h3>
          <input type="text" placeholder="NIT / CC Cliente" value={customerDoc} onChange={e => setCustomerDoc(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginBottom: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
          <input type="text" placeholder="Nombre Comercial" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginBottom: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} required />
          <input type="text" placeholder="Observaciones / Dirección de entrega" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '0.6rem', marginBottom: '1rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />

          <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #334155', paddingTop: '1rem', marginBottom: '1rem' }}>
            {cart.map(item => (
              <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.85rem' }}>{item.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => updateQty(item.barcode, item.quantity - 1)} style={{ padding: '0.2rem 0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQty(item.barcode, item.quantity + 1)} style={{ padding: '0.2rem 0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span>Total:</span>
            <span style={{ color: '#22c55e' }}>${totalCart.toLocaleString('es-CO')}</span>
          </div>
          <button onClick={handleSaveOrder} style={{ width: '100%', padding: '1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
            💾 Guardar y Enviar Pedido
          </button>
        </div>
      </div>
    </div>
  );
}