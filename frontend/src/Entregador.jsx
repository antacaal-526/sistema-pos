import React, { useState, useEffect } from 'react';
import { db } from './db';
import { processSyncQueue } from './syncEngine';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

const formatCOP = (val) => {
  if (!val) return '0';
  return parseInt(val, 10).toLocaleString('es-CO');
};

const parseCOP = (val) => {
  if (!val) return 0;
  const cleanNum = String(val).replace(/\D/g, '');
  return cleanNum ? parseInt(cleanNum, 10) : 0;
};

const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export default function Entregador({ user, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pendientes');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // NUEVO: Gestión de Turnos (Ruta) para Arqueo
  const [activeShift, setActiveShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftBaseInput, setShiftBaseInput] = useState('');
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [shiftSummary, setShiftSummary] = useState(null);

  useEffect(() => {
    checkActiveShift(user.name);
    fetchOrders();
    window.addEventListener('online', handleOnline);
    window.addEventListener('sync-completed', fetchOrders);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('sync-completed', fetchOrders);
    };
  }, []);

  const handleOnline = async () => {
    await processSyncQueue();
  };

  const fetchOrders = async () => {
    setLoading(true);
    if (!navigator.onLine) {
      const cached = localStorage.getItem('entregador_routes');
      if (cached) setOrders(JSON.parse(cached));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/orders/detailed`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        localStorage.setItem('entregador_routes', JSON.stringify(data));
      }
    } catch (e) {
      const cached = localStorage.getItem('entregador_routes');
      if (cached) setOrders(JSON.parse(cached));
    }
    setLoading(false);
  };

  // TURNOS DEL ENTREGADOR
  const checkActiveShift = async (userName) => {
    if (!navigator.onLine) return; // Por ahora requiere red para iniciar ruta
    try { 
      const res = await fetch(`${API_URL}/api/shifts/active?user_name=${encodeURIComponent(userName)}`); 
      if (res.ok) setActiveShift(await res.json()); 
    } catch (e) {}
  };

  const handleOpenShift = async () => {
    const baseValue = parseCOP(shiftBaseInput);
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: user.name, start_amount: baseValue }) });
      if (res.ok) { setShowShiftModal(false); setShiftBaseInput(''); checkActiveShift(user.name); }
    } catch (e) { alert('Error al iniciar ruta'); }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    const counted = parseCOP(countedCashInput);
    try {
      const res = await fetch(`${API_URL}/api/shifts/close`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ shift_id: activeShift.id, counted_cash: counted }) 
      });
      const data = await res.json();
      if (res.ok && data.success) { 
        setShiftSummary(data.summary); 
        setActiveShift(null); 
        setShowCloseShiftModal(false);
        setCountedCashInput('');
      } else {
        alert('Error al cerrar ruta: ' + (data.error || ''));
      }
    } catch (e) { alert('Error de red al cerrar la ruta'); }
  };

  const handleAction = async (orderId, actionType, total) => {
    if (!activeShift && actionType === 'PAID') {
      alert('⚠️ Debes INICIAR TU RUTA (Iniciar Turno) antes de poder registrar cobros, para que se sumen a tu Arqueo.');
      setShowShiftModal(true);
      return;
    }

    const isDeliver = actionType === 'DELIVERED';
    const msg = isDeliver ? '¿Confirmar entrega del pedido (Aún sin cobro)?' : `¿Confirmar Cobro por $${formatCOP(total)}?`;
    if (!window.confirm(msg)) return;

    if (!navigator.onLine) {
      const payload = isDeliver ? { orderId, status: 'DELIVERED' } : { id: generateUUID(), order_id: orderId, collector_id: user.name, payment_method: 'Efectivo', amount: total, shift_id: activeShift?.id || null };
      const type = isDeliver ? 'UPDATE_STATUS' : 'PROCESS_PAYMENT';
      await db.syncQueue.add({ type, payload });
      
      const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: isDeliver ? 'DELIVERED' : 'PAID' } : o);
      setOrders(updatedOrders);
      localStorage.setItem('entregador_routes', JSON.stringify(updatedOrders));
      alert('💾 Sin red: Acción guardada localmente. Se sincronizará al recuperar señal.');
      return;
    }

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
          body: JSON.stringify({ id: generateUUID(), order_id: orderId, collector_id: user.name, payment_method: 'Efectivo', amount: total, shift_id: activeShift?.id || null })
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
      
      {/* COMPROBANTE DE IMPRESIÓN DEL ARQUEO */}
      <div id="print-receipt" className="print-only">
        {shiftSummary && (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', margin: '0 0 2px 0', fontSize: '12px' }}>🌱 TERRA FRUTOS SECOS</h3>
            <p style={{ textAlign: 'center', margin: '1px 0', fontSize: '9px', fontWeight: 'bold' }}>REPORTE DE RUTA #{shiftSummary.id || shiftSummary.shift_id}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '1px 0' }}>Entregador: <strong>{shiftSummary.user_name}</strong></p>
            <p style={{ margin: '1px 0' }}>Inicio: {shiftSummary.opened_at}</p>
            <p style={{ margin: '1px 0' }}>Fin: {shiftSummary.closed_at}</p>
            <p style={{ margin: '1px 0' }}>Entregas/Cobros: {shiftSummary.sales_count || 0}</p>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base (Viáticos):</span><span>${formatCOP(shiftSummary.start_amount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cobros Efectivo:</span><span>${formatCOP(shiftSummary.cash_sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cobros Transf:</span><span>${formatCOP(shiftSummary.transfer_sales)}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}><span>TOTAL COBRADO:</span><span>${formatCOP(shiftSummary.total_sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}><span>EFECTIVO ESPERADO:</span><span>${formatCOP(shiftSummary.expected_cash)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}><span>EFECTIVO ENTREGADO:</span><span>${formatCOP(shiftSummary.counted_cash)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}><span>DIFERENCIA:</span><span>${formatCOP(shiftSummary.difference)}</span></div>
            <p style={{ textAlign: 'center', margin: '2px 0' }}>--------------------------------</p>
          </div>
        )}
      </div>

      <div className="no-print">
        <div style={{ background: '#1e293b', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
          <div>
            <strong style={{ color: '#38bdf8' }}>🚚 Rutas y Cobros</strong>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
              Entregador: {user.name} <br/> 
              {navigator.onLine ? <span style={{color: '#4ade80'}}>Conectado</span> : <span style={{color: '#f87171'}}>⚠️ Modo Offline Activo</span>}
            </div>
          </div>
          <button onClick={onLogout} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold' }}>Salir</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '80px' }}>
          
          {/* BARRA DE TURNO/RUTA */}
          <div style={{ marginBottom: '1rem' }}>
            {!activeShift ? (
              <button onClick={() => setShowShiftModal(true)} style={{ width: '100%', padding: '0.8rem', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>▶️ Iniciar Ruta (Turno)</button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 2, background: '#0f172a', padding: '0.8rem', border: '1px solid #166534', color: '#4ade80', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                  Ruta #{activeShift.id} Activa
                </div>
                <button onClick={() => setShowCloseShiftModal(true)} style={{ flex: 1, padding: '0.8rem', background: '#166534', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Finalizar
                </button>
              </div>
            )}
          </div>

          <button onClick={() => { processSyncQueue(); fetchOrders(); }} style={{ width: '100%', padding: '0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', marginBottom: '1rem' }}>
            {loading ? 'Sincronizando...' : '🔄 Sincronizar y Actualizar Rutas'}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Preventista:</span><br/>{o.created_by}</div>
                    <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Fecha:</span><br/>{new Date(o.created_at).toLocaleString()}</div>
                    <div><span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>Teléfono:</span><br/>{o.customer_phone || 'N/A'}</div>
                    {o.notes && <div><span style={{ color: '#eab308', fontSize: '0.8rem' }}>Obs:</span><br/>{o.notes}</div>}
                  </div>
                  
                  <h5 style={{ color: '#fff', margin: '0.5rem 0', paddingBottom: '0.3rem' }}>Productos Solicitados:</h5>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {o.items && o.items.map(it => (
                      <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px dashed #334155', paddingBottom: '0.2rem' }}>
                        <span>
                          {it.quantity}x {it.product_name}
                          {it.discount_percent > 0 && <span style={{ marginLeft: '4px', background: '#eab308', color: '#000', padding: '1px 3px', borderRadius: '3px', fontSize: '0.6rem' }}>-{it.discount_percent}%</span>}
                        </span>
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

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-around', padding: '0.5rem' }}>
          <button onClick={() => setActiveTab('pendientes')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'pendientes' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'pendientes' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.2rem' }}>📍</span><span style={{ fontSize: '0.75rem' }}>Rutas Pendientes</span>
          </button>
          <button onClick={() => setActiveTab('cobrados')} style={{ flex: 1, padding: '0.8rem 0', background: 'transparent', border: 'none', color: activeTab === 'cobrados' ? '#38bdf8' : '#94a3b8', fontWeight: activeTab === 'cobrados' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.2rem' }}>✅</span><span style={{ fontSize: '0.75rem' }}>Cobros Listos</span>
          </button>
        </div>
      </div>

      {/* MODALES DEL ENTREGADOR (TURNO) */}
      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>☀️ Iniciar Ruta</h3>
            <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem'}}>Ingresa el dinero base o viáticos con los que sales a la calle (si aplica).</p>
            <input type="text" value={formatCOP(shiftBaseInput)} onChange={(e) => setShiftBaseInput(e.target.value.replace(/\D/g, ''))} placeholder="Base inicial ($)" style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleOpenShift} style={{ flex: 1, padding: '0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Iniciar</button>
              <button onClick={() => setShowShiftModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showCloseShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '320px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#f87171' }}>🔴 Finalizar Ruta</h3>
            <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem'}}>Para el Arqueo, ingresa todo el efectivo físico total que traes de la ruta (Base + Cobros).</p>
            <input type="text" value={formatCOP(countedCashInput)} onChange={(e) => setCountedCashInput(e.target.value.replace(/\D/g, ''))} placeholder="Efectivo físico real ($)" style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem', margin: '0.5rem 0 1rem 0', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleCloseShift} style={{ flex: 1, padding: '0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Arqueo</button>
              <button onClick={() => setShowCloseShiftModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {shiftSummary && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '340px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#4ade80' }}>🔴 Resumen de Ruta</h3>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', textAlign: 'center' }}>Ruta #{shiftSummary.id || shiftSummary.shift_id} - {shiftSummary.user_name}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Entregas/Cobros:</span><span>{shiftSummary.sales_count || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Cobros Efectivo:</span><span style={{ color: '#4ade80' }}>${formatCOP(shiftSummary.cash_sales)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Cobros Transf:</span><span style={{ color: '#38bdf8' }}>${formatCOP(shiftSummary.transfer_sales)}</span></div>
              <hr style={{ borderColor: '#334155', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Total Cobrado:</span><span>${formatCOP(shiftSummary.total_sales)}</span></div>
              <hr style={{ borderColor: '#334155', margin: '0.5rem 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Base (Viáticos):</span><span>${formatCOP(shiftSummary.start_amount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: '#4ade80' }}><span>Efectivo Esperado:</span><span>${formatCOP(shiftSummary.expected_cash || (shiftSummary.start_amount + shiftSummary.cash_sales))}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 'bold' }}><span>Efectivo Físico:</span><span>${formatCOP(shiftSummary.counted_cash ?? shiftSummary.end_amount)}</span></div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: shiftSummary.difference < 0 ? '#ef4444' : (shiftSummary.difference > 0 ? '#38bdf8' : '#22c55e') }}>
                <span>Diferencia:</span><span>${formatCOP(shiftSummary.difference || 0)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setTimeout(() => window.print(), 300); }} style={{ flex: 1, padding: '0.8rem', background: '#38bdf8', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Imprimir</button>
              <button onClick={() => setShiftSummary(null)} style={{ flex: 1, padding: '0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}