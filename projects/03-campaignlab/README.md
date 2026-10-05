# CampaignLab — ETL y métricas de campañas

## Problema

Los reportes pueden sumar datos duplicados, mezclar periodos o promediar ratios
de forma incorrecta. Un lote inválido también puede dejar resultados parciales.

## Funciones construidas

- Importación JSON de hasta 250 filas con esquema validado.
- Clave única por fuente, campaña y día. El hash distingue un duplicado exacto
  de un registro con la misma clave y valores conflictivos.
- Lotes atómicos y uso de savepoints para transacciones anidadas.
- Filtro de fechas y agregación por campaña y día.
- CPL, CPA, CTR, conversión de clic a lead y ROAS.
- Gráfico SVG de ingresos atribuidos con datos persistidos.
- Inicialización de 42 registros ficticios de septiembre de 2026.

## Cálculos

| Indicador | Fórmula |
| --- | --- |
| CPL | Gasto / leads atribuidos |
| CPA | Gasto / ventas atribuidas |
| ROAS | Ingresos atribuidos / gasto |
| CTR | Clics / impresiones |
| Conversión a lead | Leads / clics |

Los indicadores globales utilizan los **totales**, no el promedio de ratios de
campañas. Cuando el denominador es cero, el motor retorna `null` y la interfaz
muestra `—`. Los importes se guardan en centavos MXN y la interfaz los redondea
para mostrarlos; los cálculos conservan más precisión.

## Esquema de una fila

```json
{
  "source": "Meta Ads",
  "campaign": "Campaña de muestra",
  "day": "2026-09-15",
  "spend_cents": 15000,
  "impressions": 1800,
  "clicks": 70,
  "leads": 8,
  "sales": 1,
  "revenue_cents": 120000
}
```

## API

`GET /api/campaigns?start=2026-09-01&end=2026-09-14` consulta las métricas.
`POST /api/campaigns/import` recibe `{"rows":[...]}` y devuelve el número de
filas nuevas y duplicadas. Una colisión con contenido diferente devuelve 409
y revierte el lote.

## Decisión técnica y pruebas

El motor Python no necesita pandas para este alcance. Las agregaciones se hacen
en SQL y las reglas se prueban en una base en memoria. Se verifican ratios
ponderados, cero denominadores, duplicados, rollback, tipos, fechas y filtros.
También se comprueba la inicialización concurrente desde cuatro conexiones.

## Límites y siguiente versión

No conecta a Meta ni Google y no realiza atribución de ventas: recibe conteos
que ya fueron atribuidos. No deduce causalidad ni recomienda inversiones a
partir de datos ficticios. No mezcla monedas. Para una versión real habría que
integrar APIs, definir el modelo de atribución y manejar correcciones de datos
mediante versiones en vez de sobrescribir registros silenciosamente.
