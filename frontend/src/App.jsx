import React, { useState, useEffect } from 'react';

const API_URL = 'https://terra-pos-backend-526.onrender.com/api';

export default function App() {
  // Estado de sesión y usuario logueado
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
    const saved = localStorage.getItem('usuario_pos');
    return saved ? JSON.parse(saved) : null;
  });

  const [vistaActual, setVistaActual] = useState('caja');
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // Formulario de login
  const [loginInput, setLoginInput] = useState({ usuario: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Control de Turnos / Arqueo de Caja
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [baseInicialInput, setBaseInicialInput] = useState('200000');
  const [modalResumenTurno, setModalResumenTurno] = useState(null);
  const [historialTurnos, setHistorialTurnos] = useState([]);

  // Estados de inventario y caja
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cantidadAñadir, setCantidadAñadir] = useState(1);
  const [carrito, setCarrito] = useState([]);

  // Formulario de Crear Producto
  const [nuevoProducto, setNuevoProducto] = useState({
    barcode: '',
    nombre: '',
    precio: '',
    stock: '',
    min_stock: '5'
  });

  // Estado para la edición de inventario y casillas de entrada
  const [edicionStock, setEdicionStock] = useState({});
  const [entradas, setEntradas] = useState({});

  // Control de Medio de Pago
  const [medioPago, setMedioPago] = useState('efectivo');
  const [pagaCon, setPagaCon] = useState('');

  // Modal de Factura POS DIAN
  const [facturaData, setFacturaData] = useState(null);

  // Estados de gestión de usuarios y reportes
  const [empleados, setEmpleados] = useState([]);
  const [nuevoEmpleado, setNuevoEmpleado] = useState({
    nombre: '',
    usuario: '',
    password: '',
    rol: 'cajero'
  });

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
      consultarTurnoActivo();
      cargarHistorialTurnos();
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
    setTurnoActivo(null);
    localStorage.removeItem('usuario_pos');
  };

  // CONSULTAS Y FUNCIONES DE TURNO
  const consultarTurnoActivo = async () => {
    if (!usuarioLogueado) return;
    try {
      const res = await fetch(`${API_URL}/turnos/activo/${usuarioLogueado.id}`);
      if (res.ok) {
        const data = await res.json();
        setTurnoActivo(data);
      }
    } catch (err) {
      console.error('Error al consultar turno activo:', err);
    }
  };

  const cargarHistorialTurnos = async () => {
    try {
      const res = await fetch(`${API_URL}/turnos`);
      if (res.ok) {
        const data = await res.json();
        setHistorialTurnos(data);
      }
    } catch (err) {
      console.error('Error cargando historial de turnos:', err);
    }
  };

  const handleIniciarTurno = async () => {
    if (!baseInicialInput || Number(baseInicialInput) < 0) {
      return alert('Ingrese un valor válido para la base inicial de caja');
    }

    try {
      const res = await fetch(`${API_URL}/turnos/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioLogueado.id,
          nombre_cajero: usuarioLogueado.nombre,
          base_inicial: Number(baseInicialInput)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTurnoActivo(data.turno);
        alert(`¡Turno iniciado exitosamente por ${usuarioLogueado.nombre}! Base: $${Number(baseInicialInput).toLocaleString()}`);
      } else {
        alert(data.error || 'Error al iniciar turno');
      }
    } catch (err) {
      alert('Error de red al iniciar el turno');
    }
  };

  const handleCerrarTurno = async () => {
    if (!turnoActivo) return;
    if (!window.confirm(`¿Estás seguro de realizar el Cierre de Turno para ${usuarioLogueado.nombre}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/turnos/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turnoActivo.id })
      });
      const data = await res.json();
      if (res.ok) {
        setModalResumenTurno(data.resumen);
        setTurnoActivo(null);
        cargarHistorialTurnos();
      } else {
        alert(data.error || 'Error al cerrar el turno');
      }
    } catch (err) {
      alert('Error de conexión al cerrar turno');
    }
  };

  // Consultas API
  const cargarProductos = async () => {
    try {
      const res = await fetch(`${API_URL}/productos`);
      if (res.ok) {
        const data = await res.json();
        setProductos(data);

        const mapaEdicion = {};
        const mapaEntradas = {};
        data.forEach((p) => {
          mapaEdicion[p.id] = {
            stock: p.stock,
            precio: p.precio,
            min_stock: p.min_stock || 5
          };
          mapaEntradas[p.id] = '';
        });
        setEdicionStock(mapaEdicion);
        setEntradas(mapaEntradas);
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

  // CREAR UN NUEVO PRODUCTO
  const handleCrearProducto = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoProducto)
      });
      const data = await res.json();
      if (res.ok) {
        alert('¡Producto creado exitosamente!');
        setNuevoProducto({ barcode: '', nombre: '', precio: '', stock: '', min_stock: '5' });
        cargarProductos();
      } else {
        alert(data.error || 'Error al crear producto');
      }
    } catch (err) {
      alert('Error de conexión al guardar producto');
    }
  };

  // ACTUALIZAR STOCK CON ENTRADA SUMATORIA
  const handleGuardarCambiosStock = async (id) => {
    const itemEditado = edicionStock[id];
    if (!itemEditado) return;

    const entradaValor = Number(entradas[id]) || 0;
    const stockActualBase = Number(itemEditado.stock) || 0;
    const stockCalculadoFinal = stockActualBase + entradaValor;

    try {
      const res = await fetch(`${API_URL}/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: stockCalculadoFinal,
          precio: itemEditado.precio,
          min_stock: itemEditado.min_stock
        })
      });

      if (res.ok) {
        alert(`¡Actualizado! Nuevo Stock Total: ${stockCalculadoFinal}`);
        setEntradas((prev) => ({ ...prev, [id]: '' }));
        cargarProductos();
      } else {
        alert('Error al actualizar el producto');
      }
    } catch (err) {
      alert('Error de conexión al actualizar stock');
    }
  };

  // OPERACIONES DE CAJA Y CARRITO
  const agregarAlCarrito = (producto, cant = 1) => {
    if (!turnoActivo) {
      alert('Debes Iniciar Turno con la Base de Caja antes de realizar ventas.');
      return;
    }
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

  const handleKeyDownBusqueda = (e) => {
    if (e.key === 'Enter' && busqueda.trim() !== '') {
      e.preventDefault();
      if (!turnoActivo) {
        alert('Debes Iniciar Turno con la Base de Caja antes de realizar ventas.');
        return;
      }
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

  const cambioCalculado = medioPago === 'efectivo'
    ? Math.max(0, (Number(pagaCon) || 0) - totalCarrito)
    : 0;

  // PROCESAR VENTA
  const procesarVenta = async () => {
    if (!turnoActivo) return alert('Debes iniciar turno antes de vender.');
    if (carrito.length === 0) return alert('El carrito está vacío');
    if (medioPago === 'efectivo' && Number(pagaCon) < totalCarrito) {
      return alert('El monto recibido en efectivo es inferior al total');
    }

    const pagaConFinal = medioPago === 'transferencia' ? totalCarrito : Number(pagaCon);

    try {
      const res = await fetch(`${API_URL}/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: carrito,
          total: totalCarrito,
          usuario_id: usuarioLogueado.id,
          medio_pago: medioPago
        })
      });

      const data = await res.json();

      if (res.ok) {
        const ahora = new Date();
        const fechaFormateada = ahora.toLocaleDateString('es-CO');
        const horaFormateada = ahora.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        const nuevaFactura = {
          id: data.ventaId || (ventas.length + 1),
          fechaHora: `${fechaFormateada}, ${horaFormateada}`,
          cajero: usuarioLogueado.nombre,
          items: [...carrito],
          total: totalCarrito,
          medioPago: medioPago === 'efectivo' ? 'EFECTIVO' : 'TRANSFERENCIA (ELECTRONICO)',
          pagaCon: pagaConFinal,
          cambio: medioPago === 'efectivo' ? cambioCalculado : 0
        };

        setFacturaData(nuevaFactura);
        setCarrito([]);
        setPagaCon('');
        setMedioPago('efectivo');
        cargarProductos();
        cargarVentas();
      } else {
        alert('Error al procesar la venta');
      }
    } catch (err) {
      alert('Error de conexión con el servidor');
    }
  };

  // GESTIÓN DE EMPLEADOS
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
        alert(err.error || 'Error al registrar usuario');
      }
    } catch (error) {
      alert('Error de red al registrar usuario');
    }
  };

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
          alert('Error al eliminar usuario');
        }
      } catch (error) {
        alert('Error de conexión al eliminar usuario');
      }
    }
  };

  // FILTROS
  const productosFiltrados = productos.filter((p) => {
    const termino = busqueda.toLowerCase().trim();
    const coincideNombre = p.nombre && p.nombre.toLowerCase().includes(termino);
    const coincideCodigo = p.barcode && p.barcode.toString().toLowerCase().includes(termino);
    return coincideNombre || coincideCodigo;
  });

  // FILTRAR Y ORDENAR PRODUCTOS DE 0 A MAYOR EN VISTA DE AGOTADOS
  const productosAgotados = productos
    .filter((p) => Number(p.stock) <= Number(p.min_stock || 5))
    .sort((a, b) => Number(a.stock) - Number(b.stock));

  // LOGIN
  if (!usuarioLogueado) {
    return (
      <div style={styles.loginContainer}>
        <form onSubmit={handleLogin} style={styles.loginCard}>
          <h2>🌿 TERRA FRUTOS SECOS</h2>
          <p>Sistema POS & Inventario</p>
          {loginError && <div style={styles.errorBox}>{loginError}</div>}
          <div style={styles.inputGroup}>
            <label>Usuario:</label>
            <input
              type="text"
              required
              value={loginInput.usuario}
              onChange={(e) => setLoginInput({ ...loginInput, usuario: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label>Contraseña:</label>
            <input
              type="password"
              required
              value={loginInput.password}
              onChange={(e) => setLoginInput({ ...loginInput, password: e.target.value })}
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
      {/* MENÚ LATERAL AUTOPLEGABLE */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        style={{
          ...styles.sidebar,
          transform: sidebarHovered ? 'translateX(0)' : 'translateX(-222px)',
          boxShadow: sidebarHovered ? '4px 0 20px rgba(0,0,0,0.5)' : '2px 0 8px rgba(0,0,0,0.2)'
        }}
      >
        {!sidebarHovered && (
          <div style={styles.sidebarIndicator}>
            <span>▶</span>
          </div>
        )}

        <div style={styles.brand}>
          <h3>🌿 TERRA FRUTOS SECOS</h3>
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

      {/* ÁREA DE TRABAJO PRINCIPAL */}
      <main style={styles.mainContent}>
        {/* VISTA 1: POS / CAJA */}
        {vistaActual === 'caja' && (
          <div>
            {/* BARRA SUPERIOR DE INICIO / CIERRE DE TURNO */}
            <div style={turnoActivo ? styles.turnoActivoBar : styles.turnoInactivoBar}>
              {!turnoActivo ? (
                <div style={styles.turnoFlexRow}>
                  <div>
                    <strong style={{ color: '#b91c1c' }}>⚠️ SIN TURNO INICIADO:</strong> Ingrese la base de caja e inicie turno para poder registrar ventas.
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Base Inicial ($):</label>
                    <input
                      type="number"
                      value={baseInicialInput}
                      onChange={(e) => setBaseInicialInput(e.target.value)}
                      style={styles.inputBaseShift}
                    />
                    <button onClick={handleIniciarTurno} style={styles.btnStartShift}>
                      🚀 INICIAR TURNO
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.turnoFlexRow}>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#15803d' }}>
                      🟢 TURNO ACTIVO
                    </span>{' '}
                    | Cajero: <b>{turnoActivo.nombre_cajero}</b> | Base: <b>${Number(turnoActivo.base_inicial).toLocaleString()}</b> | Inicio: <i>{turnoActivo.fecha_inicio}</i>
                  </div>
                  <button onClick={handleCerrarTurno} style={styles.btnCloseShift}>
                    🔒 CERRAR TURNO
                  </button>
                </div>
              )}
            </div>

            <div style={styles.posGrid}>
              <div style={styles.posSection}>
                <h2>Módulo de Caja</h2>
                
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

              {/* CARRITO Y PAGO */}
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

                <div style={styles.cartFooter}>
                  <div style={styles.totalRow}>
                    <span>Total a Pagar:</span>
                    <span style={{ color: '#2563eb' }}>${totalCarrito.toLocaleString()}</span>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <label style={styles.labelSmall}>💳 Seleccionar Medio de Pago:</label>
                    <select
                      value={medioPago}
                      onChange={(e) => {
                        setMedioPago(e.target.value);
                        if (e.target.value === 'transferencia') setPagaCon('');
                      }}
                      style={styles.selectPay}
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="transferencia">📲 Transferencia (Nequi / Daviplata / QR)</option>
                    </select>
                  </div>

                  {medioPago === 'efectivo' ? (
                    <>
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
                    </>
                  ) : (
                    <div style={styles.infoTransfer}>
                      ✓ Pago exacto por transferencia digital
                    </div>
                  )}

                  <button
                    onClick={procesarVenta}
                    disabled={
                      !turnoActivo ||
                      carrito.length === 0 ||
                      (medioPago === 'efectivo' && Number(pagaCon) < totalCarrito)
                    }
                    style={{
                      ...styles.btnSuccess,
                      opacity:
                        !turnoActivo ||
                        carrito.length === 0 ||
                        (medioPago === 'efectivo' && Number(pagaCon) < totalCarrito)
                          ? 0.5
                          : 1
                    }}
                  >
                    💳 Registrar e Imprimir Factura
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: INVENTARIO */}
        {vistaActual === 'inventario' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>📦 Inventario de Productos</h2>

            {/* FORMULARIO PARA CREAR NUEVO PRODUCTO */}
            <form onSubmit={handleCrearProducto} style={styles.formInline}>
              <h3>➕ Registrar Nuevo Producto</h3>
              <div style={styles.formRowProduct}>
                <div>
                  <label style={styles.labelSmall}>Código / Código de Barras:</label>
                  <input
                    type="text"
                    placeholder="Ej. 243"
                    value={nuevoProducto.barcode}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, barcode: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.labelSmall}>Nombre del Producto:*</label>
                  <input
                    type="text"
                    placeholder="Nombre y presentación"
                    required
                    value={nuevoProducto.nombre}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.labelSmall}>Precio ($):*</label>
                  <input
                    type="number"
                    placeholder="Ej: 1000"
                    required
                    value={nuevoProducto.precio}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.labelSmall}>Stock Inicial:*</label>
                  <input
                    type="number"
                    placeholder="Cantidad"
                    required
                    value={nuevoProducto.stock}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, stock: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.labelSmall}>Stock Mínimo:</label>
                  <input
                    type="number"
                    placeholder="Mínimo"
                    value={nuevoProducto.min_stock}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, min_stock: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" style={styles.btnPrimary}>
                    💾 Crear Producto
                  </button>
                </div>
              </div>
            </form>

            {/* LISTADO Y ENTRADAS */}
            <h3>Listado y Entrada de Mercancía</h3>
            <input
              type="text"
              placeholder="🔍 Buscar por código o nombre para registrar entradas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.inputSearch}
            />

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Precio ($)</th>
                  <th style={styles.th}>Stock Actual</th>
                  <th style={styles.th}>➕ Entrada (Suma)</th>
                  <th style={styles.th}>⚠️ Stock Mínimo</th>
                  <th style={styles.th}>Acciones / Guardar</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => {
                  const entradaVal = Number(entradas[p.id]) || 0;
                  const stockBase = Number(edicionStock[p.id]?.stock ?? p.stock);
                  const nuevoTotalCalculado = stockBase + entradaVal;

                  return (
                    <tr key={p.id} style={styles.tr}>
                      <td style={styles.td}><b>{p.barcode || p.id}</b></td>
                      <td style={styles.td}>{p.nombre}</td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={edicionStock[p.id]?.precio ?? p.precio}
                          onChange={(e) =>
                            setEdicionStock({
                              ...edicionStock,
                              [p.id]: {
                                ...edicionStock[p.id],
                                precio: e.target.value
                              }
                            })
                          }
                          style={styles.inputTableNumber}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={edicionStock[p.id]?.stock ?? p.stock}
                          onChange={(e) =>
                            setEdicionStock({
                              ...edicionStock,
                              [p.id]: {
                                ...edicionStock[p.id],
                                stock: e.target.value
                              }
                            })
                          }
                          style={{
                            ...styles.inputTableNumber,
                            borderColor: stockBase <= (edicionStock[p.id]?.min_stock || 5) ? '#dc2626' : '#2563eb',
                            color: stockBase <= (edicionStock[p.id]?.min_stock || 5) ? '#dc2626' : '#000',
                            fontWeight: 'bold'
                          }}
                        />
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="+ Entrada"
                            value={entradas[p.id] || ''}
                            onChange={(e) => setEntradas({ ...entradas, [p.id]: e.target.value })}
                            style={styles.inputEntrada}
                          />
                          {entradaVal > 0 && (
                            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                              (= {nuevoTotalCalculado})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={edicionStock[p.id]?.min_stock ?? (p.min_stock || 5)}
                          onChange={(e) =>
                            setEdicionStock({
                              ...edicionStock,
                              [p.id]: {
                                ...edicionStock[p.id],
                                min_stock: e.target.value
                              }
                            })
                          }
                          style={styles.inputTableNumber}
                        />
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => handleGuardarCambiosStock(p.id)}
                          style={styles.btnSaveInline}
                        >
                          💾 Actualizar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA 3: AGOTADOS Y CRÍTICOS (ORDENADOS DE 0 A MAYOR) */}
        {vistaActual === 'agotados' && usuarioLogueado.rol === 'admin' && (
          <div>
            <h2>⚠️ Productos Agotados o Bajo Stock Mínimo</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Stock Actual</th>
                  <th style={styles.th}>Stock Mínimo</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {productosAgotados.map((p) => {
                  const esAgotado = Number(p.stock) === 0;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        ...styles.tr,
                        backgroundColor: esAgotado ? '#fef2f2' : '#fffbeb'
                      }}
                    >
                      <td style={styles.td}><b>{p.barcode || p.id}</b></td>
                      <td style={styles.td}>{p.nombre}</td>
                      <td style={styles.td}>${Number(p.precio).toLocaleString()}</td>
                      <td
                        style={{
                          ...styles.td,
                          color: esAgotado ? '#dc2626' : '#d97706',
                          fontWeight: 'bold',
                          fontSize: '15px'
                        }}
                      >
                        {p.stock}
                      </td>
                      <td style={styles.td}>{p.min_stock || 5}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: esAgotado ? '#fee2e2' : '#fef3c7',
                            color: esAgotado ? '#991b1b' : '#92400e',
                            border: `1px solid ${esAgotado ? '#fca5a5' : '#fcd34d'}`
                          }}
                        >
                          {esAgotado ? '🔴 Agotado' : '🟠 Crítico'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
            <h2>📊 Reportes de Cierre de Turnos y Ventas</h2>

            {/* TABLA DE REPORTES DE TURNOS / ARQUEOS DE CAJA */}
            <h3>🔒 Arqueos y Cierres de Caja por Turno</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Turno #</th>
                  <th style={styles.th}>Cajero</th>
                  <th style={styles.th}>Base Inicial</th>
                  <th style={styles.th}>Inicio</th>
                  <th style={styles.th}>Cierre</th>
                  <th style={styles.th}>Ventas Efectivo</th>
                  <th style={styles.th}>Ventas Transferencia</th>
                  <th style={styles.th}>Total Vendido</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historialTurnos.map((t) => (
                  <tr key={t.id} style={styles.tr}>
                    <td style={styles.td}><b>#{t.id}</b></td>
                    <td style={styles.td}>{t.nombre_cajero}</td>
                    <td style={styles.td}>${Number(t.base_inicial || 0).toLocaleString()}</td>
                    <td style={styles.td}>{t.fecha_inicio}</td>
                    <td style={styles.td}>{t.fecha_cierre || 'Turno En Curso'}</td>
                    <td style={styles.td}>${Number(t.total_efectivo || 0).toLocaleString()}</td>
                    <td style={styles.td}>${Number(t.total_transferencia || 0).toLocaleString()}</td>
                    <td style={{ ...styles.td, color: '#16a34a', fontWeight: 'bold' }}>
                      ${Number(t.total_ventas || 0).toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: t.estado === 'abierto' ? '#dcfce7' : '#e2e8f0',
                          color: t.estado === 'abierto' ? '#15803d' : '#475569',
                          fontWeight: 'bold'
                        }}
                      >
                        {t.estado === 'abierto' ? '🟢 En Curso' : '🔒 Cerrado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* HISTORIAL GENERAL DE VENTAS */}
            <h3 style={{ marginTop: '30px' }}>📄 Historial Individual de Ventas</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID Venta</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Medio Pago</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} style={styles.tr}>
                    <td style={styles.td}>#{v.id}</td>
                    <td style={styles.td}>{v.fecha || 'Reciente'}</td>
                    <td style={styles.td}>{v.medio_pago || 'Efectivo'}</td>
                    <td style={styles.td}>${Number(v.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MODAL RESUMEN DE CIERRE DE TURNO */}
      {modalResumenTurno && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalResumenBox}>
            <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', color: '#1e293b' }}>
              🔒 RESUMEN DE CIERRE DE TURNO
            </h2>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <p><b>Turno ID:</b> #{modalResumenTurno.turnoId}</p>
              <p><b>Cajero:</b> {modalResumenTurno.cajero}</p>
              <p><b>Fecha Inicio:</b> {modalResumenTurno.fechaInicio}</p>
              <p><b>Fecha Cierre:</b> {modalResumenTurno.fechaCierre}</p>
              <hr />
              <p><b>Base Inicial de Caja:</b> ${modalResumenTurno.baseInicial.toLocaleString()}</p>
              <p><b>Ventas en Efectivo:</b> ${modalResumenTurno.totalEfectivo.toLocaleString()}</p>
              <p><b>Ventas por Transferencia:</b> ${modalResumenTurno.totalTransferencia.toLocaleString()}</p>
              <h3 style={{ color: '#2563eb', margin: '10px 0' }}>
                Total Vendido: ${modalResumenTurno.totalVentas.toLocaleString()}
              </h3>
              <div style={styles.boxEfectivoEsperado}>
                <span>💵 EFECTIVO TOTAL ESPERADO EN CAJA (Base + Ventas Efectivo):</span>
                <h2 style={{ margin: '5px 0', color: '#16a34a' }}>
                  ${modalResumenTurno.efectivoEsperadoEnCaja.toLocaleString()}
                </h2>
              </div>
            </div>
            <button
              onClick={() => setModalResumenTurno(null)}
              style={{ ...styles.btnPrimary, marginTop: '15px' }}
            >
              ✓ Entendido / Aceptar
            </button>
          </div>
        </div>
      )}

      {/* MODAL RECIBO POS DIAN */}
      {facturaData && (
        <div style={styles.modalOverlay}>
          <div style={styles.ticketBox} id="ticket-factura">
            <div style={{ textAlign: 'center', fontSize: '12px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                TERRA FRUTOS SECOS
              </h3>
              <p style={{ margin: 0 }}>NIT: 40044029-8</p>
              <p style={{ margin: 0 }}>Teléfono: 3183142180</p>
              <p style={{ margin: 0 }}>Dirección: CRA 7 # 15-63</p>
              <p style={{ margin: 0 }}>TUNJA, BOYACÁ - COLOMBIA</p>
              <p style={{ margin: 0, fontStyle: 'italic' }}>No Responsable de IVA</p>
              
              <div style={styles.ticketDivider}>----------------------------------------</div>
              
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
                DOCUMENTO EQUIVALENTE POS N°: {facturaData.id}
              </p>
              <p style={{ margin: 0 }}>Fecha: {facturaData.fechaHora}</p>
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
                <span>FORMA DE PAGO:</span>
                <b>{facturaData.medioPago}</b>
              </div>
              <div style={styles.ticketFlexRow}>
                <span>RECIBIDO:</span>
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

// ESTILOS DE LA APLICACIÓN
const styles = {
  appLayout: { display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', overflow: 'hidden' },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '240px',
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 999,
    transition: 'all 0.3s ease-in-out',
    boxSizing: 'border-box'
  },
  sidebarIndicator: {
    position: 'absolute',
    right: '4px',
    top: '50%',
    color: '#3b82f6',
    fontSize: '16px',
    fontWeight: 'bold',
    pointerEvents: 'none'
  },
  brand: { borderBottom: '1px solid #334155', paddingBottom: '15px' },
  navMenu: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' },
  navBtn: { padding: '12px', textAlign: 'left', background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', borderRadius: '6px', fontSize: '15px' },
  navBtnActive: { padding: '12px', textAlign: 'left', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px' },
  btnLogout: { padding: '10px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  mainContent: { flex: 1, padding: '25px', overflowY: 'auto', marginLeft: '25px', width: 'calc(100% - 25px)' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loginCard: { backgroundColor: '#fff', padding: '30px', borderRadius: '10px', width: '320px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' },
  errorBox: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px' },
  inputGroup: { marginBottom: '15px', textAlign: 'left' },
  input: { width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' },
  searchBarBox: { display: 'flex', gap: '10px', marginBottom: '15px' },
  inputSearch: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' },
  inputTableNumber: { width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' },
  inputEntrada: { width: '80px', padding: '6px', borderRadius: '4px', border: '2px solid #16a34a', backgroundColor: '#f0fdf4', textAlign: 'center', fontWeight: 'bold' },
  selectPay: { width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#eff6ff', boxSizing: 'border-box' },
  inputPay: { width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #2563eb', fontSize: '16px', fontWeight: 'bold', boxSizing: 'border-box' },
  infoTransfer: { backgroundColor: '#dcfce7', color: '#15803d', padding: '10px', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', margin: '12px 0' },
  labelSmall: { fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' },
  btnPrimary: { width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnSuccess: { width: '100%', padding: '15px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' },
  btnDanger: { width: '100%', padding: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnSaveInline: { backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' },
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
  formRowProduct: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr auto', gap: '10px', marginTop: '10px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  ticketBox: { backgroundColor: '#fff', width: '300px', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
  ticketDivider: { textAlign: 'center', margin: '8px 0', fontSize: '12px' },
  ticketTable: { width: '100%', fontSize: '12px', borderCollapse: 'collapse' },
  ticketFlexRow: { display: 'flex', justifyContent: 'space-between', margin: '4px 0' },
  
  // ESTILOS DE GESTIÓN DE TURNO
  turnoInactivoBar: { backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '12px 18px', borderRadius: '8px', marginBottom: '15px' },
  turnoActivoBar: { backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '12px 18px', borderRadius: '8px', marginBottom: '15px' },
  turnoFlexRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  inputBaseShift: { padding: '8px', width: '120px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' },
  btnStartShift: { backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnCloseShift: { backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  modalResumenBox: { backgroundColor: '#fff', width: '420px', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' },
  boxEfectivoEsperado: { backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '12px', borderRadius: '6px', marginTop: '12px', textAlign: 'center' }
};