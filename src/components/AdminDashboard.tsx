import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import type { AdminDashboardData, Category } from '../types/domain';
import { apiFetch, formatCOP, formatDateES } from '../utils/format';

interface AdminDashboardProps {
  onNotify: (msg: string, type?: 'ok' | 'error') => void;
  onDataMutated: () => void;
}

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function AdminDashboard({ onNotify, onDataMutated }: AdminDashboardProps) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'resumen' | 'citas' | 'inventario' | 'pedidos' | 'directorio'>('resumen');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockDrafts, setStockDrafts] = useState<Record<number, number>>({});

  // New Product Form
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [npNombre, setNpNombre] = useState('');
  const [npSku, setNpSku] = useState('');
  const [npMarca, setNpMarca] = useState('');
  const [npCat, setNpCat] = useState(1);
  const [npEspecie, setNpEspecie] = useState('Ambos');
  const [npPrecio, setNpPrecio] = useState('');
  const [npStock, setNpStock] = useState('15');
  const [npDesc, setNpDesc] = useState('');

  // New Vet Form
  const [showNewVet, setShowNewVet] = useState(false);
  const [nvNombre, setNvNombre] = useState('');
  const [nvEmail, setNvEmail] = useState('');
  const [nvEsp, setNvEsp] = useState('');
  const [nvReg, setNvReg] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, metaRes] = await Promise.all([
        apiFetch<AdminDashboardData & { ok: boolean }>('/api/admin/dashboard'),
        apiFetch<{ categorias: Category[] }>('/api/products/meta'),
      ]);
      setData(dashRes);
      setCategories(metaRes.categorias);
      const drafts: Record<number, number> = {};
      for (const item of dashRes.inventario) {
        drafts[item.id] = item.stock_actual;
      }
      setStockDrafts(drafts);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al cargar panel administrativo', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleSaveStock = async (productId: number) => {
    try {
      await apiFetch('/api/admin/stock', {
        method: 'PATCH',
        body: JSON.stringify({ producto_id: productId, stock_actual: stockDrafts[productId] ?? 0 }),
      });
      onNotify('Inventario actualizado.', 'ok');
      await loadDashboard();
      onDataMutated();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al actualizar stock', 'error');
    }
  };

  const handleAppointmentStatus = async (codigo: string, estado: string) => {
    try {
      await apiFetch(`/api/appointments/${encodeURIComponent(codigo)}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      onNotify(`Cita ${codigo} actualizada a ${estado}.`, 'ok');
      await loadDashboard();
      onDataMutated();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al actualizar cita', 'error');
    }
  };

  const handleOrderStatus = async (orderId: number, estado: string) => {
    try {
      await apiFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      onNotify('Estado del pedido actualizado.', 'ok');
      await loadDashboard();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al actualizar pedido', 'error');
    }
  };

  const handleToggleSchedule = async (id: number, activo: number, horaInicio: string, horaFin: string) => {
    try {
      await apiFetch(`/api/admin/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: activo ? 0 : 1, hora_inicio: horaInicio, hora_fin: horaFin }),
      });
      onNotify('Horario actualizado.', 'ok');
      await loadDashboard();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al actualizar horario', 'error');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          nombre: npNombre,
          sku: npSku,
          marca: npMarca,
          categoria_id: npCat,
          especie_objetivo: npEspecie,
          precio: Number(npPrecio),
          stock_actual: Number(npStock),
          descripcion: npDesc || 'Producto agregado desde el panel administrativo.',
        }),
      });
      setShowNewProduct(false);
      setNpNombre('');
      setNpSku('');
      setNpMarca('');
      setNpPrecio('');
      setNpDesc('');
      onNotify('Producto creado en catálogo.', 'ok');
      await loadDashboard();
      onDataMutated();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al crear producto', 'error');
    }
  };

  const handleCreateVet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/veterinarians', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nvNombre,
          email: nvEmail,
          especialidad: nvEsp,
          registro_profesional: nvReg,
        }),
      });
      setShowNewVet(false);
      setNvNombre('');
      setNvEmail('');
      setNvEsp('');
      setNvReg('');
      onNotify('Veterinario registrado con agenda estándar.', 'ok');
      await loadDashboard();
      onDataMutated();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al registrar veterinario', 'error');
    }
  };

  if (loading || !data) {
    return <div className="py-12 text-center text-sm text-[#596059]">Cargando panel administrativo...</div>;
  }

  const { kpis } = data;
  const maxCatSale = Math.max(1, ...data.ventas_por_categoria.map((v) => v.total));
  const totalCitasForChart = Math.max(1, kpis.citas.total);

  const filteredCitas = data.citas.filter((c) => {
    const matchStatus = !statusFilter || c.estado === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      c.codigo_reserva.toLowerCase().includes(q) ||
      c.propietario_nombre.toLowerCase().includes(q) ||
      c.mascota_nombre.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const filteredInventory = data.inventario.filter((i) => {
    const q = searchTerm.toLowerCase();
    return !q || i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.marca.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E4DFD4] bg-white p-5">
          <span className="text-xs font-medium text-[#596059]">Citas totales</span>
          <p className="mt-1 text-2xl font-semibold text-[#292D29] tabular-nums">{kpis.citas.total}</p>
          <p className="mt-2 text-xs text-[#596059] tabular-nums">
            Pend: {kpis.citas.pendientes} · Conf: {kpis.citas.confirmadas} · Canc: {kpis.citas.canceladas}
          </p>
        </div>

        <div className="rounded-xl border border-[#E4DFD4] bg-white p-5">
          <span className="text-xs font-medium text-[#596059]">Total de ventas</span>
          <p className="mt-1 text-2xl font-semibold text-[#536B56] tabular-nums">
            {formatCOP(kpis.ventas.total_ventas)}
          </p>
          <p className="mt-2 text-xs text-[#596059] tabular-nums">{kpis.ventas.total_pedidos} pedidos activos</p>
        </div>

        <div className="rounded-xl border border-[#E4DFD4] bg-white p-5">
          <span className="text-xs font-medium text-[#596059]">Productos disponibles</span>
          <p className="mt-1 text-2xl font-semibold text-[#292D29] tabular-nums">{kpis.productos_disponibles}</p>
          <p className="mt-2 text-xs text-[#596059] tabular-nums">
            {kpis.total_clientes} clientes · {kpis.total_mascotas} mascotas
          </p>
        </div>

        <div className="rounded-xl border border-[#E4DFD4] bg-white p-5">
          <span className="text-xs font-medium text-[#596059]">Inventario bajo</span>
          <p className="mt-1 text-2xl font-semibold text-[#B44C43] tabular-nums">{kpis.stock_bajo_count}</p>
          <p className="mt-2 text-xs text-[#596059]">Productos bajo mínimo</p>
        </div>
      </div>

      {/* Sub-navegación del dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DFD4] pb-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['resumen', 'Estadísticas'],
              ['citas', 'Citas y Horarios'],
              ['inventario', 'Productos e Inventario'],
              ['pedidos', 'Pedidos'],
              ['directorio', 'Clientes, Mascotas y Equipo'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                subTab === id
                  ? 'bg-[#536B56] text-white'
                  : 'border border-[#E4DFD4] bg-white text-[#596059] hover:text-[#292D29]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#596059]" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar registros..."
            className="w-full h-9 rounded-lg border border-[#E4DFD4] bg-white pl-9 pr-3 text-xs text-[#292D29] focus:border-[#536B56] focus:outline-none"
          />
        </div>
      </div>

      {/* TAB: RESUMEN Y GRÁFICOS */}
      {subTab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico 1: Distribución de Citas */}
          <div className="rounded-xl border border-[#E4DFD4] bg-white p-6">
            <h3 className="font-display text-base font-semibold text-[#292D29]">Estado de citas veterinarias</h3>
            <p className="text-xs text-[#596059] mt-0.5">Proporción operativa sobre {kpis.citas.total} reservas</p>

            <div className="mt-6 space-y-4">
              {[
                { label: 'Confirmadas', val: kpis.citas.confirmadas, color: '#536B56' },
                { label: 'Pendientes', val: kpis.citas.pendientes, color: '#A8B99A' },
                { label: 'Completadas', val: kpis.citas.completadas, color: '#292D29' },
                { label: 'Canceladas', val: kpis.citas.canceladas, color: '#B44C43' },
              ].map((row) => {
                const pct = Math.round((row.val / totalCitasForChart) * 100);
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#292D29]">{row.label}</span>
                      <span className="tabular-nums text-[#596059]">
                        {row.val} ({pct}%)
                      </span>
                    </div>
                    <svg className="w-full h-2.5 rounded-full overflow-hidden bg-[#EFECE3]" aria-hidden="true">
                      <rect width={`${pct}%`} height="100%" fill={row.color} rx="4" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico 2: Ventas por Categoría + Alertas de stock */}
          <div className="rounded-xl border border-[#E4DFD4] bg-white p-6 space-y-6">
            <div>
              <h3 className="font-display text-base font-semibold text-[#292D29]">Ingresos por categoría</h3>
              <div className="mt-4 space-y-3">
                {data.ventas_por_categoria.slice(0, 5).map((cat) => {
                  const pct = Math.round((cat.total / maxCatSale) * 100);
                  return (
                    <div key={cat.categoria} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#292D29]">{cat.categoria}</span>
                        <span className="tabular-nums font-medium text-[#536B56]">{formatCOP(cat.total)}</span>
                      </div>
                      <svg className="w-full h-2 rounded-full bg-[#EFECE3]" aria-hidden="true">
                        <rect width={`${pct}%`} height="100%" fill="#536B56" rx="4" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>

            {data.bajo_stock.length > 0 && (
              <div className="pt-4 border-t border-[#E4DFD4]">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#B44C43] mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Productos con inventario bajo</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-[#596059]">
                  {data.bajo_stock.map((b) => (
                    <li key={b.id} className="flex justify-between">
                      <span>{b.nombre}</span>
                      <span className="tabular-nums font-semibold text-[#B44C43]">
                        {b.stock_actual} / mín. {b.stock_minimo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CITAS Y HORARIOS */}
      {subTab === 'citas' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {(['', 'pendiente', 'confirmada', 'completada', 'cancelada'] as const).map((st) => (
              <button
                key={st || 'all'}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`h-8 rounded-lg px-3 text-xs font-medium cursor-pointer ${
                  statusFilter === st ? 'bg-[#292D29] text-white' : 'border border-[#E4DFD4] bg-white text-[#596059]'
                }`}
              >
                {st === '' ? 'Todas' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E4DFD4] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFECE3]/60 text-[#292D29]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Propietario / Mascota</th>
                  <th className="px-4 py-3 font-semibold">Servicio / Veterinario</th>
                  <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD4]">
                {filteredCitas.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F7F5EF]/60">
                    <td className="px-4 py-3 font-mono font-semibold text-[#292D29]">{c.codigo_reserva}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#292D29]">{c.propietario_nombre}</p>
                      <p className="text-[#596059]">
                        {c.mascota_nombre} ({c.mascota_especie})
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#292D29]">{c.servicio_nombre}</p>
                      <p className="text-[#596059]">{c.veterinario_nombre}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#292D29]">
                      {formatDateES(c.fecha)} · {c.hora}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.estado}
                        onChange={(e) => void handleAppointmentStatus(c.codigo_reserva, e.target.value)}
                        className="h-8 rounded border border-[#E4DFD4] bg-white px-2 text-xs text-[#292D29]"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="completada">Completada</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-[#E4DFD4] bg-white p-5">
            <h3 className="font-display text-sm font-semibold text-[#292D29] mb-3">Horarios por veterinario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.horarios.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-[#E4DFD4] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-medium text-[#292D29]">{h.veterinario_nombre}</p>
                    <p className="text-[#596059] tabular-nums">
                      {DAYS[h.dia_semana]} · {h.hora_inicio}–{h.hora_fin}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleSchedule(h.id, h.activo, h.hora_inicio, h.hora_fin)}
                    className={`h-7 px-2.5 rounded text-xs font-semibold cursor-pointer ${
                      h.activo ? 'bg-[#536B56] text-white' : 'bg-[#EFECE3] text-[#596059]'
                    }`}
                  >
                    {h.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PRODUCTOS E INVENTARIO */}
      {subTab === 'inventario' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowNewProduct((s) => !s)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#536B56] px-4 text-xs font-semibold text-white hover:bg-[#425745] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo producto</span>
            </button>
          </div>

          {showNewProduct && (
            <form
              onSubmit={handleCreateProduct}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-[#E4DFD4] bg-white p-5"
            >
              <input
                required
                value={npNombre}
                onChange={(e) => setNpNombre(e.target.value)}
                placeholder="Nombre del producto *"
                className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <input
                required
                value={npSku}
                onChange={(e) => setNpSku(e.target.value)}
                placeholder="SKU (ej. NUE-001) *"
                className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm uppercase"
              />
              <input
                required
                value={npMarca}
                onChange={(e) => setNpMarca(e.target.value)}
                placeholder="Marca *"
                className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <select
                value={npCat}
                onChange={(e) => setNpCat(Number(e.target.value))}
                className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <select
                value={npEspecie}
                onChange={(e) => setNpEspecie(e.target.value)}
                className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm bg-white"
              >
                <option value="Ambos">Perro y Gato</option>
                <option value="Perro">Perro</option>
                <option value="Gato">Gato</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  min={1000}
                  value={npPrecio}
                  onChange={(e) => setNpPrecio(e.target.value)}
                  placeholder="Precio COP *"
                  className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
                />
                <input
                  required
                  type="number"
                  min={0}
                  value={npStock}
                  onChange={(e) => setNpStock(e.target.value)}
                  placeholder="Stock *"
                  className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
                />
              </div>
              <input
                value={npDesc}
                onChange={(e) => setNpDesc(e.target.value)}
                placeholder="Descripción breve"
                className="sm:col-span-2 h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <button
                type="submit"
                className="h-10 rounded-lg bg-[#536B56] text-xs font-semibold text-white hover:bg-[#425745] cursor-pointer"
              >
                Guardar producto
              </button>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-[#E4DFD4] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFECE3]/60 text-[#292D29]">
                <tr>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 font-semibold">Precio</th>
                  <th className="px-4 py-3 font-semibold">Stock actual</th>
                  <th className="px-4 py-3 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD4]">
                {filteredInventory.map((item) => {
                  const isLow = item.stock_actual <= item.stock_minimo;
                  return (
                    <tr key={item.id} className="hover:bg-[#F7F5EF]/60">
                      <td className="px-4 py-3 font-mono text-[#596059]">{item.sku}</td>
                      <td className="px-4 py-3 font-medium text-[#292D29]">
                        {item.nombre}
                        {isLow && <span className="ml-2 text-[#B44C43] font-semibold">(Stock bajo)</span>}
                      </td>
                      <td className="px-4 py-3 text-[#596059]">{item.categoria_nombre}</td>
                      <td className="px-4 py-3 tabular-nums text-[#292D29]">{formatCOP(item.precio)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={stockDrafts[item.id] ?? item.stock_actual}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({ ...prev, [item.id]: Math.max(0, Number(e.target.value)) }))
                          }
                          className="h-8 w-20 rounded border border-[#E4DFD4] px-2 text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void handleSaveStock(item.id)}
                          className="h-8 rounded-lg border border-[#536B56] px-3 text-xs font-semibold text-[#536B56] hover:bg-[#536B56] hover:text-white transition-colors cursor-pointer"
                        >
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PEDIDOS */}
      {subTab === 'pedidos' && (
        <div className="overflow-x-auto rounded-xl border border-[#E4DFD4] bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EFECE3]/60 text-[#292D29]">
              <tr>
                <th className="px-4 py-3 font-semibold">Pedido</th>
                <th className="px-4 py-3 font-semibold">Comprador</th>
                <th className="px-4 py-3 font-semibold">Entrega</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4DFD4]">
              {data.pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-[#F7F5EF]/60">
                  <td className="px-4 py-3 font-mono font-semibold text-[#292D29]">{p.codigo_pedido}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#292D29]">{p.comprador_nombre}</p>
                    <p className="text-[#596059]">{p.comprador_email}</p>
                  </td>
                  <td className="px-4 py-3 text-[#596059]">
                    {p.ciudad} — {p.direccion_entrega}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-[#536B56]">{formatCOP(p.total)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={p.estado}
                      onChange={(e) => void handleOrderStatus(p.id, e.target.value)}
                      className="h-8 rounded border border-[#E4DFD4] bg-white px-2 text-xs text-[#292D29]"
                    >
                      <option value="pendiente_pago">Pendiente de pago</option>
                      <option value="pagado">Pagado</option>
                      <option value="en_preparacion">En preparación</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: DIRECTORIO */}
      {subTab === 'directorio' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E4DFD4] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold text-[#292D29]">Equipo veterinario</h3>
              <button
                type="button"
                onClick={() => setShowNewVet((s) => !s)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#536B56] px-3 text-xs font-semibold text-[#536B56] hover:bg-[#536B56]/10 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar veterinario</span>
              </button>
            </div>

            {showNewVet && (
              <form onSubmit={handleCreateVet} className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  required
                  value={nvNombre}
                  onChange={(e) => setNvNombre(e.target.value)}
                  placeholder="Nombre *"
                  className="h-9 rounded border border-[#E4DFD4] px-2.5 text-xs"
                />
                <input
                  required
                  type="email"
                  value={nvEmail}
                  onChange={(e) => setNvEmail(e.target.value)}
                  placeholder="Correo *"
                  className="h-9 rounded border border-[#E4DFD4] px-2.5 text-xs"
                />
                <input
                  required
                  value={nvEsp}
                  onChange={(e) => setNvEsp(e.target.value)}
                  placeholder="Especialidad *"
                  className="h-9 rounded border border-[#E4DFD4] px-2.5 text-xs"
                />
                <input
                  required
                  value={nvReg}
                  onChange={(e) => setNvReg(e.target.value)}
                  placeholder="Registro Prof. *"
                  className="h-9 rounded border border-[#E4DFD4] px-2.5 text-xs"
                />
                <button
                  type="submit"
                  className="h-9 rounded bg-[#536B56] text-xs font-semibold text-white cursor-pointer"
                >
                  Guardar
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.veterinarios.map((v) => (
                <div key={v.id} className="rounded-lg border border-[#E4DFD4] p-3.5 text-xs">
                  <p className="font-semibold text-[#292D29]">{v.nombre}</p>
                  <p className="text-[#596059]">
                    {v.especialidad} · {v.registro_profesional}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="overflow-x-auto rounded-xl border border-[#E4DFD4] bg-white">
              <div className="px-4 py-3 border-b border-[#E4DFD4] font-display text-sm font-semibold text-[#292D29]">
                Usuarios registrados ({data.usuarios.length})
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EFECE3]/60">
                  <tr>
                    <th className="px-4 py-2.5">Nombre</th>
                    <th className="px-4 py-2.5">Correo</th>
                    <th className="px-4 py-2.5">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DFD4]">
                  {data.usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2.5 font-medium">{u.nombre}</td>
                      <td className="px-4 py-2.5 text-[#596059]">{u.email}</td>
                      <td className="px-4 py-2.5 uppercase font-medium text-[#536B56]">{u.rol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E4DFD4] bg-white">
              <div className="px-4 py-3 border-b border-[#E4DFD4] font-display text-sm font-semibold text-[#292D29]">
                Pacientes / Mascotas ({data.mascotas.length})
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EFECE3]/60">
                  <tr>
                    <th className="px-4 py-2.5">Mascota</th>
                    <th className="px-4 py-2.5">Especie / Raza</th>
                    <th className="px-4 py-2.5">Propietario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DFD4]">
                  {data.mascotas.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 font-medium">{m.nombre}</td>
                      <td className="px-4 py-2.5 text-[#596059]">
                        {m.especie} · {m.raza} ({m.edad})
                      </td>
                      <td className="px-4 py-2.5 text-[#596059]">{m.propietario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
