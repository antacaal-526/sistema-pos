import React, { useState, useEffect } from 'react';

const API_URL = 'https://terra-pos-backend-526.onrender.com/api';

export default function App() {
  // Estado de sesión y usuario logueado
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
    const saved = localStorage.getItem('usuario_pos');
    return saved ? JSON.parse(saved) : null;
  });

  const [vistaActual, setVistaActual] = useState('caja');

  // Formulario de inicio de sesión
  const [loginInput, setLoginInput] = useState({ usuario: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Estados de inventario y caja
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);

  // Estados de gestión de usuarios (Empleados)
  const [empleados, setEmpleados] = useState([]);
  const [nuevoEmpleado, setNuevoEmpleado] = useState({
    nombre: '',
    usuario: '',
    password: '',
    rol: 'cajero'
  });

  // Estado de reportes
  const [ventas, setVentas] = useState([]);

  // Bloqueo de seguridad: Si el rol es 'cajero', forzar que solo acceda a 'caja'
  useEffect(() => {
    if (usuarioLogueado && usuarioLogueado.rol !== 'admin' && vistaActual !== 'caja') {
      setVistaActual('caja');
    }
  }, [usuarioLogueado, vistaActual]);

  // Cargar datos al iniciar sesión
  useEffect(() => {
    if (usuarioLogueado) {
      cargarProductos();
      cargarEmpleados();
      cargarVentas();
    }
  }, [usuarioLogueado]);

  // Autenticación
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginInput)
      });
      const data = await res.json();
      if (res.ok && data.usuario) {
        setUsuarioLogueado(data.usuario);
        localStorage.setItem('usuario_pos', JSON.stringify(data.usuario));
        setVistaActual('caja');
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (err) {
      setLoginError('Error de conexión con el servidor');
    }
  };

  const handleLogout = () => {
    setUsuarioLogueado(null);
    localStorage.removeItem('usuario_pos');
  };

  // Consultas API
  const cargarProductos = async () => {
    try {
      const res = await fetch(`${API_URL}/productos`);
      if (res.ok) {
        const data = await res.json();
        setProductos(data);
      }
    } catch (err) {
      console.error('Error cargando productos:', err);
    }
  };

  const cargarEmpleados = async () => {
    try {
      const res = await fetch(`${API_URL}/usuarios`);
      if (res.ok) {
        const data = await res.json();
        setEmpleados(data);
      }
    } catch (err) {
      console.error('Error cargando empleados:', err);
    }
  };

  const cargarVentas = async () => {
    try {
      const res = await fetch(`${API_URL}/ventas`);
      if (res.ok) {
        const data = await res.json();
        setVentas(data);
      }
    } catch (err) {
      console.error('Error cargando ventas:', err);
    }
  };

  // Crear Usuario / Empleado
  const handleCrearEmpleado = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoEmpleado)
      });
      if (res.ok) {
        alert('Usuario registrado exitosamente');
        setNuevoEmpleado({ nombre: '', usuario: '', password: '', rol: 'cajero' });
        cargarEmpleados();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar el usuario');
      }
    } catch (error) {
      alert('Error de red al registrar usuario');
    }
  };

  // Eliminar Usuario / Empleado
  const handleEliminarEmpleado = async (id, nombre) => {
    if (usuarioLogueado?.id === id) {
      alert('No puedes eliminar tu propia cuenta mientras estés en sesión.');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar el usuario "${nombre}"?`)) {
      try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          alert('Usuario eliminado correctamente');
          cargarEmpleados();
        } else {
          alert('Error al eliminar el usuario');
        }
      } catch (error) {
        alert('Error de conexión al eliminar usuario');
      }
    }
  };

  // Operaciones de Carrito
  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const totalCarrito = carrito.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0
  );

  const procesarVenta = async () => {
    if (carrito.length === 0) return alert('El carrito está vacío');
    try {
      const res = await fetch(`${API_URL}/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: carrito,
          total: totalCarrito,
          usuario_id: usuarioLogueado.id
        })
      });
      if (res.ok) {
        alert('¡Venta realizada con éxito!');
        setCarrito([]);
        cargarProductos();
        cargarVentas();
      } else {
        alert('Error al procesar la venta');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // PANTALLA DE INICIO DE SESIÓN
  if (!usuarioLogueado) {
    return (
      <div style={styles.loginContainer}>
        <form onSubmit={handleLogin} style={styles.loginCard}>
          <h2>🌿 Terra Frutos Secos</h2>
          <p>Iniciar Sesión en el Sistema POS</p>
          {loginError && <div style={styles.errorBox}>{loginError}</div>}
          <div style={styles.inputGroup}>
            <label>Usuario:</label>
            <input
              type="text"
              required
              value={loginInput.usuario}
              onChange={(e) =>
                setLoginInput({ ...loginInput, usuario: e.target.value })
              }
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label>Contraseña:</label>
            <input
              type="password"
              required
              value={loginInput.password}
              onChange={(e) =>
                setLoginInput({ ...loginInput, password: e.target.value })
              }
              style={styles.input}
            />
          </div>
          <button type="submit" style={styles.btnPrimary}>
            Ingresar al Sistema
          </button>
        </form>
      </div>
    );
  }

  // FILTROS DE VISTAS
  const productosFiltrados = productos.filter((p) =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );
  const productosAgotados = productos.filter((p) => p.stock <= 0);

  return (
    <div style={styles.appLayout}>
      {/* NAVEGACIÓN LATERAL CON RESTRICCIÓN DE ROL */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <h3>🌿 Terra Frutos Secos</h3>
          <small>
            Usuario: <b>{usuarioLogueado.nombre}</b> ({usuarioLogueado.rol})
          </small>
        </div>

        <nav style={styles.navMenu}>
          {/* Opción permitida para Empleado/Cajero y Admin */}
          <button
            style={vistaActual === 'caja' ? styles.navBtnActive : styles.navBtn}
            onClick={() => setVistaActual('caja')}
          >
            🛒 POS / Caja
          </button>

          {/* Opciones exclusivas para Administrador */}
          {usuarioLogueado.rol === 'admin' && (
            <>
              <button
                style={vistaActual === 'inventario' ? styles.navBtnActive : styles.navBtn}
                onClick={() => setVistaActual('inventario')}
              >
                📦 Inventario
              </button>
              <button
                style={vistaActual === 'agotados' ? styles.navBtnActive : styles.navBtn}
                onClick={() => setVistaActual('agotados')}
              >
                ⚠️ Agotados ({productosAgotados.length})
              </button>
              <button
                style={vistaActual === 'empleados' ? styles.navBtnActive : styles.navBtn}
                onClick={() => setVistaActual('empleados')}
              >
                👥 Empleados
              </button>
              <button
                style={vistaActual === 'reportes' ? styles.navBtnActive : styles.navBtn}
                onClick={() => setVistaActual('reportes')}
              >
                📊 Reportes
              </button>
            </>
          )}
        </nav>

        <button onClick={handleLogout} style={styles.btnLogout}>
          🚪 Cerrar Sesión
        </button>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <main style={styles.mainContent}>
        {/* VISTA 1: POS / CAJA (Cajero y Admin) */}
        {vistaActual === 'caja' && (
          <div style={styles.posGrid}>
            <div style={styles.posSection}>
              <div style={styles.headerBox}>
                <h2>Módulo de Caja</h2>
                <input
                  type="text"
                  placeholder="🔍 Buscar producto por nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={styles.inputSearch}
                />
              </div>
              <div style={styles.productGrid}>
                {productosFiltrados.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => p.stock > 0 && agregarAlCarrito(p)}
                    style={{
                      ...styles.productCard,
                      opacity: p.stock <= 0 ? 0.4 : 1,
                      cursor: p.stock <= 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <h4>{p.nombre}</h4>
                    <p style={styles.priceTag}>${Number(p.precio).toLocaleString()}</p>
                    <small>Stock: {p.stock}</small>
                  </div>
                ))}
              </div>
            </div>

            {/* Carrito */}
            <div style={styles.cartSection}>
              <h3>🛒 Carrito Actual</h3>
              <div style={styles.cartList}>
                {carrito.length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>
                    Sin productos seleccionados
                  </p>
                ) : (
                  carrito.map((item) => (
                    <div key={item.id} style={styles.cartItem}>
                      <div>
                        <b>{item.nombre}</b>
                        <div>${Number(item.precio).toLocaleString()}</div>
                      </div>
                      <div style={styles.cartQtyControls}>
                        <button onClick={() => cambiarCantidad(item.id, -1)}>-</button>
                        <span>{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)}>+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={styles.cartFooter}>
                <h2>Total: ${totalCarrito.toLocaleString()}</h2>
                <button
                  onClick={procesarVenta}
                  disabled={carrito.length === 0}
                  style={styles.btnSuccess}
                >
                  💳 Registrar Venta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: INVENTARIO (Solo Admin) */}
        {vistaActual === 'inventario' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>📦 Inventario de Productos</h2>
            <input
              type="text"
              placeholder="🔍 Filtrar inventario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.inputSearch}
            />
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => (
                  <tr key={p.id} style={styles.tr}>
                    <td style={styles.td}>{p.id}</td>
                    <td style={styles.td}>{p.nombre}</td>
                    <td style={styles.td}>${Number(p.precio).toLocaleString()}</td>
                    <td style={styles.td}>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA 3: AGOTADOS (Solo Admin) */}
        {vistaActual === 'agotados' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>⚠️ Productos Agotados</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productosAgotados.map((p) => (
                  <tr key={p.id} style={{ ...styles.tr, backgroundColor: '#fff0f0' }}>
                    <td style={styles.td}>{p.id}</td>
                    <td style={styles.td}>{p.nombre}</td>
                    <td style={styles.td}>${Number(p.precio).toLocaleString()}</td>
                    <td style={{ ...styles.td, color: 'red', fontWeight: 'bold' }}>
                      {p.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA 4: EMPLEADOS Y ROLES (Solo Admin) */}
        {vistaActual === 'empleados' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>👥 Gestión de Empleados y Administradores</h2>

            {/* Formulario de Registro */}
            <form onSubmit={handleCrearEmpleado} style={styles.formInline}>
              <h3>Registrar Nuevo Usuario</h3>
              <div style={styles.formRow}>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  required
                  value={nuevoEmpleado.nombre}
                  onChange={(e) =>
                    setNuevoEmpleado({ ...nuevoEmpleado, nombre: e.target.value })
                  }
                  style={styles.input}
                />
                <input
                  type="text"
                  placeholder="Usuario"
                  required
                  value={nuevoEmpleado.usuario}
                  onChange={(e) =>
                    setNuevoEmpleado({ ...nuevoEmpleado, usuario: e.target.value })
                  }
                  style={styles.input}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  required
                  value={nuevoEmpleado.password}
                  onChange={(e) =>
                    setNuevoEmpleado({ ...nuevoEmpleado, password: e.target.value })
                  }
                  style={styles.input}
                />
                <select
                  value={nuevoEmpleado.rol}
                  onChange={(e) =>
                    setNuevoEmpleado({ ...nuevoEmpleado, rol: e.target.value })
                  }
                  style={styles.input}
                >
                  <option value="cajero">Cajero / Empleado</option>
                  <option value="admin">Administrador</option>
                </select>
                <button type="submit" style={styles.btnPrimary}>
                  ➕ Crear
                </button>
              </div>
            </form>

            {/* Tabla de Usuarios con Opción Eliminar */}
            <h3>Usuarios Registrados</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Rol</th>
                  <th style={styles.th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
                  <tr key={emp.id} style={styles.tr}>
                    <td style={styles.td}>{emp.id}</td>
                    <td style={styles.td}>{emp.nombre}</td>
                    <td style={styles.td}>{emp.usuario}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: emp.rol === 'admin' ? '#d4edda' : '#e2e3e5',
                          color: emp.rol === 'admin' ? '#155724' : '#383d41',
                          fontWeight: 'bold'
                        }}
                      >
                        {emp.rol}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleEliminarEmpleado(emp.id, emp.nombre)}
                        style={styles.btnDanger}
                      >
                        🗑️ Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA 5: REPORTES (Solo Admin) */}
        {vistaActual === 'reportes' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>📊 Historial de Ventas</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID Venta</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} style={styles.tr}>
                    <td style={styles.td}>#{v.id}</td>
                    <td style={styles.td}>{v.fecha || 'Reciente'}</td>
                    <td style={styles.td}>${Number(v.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// ESTILOS EN OBJETO JAVASCRIPT
const styles = {
  appLayout: { display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f4f6f9' },
  sidebar: { width: '240px', backgroundColor: '#1e293b', color: '#fff', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  brand: { borderBottom: '1px solid #334155', paddingBottom: '15px' },
  navMenu: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' },
  navBtn: { padding: '12px', textAlign: 'left', background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', borderRadius: '6px', fontSize: '15px' },
  navBtnActive: { padding: '12px', textAlign: 'left', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px' },
  btnLogout: { padding: '10px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  mainContent: { flex: 1, padding: '25px', overflowY: 'auto' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loginCard: { backgroundColor: '#fff', padding: '30px', borderRadius: '10px', width: '320px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' },
  errorBox: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px' },
  inputGroup: { marginBottom: '15px', textAlign: 'left' },
  input: { width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' },
  inputSearch: { width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ccc' },
  btnPrimary: { width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnSuccess: { width: '100%', padding: '15px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' },
  btnDanger: { padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  posGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' },
  posSection: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px' },
  cartSection: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px', maxHeight: '65vh', overflowY: 'auto' },
  productCard: { border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc' },
  priceTag: { color: '#16a34a', fontWeight: 'bold', fontSize: '16px' },
  cartList: { flex: 1, overflowY: 'auto', margin: '15px 0' },
  cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' },
  cartQtyControls: { display: 'flex', gap: '5px', alignItems: 'center' },
  cartFooter: { borderTop: '2px solid #eee', paddingTop: '15px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' },
  th: { padding: '12px', textAlign: 'left', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #e2e8f0' },
  formInline: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', marginTop: '10px' }
};