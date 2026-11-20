import { useEffect, useState } from 'react';
import { CheckCircle2, Minus, Plus, Trash2, X } from 'lucide-react';
import type { AuthUser, CartItem } from '../types/domain';
import { apiFetch, formatCOP } from '../utils/format';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  user: AuthUser | null;
  onClose: () => void;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onOrderComplete: () => void;
  onNotify: (msg: string, type?: 'ok' | 'error') => void;
}

export function CartDrawer({
  open,
  items,
  user,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderComplete,
  onNotify,
}: CartDrawerProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [metodoPago, setMetodoPago] = useState('contraentrega_demo');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ codigo_pedido: string; total: number } | null>(null);

  useEffect(() => {
    if (user) {
      setNombre((p) => p || user.nombre);
      setEmail((p) => p || user.email);
      setTelefono((p) => p || user.telefono || '');
      setDireccion((p) => p || user.direccion_entrega || '');
    }
  }, [user]);

  if (!open) return null;

  const subtotal = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const shipping = subtotal === 0 ? 0 : subtotal >= 180000 ? 0 : 12000;
  const total = subtotal + shipping;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const res = await apiFetch<{ codigo_pedido: string; total: number }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          comprador_nombre: nombre,
          comprador_email: email,
          comprador_telefono: telefono,
          ciudad,
          direccion_entrega: direccion,
          metodo_pago: metodoPago,
          items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        }),
      });

      setReceipt({ codigo_pedido: res.codigo_pedido, total: res.total });
      onClearCart();
      setShowCheckout(false);
      onOrderComplete();
      onNotify(`Pedido ${res.codigo_pedido} confirmado.`, 'ok');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al procesar pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#292D29]/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Carrito de compras"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-[#F7F5EF] border-l border-[#E4DFD4]">
        <div className="flex items-center justify-between border-b border-[#E4DFD4] px-6 py-4 bg-white">
          <h2 className="font-display text-lg font-semibold text-[#292D29]">Carrito de compras</h2>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4DFD4] text-[#292D29] hover:bg-[#F7F5EF] cursor-pointer"
            aria-label="Cerrar carrito"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {receipt && (
            <div className="rounded-xl border border-[#A8B99A] bg-white p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#536B56]">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-display text-base font-semibold text-[#292D29]">Pedido registrado</h3>
              </div>
              <p className="text-sm text-[#596059]">
                Código: <strong className="font-mono text-[#292D29]">{receipt.codigo_pedido}</strong>
              </p>
              <p className="text-sm text-[#596059]">
                Total: <strong className="tabular-nums text-[#292D29]">{formatCOP(receipt.total)}</strong>
              </p>
              <p className="text-xs text-[#596059]">
                La orden quedó almacenada con registro de pago preparado para pasarela externa.
              </p>
            </div>
          )}

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8C8B5] bg-white/70 p-8 text-center">
              <p className="text-sm text-[#596059]">Aún no has agregado productos a tu carrito.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.producto_id}
                className="flex items-center gap-3 rounded-xl border border-[#E4DFD4] bg-white p-3.5"
              >
                <img
                  src={item.imagen_url}
                  alt={item.nombre}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-lg object-cover bg-[#EFECE3] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#596059] truncate">{item.marca}</p>
                  <p className="text-sm font-semibold text-[#292D29] truncate">{item.nombre}</p>
                  <p className="text-sm font-medium text-[#536B56] tabular-nums mt-0.5">
                    {formatCOP(item.precio * item.cantidad)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.producto_id)}
                    className="text-[#596059] hover:text-[#B44C43] cursor-pointer"
                    aria-label={`Eliminar ${item.nombre}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-center rounded-lg border border-[#E4DFD4] h-8">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.producto_id, -1)}
                      className="px-2 text-[#292D29] cursor-pointer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold tabular-nums">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.producto_id, 1)}
                      className="px-2 text-[#292D29] cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {showCheckout && items.length > 0 && (
            <form id="checkoutForm" onSubmit={handleCheckout} className="rounded-xl border border-[#E4DFD4] bg-white p-4 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[#292D29]">Datos del comprador y entrega</h3>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo *"
                className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico *"
                className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <input
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Teléfono *"
                className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <input
                required
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ciudad *"
                className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <input
                required
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección de entrega *"
                className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm"
              />
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#E4DFD4] px-3 text-sm bg-white"
              >
                <option value="contraentrega_demo">Pago contraentrega [DEMO]</option>
                <option value="pasarela_integracion_futura">Pasarela online (Integración lista)</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-[#536B56] text-sm font-semibold text-white hover:bg-[#425745] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Confirmando pedido...' : 'Confirmar pedido'}
              </button>
            </form>
          )}
        </div>

        <div className="border-t border-[#E4DFD4] bg-white p-6 space-y-2.5">
          <div className="flex justify-between text-sm text-[#596059]">
            <span>Subtotal</span>
            <span className="font-medium text-[#292D29] tabular-nums">{formatCOP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#596059]">
            <span>Envío (gratis desde $180.000)</span>
            <span className="font-medium text-[#292D29] tabular-nums">
              {subtotal > 0 && shipping === 0 ? 'Gratis' : formatCOP(shipping)}
            </span>
          </div>
          <div className="flex justify-between text-base font-semibold text-[#292D29] pt-2 border-t border-[#E4DFD4]">
            <span>Total</span>
            <span className="text-[#536B56] tabular-nums">{formatCOP(total)}</span>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                setShowCheckout((s) => !s);
              }}
              className="mt-2 w-full h-11 rounded-lg bg-[#536B56] text-sm font-semibold text-white hover:bg-[#425745] transition-colors cursor-pointer"
            >
              {showCheckout ? 'Ocultar formulario de entrega' : 'Finalizar compra'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
