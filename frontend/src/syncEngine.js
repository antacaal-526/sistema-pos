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
      await db.customers.bulkPut(custData.map(c => ({...c, id: c.document || c.id}))); // Guardar normalizado
    }
    if (usersRes.ok) await db.users.bulkPut(await usersRes.json());
    
    console.log('✅ Sincronización bidireccional completada');
  } catch (error) { console.error('Error en motor de sincronización:', error); }
};

window.addEventListener('online', processSyncQueue);