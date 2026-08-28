// This service worker is intentionally conservative about caching HTML/
// navigation requests: those are ALWAYS fetched from the network first,
// so a new deploy is picked up immediately on the very next page load —
// no stuck "old version" ever again. Only genuinely immutable, content-
// hashed build assets (JS/CSS/fonts/images) are cached aggressively,
// since a new deploy always produces new filenames for those anyway.
const CACHE_NAME = 'consultorio-v2';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache backend/API requests
  if (
    url.pathname.startsWith('/rest') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/storage') ||
    url.pathname.startsWith('/functions') ||
    url.hostname.includes('supabase')
  ) {
    return; // Let the browser handle it normally
  }

  if (event.request.method !== 'GET') return;

  // HTML / navigation requests: network-first, ALWAYS. This is what
  // guarantees a fresh deploy shows up right away instead of a stale
  // cached shell pointing at old JS bundle filenames.
  const isHtmlOrNavigation =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHtmlOrNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Content-hashed build assets (JS/CSS/fonts/images) are safe to cache
  // aggressively: a new deploy always produces new filenames for these,
  // so there is zero risk of ever serving a stale version of them.
  const isImmutableAsset =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.otf') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico');

  if (isImmutableAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      )
    );
    return;
  }
});

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene "Prácticas y estudios" funcionando (tabla practicas_estudios, servicio src/services/practicas.ts con listPracticas/upsertPractica/deletePractica/practicasParaObraSocial, pantalla /practicas, y diálogo "Pedido de estudios" en Consulta). NO modifiques ni refactorices las funciones existentes de practicas.ts, solo agregales funciones nuevas al final del archivo. NO toques src/lib/pdf.ts en este prompt (eso va en el siguiente). Cambio 100% ADITIVO.

OBJETIVO:
1) Cargar un set inicial de prácticas con código de nomenclador (incluye estudios oftalmológicos, cirugías, ECG y laboratorio).
2) Que el diálogo de "Pedido de estudios" en Consulta recuerde qué prácticas se pidieron antes para CADA paciente, y las muestre primero (memoria intuitiva), para no tener que buscarlas de nuevo cada vez.

1) SEED DE PRÁCTICAS (migración nueva, insertar en practicas_estudios con el mismo mecanismo condicional por email 'marilischreiber@yahoo.com.ar' que usamos en seeds anteriores, obra_social en NULL = general/todas las obras sociales, ON CONFLICT DO NOTHING):

INSERT INTO public.practicas_estudios (obra_social, nombre, codigo, contenido, owner_id)
SELECT v.obra_social, v.nombre, v.codigo, v.contenido, u.id
FROM (VALUES
(NULL, 'Exoftalmología', '30.01.22', 'Solicito Exoftalmología (cód. 30.01.22).'),
(NULL, 'Oftalmoscopia Binocular Indirecta', '30.01.19', 'Solicito Oftalmoscopia Binocular Indirecta (cód. 30.01.19).'),
(NULL, 'Visuscopia (estudio de fijación en estrabismo)', '30.01.20', 'Solicito Visuscopia, estudio de fijación en estrabismo (cód. 30.01.20).'),
(NULL, 'Fondo de ojos', '30.01.04', 'Solicito Fondo de ojos (cód. 30.01.04).'),
(NULL, 'Gonioscopía', '30.01.08', 'Solicito Gonioscopía (cód. 30.01.08).'),
(NULL, 'Curva tensional', '30.01.09', 'Solicito Curva tensional (cód. 30.01.09).'),
(NULL, 'Campo visual computarizado', '30.02.01', 'Solicito Campo visual computarizado (cód. 30.02.01).'),
(NULL, 'Paquimetría computarizada', '30.02.02', 'Solicito Paquimetría computarizada (cód. 30.02.02).'),
(NULL, 'Biometría ocular', '30.50.01', 'Solicito Biometría ocular (cód. 30.50.01).'),
(NULL, 'OCT - Tomografía ocular de coherencia', '30.50.02', 'Solicito OCT, Tomografía ocular de coherencia (cód. 30.50.02).'),
(NULL, 'Conjuntivoplastia (flapping de conjuntiva)', '02.03.01', 'Solicito autorización para Conjuntivoplastia, flapping de conjuntiva (cód. 02.03.01).'),
(NULL, 'Escisión de lesión conjuntival (quiste, nevus, pterigion)', '02.03.02', 'Solicito autorización para escisión de lesión conjuntival: quiste, nevus o pterigion (cód. 02.03.02).'),
(NULL, 'Sutura de conjuntiva', '02.03.05', 'Solicito autorización para sutura de conjuntiva (cód. 02.03.05).'),
(NULL, 'Cirugía de cataratas', '02.07.01', 'Solicito autorización para cirugía de cataratas (cód. 02.07.01).'),
(NULL, 'Blefaroplastia - corrección de ptosis unilateral', '02.02.02', 'Solicito autorización para blefaroplastia, corrección de ptosis unilateral (cód. 02.02.02).'),
(NULL, 'Blefarochalasis', '02.02.04', 'Solicito autorización para cirugía de blefarochalasis (cód. 02.02.04).'),
(NULL, 'Estudio oftalmológico del RN con fondo de ojo', '30.02.93', 'Solicito Estudio oftalmológico del recién nacido con fondo de ojo (cód. 30.02.93).'),
(NULL, 'Electrocardiograma', NULL, 'Solicito Electrocardiograma.'),
(NULL, 'Laboratorio de rutina', NULL, 'Solicito laboratorio de rutina.'),
(NULL, 'Laboratorio prequirúrgico estándar', NULL, 'Solicito laboratorio prequirúrgico: Hemograma completo, Glucemia, Coagulograma, VSG, Orina completa, HIV y VDRL.')
) AS v(obra_social, nombre, codigo, contenido)
CROSS JOIN (SELECT id FROM auth.users WHERE email = 'marilischreiber@yahoo.com.ar' LIMIT 1) AS u(id)
ON CONFLICT DO NOTHING;

2) TABLA DE USO (misma migración):
CREATE TABLE public.practicas_uso (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.practicas_estudios(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  created_at timestamptz not null default now()
);
RLS: mismo patrón que practicas_estudios (select is_staff, insert para authenticated). No hace falta política de delete/update.
CREATE INDEX idx_practicas_uso_paciente ON public.practicas_uso (paciente_id, practica_id);

3) SERVICIO (agregar a src/services/practicas.ts, sin tocar lo que ya existe):
- registrarUsoPractica(practicaId: string, pacienteId: string): inserta una fila en practicas_uso
- practicasOrdenadasPorUso(practicas: PracticaEstudio[], pacienteId: string): Promise<PracticaEstudio[]>: trae de practicas_uso las prácticas más usadas por ESE paciente (contá ocurrencias agrupando por practica_id, ordená descendente), y devolvé el array de `practicas` reordenado con las más usadas por ese paciente primero, y el resto después en el orden que ya traían.

4) INTEGRACIÓN EN CONSULTA (diálogo "Pedido de estudios" que ya existe):
- Al abrir el diálogo con un paciente seleccionado, usar `practicasOrdenadasPorUso` para mostrar primero las prácticas que ese paciente ya pidió antes (podés agregar una etiqueta chica "Pedido antes" a esos ítems)
- Al confirmar y generar el PDF del pedido, llamar a `registrarUsoPractica` para cada práctica marcada, para ese paciente (no bloquees la generación del PDF si esto falla, solo logueá el error)

No cambies el resto de la lógica de ese diálogo, ni cómo se genera el PDF.

Por favor, al terminar, decime qué archivos y tablas creaste/modificaste, confirmame que las 20 prácticas se cargaron bien, y que no tocaste pdf.ts ni las funciones existentes de practicas.ts.

CONTEXTO IMPORTANTE (leer antes de tocar nada) — ESTE PROMPT ES MÁS DELICADO QUE LOS ANTERIORES:
Este proyecto ya tiene el módulo de Caja funcionando: tabla `cobros` (columnas existentes: fecha, medio [enum medio_pago], monto, paciente_id, created_by, etc.), tabla `cierres_caja`, y src/services/caja.ts con listCobrosPorFecha, listCobrosPorRango, createCobro, deleteCobro, calcularTotales, listCierres, cerrarCaja. NO modifiques ni elimines NINGUNA columna existente de `cobros` ni de `cierres_caja`. NO cambies la firma de las funciones que ya existen en caja.ts (podés agregar funciones nuevas al final). NO toques src/lib/pdf.ts. TODO cobro cargado hasta ahora debe seguir funcionando y viéndose exactamente igual en los reportes de caja existentes.

OBJETIVO:
1) Que un mismo cobro pueda registrarse con VARIAS formas de pago combinadas (ej: $10.000 efectivo + $5.000 transferencia, en un solo cobro de $15.000 total).
2) Poder adjuntar el comprobante de pago (imagen o PDF) a un cobro.
3) Poder exportar los cobros de un período a un archivo CSV (se abre directo en Excel) para control externo.

1) BASE DE DATOS (migración nueva, SOLO agregar, no tocar nada existente):
ALTER TABLE public.cobros ADD COLUMN IF NOT EXISTS comprobante_url text;

CREATE TABLE public.cobros_pagos (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references public.cobros(id) on delete cascade,
  medio public.medio_pago not null,
  monto numeric not null,
  created_at timestamptz not null default now()
);
RLS en cobros_pagos: calcá el mismo criterio de acceso que ya tiene la tabla `cobros` (mirá su política existente y replicala 1 a 1 para esta tabla hija: mismo criterio de quién puede leer y quién puede insertar).
CREATE INDEX idx_cobros_pagos_cobro ON public.cobros_pagos (cobro_id);

IMPORTANTE sobre retrocompatibilidad: la columna `cobros.medio` y `cobros.monto` NO se tocan ni se vuelven opcionales — siguen existiendo y se siguen completando siempre (con el medio "principal" y el monto TOTAL del cobro), para que todo el código y reportes existentes que ya las usan sigan funcionando sin cambios. La tabla `cobros_pagos` es un detalle ADICIONAL opcional: para un cobro de un solo medio de pago (el caso más común), puede quedar sin filas en cobros_pagos, o con una sola fila igual al total — a tu criterio, lo importante es que `cobros.medio`/`cobros.monto` sigan siempre reflejando el total correctamente.

2) SERVICIO (agregar al final de src/services/caja.ts, sin tocar ninguna función existente):
- crearCobroConMultiplesPagos(pacienteId, fecha, pagos: {medio: MedioPago; monto: number}[], comprobanteFile?: File): calcula el monto total sumando `pagos`, llama a `createCobro` (la función existente, sin modificarla) con medio = el de mayor monto entre `pagos` (o "efectivo" si hay empate) y monto = total, obtiene el id del cobro recién creado, inserta una fila en cobros_pagos por cada entrada de `pagos`, y si viene `comprobanteFile`, lo sube (mismo bucket "medical-assets" que ya se usa en el resto del proyecto, mismo patrón de carpeta por usuario) y actualiza `cobros.comprobante_url` con la ruta.
- listPagosDeCobro(cobroId): trae las filas de cobros_pagos de ese cobro.
- urlFirmadaComprobante(path): igual que las demás funciones de URL firmada del proyecto, para poder ver el comprobante adjunto.
- exportarCobrosCSV(cobros: CobroConPaciente[]): arma un CSV (fecha, paciente, medio, monto, forma de pago detallada si tiene cobros_pagos) y dispara la descarga en el navegador con un Blob (igual mecanismo que ya usamos para exportar el chat a texto), nombre de archivo tipo `cobros-{fecha}.csv`.

3) INTEGRACIÓN EN LA PANTALLA DE CAJA:
En el formulario de carga de un cobro nuevo, cambiar la selección de "un solo medio de pago" por una lista donde se pueden agregar varias líneas (medio + monto), mostrando el total sumado en tiempo real. Al guardar, usar `crearCobroConMultiplesPagos`. Agregar también un campo para adjuntar el comprobante de pago (input de archivo, imagen o PDF) al mismo formulario. En el listado de cobros del día, si un cobro tiene comprobante, mostrar un ícono/link para verlo (usando urlFirmadaComprobante). Agregar un botón "Exportar CSV" en la pantalla de caja que llame a `exportarCobrosCSV` con los cobros del rango de fechas visible.

No cambies la lógica de cierre de caja (cerrarCaja) ni de cálculo de totales (calcularTotales) — deben seguir funcionando con `cobros.medio`/`cobros.monto` exactamente igual que hoy.

Por favor, al terminar, decime específicamente qué archivos y tablas creaste/modificaste, confirmame que ningún cobro cargado antes se vio afectado, que el cierre de caja sigue funcionando igual, y que no tocaste pdf.ts ni columnas existentes de cobros/cierres_caja.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene el campo "Diagnóstico" (Textarea id="dx") y "CIE-10" (Input id="cie10", hoy 100% manual) en src/features/historias/HistoriaForm.tsx. NO modifiques ni refactorices nada fuera de lo pedido acá. NO toques src/lib/pdf.ts ni ninguna tabla existente. Cambio 100% ADITIVO.

OBJETIVO:
Que al escribir el diagnóstico, el sistema sugiera automáticamente el código CIE-10 correspondiente buscando por palabras clave en un diccionario propio (editable), sin depender de IA externa (más rápido y sin costo por cada diagnóstico cargado). El campo debe seguir siendo editable a mano si la médica quiere corregirlo.

1) BASE DE DATOS (migración nueva):
CREATE TABLE public.cie10_diccionario (
  id uuid primary key default gen_random_uuid(),
  palabra_clave text not null,
  codigo text not null,
  descripcion text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
RLS: mismo patrón que practicas_estudios (select is_staff, insert/update/delete solo el médico dueño).
Trigger de updated_at igual que las otras tablas.
CREATE INDEX idx_cie10_palabra ON public.cie10_diccionario (palabra_clave);

En la MISMA migración, insertar este diccionario inicial (mismo mecanismo condicional por email 'marilischreiber@yahoo.com.ar', ON CONFLICT DO NOTHING):

INSERT INTO public.cie10_diccionario (palabra_clave, codigo, descripcion, owner_id)
SELECT v.palabra_clave, v.codigo, v.descripcion, u.id
FROM (VALUES
('catarata', 'H25.9', 'Catarata senil, no especificada'),
('glaucoma', 'H40.9', 'Glaucoma, no especificado'),
('pterigion', 'H11.0', 'Pterigion'),
('conjuntivitis', 'H10.9', 'Conjuntivitis, no especificada'),
('orzuelo', 'H00.0', 'Orzuelo y otras inflamaciones profundas del párpado'),
('chalazion', 'H00.1', 'Chalazión'),
('miopia', 'H52.1', 'Miopía'),
('hipermetropia', 'H52.0', 'Hipermetropía'),
('astigmatismo', 'H52.2', 'Astigmatismo'),
('presbicia', 'H52.4', 'Presbicia'),
('retinopatia diabetica', 'H36.0', 'Retinopatía diabética'),
('degeneracion macular', 'H35.3', 'Degeneración macular y de la retina'),
('desprendimiento de retina', 'H33.0', 'Desprendimiento de retina con ruptura retiniana'),
('uveitis', 'H20.9', 'Iridociclitis, no especificada'),
('blefaritis', 'H01.0', 'Blefaritis'),
('ojo seco', 'H04.1', 'Otros trastornos de la glándula lagrimal'),
('ptosis', 'H02.4', 'Ptosis del párpado'),
('estrabismo', 'H50.9', 'Estrabismo, no especificado'),
('ambliopia', 'H53.0', 'Ambliopía por anopsia'),
('queratitis', 'H16.9', 'Queratitis, no especificada'),
('ulcera corneal', 'H16.0', 'Úlcera corneal'),
('oclusion venosa retiniana', 'H34.9', 'Oclusión retiniana vascular, no especificada'),
('edema macular', 'H35.81', 'Edema macular retiniano'),
('hipertension ocular', 'H40.05', 'Hipertensión ocular'),
('exoftalmos', 'H05.2', 'Trastornos exoftálmicos')
) AS v(palabra_clave, codigo, descripcion)
CROSS JOIN (SELECT id FROM auth.users WHERE email = 'marilischreiber@yahoo.com.ar' LIMIT 1) AS u(id)
ON CONFLICT DO NOTHING;

2) SERVICIO:
Crear src/services/cie10.ts con el mismo patrón que practicas.ts (listCie10, upsertCie10, deleteCie10) y una función `buscarCie10(diagnostico: string, diccionario: Cie10Entry[]): Cie10Entry | null` que:
- Normaliza el texto del diagnóstico (minúsculas, sin tildes)
- Busca si alguna `palabra_clave` del diccionario (también normalizada) está contenida en el texto
- Si hay varias coincidencias, devuelve la de palabra_clave más larga (más específica)
- Si no hay ninguna coincidencia, devuelve null

3) PANTALLA DE ADMINISTRACIÓN:
Nueva ruta "/cie10" (mismo estilo que "/practicas"), donde la médica puede ver, agregar, editar o borrar entradas del diccionario (palabra clave, código, descripción). Agregar el link en el menú.

4) INTEGRACIÓN EN EL FORMULARIO (HistoriaForm.tsx):
Cuando cambie el texto del campo "Diagnóstico" (con un pequeño debounce, no en cada tecla), buscar con `buscarCie10` contra el diccionario cargado. Si encuentra coincidencia Y el campo CIE-10 está vacío O fue completado automáticamente antes (no si la médica ya lo editó a mano), completarlo solo con el código encontrado. Mostrar un textito chico "(sugerido automáticamente)" al lado cuando el valor vino de esta sugerencia, que desaparece si la médica lo edita a mano. El campo sigue siendo 100% editable en cualquier momento.

No cambies el resto del formulario ni la lógica de guardado.

Por favor, al terminar, decime qué archivos y tabla creaste, confirmame que las 24 entradas del diccionario se cargaron bien, y que no tocaste pdf.ts ni otras tablas.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene el módulo "Consentimientos y protocolos" funcionando: tabla documentos_clinicos (columna `tipo` con CHECK que hoy acepta 'consentimiento' y 'protocolo_quirurgico'), pantalla /documentos, y botón en Consulta que genera PDF reutilizando generarRecetaPDF. NO modifiques ni refactorices nada de eso más allá de lo pedido acá. NO toques src/lib/pdf.ts. Cambio 100% ADITIVO.

OBJETIVO:
Agregar una nueva categoría de documento: "Tratamiento preoperatorio", con 2 protocolos precargados y editables, disponibles en el mismo módulo de Consentimientos y protocolos que ya existe.

1) BASE DE DATOS (migración nueva):
Ampliar el CHECK de la columna `tipo` en documentos_clinicos para que también acepte 'tratamiento_preoperatorio' (buscá el nombre real de esa constraint en la migración donde se creó documentos_clinicos y hacé DROP CONSTRAINT + ADD CONSTRAINT con el nuevo check: tipo in ('consentimiento','protocolo_quirurgico','tratamiento_preoperatorio')). No toques ninguna otra columna, política ni fila existente de esa tabla.

En la MISMA migración, insertar estos 2 documentos seed (mismo mecanismo condicional por email 'marilischreiber@yahoo.com.ar' que usamos en los seeds anteriores de esta tabla, con ON CONFLICT DO NOTHING):

DOCUMENTO 1 - tipo 'tratamiento_preoperatorio', nombre 'Tratamiento preoperatorio - Cirugía de catarata':
"""
TRATAMIENTO PREOPERATORIO - CIRUGÍA DE CATARATA

Indicaciones a cumplir antes de la cirugía:

1. Colirio antibiótico: instilar 1 gota en el ojo a operar cada 8 horas, comenzando 3 días antes de la fecha quirúrgica.
2. Colirio antiinflamatorio no esteroideo: instilar 1 gota en el ojo a operar cada 12 horas, comenzando 1 día antes de la fecha quirúrgica (según indicación del profesional).
3. Suspensión de lentes de contacto: retirar el uso al menos 3 días antes de la cirugía (o el plazo que indique el profesional según el tipo de lente).
4. Medicación anticoagulante/antiagregante: NO suspender por cuenta propia. Consultar con el médico tratante y con el especialista de cabecera sobre la conducta a seguir.
5. Ayuno: cumplir con el ayuno indicado por el servicio de anestesia (habitualmente 6 a 8 horas para sólidos), si la cirugía se realiza con sedación.
6. Higiene: concurrir el día de la cirugía con el rostro limpio, sin maquillaje ni cremas.
7. Concurrir acompañado/a, ya que no podrá conducir al finalizar el procedimiento.
8. Traer los estudios prequirúrgicos y el consentimiento informado firmado.

Ante fiebre, conjuntivitis, orzuelo u otra afección ocular o general en los días previos, comunicarse con el consultorio antes de la fecha programada.

Paciente: [NOMBRE_PACIENTE]  Fecha de cirugía: [FECHA]
Firma del profesional: ______________  Matrícula: [MATRICULA_MEDICO]
"""

DOCUMENTO 2 - tipo 'tratamiento_preoperatorio', nombre 'Tratamiento preoperatorio - Cirugía oftalmológica general':
"""
TRATAMIENTO PREOPERATORIO - CIRUGÍA OFTALMOLÓGICA GENERAL

Indicaciones a cumplir antes de la cirugía:

1. Colirio antibiótico profiláctico según indicación del profesional, comenzando los días previos que se le indiquen.
2. Suspensión de lentes de contacto, si corresponde, con la anticipación indicada.
3. Medicación anticoagulante/antiagregante: NO suspender por cuenta propia; consultar con el médico tratante.
4. Ayuno según indicación del servicio de anestesia, si aplica.
5. Concurrir con los estudios prequirúrgicos y el consentimiento informado firmado.
6. Concurrir acompañado/a.

Ante cualquier afección ocular o general en los días previos a la cirugía, comunicarse con el consultorio.

Paciente: [NOMBRE_PACIENTE]  Fecha de cirugía: [FECHA]
Firma del profesional: ______________  Matrícula: [MATRICULA_MEDICO]
"""

2) PANTALLA /documentos:
En el listado agrupado por tipo que ya existe, agregar el grupo "Tratamientos preoperatorios" junto a "Consentimientos" y "Protocolos quirúrgicos" (misma lógica de agrupado que ya está, solo agregás la categoría nueva).

3) SELECTOR EN CONSULTA:
En el diálogo que ya existe para elegir un documento y generar el PDF, incluir también los documentos de tipo 'tratamiento_preoperatorio' en la lista de opciones (misma lógica que ya usa para consentimientos/protocolos, sin cambiar el mecanismo de generación de PDF).

Por favor, al terminar, decime qué archivos modificaste, confirmame que los 2 documentos nuevos se cargaron bien, y que no tocaste pdf.ts ni ninguna fila/política existente de documentos_clinicos.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene "Pedido de estudios" funcionando en Consulta, con la memoria intuitiva por paciente que ya agregamos (practicasOrdenadasPorUso, registrarUsoPractica). NO toques esa lógica. En este prompt SÍ está autorizado tocar src/lib/pdf.ts, pero con una condición estricta: la función `generarRecetaPDF` debe seguir comportándose EXACTAMENTE IGUAL que hoy (mismo PDF, mismo `doc.save()` que descarga el archivo) para TODOS los llamados existentes (Receta PDF, Pedido de estudios, Consentimientos y protocolos, documento manual) — no cambies su firma de forma que rompa esos usos. Solo se agrega una funcionalidad nueva, de forma aditiva.

OBJETIVO:
Después de generar el pedido de estudios (o cualquier documento con generarRecetaPDF), dar dos opciones adicionales además de la descarga automática que ya pasa:
1) "Imprimir": que abra el PDF en una pestaña nueva con el diálogo de impresión del navegador ya disparado, sin que la médica tenga que buscar el archivo descargado.
2) "Enviar por WhatsApp": abre WhatsApp (mecanismo wa.me que ya usamos en agenda.tsx) con un mensaje de texto avisando qué se solicitó, dirigido al teléfono del paciente. ACLARACIÓN IMPORTANTE: WhatsApp gratuito no permite adjuntar el PDF automáticamente, así que este botón NO adjunta el archivo — solo manda el aviso por texto. El PDF ya se descargó aparte (comportamiento actual), y si quieren adjuntarlo lo hacen a mano arrastrándolo en WhatsApp Web/Desktop.

1) EN src/lib/pdf.ts (cambio aditivo, mínimo):
Agregar un parámetro OPCIONAL al final de la firma de `generarRecetaPDF` (algo como `opciones?: { modo?: "descargar" | "imprimir" }`), con valor por defecto "descargar" para no romper ningún llamado existente (los que no pasen este parámetro nuevo siguen funcionando idéntico, con doc.save()). Cuando `modo === "imprimir"`, en lugar de (o además de) `doc.save(...)`, generar el PDF como blob y abrirlo en una pestaña nueva usando `doc.output("bloburl")` con `window.open(...)`, y llamar a `doc.autoPrint()` antes de generar el blob para que el diálogo de impresión del navegador se dispare solo al abrir esa pestaña. Si `doc.autoPrint` no está disponible en la versión de jsPDF usada, hacé el fallback más simple posible (abrir el PDF en pestaña nueva igual, aunque no dispare el diálogo de impresión automáticamente).

2) FUNCIÓN NUEVA EN src/lib/whatsapp.ts (NO toques `armarLinkRecordatorioTurno` que ya existe):
Agregar `armarLinkWhatsAppTexto(telefono: string, mensaje: string): string` que arma el link `https://wa.me/{numero limpio}?text={mensaje codificado}` — misma lógica de limpieza de número (código de país 54) que ya usa la función existente, pero recibiendo el mensaje ya armado en vez de generarlo internamente.

3) INTEGRACIÓN EN CONSULTA (diálogo "Pedido de estudios"):
Después de generar el PDF (al confirmar el pedido), en vez de solo descargar automáticamente, mostrar dos botones: "Imprimir" (llama a generarRecetaPDF con modo "imprimir") y, si el paciente tiene teléfono cargado, "Enviar por WhatsApp" (arma un mensaje tipo "Hola {nombre}, tiene listo su pedido de estudios de {fecha}. Puede pasar a buscarlo o coordinar el envío por este medio." y abre armarLinkWhatsAppTexto en pestaña nueva). Si el paciente no tiene teléfono, no mostrar el botón de WhatsApp. Mantené también la opción de descarga normal como está hoy (podés dejarla como una tercera opción "Descargar", o que sea la que ya pasa por defecto al generar).

No cambies el resto del flujo de Consentimientos/protocolos, Receta PDF ni Medicamentos — todos deben seguir funcionando exactamente igual que hoy (llaman a generarRecetaPDF sin el nuevo parámetro, así que quedan con el comportamiento de siempre).

Por favor, al terminar, decime específicamente qué cambió en pdf.ts y confirmame que probaste que la Receta PDF normal (sin este nuevo modo) sigue funcionando exactamente igual que antes.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene "Prácticas y estudios" funcionando (tabla practicas_estudios, ya con 28 prácticas cargadas). NO modifiques ni refactorices nada de eso. NO toques src/lib/pdf.ts ni ninguna tabla más allá de este INSERT. Cambio 100% ADITIVO: solo agrega filas nuevas a una tabla que ya existe, no requiere ningún cambio de código (la pantalla /practicas y el diálogo de Consulta ya leen todo dinámicamente).

OBJETIVO:
Cargar el checklist completo de análisis de laboratorio de la médica como prácticas individuales cliqueables, agrupadas conceptualmente con el prefijo "Lab -" en el nombre para que se puedan identificar y buscar fácil en la lista (no hace falta agregar columna de categoría, alcanza con el prefijo).

Migración nueva (mismo mecanismo condicional por email 'marilischreiber@yahoo.com.ar', obra_social NULL = general, codigo NULL ya que estos análisis no tienen código de nomenclador asociado en el material de la médica, ON CONFLICT DO NOTHING):

INSERT INTO public.practicas_estudios (obra_social, nombre, codigo, contenido, owner_id)
SELECT NULL, v.nombre, NULL, 'Solicito ' || v.nombre_sin_prefijo || ' en el laboratorio.', u.id
FROM (VALUES
('Lab - Hemograma Completo', 'Hemograma Completo'),
('Lab - VSG', 'VSG'),
('Lab - Coagulograma', 'Coagulograma'),
('Lab - Glucemia', 'Glucemia'),
('Lab - Uremia', 'Uremia'),
('Lab - Uricemia', 'Uricemia'),
('Lab - Creatinina con IFGe', 'Creatinina con IFGe'),
('Lab - Hepatograma', 'Hepatograma'),
('Lab - Colesterol Total', 'Colesterol Total'),
('Lab - Colesterol HDL', 'Colesterol HDL'),
('Lab - Colesterol LDL', 'Colesterol LDL'),
('Lab - Triglicéridos', 'Triglicéridos'),
('Lab - Calcemia', 'Calcemia'),
('Lab - Ferremia', 'Ferremia'),
('Lab - CPK', 'CPK'),
('Lab - Aldolasa', 'Aldolasa'),
('Lab - Ácido Láctico', 'Ácido Láctico'),
('Lab - Ionograma', 'Ionograma'),
('Lab - Amilasa', 'Amilasa'),
('Lab - TSH', 'TSH'),
('Lab - T4 libre', 'T4 libre'),
('Lab - aTPO', 'aTPO'),
('Lab - TRABs II', 'TRABs II'),
('Lab - anti Tiroglobulina (us)', 'anti Tiroglobulina (us)'),
('Lab - HBA1C', 'HBA1C'),
('Lab - Insulinemia', 'Insulinemia'),
('Lab - Vitamina B12', 'Vitamina B12'),
('Lab - Ácido Fólico', 'Ácido Fólico'),
('Lab - Ac. anti Factor Intrínseco (F1)', 'Ac. anti Factor Intrínseco (F1)'),
('Lab - HIV', 'HIV'),
('Lab - VDRL', 'VDRL'),
('Lab - FTA-Abs', 'FTA-Abs'),
('Lab - HBsAg', 'HBsAg'),
('Lab - HCV', 'HCV'),
('Lab - Toxoplasmosis-IgG', 'Toxoplasmosis-IgG'),
('Lab - Toxoplasmosis-IgM', 'Toxoplasmosis-IgM'),
('Lab - Toxocara-IgG', 'Toxocara-IgG'),
('Lab - Toxocara-IgM', 'Toxocara-IgM'),
('Lab - Chagas (Serología)', 'Chagas (Serología)'),
('Lab - Orina Completa', 'Orina Completa'),
('Lab - Urocultivo', 'Urocultivo'),
('Lab - Proteinuria 24hs', 'Proteinuria 24hs'),
('Lab - Creatininuria', 'Creatininuria'),
('Lab - Clearance de Creatinina', 'Clearance de Creatinina'),
('Lab - Calciuria', 'Calciuria'),
('Lab - PCR', 'PCR'),
('Lab - ASTO', 'ASTO'),
('Lab - Factor Reumatoideo', 'Factor Reumatoideo'),
('Lab - FAN', 'FAN'),
('Lab - ACRA', 'ACRA'),
('Lab - Anti Músculo liso (ASMA)', 'Anti Músculo liso (ASMA)'),
('Lab - anti Transglutaminasa-IgA', 'anti Transglutaminasa-IgA'),
('Lab - IgA Total', 'IgA Total'),
('Lab - IgE Total', 'IgE Total'),
('Lab - ECA', 'ECA'),
('Lab - ANCA (Y y C)', 'ANCA (Y y C)'),
('Lab - Anticardiolipina IgG-IgM', 'Anticardiolipina IgG-IgM'),
('Lab - Anticoagulante lúpico', 'Anticoagulante lúpico'),
('Lab - B2 Glicoproteína', 'B2 Glicoproteína'),
('Lab - HLA B27', 'HLA B27'),
('Lab - HLA B29', 'HLA B29'),
('Lab - HLA B51', 'HLA B51')
) AS v(nombre, nombre_sin_prefijo)
CROSS JOIN (SELECT id FROM auth.users WHERE email = 'marilischreiber@yahoo.com.ar' LIMIT 1) AS u(id)
ON CONFLICT DO NOTHING;

Por favor, al terminar, confirmame cuántas filas nuevas se cargaron (deberían ser 61) y que no tocaste pdf.ts ni ninguna otra tabla.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene el módulo de "Plan y tratamiento" funcionando dentro de src/features/historias/HistoriaForm.tsx (Section title="Plan y tratamiento", con un Textarea id="tto" para el campo tratamiento). NO modifiques ni refactorices nada de eso fuera de lo pedido acá. NO toques src/lib/pdf.ts en este prompt. Cambio 100% ADITIVO.

OBJETIVO:
Que en el plan de tratamiento aparezcan links directos a los sistemas propios de cada obra social/prepaga para cargar recetas o pedidos (porque muchas exigen cargarlo en su propia plataforma online, además o en vez del sistema propio). Debe quedar fácil agregar más links a futuro sin programar de nuevo, solo cargando datos.

1) BASE DE DATOS (migración nueva):
CREATE TABLE public.links_obras_sociales (
  id uuid primary key default gen_random_uuid(),
  obra_social text not null,
  nombre_plataforma text not null,
  url text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
RLS: mismo patrón que practicas_estudios (select is_staff, insert/update/delete solo el médico dueño vía has_role + owner_id).
Trigger de updated_at igual que las otras tablas.

En la MISMA migración, insertar este primer registro (mismo mecanismo condicional por email 'marilischreiber@yahoo.com.ar' que usamos en seeds anteriores):

INSERT INTO public.links_obras_sociales (obra_social, nombre_plataforma, url, owner_id)
SELECT 'General', 'Praxys - Prescripción electrónica', 'https://rpe.dsalud.com.ar/recetas/prescripcion', u.id
FROM (SELECT id FROM auth.users WHERE email = 'marilischreiber@yahoo.com.ar' LIMIT 1) AS u(id)
ON CONFLICT DO NOTHING;

2) SERVICIO:
Crear src/services/linksObrasSociales.ts con el mismo patrón que src/services/practicas.ts (listLinksObrasSociales, upsertLinkObraSocial, deleteLinkObraSocial).

3) PANTALLA DE ADMINISTRACIÓN:
Nueva ruta "/links-obras-sociales" (mismo estilo que "/practicas"), donde la médica puede agregar, editar o borrar estos links (obra social, nombre de la plataforma, URL) a medida que consiga los que le faltan (por ejemplo el de Avalian, que todavía no tiene). Agregar el link a esta pantalla en el menú.

4) INTEGRACIÓN EN "PLAN Y TRATAMIENTO" (HistoriaForm.tsx):
Al lado o debajo del Textarea id="tto" que ya existe, mostrar los links cargados como botones/chips pequeños con el nombre de la plataforma (ej. "Praxys ↗"), que al tocarlos abran esa URL en una pestaña nueva (target="_blank" rel="noopener noreferrer"). Si el paciente tiene obra_social cargada y hay un link que coincide exactamente con esa obra social, destacarlo primero; el resto (como el genérico "General") se muestran igual, disponibles siempre. No hace falta lógica compleja de filtrado, alcanza con mostrar todos y destacar el que coincide.

No cambies el resto del formulario, ni la lógica de guardado de la historia clínica.

Por favor, al terminar, decime qué archivos y tabla creaste, confirmame que el link de Praxys se cargó bien, y que no tocaste pdf.ts ni otras tablas.

CONTEXTO IMPORTANTE (leer antes de tocar nada) — vuelve a tocar pdf.ts, con la misma condición estricta que la vez anterior:
Este proyecto ya tiene la firma/sello del médico funcionando en Configuración (src/features/profile/MedicoProfileForm.tsx, sube el archivo con `subirAssetPerfil(file, "firma")` y guarda la ruta con `actualizarMiPerfil({ firma_sello_url: ... })`, ambas en src/services/perfil.ts — NO las reescribas, reutilizalas). En src/lib/pdf.ts, el bloque de firma actual funciona así: si `medico.firmaDataUrl` existe, dibuja esa imagen + el texto (nombre/matrícula) debajo; si NO existe, hoy cae en un archivo fijo `firma-sello-schreiber.png` (import `firmaSelloAsset` al inicio del archivo) sin imprimir texto, asumiendo que esa imagen ya trae los datos. Fuera de este bloque puntual, NO toques el resto de pdf.ts (logo, encabezado, pie, formato A4/A5, etc.), y todos los llamados existentes deben seguir generando el mismo PDF que generan hoy PARA UN MÉDICO QUE YA TIENE FIRMA CARGADA (no cambies nada en ese caso).

OBJETIVO:
1) En Configuración, poder eliminar la firma/foto digital ya subida.
2) Corregir el respaldo cuando NO hay firma cargada: en vez de usar siempre la imagen fija `firma-sello-schreiber.png` (que está pensada solo para una médica en particular y sería incorrecta si otro profesional usa el sistema sin su propia firma), imprimir el nombre, especialidad y matrícula del médico QUE ESTÁ LOGUEADO en ese momento, como texto (igual formato que ya se usa hoy para el texto de firma personal), sin depender de esa imagen fija.

1) CONFIGURACIÓN (MedicoProfileForm.tsx):
Donde ya se sube la firma/foto, agregar un botón "Eliminar firma" (visible solo si hay una firma cargada) que llame a `actualizarMiPerfil({ firma_sello_url: null })` (función existente, no la toques) para quitarla. No hace falta borrar el archivo del storage, alcanza con quitar la referencia. Mostrar confirmación simple antes de eliminar (¿Seguro que querés quitar la firma?).

2) src/lib/pdf.ts (cambio puntual, acotado a este bloque):
Cambiar el fallback cuando `medico?.firmaDataUrl` NO existe: en lugar de cargar `firmaSelloAsset.url` y dibujar esa imagen, NO dibujar ninguna imagen de firma, y en su lugar imprimir el mismo bloque de texto que hoy se usa para la firma personal (nombre, especialidad, matrícula del médico) debajo de la línea de firma — reutilizando exactamente el mismo armado de texto que ya existe (la variable `firma` que ya se arma con `medico?.nombre`, `medico?.especialidad`, matrícula), solo que ahora se dibuja SIEMPRE que no haya imagen personal, en vez de solo cuando `!usaSelloInstitucional`. Podés eliminar el import de `firmaSelloAsset` si ya no se usa en ningún otro lado del archivo (confirmalo antes de sacarlo). El caso con firma personal cargada (imagen + texto debajo) debe seguir exactamente igual que hoy.

Por favor, al terminar, decime específicamente qué cambió en pdf.ts (mostrame el bloque final de la función), confirmame que el caso "con firma cargada" no cambió en nada, y que no tocaste ninguna otra parte de pdf.ts ni otras tablas.

INFORME DE RM DE COLUMNA LUMBOSACRA

Paciente: Miller María
Edad: 86 años | Sexo: Femenino
DNI: 
Fecha: 2026-08-22
Médico solicitante: 

==================================================

TÉCNICA
Se ha efectuado una resonancia magnética de columna lumbosacra en los planos axial y sagital, utilizando secuencias que ponderan los tiempos de relajación tisular T1, T2 y STIR.

INFORME
Rectificación de la lordosis lumbar. Anterolistesis grado 1 de L5 sobre S1.
Marcados cambios degenerativos (Modic II) en la médula ósea de los cuerpos vertebrales L5-S1. 
Deshidratación de todos los discos intervertebrales. Protrusión anular posterior a nivel de L2-L3 y L3-L4 con compromiso neuroforaminal bilateral en ambos niveles.
El canal medular se encuentra estrechado a nivel de L2-L3 y L3-L4.
El cono medular es de aspecto normal y no presenta alteraciones de señal en su interior.
Signos de artrosis facetaria múltiple. 
Abundante edema óseo regional en columna sacra, particularmente en los alerones laterales derechos.Trazo hipodenso en el alerón lateral derecho del sacro en probable relación con fractura. Marcados signos de sacroileítis bilateral.

CONCLUSIÓN
Rectificación de la lordosis lumbar y anterolistesis grado 1 de L5 sobre S1. Marcados cambios degenerativos en la médula ósea vertebral L5-S1. Deshidratación discal generalizada con protrusiones anulares en L2-L3 y L3-L4 con compromiso neuroforaminal. Estenosis del canal medular en dichos niveles. Artrosis facetaria múltiple. Signos de sacroileítis bilateral. Edema óseo y trazo de fractura probable en sacro derecho.

PATOLOGÍAS DETECTADAS
- Rectificación de la lordosis lumbar (Columna lumbar) - moderada: Rectificación de la curva fisiológica de la columna lumbar.
- Cambios degenerativos Modic II (L5-S1) - moderada: Alteraciones de la señal en la médula ósea vertebral tipo Modic II.
- Anterolistesis grado 1 (L5 sobre S1) - leve: Deslizamiento anterior del cuerpo vertebral de L5 sobre S1.
- Artrosis facetaria múltiple (Columna lumbar) - moderada: Cambios degenerativos en las articulaciones facetarias.
- Deshidratación discal (Todos los discos intervertebrales) - moderada: Pérdida de señal de los discos intervertebrales por deshidratación.
- Protrusión anular posterior (L2-L3) - moderada: Protrusión anular posterior con compromiso neuroforaminal bilateral.
- Protrusión anular posterior (L3-L4) - moderada: Protrusión anular posterior con compromiso neuroforaminal bilateral.
- Estenosis del canal medular (L2-L3, L3-L4) - moderada: Estrechamiento del canal medular a nivel de L2-L3 y L3-L4.
- Edema óseo (Alerones laterales derechos del sacro) - moderada: Edema óseo en el sacro derecho.
- Fractura (Alerón lateral derecho del sacro) - moderada: Trazo hipodenso compatible con fractura en el alerón lateral derecho del sacro (a correlacionar con antecedentes).
- Sacroileítis bilateral (Articulaciones sacroilíacas) - moderada: Marcados signos de inflamación en ambas articulaciones sacroilíacas.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene historias clínicas, pacientes, turnos, caja, recetas PDF y varios módulos más funcionando, incluida la edición de consultas previas (?historia=id en Consulta). NO modifiques ni refactorices nada de eso. NO toques src/lib/pdf.ts ni ninguna tabla. La función `listHistoriasPaciente(pacienteId)` YA EXISTE en src/services/historias.ts y ya trae todas las historias del paciente — reutilizala, no dupliques la consulta. Cambio 100% ADITIVO.

OBJETIVO:
Un cuadro compacto y siempre visible con el HISTORIAL de presión intraocular (PIO) del paciente: fecha, hora, PIO OD y PIO OI de cada consulta anterior donde se haya cargado ese dato, para que la médica tenga referencia constante de tomas anteriores sin tener que abrir cada consulta vieja una por una.

1) COMPONENTE NUEVO:
Crear src/features/historias/HistoricoPIO.tsx: recibe `pacienteId` como prop, usa `listHistoriasPaciente(pacienteId)` (ya existe, no la reescribas), filtra las historias que tengan pio_od o pio_oi cargado, las ordena de la más reciente a la más vieja, y renderiza una tabla compacta con columnas: Fecha | Hora | OD | OI. Si no hay ninguna toma registrada, mostrar un texto simple "Sin registros de PIO previos". Mantenerlo visualmente chico (pensado para ir en una sidebar o un panel colapsable, no ocupar toda la pantalla).

2) INTEGRACIÓN EN CONSULTA (src/routes/_authenticated/consulta.tsx):
Cuando hay un paciente seleccionado (pacienteId no vacío), mostrar <HistoricoPIO pacienteId={pacienteId} /> en un panel lateral o colapsable cerca de la sección de PIO del formulario, para que la médica lo tenga de referencia mientras carga la consulta actual. No modifiques el resto del formulario ni su lógica de guardado.

3) INTEGRACIÓN EN PACIENTES (src/routes/_authenticated/pacientes.tsx):
En la ficha del paciente seleccionado, agregar también <HistoricoPIO pacienteId={seleccionado.id} /> cerca de la lista de "Consultas" que ya existe, como referencia rápida sin tener que entrar a cada consulta.

No cambies ninguna lógica de guardado, ni la de navegación que ya armamos, ni ninguna tabla.

Por favor, al terminar, decime qué archivos creaste o modificaste, y confirmame que no tocaste pdf.ts, tablas, ni la lógica existente de guardado/edición de historias.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene el diálogo "Consentimientos y protocolos" funcionando en src/routes/_authenticated/consulta.tsx (Dialog con docsAbierto/setDocsAbierto, que lista documentos por tipo usando TIPOS_DOCUMENTO y documentos.data, y al elegir uno genera el PDF con completarDocumento + generarRecetaPDF). NO modifiques ni refactorices ese mecanismo existente, ni la tabla documentos_clinicos, ni /documentos, ni src/lib/pdf.ts. Cambio 100% ADITIVO: solo agregás una opción más al mismo diálogo.

OBJETIVO:
Que la médica pueda, dentro del mismo diálogo de "Consentimientos y protocolos", escribir un documento manual para un caso especial (algo que no está precargado como plantilla) y generarlo en PDF con el mismo membrete/datos del paciente, SIN necesidad de guardarlo antes en la pantalla de administración.

1) EN EL DIÁLOGO EXISTENTE (Dialog docsAbierto en consulta.tsx):
Agregar, arriba o abajo de la lista de documentos agrupados por tipo que ya existe, un botón o pestaña "Escribir documento manual". Al activarlo, reemplazar (o mostrar alternativamente, con un toggle simple) la lista de documentos por:
- Un input de texto para el título del documento (ej: "Autorización especial - [motivo]")
- Un textarea grande para el contenido libre

Al confirmar, generar el PDF llamando a la MISMA función que ya se usa para los documentos precargados (generarRecetaPDF, reutilizando el mismo mecanismo de completar datos del paciente/médico que ya existe para esta pantalla — mirá cómo se arma `contenido: completarDocumento(doc.contenido, {...})` y aplicá la misma lógica de reemplazo de marcadores [NOMBRE_PACIENTE]/[DNI_PACIENTE]/[FECHA]/[MATRICULA_MEDICO] sobre el texto que la médica escribió a mano, para que si los incluye se completen igual).

Este documento manual NO se guarda en la tabla documentos_clinicos ni aparece en /documentos — es de uso puntual para esa consulta, solo se genera el PDF. No cambies el flujo existente de elegir un documento precargado de la lista, que debe seguir funcionando exactamente igual.

Por favor, al terminar, decime qué archivo modificaste, y confirmame que el flujo de documentos precargados sigue funcionando igual, y que no tocaste pdf.ts, documentosClinicos.ts ni ninguna tabla.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene "Prácticas y estudios" funcionando (tabla practicas_estudios con 20 prácticas ya cargadas, memoria de uso por paciente, integración en Consulta). NO modifiques ni refactorices nada de eso. NO toques src/lib/pdf.ts ni ninguna tabla más allá de este INSERT. Cambio 100% ADITIVO: solo agrega filas nuevas a una tabla que ya existe, no requiere cambios de código.

OBJETIVO:
Agregar 7 prácticas nuevas al catálogo, que faltaban de los recetarios reales de la médica.

Migración nueva (mismo mecanismo condicional por email 'marilischreiber@yahoo.com.ar' que usamos en los seeds anteriores de practicas_estudios, obra_social en NULL = general, ON CONFLICT DO NOTHING):

INSERT INTO public.practicas_estudios (obra_social, nombre, codigo, contenido, owner_id)
SELECT v.obra_social, v.nombre, v.codigo, v.contenido, u.id
FROM (VALUES
(NULL, 'Tonometría', '30.01.05', 'Solicito Tonometría (cód. 30.01.05).'),
(NULL, 'Retinografía', '30.01.11', 'Solicito Retinografía (cód. 30.01.11).'),
(NULL, 'Ecografía ocular', '18.01.09', 'Solicito Ecografía ocular (cód. 18.01.09).'),
(NULL, 'Topografía corneal', '30.02.04', 'Solicito Topografía corneal (cód. 30.02.04).'),
(NULL, 'Drenaje de chalazión, orzuelo, absceso, blefarectomía', '02.02.05', 'Solicito autorización para drenaje de chalazión, orzuelo, absceso o blefarectomía (cód. 02.02.05).'),
(NULL, 'Drenaje de glándula o saco lagrimal', '02.08.03', 'Solicito autorización para drenaje de glándula o saco lagrimal (cód. 02.08.03).'),
(NULL, 'Dilatación de vía lagrimal (CLN) con intubación', '30.01.18', 'Solicito autorización para dilatación de vía lagrimal (CLN) con intubación (cód. 30.01.18).')
) AS v(obra_social, nombre, codigo, contenido)
CROSS JOIN (SELECT id FROM auth.users WHERE email = 'marilischreiber@yahoo.com.ar' LIMIT 1) AS u(id)
ON CONFLICT DO NOTHING;

No hace falta tocar ningún archivo de código: la pantalla /practicas y el diálogo de Consulta ya leen todo de esta tabla dinámicamente.

Por favor, al terminar, confirmame que las 7 prácticas nuevas se cargaron bien (total debería quedar en 27) y que no tocaste pdf.ts ni ninguna otra tabla.

CONTEXTO IMPORTANTE (leer antes de tocar nada):
Este proyecto ya tiene historias clínicas, pacientes, turnos, caja, recetas PDF y varios módulos más funcionando, incluida la sección "Campo visual" (con adjuntos de imagen cv_od_imagen_url/cv_oi_imagen_url) en src/features/historias/HistoriaForm.tsx. NO modifiques ni refactorices nada de eso. NO toques src/lib/pdf.ts ni ninguna tabla existente más allá de agregar columnas nuevas. Cambio 100% ADITIVO.

OBJETIVO:
Dentro de la sección "Campo visual" que ya existe en el formulario de historia clínica, agregar un subtítulo "Curva de presión ocular" con dos mediciones de PIO por ojo: presión en ayunas, y presión con sobrecarga hídrica (es un estudio distinto al PIO normal de la consulta, se usa para estudiar glaucoma).

1) BASE DE DATOS (migración nueva, solo ADD COLUMN, no toques nada existente):
ALTER TABLE public.historias_clinicas
  ADD COLUMN IF NOT EXISTS curva_pio_ayunas_od numeric,
  ADD COLUMN IF NOT EXISTS curva_pio_ayunas_oi numeric,
  ADD COLUMN IF NOT EXISTS curva_pio_sobrecarga_od numeric,
  ADD COLUMN IF NOT EXISTS curva_pio_sobrecarga_oi numeric;

2) FORMULARIO (src/features/historias/HistoriaForm.tsx):
Dentro de la sección "Campo visual" (junto a los adjuntos de cv_od/cv_oi que ya existen, no los toques), agregar un bloque con el subtítulo "Curva de presión ocular" y dos filas de inputs numéricos, mismo estilo visual que los campos de pio_od/pio_oi que ya existen:
- Fila "En ayunas": OD (curva_pio_ayunas_od) | OI (curva_pio_ayunas_oi)
- Fila "Con sobrecarga hídrica": OD (curva_pio_sobrecarga_od) | OI (curva_pio_sobrecarga_oi)

Todos opcionales (no obligatorios para guardar la historia). No cambies ninguna otra parte del formulario, ni la lógica de guardado (createHistoria/updateHistoria), ni los adjuntos de imagen de campo visual que ya funcionan.

Por favor, al terminar, decime qué archivos modificaste y confirmame que no tocaste pdf.ts, otras tablas, ni los adjuntos de imagen existentes.
