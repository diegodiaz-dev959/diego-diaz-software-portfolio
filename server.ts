import {createServer} from 'node:http';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {store} from './core/store.ts';
import {DomainError,fail,text} from './core/domain.ts';
import {crm} from './projects/01-drivedesk/domain.ts';
import {inventory} from './projects/02-stockflow/domain.ts';
import {operations,verifySignature} from './projects/05-signalops/domain.ts';

const ROOT=dirname(fileURLToPath(import.meta.url));
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function createApp(options:{databasePath?:string;quiet?:boolean}={}) {
  const databasePath=resolve(options.databasePath||process.env.PORTFOLIO_DB||resolve(ROOT,'data/portfolio.sqlite'));
  const db=store(databasePath),sales=crm(db),stock=inventory(db),ops=operations(db);
  const attempts=new Map<string,{count:number;until:number}>();
  let lastDemoSignal=0;
  async function python(project:string,action:string,data:unknown):Promise<any> {
    return new Promise((resolvePromise,reject)=>{
      const child=spawn(process.env.PORTFOLIO_PYTHON||(process.platform==='win32'?'python':'python3'),[resolve(ROOT,'python_worker.py'),'--db',databasePath,'--project',project,'--action',action],{stdio:['pipe','pipe','pipe']});
      let output='',error='',settled=false;
      const finish=(reason:any,result?:any)=>{if(settled)return;settled=true;clearTimeout(timer);reason?reject(reason):resolvePromise(result);};
      const timer=setTimeout(()=>{child.kill();finish(new DomainError(504,'El motor de datos tardó demasiado.'));},15000);
      child.stdout.on('data',(chunk)=>{output+=chunk;if(output.length>2000000){child.kill();finish(new DomainError(413,'La respuesta excedió el límite.'));}});
      child.stderr.on('data',(chunk)=>{error=(error+chunk).slice(-4000);});
      child.on('error',()=>finish(new DomainError(503,'Instala Python 3 y verifica que esté disponible en PATH.')));
      child.stdin.on('error',()=>{});
      child.on('close',(code)=>{if(settled)return;try{if(code!==0)throw Error('worker');const result=JSON.parse(output);if(!result.ok){if(result.status>=500&&!options.quiet)console.error(error);finish(new DomainError(result.status,result.error));}else finish(null,result.data);}catch{finish(new DomainError(500,'El motor de datos devolvió una respuesta inválida.'));}});
      child.stdin.end(JSON.stringify(data));
    });
  }
  async function rawBody(req:IncomingMessage):Promise<Buffer> {
    if(Number(req.headers['content-length']||0)>262144){req.resume();fail(413,'La solicitud supera 256 KB.');}
    const parts:Buffer[]=[];let size=0,over=false;
    for await(const part of req){size+=part.length;if(size>262144)over=true;else parts.push(part);}
    if(over)fail(413,'La solicitud supera 256 KB.');return Buffer.concat(parts);
  }
  async function body(req:IncomingMessage) {
    if(!(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Usa Content-Type application/json.');
    try{const data=JSON.parse((await rawBody(req)).toString());if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Se requiere un objeto JSON.');return data;}
    catch(error){if(error instanceof DomainError)throw error;fail(400,'JSON inválido.');}
  }
  function user(req:IncomingMessage):any {
    const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('portfolio_session='))?.slice(18);
    if(!token||!/^[a-f0-9]{64}$/.test(token))fail(401,'Inicia sesión para continuar.');
    const session=db.prepare('SELECT u.username,u.role FROM sessions s JOIN users u ON u.username=s.username WHERE s.hash=? AND s.expires_at>?').get(hash(token),Date.now());
    return session||fail(401,'Tu sesión venció. Vuelve a iniciar sesión.');
  }
  function operator(account:any){if(account.role!=='operator')fail(403,'Este usuario sólo tiene permiso de lectura.');}
  const server=createServer(async(req,res)=>{
    const requestId=randomUUID();
    res.setHeader('X-Request-Id',requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const send=(data:unknown,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
    try {
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))fail(403,'Host no permitido.');
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)fail(403,'Origen no permitido.');
      const url=new URL(req.url||'/','http://localhost'),path=url.pathname,method=req.method||'GET';
      if(path==='/api/auth/login'&&method==='POST') {
        const addr=req.socket.remoteAddress||'local',previous=attempts.get(addr);
        if(previous&&previous.until>Date.now()&&previous.count>=8)fail(429,'Demasiados intentos. Espera un minuto.');
        for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key);
        const data=await body(req),name=text(data.username,'Usuario',30),password=text(data.password,'Contraseña',150);
        const account=db.prepare('SELECT * FROM users WHERE username=?').get(name) as any;
        const computed=scryptSync(password,account?.salt||'dummy-salt-for-equal-work',64);
        const valid=account&&timingSafeEqual(computed,Buffer.from(account.hash,'hex'));
        if(!valid){attempts.set(addr,{count:previous&&previous.until>Date.now()?previous.count+1:1,until:Date.now()+60000});fail(401,'Usuario o contraseña incorrectos.');}
        attempts.delete(addr);db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
        const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),name,Date.now()+8*3600000);
        res.setHeader('Set-Cookie',`portfolio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
        return send({username:name,role:account.role});
      }
      if(path==='/api/ops/webhook'&&method==='POST') {
        const raw=await rawBody(req);verifySignature(raw,String(req.headers['x-signature']||''),String(req.headers['x-timestamp']||''),process.env.PORTFOLIO_WEBHOOK_SECRET||'local-demo-secret-change-me');
        let data;try{data=JSON.parse(raw.toString());}catch{fail(400,'JSON inválido.');}
        if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Se requiere un objeto JSON.');return send(ops.signal(data));
      }
      if(path.startsWith('/api/')) {
        const account=user(req);
        if(path==='/api/me'&&method==='GET')return send(account);
        if(path==='/api/auth/logout'&&method==='POST') {
          const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('portfolio_session='))?.slice(18)||'';
          db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(token));res.setHeader('Set-Cookie','portfolio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send({ok:true});
        }
        if(path==='/api/crm'&&method==='GET')return send(sales.list((url.searchParams.get('search')||'').slice(0,100)));
        if(path==='/api/stock'&&method==='GET')return send(stock.list());
        if(path==='/api/ops'&&method==='GET')return send(ops.list());
        if(path==='/api/campaigns'&&method==='GET')return send(await python('campaigns','summary',{start:url.searchParams.get('start')||undefined,end:url.searchParams.get('end')||undefined}));
        if(path==='/api/evidence'&&method==='GET')return send(await python('evidence','list',{}));
        if(path==='/api/evidence/search'&&method==='POST')return send(await python('evidence','search',await body(req)));
        operator(account);
        if(path==='/api/crm/leads'&&method==='POST')return send(sales.create(await body(req)),201);
        const transition=path.match(/^\/api\/crm\/leads\/([^/]+)\/transition$/);
        if(transition&&method==='POST'){const data=await body(req);return send(sales.transition(transition[1],data.stage,data.revision));}
        const appointment=path.match(/^\/api\/crm\/leads\/([^/]+)\/appointments$/);
        if(appointment&&method==='POST'){const data=await body(req);return send(sales.appointment(appointment[1],data.starts_at,data.note),201);}
        if(path==='/api/stock/reserve'&&method==='POST'){const data=await body(req);return send(stock.reserve(data.product_id,data.quantity,data.request_key),201);}
        const order=path.match(/^\/api\/stock\/orders\/([^/]+)\/(confirm|cancel)$/);
        if(order&&method==='POST')return send(stock.change(order[1],order[2] as 'confirm'|'cancel'));
        if(path==='/api/campaigns/import'&&method==='POST')return send(await python('campaigns','import',await body(req)),201);
        if(path==='/api/evidence/import'&&method==='POST')return send(await python('evidence','import',await body(req)),201);
        if(path==='/api/ops/probe'&&method==='POST') {
          const data=await body(req);if(typeof data.healthy!=='boolean')fail(400,'Estado inválido.');
          lastDemoSignal=Math.max(Date.now(),lastDemoSignal+1);return send(ops.signal({id:randomUUID(),service_id:data.service_id,healthy:data.healthy,created_at:lastDemoSignal}));
        }
        const ack=path.match(/^\/api\/ops\/incidents\/([^/]+)\/acknowledge$/);if(ack&&method==='POST')return send(ops.acknowledge(ack[1]));
        fail(404,'Ruta de API no encontrada.');
      }
      const files:Record<string,[string,string]>={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
      if(method!=='GET'||!files[path])fail(404,'Página no encontrada.');
      res.setHeader('Content-Type',`${files[path][1]}; charset=utf-8`);res.setHeader('Cache-Control','no-cache');res.end(readFileSync(resolve(ROOT,'web',files[path][0])));
    }catch(error){const known=error instanceof DomainError,status=known?error.status:500;if(!known&&!options.quiet)console.error({requestId,error});send({error:known?error.message:'No se pudo completar la operación.',request_id:requestId},status);}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  server.on('close',()=>db.close());
  return {server,db};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORTFOLIO_PORT||8080),{server}=createApp();
  server.listen(port,'127.0.0.1',()=>console.log(`Portafolio listo: http://localhost:${port}\nConsulta README.md para el acceso de muestra.`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
