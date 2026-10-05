import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {text, integer, fail, tx, audit} from '../../core/domain.ts';
type LeadInput = {name: unknown; email: unknown; source: unknown; value_cents: unknown};
const transitions: Record<string,string[]> = {new:['contacted','lost'],contacted:['meeting','lost'],meeting:['won','lost'],won:[],lost:['new']};
export function crm(db: DatabaseSync, clock = Date.now) {
  function get(id: string): any { return db.prepare('SELECT * FROM leads WHERE id=?').get(id) || fail(404,'Contacto no encontrado.'); }
  return {
    list(search='') {
      const rows = db.prepare('SELECT * FROM leads WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200').all(`%${search}%`,`%${search}%`);
      const counts = db.prepare('SELECT stage,COUNT(*) count,SUM(value_cents) value FROM leads GROUP BY stage').all();
      return {leads: rows,counts,appointments:db.prepare('SELECT a.*,l.name FROM appointments a JOIN leads l ON l.id=a.lead_id ORDER BY starts_at LIMIT 100').all(),audit:db.prepare("SELECT * FROM audit WHERE project='crm' ORDER BY id DESC LIMIT 10").all(),transitions};
    },
    create(input: LeadInput) {
      const name=text(input.name,'Nombre',80), email=text(input.email,'Correo',150).toLowerCase(), source=text(input.source,'Origen',60), value=integer(input.value_cents,'Valor en centavos',0,1000000000);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Correo inválido.');
      return tx(db,()=>{const id=randomUUID();db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?)').run(id,name,email,source,'new',value,1,clock());audit(db,'crm',id,'created',{name,source},clock());return get(id);});
    },
    transition(id: string, stage: unknown, revision: unknown) {
      const target=text(stage,'Etapa',20), expected=integer(revision,'Revisión',1);
      return tx(db,()=>{const lead=get(id);if(lead.revision!==expected)fail(409,'Otro usuario modificó este contacto. Actualiza la vista.');
        if(!transitions[lead.stage].includes(target))fail(409,'La transición de etapa no está permitida.');
        db.prepare('UPDATE leads SET stage=?,revision=revision+1 WHERE id=?').run(target,id);audit(db,'crm',id,'stage_changed',{from:lead.stage,to:target},clock());return get(id);});
    },
    appointment(id: string, starts: unknown, note: unknown) {
      const time=Date.parse(text(starts,'Fecha',40)), description=text(note,'Motivo',250);
      if(!Number.isFinite(time)||time<=clock()||time>clock()+365*86400000)fail(400,'Agenda una fecha futura dentro de los siguientes 12 meses.');
      return tx(db,()=>{const lead=get(id);if(['won','lost'].includes(lead.stage))fail(409,'No se puede agendar una oportunidad cerrada.');
        if(db.prepare('SELECT 1 FROM appointments WHERE starts_at=?').get(time))fail(409,'Ese horario ya está reservado.');
        const aid=randomUUID();db.prepare('INSERT INTO appointments VALUES(?,?,?,?)').run(aid,id,time,description);audit(db,'crm',id,'appointment_scheduled',{starts_at:time},clock());return {id:aid,lead_id:id,starts_at:time,note:description};});
    }
  };
}
