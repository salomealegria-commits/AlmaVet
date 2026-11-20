import crypto from 'node:crypto';
import express from 'express';
import { db, initDatabase } from './db.ts';
import {
  clearSessionCookie,
  getSessionUser,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from './auth.ts';
import type { AuthUser } from '../types/domain.ts';

initDatabase();

export const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

function getAuthUser(req: express.Request): AuthUser {
  return (req as express.Request & { authUser: AuthUser }).authUser;
}

/* ==================== HEALTH ==================== */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'ready' });
});

/* ==================== AUTH ==================== */
app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, user: getSessionUser(req) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) {
    res.status(422).json({ ok: false, error: 'Ingresa tu correo electrónico y contraseña.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT u.id, u.nombre, u.email, u.telefono, u.direccion_entrega, u.password_hash, u.activo,
              r.nombre AS rol, v.id AS veterinario_id
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       LEFT JOIN veterinarios v ON v.usuario_id = u.id
       WHERE lower(u.email) = ? LIMIT 1`
    )
    .get(email) as Record<string, unknown> | undefined;

  if (!row || !row.activo || !verifyPassword(password, String(row.password_hash))) {
    res.status(401).json({ ok: false, error: 'Credenciales inválidas o cuenta inactiva.' });
    return;
  }

  const userId = Number(row.id);
  setSessionCookie(req, res, userId);

  res.json({
    ok: true,
    user: {
      id: userId,
      nombre: String(row.nombre),
      email: String(row.email),
      telefono: row.telefono ? String(row.telefono) : null,
      direccion_entrega: row.direccion_entrega ? String(row.direccion_entrega) : null,
      rol: row.rol,
      veterinario_id: row.veterinario_id ? Number(row.veterinario_id) : null,
    },
  });
});

app.post('/api/auth/register', (req, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const telefono = String(req.body?.telefono ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (nombre.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    res.status(422).json({
      ok: false,
      error: 'Verifica tu nombre (mín. 3 caracteres), correo válido y contraseña (mín. 8 caracteres).',
    });
    return;
  }

  const existing = db.prepare('SELECT id FROM usuarios WHERE lower(email) = ?').get(email);
  if (existing) {
    res.status(409).json({ ok: false, error: 'Este correo electrónico ya está registrado.' });
    return;
  }

  const passHash = hashPassword(password);
  const info = db
    .prepare('INSERT INTO usuarios (rol_id, nombre, email, telefono, password_hash) VALUES (1, ?, ?, ?, ?)')
    .run(nombre, email, telefono || null, passHash);
  const userId = Number(info.lastInsertRowid);

  setSessionCookie(req, res, userId);
  res.status(201).json({
    ok: true,
    user: {
      id: userId,
      nombre,
      email,
      telefono: telefono || null,
      direccion_entrega: null,
      rol: 'cliente',
      veterinario_id: null,
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

/* ==================== SERVICIOS & VETERINARIOS ==================== */
app.get('/api/services', (_req, res) => {
  const rows = db.prepare('SELECT * FROM servicios WHERE activo = 1 ORDER BY id ASC').all();
  const servicios = rows.map((r) => ({
    ...r,
    beneficios: JSON.parse(String(r.beneficios || '[]')) as string[],
  }));
  res.json({ ok: true, servicios });
});

app.get('/api/appointments/meta', (_req, res) => {
  const veterinarios = db
    .prepare(
      `SELECT v.id, v.usuario_id, u.nombre, u.email, v.especialidad, v.registro_profesional, v.biografia, v.activo
       FROM veterinarios v
       INNER JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.activo = 1 AND u.activo = 1
       ORDER BY v.id ASC`
    )
    .all();

  const serviciosRows = db.prepare('SELECT * FROM servicios WHERE activo = 1 ORDER BY id ASC').all();
  const servicios = serviciosRows.map((s) => ({
    ...s,
    beneficios: JSON.parse(String(s.beneficios || '[]')) as string[],
  }));

  res.json({ ok: true, veterinarios, servicios });
});

/* ==================== DISPONIBILIDAD Y CITAS ==================== */
app.get('/api/appointments/slots', (req, res) => {
  const vetId = Number(req.query.veterinario_id || 0);
  const fecha = String(req.query.fecha || '');

  if (vetId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    res.status(422).json({ ok: false, error: 'Veterinario y fecha válidos requeridos.' });
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (fecha < todayStr) {
    res.json({ ok: true, slots: [] });
    return;
  }

  const [y, m, d] = fecha.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  const diaSemana = jsDay === 0 ? 7 : jsDay;

  const horarios = db
    .prepare('SELECT hora_inicio, hora_fin, intervalo_minutos FROM horarios WHERE veterinario_id = ? AND dia_semana = ? AND activo = 1')
    .all(vetId, diaSemana) as Array<{ hora_inicio: string; hora_fin: string; intervalo_minutos: number }>;

  const ocupadosRows = db
    .prepare("SELECT hora FROM citas WHERE veterinario_id = ? AND fecha = ? AND estado <> 'cancelada'")
    .all(vetId, fecha) as Array<{ hora: string }>;
  const ocupados = new Set(ocupadosRows.map((r) => String(r.hora).slice(0, 5)));

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: Array<{ hora: string; disponible: boolean }> = [];
  for (const h of horarios) {
    const [sh, sm] = h.hora_inicio.split(':').map(Number);
    const [eh, em] = h.hora_fin.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    const step = Number(h.intervalo_minutos) || 30;

    while (cur < end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, '0');
      const mm = String(cur % 60).padStart(2, '0');
      const horaStr = `${hh}:${mm}`;
      const isPastToday = fecha === todayStr && cur <= currentMinutes;
      slots.push({
        hora: horaStr,
        disponible: !isPastToday && !ocupados.has(horaStr),
      });
      cur += step;
    }
  }

  res.json({ ok: true, slots });
});

app.post('/api/appointments', (req, res) => {
  const user = getSessionUser(req);
  const body = req.body ?? {};
  const required = [
    'propietario_nombre',
    'propietario_email',
    'propietario_telefono',
    'mascota_nombre',
    'mascota_especie',
    'servicio_id',
    'veterinario_id',
    'fecha',
    'hora',
    'motivo',
  ];

  for (const field of required) {
    if (!String(body[field] ?? '').trim()) {
      res.status(422).json({ ok: false, error: `El campo ${field.replace('_', ' ')} es obligatorio.` });
      return;
    }
  }

  const email = String(body.propietario_email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(422).json({ ok: false, error: 'Correo electrónico inválido.' });
    return;
  }

  const vetId = Number(body.veterinario_id);
  const svcId = Number(body.servicio_id);
  const fecha = String(body.fecha).trim();
  const hora = String(body.hora).trim().slice(0, 5);

  try {
    db.exec('BEGIN IMMEDIATE;');
    const conflict = db
      .prepare("SELECT id FROM citas WHERE veterinario_id = ? AND fecha = ? AND hora = ? AND estado <> 'cancelada'")
      .get(vetId, fecha, hora);

    if (conflict) {
      db.exec('ROLLBACK;');
      res.status(409).json({
        ok: false,
        error: 'Este horario ya fue reservado para el veterinario seleccionado. Por favor elige otro.',
      });
      return;
    }

    const codigo = 'AV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare(
      `INSERT INTO citas (
        codigo_reserva, cliente_id, propietario_nombre, propietario_email, propietario_telefono,
        mascota_id, mascota_nombre, mascota_especie, mascota_raza, mascota_edad,
        servicio_id, veterinario_id, fecha, hora, motivo, observaciones, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada')`
    ).run(
      codigo,
      user?.id ?? null,
      String(body.propietario_nombre).trim(),
      email,
      String(body.propietario_telefono).trim(),
      body.mascota_id ? Number(body.mascota_id) : null,
      String(body.mascota_nombre).trim(),
      String(body.mascota_especie),
      String(body.mascota_raza ?? 'Mestizo').trim() || 'Mestizo',
      String(body.mascota_edad ?? 'No especificada').trim() || 'No especificada',
      svcId,
      vetId,
      fecha,
      hora,
      String(body.motivo).trim(),
      String(body.observaciones ?? '').trim() || null
    );

    const created = db
      .prepare(
        `SELECT c.*, s.nombre AS servicio_nombre, u.nombre AS veterinario_nombre
         FROM citas c
         INNER JOIN servicios s ON s.id = c.servicio_id
         INNER JOIN veterinarios v ON v.id = c.veterinario_id
         INNER JOIN usuarios u ON u.id = v.usuario_id
         WHERE c.codigo_reserva = ?`
      )
      .get(codigo);

    db.exec('COMMIT;');
    res.status(201).json({ ok: true, cita: created });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback error
    }
    const msg = err instanceof Error ? err.message : 'Error al registrar cita';
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ ok: false, error: 'Horario ya ocupado para ese veterinario.' });
      return;
    }
    res.status(500).json({ ok: false, error: msg });
  }
});

app.get('/api/appointments', (req, res) => {
  const codigo = String(req.query.codigo ?? '').trim().toUpperCase();
  const baseQuery = `
    SELECT c.*, s.nombre AS servicio_nombre, u.nombre AS veterinario_nombre
    FROM citas c
    INNER JOIN servicios s ON s.id = c.servicio_id
    INNER JOIN veterinarios v ON v.id = c.veterinario_id
    INNER JOIN usuarios u ON u.id = v.usuario_id
  `;

  if (codigo) {
    const cita = db.prepare(`${baseQuery} WHERE upper(c.codigo_reserva) = ?`).get(codigo);
    if (!cita) {
      res.status(404).json({ ok: false, error: 'No encontramos ninguna cita con ese código de reserva.' });
      return;
    }
    res.json({ ok: true, citas: [cita] });
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Inicia sesión o busca por código de reserva.' });
    return;
  }

  let citas;
  if (user.rol === 'cliente') {
    citas = db
      .prepare(`${baseQuery} WHERE c.cliente_id = ? OR lower(c.propietario_email) = ? ORDER BY c.fecha DESC, c.hora DESC`)
      .all(user.id, user.email.toLowerCase());
  } else if (user.rol === 'veterinario') {
    citas = db
      .prepare(`${baseQuery} WHERE c.veterinario_id = ? ORDER BY c.fecha DESC, c.hora DESC`)
      .all(user.veterinario_id ?? 0);
  } else {
    citas = db.prepare(`${baseQuery} ORDER BY c.fecha DESC, c.hora DESC`).all();
  }

  res.json({ ok: true, citas });
});

app.patch('/api/appointments/:codigo', (req, res) => {
  const codigo = String(req.params.codigo).trim().toUpperCase();
  const body = req.body ?? {};
  const cita = db.prepare('SELECT * FROM citas WHERE upper(codigo_reserva) = ?').get(codigo) as
    | Record<string, unknown>
    | undefined;

  if (!cita) {
    res.status(404).json({ ok: false, error: 'Cita no encontrada.' });
    return;
  }

  if (body.estado === 'cancelada') {
    db.prepare("UPDATE citas SET estado = 'cancelada' WHERE id = ?").run(cita.id);
    res.json({ ok: true, mensaje: 'Cita cancelada y horario liberado correctamente.' });
    return;
  }

  if (body.fecha && body.hora) {
    const fecha = String(body.fecha).trim();
    const hora = String(body.hora).trim().slice(0, 5);
    try {
      db.prepare("UPDATE citas SET fecha = ?, hora = ?, estado = 'confirmada' WHERE id = ?").run(fecha, hora, cita.id);
      res.json({ ok: true, mensaje: 'Cita reprogramada con éxito.' });
    } catch {
      res.status(409).json({ ok: false, error: 'El nuevo horario seleccionado ya está ocupado.' });
    }
    return;
  }

  if (body.estado) {
    const user = getSessionUser(req);
    if (!user || (user.rol !== 'administrador' && user.rol !== 'veterinario')) {
      res.status(403).json({ ok: false, error: 'Solo veterinarios o administradores pueden cambiar este estado.' });
      return;
    }
    db.prepare('UPDATE citas SET estado = ? WHERE id = ?').run(String(body.estado), cita.id);
    res.json({ ok: true, mensaje: 'Estado de la cita actualizado.' });
    return;
  }

  res.status(400).json({ ok: false, error: 'No se proporcionaron cambios válidos.' });
});

/* ==================== MASCOTAS ==================== */
app.get('/api/pets', requireAuth(), (req, res) => {
  const user = getAuthUser(req);
  const mascotas = db.prepare('SELECT * FROM mascotas WHERE propietario_id = ? ORDER BY id DESC').all(user.id);
  res.json({ ok: true, mascotas });
});

app.post('/api/pets', requireAuth(), (req, res) => {
  const user = getAuthUser(req);
  const nombre = String(req.body?.nombre ?? '').trim();
  const especie = String(req.body?.especie ?? 'Perro');
  const raza = String(req.body?.raza ?? 'Mestizo').trim() || 'Mestizo';
  const edad = String(req.body?.edad ?? '1 año').trim() || '1 año';
  const notas = String(req.body?.notas_medicas ?? '').trim() || null;

  if (!nombre) {
    res.status(422).json({ ok: false, error: 'El nombre de la mascota es obligatorio.' });
    return;
  }

  const info = db
    .prepare('INSERT INTO mascotas (propietario_id, nombre, especie, raza, edad, notas_medicas) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.id, nombre, especie, raza, edad, notas);

  const mascota = db.prepare('SELECT * FROM mascotas WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ ok: true, mascota });
});

app.delete('/api/pets/:id', requireAuth(), (req, res) => {
  const user = getAuthUser(req);
  const petId = Number(req.params.id);
  db.prepare('DELETE FROM mascotas WHERE id = ? AND propietario_id = ?').run(petId, user.id);
  res.json({ ok: true });
});

/* ==================== TIENDA & PRODUCTOS ==================== */
app.get('/api/products/meta', (_req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY id ASC').all();
  const marcasRows = db
    .prepare('SELECT DISTINCT marca FROM productos WHERE activo = 1 ORDER BY marca ASC')
    .all() as Array<{ marca: string }>;
  res.json({ ok: true, categorias, marcas: marcasRows.map((m) => m.marca) });
});

app.get('/api/products', (req, res) => {
  const where: string[] = ['p.activo = 1'];
  const params: unknown[] = [];

  if (req.query.categoria) {
    where.push('c.slug = ?');
    params.push(String(req.query.categoria));
  }
  if (req.query.especie) {
    where.push("(p.especie_objetivo = ? OR p.especie_objetivo = 'Ambos')");
    params.push(String(req.query.especie));
  }
  if (req.query.marca) {
    where.push('p.marca = ?');
    params.push(String(req.query.marca));
  }
  if (req.query.max_precio) {
    where.push('p.precio <= ?');
    params.push(Number(req.query.max_precio));
  }
  if (req.query.q) {
    const q = `%${String(req.query.q).trim().toLowerCase()}%`;
    where.push('(lower(p.nombre) LIKE ? OR lower(p.descripcion) LIKE ? OR lower(p.marca) LIKE ?)');
    params.push(q, q, q);
  }

  const sql = `
    SELECT p.*, c.nombre AS categoria_nombre, c.slug AS categoria_slug,
           i.stock_actual, i.stock_minimo
    FROM productos p
    INNER JOIN categorias c ON c.id = p.categoria_id
    INNER JOIN inventario i ON i.producto_id = p.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.destacado DESC, p.id ASC
  `;
  const productos = db.prepare(sql).all(...params);
  res.json({ ok: true, productos });
});

/* ==================== CARRITO PERSISTENTE ==================== */
app.get('/api/cart', requireAuth(), (req, res) => {
  const user = getAuthUser(req);
  const items = db
    .prepare(
      `SELECT c.producto_id, c.cantidad, p.nombre, p.precio, p.imagen_url, p.marca, i.stock_actual AS stock
       FROM carrito c
       INNER JOIN productos p ON p.id = c.producto_id
       INNER JOIN inventario i ON i.producto_id = p.id
       WHERE c.usuario_id = ? AND p.activo = 1`
    )
    .all(user.id);
  res.json({ ok: true, items });
});

app.put('/api/cart', requireAuth(), (req, res) => {
  const user = getAuthUser(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  db.exec('BEGIN;');
  try {
    db.prepare('DELETE FROM carrito WHERE usuario_id = ?').run(user.id);
    const ins = db.prepare('INSERT INTO carrito (usuario_id, producto_id, cantidad) VALUES (?, ?, ?)');
    for (const item of items) {
      const pid = Number(item.producto_id);
      const qty = Math.max(1, Number(item.cantidad || 1));
      if (pid > 0) ins.run(user.id, pid, qty);
    }
    db.exec('COMMIT;');
    res.json({ ok: true });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Error al sincronizar carrito' });
  }
});

/* ==================== PEDIDOS Y CHECKOUT ==================== */
app.get('/api/orders', requireAuth(), (req, res) => {
  const user = getAuthUser(req);
  const sql =
    user.rol === 'administrador'
      ? 'SELECT * FROM pedidos ORDER BY id DESC'
      : 'SELECT * FROM pedidos WHERE usuario_id = ? OR lower(comprador_email) = ? ORDER BY id DESC';
  const pedidos = (
    user.rol === 'administrador' ? db.prepare(sql).all() : db.prepare(sql).all(user.id, user.email.toLowerCase())
  ) as Array<Record<string, unknown>>;

  const detStmt = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?');
  for (const p of pedidos) {
    p.items = detStmt.all(p.id);
  }
  res.json({ ok: true, pedidos });
});

app.post('/api/orders', (req, res) => {
  const user = getSessionUser(req);
  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    res.status(422).json({ ok: false, error: 'Tu carrito está vacío.' });
    return;
  }

  for (const field of ['comprador_nombre', 'comprador_email', 'comprador_telefono', 'direccion_entrega', 'ciudad']) {
    if (!String(body[field] ?? '').trim()) {
      res.status(422).json({ ok: false, error: `El campo ${field.replace('_', ' ')} es obligatorio.` });
      return;
    }
  }

  try {
    db.exec('BEGIN IMMEDIATE;');
    let subtotal = 0;
    const lines: Array<{ producto_id: number; nombre: string; cantidad: number; precio: number; subtotal: number }> = [];

    const prodStmt = db.prepare(
      `SELECT p.id, p.nombre, p.precio, i.stock_actual
       FROM productos p
       INNER JOIN inventario i ON i.producto_id = p.id
       WHERE p.id = ? AND p.activo = 1`
    );

    for (const item of items) {
      const pid = Number(item.producto_id);
      const qty = Math.max(1, Number(item.cantidad || 1));
      const prod = prodStmt.get(pid) as { id: number; nombre: string; precio: number; stock_actual: number } | undefined;
      if (!prod) {
        throw new Error(`Producto #${pid} no disponible.`);
      }
      if (Number(prod.stock_actual) < qty) {
        throw new Error(`Stock insuficiente para ${prod.nombre} (disponibles: ${prod.stock_actual}).`);
      }
      const lineSub = Number(prod.precio) * qty;
      subtotal += lineSub;
      lines.push({
        producto_id: pid,
        nombre: String(prod.nombre),
        cantidad: qty,
        precio: Number(prod.precio),
        subtotal: lineSub,
      });
    }

    const costoEnvio = subtotal >= 180000 ? 0 : 12000;
    const total = subtotal + costoEnvio;
    const codigoPedido = 'PED-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const pedInfo = db
      .prepare(
        `INSERT INTO pedidos (codigo_pedido, usuario_id, comprador_nombre, comprador_email, comprador_telefono, direccion_entrega, ciudad, subtotal, costo_envio, total, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_pago')`
      )
      .run(
        codigoPedido,
        user?.id ?? null,
        String(body.comprador_nombre).trim(),
        String(body.comprador_email).trim().toLowerCase(),
        String(body.comprador_telefono).trim(),
        String(body.direccion_entrega).trim(),
        String(body.ciudad).trim(),
        subtotal,
        costoEnvio,
        total
      );
    const pedidoId = Number(pedInfo.lastInsertRowid);

    const insDet = db.prepare(
      'INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const updInv = db.prepare(
      "UPDATE inventario SET stock_actual = stock_actual - ?, actualizado_en = datetime('now') WHERE producto_id = ?"
    );

    for (const l of lines) {
      insDet.run(pedidoId, l.producto_id, l.nombre, l.cantidad, l.precio, l.subtotal);
      updInv.run(l.cantidad, l.producto_id);
    }

    db.prepare(
      "INSERT INTO pagos (pedido_id, pasarela, metodo, monto, moneda, estado) VALUES (?, 'integracion_lista', ?, ?, 'COP', 'pendiente')"
    ).run(pedidoId, String(body.metodo_pago ?? 'contraentrega_demo'), total);

    if (user) {
      db.prepare('DELETE FROM carrito WHERE usuario_id = ?').run(user.id);
    }

    db.exec('COMMIT;');
    res.status(201).json({
      ok: true,
      codigo_pedido: codigoPedido,
      subtotal,
      costo_envio: costoEnvio,
      total,
      payment_intent_ready: true,
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore
    }
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error al procesar pedido' });
  }
});

/* ==================== PANEL ADMINISTRATIVO ==================== */
app.get('/api/admin/dashboard', requireAuth(['administrador']), (_req, res) => {
  const citasStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
         SUM(CASE WHEN estado = 'confirmada' THEN 1 ELSE 0 END) AS confirmadas,
         SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) AS completadas,
         SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas
       FROM citas`
    )
    .get() as Record<string, number>;

  const ventas = db
    .prepare(
      "SELECT COALESCE(SUM(total), 0) AS total_ventas, COUNT(*) AS total_pedidos FROM pedidos WHERE estado <> 'cancelado'"
    )
    .get() as { total_ventas: number; total_pedidos: number };

  const productosRow = db.prepare('SELECT COUNT(*) AS cnt FROM productos WHERE activo = 1').get() as { cnt: number };
  const clientesRow = db.prepare('SELECT COUNT(*) AS cnt FROM usuarios WHERE rol_id = 1').get() as { cnt: number };
  const mascotasRow = db.prepare('SELECT COUNT(*) AS cnt FROM mascotas').get() as { cnt: number };

  const bajoStock = db
    .prepare(
      `SELECT p.id, p.sku, p.nombre, i.stock_actual, i.stock_minimo
       FROM inventario i
       INNER JOIN productos p ON p.id = i.producto_id
       WHERE i.stock_actual <= i.stock_minimo AND p.activo = 1
       ORDER BY i.stock_actual ASC`
    )
    .all();

  const ventasPorCategoria = db
    .prepare(
      `SELECT c.nombre AS categoria, COALESCE(SUM(dp.subtotal), 0) AS total
       FROM categorias c
       LEFT JOIN productos p ON p.categoria_id = c.id
       LEFT JOIN detalle_pedidos dp ON dp.producto_id = p.id
       GROUP BY c.id
       ORDER BY total DESC`
    )
    .all();

  const usuarios = db
    .prepare(
      `SELECT u.id, u.nombre, u.email, u.telefono, r.nombre AS rol, u.activo, u.creado_en
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       ORDER BY u.id DESC`
    )
    .all();

  const mascotas = db
    .prepare(
      `SELECT m.*, u.nombre AS propietario
       FROM mascotas m
       INNER JOIN usuarios u ON u.id = m.propietario_id
       ORDER BY m.id DESC`
    )
    .all();

  const veterinarios = db
    .prepare(
      `SELECT v.id, v.usuario_id, u.nombre, u.email, v.especialidad, v.registro_profesional, v.biografia, v.activo
       FROM veterinarios v
       INNER JOIN usuarios u ON u.id = v.usuario_id
       ORDER BY v.id ASC`
    )
    .all();

  const horarios = db
    .prepare(
      `SELECT h.*, u.nombre AS veterinario_nombre
       FROM horarios h
       INNER JOIN veterinarios v ON v.id = h.veterinario_id
       INNER JOIN usuarios u ON u.id = v.usuario_id
       ORDER BY h.veterinario_id ASC, h.dia_semana ASC`
    )
    .all();

  const serviciosRows = db.prepare('SELECT * FROM servicios ORDER BY id ASC').all();
  const servicios = serviciosRows.map((s) => ({
    ...s,
    beneficios: JSON.parse(String(s.beneficios || '[]')) as string[],
  }));

  const inventario = db
    .prepare(
      `SELECT p.*, c.nombre AS categoria_nombre, c.slug AS categoria_slug, i.stock_actual, i.stock_minimo
       FROM productos p
       INNER JOIN categorias c ON c.id = p.categoria_id
       INNER JOIN inventario i ON i.producto_id = p.id
       ORDER BY p.id ASC`
    )
    .all();

  const citas = db
    .prepare(
      `SELECT c.*, s.nombre AS servicio_nombre, u.nombre AS veterinario_nombre
       FROM citas c
       INNER JOIN servicios s ON s.id = c.servicio_id
       INNER JOIN veterinarios v ON v.id = c.veterinario_id
       INNER JOIN usuarios u ON u.id = v.usuario_id
       ORDER BY c.fecha DESC, c.hora DESC`
    )
    .all();

  const pedidos = db.prepare('SELECT * FROM pedidos ORDER BY id DESC').all() as Array<Record<string, unknown>>;
  const detStmt = db.prepare('SELECT * FROM detalle_pedidos WHERE pedido_id = ?');
  for (const p of pedidos) {
    p.items = detStmt.all(p.id);
  }

  res.json({
    ok: true,
    kpis: {
      citas: {
        total: Number(citasStats?.total ?? 0),
        pendientes: Number(citasStats?.pendientes ?? 0),
        confirmadas: Number(citasStats?.confirmadas ?? 0),
        completadas: Number(citasStats?.completadas ?? 0),
        canceladas: Number(citasStats?.canceladas ?? 0),
      },
      ventas: {
        total_ventas: Number(ventas?.total_ventas ?? 0),
        total_pedidos: Number(ventas?.total_pedidos ?? 0),
      },
      productos_disponibles: Number(productosRow.cnt),
      stock_bajo_count: bajoStock.length,
      total_clientes: Number(clientesRow.cnt),
      total_mascotas: Number(mascotasRow.cnt),
    },
    bajo_stock: bajoStock,
    ventas_por_categoria: ventasPorCategoria,
    usuarios,
    mascotas,
    veterinarios,
    horarios,
    servicios,
    inventario,
    citas,
    pedidos,
  });
});

app.patch('/api/admin/stock', requireAuth(['administrador']), (req, res) => {
  const productoId = Number(req.body?.producto_id);
  const stockActual = Math.max(0, Number(req.body?.stock_actual ?? 0));
  if (productoId <= 0) {
    res.status(422).json({ ok: false, error: 'ID de producto inválido.' });
    return;
  }
  db.prepare("UPDATE inventario SET stock_actual = ?, actualizado_en = datetime('now') WHERE producto_id = ?").run(
    stockActual,
    productoId
  );
  res.json({ ok: true });
});

app.post('/api/admin/products', requireAuth(['administrador']), (req, res) => {
  const b = req.body ?? {};
  const nombre = String(b.nombre ?? '').trim();
  const marca = String(b.marca ?? '').trim();
  const sku = String(b.sku ?? '').trim().toUpperCase();
  const categoriaId = Number(b.categoria_id || 1);
  const especie = String(b.especie_objetivo || 'Ambos');
  const precio = Number(b.precio || 0);
  const stock = Math.max(0, Number(b.stock_actual ?? 10));
  const stockMin = Math.max(1, Number(b.stock_minimo ?? 5));
  const descripcion = String(b.descripcion ?? '').trim();
  const detalle = String(b.detalle_tecnico ?? '').trim();
  const imagen = String(b.imagen_url || '/src/assets/images/product_dog_nutrition_1795145052484.jpg');

  if (!nombre || !marca || !sku || precio <= 0) {
    res.status(422).json({ ok: false, error: 'Nombre, SKU, marca y precio válido son obligatorios.' });
    return;
  }

  try {
    db.exec('BEGIN;');
    const info = db
      .prepare(
        'INSERT INTO productos (categoria_id, sku, nombre, marca, especie_objetivo, descripcion, detalle_tecnico, precio, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(categoriaId, sku, nombre, marca, especie, descripcion, detalle || null, precio, imagen);
    const pid = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO inventario (producto_id, stock_actual, stock_minimo) VALUES (?, ?, ?)').run(
      pid,
      stock,
      stockMin
    );
    db.exec('COMMIT;');
    res.status(201).json({ ok: true, id: pid });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error al crear producto' });
  }
});

app.patch('/api/admin/orders/:id', requireAuth(['administrador']), (req, res) => {
  const id = Number(req.params.id);
  const estado = String(req.body?.estado ?? '');
  if (!estado) {
    res.status(422).json({ ok: false, error: 'Estado requerido.' });
    return;
  }
  db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, id);
  res.json({ ok: true });
});

app.patch('/api/admin/schedules/:id', requireAuth(['administrador']), (req, res) => {
  const id = Number(req.params.id);
  const activo = req.body?.activo ? 1 : 0;
  const horaInicio = String(req.body?.hora_inicio ?? '09:00');
  const horaFin = String(req.body?.hora_fin ?? '17:00');
  db.prepare('UPDATE horarios SET activo = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?').run(
    activo,
    horaInicio,
    horaFin,
    id
  );
  res.json({ ok: true });
});

app.post('/api/admin/veterinarians', requireAuth(['administrador']), (req, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const especialidad = String(req.body?.especialidad ?? '').trim();
  const registro = String(req.body?.registro_profesional ?? '').trim();
  const password = String(req.body?.password ?? 'DemoVet2026!');

  if (!nombre || !email || !especialidad || !registro) {
    res.status(422).json({ ok: false, error: 'Todos los campos del veterinario son obligatorios.' });
    return;
  }

  try {
    db.exec('BEGIN;');
    const uInfo = db
      .prepare('INSERT INTO usuarios (rol_id, nombre, email, password_hash) VALUES (2, ?, ?, ?)')
      .run(nombre, email, hashPassword(password));
    const userId = Number(uInfo.lastInsertRowid);
    const vInfo = db
      .prepare('INSERT INTO veterinarios (usuario_id, especialidad, registro_profesional) VALUES (?, ?, ?)')
      .run(userId, especialidad, registro);
    const vetId = Number(vInfo.lastInsertRowid);
    const insHor = db.prepare(
      'INSERT INTO horarios (veterinario_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos) VALUES (?, ?, ?, ?, ?)'
    );
    for (let d = 1; d <= 5; d++) {
      insHor.run(vetId, d, '09:00', '17:00', 30);
    }
    db.exec('COMMIT;');
    res.status(201).json({ ok: true, id: vetId });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'No se pudo crear veterinario' });
  }
});
