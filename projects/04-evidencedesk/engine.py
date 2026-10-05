"""Búsqueda BM25 local: entrega extractos, sin inventar respuestas ni llamar a un LLM."""
import collections
import hashlib
import json
import math
import re
import unicodedata
from campaign_engine import ValidationError, atomic

STOP = set('a al algo como cual cuando de del el en es esta este estas estos la las lo los mas me mi o para por que se sin su sus un una unas unos y cuanto cual cuantos donde'.split())
SYNONYMS = {'envio':'entrega','envios':'entrega','entregas':'entrega','devoluciones':'devolucion','pagos':'pago','pedidos':'pedido','contrasenas':'contrasena'}

def tokens(value):
    normalized = ''.join(c for c in unicodedata.normalize('NFKD',value.lower()) if not unicodedata.combining(c))
    return [SYNONYMS.get(word,word) for word in re.findall(r'[a-z0-9]+',normalized) if len(word)>1 and word not in STOP]

def init(db):
    db.execute('''CREATE TABLE IF NOT EXISTS documents(
        id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,
        content_hash TEXT NOT NULL UNIQUE,chunks TEXT NOT NULL)''')
    db.commit()

def ingest(db,title,content):
    if not isinstance(title,str) or not 1<=len(title.strip())<=100:
        raise ValidationError('El título debe contener de 1 a 100 caracteres.')
    if not isinstance(content,str) or not 20<=len(content.strip())<=40000:
        raise ValidationError('El documento debe contener de 20 a 40,000 caracteres.')
    title,content=title.strip(),content.strip()
    digest=hashlib.sha256((title+'\0'+content).encode()).hexdigest()
    chunks=[]
    for paragraph in re.split(r'\n\s*\n',content):
        words=paragraph.split()
        for start in range(0,len(words),65):
            fragment=' '.join(words[start:start+80])
            if fragment:
                chunks.append(fragment)
            if start+80>=len(words):
                break
    doc_id=digest[:16]
    with atomic(db):
        previous=db.execute('SELECT id FROM documents WHERE content_hash=?',(digest,)).fetchone()
        if previous:
            return {'id':previous[0],'replayed':True}
        if db.execute('SELECT COUNT(*) FROM documents').fetchone()[0]>=60:
            raise ValidationError('Esta demo permite hasta 60 documentos.',409)
        db.execute('INSERT INTO documents VALUES(?,?,?,?,?)',(doc_id,title,content,digest,json.dumps(chunks,ensure_ascii=False)))
    return {'id':doc_id,'replayed':False,'chunks':len(chunks)}

def documents(db):
    return [{'id':r[0],'title':r[1],'characters':r[2],'chunks':len(json.loads(r[3]))}
            for r in db.execute('SELECT id,title,length(content),chunks FROM documents ORDER BY title')]

def search(db,query):
    if not isinstance(query,str) or not 1<=len(query.strip())<=180:
        raise ValidationError('Escribe una consulta de 1 a 180 caracteres.')
    terms=set(tokens(query))
    corpus=[]
    for doc_id,title,chunks in db.execute('SELECT id,title,chunks FROM documents ORDER BY id'):
        for index,excerpt in enumerate(json.loads(chunks)):
            corpus.append({'document_id':doc_id,'title':title,'section':index+1,'excerpt':excerpt,'words':tokens(excerpt)})
    if not corpus or not terms:
        return {'query':query,'found':False,'citations':[],'message':'No se encontraron fragmentos relevantes en los documentos cargados.'}
    avg=sum(len(p['words']) for p in corpus)/len(corpus) or 1
    frequency={term:sum(term in p['words'] for p in corpus) for term in terms}
    results=[]
    for p in corpus:
        counts=collections.Counter(p['words']); matched=terms & counts.keys()
        coverage=len(matched)/len(terms)
        score=0.0
        for term in matched:
            tf=counts[term];df=frequency[term]
            idf=math.log(1+(len(corpus)-df+0.5)/(df+0.5))
            score+=idf*(tf*2.5)/(tf+1.5*(0.25+0.75*len(p['words'])/avg))
        if score>0 and coverage>=0.5:
            results.append({k:v for k,v in p.items() if k!='words'}|{'score':round(score,4),'coverage':round(coverage,3),'matched_terms':sorted(matched)})
    results.sort(key=lambda r:(-r['score'],r['document_id'],r['section']))
    return {'query':query,'found':bool(results),'citations':results[:3],
            'message':'Extractos de los documentos; no se generó una respuesta con IA.' if results else 'No hay evidencia suficiente para responder esta consulta.'}

def seed(db):
    with atomic(db):
        _seed_locked(db)

def _seed_locked(db):
    if db.execute('SELECT 1 FROM documents LIMIT 1').fetchone():
        return
    fixtures=[
        ('Guía de entregas','La entrega estándar tarda entre tres y cinco días hábiles a partir de la confirmación del pedido. El cliente puede consultar el seguimiento desde su cuenta.\n\nLas entregas urgentes están disponibles únicamente dentro de la zona de cobertura. Antes de comprar se muestra la fecha estimada de entrega.'),
        ('Cambios y devoluciones','Para solicitar una devolución, el cliente debe registrar el número de pedido y explicar el motivo desde el portal. El producto debe conservar sus accesorios.\n\nEl proceso de devolución genera una solicitud para revisión del equipo. El reembolso de muestra se registra únicamente después de aprobar la solicitud.'),
        ('Acceso a la cuenta','Para recuperar la contraseña, utiliza la opción de recuperación en el inicio de sesión. El enlace de recuperación vence después de treinta minutos.\n\nNunca compartas tu contraseña. El equipo de atención puede revisar un incidente de acceso, pero no solicitará contraseñas.'),
        ('Reservas de inventario','Cada pedido reserva inventario durante quince minutos. Si el pedido no se confirma dentro del plazo, la reserva vence y las unidades vuelven a estar disponibles.\n\nAl confirmar el pedido se descuentan las unidades del inventario. Repetir la misma solicitud con una clave de idempotencia no crea un segundo pedido.'),
        ('Métricas de campañas','El CPL se calcula dividiendo el gasto publicitario entre el número de leads atribuidos. El CPA utiliza el número de ventas atribuidas como denominador.\n\nEl ROAS se calcula dividiendo los ingresos atribuidos entre el gasto. Si el denominador es cero, la métrica se muestra como no disponible.'),
        ('Protocolo de incidentes','Tres fallos consecutivos del mismo servicio abren un incidente. El operador puede reconocerlo para indicar que está siendo atendido.\n\nDespués de dos señales saludables consecutivas se resuelve el incidente. Los eventos repetidos no alteran los contadores y los eventos antiguos no cambian el estado actual.')]
    for title,content in fixtures:
        ingest(db,title,content)
