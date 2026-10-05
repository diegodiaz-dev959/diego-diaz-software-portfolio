import type {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {text,integer,fail,tx,audit} from '../../core/domain.ts';
export function verifySignature(raw:Buffer,signature:string,timestamp:string,secret:string,now=Date.now()) {
  if(!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>300000)fail(401,'Firma vencida o fecha inválida.');
  if(!/^[a-f0-9]{64}$/.test(signature))fail(401,'Firma inválida.');
  const expected=createHmac('sha256',secret).update(`${timestamp}.`).update(raw).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))fail(401,'Firma inválida.');
}
export function operations(db:DatabaseSync,clock=Date.now) {
  return {
    list() {return {services:db.prepare('SELECT * FROM services ORDER BY id').all(),incidents:db.prepare('SELECT i.*,s.name service_name FROM incidents i JOIN services s ON s.id=i.service_id ORDER BY opened_at DESC LIMIT 100').all(),signals:db.prepare('SELECT * FROM signals ORDER BY created_at DESC LIMIT 60').all(),audit:db.prepare("SELECT * FROM audit WHERE project='ops' ORDER BY id DESC LIMIT 10").all()};},
    signal(input:{id:unknown;service_id:unknown;healthy:unknown;created_at:unknown}) {
      const id=text(input.id,'Evento',100),sid=text(input.service_id,'Servicio',60),time=integer(input.created_at,'Fecha',0,Number.MAX_SAFE_INTEGER);
      if(typeof input.healthy!=='boolean')fail(400,'El estado debe ser verdadero o falso.');
      if(Math.abs(clock()-time)>300000)fail(400,'El evento debe pertenecer a los últimos cinco minutos.');
      const healthy=input.healthy,hash=createHash('sha256').update(JSON.stringify([sid,healthy,time])).digest('hex');
      return tx(db,()=>{const old=db.prepare('SELECT * FROM signals WHERE id=?').get(id) as any;if(old){if(old.payload_hash!==hash)fail(409,'El evento repetido contiene datos diferentes.');return {replayed:true,ignored:!!old.ignored};}
        const service=db.prepare('SELECT * FROM services WHERE id=?').get(sid) as any;if(!service)fail(404,'Servicio no encontrado.');
        const ignored=time<=service.last_at;db.prepare('INSERT INTO signals VALUES(?,?,?,?,?,?)').run(id,sid,healthy?1:0,time,hash,ignored?1:0);
        if(ignored)return {ignored:true};
        const failures=healthy?0:service.failure_streak+1,successes=healthy?service.success_streak+1:0;
        let status=healthy?'healthy':(failures>=3?'down':'degraded');
        const active=db.prepare("SELECT * FROM incidents WHERE service_id=? AND state!='resolved'").get(sid) as any;
        if(!healthy&&failures>=3&&!active){const incident=randomUUID();db.prepare('INSERT INTO incidents VALUES(?,?,?, ?,NULL,NULL)').run(incident,sid,'open',time);audit(db,'ops',incident,'incident_opened',{service:sid},clock());}
        if(active&&healthy&&successes<2)status='recovering';
        if(active&&healthy&&successes>=2){db.prepare("UPDATE incidents SET state='resolved',resolved_at=? WHERE id=?").run(time,active.id);audit(db,'ops',active.id,'incident_resolved',{service:sid},clock());}
        db.prepare('UPDATE services SET failure_streak=?,success_streak=?,last_at=?,status=? WHERE id=?').run(failures,successes,time,status,sid);
        return {ignored:false,status,failure_streak:failures,success_streak:successes};});
    },
    acknowledge(id:string) {return tx(db,()=>{const incident=db.prepare('SELECT * FROM incidents WHERE id=?').get(id) as any;if(!incident)fail(404,'Incidente no encontrado.');if(incident.state==='resolved')fail(409,'El incidente ya está resuelto.');if(incident.state==='open'){db.prepare("UPDATE incidents SET state='acknowledged',ack_at=? WHERE id=?").run(clock(),id);audit(db,'ops',id,'incident_acknowledged',{},clock());}return db.prepare('SELECT * FROM incidents WHERE id=?').get(id);});}
  };
}
