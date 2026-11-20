import { useEffect, useState } from 'react';
import { Eye, Minus, Package, Plus, Search, ShoppingBag, X } from 'lucide-react';
import type { Category, Product } from '../types/domain';
import { apiFetch, formatCOP } from '../utils/format';

interface StoreSectionProps {
  onAddToCart: (product: Product, quantity: number) => void;
  refreshSignal: number;
}

function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#EFECE3] p-4 text-center text-[#596059]">
        <Package className="h-8 w-8 text-[#536B56]" />
        <span className="text-xs font-medium">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      loading="lazy"
    />
  );
}

export function StoreSection({ onAddToCart, refreshSignal }: StoreSectionProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [species, setSpecies] = useState('');
  const [brand, setBrand] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);

  useEffect(() => {
    void apiFetch<{ categorias: Category[]; marcas: string[] }>('/api/products/meta')
      .then((res) => {
        setCategories(res.categorias);
        setBrands(res.marcas);
      })
      .catch(() => {
        // silent fallback
      });
  }, [refreshSignal]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('q', search.trim());
        if (categorySlug) params.set('categoria', categorySlug);
        if (species) params.set('especie', species);
        if (brand) params.set('marca', brand);
        if (maxPrice) params.set('max_precio', maxPrice);

        const res = await apiFetch<{ productos: Product[] }>(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        });
        setProducts(res.productos);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setProducts([]);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [search, categorySlug, species, brand, maxPrice, refreshSignal]);

  const getQty = (id: number) => quantities[id] || 1;
  const setQty = (id: number, next: number, maxStock: number) => {
    const clamped = Math.max(1, Math.min(Math.max(1, maxStock), next));
    setQuantities((prev) => ({ ...prev, [id]: clamped }));
  };

  return (
    <section id="tienda" className="py-20 border-t border-[#E4DFD4]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold tracking-wider text-[#536B56] mb-2">
            Tienda virtual · Catálogo e inventario de demostración
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#292D29] text-balance">
            Productos seleccionados para su nutrición, descanso e higiene
          </h2>
          <p className="mt-3 text-base text-[#596059]">
            Envío sin costo en pedidos desde $180.000 COP. Filtra por categoría, especie, marca o presupuesto.
          </p>
        </div>

        {/* Categorías interactivas */}
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Categorías de productos">
          <button
            type="button"
            onClick={() => setCategorySlug('')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categorySlug === ''
                ? 'bg-[#536B56] text-white'
                : 'border border-[#E4DFD4] bg-white text-[#596059] hover:text-[#292D29]'
            }`}
          >
            Todas las categorías
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategorySlug(cat.slug)}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categorySlug === cat.slug
                  ? 'bg-[#536B56] text-white'
                  : 'border border-[#E4DFD4] bg-white text-[#596059] hover:text-[#292D29]'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Buscador y filtros */}
        <div
          id="productos"
          className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-xl border border-[#E4DFD4] bg-white p-4"
        >
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#596059]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar alimento, marca o accesorio..."
              className="w-full h-10 rounded-lg border border-[#E4DFD4] bg-[#F7F5EF]/50 pl-10 pr-3 text-sm text-[#292D29] focus:border-[#536B56] focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por especie"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className="h-10 rounded-lg border border-[#E4DFD4] bg-white px-3 text-sm text-[#292D29] focus:border-[#536B56] focus:outline-none"
          >
            <option value="">Todas las especies</option>
            <option value="Perro">Perros</option>
            <option value="Gato">Gatos</option>
          </select>

          <select
            aria-label="Filtrar por marca"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="h-10 rounded-lg border border-[#E4DFD4] bg-white px-3 text-sm text-[#292D29] focus:border-[#536B56] focus:outline-none"
          >
            <option value="">Todas las marcas</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por precio"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-10 rounded-lg border border-[#E4DFD4] bg-white px-3 text-sm text-[#292D29] focus:border-[#536B56] focus:outline-none"
          >
            <option value="">Cualquier precio</option>
            <option value="60000">Hasta $60.000</option>
            <option value="120000">Hasta $120.000</option>
            <option value="250000">Hasta $250.000</option>
          </select>
        </div>

        {/* Catálogo */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-96 rounded-xl border border-[#E4DFD4] bg-white/70 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D8C8B5] bg-white/70 p-12 text-center">
            <p className="text-base font-medium text-[#292D29]">No hay productos que coincidan con tu búsqueda.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategorySlug('');
                setSpecies('');
                setBrand('');
                setMaxPrice('');
              }}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[#536B56] px-4 text-sm font-semibold text-[#536B56] hover:bg-[#536B56]/10 cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const outOfStock = product.stock_actual <= 0;
              const qty = getQty(product.id);
              return (
                <article
                  key={product.id}
                  className="group flex flex-col rounded-xl border border-[#E4DFD4] bg-white overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#A8B99A]"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFECE3]">
                    <ProductImage src={product.imagen_url} alt={product.nombre} />
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-1.5 text-xs text-[#596059]">
                      <span>{product.categoria_nombre}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.marca}</span>
                    </div>

                    <h3 className="mt-1.5 font-display text-base font-semibold text-[#292D29] leading-snug">
                      {product.nombre}
                    </h3>

                    <p className="mt-2 text-sm text-[#596059] line-clamp-2 flex-1">{product.descripcion}</p>

                    <div className="mt-4 flex items-baseline justify-between">
                      <span className="text-lg font-semibold text-[#536B56] tabular-nums">
                        {formatCOP(product.precio)}
                      </span>
                      <span className="text-xs text-[#596059] tabular-nums">
                        {outOfStock ? 'Agotado' : `${product.stock_actual} disponibles`}
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#E4DFD4] flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-[#E4DFD4] bg-[#F7F5EF]/50 h-10">
                        <button
                          type="button"
                          disabled={outOfStock || qty <= 1}
                          onClick={() => setQty(product.id, qty - 1, product.stock_actual)}
                          className="h-full px-2.5 text-[#292D29] disabled:opacity-40 cursor-pointer"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums">{qty}</span>
                        <button
                          type="button"
                          disabled={outOfStock || qty >= product.stock_actual}
                          onClick={() => setQty(product.id, qty + 1, product.stock_actual)}
                          className="h-full px-2.5 text-[#292D29] disabled:opacity-40 cursor-pointer"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onAddToCart(product, qty)}
                        className="flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#536B56] px-3 text-xs font-semibold text-white hover:bg-[#425745] disabled:opacity-45 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>{outOfStock ? 'Agotado' : 'Agregar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProduct(product);
                          setModalQty(1);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4DFD4] text-[#292D29] hover:border-[#536B56] transition-colors cursor-pointer"
                        aria-label={`Ver detalle de ${product.nombre}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalle del Producto */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#292D29]/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProduct.nombre}
        >
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E4DFD4] bg-white p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4DFD4] text-[#292D29] hover:bg-[#F7F5EF] cursor-pointer"
              aria-label="Cerrar detalle"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#EFECE3]">
                <ProductImage src={selectedProduct.imagen_url} alt={selectedProduct.nombre} />
              </div>

              <div>
                <p className="text-xs font-medium text-[#596059]">
                  {selectedProduct.categoria_nombre} · {selectedProduct.marca} · {selectedProduct.especie_objetivo}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[#292D29]">
                  {selectedProduct.nombre}
                </h3>
                <p className="mt-3 text-2xl font-semibold text-[#536B56] tabular-nums">
                  {formatCOP(selectedProduct.precio)}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[#596059]">{selectedProduct.descripcion}</p>

                {selectedProduct.detalle_tecnico && (
                  <div className="mt-4 pt-4 border-t border-[#E4DFD4]">
                    <p className="text-xs font-semibold text-[#292D29] mb-1">Información técnica</p>
                    <p className="text-xs leading-relaxed text-[#596059]">{selectedProduct.detalle_tecnico}</p>
                  </div>
                )}

                <div className="mt-4 text-xs text-[#596059] tabular-nums">
                  SKU: {selectedProduct.sku} · Stock actual: {selectedProduct.stock_actual} unidades
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-[#E4DFD4] h-11">
                    <button
                      type="button"
                      onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                      className="h-full px-3 text-[#292D29] cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">{modalQty}</span>
                    <button
                      type="button"
                      onClick={() => setModalQty((q) => Math.min(Math.max(1, selectedProduct.stock_actual), q + 1))}
                      className="h-full px-3 text-[#292D29] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={selectedProduct.stock_actual <= 0}
                    onClick={() => {
                      onAddToCart(selectedProduct, modalQty);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#536B56] px-5 text-sm font-semibold text-white hover:bg-[#425745] disabled:opacity-45 cursor-pointer"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Agregar al carrito</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
