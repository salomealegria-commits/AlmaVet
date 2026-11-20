export type UserRole = 'cliente' | 'veterinario' | 'administrador';

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion_entrega: string | null;
  rol: UserRole;
  veterinario_id: number | null;
}

export interface VetService {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  beneficios: string[];
  duracion_minutos: number;
  precio: number;
  icono: string;
  activo: number;
}

export interface Veterinarian {
  id: number;
  usuario_id: number;
  nombre: string;
  email: string;
  especialidad: string;
  registro_profesional: string;
  biografia: string;
  activo: number;
}

export interface TimeSlot {
  hora: string;
  disponible: boolean;
}

export interface Appointment {
  id: number;
  codigo_reserva: string;
  cliente_id: number | null;
  propietario_nombre: string;
  propietario_email: string;
  propietario_telefono: string;
  mascota_id: number | null;
  mascota_nombre: string;
  mascota_especie: 'Perro' | 'Gato' | 'Otro';
  mascota_raza: string | null;
  mascota_edad: string | null;
  servicio_id: number;
  servicio_nombre?: string;
  veterinario_id: number;
  veterinario_nombre?: string;
  fecha: string;
  hora: string;
  motivo: string;
  observaciones: string | null;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  creado_en: string;
}

export interface Pet {
  id: number;
  propietario_id: number;
  nombre: string;
  especie: 'Perro' | 'Gato' | 'Otro';
  raza: string;
  edad: string;
  notas_medicas: string | null;
  creado_en: string;
}

export interface Category {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
}

export interface Product {
  id: number;
  categoria_id: number;
  categoria_nombre: string;
  categoria_slug: string;
  sku: string;
  nombre: string;
  marca: string;
  especie_objetivo: 'Perro' | 'Gato' | 'Ambos' | 'Otro';
  descripcion: string;
  detalle_tecnico: string | null;
  precio: number;
  imagen_url: string;
  destacado: number;
  activo: number;
  stock_actual: number;
  stock_minimo: number;
}

export interface CartItem {
  producto_id: number;
  nombre: string;
  precio: number;
  imagen_url: string;
  stock: number;
  cantidad: number;
  marca: string;
}

export interface OrderItem {
  id: number;
  pedido_id: number;
  producto_id: number;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Order {
  id: number;
  codigo_pedido: string;
  usuario_id: number | null;
  comprador_nombre: string;
  comprador_email: string;
  comprador_telefono: string;
  direccion_entrega: string;
  ciudad: string;
  subtotal: number;
  costo_envio: number;
  total: number;
  estado: 'pendiente_pago' | 'pagado' | 'en_preparacion' | 'enviado' | 'entregado' | 'cancelado';
  creado_en: string;
  items?: OrderItem[];
}

export interface AdminSchedule {
  id: number;
  veterinario_id: number;
  veterinario_nombre: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  intervalo_minutos: number;
  activo: number;
}

export interface AdminDashboardData {
  kpis: {
    citas: {
      total: number;
      pendientes: number;
      confirmadas: number;
      completadas: number;
      canceladas: number;
    };
    ventas: {
      total_ventas: number;
      total_pedidos: number;
    };
    productos_disponibles: number;
    stock_bajo_count: number;
    total_clientes: number;
    total_mascotas: number;
  };
  bajo_stock: Array<{
    id: number;
    sku: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
  }>;
  ventas_por_categoria: Array<{
    categoria: string;
    total: number;
  }>;
  usuarios: Array<{
    id: number;
    nombre: string;
    email: string;
    telefono: string | null;
    rol: UserRole;
    activo: number;
    creado_en: string;
  }>;
  mascotas: Array<Pet & { propietario: string }>;
  veterinarios: Veterinarian[];
  horarios: AdminSchedule[];
  servicios: VetService[];
  inventario: Product[];
  citas: Appointment[];
  pedidos: Order[];
}
