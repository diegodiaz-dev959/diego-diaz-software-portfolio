# SignalOps — Procesamiento de eventos e incidentes

## Problema

Los servicios pueden emitir fallos transitorios, eventos repetidos o señales
fuera de orden. Abrir y cerrar alertas con cada evento produce ruido operativo.

## Funciones construidas

- Tres servicios de muestra y señales OK/fallo.
- Tres fallos consecutivos abren un incidente; sólo uno activo por servicio.
- Reconocimiento manual para marcar que un operador lo está atendiendo.
- Dos señales OK consecutivas resuelven el incidente.
- Hash e ID de evento para deduplicación; contenido distinto con mismo ID retorna 409.
- Eventos anteriores a la última señal se guardan como ignorados.
- Firma HMAC-SHA256, comparación constante y ventana de cinco minutos.
- Auditoría de apertura, reconocimiento y resolución.

## Contrato del webhook

`POST /api/ops/webhook`

```json
{
  "id": "evento-unico-001",
  "service_id": "api",
  "healthy": false,
  "created_at": 1791235200000
}
```

Utiliza una fecha actual en milisegundos. Headers: `X-Timestamp` con el momento
de firma en milisegundos y `X-Signature` con el HMAC hexadecimal de
`timestamp + '.' + bytes_del_body`.

El motor verifica tanto la ventana de firma como la fecha del evento.
`tools/send-signal.ts` genera y envía una señal a la demo local:

```bash
node tools/send-signal.ts api fail
node tools/send-signal.ts api ok
```

Si cambiaste el secreto o puerto del servidor, usa las mismas variables en el
script. El script sólo envía a `127.0.0.1`, no a un destino configurable externo.

## Otras rutas

- `GET /api/ops`: servicios, señales, incidentes y actividad.
- `POST /api/ops/probe`: `{service_id, healthy}` genera una señal de prueba,
  únicamente con sesión de operador.
- `POST /api/ops/incidents/:id/acknowledge`: reconoce el incidente.

## Decisiones técnicas y pruebas

Los umbrales distintos de apertura y recuperación reducen oscilaciones del
estado. El orden usa la fecha del evento; los IDs permiten reintentos sin alterar
contadores. El evento y sus efectos se guardan juntos en una transacción.

Se prueban apertura única, reintentos, colisiones de ID, eventos antiguos,
recuperación, reconocimiento, tipos y firmas alteradas o vencidas.

## Límites y siguiente versión

No hay sondeos automáticos, Slack, correo, SMS ni llamadas externas. El monitor
procesa señales, pero los botones no miden un servicio real. No calcula un SLO
o disponibilidad contractual. Una siguiente versión podría añadir productores
de señales, métricas de latencia, ventanas móviles y notificaciones verificadas.
