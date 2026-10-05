# Portafolio de Diego Díaz

Cinco implementaciones de portafolio con código ejecutable, datos de muestra,
persistencia local, reglas de negocio y pruebas automatizadas. El repositorio es
un **monorepo**: cada proyecto tiene su lógica y documentación; comparte servidor,
autenticación y una interfaz web para que sea fácil ejecutar los cinco.

## Empieza aquí

1. Instala **Node.js 24** y **Python 3.10 o posterior** desde sus sitios oficiales.
2. Descomprime el paquete y abre la carpeta `Portafolio_Diego`.
3. En Windows, ejecuta `iniciar.bat`. En macOS/Linux, abre una terminal en la
   carpeta y ejecuta `node server.ts`.
4. Abre `http://localhost:8080` en tu navegador.

No se necesita `npm install`, ninguna API de pago ni una cuenta en servicios
externos para ejecutar las aplicaciones. La primera ejecución crea la base en
`data/portfolio.sqlite`. Los cambios persisten entre reinicios.

| Acceso de muestra | Usuario | Contraseña | Permiso |
| --- | --- | --- | --- |
| Operador | `demo` | `Demo-2026!` | Consultar y modificar |
| Lector | `lector` | `Lectura-2026!` | Consultar y buscar documentos |

El servidor escucha exclusivamente en `127.0.0.1`. Las credenciales conocidas
son únicamente para esta demo local. La implementación no está preparada para
publicarse en Internet tal como está.

## Los cinco proyectos

| Proyecto | Problema que resuelve | Qué demuestra |
| --- | --- | --- |
| [DriveDesk](projects/01-drivedesk/README.md) | Seguimiento de oportunidades y citas | Máquina de estados, revisión optimista, auditoría |
| [StockFlow](projects/02-stockflow/README.md) | Inventario reservado y pedidos repetidos | Transacciones, idempotencia, ledger, vencimiento |
| [CampaignLab](projects/03-campaignlab/README.md) | Datos duplicados y métricas engañosas | ETL atómico, validación, métricas ponderadas |
| [EvidenceDesk](projects/04-evidencedesk/README.md) | Encontrar información y verificar su fuente | Recuperación BM25, fragmentación, citas, abstención |
| [SignalOps](projects/05-signalops/README.md) | Eventos duplicados y alertas inestables | HMAC, orden temporal, umbrales, ciclo de incidentes |

La interfaz utiliza JavaScript moderno y CSS adaptable. Los backends están en
TypeScript/Node.js y Python, con SQLite. Este paquete **no implementa React,
.NET, Java, AWS ni Kubernetes**; no incluyas esas tecnologías como parte de
estos proyectos.

## Prueba las aplicaciones

- **CRM:** crea un contacto, pásalo de Nuevo a Contactado y agenda una cita.
  No puedes pasar directamente de Nuevo a Ganado. Dos citas no pueden ocupar
  el mismo horario global.
- **Inventario:** reserva un producto y confirma el pedido. El stock se
  descuenta sólo al confirmar. Cancelar libera la reserva. No hay cobros reales.
- **Campañas:** consulta los 42 registros de septiembre de 2026. Filtra un
  periodo sin datos y verifica que las métricas sin denominador aparecen como
  `—`. Importa un lote JSON y repítelo: no se duplican sus registros.
- **Documentos:** busca `¿Cuánto tarda la entrega?` y revisa su fuente. Luego
  busca `fotosíntesis dinosaurios`: el buscador debe abstenerse. Puedes añadir
  tus propios documentos de texto.
- **Incidentes:** simula tres fallos en un servicio, reconoce su incidente y
  envía dos señales OK. Los fallos abren un incidente; las señales OK lo resuelven.

## Ejecuta las pruebas

Desde la carpeta raíz:

```bash
node --test tests/*.test.ts
python3 -m unittest discover -s tests -p "test_*.py" -v
```

En Windows, usa `python` en lugar de `python3`. También puedes utilizar
`verificar.bat`.

**Resultado comprobado:** 25 pruebas Node y 19 Python; 44 aprobadas, 0 fallidas.
Incluyen invariantes de negocio y pruebas HTTP de autenticación, permisos,
importaciones y diez reservas concurrentes sobre el último inventario disponible.

`tests/browser-smoke.cjs` incluye ocho escenarios de interfaz para Playwright.
**No se ejecutó hasta completar sus escenarios en el entorno de creación:** no
había Chromium instalado y el navegador remoto bloqueó localhost. El conteo de
44 pruebas excluye la suite de navegador. La sintaxis de `web/app.js` sí fue
comprobada con `node --check`.

Para ejecutar la suite de navegador en tu PC, instala Playwright y su Chromium
en un entorno de desarrollo, inicia el servidor y ejecuta:

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/browser-smoke.cjs
```

Esta suite modifica datos de muestra. Utiliza una base separada con
`PORTFOLIO_DB` antes de ejecutarla; espera una base recién creada.

## Estructura

```text
Portafolio_Diego/
  core/                 # SQLite, validación, transacciones y auditoría
  projects/
    01-drivedesk/        # CRM en TypeScript
    02-stockflow/        # Pedidos e inventario en TypeScript
    03-campaignlab/      # ETL y métricas en Python
    04-evidencedesk/     # Búsqueda documental en Python
    05-signalops/        # Eventos e incidentes en TypeScript
  web/                  # Interfaz de las cinco demos
  tests/                # Pruebas de dominio, HTTP y motores Python
  server.ts             # Servidor HTTP y sesiones
  python_worker.py      # Puente JSON al motor Python
  ARCHITECTURE.md
  PARA_TU_CV.md
  VERIFICACION.md
```

## Configuración

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| `PORTFOLIO_PORT` | `8080` | Puerto del servidor local |
| `PORTFOLIO_DB` | `data/portfolio.sqlite` | Ruta de la base de datos |
| `PORTFOLIO_PYTHON` | `python3` / `python` en Windows | Ejecutable de Python |
| `PORTFOLIO_DEMO_PASSWORD` | `Demo-2026!` | Contraseña inicial del operador |
| `PORTFOLIO_VIEWER_PASSWORD` | `Lectura-2026!` | Contraseña inicial del lector |
| `PORTFOLIO_WEBHOOK_SECRET` | `local-demo-secret-change-me` | Secreto de firma de eventos |

Las contraseñas de usuarios sólo se aplican al crear una base nueva; cambiar
una variable no modifica una cuenta existente. No se incluyen bases de datos,
sesiones ni secretos personales en el ZIP.

## Para tu CV y GitHub

`PARA_TU_CV.md` contiene descripciones de lo que efectivamente implementa el
código. Preséntalos como **proyectos de portafolio**, con enlaces a los
repositorios cuando los publiques. Antes de presentarlos en una entrevista,
ejecútalos, personalízalos y aprende a explicar sus reglas y limitaciones.
No atribuyas ingresos, clientes, cargos ni experiencia empresarial a estas demos.

Para compartirlos en GitHub, crea un repositorio privado o público según tu
preferencia y sube el código junto con sus README. Excluye la carpeta `data`,
sesiones y tus variables de entorno. La documentación explica mejoras posibles;
no las presenta como funcionalidades ya construidas.

## Fuentes técnicas

- [SQLite en Node.js 24](https://nodejs.org/download/release/v24.20.0/docs/api/sqlite.html)
- [Ejecución de TypeScript en Node.js](https://nodejs.org/api/typescript.html)
- [SQLite y parámetros en Python](https://docs.python.org/3/library/sqlite3.html)

Node ejecuta este TypeScript mediante eliminación de anotaciones. Esto **no**
equivale a una comprobación estática con `tsc`; no se realizó esa comprobación.
