"""ETL idempotente y métricas ponderadas. Sólo biblioteca estándar."""
import datetime as dt
import hashlib
import json
import sqlite3
import contextlib
import uuid

class ValidationError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

FIELDS = ('spend_cents', 'impressions', 'clicks', 'leads', 'sales', 'revenue_cents')

@contextlib.contextmanager
def atomic(db):
    """Reserva el escritor antes de leer; savepoints preservan transacciones anidadas."""
    nested = db.in_transaction
    savepoint = 'sp_' + uuid.uuid4().hex
    db.execute('SAVEPOINT ' + savepoint if nested else 'BEGIN IMMEDIATE')
    try:
        yield
        if nested:
            db.execute('RELEASE SAVEPOINT ' + savepoint)
        else:
            db.commit()
    except BaseException:
        if nested:
            db.execute('ROLLBACK TO SAVEPOINT ' + savepoint)
            db.execute('RELEASE SAVEPOINT ' + savepoint)
        else:
            db.rollback()
        raise

def init(db):
    db.execute('''CREATE TABLE IF NOT EXISTS campaign_daily(
        source TEXT NOT NULL,campaign TEXT NOT NULL,day TEXT NOT NULL,
        spend_cents INTEGER NOT NULL,impressions INTEGER NOT NULL,clicks INTEGER NOT NULL,
        leads INTEGER NOT NULL,sales INTEGER NOT NULL,revenue_cents INTEGER NOT NULL,
        payload_hash TEXT NOT NULL,PRIMARY KEY(source,campaign,day))''')
    db.commit()

def valid_day(value):
    if not isinstance(value, str) or len(value) != 10:
        raise ValidationError('Fecha inválida; usa AAAA-MM-DD.')
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ValidationError('Fecha inválida; usa AAAA-MM-DD.') from exc

def normalize(row):
    if not isinstance(row, dict):
        raise ValidationError('Cada fila debe ser un objeto.')
    result = {}
    for key in ('source', 'campaign'):
        value = row.get(key)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 100:
            raise ValidationError(f'{key}: texto de 1 a 100 caracteres.')
        result[key] = value.strip()
    result['day'] = valid_day(row.get('day'))
    for key in FIELDS:
        value = row.get(key)
        if type(value) is not int or not 0 <= value <= 1_000_000_000:
            raise ValidationError(f'{key}: entero no negativo, máximo 1,000,000,000.')
        result[key] = value
    result['payload_hash'] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    return result

def ingest(db, rows):
    if not isinstance(rows, list) or not 1 <= len(rows) <= 250:
        raise ValidationError('Importa entre 1 y 250 filas.')
    normalized = [normalize(row) for row in rows]
    inserted = duplicate = 0
    with atomic(db):
        for row in normalized:
            key = (row['source'], row['campaign'], row['day'])
            previous = db.execute('SELECT payload_hash FROM campaign_daily WHERE source=? AND campaign=? AND day=?', key).fetchone()
            if previous:
                if previous[0] != row['payload_hash']:
                    raise ValidationError('La misma campaña, fuente y fecha contiene valores diferentes; no se sobrescribió ningún registro.', 409)
                duplicate += 1
                continue
            columns = ['source', 'campaign', 'day', *FIELDS, 'payload_hash']
            db.execute('INSERT INTO campaign_daily VALUES(?,?,?,?,?,?,?,?,?,?)', [row[c] for c in columns])
            inserted += 1
    return {'inserted': inserted, 'duplicates': duplicate}

def metrics(row):
    ratio = lambda a, b: round(a / b, 4) if b else None
    return {**row, 'cpl_cents': ratio(row['spend_cents'], row['leads']),
            'cpa_cents': ratio(row['spend_cents'], row['sales']),
            'roas': ratio(row['revenue_cents'], row['spend_cents']),
            'ctr': ratio(row['clicks'], row['impressions']),
            'lead_conversion': ratio(row['leads'], row['clicks'])}

def summary(db, start=None, end=None):
    start = valid_day(start or '2000-01-01')
    end = valid_day(end or '2099-12-31')
    if start > end:
        raise ValidationError('La fecha inicial debe ser anterior a la final.')
    db.row_factory = sqlite3.Row
    sums = ','.join(f'SUM({field}) {field}' for field in FIELDS)
    groups = [dict(r) for r in db.execute(f'SELECT source,campaign,{sums} FROM campaign_daily WHERE day BETWEEN ? AND ? GROUP BY source,campaign ORDER BY source,campaign', (start, end))]
    days = [dict(r) for r in db.execute(f'SELECT day,{sums} FROM campaign_daily WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day', (start, end))]
    total = {f: sum(r[f] for r in groups) for f in FIELDS}
    return {'totals': metrics(total), 'campaigns': [metrics(r) for r in groups],
            'daily': [metrics(r) for r in days], 'start': start, 'end': end,
            'records': db.execute('SELECT COUNT(*) FROM campaign_daily WHERE day BETWEEN ? AND ?', (start,end)).fetchone()[0]}

def seed(db):
    with atomic(db):
        _seed_locked(db)

def _seed_locked(db):
    if db.execute('SELECT 1 FROM campaign_daily LIMIT 1').fetchone():
        return
    rows = []
    campaigns = [('Meta Ads','Prospección',37000,8200,180,18,2,300000),
                 ('Google Ads','Búsqueda de marca',28000,3200,230,27,5,650000),
                 ('Meta Ads','Remarketing',19000,4100,140,20,4,500000)]
    for day in range(1,15):
        for source,name,cost,imp,clicks,leads,sales,revenue in campaigns:
            k = day % 4
            rows.append(dict(source=source,campaign=name,day=f'2026-09-{day:02}',
                             spend_cents=cost+k*2000,impressions=imp+k*100,clicks=clicks+k*12,
                             leads=leads+k,sales=sales+(1 if k==3 else 0),revenue_cents=revenue+k*30000))
    ingest(db,rows)
