# Proyectos de portafolio para el CV

Estas descripciones corresponden a funciones presentes en el código. Puedes
utilizarlas después de ejecutar, personalizar y comprender los proyectos.
Agrega los enlaces cuando los publiques en tu GitHub. No representan empleos,
trabajo para clientes ni resultados económicos obtenidos en una empresa.

## DriveDesk — CRM y seguimiento comercial

**Tecnologías:** TypeScript, Node.js, SQLite, JavaScript y CSS.

Implementación de un CRM para gestionar contactos, oportunidades y citas,
con reglas de transición comercial, detección de cambios simultáneos mediante
revisiones y registro de actividad. Incluye una interfaz de pipeline y pruebas
automatizadas de etapas, concurrencia optimista y conflictos de horarios.

**Qué explicar en una entrevista:** por qué una validación en el navegador no
basta, cómo una revisión evita sobrescribir el cambio de otro usuario y cuándo
responder con un conflicto 409.

## StockFlow — Inventario y pedidos transaccionales

**Tecnologías:** TypeScript, Node.js y SQLite.

Implementación de reservas temporales de inventario, confirmación y cancelación
de pedidos. Utiliza transacciones, restricciones SQL, claves de idempotencia y
un ledger de movimientos para prevenir sobreventa y duplicación de operaciones.
Incluye una prueba HTTP con diez solicitudes concurrentes sobre las últimas
unidades de un producto.

**Qué explicar:** diferencia entre stock físico y stock disponible, qué ocurre
si el cliente reintenta una solicitud y por qué dinero se representa en centavos.

## CampaignLab — ETL y analítica de adquisición

**Tecnologías:** Python, SQLite, Node.js y visualización SVG.

Desarrollo de un motor para validar e importar datos de campañas de forma
atómica, detectar registros duplicados y calcular CPL, CPA, CTR y ROAS a partir
de totales. Incluye filtros de fecha y manejo explícito de denominadores cero,
con pruebas de importación y agregación.

**Qué explicar:** por qué promediar el CPL de varias campañas puede dar un
resultado incorrecto y cómo un lote inválido se revierte sin dejar datos parciales.

## EvidenceDesk — Buscador documental con fuentes

**Tecnologías:** Python, SQLite y ranking BM25.

Implementación de un buscador local que fragmenta documentos, normaliza términos
en español y devuelve extractos con documento y sección de origen. Detecta
duplicados y se abstiene cuando no hay coincidencias suficientes. Incluye
pruebas de recuperación, trazabilidad y entradas inválidas.

**Qué explicar:** diferencia entre recuperar evidencia y generar una respuesta,
cómo funciona el ranking y las limitaciones de una búsqueda basada en términos.

## SignalOps — Procesamiento de eventos e incidentes

**Tecnologías:** TypeScript, Node.js, SQLite y HMAC-SHA256.

Desarrollo de un procesador de señales con verificación de firmas, control de
ventana temporal, deduplicación y descarte de eventos antiguos. Implementa
apertura, reconocimiento y resolución de incidentes mediante umbrales
consecutivos, con auditoría y pruebas de estados.

**Qué explicar:** cómo se verifica una firma, por qué un evento duplicado no
debe generar otra alerta y cómo el umbral de recuperación evita cierres prematuros.

## Presentación breve conjunta

Portafolio de cinco aplicaciones de muestra en TypeScript/Node.js y Python con
SQLite, enfocado en reglas de negocio, APIs, integridad de datos, permisos y
pruebas automatizadas. Incluye CRM, inventario, analítica de campañas, búsqueda
documental y gestión de incidentes.

La calidad de los proyectos puede respaldar una candidatura; el nivel senior
tiene que sustentarse también con experiencia real y capacidad de explicación.
