// UI sin dependencias: nodos de texto, estados de carga y formularios accesibles.
const root=document.querySelector('#app');
const config=[
  {id:'crm',n:'01',name:'DriveDesk',label:'CRM de ventas',desc:'Contactos, oportunidades y citas en un pipeline con historial de cambios.',stack:['TypeScript','Node.js','SQLite'],proof:'Control de concurrencia y reglas de transición.'},
  {id:'stock',n:'02',name:'StockFlow',label:'Inventario y pedidos',desc:'Reservas temporales, confirmación de pedidos e inventario transaccional.',stack:['TypeScript','Transacciones','Idempotencia'],proof:'Sin sobreventa ni pedidos duplicados.'},
  {id:'campaigns',n:'03',name:'CampaignLab',label:'Analítica de campañas',desc:'Importación de datos, validación y métricas de adquisición ponderadas.',stack:['Python','ETL','SQLite'],proof:'CPL, CPA y ROAS calculados sobre totales.'},
  {id:'evidence',n:'04',name:'EvidenceDesk',label:'Búsqueda documental',desc:'Consulta documentos y revisa los extractos que respaldan cada resultado.',stack:['Python','BM25','Fuentes'],proof:'Búsqueda local con citas y abstención.'},
  {id:'ops',n:'05',name:'SignalOps',label:'Gestión de incidentes',desc:'Recibe señales firmadas y sigue el ciclo de atención de incidentes.',stack:['TypeScript','HMAC','Auditoría'],proof:'Deduplicación, orden temporal y recuperación.'}
];
let current=location.hash.slice(1)||'home',account=null,data=null,loading=false,queryResults=null,range={start:'2026-09-01',end:'2026-09-14'},serial=0;
if(!['home',...config.map(p=>p.id)].includes(current))current='home';
const names={new:'Nuevo',contacted:'Contactado',meeting:'Cita',won:'Ganado',lost:'Perdido',reserved:'Reservado',confirmed:'Confirmado',cancelled:'Cancelado',expired:'Vencido',healthy:'Saludable',degraded:'Degradado',down:'Caído',recovering:'Recuperando',open:'Abierto',acknowledged:'En atención',resolved:'Resuelto'};
const money=cents=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(cents/100);
const number=n=>new Intl.NumberFormat('es-MX').format(n);
const date=t=>new Date(t).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'});
const canWrite=()=>account?.role==='operator';

function h(tag,attrs={},...children){
  const el=document.createElement(tag);
  for(const child of children.flat(Infinity))if(child!==null&&child!==undefined&&child!==false)el.append(child instanceof Node?child:document.createTextNode(String(child)));
  for(const [key,value] of Object.entries(attrs)){
    if(key.startsWith('on'))el.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='value')el.value=value;
    else if(value!==false&&value!==null&&value!==undefined)el.setAttribute(key,value===true?'':value);
  }
  return el;
}
const badge=(value,extra='')=>h('span',{class:`badge status-${value} ${extra}`},names[value]||value);
const field=(title,input)=>h('label',{},title,input);
const options=(rows,value,attrs={})=>h('select',{...attrs,value},rows.map(([id,label])=>h('option',{value:id},label)));
const button=(label,fn,attrs={})=>h('button',{type:'button',onclick:fn,...attrs},label);
function toast(message){const el=document.querySelector('#toast');el.textContent=message;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.textContent='',6000);}
async function api(path,method='GET',payload){
  const response=await fetch(path,{method,credentials:'same-origin',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
  const result=await response.json();
  if(!response.ok){if(response.status===401&&account){account=null;render();}throw new Error(result.error||'No se pudo completar la operación.');}return result;
}
async function mutate(path,payload,label,control){
  if(control)control.disabled=true;
  try{await api(path,'POST',payload);toast(label);await load();}
  catch(error){toast(error.message);}
  finally{if(control&&canWrite())control.disabled=false;}
}
function navigate(view){location.hash=view;}
window.addEventListener('hashchange',()=>{current=location.hash.slice(1)||'home';if(!['home',...config.map(p=>p.id)].includes(current))current='home';load();});
async function load(){
  const ticket=++serial,view=current;data=null;loading=view!=='home';render();
  if(!account||view==='home')return;
  try{const path=view==='campaigns'?`/api/campaigns?start=${range.start}&end=${range.end}`:`/api/${view}`;const result=await api(path);if(ticket===serial)data=result;}
  catch(error){toast(error.message);}
  finally{if(ticket===serial){loading=false;render();}}
}
function metric(label,value,note='',accent=false){return h('div',{class:`metric ${accent?'accent':''}`},h('label',{},label),h('strong',{},value),h('small',{},note));}
function panel(title,subtitle,body,actions){return h('section',{class:'panel'},h('div',{class:'panelhead'},h('div',{},h('h2',{},title),h('p',{class:'hint'},subtitle)),actions||null),body);}
function table(headers,rows){return h('div',{class:'tablewrap'},h('table',{},h('thead',{},h('tr',{},headers.map(v=>h('th',{},v)))),h('tbody',{},rows.length?rows.map(row=>h('tr',{},row.map(value=>h('td',{},value)))):h('tr',{},h('td',{colspan:headers.length,class:'empty'},'Todavía no hay registros.')))));}
function auditList(rows){
  const labels={created:'Contacto creado',stage_changed:'Etapa actualizada',appointment_scheduled:'Cita agendada',reserved:'Reserva creada',confirmed:'Pedido confirmado',cancelled:'Pedido cancelado',expired:'Reserva vencida',incident_opened:'Incidente abierto',incident_acknowledged:'Incidente reconocido',incident_resolved:'Incidente resuelto'};
  return rows.length?rows.map(row=>h('div',{class:'audit'},h('strong',{},labels[row.action]||row.action),h('small',{},date(row.created_at)))):h('p',{class:'empty'},'Las próximas acciones aparecerán aquí.');
}
function hero(project){return h('header',{class:'hero'},h('div',{},h('div',{class:'eyebrow'},`PROYECTO ${project.n} / ${project.label}`),h('h1',{},project.name),h('p',{},project.desc)),h('div',{class:'split-info'},badge('Demo local'),account&&!canWrite()?h('span',{class:'read-only'},'Sólo lectura'):null));}

function home(){
  return [h('header',{class:'hero'},h('div',{},h('div',{class:'eyebrow'},'PORTAFOLIO DE INGENIERÍA DE SOFTWARE'),h('h1',{},'Cinco ideas. Código que funciona.'),h('p',{},'Aplicaciones de muestra para explorar decisiones de negocio, arquitectura y calidad.')),badge('BUILD 01')),
    h('div',{class:'metrics'},metric('Proyectos funcionales','05','Cinco dominios distintos',true),metric('Lenguajes del backend','02','TypeScript y Python'),metric('Persistencia','SQLite','Datos guardados localmente'),metric('Servicios externos','00','Sin claves ni pagos requeridos')),
    h('div',{class:'project-grid'},config.map(project=>h('article',{class:'project-card'},h('div',{class:'label'},`${project.n} / ${project.label.toUpperCase()}`),h('h2',{},project.name),h('p',{},project.desc),h('div',{class:'tagrow'},project.stack.map(value=>badge(value))),button('Abrir proyecto →',()=>navigate(project.id))))),
    h('div',{class:'strip'},h('div',{},h('strong',{},'Una demo también debe explicar sus límites.'),h('p',{},'Datos de muestra, operaciones locales y comportamiento comprobable. Los README incluyen decisiones, pruebas y siguientes pasos.')),h('span',{class:'badge dark'},'Código + documentación')),
    h('p',{class:'stacknote'},'Portafolio preparado para Diego Díaz · Puedes personalizarlo y publicar el código en tu propia cuenta de GitHub.')];
}

function crmView(){
  const total=data.counts.reduce((a,r)=>a+r.count,0),won=data.counts.find(r=>r.stage==='won')||{count:0,value:0},meetings=data.counts.find(r=>r.stage==='meeting')?.count||0;
  const lanes=Object.keys(names).slice(0,5).map(stage=>{
    const leads=data.leads.filter(l=>l.stage===stage);
    return h('div',{class:`lane ${stage}`},h('div',{class:'lanehead'},names[stage],h('span',{class:'count'},leads.length)),leads.map(lead=>{
      const select=options([['','Mover a…'],...data.transitions[stage].map(s=>[s,names[s]])],'',{disabled:!canWrite(),'aria-label':`Cambiar etapa de ${lead.name}`});
      select.addEventListener('change',()=>{if(select.value)mutate(`/api/crm/leads/${lead.id}/transition`,{stage:select.value,revision:lead.revision},'Etapa actualizada.',select);});
      return h('article',{class:'lead'},badge(lead.source),h('strong',{},lead.name),h('small',{},lead.email),h('div',{class:'value'},money(lead.value_cents)),h('small',{},`Revisión ${lead.revision}`),data.transitions[stage].length?select:null);
    }));
  });
  const form=h('form',{class:'form'}),name=h('input',{required:true,maxlength:80,placeholder:'Nombre del contacto'}),email=h('input',{type:'email',required:true,maxlength:150,placeholder:'contacto@example.com'}),source=options([['Meta Ads','Meta Ads'],['Google Ads','Google Ads'],['Referido','Referido'],['Sitio web','Sitio web']],'Meta Ads'),value=h('input',{type:'number',required:true,min:0,max:10000000,step:1,value:350000}),submit=h('button',{type:'submit',disabled:!canWrite()},'Crear contacto');
  form.append(field('Nombre',name),field('Correo',email),h('div',{class:'fieldrow'},field('Origen',source),field('Valor de la oportunidad (MXN)',value)),submit);
  form.addEventListener('submit',event=>{event.preventDefault();mutate('/api/crm/leads',{name:name.value,email:email.value,source:source.value,value_cents:Math.round(Number(value.value)*100)},'Contacto creado.',submit);});
  const appointmentForm=h('form',{class:'form'}),lead=options(data.leads.filter(l=>!['won','lost'].includes(l.stage)).map(l=>[l.id,l.name]),''),starts=h('input',{type:'datetime-local',required:true}),note=h('input',{required:true,maxlength:250,value:'Demostración y revisión de necesidades'}),schedule=h('button',{type:'submit',disabled:!canWrite()},'Agendar cita');
  const tomorrow=new Date(Date.now()+86400000);starts.value=new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,16);
  appointmentForm.append(field('Contacto',lead),field('Fecha y hora local',starts),field('Motivo',note),schedule);
  appointmentForm.addEventListener('submit',event=>{event.preventDefault();mutate(`/api/crm/leads/${lead.value}/appointments`,{starts_at:new Date(starts.value).toISOString(),note:note.value},'Cita agendada.',schedule);});
  return [h('div',{class:'metrics'},metric('Contactos en el CRM',total,'Pipeline completo',true),metric('Oportunidades con cita',meetings,'Etapa actual'),metric('Conversión a venta',`${total?Math.round(won.count/total*100):0}%`,'Ganados / contactos'),metric('Valor ganado',money(won.value||0),'Oportunidades cerradas')),
    panel('Pipeline de oportunidades','Cada cambio respeta las etapas permitidas y la revisión del registro.',h('div',{class:'kanban'},lanes)),
    h('div',{class:'grid2'},panel('Nuevo contacto','Guarda una oportunidad de muestra.',form),panel('Agenda una cita','El horario no puede estar ocupado.',appointmentForm)),
    h('div',{class:'grid2'},panel('Próximas citas','Fecha y hora en tu zona local.',table(['Contacto','Fecha','Motivo'],data.appointments.map(a=>[a.name,date(a.starts_at),a.note]))),panel('Actividad reciente','Historial de cambios del CRM.',auditList(data.audit)))];
}

function stockView(){
  const reserved=data.products.reduce((a,p)=>a+p.reserved,0),available=data.products.reduce((a,p)=>a+p.available,0),confirmed=data.orders.filter(o=>o.state==='confirmed');
  const cards=data.products.map((product,i)=>{
    const qty=h('input',{type:'number',min:1,max:100,step:1,value:1,'aria-label':`Cantidad de ${product.name}`});let requestKey=crypto.randomUUID(),lastQuantity=1;
    const reserve=button('Reservar',async()=>{const quantity=Number(qty.value);if(quantity!==lastQuantity){requestKey=crypto.randomUUID();lastQuantity=quantity;}reserve.disabled=true;try{await api('/api/stock/reserve','POST',{product_id:product.id,quantity,request_key:requestKey});requestKey=crypto.randomUUID();toast('Pedido reservado durante 15 minutos.');await load();}catch(error){toast(error.message);}finally{if(canWrite())reserve.disabled=false;}},{class:'small',disabled:!canWrite()||product.available===0});
    return h('article',{class:'product'},h('div',{class:'product-icon'},['⌨','◈','▣','♫','▤','⊞'][i%6]),badge(product.category),h('strong',{},product.name),h('div',{class:'price'},money(product.price_cents)),h('small',{class:'hint'},`${product.available} disponibles · ${product.reserved} reservados`),h('div',{class:'buy'},qty,reserve));
  });
  const rows=data.orders.map(order=>{
    const confirm=button('Confirmar',()=>mutate(`/api/stock/orders/${order.id}/confirm`,{},'Pedido confirmado.',confirm),{class:'small',disabled:!canWrite()});
    const cancel=button('Cancelar',()=>mutate(`/api/stock/orders/${order.id}/cancel`,{},'Reserva liberada.',cancel),{class:'small secondary',disabled:!canWrite()});
    return [order.id.slice(0,8),order.product_name,order.quantity,money(order.total_cents),badge(order.state),order.state==='reserved'?h('div',{class:'toolbar'},confirm,cancel):h('small',{class:'hint'},date(order.created_at))];
  });
  return [h('div',{class:'metrics'},metric('Unidades disponibles',available,'Stock menos reservas',true),metric('Unidades reservadas',reserved,'Reservas de 15 minutos'),metric('Pedidos confirmados',confirmed.length,'Movimientos aplicados'),metric('Ventas de muestra',money(confirmed.reduce((a,o)=>a+o.total_cents,0)),'Sin cobros reales')),
    panel('Catálogo de muestra','Precios ilustrativos en MXN. La confirmación descuenta el inventario.',h('div',{class:'productgrid'},cards)),
    panel('Pedidos y reservas','Las reservas vencidas se liberan al consultar o ejecutar una operación.',table(['Pedido','Producto','Unidades','Total','Estado','Acciones'],rows)),
    panel('Movimientos de inventario','Cada reserva, liberación y venta deja un registro.',table(['Movimiento','Producto','Cambio de stock','Cambio de reserva','Fecha'],data.ledger.map(row=>[names[row.reason]||row.reason,row.product_id,row.stock_delta,row.reserved_delta,date(row.created_at)])))];
}

function chart(rows){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 760 215');svg.setAttribute('class','chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Ingresos atribuidos por día, en pesos mexicanos');
  const make=(tag,attrs,value)=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(value!==undefined)el.textContent=value;svg.append(el);return el;};
  if(!rows.length){make('text',{x:310,y:110,fill:'#829471','font-size':13},'Sin datos en este periodo');return svg;}
  const max=Math.max(...rows.map(r=>r.revenue_cents),1)*1.15,x=i=>72+i*(650/Math.max(rows.length-1,1)),y=v=>175-v/max*145;
  for(let i=0;i<4;i++){const v=max*i/3;make('line',{x1:65,y1:y(v),x2:732,y2:y(v),stroke:'#e8eddf','stroke-dasharray':'3 5'});make('text',{x:0,y:y(v)+4,fill:'#8a9682','font-size':10},money(v));}
  const points=rows.map((r,i)=>`${x(i)},${y(r.revenue_cents)}`).join(' ');
  make('polygon',{points:`${x(0)},175 ${points} ${x(rows.length-1)},175`,fill:'#e9f0dd'});make('polyline',{points,fill:'none',stroke:'#71964d','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'});
  rows.forEach((r,i)=>{make('circle',{cx:x(i),cy:y(r.revenue_cents),r:3.5,fill:'#71964d'});if(i===0||i===rows.length-1||i%3===0)make('text',{x:x(i)-17,y:202,fill:'#87947d','font-size':10},r.day.slice(5));});return svg;
}
function campaignView(){
  const total=data.totals,start=h('input',{type:'date',required:true,value:range.start}),end=h('input',{type:'date',required:true,value:range.end}),filter=h('form',{class:'filterform'},field('Desde',start),field('Hasta',end),h('button',{type:'submit',class:'small secondary'},'Filtrar'));
  filter.addEventListener('submit',event=>{event.preventDefault();range={start:start.value,end:end.value};load();});
  const importBox=h('textarea',{rows:6,required:true,'aria-label':'Filas de campaña en JSON',value:JSON.stringify([{source:'Meta Ads',campaign:'Nueva campaña',day:'2026-09-15',spend_cents:15000,impressions:1800,clicks:70,leads:8,sales:1,revenue_cents:120000}],null,2)}),form=h('form',{class:'form'}),submit=h('button',{type:'submit',disabled:!canWrite()},'Importar datos');
  form.append(field('Arreglo de filas en JSON',importBox),submit,h('p',{class:'note'},'El gasto y los ingresos se expresan en centavos. La misma fuente, campaña y fecha no se importa dos veces. Si cambia su contenido, el lote se rechaza.'));
  form.addEventListener('submit',event=>{event.preventDefault();try{const rows=JSON.parse(importBox.value);mutate('/api/campaigns/import',{rows},'Lote procesado. Revisa el periodo seleccionado.',submit);}catch{toast('Revisa el formato JSON antes de importar.');}});
  return [h('div',{class:'metrics'},metric('Inversión publicitaria',money(total.spend_cents),'Suma del periodo',true),metric('Leads atribuidos',number(total.leads),`${number(total.sales)} ventas atribuidas`),metric('Costo por lead',total.cpl_cents===null?'—':money(total.cpl_cents),'Gasto total / leads totales'),metric('ROAS',total.roas===null?'—':`${total.roas.toFixed(2)}×`,'Ingresos atribuidos / gasto')),
    panel('Ingresos atribuidos por día','Todos los importes corresponden a datos de muestra.',h('div',{},chart(data.daily),h('div',{class:'legend'},h('span',{}),'Ingresos atribuidos · MXN')),filter),
    panel('Rendimiento por campaña',`${data.records} registros incluidos. Los indicadores globales se calculan a partir de totales.`,table(['Fuente','Campaña','Inversión','Leads','Ventas','CPL','CPA','ROAS'],data.campaigns.map(row=>[row.source,row.campaign,money(row.spend_cents),row.leads,row.sales,row.cpl_cents===null?'—':money(row.cpl_cents),row.cpa_cents===null?'—':money(row.cpa_cents),row.roas===null?'—':`${row.roas.toFixed(2)}×`]))),
    panel('Importar un lote','Validación completa antes de guardar. Si una fila falla, no se guarda ninguna.',form)];
}

function evidenceView(){
  const query=h('input',{required:true,maxlength:180,placeholder:'Ejemplo: ¿Cuánto tarda la entrega?',value:queryResults?.query||'¿Cuánto tarda la entrega?','aria-label':'Pregunta para buscar en documentos'}),search=h('button',{type:'submit'},'Buscar fuentes'),form=h('form',{class:'searchbox'},query,search),results=h('div',{class:'searchresults'});
  function display(){results.replaceChildren();if(!queryResults){results.append(h('p',{class:'note'},'Consulta los documentos de muestra. Los resultados incluyen el texto y la sección de origen.'));return;}
    results.append(h('p',{class:'note'},queryResults.message));
    if(!queryResults.found){results.append(h('div',{class:'empty'},'No hay evidencia suficiente para esta consulta.'));return;}
    for(const [i,c]of queryResults.citations.entries())results.append(h('article',{class:'sourcecard'},h('div',{class:'sourcehead'},h('h3',{},`[${i+1}] ${c.title}`),badge(`Sección ${c.section}`)),h('blockquote',{},c.excerpt),h('p',{class:'hint'},`Términos encontrados: ${c.matched_terms.join(', ')} · Cobertura: ${Math.round(c.coverage*100)}%`),h('small',{class:'hint'},`Documento ${c.document_id} · Puntaje BM25 ${c.score}`)));
  }
  display();form.addEventListener('submit',async event=>{event.preventDefault();search.disabled=true;try{queryResults=await api('/api/evidence/search','POST',{query:query.value});display();}catch(error){toast(error.message);}finally{search.disabled=false;}});
  const title=h('input',{required:true,maxlength:100,placeholder:'Título del documento'}),content=h('textarea',{required:true,minlength:20,maxlength:40000,rows:5,placeholder:'Pega el texto del documento. Separa las secciones con una línea en blanco.'}),importForm=h('form',{class:'form'}),add=h('button',{type:'submit',disabled:!canWrite()},'Añadir documento');
  importForm.append(field('Título',title),field('Contenido',content),add);
  importForm.addEventListener('submit',event=>{event.preventDefault();queryResults=null;mutate('/api/evidence/import',{title:title.value,content:content.value},'Documento indexado.',add);});
  return [h('div',{class:'metrics'},metric('Documentos cargados',data.documents.length,'Colección local',true),metric('Fragmentos indexados',data.documents.reduce((a,d)=>a+d.chunks,0),'Secciones de hasta 80 palabras'),metric('Motor de búsqueda','BM25','Normalización de términos'),metric('Respuestas inventadas','00','Sólo extractos de las fuentes')),
    h('div',{class:'grid2'},panel('Busca una respuesta en tus documentos','El buscador muestra evidencia; no usa un modelo generativo.',h('div',{},form,results)),panel('Fuentes disponibles','Guías ficticias de muestra.',h('div',{class:'doclist'},data.documents.map(doc=>h('div',{class:'doc'},h('strong',{},doc.title),h('p',{},`${doc.chunks} secciones · ${number(doc.characters)} caracteres`)))))),
    panel('Añadir una fuente','El documento se guarda e indexa localmente. No se envía a servicios externos.',importForm)];
}

function opsView(){
  const active=data.incidents.filter(i=>i.state!=='resolved'),healthy=data.services.filter(s=>s.status==='healthy').length;
  const services=data.services.map(service=>{
    const ok=button('Enviar OK',()=>mutate('/api/ops/probe',{service_id:service.id,healthy:true},'Señal saludable registrada.',ok),{class:'small secondary',disabled:!canWrite()}),bad=button('Simular fallo',()=>mutate('/api/ops/probe',{service_id:service.id,healthy:false},'Señal de fallo registrada.',bad),{class:'small danger',disabled:!canWrite()});
    const signals=data.signals.filter(s=>s.service_id===service.id&&!s.ignored).slice(0,20).reverse();
    return h('div',{class:'service'},h('div',{},h('strong',{},service.name),badge(service.status),h('div',{class:'signalbar','aria-label':`Últimas señales de ${service.name}`},signals.map(s=>h('span',{class:`signal ${s.healthy?'':'bad'}`,title:`${s.healthy?'OK':'Fallo'} · ${date(s.created_at)}`}))),h('p',{class:'note'},`${service.failure_streak} fallos consecutivos · ${service.success_streak} señales saludables consecutivas`)),h('div',{class:'actions'},ok,bad));
  });
  const rows=data.incidents.map(incident=>{
    const ack=button('Reconocer',()=>mutate(`/api/ops/incidents/${incident.id}/acknowledge`,{},'Incidente reconocido.',ack),{class:'small secondary',disabled:!canWrite()});
    return [incident.service_name,badge(incident.state),date(incident.opened_at),incident.resolved_at?date(incident.resolved_at):'—',incident.state==='open'?ack:'—'];
  });
  return [h('div',{class:'metrics'},metric('Servicios saludables',`${healthy}/${data.services.length}`,'Estado de la última secuencia',true),metric('Incidentes activos',active.length,'Abiertos o en atención'),metric('Incidentes resueltos',data.incidents.filter(i=>i.state==='resolved').length,'Dos señales OK consecutivas'),metric('Señales recientes',data.signals.length,'Últimas 60 señales guardadas')),
    h('div',{class:'grid2'},panel('Estado de los servicios','Señales simuladas. No hay sondeos externos ni avisos enviados.',h('div',{},services,h('p',{class:'note'},'Prueba el flujo: envía tres fallos al mismo servicio, reconoce el incidente y después envía dos señales OK.'))),panel('Actividad de incidentes','Eventos auditados de apertura, atención y recuperación.',auditList(data.audit))),
    panel('Registro de incidentes','Un servicio sólo puede tener un incidente activo.',table(['Servicio','Estado','Apertura','Resolución','Acción'],rows)),
    panel('Entrada de eventos firmados','La API verifica firma HMAC, ventana de tiempo y duplicados.',h('p',{},'El endpoint ',h('code',{},'POST /api/ops/webhook'),' recibe eventos externos firmados. Consulta el README del proyecto para generar una firma de prueba.'))];
}

function login(){
  const username=h('input',{required:true,value:'demo',autocomplete:'username'}),password=h('input',{required:true,type:'password',value:'Demo-2026!',autocomplete:'current-password'}),message=h('div',{class:'login-error',role:'alert'}),submit=h('button',{type:'submit'},'Entrar al portafolio'),form=h('form',{class:'form'},field('Usuario',username),field('Contraseña',password),message,submit);
  form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;message.textContent='';try{account=await api('/api/auth/login','POST',{username:username.value,password:password.value});await load();}catch(error){message.textContent=error.message;}finally{submit.disabled=false;}});
  return h('div',{class:'login'},h('section',{class:'loginbox','aria-label':'Acceso al portafolio'},h('div',{class:'brandmark'},'DD'),h('h2',{},'Explora los proyectos'),h('p',{},'Acceso de muestra a cinco aplicaciones locales. Puedes crear datos, consultar métricas y probar las reglas de cada proyecto.'),form,h('div',{class:'samples'},h('strong',{},'Credenciales de la demo'),h('br'),'Operador: demo / Demo-2026!',h('br'),'Lectura: lector / Lectura-2026!')));
}
function render(){
  const project=config.find(p=>p.id===current),nav=h('nav',{class:'nav','aria-label':'Proyectos del portafolio'},h('a',{href:'#home',class:current==='home'?'active':''},h('span',{class:'num'},'⌂'),'Vista general'),config.map(p=>h('a',{href:`#${p.id}`,class:current===p.id?'active':''},h('span',{class:'num'},p.n),p.name)));
  const sidebar=h('aside',{class:'sidebar'},h('div',{class:'brand'},h('div',{class:'brandmark'},'DD'),h('div',{},'Diego Díaz',h('small',{},'PORTAFOLIO / SOFTWARE'))),h('div',{},h('div',{class:'side-caption'},'Explorar proyectos'),nav),h('div',{class:'side-foot'},h('strong',{},'Diseño con propósito.'),'Reglas de negocio, datos persistentes y pruebas.',h('br'),'Edición 01 · Datos de muestra'));
  const logout=button('Salir',async()=>{try{await api('/api/auth/logout','POST',{});account=null;render();}catch(error){toast(error.message);}},{class:'small secondary'});
  const main=h('main',{class:'main'},h('div',{class:'topbar'},h('div',{class:'breadcrumb'},'Portafolio / ',h('strong',{},project?.name||'Vista general')),h('div',{class:'account'},h('span',{class:'hint'},'LOCAL'),account?h('span',{class:'username'},account.username):null,h('span',{class:'avatar'},'DD'),account?logout:null)));
  if(current==='home')main.append(...home());else{main.append(hero(project));if(loading)main.append(h('p',{class:'loading','aria-live':'polite'},'Cargando datos del proyecto…'));else if(data){const views={crm:crmView,stock:stockView,campaigns:campaignView,evidence:evidenceView,ops:opsView};main.append(...views[current]());}else main.append(h('p',{class:'empty'},'No fue posible cargar los datos.',button('Reintentar',load,{class:'small secondary'})));}
  main.append(h('footer',{class:'footer'},h('span',{},'Proyectos propios de portafolio · Implementaciones de muestra'),h('span',{},'TypeScript + Node.js + Python + SQLite')));
  root.replaceChildren(h('div',{class:'layout'},sidebar,main));if(!account)root.append(login());
}
render();
api('/api/me').then(result=>{account=result;load();}).catch(()=>render());
