import { db } from './db';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

// Función para despertar a Render y verificar que está vivo antes de sincronizar
const waitForServer = async () => {
  for (let i = 0; i < 5; i++) { // Intenta 5 veces
    try {
      console.log(`Despertando servidor (Intento ${i+1})...`);
      // Un timeout de 15 segundos por cada intento
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(`${API_URL}/api/ping`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        console.log('✅ Servidor de Render Despierto y Listo!');
        return true;
      }
    } catch (e) {
      console.log(`⏳ Servidor aún dormido... esperando 5 segundos`);
      // Espera 5 segundos antes de volver a intentar
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return false; // Si después de 5 intentos y 1 minuto no responde, está caído
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) return { success: 0, errors: 0 };
  
  let successCount = 0;
  let errorCount = 0;

  try {
    const isAwake = await waitForServer();
    if (!isAwake) {
      console.error('El servidor de Render no respondió a tiempo.');
      return { success: 0, errors: 1 };
    }

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
            console.error('El backend rechazó el pedido:', data.message);
            // Si el backend dice "Pedido bloqueado", igual lo marcamos como sincronizado para sacarlo de la cola.
            if(data.message.includes('bloqueado')) {
                await db.orders_local.update(order.id, { sync_status: 'synced' });
                successCount++;
            } else {
                errorCount++;
            }
          }
        } else {
          const errText = await res.text();
          console.error('Error HTTP al sincronizar:', errText);
          errorCount++;
        }
      } catch (err) { 
        console.error('Error de red sincronizando pedido:', order.id, err); 
        errorCount++;
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
    
    console.log('✅ Sincronización completada exitosamente');
    window.dispatchEvent(new Event('sync-completed'));
    
    return { success: successCount, errors: errorCount };
  } catch (error) { 
    console.error('Fallo general en motor de sincronización:', error); 
    return { success: successCount, errors: errorCount + 1 };
  }
};

window.addEventListener('online', processSyncQueue);