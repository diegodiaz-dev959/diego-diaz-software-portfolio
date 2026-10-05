# Decisiones de arquitectura

## Alcance del paquete

Cinco contextos de negocio comparten una capa HTTP y almacenamiento local.
Separar dominios en carpetas permite leer las reglas sin depender de los
formularios. SQLite hace la demo reproducible sin instalar un servidor de
bases de datos. Las pruebas usan bases temporales o en memoria.

| Capa | Responsabilidad | Ubicación |
| --- | --- | --- |
| Navegador | Formularios, métricas, errores y navegación | `web/` |
| HTTP | Sesión, permisos, origen, tamaño y respuesta | `server.ts` |
| Dominio TS | Transiciones, pedidos, eventos e incidentes | Proyectos 01, 02, 05 |
| Dominio Python | ETL, agregaciones y recuperación de texto | Proyectos 03, 04 |
| Persistencia | Tablas, restricciones, índices, auditoría | `core/store.ts` y motores Python |

## Integridad antes que interfaz

- **CRM:** el cliente envía la revisión que leyó. La escritura compara esa
  revisión dentro de una transacción. Un cambio desactualizado devuelve 409.
- **Inventario:** cada reserva, venta y liberación actualiza el producto y el
  ledger dentro de `BEGIN IMMEDIATE`. Las restricciones SQL impiden stock
  negativo y reservas mayores que el stock.
- **Campañas:** se valida todo el lote antes de guardar; una colisión de claves
  con datos diferentes revierte cualquier inserción del lote.
- **Documentos:** el hash de título y contenido detecta duplicados. Se guardan
  los fragmentos originales y sus identificadores para hacer verificable el
  resultado de la búsqueda.
- **Incidentes:** cada evento tiene un ID y hash del contenido. Los duplicados
  no cuentan dos veces. Un índice parcial impide dos incidentes activos por
  servicio, incluso si otra ruta intenta crearlos.

## Autenticación y límites de entrada

Se usan contraseñas con `scrypt`, salt aleatorio por usuario y comparación de
hash en tiempo constante. El navegador recibe un token opaco aleatorio en una
cookie HttpOnly/SameSite=Strict; la base guarda su hash. Logout invalida la
sesión en el servidor. Su duración máxima es de ocho horas.

Hay dos roles globales, operador y lector. Las rutas de escritura comprueban el
rol en el servidor. La búsqueda documental es una lectura aunque use POST.
Las solicitudes con un Origin distinto del Host local se rechazan. Las rutas
JSON verifican su Content-Type, formato y tamaño máximo de 256 KB.

Las consultas SQL usan parámetros. La interfaz inserta datos mediante nodos
de texto, evitando convertir documentos y nombres en HTML ejecutable.
El servidor sirve sólo cuatro rutas estáticas autorizadas, añade CSP y un
identificador de solicitud. Los errores imprevistos no exponen trazas al cliente.

## Python como proceso aislado

El servidor utiliza `spawn`, sin shell, con proyecto/acción controlados y
entrada JSON por stdin. Cada llamada tiene un máximo de quince segundos y una
salida limitada. Python usa exclusivamente la biblioteca estándar. La creación
de un proceso por solicitud simplifica el paquete, pero añade latencia; para
producción convendría un servicio persistente y una cola cuando corresponda.

## Decisiones deliberadas y límites

- **Sin servicios de pago:** no se simulan cargos de tarjeta ni transferencias.
  Confirmar un pedido sólo altera el inventario local.
- **Sin respuestas generativas:** EvidenceDesk es recuperación lexical BM25,
  no un RAG con LLM. Los extractos coinciden con los documentos; no se evalúa la
  veracidad del contenido de esos documentos.
- **Sin vigilancia externa:** SignalOps procesa eventos, pero no sondea URLs
  de Internet ni envía notificaciones. Los botones generan señales de prueba.
- **Sin microservicios desplegados:** un monorepo y un servidor local hacen
  más fácil verificar reglas. La separación por carpetas no equivale a servicios
  desplegados de forma independiente.
- **Sin multitenencia:** los roles son globales y comparten los datos de muestra.
  No hay límites de acceso por organización ni autorización por propietario.
- **Sin escala demostrada:** las lecturas de CRM y pedidos tienen topes de
  200/100 registros; no implementan paginación completa. El buscador permite
  hasta 60 documentos de 40,000 caracteres y recalcula el ranking en cada consulta.
- **Vencimiento oportunista:** las reservas se liberan al consultar inventario
  o ejecutar una operación. No existe un scheduler independiente.
- **Auditoría parcial:** cubre las acciones de CRM, inventario e incidentes.
  No pretende ser un registro inmutable ni una bitácora completa de acceso.
- **Comprobación de tipos pendiente:** Node elimina anotaciones de TypeScript;
  se probaron las reglas en ejecución, no una compilación estática con `tsc`.
- **Moneda única:** MXN y centavos enteros. No se mezclan divisas ni se implementa
  contabilidad fiscal.

## Evolución razonable

Antes de un despliegue real: completar comprobación de tipos y pruebas de
interfaz, añadir migraciones versionadas, configuración de secretos, HTTPS,
políticas de cuenta y recuperación, backups, telemetría, manejo de procesos
Python persistentes, paginación y pruebas de carga. Añadir Redis, cloud o
Kubernetes sólo si existe una necesidad medida; no por decorar el CV.
