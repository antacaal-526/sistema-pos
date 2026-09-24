import Dexie from 'dexie';

// Creamos la base de datos local en el navegador
export const db = new Dexie('TerraPosOfflineDB');

db.version(1).stores({
  // Tablas locales (catálogo y clientes)
  products: 'barcode, name, sale_price, stock',
  customers: 'id, name, document, phone, sync_status',
  
  // Tablas de operación en ruta
  orders: 'id, customer_id, total, status, created_at, synced',
  order_items: 'id, order_id, product_barcode',
  payments: 'id, order_id, amount, synced',
  
  // COLA DE SINCRONIZACIÓN (El corazón del modo Offline)
  sync_queue: '++id, action, status, created_at' // status: 'PENDING', 'ERROR'
});