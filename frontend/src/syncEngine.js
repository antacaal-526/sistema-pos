import { db } from './db';

// Lee la cola local y envía datos al backend
export async function processSyncQueue() {
  // Si no hay internet, abortar silenciosamente
  if (!navigator.onLine) return;

  const pendingTasks = await db.sync_queue.where('status').equals('PENDING').toArray();
  if (pendingTasks.length === 0) return;

  console.log(`🔄 Iniciando sincronización: ${pendingTasks.length} tareas pendientes...`);

  for (const task of pendingTasks) {
    try {
      let endpoint = '';
      let method = 'POST';

      // Rutear la tarea según la acción
      if (task.action === 'CREATE_ORDER') endpoint = '/api/orders';
      else if (task.action === 'CREATE_PAYMENT') endpoint = '/api/payments';
      else if (task.action === 'CREATE_CUSTOMER') endpoint = '/api/customers';
      else if (task.action === 'UPDATE_ORDER_STATUS') {
        endpoint = `/api/orders/${task.payload.id}/status`;
        method = 'PUT';
      }

      if (!endpoint) continue;

      // Petición al backend principal
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task.payload)
      });

      if (response.ok) {
        // Tarea exitosa: Eliminar de la cola y marcar como sincronizado localmente
        await db.sync_queue.delete(task.id);
        
        if (task.action === 'CREATE_ORDER') {
          await db.orders.update(task.payload.id, { synced: 1 });
        } else if (task.action === 'CREATE_PAYMENT') {
          await db.payments.update(task.payload.id, { synced: 1 });
        } else if (task.action === 'CREATE_CUSTOMER') {
          await db.customers.update(task.payload.id, { sync_status: 'SYNCED' });
        }
      } else {
        // Error de negocio o validación: Marcar como ERROR para revisión manual
        const errorText = await response.text();
        await db.sync_queue.update(task.id, { status: 'ERROR', error: errorText });
      }
    } catch (err) {
      console.warn('Fallo de red durante sincronización, se reintentará luego:', err);
      // Se mantiene en PENDING para el próximo ciclo
    }
  }
}

// Escuchar automáticamente cuando el celular recupere el Internet (4G/WiFi)
window.addEventListener('online', processSyncQueue);