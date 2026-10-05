# EvidenceDesk — Recuperación documental con fuentes

## Problema

Un equipo de soporte necesita encontrar un fragmento de sus guías y comprobar
de dónde viene, sin recibir una respuesta inventada cuando no existe información.

## Funciones construidas

- Carga de hasta 60 documentos de texto, de máximo 40,000 caracteres cada uno.
- Detección de duplicados con hash de título y contenido.
- Fragmentación por párrafos, hasta 80 palabras y solapamiento para bloques largos.
- Normalización de acentos, stopwords y un pequeño diccionario de sinónimos.
- Ranking BM25 con frecuencia de términos y ajuste por longitud.
- Hasta tres resultados con documento, título, sección, extracto, score y términos.
- Umbral mínimo del 50% de cobertura de términos de la consulta; abstención
  cuando ningún fragmento satisface el criterio.

## Qué hace y qué no

Este es un buscador lexical. **No usa un LLM, embeddings ni una API generativa**.
Los resultados son extractos de documentos, no respuestas nuevas. Las fuentes
de muestra son guías ficticias. Encontrar una fuente no garantiza que su
contenido sea verdadero o que cubra todas las condiciones de una pregunta.

## API

| Ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /api/evidence` | — | Lista de documentos y tamaños |
| `POST /api/evidence/import` | `title`, `content` | Documento indexado o duplicado |
| `POST /api/evidence/search` | `query` | Citas o `found: false` |

La búsqueda está permitida al rol lector. Añadir fuentes requiere operador.
El texto se muestra mediante nodos de texto en la interfaz; no se interpreta
como HTML.

## Decisión técnica

BM25 permite una demo reproducible y sin claves externas. Cada resultado
conserva su documento y sección. La cobertura mínima reduce coincidencias
aisladas, aunque sigue siendo una heurística lexical, no un detector semántico
de suficiencia de evidencia.

## Pruebas

Se verifican extractos originales, consultas sin resultado, acentos y sinónimos,
documentos duplicados, fragmentación, entradas inválidas, consultas con sintaxis
SQL y términos vacíos. La inicialización de seis documentos también se prueba
con cuatro conexiones concurrentes.

## Cómo demostrarlo

Busca `¿Cuánto tarda la entrega?` y abre la evidencia de la guía. Después busca
`fotosíntesis dinosaurios`: no debe inventar una fuente. Añade un documento propio
y busca una palabra específica que contenga.

## Límites y siguiente versión

Sólo se importa texto; no PDF, OCR ni archivos adjuntos. El corpus se carga en
memoria por consulta. No se evalúa precisión con un benchmark de preguntas.
Una siguiente versión podría implementar búsquedas híbridas y un LLM con citas,
pero necesitaría evaluación de recuperación, privacidad y respuestas sin evidencia.
