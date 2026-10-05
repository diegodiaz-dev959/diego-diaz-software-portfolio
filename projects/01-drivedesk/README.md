# DriveDesk — CRM de ventas

## Problema

Un equipo comercial necesita dar seguimiento a contactos y oportunidades sin
saltarse etapas, perder cambios de otro usuario ni ocupar dos veces una cita.

## Funciones construidas

- Crear contactos con origen y valor estimado en centavos MXN.
- Ver oportunidades en un pipeline de cinco etapas.
- Aplicar una máquina de estados: Nuevo → Contactado → Cita → Ganado.
  Nuevo/Contactado/Cita permiten marcar Perdido; Perdido permite reabrir a Nuevo.
  Ganado es una etapa terminal.
- Comparar la revisión enviada por el cliente antes de modificar una etapa.
- Agendar citas futuras dentro de los próximos 365 días y rechazar horarios
  ocupados. El calendario de esta demo es global, no por vendedor.
- Registrar creación, cambios de etapa y citas en auditoría.
- Mostrar conteos, conversión a Ganado y valor de oportunidades ganadas.

## API

| Método y ruta | Entrada principal | Resultado |
| --- | --- | --- |
| `GET /api/crm?search=texto` | Búsqueda opcional | Contactos, conteos, citas y actividad |
| `POST /api/crm/leads` | `name`, `email`, `source`, `value_cents` | Contacto nuevo, 201 |
| `POST /api/crm/leads/:id/transition` | `stage`, `revision` | Contacto actualizado / conflicto 409 |
| `POST /api/crm/leads/:id/appointments` | `starts_at` ISO, `note` | Cita nueva / conflicto 409 |

Las escrituras requieren el rol operador. Los IDs y las fechas se generan o
validan en el servidor. Las consultas usan parámetros y todas las escrituras
de negocio están en transacciones.

## Decisión técnica

Se usa control optimista: el usuario puede trabajar sin mantener bloqueado el
contacto. Sólo al escribir se verifica si su revisión sigue vigente. La etapa,
la nueva revisión y la auditoría se guardan juntas.

## Pruebas

`tests/domain.test.ts`: salto de etapa, revisión desactualizada, estados
terminales, validación, conflicto de horarios y consultas con sintaxis SQL.
`tests/http.test.ts`: autenticación y rechazo de escritura con rol lector.

## Cómo demostrarlo

Inicia el servidor desde la raíz con `node server.ts` y abre DriveDesk. Crea un
contacto y cambia su etapa. Para reproducir el conflicto de revisión, la suite
de dominio escribe una revisión y luego intenta sobrescribirla usando la anterior.

## Límites y siguiente versión

No hay envío de correo, WhatsApp ni sincronización de calendario. No existe
asignación a vendedores, multitenencia o paginación completa. La próxima versión
podría añadir permisos por equipo, filtros por vendedor y un historial visible
por contacto. El valor comercial es una estimación de muestra, no facturación.
