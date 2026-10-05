import {createHmac,randomUUID} from 'node:crypto';
const service=process.argv[2]||'api',state=process.argv[3]||'fail';
if(!['api','checkout','worker'].includes(service)||!['ok','fail'].includes(state)) {
  console.error('Uso: node tools/send-signal.ts api|checkout|worker ok|fail');process.exit(1);
}
const port=Number(process.env.PORTFOLIO_PORT||8080),timestamp=String(Date.now());
const payload=JSON.stringify({id:randomUUID(),service_id:service,healthy:state==='ok',created_at:Number(timestamp)});
const signature=createHmac('sha256',process.env.PORTFOLIO_WEBHOOK_SECRET||'local-demo-secret-change-me').update(`${timestamp}.${payload}`).digest('hex');
try {
  const response=await fetch(`http://127.0.0.1:${port}/api/ops/webhook`,{method:'POST',headers:{'Content-Type':'application/json','X-Timestamp':timestamp,'X-Signature':signature},body:payload});
  console.log(response.status,await response.json());if(!response.ok)process.exitCode=1;
}catch{console.error('No se pudo conectar. Inicia el servidor local y verifica el puerto.');process.exitCode=1;}
