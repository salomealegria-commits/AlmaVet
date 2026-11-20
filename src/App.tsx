import { useCallback, useEffect, useState } from 'react';
import { Calendar, Check, Heart, ShieldCheck, Stethoscope } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ServicesSection } from './components/ServicesSection';
import { BookingSection } from './components/BookingSection';
import { StoreSection } from './components/StoreSection';
import { CartDrawer } from './components/CartDrawer';
import { AccountPortal } from './components/AccountPortal';
import type { AuthUser, CartItem, Pet, Product, VetService, Veterinarian } from './types/domain';
import { apiFetch } from './utils/format';

const HERO_IMG = '/src/assets/images/hero_dog_cat_1795145053287.jpg';
const CLINIC_IMG = '/src/assets/images/clinic_veterinary_care_1795145053916.jpg';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [services, setServices] = useState<VetService[]>([]);
  const [veterinarians, setVeterinarians] = useState<Veterinarian[]>([]);
  const [userPets, setUserPets] = useState<Pet[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('almavet_cart') || '[]') as CartItem[];
    } catch {
      return [];
    }
  });

  const [refreshSignal, setRefreshSignal] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);
  const [clinicImgError, setClinicImgError] = useState(false);

  const notify = useCallback((msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [meta, auth] = await Promise.all([
        apiFetch<{ servicios: VetService[]; veterinarios: Veterinarian[] }>('/api/appointments/meta'),
        apiFetch<{ user: AuthUser | null }>('/api/auth/me'),
      ]);
      setServices(meta.servicios);
      setVeterinarians(meta.veterinarios);
      setUser(auth.user);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error cargando datos iniciales', 'error');
    } finally {
      setLoadingMeta(false);
    }
  }, [notify]);

  const loadPets = useCallback(async () => {
    if (!user) {
      setUserPets([]);
      return;
    }
    try {
      const res = await apiFetch<{ mascotas: Pet[] }>('/api/pets');
      setUserPets(res.mascotas);
    } catch {
      setUserPets([]);
    }
  }, [user]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  // Persistir carrito en localStorage y sincronizar con servidor si hay sesión
  useEffect(() => {
    localStorage.setItem('almavet_cart', JSON.stringify(cart));
    if (user) {
      void apiFetch('/api/cart', {
        method: 'PUT',
        body: JSON.stringify({
          items: cart.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        }),
      }).catch(() => {
        // ignore background sync errors
      });
    }
  }, [cart, user]);

  const handleAddToCart = (product: Product, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.producto_id === product.id
            ? { ...i, cantidad: Math.min(product.stock_actual, i.cantidad + quantity) }
            : i
        );
      }
      return [
        ...prev,
        {
          producto_id: product.id,
          nombre: product.nombre,
          precio: product.precio,
          imagen_url: product.imagen_url,
          stock: product.stock_actual,
          cantidad: Math.min(product.stock_actual, quantity),
          marca: product.marca,
        },
      ];
    });
    notify(`${product.nombre} agregado al carrito.`, 'ok');
  };

  const handleUpdateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto_id !== productId) return item;
          const next = item.cantidad + delta;
          if (next <= 0) return null;
          return { ...item, cantidad: Math.min(item.stock, next) };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const handleRemoveCartItem = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.producto_id !== productId));
  };

  const handleSelectServiceForBooking = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    const el = document.getElementById('agendar');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavigateAccount = () => {
    const el = document.getElementById('mi-cuenta');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const cartCount = cart.reduce((acc, item) => acc + item.cantidad, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EF] text-[#292D29]">
      <Navbar
        user={user}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        onNavigateAccount={handleNavigateAccount}
      />

      <main className="flex-1">
        {/* 1. HERO SECTION */}
        <section id="inicio" className="py-14 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center py-2">
                <p className="text-xs font-semibold tracking-wider text-[#536B56] mb-3">
                  Clínica veterinaria & Tienda de bienestar animal
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-[#292D29] leading-[1.12] text-balance">
                  El bienestar de tu mascota es nuestra prioridad
                </h1>
                <p className="mt-5 text-base sm:text-lg leading-relaxed text-[#596059] max-w-xl">
                  Cuidamos a quienes hacen tu vida más especial, con atención veterinaria profesional y productos
                  seleccionados para su bienestar.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href="#agendar"
                    className="inline-flex h-12 items-center justify-center rounded-lg bg-[#536B56] px-6 text-sm font-semibold text-white hover:bg-[#425745] transition-colors"
                  >
                    Agendar una cita
                  </a>
                  <a
                    href="#tienda"
                    className="inline-flex h-12 items-center justify-center rounded-lg border border-[#536B56] bg-transparent px-6 text-sm font-semibold text-[#536B56] hover:bg-[#536B56]/10 transition-colors"
                  >
                    Explorar productos
                  </a>
                </div>

                <div className="mt-10 pt-6 border-t border-[#E4DFD4] grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-[#292D29]">Agenda en tiempo real</p>
                    <p className="text-[#596059] mt-0.5">Bloqueo automático sin duplicados</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#292D29]">8 áreas médicas</p>
                    <p className="text-[#596059] mt-0.5">Preventiva, dental y cirugía</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#292D29]">9 líneas en tienda</p>
                    <p className="text-[#596059] mt-0.5">Nutrición, descanso y salud</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative h-full min-h-[340px] lg:min-h-[480px] overflow-hidden rounded-2xl border border-[#E4DFD4] bg-[#EFECE3]">
                  {heroImgError ? (
                    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-[#596059]">
                      <Heart className="h-10 w-10 text-[#536B56] mb-3" />
                      <p className="font-medium text-[#292D29]">AlmaVet — Cuidado canino y felino</p>
                    </div>
                  ) : (
                    <img
                      src={HERO_IMG}
                      alt="Perro y gato tranquilos en sala de bienestar veterinario"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. PRESENTACIÓN DE LA VETERINARIA Y BENEFICIOS */}
        <section id="nosotros" className="py-20 border-t border-[#E4DFD4] bg-white/60">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[#E4DFD4] bg-[#EFECE3]">
                  {clinicImgError ? (
                    <div className="flex h-full w-full items-center justify-center text-[#536B56]">
                      <Stethoscope className="h-10 w-10" />
                    </div>
                  ) : (
                    <img
                      src={CLINIC_IMG}
                      alt="Médica veterinaria atendiendo con serenidad a un perro en consulta"
                      referrerPolicy="no-referrer"
                      onError={() => setClinicImgError(true)}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>

              <div className="lg:col-span-7">
                <p className="text-xs font-semibold tracking-wider text-[#536B56] mb-2">
                  Sobre la clínica · Modelo de atención integral
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#292D29] text-balance">
                  Medicina veterinaria sin prisas en un entorno pensado para su calma
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[#596059]">
                  Integramos consulta clínica, laboratorio diagnóstico y curaduría nutricional en una misma plataforma,
                  permitiendo a cada tutor gestionar citas, historial de mascotas y compras con claridad.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-[#E4DFD4]">
                  <div>
                    <Stethoscope className="h-5 w-5 text-[#536B56] mb-2" />
                    <h3 className="font-display text-sm font-semibold text-[#292D29]">Manejo respetuoso</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#596059]">
                      Tiempos de consulta amplios para disminuir el estrés en perros y gatos.
                    </p>
                  </div>
                  <div>
                    <Calendar className="h-5 w-5 text-[#536B56] mb-2" />
                    <h3 className="font-display text-sm font-semibold text-[#292D29]">Trazabilidad clara</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#596059]">
                      Código único por reserva y panel para consultar, reprogramar o cancelar.
                    </p>
                  </div>
                  <div>
                    <ShieldCheck className="h-5 w-5 text-[#536B56] mb-2" />
                    <h3 className="font-display text-sm font-semibold text-[#292D29]">Selección veterinaria</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#596059]">
                      Alimentos, suplementos y accesorios evaluados por criterio clínico.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. MÓDULO DE SERVICIOS VETERINARIOS */}
        <ServicesSection
          services={services}
          loading={loadingMeta}
          onSelectService={handleSelectServiceForBooking}
        />

        {/* 4. MÓDULO DE AGENDAMIENTO DE CITAS */}
        <BookingSection
          services={services}
          veterinarians={veterinarians}
          selectedServiceId={selectedServiceId}
          user={user}
          userPets={userPets}
          onNotify={notify}
          onBookingSuccess={() => setRefreshSignal((n) => n + 1)}
        />

        {/* 5. TIENDA VIRTUAL PARA MASCOTAS */}
        <StoreSection onAddToCart={handleAddToCart} refreshSignal={refreshSignal} />

        {/* 6. TESTIMONIOS [DEMO] Y LLAMADO A LA ACCIÓN */}
        <section className="py-20 border-t border-[#E4DFD4] bg-white/60">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-semibold tracking-wider text-[#536B56] mb-2">
                Experiencias · Contenido de demostración [DEMO]
              </p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[#292D29]">
                Cómo luce la experiencia para las familias
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote:
                    'La reserva en línea nos permitió elegir el horario exacto con la doctora y evitar esperas innecesarias para nuestra gata.',
                  author: 'Tutora de Nala · Ejemplo [DEMO]',
                },
                {
                  quote:
                    'Poder comprar el alimento digestivo y los premios liofilizados en el mismo sitio facilita mantener su rutina al día.',
                  author: 'Familia de Milo · Ejemplo [DEMO]',
                },
                {
                  quote:
                    'El historial de citas y pedidos dentro de Mi cuenta hace muy sencillo revisar próximas vacunas y entregas.',
                  author: 'Cliente registrado · Ejemplo [DEMO]',
                },
              ].map((item, idx) => (
                <blockquote key={idx} className="rounded-xl border border-[#E4DFD4] bg-white p-6 flex flex-col">
                  <p className="text-sm leading-relaxed text-[#292D29] flex-1">"{item.quote}"</p>
                  <footer className="mt-4 pt-3 border-t border-[#E4DFD4] text-xs font-medium text-[#596059]">
                    {item.author}
                  </footer>
                </blockquote>
              ))}
            </div>

            <div className="mt-12 rounded-2xl bg-[#536B56] px-6 py-8 sm:px-10 sm:py-10 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <h3 className="font-display text-2xl font-semibold">
                  ¿Listo para programar la próxima visita de tu mascota?
                </h3>
                <p className="mt-2 text-sm text-white/85">
                  Elige el servicio, el veterinario de tu preferencia y confirma tu espacio disponible al instante.
                </p>
              </div>
              <a
                href="#agendar"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-[#F7F5EF] px-6 text-sm font-semibold text-[#292D29] hover:bg-white transition-colors whitespace-nowrap shrink-0"
              >
                Agendar una cita ahora
              </a>
            </div>
          </div>
        </section>

        {/* 7. MI CUENTA, PORTAL DE VETERINARIOS Y PANEL ADMINISTRATIVO */}
        <AccountPortal
          user={user}
          pets={userPets}
          refreshSignal={refreshSignal}
          onUserChange={(nextUser) => {
            setUser(nextUser);
            setRefreshSignal((n) => n + 1);
          }}
          onPetsChange={() => {
            void loadPets();
            setRefreshSignal((n) => n + 1);
          }}
          onDataMutated={() => setRefreshSignal((n) => n + 1)}
          onNotify={notify}
        />
      </main>

      {/* 8. FOOTER / CONTACTO */}
      <footer id="contacto" className="border-t border-[#E4DFD4] bg-[#F7F5EF] py-14">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="font-display text-lg font-bold text-[#536B56]">AlmaVet</p>
            <p className="mt-2 text-sm text-[#596059] max-w-xs">
              Plataforma veterinaria integral de demostración: medicina preventiva, agendamiento y tienda especializada.
            </p>
          </div>

          <div className="text-sm text-[#596059] space-y-1.5">
            <p className="font-semibold text-[#292D29]">Contacto comercial [DEMO]</p>
            <p>Sede ejemplo · Calle 85 # 14-22</p>
            <p>contacto@almavet.demo · +57 300 000 0000</p>
            <p>Lunes a Viernes 09:00–17:00 · Sábados 09:00–13:00</p>
          </div>

          <div className="text-sm space-y-1.5">
            <p className="font-semibold text-[#292D29]">Navegación</p>
            <div className="flex flex-col gap-1 text-[#596059]">
              <a href="#servicios" className="hover:text-[#292D29]">
                Servicios veterinarios
              </a>
              <a href="#agendar" className="hover:text-[#292D29]">
                Agendar cita
              </a>
              <a href="#tienda" className="hover:text-[#292D29]">
                Tienda virtual
              </a>
              <a href="#mi-cuenta" className="hover:text-[#292D29]">
                Mi cuenta
              </a>
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        items={cart}
        user={user}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        onOrderComplete={() => setRefreshSignal((n) => n + 1)}
        onNotify={notify}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-[#B44C43]' : 'bg-[#292D29]'
          }`}
        >
          {toast.type === 'ok' && <Check className="h-4 w-4 text-[#A8B99A]" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
