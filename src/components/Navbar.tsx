import { useState } from 'react';
import { Menu, ShoppingBag, User, X } from 'lucide-react';
import type { AuthUser } from '../types/domain';

interface NavbarProps {
  user: AuthUser | null;
  cartCount: number;
  onOpenCart: () => void;
  onNavigateAccount: () => void;
}

const NAV_LINKS = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#servicios', label: 'Servicios veterinarios' },
  { href: '#agendar', label: 'Agendar cita' },
  { href: '#tienda', label: 'Tienda' },
  { href: '#productos', label: 'Productos' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#contacto', label: 'Contacto' },
];

export function Navbar({ user, cartCount, onOpenCart, onNavigateAccount }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4DFD4] bg-[#F7F5EF]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#inicio"
          className="font-display text-xl font-bold tracking-tight text-[#536B56] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#536B56]"
        >
          AlmaVet
        </a>

        <nav className="hidden xl:flex items-center gap-5" aria-label="Navegación principal">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-[#596059] hover:text-[#292D29] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#mi-cuenta"
            onClick={(e) => {
              e.preventDefault();
              onNavigateAccount();
            }}
            className="text-[13px] font-medium text-[#596059] hover:text-[#292D29] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? `Mi cuenta (${user.nombre.split(' ')[0]})` : 'Mi cuenta'}
          </a>
          <button
            type="button"
            onClick={onOpenCart}
            className="text-[13px] font-medium text-[#596059] hover:text-[#292D29] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Carrito de compras
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateAccount}
            className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4DFD4] bg-white text-[#292D29] hover:border-[#536B56] transition-colors cursor-pointer"
            aria-label="Mi cuenta"
          >
            <User className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E4DFD4] bg-white px-3 text-sm font-medium text-[#292D29] hover:border-[#536B56] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={`Abrir carrito de compras (${cartCount} productos)`}
          >
            <ShoppingBag className="h-4 w-4 text-[#536B56]" />
            <span className="tabular-nums text-xs font-semibold">{cartCount}</span>
          </button>

          <a
            href="#agendar"
            className="hidden sm:inline-flex h-10 items-center justify-center rounded-lg bg-[#536B56] px-4 text-sm font-semibold text-white hover:bg-[#425745] transition-colors whitespace-nowrap shrink-0"
          >
            Agendar cita
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4DFD4] bg-white text-[#292D29] cursor-pointer"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-[#E4DFD4] bg-[#F7F5EF] px-4 py-4">
          <nav className="flex flex-col gap-2" aria-label="Menú móvil">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#292D29] hover:bg-[#E4DFD4]/40 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#mi-cuenta"
              onClick={(e) => {
                e.preventDefault();
                setMobileOpen(false);
                onNavigateAccount();
              }}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#292D29] hover:bg-[#E4DFD4]/40 transition-colors"
            >
              {user ? `Mi cuenta (${user.nombre})` : 'Mi cuenta'}
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenCart();
              }}
              className="text-left rounded-lg px-3 py-2.5 text-sm font-medium text-[#292D29] hover:bg-[#E4DFD4]/40 transition-colors cursor-pointer"
            >
              Carrito de compras ({cartCount})
            </button>
            <a
              href="#agendar"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-[#536B56] px-4 text-sm font-semibold text-white"
            >
              Agendar cita
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
