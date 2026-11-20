import { useEffect, useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import type { Appointment, AuthUser, Order, Pet } from '../types/domain';
import { apiFetch, formatCOP, formatDateES } from '../utils/format';
import { AdminDashboard } from './AdminDashboard';

interface AccountPortalProps {
  user: AuthUser | null;
  pets: Pet[];
  refreshSignal: number;
  onUserChange: (user: AuthUser | null) => void;
  onPetsChange: () => void;
  onDataMutated: () => void;
  onNotify: (msg: string, type?: 'ok' | 'error') => void;
}

export function AccountPortal({
  user,
  pets,
  refreshSignal,
  onUserChange,
  onPetsChange,
  onDataMutated,
  onNotify,
}: AccountPortalProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTel, setRegTel] = useState('');
  const [regPass, setRegPass] = useState('');

  const [activeTab, setActiveTab] = useState<'citas' | 'mascotas' | 'pedidos' | 'admin'>('citas');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // New Pet form
  const [petNombre, setPetNombre] = useState('');
  const [petEspecie, setPetEspecie] = useState<'Perro' | 'Gato' | 'Otro'>('Perro');
  const [petRaza, setPetRaza] = useState('');
  const [petEdad, setPetEdad] = useState('');
  const [petNotas, setPetNotas] = useState('');

  const loadUserRecords = async () => {
    if (!user) return;
    try {
      const [appRes, ordRes] = await Promise.all([
        apiFetch<{ citas: Appointment[] }>('/api/appointments'),
        apiFetch<{ pedidos: Order[] }>('/api/orders'),
      ]);
      setAppointments(appRes.citas);
      setOrders(ordRes.pedidos);
    } catch {
      // ignore transient
    }
  };

  useEffect(() => {
    if (user) {
      if (user.rol === 'administrador') {
        setActiveTab('admin');
      } else {
        setActiveTab('citas');
      }
      void loadUserRecords();
    }
  }, [user, refreshSignal]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      onUserChange(res.user);
      onNotify(`Bienvenido, ${res.user.nombre}`, 'ok');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al iniciar sesión', 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nombre: regNombre,
          email: regEmail,
          telefono: regTel,
          password: regPass,
        }),
      });
      onUserChange(res.user);
      setRegNombre('');
      setRegEmail('');
      setRegTel('');
      setRegPass('');
      onNotify('Cuenta creada correctamente.', 'ok');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'No se pudo crear la cuenta', 'error');
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    onUserChange(null);
    onNotify('Sesión cerrada.', 'ok');
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/pets', {
        method: 'POST',
        body: JSON.stringify({
          nombre: petNombre,
          especie: petEspecie,
          raza: petRaza,
          edad: petEdad,
          notas_medicas: petNotas,
        }),
      });
      setPetNombre('');
      setPetRaza('');
      setPetEdad('');
      setPetNotas('');
      onPetsChange();
      onNotify('Mascota registrada en tu perfil.', 'ok');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al registrar mascota', 'error');
    }
  };

  const handleDeletePet = async (id: number) => {
    await apiFetch(`/api/pets/${id}`, { method: 'DELETE' });
    onPetsChange();
    onNotify('Mascota eliminada del perfil.', 'ok');
  };

  const handleAppointmentAction = async (codigo: string, estado: string) => {
    try {
      await apiFetch(`/api/appointments/${encodeURIComponent(codigo)}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      onNotify(`Cita ${codigo} actualizada.`, 'ok');
      await loadUserRecords();
      onDataMutated();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'No se pudo actualizar la cita', 'error');
    }
  };

  return (
    <section id="mi-cuenta" className="py-20 border-t border-[#E4DFD4] bg-[#EFECE3]/50">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold tracking-wider text-[#536B56] mb-2">
            Portal de usuarios · Cliente, Veterinario y Administrador
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#292D29]">
            Mi cuenta
          </h2>
          <p className="mt-2 text-base text-[#596059]">
            Gestiona tus mascotas, citas veterinarias e historial de compras, o accede al panel médico y administrativo.
          </p>
        </div>

        {!user ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-xl border border-[#E4DFD4] bg-white p-6 sm:p-8">
              <h3 className="font-display text-xl font-semibold text-[#292D29]">Iniciar sesión</h3>
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="loginEmail" className="block text-xs font-semibold text-[#292D29] mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    id="loginEmail"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="cliente@almavet.demo"
                    className="w-full h-11 rounded-lg border border-[#E4DFD4] px-3.5 text-sm focus:border-[#536B56] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="loginPass" className="block text-xs font-semibold text-[#292D29] mb-1.5">
                    Contraseña
                  </label>
                  <input
                    id="loginPass"
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 rounded-lg border border-[#E4DFD4] px-3.5 text-sm focus:border-[#536B56] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#536B56] px-6 text-sm font-semibold text-white hover:bg-[#425745] transition-colors cursor-pointer"
                >
                  Ingresar
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#E4DFD4]">
                <p className="text-xs text-[#596059] mb-2.5">
                  Cuentas de demostración <strong className="text-[#292D29]">[DEMO]</strong> (contraseña:{' '}
                  <span className="font-mono text-[#292D29]">DemoVet2026!</span>):
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Cliente [DEMO]', email: 'cliente@almavet.demo' },
                    { label: 'Veterinario [DEMO]', email: 'camila.rios@almavet.demo' },
                    { label: 'Administrador [DEMO]', email: 'admin@almavet.demo' },
                  ].map((demo) => (
                    <button
                      key={demo.email}
                      type="button"
                      onClick={() => {
                        setLoginEmail(demo.email);
                        setLoginPass('DemoVet2026!');
                      }}
                      className="h-8 rounded-lg border border-[#E4DFD4] bg-[#F7F5EF] px-3 text-xs font-medium text-[#292D29] hover:border-[#536B56] transition-colors cursor-pointer"
                    >
                      {demo.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E4DFD4] bg-white p-6 sm:p-8">
              <h3 className="font-display text-xl font-semibold text-[#292D29]">Crear cuenta de cliente</h3>
              <form onSubmit={handleRegister} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="regNombre" className="block text-xs font-semibold text-[#292D29] mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    id="regNombre"
                    required
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full h-11 rounded-lg border border-[#E4DFD4] px-3.5 text-sm focus:border-[#536B56] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="regEmail" className="block text-xs font-semibold text-[#292D29] mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="regEmail"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full h-11 rounded-lg border border-[#E4DFD4] px-3.5 text-sm focus:border-[#536B56] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="regTel" className="block text-xs font-semibold text-[#292D29] mb-1.5">
                      Teléfono
                    </label>
                    <input
                      id="regTel"
                      value={regTel}
                      onChange={(e) => setRegTel(e.target.value)}
                      placeholder="300 000 0000"
                      className="w-full h-11 rounded-lg border border-[#E4DFD4] px-3.5 text-sm focus:border-[#536B56] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="regPass" className="block text-xs font-semibold text-[#292D29] mb-1.5">
                    Contraseña (mínimo 8 caracteres)
                  </label>
                  <input
                    id="regPass"
                    type="password"
                    minLength={8}
                    required
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 rounded-lg border border-[#E4DFD4] px-3.5 text-sm focus:border-[#536B56] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-[#536B56] px-6 text-sm font-semibold text-[#536B56] hover:bg-[#536B56] hover:text-white transition-colors cursor-pointer"
                >
                  Registrarme
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cabecera de sesión */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E4DFD4] bg-white p-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#292D29]">Hola, {user.nombre}</h3>
                <p className="text-xs text-[#596059]">
                  {user.email} · Rol activo: <strong className="uppercase text-[#536B56]">{user.rol}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E4DFD4] px-3.5 text-xs font-semibold text-[#292D29] hover:border-[#B44C43] hover:text-[#B44C43] transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>

            {/* Tabs por rol */}
            <div className="flex flex-wrap gap-2">
              {user.rol === 'administrador' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`h-10 rounded-lg px-4 text-xs font-semibold cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-[#536B56] text-white'
                      : 'border border-[#E4DFD4] bg-white text-[#596059]'
                  }`}
                >
                  Panel administrativo
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('citas')}
                className={`h-10 rounded-lg px-4 text-xs font-semibold cursor-pointer ${
                  activeTab === 'citas'
                    ? 'bg-[#536B56] text-white'
                    : 'border border-[#E4DFD4] bg-white text-[#596059]'
                }`}
              >
                {user.rol === 'veterinario' ? 'Citas asignadas' : 'Mis citas'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mascotas')}
                className={`h-10 rounded-lg px-4 text-xs font-semibold cursor-pointer ${
                  activeTab === 'mascotas'
                    ? 'bg-[#536B56] text-white'
                    : 'border border-[#E4DFD4] bg-white text-[#596059]'
                }`}
              >
                Mis mascotas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pedidos')}
                className={`h-10 rounded-lg px-4 text-xs font-semibold cursor-pointer ${
                  activeTab === 'pedidos'
                    ? 'bg-[#536B56] text-white'
                    : 'border border-[#E4DFD4] bg-white text-[#596059]'
                }`}
              >
                Historial de compras
              </button>
            </div>

            {activeTab === 'admin' && user.rol === 'administrador' && (
              <AdminDashboard onNotify={onNotify} onDataMutated={onDataMutated} />
            )}

            {activeTab === 'citas' && (
              <div className="overflow-x-auto rounded-xl border border-[#E4DFD4] bg-white">
                {appointments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#596059]">No hay citas registradas.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EFECE3]/60 text-[#292D29]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Mascota</th>
                        <th className="px-4 py-3 font-semibold">Servicio</th>
                        <th className="px-4 py-3 font-semibold">Veterinario</th>
                        <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                        <th className="px-4 py-3 font-semibold">Motivo</th>
                        <th className="px-4 py-3 font-semibold">Estado / Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD4]">
                      {appointments.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-mono font-semibold text-[#292D29]">{c.codigo_reserva}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#292D29]">{c.mascota_nombre}</p>
                            <p className="text-[#596059]">
                              {c.mascota_especie} · {c.mascota_raza}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[#292D29]">{c.servicio_nombre}</td>
                          <td className="px-4 py-3 text-[#596059]">{c.veterinario_nombre}</td>
                          <td className="px-4 py-3 tabular-nums text-[#292D29]">
                            {formatDateES(c.fecha)} · {c.hora}
                          </td>
                          <td className="px-4 py-3 text-[#596059] max-w-xs">{c.motivo}</td>
                          <td className="px-4 py-3">
                            {user.rol === 'veterinario' || user.rol === 'administrador' ? (
                              <select
                                value={c.estado}
                                onChange={(e) => void handleAppointmentAction(c.codigo_reserva, e.target.value)}
                                className="h-8 rounded border border-[#E4DFD4] bg-white px-2 text-xs"
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="confirmada">Confirmada</option>
                                <option value="completada">Completada</option>
                                <option value="cancelada">Cancelada</option>
                              </select>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="uppercase font-semibold text-[#536B56]">{c.estado}</span>
                                {c.estado !== 'cancelada' && c.estado !== 'completada' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleAppointmentAction(c.codigo_reserva, 'cancelada')}
                                    className="text-[#B44C43] hover:underline cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'mascotas' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form onSubmit={handleAddPet} className="rounded-xl border border-[#E4DFD4] bg-white p-6 space-y-4">
                  <h4 className="font-display text-base font-semibold text-[#292D29]">Registrar nueva mascota</h4>
                  <input
                    required
                    value={petNombre}
                    onChange={(e) => setPetNombre(e.target.value)}
                    placeholder="Nombre de tu mascota *"
                    className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={petEspecie}
                      onChange={(e) => setPetEspecie(e.target.value as 'Perro' | 'Gato' | 'Otro')}
                      className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm bg-white"
                    >
                      <option value="Perro">Perro</option>
                      <option value="Gato">Gato</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <input
                      value={petRaza}
                      onChange={(e) => setPetRaza(e.target.value)}
                      placeholder="Raza"
                      className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
                    />
                    <input
                      value={petEdad}
                      onChange={(e) => setPetEdad(e.target.value)}
                      placeholder="Edad"
                      className="h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={petNotas}
                    onChange={(e) => setPetNotas(e.target.value)}
                    placeholder="Notas médicas, vacunas o alergias"
                    className="w-full rounded-lg border border-[#E4DFD4] p-3 text-sm"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-lg bg-[#536B56] px-5 text-xs font-semibold text-white hover:bg-[#425745] cursor-pointer"
                  >
                    Guardar mascota
                  </button>
                </form>

                <div className="rounded-xl border border-[#E4DFD4] bg-white p-6 space-y-3">
                  <h4 className="font-display text-base font-semibold text-[#292D29]">Mascotas registradas</h4>
                  {pets.length === 0 ? (
                    <p className="text-sm text-[#596059]">Aún no tienes mascotas guardadas en tu cuenta.</p>
                  ) : (
                    pets.map((pet) => (
                      <div
                        key={pet.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[#E4DFD4] p-4"
                      >
                        <div>
                          <p className="font-semibold text-sm text-[#292D29]">{pet.nombre}</p>
                          <p className="text-xs text-[#596059]">
                            {pet.especie} · {pet.raza} · {pet.edad}
                          </p>
                          {pet.notas_medicas && <p className="mt-1 text-xs text-[#596059]">{pet.notas_medicas}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeletePet(pet.id)}
                          className="text-[#596059] hover:text-[#B44C43] cursor-pointer"
                          aria-label={`Eliminar ${pet.nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pedidos' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="rounded-xl border border-[#E4DFD4] bg-white p-8 text-center text-sm text-[#596059]">
                    Aún no has realizado pedidos en la tienda.
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-[#E4DFD4] bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E4DFD4]">
                        <div>
                          <span className="font-mono text-sm font-semibold text-[#292D29]">
                            {order.codigo_pedido}
                          </span>
                          <span className="ml-3 text-xs text-[#596059]">{order.creado_en}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="uppercase font-semibold text-[#536B56]">{order.estado}</span>
                          <span className="text-base font-semibold text-[#292D29] tabular-nums">
                            {formatCOP(order.total)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs text-[#596059]">
                        Entrega: {order.ciudad} — {order.direccion_entrega}
                      </p>
                      {order.items && order.items.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-[#292D29]">
                          {order.items.map((it) => (
                            <li key={it.id} className="flex justify-between">
                              <span>
                                {it.cantidad}× {it.nombre_producto}
                              </span>
                              <span className="tabular-nums text-[#596059]">{formatCOP(it.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
