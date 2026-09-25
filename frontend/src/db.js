import Dexie from 'dexie';

export const db = new Dexie('TerraPosDB');

db.version(2).stores({
  products: 'barcode, name, sale_price, wholesale_price, stock',
  preventa_products: 'barcode, name, price, discount_rules, stock',
  customers: 'id, document, name, phone',
  users: 'id, username, password, role',
  orders_local: 'id, sync_status, created_at',
  syncQueue: '++id, type, payload'
});