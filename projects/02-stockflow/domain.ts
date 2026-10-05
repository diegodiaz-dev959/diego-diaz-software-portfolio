import type {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {text,integer,fail,tx,audit} from '../../core/domain.ts';
export function inventory(db: DatabaseSync, clock=Date.now) {
  const get=(id:string):any=>db.prepare('SELECT * FROM orders WHERE id=?').get(id)||fail(404,'Pedido no encontrado.');
  function movement(order:any,stock:number,reserved:number,reason:string) {
    db.prepare('UPDATE products SET stock=stock+?,reserved=reserved+? WHERE id=?').run(stock,reserved,order.product_id);
    db.prepare('INSERT INTO stock_ledger(product_id,order_id,stock_delta,reserved_delta,reason,created_at) VALUES(?,?,?,?,?,?)').run(order.product_id,order.id,stock,reserved,reason,clock());
    audit(db,'stock',order.id,reason,{quantity:order.quantity,total_cents:order.total_cents},clock());
  }
  function expireInside() {
    for(const order of db.prepare("SELECT * FROM orders WHERE state='reserved' AND expires_at<=?").all(clock()) as any[]) {
      db.prepare("UPDATE orders SET state='expired' WHERE id=?").run(order.id);movement(order,0,-order.quantity,'expired');
    }
  }
  return {
    list() { tx(db,expireInside); return {products:db.prepare('SELECT *,stock-reserved available FROM products ORDER BY id').all(),orders:db.prepare('SELECT o.*,p.name product_name FROM orders o JOIN products p ON p.id=o.product_id ORDER BY created_at DESC LIMIT 100').all(),ledger:db.prepare('SELECT * FROM stock_ledger ORDER BY id DESC LIMIT 12').all()}; },
    reserve(product:unknown,quantity:unknown,key:unknown) {
      const pid=text(product,'Producto',60),qty=integer(quantity,'Cantidad',1,100),requestKey=text(key,'Clave de idempotencia',100);
      const hash=createHash('sha256').update(JSON.stringify([pid,qty])).digest('hex');
      return tx(db,()=>{expireInside();const old=db.prepare('SELECT * FROM orders WHERE request_key=?').get(requestKey) as any;
        if(old){if(old.payload_hash!==hash)fail(409,'Esta clave ya se utilizó para un pedido diferente.');return {...old,replayed:true};}
        const p=db.prepare('SELECT * FROM products WHERE id=?').get(pid) as any;if(!p)fail(404,'Producto no encontrado.');
        if(p.stock-p.reserved<qty)fail(409,'No hay suficientes unidades disponibles.');
        const id=randomUUID();db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?)').run(id,pid,qty,p.price_cents*qty,'reserved',requestKey,hash,clock(),clock()+15*60000);
        const order=get(id);movement(order,0,qty,'reserved');return order;});
    },
    change(id:string,action:'confirm'|'cancel') {
      return tx(db,()=>{expireInside();const order=get(id),target=action==='confirm'?'confirmed':'cancelled';
        if(order.state===target)return {...order,replayed:true};if(order.state!=='reserved')fail(409,`El pedido está ${order.state}; no se puede modificar.`);
        db.prepare('UPDATE orders SET state=? WHERE id=?').run(target,id);
        movement(order,action==='confirm'?-order.quantity:0,-order.quantity,target);return get(id);});
    }
  };
}
