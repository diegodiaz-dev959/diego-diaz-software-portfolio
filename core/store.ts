import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function store(path: string, seed = true) {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true});
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('operator','viewer')));
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,project TEXT NOT NULL,entity TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_project ON audit(project,created_at);
    CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,source TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN ('new','contacted','meeting','won','lost')),value_cents INTEGER NOT NULL CHECK(value_cents>=0),revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS appointments(id TEXT PRIMARY KEY,lead_id TEXT NOT NULL REFERENCES leads(id),starts_at INTEGER NOT NULL,note TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,price_cents INTEGER NOT NULL CHECK(price_cents>0),stock INTEGER NOT NULL CHECK(stock>=0),reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=stock));
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL CHECK(quantity>0),total_cents INTEGER NOT NULL CHECK(total_cents>0),state TEXT NOT NULL CHECK(state IN ('reserved','confirmed','cancelled','expired')),request_key TEXT NOT NULL UNIQUE,payload_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_ledger(id INTEGER PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),order_id TEXT NOT NULL REFERENCES orders(id),stock_delta INTEGER NOT NULL,reserved_delta INTEGER NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,name TEXT NOT NULL,failure_streak INTEGER NOT NULL DEFAULT 0,success_streak INTEGER NOT NULL DEFAULT 0,last_at INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'healthy');
    CREATE TABLE IF NOT EXISTS signals(id TEXT PRIMARY KEY,service_id TEXT NOT NULL REFERENCES services(id),healthy INTEGER NOT NULL CHECK(healthy IN (0,1)),created_at INTEGER NOT NULL,payload_hash TEXT NOT NULL,ignored INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS incidents(id TEXT PRIMARY KEY,service_id TEXT NOT NULL REFERENCES services(id),state TEXT NOT NULL CHECK(state IN ('open','acknowledged','resolved')),opened_at INTEGER NOT NULL,ack_at INTEGER,resolved_at INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_incident ON incidents(service_id) WHERE state!='resolved';`);
  if (seed) seedData(db);
  return db;
}
function seedData(db: DatabaseSync) {
  for (const [username, role, password] of [['demo','operator',process.env.PORTFOLIO_DEMO_PASSWORD || 'Demo-2026!'],['lector','viewer',process.env.PORTFOLIO_VIEWER_PASSWORD || 'Lectura-2026!']]) {
    if (!db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) {
      const salt = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(username,salt,scryptSync(password,salt,64).toString('hex'),role);
    }
  }
  if (!db.prepare('SELECT 1 FROM leads LIMIT 1').get()) {
    const names = ['Mariana Torres','Carlos Rivera','Fernanda Soto','Luis Mendoza','Ana Ortega','Mateo Flores','Valeria Cruz','Pablo Reyes','Camila Vega','Andrés Luna','Sofía Ramos','Daniel Ortiz'];
    const stages = ['new','new','new','contacted','contacted','contacted','meeting','meeting','meeting','won','won','lost'];
    names.forEach((name,i)=>db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?)').run(`lead-${i+1}`,name,`contacto${i+1}@example.com`,['Meta Ads','Google Ads','Referido'][i%3],stages[i],(280000+i*12000)*100,1,Date.now()-i*86400000));
  }
  if (!db.prepare('SELECT 1 FROM products LIMIT 1').get()) {
    [['p1','Teclado mecánico','Periféricos',129900,12],['p2','Mouse inalámbrico','Periféricos',89900,8],['p3','Monitor de 27 pulgadas','Pantallas',499900,4],['p4','Audífonos de estudio','Audio',159900,10],['p5','SSD de 1 TB','Almacenamiento',119900,7],['p6','Hub USB-C','Accesorios',64900,3]].forEach(p=>db.prepare('INSERT INTO products(id,name,category,price_cents,stock) VALUES(?,?,?,?,?)').run(...p));
  }
  if (!db.prepare('SELECT 1 FROM services LIMIT 1').get()) {
    [['api','API de ventas'],['checkout','Proceso de compra'],['worker','Procesador de tareas']].forEach(p=>db.prepare('INSERT INTO services(id,name) VALUES(?,?)').run(...p));
  }
}
