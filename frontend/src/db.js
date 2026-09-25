import Dexie from 'dexie';

export const db = new Dexie('TerraPosDB');

db.version(3).stores({
  products: 'barcode, name, sale_price, stock',
  preventa_products: 'barcode, name, price, discount_rules, stock',
  customers: 'id, document, name, phone, email',
  users: 'id, username, password, role',
  orders_local: 'id, sync_status, created_at, customer_email',
  syncQueue: '++id, type, payload'
});