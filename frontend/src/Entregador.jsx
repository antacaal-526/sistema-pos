import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { processSyncQueue } from './syncEngine';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

export default function Entregador({ user, onLogout }) {
  const syncQueue = useLiveQuery(() => db.sync_queue.toArray()) || [];
  const localOrders = useLiveQuery(() => db.orders.toArray()) || [];
  
  const [orders, setOrders] = useState([]);
  const [showPayModal, setShowPayModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  
  const isOnline = navigator.onLine;
  const pendingTasks = syncQueue.filter(t => t.status === 'PENDING').length;

  // Sincroniza pedidos asignados desde la nube al dispositivo
  const fetchCloudOrders = async () => {
    if (!isOnline) return;
    try {
      const res = await fetch(`${API_URL}/api/orders`);
      const data = await res.json();
      setOrders(data);
      // Guardar localmente para acceso offline
      await db.orders.bulkPut(data);
    } catch (e) {
      console.error("Error trayendo pedidos:", e);
    }
  };

  useEffect(() => {
    fetchCloudOrders();
  }, []);

  // Combinar nube y local (Priorizar local para vista offline)
  const displayOrders = isOnline ? orders : localOrders;
  const activeOrders = displayOrders.filter(o => o.status === 'PENDING' || o.status === 'DELIVERED');

  const handleMarkDelivered = async (orderId) => {
    if(!window.confirm('¿Confirmar que la mercancía fue entregada físicamente?')) return;
    try {
      // 1. Actualizar DB Local
      await db.orders.update(orderId, { status: 'DELIVERED' });
      // 2. Cola de Sync (Esto sacará el stock físico del inventario en Render)
      await db.sync_queue.add({ action: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'DELIVERED' }, status: 'PENDING', created_at: Date.now() });
      alert('🚚 Pedido marcado como ENTREGADO.');
      fetchCloudOrders();
      processSyncQueue();
    } catch(err) { alert('Error: ' + err.message); }
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    const paymentId = crypto.randomUUID();
    const horaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace('T', ' ');

    const paymentPayload = {
      id: paymentId,
      order_id: showPayModal.id,
      collector_id: user.name,
      payment_method: paymentMethod,
      amount: showPayModal.total,
      collected_at: horaLocal
    };

    try {
      // 1. Guardar cobro local y actualizar pedido
      await db.payments.put(paymentPayload);
      await db.orders.update(showPayModal.id, { status: 'PAID' });
      
      // 2. Cola de Sync (Esto inyectará el dinero en Contabilidad en Render)
      await db.sync_queue.add({ action: 'CREATE_PAYMENT', payload: paymentPayload, status: 'PENDING', created_at: Date.now() });
      
      alert(`✅ Dinero cobrado exitosamente ($${showPayModal.total.toLocaleString('es-CO')}).`);
      setShowPayModal(null);
      fetchCloudOrders();
      processSyncQueue();
    } catch (err) {
      alert('Error registrando cobro: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ width: '250px', background: '#1e293b', padding: '1rem', display: 'flex', flexDirection: 'column', borderRight: '1px solid #334155' }}>
        <h3 style={{ color: '#38bdf8', margin: '0 0 1rem 0' }}>📦 Rutas y Cobros</h3>
        <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ENTREGADOR / COBRADOR:</span><br/>
          <strong>{user.name}</strong>
        </div>
        
        <div style={{ background: isOnline ? '#166534' : '#991b1b', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
          {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
        </div>

        <button onClick={fetchCloudOrders} disabled={!isOnline} style={{ width: '100%', padding: '0.8rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem', opacity: isOnline ? 1 : 0.5 }}>
          🔄 Descargar Rutas
        </button>

        <div style={{ background: '#334155', padding: '0.8rem', borderRadius: '6px', marginBottom: 'auto', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>Sincronización Pendiente:</span><br/>
          <strong style={{ fontSize: '1.5rem', color: pendingTasks > 0 ? '#fbbf24' : '#4ade80' }}>{pendingTasks}</strong>
          <button onClick={processSyncQueue} style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Forzar Sync</button>
        </div>

        <button onClick={onLogout} style={{ width: '100%', padding: '0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🔒 Salir</button>
      </div>

      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <h2 style={{ color: '#38bdf8', marginTop: 0 }}>Mis Entregas Asignadas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {activeOrders.map(order => (
            <div key={order.id} style={{ background: '#1e293b', borderRadius: '8px', padding: '1.5rem', border: `1px solid ${order.status === 'DELIVERED' ? '#eab308' : '#334155'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '1.1rem' }}>{order.customer_name}</strong>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: order.status === 'DELIVERED' ? '#ca8a04' : '#334155' }}>
                  {order.status === 'DELIVERED' ? 'ENTREGADO' : 'PENDIENTE'}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Fecha Pedido: {order.created_at}<br/>
                Notas: {order.notes || 'Ninguna'}
              </div>
              
              <h3 style={{ margin: '0 0 1rem 0', color: '#22c55e', fontSize: '1.4rem' }}>${order.total.toLocaleString('es-CO')}</h3>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {order.status === 'PENDING' && (
                  <button onClick={() => handleMarkDelivered(order.id)} style={{ flex: 1, padding: '0.8rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                    📦 Entregar
                  </button>
                )}
                {order.status === 'DELIVERED' && (
                  <button onClick={() => setShowPayModal(order)} style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                    💵 Cobrar
                  </button>
                )}
              </div>
            </div>
          ))}
          {activeOrders.length === 0 && <p style={{ color: '#94a3b8' }}>No hay pedidos pendientes de entrega o cobro en este momento.</p>}
        </div>
      </div>

      {/* MODAL COBRO */}
      {showPayModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <form onSubmit={handleCollectPayment} style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', width: '350px' }}>
            <h3 style={{ marginTop: 0, color: '#4ade80' }}>Registrar Ingreso (Cobro)</h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem' }}>Al confirmar, el monto ingresará directamente a la Contabilidad general.</p>
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Monto a Cobrar:</label>
            <input type="text" value={`$${showPayModal.total.toLocaleString('es-CO')}`} disabled style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', background: '#0f172a', border: '1px solid #334155', color: '#22c55e', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem' }} />
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Método de Pago:</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
              <option value="Efectivo">💵 Efectivo</option>
              <option value="Transferencia / Nequi">📱 Transferencia / Nequi</option>
            </select>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar Cobro</button>
              <button type="button" onClick={() => setShowPayModal(null)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}