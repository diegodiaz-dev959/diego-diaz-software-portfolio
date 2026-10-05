# Registro de verificación

Fecha: 5 de octubre de 2026.

| Comprobación | Resultado |
| --- | --- |
| Pruebas Node de dominio | 18 aprobadas |
| Pruebas Node HTTP | 7 aprobadas |
| Pruebas Python de CampaignLab | 9 aprobadas |
| Pruebas Python de EvidenceDesk | 8 aprobadas |
| Pruebas Python de inicialización concurrente | 2 aprobadas |
| Total de pruebas automatizadas ejecutadas | **44 aprobadas, 0 fallidas** |
| Análisis de sintaxis de la interfaz | `node --check web/app.js`, aprobado |
| Suite de navegador | No completada: Chromium no disponible y localhost bloqueado en navegador remoto |
| Comprobación estática con `tsc` | No ejecutada |
| Pruebas de carga, producción o despliegue | No ejecutadas |

Entorno de backend: Node.js 24.19.0 y Python 3. El código no requiere paquetes
externos para estas pruebas. Las pruebas HTTP arrancan un servidor real en un
puerto temporal y usan bases de datos descartables.

## Casos con evidencia concreta

- Diez solicitudes concurrentes intentaron reservar tres unidades de un producto
  con sólo tres unidades disponibles: **una respuesta 201 y nueve respuestas
  409**, inventario disponible final de cero.
- Confirmar dos veces el mismo pedido descontó sus unidades sólo una vez.
- Una importación con un registro conflictivo revirtió todo su lote.
- Una consulta sin evidencia no devolvió citas inventadas.
- Un usuario lector recibió 403 al intentar crear un contacto o reservar un pedido.
- Un webhook alterado, una firma inválida y una firma vencida fueron rechazados.

Las pruebas demuestran esos comportamientos; no garantizan que no existan
otros defectos. La revisión visual y los ocho escenarios de navegador deben
completarse en un equipo con un navegador compatible.
