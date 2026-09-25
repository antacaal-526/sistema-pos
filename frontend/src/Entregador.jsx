import React, { useState, useEffect } from 'react';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

const formatCOP = (val) => {
  if (!val) return '0';
  return parseInt(val, 10).toLocaleString('es-CO');
};

export default function Entregador({ user, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pendientes'); // pendientes o cobrados
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/detailed`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
      alert('Error de red al obtener pedidos.');
    }
    setLoading(false);
  };

  const handleAction = async (orderId, actionType, total) => {
    const isDeliver = actionType === 'DELIVERED';
    const msg = isDeliver ? '¿Confirmar entrega del pedido (Aún sin cobro)?' : `¿Confirmar Cobro por $${formatCOP(total)}?`;
    if (!window.confirm(msg)) return;

    try {
      if (isDeliver) {
        await fetch(`${API_URL}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DELIVERED' })
        });
      } else {
        await fetch(`${API_URL}/api/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: crypto.randomUUID(), order_id: orderId, collector_id: user.name, payment_method: 'Efectivo', amount: total })
        });
      }
      alert('✅ Acción registrada exitosamente.');
      fetchOrders();
    } catch (e) {
      alert('Error de conexión.');
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'DELIVERED');
  const paidOrders = orders.filter(o => o.status === 'PAID');

  const getStatusBadge = (status) => {
    if (status === 'PENDING') return <span style={{ background: '#eab308', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>⏳ Pendiente</span>;
    if (status === 'DELIVERED') return <span style={{ background: '#38bdf8', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>🚚 Entregado (Falta Cobro)</span>;
    if (status === 'PAID') return <span style={{ background: '#22c55e', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>✅ Cobrado</span>;
    return <span style={{ background: '#dc2626', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>{status}</span>;
  };

  const toggleDetails = (id) => setExpandedOrderId(expandedOrderId === id ? null : id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* HEADER FIJO */}
      <div style={{ background: '#1e293b', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div>
          <strong style={{ color: '#38bdf8' }}>🚚 Rutas y Cobros</strong>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Entregador: {user.name}</div>
        </div>
        <button onClick={onLogout} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold' }}>Salir</button>
      </div>

      {/* ÁREA DE CONTENIDO SCROLLABLE */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '80px' }}>
        <button onClick={fetchOrders} style={{ width: '100%', padding: '0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', marginBottom: '1rem' }}>
          {loading ? 'Sincronizando...' : '🔄 Actualizar Nube'}
        </button>

        <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>{activeTab === 'pendientes' ? 'Rutas Pendientes' : 'Historial de Cobros'}</h3>

        {(activeTab === 'pendientes' ? pendingOrders : paidOrders).map(o => (
          <div key={o.id} style={{ background: '#1e293b', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#fff' }}>{o.customer_name || 'Cliente sin nombre'}</h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CC/NIT: {o.customer_doc || 'N/A'}</span>
                </div>
                {getStatusBadge(o.status)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem' }}>
                <div><span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total Pedido:</span><br/><strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>${formatCOP(o.total)}</strong></div>
                <button onClick={() => toggleDetails(o.id)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  {expandedOrderId === o.id ? 'Ocultar ▲' : 'Detalles ▼'}
                </button>
              </div>
            </div>

            {expandedOrderId === o.id && (
              <div style={{ padding: '1rem', background: '#0f172a', fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}><strong>Preventista:</strong> {o.created_by}</p>
                <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}><strong>Fecha:</strong> {new Date(o.created_at).toLocaleString()}</p>
                {o.notes && <p style={{ margin: '0 0 0.5rem 0', color: '#eab308' }}><strong>Obs:</strong> {o.notes}</p>}
                
                <h5 style={{ color: '#fff', margin: '1rem 0 0.5rem 0', borderBottom: '1px solid #334155', paddingBottom: '0.3rem' }}>Productos Solicitados:</h5>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {o.items && o.items.map(it => (
                    <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px dashed #334155', paddingBottom: '0.2rem' }}>
                      <span>{it.quantity}x {it.product_name}</span>
                      <span style={{ color: '#38bdf8' }}>${formatCOP(it.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                {o.status !== 'PAID' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    {o.status === 'PENDING' && (
                      <button onClick={() => handleAction(o.id, 'DELIVERED', o.total)} style={{ flex: 1, padding: '0.8rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🚚 Marcar Entregado</button>
                    )}
                    <button onClick={() => handleAction(o.id, 'PAID', o.total)} style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>💵 Recibir Pago</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {(activeTab === 'pendientes' && pendingOrders.length === 0) || (activeTab === 'cobrados' && paidOrders.length === 0) ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '2rem' }}>No hay registros en esta sección.</p>
        ) : null}
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR FIJA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-around', padding: '0.5rem' }}>
        <button onClick={() => setActiveTab('pendientes')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'pendientes' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'pendientes' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.2rem' }}>📍</span><span style={{ fontSize: '0.75rem' }}>Rutas Pendientes</span>
        </button>
        <button onClick={() => setActiveTab('cobrados')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'cobrados' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'cobrados' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.2rem' }}>✅</span><span style={{ fontSize: '0.75rem' }}>Cobros Listos</span>
        </button>
      </div>

    </div>
  );
}