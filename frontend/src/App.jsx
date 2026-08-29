import React, { useState, useEffect } from 'react';

const API_URL = 'https://terra-pos-backend-526.onrender.com/api';

export default function App() {
  // Estado de sesión y usuario logueado
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
    const saved = localStorage.getItem('usuario_pos');
    return saved ? JSON.parse(saved) : null;
  });

  const [vistaActual, setVistaActual] = useState('caja');

  // Formulario de login
  const [loginInput, setLoginInput] = useState({ usuario: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Estados de inventario y caja
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cantidadAñadir, setCantidadAñadir] = useState(1);
  const [carrito, setCarrito] = useState([]);

  // Control de Efectivo y Cambio
  const [pagaCon, setPagaCon] = useState('');

  // Modal de Factura POS DIAN
  const [facturaData, setFacturaData] = useState(null);

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

  // Bloqueo de navegación según el rol
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

  // BÚSQUEDA Y AGREGAR POR CÓDIGO O NOMBRE
  const agregarAlCarrito = (producto, cant = 1) => {
    const cantidadAgregar = Math.max(1, Number(cant));
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + cantidadAgregar }
            : item
        );
      }
      return [...prev, { ...producto, cantidad: cantidadAgregar }];
    });
  };

  // Permite presionar 'Enter' en el buscador para añadir código de barras directo
  const handleKeyDownBusqueda = (e) => {
    if (e.key === 'Enter' && busqueda.trim() !== '') {
      e.preventDefault();
      const productoEncontrado = productos.find(
        (p) =>
          (p.barcode && p.barcode.toString().toLowerCase() === busqueda.trim().toLowerCase()) ||
          p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
      );

      if (productoEncontrado && productoEncontrado.stock > 0) {
        agregarAlCarrito(productoEncontrado, cantidadAñadir);
        setBusqueda('');
        setCantidadAñadir(1);
      } else {
        alert('Producto no encontrado o sin stock');
      }
    }
  };

  // Modificar cantidad directamente desde la lista de carrito
  const actualizarCantidadCarrito = (id, nuevaCantidad) => {
    const cantNum = Number(nuevaCantidad);
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            return cantNum > 0 ? { ...item, cantidad: cantNum } : null;
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

  const cambioCalculado = Math.max(0, (Number(pagaCon) || 0) - totalCarrito);

  // REGISTRAR VENTA Y MOSTRAR FACTURA POS
  const procesarVenta = async () => {
    if (carrito.length === 0) return alert('El carrito está vacío');
    if (Number(pagaCon) < totalCarrito) {
      return alert('El monto pagado es inferior al total de la venta');
    }

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

      const data = await res.json();

      if (res.ok) {
        // Generar datos de la factura POS DIAN 2026
        const nuevaFactura = {
          id: data.ventaId || Math.floor(100000 + Math.random() * 900000),
          fecha: new Date().toLocaleString('es-CO'),
          cajero: usuarioLogueado.nombre,
          items: [...carrito],
          total: totalCarrito,
          pagaCon: Number(pagaCon),
          cambio: cambioCalculado
        };

        setFacturaData(nuevaFactura);
        setCarrito([]);
        setPagaCon('');
        cargarProductos();
        cargarVentas();
      } else {
        alert('Error al procesar la venta');
      }
    } catch (err) {
      alert('Error de conexión con el servidor');
    }
  };

  // Crear Usuario
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

  // Eliminar Usuario
  const handleEliminarEmpleado = async (id, nombre) => {
    if (usuarioLogueado?.id === id) {
      alert('No puedes eliminar tu propia cuenta en sesión.');
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

  // FILTRADO DE PRODUCTOS (Por Nombre o por Código)
  const productosFiltrados = productos.filter((p) => {
    const termino = busqueda.toLowerCase().trim();
    const coincideNombre = p.nombre && p.nombre.toLowerCase().includes(termino);
    const coincideCodigo = p.barcode && p.barcode.toString().toLowerCase().includes(termino);
    return coincideNombre || coincideCodigo;
  });

  const productosAgotados = productos.filter((p) => p.stock <= 0);

  // PANTALLA DE LOGIN
  if (!usuarioLogueado) {
    return (
      <div style={styles.loginContainer}>
        <form onSubmit={handleLogin} style={styles.loginCard}>
          <h2>🌿 Terra Frutos Secos</h2>
          <p>Sistema POS & Inventario</p>
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

  return (
    <div style={styles.appLayout}>
      {/* MENÚ LATERAL */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <h3>🌿 Terra Frutos Secos</h3>
          <small>
            Usuario: <b>{usuarioLogueado.nombre}</b> ({usuarioLogueado.rol})
          </small>
        </div>

        <nav style={styles.navMenu}>
          <button
            style={vistaActual === 'caja' ? styles.navBtnActive : styles.navBtn}
            onClick={() => setVistaActual('caja')}
          >
            🛒 POS / Caja
          </button>

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

      {/* ÁREA DE TRABAJO */}
      <main style={styles.mainContent}>
        {/* VISTA 1: POS / CAJA */}
        {vistaActual === 'caja' && (
          <div style={styles.posGrid}>
            <div style={styles.posSection}>
              <h2>Módulo de Caja</h2>
              
              {/* BUSCADOR DUAL: CÓDIGO Y NOMBRE + CANTIDAD */}
              <div style={styles.searchBarBox}>
                <div style={{ flex: 1 }}>
                  <label style={styles.labelSmall}>🔍 Buscar por Código o Nombre:</label>
                  <input
                    type="text"
                    placeholder="Escriba código o nombre y presione Enter..."
                    value={busqueda}
                    onKeyDown={handleKeyDownBusqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={styles.inputSearch}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={styles.labelSmall}>Cantidad:</label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadAñadir}
                    onChange={(e) => setCantidadAñadir(e.target.value)}
                    style={styles.inputSearch}
                  />
                </div>
              </div>

              {/* GRILLA DE PRODUCTOS */}
              <div style={styles.productGrid}>
                {productosFiltrados.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => p.stock > 0 && agregarAlCarrito(p, cantidadAñadir)}
                    style={{
                      ...styles.productCard,
                      opacity: p.stock <= 0 ? 0.4 : 1,
                      cursor: p.stock <= 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <small style={{ color: '#64748b', fontSize: '11px' }}>
                      Cód: {p.barcode || p.id}
                    </small>
                    <h4 style={{ margin: '5px 0' }}>{p.nombre}</h4>
                    <p style={styles.priceTag}>${Number(p.precio).toLocaleString()}</p>
                    <small>Stock: {p.stock}</small>
                  </div>
                ))}
              </div>
            </div>

            {/* CARRITO Y CÁLCULO DE CAMBIO */}
            <div style={styles.cartSection}>
              <h3>🛒 Carrito Actual</h3>
              <div style={styles.cartList}>
                {carrito.length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', marginTop: '30px' }}>
                    Sin productos seleccionados
                  </p>
                ) : (
                  carrito.map((item) => (
                    <div key={item.id} style={styles.cartItem}>
                      <div style={{ flex: 1 }}>
                        <b>{item.nombre}</b>
                        <div style={{ fontSize: '13px', color: '#16a34a' }}>
                          ${Number(item.precio).toLocaleString()} c/u
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => actualizarCantidadCarrito(item.id, e.target.value)}
                          style={styles.qtyInput}
                        />
                        <button
                          onClick={() => actualizarCantidadCarrito(item.id, 0)}
                          style={styles.btnDeleteCart}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* SECCIÓN DE PAGO Y DEVUETLA / CAMBIO */}
              <div style={styles.cartFooter}>
                <div style={styles.totalRow}>
                  <span>Total a Pagar:</span>
                  <span style={{ color: '#2563eb' }}>${totalCarrito.toLocaleString()}</span>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={styles.labelSmall}>Paga con (Efectivo):</label>
                  <input
                    type="number"
                    placeholder="Monto recibido $"
                    value={pagaCon}
                    onChange={(e) => setPagaCon(e.target.value)}
                    style={styles.inputPay}
                  />
                </div>

                <div style={styles.changeRow}>
                  <span>Cambio / Devuelta:</span>
                  <span style={{ color: Number(pagaCon) >= totalCarrito ? '#16a34a' : '#dc2626' }}>
                    ${cambioCalculado.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={procesarVenta}
                  disabled={carrito.length === 0 || Number(pagaCon) < totalCarrito}
                  style={{
                    ...styles.btnSuccess,
                    opacity: carrito.length === 0 || Number(pagaCon) < totalCarrito ? 0.5 : 1
                  }}
                >
                  💳 Registrar e Imprimir Factura
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: INVENTARIO */}
        {vistaActual === 'inventario' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>📦 Inventario de Productos</h2>
            <input
              type="text"
              placeholder="🔍 Filtrar por código o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.inputSearch}
            />
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => (
                  <tr key={p.id} style={styles.tr}>
                    <td style={styles.td}>{p.barcode || p.id}</td>
                    <td style={styles.td}>{p.nombre}</td>
                    <td style={styles.td}>${Number(p.precio).toLocaleString()}</td>
                    <td style={styles.td}>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA 3: AGOTADOS */}
        {vistaActual === 'agotados' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>⚠️ Productos Agotados</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productosAgotados.map((p) => (
                  <tr key={p.id} style={{ ...styles.tr, backgroundColor: '#fff0f0' }}>
                    <td style={styles.td}>{p.barcode || p.id}</td>
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

        {/* VISTA 4: EMPLEADOS */}
        {vistaActual === 'empleados' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>👥 Gestión de Empleados y Administradores</h2>
            <form onSubmit={handleCrearEmpleado} style={styles.formInline}>
              <h3>Registrar Nuevo Usuario</h3>
              <div style={styles.formRow}>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  required
                  value={nuevoEmpleado.nombre}
                  onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, nombre: e.target.value })}
                  style={styles.input}
                />
                <input
                  type="text"
                  placeholder="Usuario"
                  required
                  value={nuevoEmpleado.usuario}
                  onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, usuario: e.target.value })}
                  style={styles.input}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  required
                  value={nuevoEmpleado.password}
                  onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, password: e.target.value })}
                  style={styles.input}
                />
                <select
                  value={nuevoEmpleado.rol}
                  onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, rol: e.target.value })}
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

        {/* VISTA 5: REPORTES */}
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

      {/* MODAL IMPRIMIBLE FACTURA TIPO DIAN COLOMBIA 2026 */}
      {facturaData && (
        <div style={styles.modalOverlay}>
          <div style={styles.ticketBox} id="ticket-factura">
            <div style={{ textAlign: 'center', fontSize: '12px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>TERRA FRUTOS SECOS</h3>
              <p style={{ margin: 0 }}>NIT: 1049600000-1</p>
              <p style={{ margin: 0 }}>No Responsable de IVA</p>
              <p style={{ margin: 0 }}>Tunja, Boyacá - Colombia</p>
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
                DOCUMENTO EQUIVALENTE POS N°: {facturaData.id}
              </p>
              <p style={{ margin: 0 }}>Fecha: {facturaData.fecha}</p>
              <p style={{ margin: 0 }}>Cajero: {facturaData.cajero}</p>
            </div>

            <div style={styles.ticketDivider}>----------------------------------------</div>

            <table style={styles.ticketTable}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Cant</th>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {facturaData.items.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.cantidad}</td>
                    <td>{it.nombre}</td>
                    <td style={{ textAlign: 'right' }}>
                      ${(it.precio * it.cantidad).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.ticketDivider}>----------------------------------------</div>

            <div style={{ fontSize: '13px' }}>
              <div style={styles.ticketFlexRow}>
                <b>TOTAL COMPRA:</b>
                <b>${facturaData.total.toLocaleString()}</b>
              </div>
              <div style={styles.ticketFlexRow}>
                <span>RECIBIDO (EFECTIVO):</span>
                <span>${facturaData.pagaCon.toLocaleString()}</span>
              </div>
              <div style={styles.ticketFlexRow}>
                <b>CAMBIO / DEVUETLA:</b>
                <b>${facturaData.cambio.toLocaleString()}</b>
              </div>
            </div>

            <div style={styles.ticketDivider}>----------------------------------------</div>

            <div style={{ textAlign: 'center', fontSize: '11px' }}>
              <p style={{ margin: '2px 0' }}>Sistema POS Equivalente DIAN 2026</p>
              <p style={{ margin: '2px 0', fontWeight: 'bold' }}>¡Gracias por su compra!</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }} className="no-print">
              <button onClick={() => window.print()} style={styles.btnPrimary}>
                🖨️ Imprimir Ticket
              </button>
              <button onClick={() => setFacturaData(null)} style={styles.btnDanger}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ESTILOS DE LA APLICACIÓN Y TICKET IMPRIMIBLE
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
  searchBarBox: { display: 'flex', gap: '10px', marginBottom: '15px' },
  inputSearch: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' },
  inputPay: { width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #2563eb', fontSize: '16px', fontWeight: 'bold', boxSizing: 'border-box' },
  labelSmall: { fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' },
  btnPrimary: { width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnSuccess: { width: '100%', padding: '15px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' },
  btnDanger: { width: '100%', padding: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnDeleteCart: { backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '24px', height: '24px', fontWeight: 'bold' },
  posGrid: { display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '20px' },
  posSection: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px' },
  cartSection: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', maxHeight: '60vh', overflowY: 'auto' },
  productCard: { border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc' },
  priceTag: { color: '#16a34a', fontWeight: 'bold', fontSize: '15px', margin: '2px 0' },
  cartList: { flex: 1, overflowY: 'auto', margin: '15px 0' },
  cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px' },
  qtyInput: { width: '50px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' },
  cartFooter: { borderTop: '2px solid #e2e8f0', paddingTop: '15px' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' },
  changeRow: { display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', margin: '10px 0' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' },
  th: { padding: '12px', textAlign: 'left', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #e2e8f0' },
  formInline: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', marginTop: '10px' },
  
  // MODAL Y TICKET IMPRIMIBLE DIAN
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  ticketBox: { backgroundColor: '#fff', width: '300px', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
  ticketDivider: { textAlign: 'center', margin: '8px 0', fontSize: '12px' },
  ticketTable: { width: '100%', fontSize: '12px', borderCollapse: 'collapse' },
  ticketFlexRow: { display: 'flex', justifyContent: 'space-between', margin: '4px 0' }
};