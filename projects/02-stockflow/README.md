# StockFlow — Inventario y pedidos

## Problema

Dos compradores pueden solicitar las últimas unidades al mismo tiempo. Un
reintento de red también puede duplicar pedidos si no se reconoce la solicitud.

## Funciones construidas

- Catálogo con stock físico, reservas y unidades disponibles.
- Reservas por quince minutos, confirmación, cancelación y vencimiento.
- Clave de idempotencia: misma clave + mismo contenido devuelve el mismo pedido;
  misma clave + otro contenido devuelve 409.
- Ledger con cada cambio de stock y de reserva.
- Importes enteros en centavos para evitar errores de punto flotante monetario.
- Restricciones SQL que rechazan stock negativo y reservas superiores al stock.

## Invariantes

`disponible = stock - reservado`, `stock >= 0`, `0 <= reservado <= stock`.

Reservar aumenta `reservado`; confirmar disminuye `stock` y `reservado`;
cancelar o vencer sólo disminuye `reservado`. Un pedido confirmado o cancelado
no puede cambiar a otro estado. Repetir la misma confirmación o cancelación no
genera otro movimiento.

## API

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /api/stock` | — | Catálogo, pedidos y ledger |
| `POST /api/stock/reserve` | `product_id`, `quantity`, `request_key` | Reserva / sobreventa 409 |
| `POST /api/stock/orders/:id/confirm` | `{}` | Confirmación idempotente |
| `POST /api/stock/orders/:id/cancel` | `{}` | Liberación idempotente |

## Decisión técnica

`BEGIN IMMEDIATE` reserva la escritura antes de leer y comprobar el inventario.
El pedido, el cambio de producto y el ledger se guardan dentro de una sola
transacción. Si una validación falla, no quedan efectos parciales.

## Pruebas

Se prueban cantidades inválidas, sobreventa, reintentos, claves conflictivas,
confirmación repetida, cancelación y vencimiento. La prueba HTTP envía diez
solicitudes concurrentes para las últimas tres unidades: sólo una se acepta.

## Cómo demostrarlo

Inicia la demo, reserva dos unidades de un producto y confirma el pedido.
Comprueba el stock y los dos movimientos del ledger. Cancela otra reserva y
verifica que sus unidades vuelvan a estar disponibles.

## Límites y siguiente versión

No existe pasarela de pago, carrito de múltiples productos, impuestos, envío ni
facturación. El vencimiento se procesa al leer el inventario o ejecutar una
operación, no mediante un scheduler. Para producción harían falta conciliación
de pagos, un job de vencimiento, stock por almacén y gestión de devoluciones.
