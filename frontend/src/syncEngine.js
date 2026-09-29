import { db } from './db';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

const waitForServer = async () => {
  for (let i = 0; i < 5; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_URL}/api/ping`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  return false;
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) return { success: 0, errors: 0 };
  
  let successCount = 0;
  let errorCount = 0;
  let lastErrorMessage = '';

  try {
    const isAwake = await waitForServer();
    if (!isAwake) return { success: 0, errors: 1, message: "El servidor de Render está apagado o sin respuesta." };

    const pendingOrders = await db.orders_local.where('sync_status').equals('pending').toArray();
    for (const order of pendingOrders) {
      try {
        const res = await fetch(`${API_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            await db.orders_local.update(order.id, { sync_status: 'synced' });
            successCount++;
          } else {
            if(data.message && data.message.includes('bloqueado')) {
                await db.orders_local.update(order.id, { sync_status: 'synced' });
                successCount++;
            } else {
                errorCount++;
                lastErrorMessage = data.message || data.error || "Rechazado por el servidor.";
            }
          }
        } else {
          // Captura el error exacto 500 del backend
          const errData = await res.json().catch(() => ({}));
          lastErrorMessage = errData.message || errData.error || `HTTP ${res.status}`;
          errorCount++;
        }
      } catch (err) { 
        errorCount++;
        lastErrorMessage = "Error de Red: " + err.message;
      }
    }

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
      } catch (e) {}
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
    
    window.dispatchEvent(new Event('sync-completed'));
    
    return { success: successCount, errors: errorCount, message: lastErrorMessage };
  } catch (error) { 
    return { success: successCount, errors: errorCount + 1, message: error.message };
  }
};

window.addEventListener('online', processSyncQueue);