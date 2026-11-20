import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'almavet.db');
export const db = new DatabaseSync(dbPath);

export function initDatabase(): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    -- 1. Roles
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );

    -- 2. Usuarios
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rol_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefono TEXT,
      password_hash TEXT NOT NULL,
      direccion_entrega TEXT,
      activo INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (rol_id) REFERENCES roles(id)
    );

    -- 3. Veterinarios
    CREATE TABLE IF NOT EXISTS veterinarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      especialidad TEXT NOT NULL,
      registro_profesional TEXT NOT NULL,
      biografia TEXT,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- 4. Mascotas
    CREATE TABLE IF NOT EXISTS mascotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      propietario_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      especie TEXT NOT NULL CHECK (especie IN ('Perro', 'Gato', 'Otro')),
      raza TEXT DEFAULT 'Mestizo',
      edad TEXT NOT NULL,
      notas_medicas TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (propietario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- 5. Servicios
    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      beneficios TEXT NOT NULL,
      duracion_minutos INTEGER NOT NULL DEFAULT 30,
      precio REAL NOT NULL,
      icono TEXT NOT NULL,
      activo INTEGER DEFAULT 1
    );

    -- 6. Horarios (dia_semana: 1=Lunes ... 7=Domingo)
    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      veterinario_id INTEGER NOT NULL,
      dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      intervalo_minutos INTEGER NOT NULL DEFAULT 30,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id) ON DELETE CASCADE
    );

    -- 7. Citas
    CREATE TABLE IF NOT EXISTS citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_reserva TEXT NOT NULL UNIQUE,
      cliente_id INTEGER,
      propietario_nombre TEXT NOT NULL,
      propietario_email TEXT NOT NULL,
      propietario_telefono TEXT NOT NULL,
      mascota_id INTEGER,
      mascota_nombre TEXT NOT NULL,
      mascota_especie TEXT NOT NULL CHECK (mascota_especie IN ('Perro', 'Gato', 'Otro')),
      mascota_raza TEXT,
      mascota_edad TEXT,
      servicio_id INTEGER NOT NULL,
      veterinario_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      motivo TEXT NOT NULL,
      observaciones TEXT,
      estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (mascota_id) REFERENCES mascotas(id) ON DELETE SET NULL,
      FOREIGN KEY (servicio_id) REFERENCES servicios(id),
      FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id)
    );

    -- Bloqueo absoluto de citas duplicadas activas (mismo veterinario, fecha y hora)
    CREATE UNIQUE INDEX IF NOT EXISTS uk_vet_fecha_hora
      ON citas(veterinario_id, fecha, hora)
      WHERE estado <> 'cancelada';

    -- 8. Categorías
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      descripcion TEXT
    );

    -- 9. Productos
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      marca TEXT NOT NULL,
      especie_objetivo TEXT NOT NULL DEFAULT 'Ambos' CHECK (especie_objetivo IN ('Perro', 'Gato', 'Ambos', 'Otro')),
      descripcion TEXT NOT NULL,
      detalle_tecnico TEXT,
      precio REAL NOT NULL,
      imagen_url TEXT NOT NULL,
      destacado INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );

    -- 10. Inventario
    CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL UNIQUE,
      stock_actual INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 5,
      actualizado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
    );

    -- 11. Carrito persistente
    CREATE TABLE IF NOT EXISTS carrito (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      agregado_en TEXT DEFAULT (datetime('now')),
      UNIQUE (usuario_id, producto_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
    );

    -- 12. Pedidos
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_pedido TEXT NOT NULL UNIQUE,
      usuario_id INTEGER,
      comprador_nombre TEXT NOT NULL,
      comprador_email TEXT NOT NULL,
      comprador_telefono TEXT NOT NULL,
      direccion_entrega TEXT NOT NULL,
      ciudad TEXT NOT NULL,
      subtotal REAL NOT NULL,
      costo_envio REAL NOT NULL,
      total REAL NOT NULL,
      estado TEXT DEFAULT 'pendiente_pago' CHECK (estado IN ('pendiente_pago', 'pagado', 'en_preparacion', 'enviado', 'entregado', 'cancelado')),
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    -- 13. Detalle de pedidos
    CREATE TABLE IF NOT EXISTS detalle_pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      nombre_producto TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );

    -- 14. Pagos (arquitectura preparada para pasarela externa)
    CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      pasarela TEXT NOT NULL DEFAULT 'pendiente_integracion',
      referencia_externa TEXT,
      metodo TEXT NOT NULL DEFAULT 'contraentrega_demo',
      monto REAL NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'COP',
      estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')),
      payload_respuesta TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
    );
  `);

  const roleCount = db.prepare('SELECT COUNT(*) AS cnt FROM roles').get() as { cnt: number };
  if (roleCount.cnt === 0) {
    seedInitialDemoData();
  }
}

function seedInitialDemoData(): void {
  const demoPassHash = hashPassword('DemoVet2026!');

  // Roles
  const insRole = db.prepare('INSERT INTO roles (nombre) VALUES (?)');
  insRole.run('cliente'); // 1
  insRole.run('veterinario'); // 2
  insRole.run('administrador'); // 3

  // Usuarios [DEMO]
  const insUser = db.prepare(
    'INSERT INTO usuarios (rol_id, nombre, email, telefono, password_hash, direccion_entrega) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insUser.run(3, 'Administrador [DEMO]', 'admin@almavet.demo', '3000000001', demoPassHash, 'Sede Principal [DEMO]');
  insUser.run(2, 'Dra. Camila Ríos [DEMO]', 'camila.rios@almavet.demo', '3000000002', demoPassHash, null);
  insUser.run(2, 'Dr. Mateo Vargas [DEMO]', 'mateo.vargas@almavet.demo', '3000000003', demoPassHash, null);
  insUser.run(1, 'Laura Méndez [DEMO]', 'cliente@almavet.demo', '3000000004', demoPassHash, 'Calle 85 # 14-22, Bogotá [DEMO]');

  // Veterinarios [DEMO]
  const insVet = db.prepare(
    'INSERT INTO veterinarios (usuario_id, especialidad, registro_profesional, biografia) VALUES (?, ?, ?, ?)'
  );
  insVet.run(
    2,
    'Medicina Interna y Preventiva',
    'TP-DEMO-1042',
    'Perfil profesional de demostración enfocado en medicina felina, canina y protocolos preventivos.'
  );
  insVet.run(
    3,
    'Cirugía y Odontología Veterinaria',
    'TP-DEMO-2089',
    'Perfil profesional de demostración especializado en odontología ultrasónica y cirugía de tejidos blandos.'
  );

  // Horarios Lunes a Sábado (1..6)
  const insHor = db.prepare(
    'INSERT INTO horarios (veterinario_id, dia_semana, hora_inicio, hora_fin, intervalo_minutos) VALUES (?, ?, ?, ?, ?)'
  );
  for (let d = 1; d <= 5; d++) {
    insHor.run(1, d, '09:00', '17:00', 30);
    insHor.run(2, d, '09:00', '17:00', 30);
  }
  insHor.run(1, 6, '09:00', '13:00', 30);
  insHor.run(2, 6, '09:00', '13:00', 30);

  // Mascotas de ejemplo [DEMO]
  const insPet = db.prepare(
    'INSERT INTO mascotas (propietario_id, nombre, especie, raza, edad, notas_medicas) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insPet.run(4, 'Milo [DEMO]', 'Perro', 'Golden Retriever', '3 años', 'Control anual al día. Sensibilidad leve al pollo.');
  insPet.run(4, 'Nala [DEMO]', 'Gato', 'British Shorthair', '2 años', 'Esquema de vacunación completo.');

  // Servicios (8 módulos solicitados)
  const insSvc = db.prepare(
    'INSERT INTO servicios (slug, nombre, descripcion, beneficios, duracion_minutos, precio, icono) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const services = [
    [
      'consulta-general',
      'Consulta veterinaria general',
      'Evaluación clínica integral del estado físico, nutricional y comportamental de tu mascota en ambiente tranquilo.',
      JSON.stringify(['Revisión completa de signos vitales', 'Plan de cuidado personalizado', 'Orientación nutricional [DEMO]']),
      30,
      65000,
      'stethoscope',
    ],
    [
      'vacunacion',
      'Vacunación',
      'Esquemas de inmunización adaptados a la edad, especie, entorno y estilo de vida de perros y gatos.',
      JSON.stringify(['Biológicos certificados de cadena fría', 'Registro digital de refuerzos', 'Evaluación previa a la aplicación [DEMO]']),
      20,
      55000,
      'syringe',
    ],
    [
      'desparasitacion',
      'Desparasitación',
      'Control interno y externo seguro frente a parásitos gastrointestinales, pulgas y garrapatas.',
      JSON.stringify(['Dosificación exacta según peso', 'Protección prolongada y segura', 'Prevención familiar y zoonótica [DEMO]']),
      20,
      38000,
      'shield',
    ],
    [
      'peluqueria-estetica',
      'Peluquería y estética',
      'Baño dermatológico botánico, corte higiénico y cuidado de pelaje con manejo respetuoso libre de estrés.',
      JSON.stringify(['Shampoos hipoalergénicos pH neutro', 'Limpieza suave de oídos y uñas', 'Sesiones sin jaulas prolongadas [DEMO]']),
      60,
      75000,
      'sparkles',
    ],
    [
      'odontologia',
      'Odontología veterinaria',
      'Profilaxis ultrasónica, evaluación periodontal y prevención de enfermedades orales y sistémicas.',
      JSON.stringify(['Eliminación segura de sarro dental', 'Evaluación pieza por pieza', 'Protocolo de higiene en casa [DEMO]']),
      60,
      180000,
      'smile',
    ],
    [
      'cirugias',
      'Cirugías',
      'Quirófano equipado con monitoreo multiparámetro continuo y protocolos analgésicos modernos.',
      JSON.stringify(['Valoración prequirúrgica rigurosa', 'Monitoreo anestésico continuo', 'Seguimiento postoperatorio cercano [DEMO]']),
      90,
      290000,
      'heart-pulse',
    ],
    [
      'laboratorio-clinico',
      'Laboratorio clínico',
      'Análisis hematológicos, perfiles bioquímicos y estudios diagnósticos para decisiones médicas oportunas.',
      JSON.stringify(['Toma de muestra delicada', 'Resultados oportunos y claros', 'Interpretación clínica especializada [DEMO]']),
      30,
      85000,
      'flask',
    ],
    [
      'atencion-preventiva',
      'Atención preventiva',
      'Programas de chequeo periódico para cachorros, adultos y mascotas senior enfocados en longevidad.',
      JSON.stringify(['Detección temprana de patologías', 'Control articular y metabólico', 'Plan anual de bienestar [DEMO]']),
      40,
      90000,
      'calendar-heart',
    ],
  ];
  for (const s of services) insSvc.run(...s);

  // Categorías (9 categorías solicitadas)
  const insCat = db.prepare('INSERT INTO categorias (slug, nombre, descripcion) VALUES (?, ?, ?)');
  const categories = [
    ['alimentos-perros', 'Alimentos para perros', 'Nutrición balanceada por etapa y sensibilidad digestiva [DEMO]'],
    ['alimentos-gatos', 'Alimentos para gatos', 'Fórmulas ricas en proteína y soporte urinario [DEMO]'],
    ['snacks-premios', 'Snacks y premios', 'Recompensas naturales liofilizadas para entrenamiento [DEMO]'],
    ['juguetes', 'Juguetes', 'Estimulación olfativa, cognitiva y juego seguro [DEMO]'],
    ['accesorios', 'Accesorios', 'Pecheras ergonómicas, correas y comederos duraderos [DEMO]'],
    ['camas-descanso', 'Camas y descanso', 'Superficies ortopédicas desenfundables y lavables [DEMO]'],
    ['higiene-cuidado', 'Higiene y cuidado', 'Shampoos botánicos, cepillos y cuidado de piel [DEMO]'],
    ['productos-salud', 'Productos de salud', 'Suplementos articulares, omega 3 y probióticos [DEMO]'],
    ['transportadores', 'Transportadores', 'Bolsos y guacales ventilados para traslados tranquilos [DEMO]'],
  ];
  for (const c of categories) insCat.run(...c);

  // Productos [DEMO] usando únicamente las imágenes locales generadas
  const insProd = db.prepare(
    'INSERT INTO productos (categoria_id, sku, nombre, marca, especie_objetivo, descripcion, detalle_tecnico, precio, imagen_url, destacado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const products = [
    [
      1,
      'ALM-PER-001',
      'Alimento Holístico Salmón y Avena 4kg [DEMO]',
      'NaturaPet Demo',
      'Perro',
      'Nutrición completa libre de colorantes y subproductos artificiales, formulada para digestión sensible y pelaje saludable.',
      'Proteína 26% · Grasa 14% · Omega 3 y prebióticos naturales · Bolsa resellable de 4 kg.',
      135000,
      '/src/assets/images/product_dog_nutrition_1795145052484.jpg',
      1,
    ],
    [
      2,
      'ALM-GAT-002',
      'Fórmula Renal & Urinaria Gatos 2kg [DEMO]',
      'FelinaCare Demo',
      'Gato',
      'Balance mineral controlado con magnesio reducido para proteger el tracto urinario y favorecer la hidratación diaria.',
      'Proteína 32% · Taurina adicionada · pH urinario balanceado · Presentación de 2 kg.',
      98000,
      '/src/assets/images/product_cat_nutrition_1795145053685.jpg',
      1,
    ],
    [
      3,
      'SNK-003',
      'Premios Liofilizados de Hígado 120g [DEMO]',
      'PureBite Demo',
      'Ambos',
      'Snack de un solo ingrediente 100% proteína natural sin conservantes, ideal para refuerzo positivo y entrenamiento.',
      'Ingrediente único liofilizado en frío · Sin granos ni sal añadida · Frasco reutilizable 120 g.',
      34000,
      '/src/assets/images/product_snacks_toys_1795145052299.jpg',
      0,
    ],
    [
      4,
      'JUG-004',
      'Esfera Interactiva Caucho Botánico [DEMO]',
      'PlayCalm Demo',
      'Perro',
      'Juguete dispensador de caucho natural resistente que reduce el aburrimiento y estimula el olfato de forma tranquila.',
      'Caucho natural grado alimenticio libre de BPA · Apto para lavado superior · Talla M.',
      54000,
      '/src/assets/images/product_snacks_toys_1795145052299.jpg',
      1,
    ],
    [
      5,
      'ACC-005',
      'Pechera Ergonómica Algodón Orgánico [DEMO]',
      'TerraWalk Demo',
      'Perro',
      'Diseño en Y que respeta el movimiento de los hombros y distribuye la presión de manera uniforme con herrajes en latón.',
      'Algodón orgánico tejido de alta resistencia · Ajustable 45–65 cm · Incluye correa a juego.',
      89000,
      '/src/assets/images/product_bed_accessories_1795145052911.jpg',
      0,
    ],
    [
      6,
      'CAM-006',
      'Cama Ortopédica Lino & Espuma Memoria [DEMO]',
      'AlmaRest Demo',
      'Ambos',
      'Superficie ergonómica con espuma viscoelástica de soporte articular y funda en lino natural totalmente desenfundable.',
      'Medidas: 80 × 60 × 15 cm · Base antideslizante · Lavable en máquina ciclo suave.',
      215000,
      '/src/assets/images/product_bed_accessories_1795145052911.jpg',
      1,
    ],
    [
      7,
      'HIG-007',
      'Shampoo Botánico Avena & Caléndula [DEMO]',
      'BotaniVet Demo',
      'Ambos',
      'Fórmula suave pH neutro para mascotas que calma pieles reactivas y mantiene la barrera lipídica natural.',
      'Envase ámbar 350 ml · Libre de sulfatos y parabenos · Aroma suave de manzanilla.',
      46000,
      '/src/assets/images/product_grooming_health_1795145053144.jpg',
      0,
    ],
    [
      8,
      'SAL-008',
      'Suplemento Condroprotector Omega 3 [DEMO]',
      'VetBalance Demo',
      'Ambos',
      'Apoyo articular, dermatológico y cardiovascular con glucosamina, condroitina y ácidos grasos esenciales.',
      'Frasco x 60 unidades · Apto para perros y gatos adultos o senior · Uso veterinario.',
      112000,
      '/src/assets/images/product_grooming_health_1795145053144.jpg',
      0,
    ],
    [
      9,
      'TRA-009',
      'Transportador Minimalista Ventilación 360° [DEMO]',
      'AlmaMove Demo',
      'Gato',
      'Bolso de viaje estructurado en lona salvia transpirable con malla reforzada y cojín interno lavable.',
      'Soporta hasta 8 kg · Apertura superior y lateral · Apto para visitas clínicas tranquilas.',
      195000,
      '/src/assets/images/product_pet_carrier_1795145053388.jpg',
      0,
    ],
  ];
  for (const p of products) insProd.run(...p);

  // Inventario inicial (incluyendo 2 productos con stock bajo para alertas del dashboard)
  const insInv = db.prepare('INSERT INTO inventario (producto_id, stock_actual, stock_minimo) VALUES (?, ?, ?)');
  const stocks = [
    [1, 18, 5],
    [2, 14, 5],
    [3, 3, 6], // stock bajo [DEMO]
    [4, 22, 5],
    [5, 10, 4],
    [6, 4, 5], // stock bajo [DEMO]
    [7, 25, 6],
    [8, 9, 4],
    [9, 7, 3],
  ];
  for (const st of stocks) insInv.run(...st);

  // Citas iniciales [DEMO] para mostrar reservas reales y bloqueo de horarios
  const tomorrow = new Date(Date.now() + 86400000);
  // Asegurar que no caiga en domingo (0)
  if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
  const fechaStr = tomorrow.toISOString().split('T')[0];

  const insCita = db.prepare(
    `INSERT INTO citas (
      codigo_reserva, cliente_id, propietario_nombre, propietario_email, propietario_telefono,
      mascota_id, mascota_nombre, mascota_especie, mascota_raza, mascota_edad,
      servicio_id, veterinario_id, fecha, hora, motivo, observaciones, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insCita.run(
    'AV-DEMO01',
    4,
    'Laura Méndez [DEMO]',
    'cliente@almavet.demo',
    '3000000004',
    1,
    'Milo [DEMO]',
    'Perro',
    'Golden Retriever',
    '3 años',
    1,
    1,
    fechaStr,
    '10:00',
    'Control general preventivo y revisión de piel [DEMO]',
    'Prefiere premios suaves en consulta.',
    'confirmada'
  );
  insCita.run(
    'AV-DEMO02',
    4,
    'Laura Méndez [DEMO]',
    'cliente@almavet.demo',
    '3000000004',
    2,
    'Nala [DEMO]',
    'Gato',
    'British Shorthair',
    '2 años',
    2,
    1,
    fechaStr,
    '11:30',
    'Refuerzo anual de vacunación [DEMO]',
    'Traer en transportador cubierto.',
    'pendiente'
  );

  // Pedido de ejemplo [DEMO]
  const insPed = db.prepare(
    `INSERT INTO pedidos (codigo_pedido, usuario_id, comprador_nombre, comprador_email, comprador_telefono, direccion_entrega, ciudad, subtotal, costo_envio, total, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insPed.run(
    'PED-DEMO01',
    4,
    'Laura Méndez [DEMO]',
    'cliente@almavet.demo',
    '3000000004',
    'Calle 85 # 14-22, Bogotá [DEMO]',
    'Bogotá',
    233000,
    0,
    233000,
    'entregado'
  );
  const insDet = db.prepare(
    'INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insDet.run(1, 1, 'Alimento Holístico Salmón y Avena 4kg [DEMO]', 1, 135000, 135000);
  insDet.run(1, 2, 'Fórmula Renal & Urinaria Gatos 2kg [DEMO]', 1, 98000, 98000);
  db.prepare(
    "INSERT INTO pagos (pedido_id, pasarela, referencia_externa, metodo, monto, moneda, estado) VALUES (?, 'integracion_lista', 'REF-DEMO-001', 'contraentrega_demo', ?, 'COP', 'aprobado')"
  ).run(1, 233000);
}
