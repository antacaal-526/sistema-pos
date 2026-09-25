import { db } from './db';

const API_URL = 'https://terra-pos-backend-526.onrender.com';

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  try {
    // 1. Sincronizar Pedidos Locales Pendientes (Preventistas)
    const pendingOrders = await db.orders_local.where('sync_status').equals('pending').toArray();
    for (const order of pendingOrders) {
      try {
        const res = await fetch(`${API_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        
        if (res.ok) {
          // Marcar como sincronizado localmente
          await db.orders_local.update(order.id, { sync_status: 'synced' });
        }
      } catch (err) {
        console.error('Error sincronizando pedido:', order.id, err);
      }
    }

    // 2. Descargar Catálogos actualizados desde el servidor
    const [prodRes, custRes, usersRes] = await Promise.all([
      fetch(`${API_URL}/api/products`),
      fetch(`${API_URL}/api/customers`),
      fetch(`${API_URL}/api/users`)
    ]);

    if (prodRes.ok) {
      const products = await prodRes.json();
      await db.products.bulkPut(products);
    }
    if (custRes.ok) {
      const customers = await custRes.json();
      await db.customers.bulkPut(customers);
    }
    if (usersRes.ok) {
      const users = await usersRes.json();
      await db.users.bulkPut(users);
    }
    
    console.log('✅ Sincronización bidireccional completada');
  } catch (error) {
    console.error('Error en el motor de sincronización:', error);
  }
};

// Escuchar cuando vuelva el internet para sincronizar automáticamente
window.addEventListener('online', processSyncQueue);