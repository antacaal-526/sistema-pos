import { db } from './db';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  try {
    const pendingOrders = await db.orders_local.where('sync_status').equals('pending').toArray();
    for (const order of pendingOrders) {
      try {
        const res = await fetch(`${API_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        if (res.ok) {
          await db.orders_local.update(order.id, { sync_status: 'synced' });
        }
      } catch (err) { console.error('Error sincronizando pedido:', order.id, err); }
    }

    // SINCRONIZACIÓN DE LA COLA DEL ENTREGADOR
    const syncQueueTasks = await db.syncQueue.toArray();
    for (const task of syncQueueTasks) {
      try {
        if (task.type === 'UPDATE_STATUS') {
          const res = await fetch(`${API_URL}/api/orders/${task.payload.orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: task.payload.status })
          });
          if (res.ok) await db.syncQueue.delete(task.id);
        } else if (task.type === 'PROCESS_PAYMENT') {
          const res = await fetch(`${API_URL}/api/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task.payload)
          });
          if (res.ok) await db.syncQueue.delete(task.id);
        }
      } catch (e) {
        console.error('Error sincronizando cola Entregador:', e);
      }
    }

    const [prodRes, prevRes, custRes, usersRes] = await Promise.all([
      fetch(`${API_URL}/api/products`),
      fetch(`${API_URL}/api/preventa-products`),
      fetch(`${API_URL}/api/customers`),
      fetch(`${API_URL}/api/users`)
    ]);

    if (prodRes.ok) await db.products.bulkPut(await prodRes.json());
    if (prevRes.ok) await db.preventa_products.bulkPut(await prevRes.json());
    if (custRes.ok) {
      const custData = await custRes.json();
      await db.customers.bulkPut(custData.map(c => ({...c, id: c.document || c.id})));
    }
    if (usersRes.ok) await db.users.bulkPut(await usersRes.json());
    
    console.log('✅ Sincronización completada');
    
    // Disparar evento para que la interfaz se refresque automáticamente
    window.dispatchEvent(new Event('sync-completed'));
    
  } catch (error) { 
    console.error('Error en motor de sincronización:', error); 
  }
};

window.addEventListener('online', processSyncQueue);