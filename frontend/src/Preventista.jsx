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
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');

  const isOnline = navigator.onLine;
  const pendingTasks = syncQueue.filter(t => t.status === 'PENDING').length;

  useEffect(() => {
    window.addEventListener('online', processSyncQueue);
    return () => window.removeEventListener('online', processSyncQueue);
  }, []);

  // Autocompletar cliente si ya existe por NIT o CC
  const handleDocBlur = async () => {
    if (!customerDoc) return;
    const existingClient = await db.customers.where('document').equals(customerDoc.trim()).first();
    if (existingClient) {
      setCustomerName(existingClient.name || '');
      setCustomerAddress(existingClient.address || '');
      setCustomerEmail(existingClient.email || '');
    }
  };

  const addToCart = (p) => {
    const exist = cart.find(x => x.barcode === p.barcode);
    if (exist) {
      const newQty = exist.quantity + 1;
      // REGLA DE DESCUENTO POR VOLUMEN: Si lleva >= 6 unidades, 5% de descuento mayorista
      const unitPrice = newQty >= 6 ? Math.round(p.sale_price * 0.95) : p.sale_price;
      setCart(cart.map(x => x.barcode === p.barcode ? { ...x, quantity: newQty, unit_price: unitPrice, subtotal: newQty * unitPrice } : x));
    } else {
      const unitPrice = p.sale_price;
      setCart([...cart, { id: crypto.randomUUID(), ...p, quantity: 1, unit_price: unitPrice, subtotal: unitPrice }]);
    }
  };

  const updateQty = (barcode, qty) => {
    const product = products.find(p => p.barcode === barcode);
    if (qty <= 0) {
      setCart(cart.filter(x => x.barcode !== barcode));
    } else {
      const unitPrice = qty >= 6 ? Math.round(product.sale_price * 0.95) : product.sale_price;
      setCart(cart.map(x => x.barcode === barcode ? { ...x, quantity: qty, unit_price: unitPrice, subtotal: qty * unitPrice } : x));
    }
  };

  const totalCart = cart.reduce((s, i) => s + i.subtotal, 0);

  const handleSaveOrder = async () => {
    if (cart.length === 0) return alert('El carrito está vacío');
    if (!customerDoc || !customerName) return alert('Ingrese el NIT/CC y el Nombre del cliente');

    const orderId = crypto.randomUUID();
    const customerId = customerDoc.trim();
    const horaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace('T', ' ');

    const clientPayload = {
      id: customerId,
      name: customerName.trim(),
      document: customerId,
      phone: '',
      address: customerAddress.trim(),
      city: 'Tunja',
      email: customerEmail.trim(),
      created_at: horaLocal,
      sync_status: 'PENDING'
    };

    const newOrder = {
      id: orderId,
      customer_id: customerId,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: '',
      created_by: user.name,
      assigned_to: '',
      total: totalCart,
      status: 'PENDING',
      notes: notes.trim(),
      items: cart,
      created_at: horaLocal,
      synced: 0
    };

    try {
      // 1. Guardar o actualizar cliente localmente
      await db.customers.put(clientPayload);
      await db.sync_queue.add({ action: 'CREATE_CUSTOMER', payload: clientPayload, status: 'PENDING', created_at: Date.now() });

      // 2. Guardar pedido localmente
      await db.orders.put(newOrder);
      await db.sync_queue.add({ action: 'CREATE_ORDER', payload: newOrder, status: 'PENDING', created_at: Date.now() });
      
      alert('✅ Pedido de preventa guardado correctamente.');
      setCart([]); setCustomerDoc(''); setCustomerName(''); setCustomerAddress(''); setCustomerEmail(''); setNotes('');
      processSyncQueue();
    } catch (err) {
      alert('Error guardando pedido: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* BARRA LATERAL MÓVIL / ESCRITORIO */}
      <div style={{ width: window.innerWidth < 768 ? '100%' : '240px', background: '#1e293b', padding: '1rem', display: 'flex', flexDirection: window.innerWidth < 768 ? 'row' : 'column', justifyContent: 'space-between', borderRight: '1px solid #334155', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: '#38bdf8', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>🌱 Preventa</h3>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preventista: <strong>{user.name}</strong></div>
          <div style={{ background: isOnline ? '#166534' : '#991b1b', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-block', marginTop: '0.4rem', fontWeight: 'bold' }}>
            {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
          </div>
        </div>
        <button onClick={onLogout} style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Salir</button>
      </div>

      {/* CONTENIDO PRINCIPAL: CATÁLOGO */}
      <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <input 
          type="text" 
          placeholder="🔍 Buscar producto por nombre o código..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }} 
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.8rem' }}>
          {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
            <div key={p.barcode} onClick={() => addToCart(p)} style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Cód: {p.barcode}</span>
              <h4 style={{ margin: '0.2rem 0', fontSize: '0.85rem', lineHeight: '1.2' }}>{p.name}</h4>
              <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '0.4rem' }}>${p.sale_price?.toLocaleString('es-CO')}</div>
              <span style={{ fontSize: '0.65rem', color: '#38bdf8' }}>(Mayorista desc. a partir de 6 un.)</span>
            </div>
          ))}
        </div>
      </div>

      {/* PANEL DERECHO: DATOS DEL CLIENTE Y CARRITO VISIBLE */}
      <div style={{ width: window.innerWidth < 768 ? '100%' : '380px', background: '#1e293b', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155', maxHeight: '100vh', overflowY: 'auto' }}>
        <h3 style={{ color: '#38bdf8', marginTop: 0, fontSize: '1.1rem' }}>📝 Detalle del Pedido</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="text" 
            placeholder="NIT o Cédula (Autocompleta)" 
            value={customerDoc} 
            onChange={e => setCustomerDoc(e.target.value)} 
            onBlur={handleDocBlur}
            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }} 
            required 
          />
          <input 
            type="text" 
            placeholder="Nombre del Cliente / Local" 
            value={customerName} 
            onChange={e => setCustomerName(e.target.value)} 
            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }} 
            required 
          />
          <input 
            type="text" 
            placeholder="Dirección de entrega" 
            value={customerAddress} 
            onChange={e => setCustomerAddress(e.target.value)} 
            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }} 
          />
          <input 
            type="email" 
            placeholder="📧 Correo para envío de factura PDF" 
            value={customerEmail} 
            onChange={e => setCustomerEmail(e.target.value)} 
            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }} 
          />
          <input 
            type="text" 
            placeholder="Observaciones" 
            value={notes} 
            onChange={e => setNotes(e.target.value)} 
            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }} 
          />
        </div>

        {/* LISTA DE PRODUCTOS SELECCIONADOS EN EL CARRITO (VISIBLE) */}
        <div style={{ flex: 1, minHeight: '140px', maxHeight: '220px', overflowY: 'auto', borderTop: '1px solid #334155', borderBottom: '1px solid #334155', padding: '0.5rem 0', marginBottom: '1rem' }}>
          {cart.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.85rem', margin: '2rem 0' }}>Selecciona productos del catálogo</p>
          ) : (
            cart.map(item => (
              <div key={item.barcode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', background: '#0f172a', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                <div style={{ flex: 1, marginRight: '0.5rem' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                  <div style={{ color: '#22c55e' }}>${item.unit_price.toLocaleString('es-CO')} c/u {item.quantity >= 6 && <span style={{ color: '#eab308' }}>(Mayorista)</span>}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <button onClick={() => updateQty(item.barcode, item.quantity - 1)} style={{ padding: '0.1rem 0.4rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>-</button>
                  <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.barcode, item.quantity + 1)} style={{ padding: '0.1rem 0.4rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span>Total Pedido:</span>
          <span style={{ color: '#22c55e' }}>${totalCart.toLocaleString('es-CO')}</span>
        </div>

        <button onClick={handleSaveOrder} style={{ width: '100%', padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>
          💾 Guardar y Enviar Pedido
        </button>
      </div>

    </div>
  );
}