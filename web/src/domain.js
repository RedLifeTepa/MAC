// Reglas de negocio de MAC Store, aplicadas en Cloud Functions. Importes en centavos.
export const COLLECTIONS = ['users','products','categories','suppliers','registers','sales','shifts','inventoryMovements','cashMovements','logs'];
export function emptyState(){ return {settings:{name:'MAC Store',currency:'MXN',timezone:'America/Mexico_City',receiptMessage:'¡Gracias por tu compra!'},...Object.fromEntries(COLLECTIONS.map(k=>[k,[]]))}; }
export function check(ok,message){if(!ok) throw new Error(message);}
export function integer(v,name,min=0,max=1000000000){check(Number.isSafeInteger(v)&&v>=min&&v<=max,`${name}: valor entero fuera de rango.`);return v;}
export function text(v,name,max=120){check(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,`${name}: campo requerido (máx. ${max}).`);return v.trim();}
const find=(s,k,id)=>{const v=s[k].find(x=>x.id===id);check(v,`No existe el registro de ${k}.`);return v;};
const admin=u=>check(u.role==='admin','Esta acción requiere administrador.');
const money=(v,n)=>integer(v,n);
export function priceOf(d){money(d.realCostCents,'Costo real');if(d.pricingMode==='manual')return integer(d.priceCents,'Precio',1);check(['markup','margin'].includes(d.pricingMode),'Modo de precio inválido.');check(Number.isFinite(d.profitPercent)&&d.profitPercent>=0&&d.profitPercent<=1000,'Porcentaje inválido.');if(d.pricingMode==='margin') check(d.profitPercent<100,'El margen debe ser menor a 100%.');return integer(Math.round(d.pricingMode==='markup'?d.realCostCents*(1+d.profitPercent/100):d.realCostCents/(1-d.profitPercent/100)),'Precio calculado',1);}
export function businessDate(now,tz){return new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
export function apply(state,actorId,action,data,now=new Date().toISOString(),id=crypto.randomUUID()){
 const s=structuredClone(state),u=find(s,'users',actorId);check(u.active,'Usuario inactivo.');check(['admin','cashier'].includes(u.role),'Rol inválido.');
 const d=structuredClone(data||{}); let result={};
 const log=(entityId,details={})=>s.logs.push({id,action,actorId,entityId,details,createdAt:now});
 const movement=(p,delta,type,saleId,reason,suffix)=>{const before=p.stock;p.stock+=delta;check(p.stock>=0,'Stock insuficiente.');p.lowStock=p.stock<=p.minStock;p.updatedAt=now;s.inventoryMovements.push({id:`${id}_${suffix}`,productId:p.id,type,qtyDelta:delta,stockBefore:before,stockAfter:p.stock,saleId:saleId||null,reason,actorId,createdAt:now});};
 const ownShift=shift=>check(u.role==='admin'||shift.cashierId===u.id,'Este turno pertenece a otro cajero.');
 if(action==='product.save'){
  admin(u);const p=d.id?s.products.find(x=>x.id===d.id):null;check(!d.id||p,'Producto no encontrado.');
  const name=text(d.name,'Nombre'),barcode=String(d.barcode||'').trim(),sku=String(d.sku||'').trim();
  check(!barcode||/^[A-Za-z0-9_-]{1,64}$/.test(barcode),'Código inválido. Usa letras, números, guion o guion bajo.');check(sku.length<=64,'SKU demasiado largo.');
  check(!s.products.some(x=>x.id!==p?.id&&((barcode&&x.barcode===barcode)||(sku&&x.sku===sku))),'El código de barras o SKU ya está registrado.');
  check(find(s,'categories',d.categoryId).active,'Categoría inactiva.');check(find(s,'suppliers',d.supplierId).active,'Proveedor inactivo.');
  money(d.costCents,'Costo');money(d.realCostCents,'Costo real');integer(d.minStock,'Stock mínimo',0,1000000);
  const fields={name,nameSearch:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),barcode,sku,categoryId:d.categoryId,supplierId:d.supplierId,costCents:d.costCents,realCostCents:d.realCostCents,pricingMode:d.pricingMode,profitPercent:d.profitPercent||0,priceCents:priceOf(d),minStock:d.minStock,imagePath:d.imagePath||null,active:d.active!==false,updatedAt:now};
  if(p){Object.assign(p,fields);p.lowStock=p.stock<=p.minStock;result={id:p.id};}
  else{integer(d.initialStock,'Stock inicial',0,1000000);const np={id,...fields,stock:0,lowStock:true,createdAt:now};s.products.push(np);if(d.initialStock>0)movement(np,d.initialStock,'initial',null,'Inventario inicial','initial');result={id};} log(result.id);
 }else if(action==='product.delete'){
  admin(u);const p=find(s,'products',d.id);if(s.inventoryMovements.some(x=>x.productId===p.id)||s.sales.some(x=>x.items.some(i=>i.productId===p.id))){p.active=false;p.updatedAt=now;}else s.products=s.products.filter(x=>x.id!==p.id);log(p.id);
 }else if(action==='inventory.adjust'){
  admin(u);const p=find(s,'products',d.productId);integer(d.qtyDelta,'Ajuste',-1000000,1000000);check(d.qtyDelta!==0,'Captura una cantidad distinta de cero.');movement(p,d.qtyDelta,'adjustment',null,text(d.reason,'Motivo',500),'adjust');log(p.id,{qtyDelta:d.qtyDelta,reason:d.reason});
 }else if(action==='catalog.save'){
  admin(u);check(['categories','suppliers'].includes(d.collection),'Catálogo inválido.');const current=d.id?find(s,d.collection,d.id):null;const entry={id:current?.id||id,name:text(d.name,'Nombre'),active:d.active!==false,updatedAt:now};
  for(const k of d.collection==='suppliers'?['contact','phone','email','notes']:['description'])entry[k]=String(d[k]||'').slice(0,500);
  check(!s[d.collection].some(x=>x.id!==entry.id&&x.name.toLowerCase()===entry.name.toLowerCase()),'Nombre duplicado.');
  if(current)Object.assign(current,entry);else s[d.collection].push({...entry,createdAt:now});log(entry.id);result={id:entry.id};
 }else if(action==='user.save'){
  admin(u);check(['admin','cashier'].includes(d.role),'Rol inválido.');const current=d.id?s.users.find(x=>x.id===d.id):null;
  const email=text(d.email,'Correo').toLowerCase();check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Correo inválido.');check(!s.users.some(x=>x.id!==current?.id&&x.email===email),'Correo duplicado.');
  if(current){check(!(current.openShiftId&&(d.active===false||d.role!==current.role)),'Cierra el turno antes de cambiar rol o desactivar.');if(current.active&&current.role==='admin'&&(d.active===false||d.role!=='admin'))check(s.users.filter(x=>x.active&&x.role==='admin').length>1,'Debe quedar un administrador activo.');}
  const entry={id:current?.id||id,name:text(d.name,'Nombre'),email,role:d.role,active:d.active!==false,updatedAt:now};if(current)Object.assign(current,entry);else s.users.push({...entry,openShiftId:null,createdAt:now});result={id:entry.id};log(entry.id,{role:d.role,active:entry.active});
 }else if(action==='shift.open'){
  const r=find(s,'registers',d.registerId);check(r.active&&!r.openShiftId,'Caja inactiva u ocupada.');check(!u.openShiftId,'Ya tienes un turno abierto.');money(d.openingCashCents,'Fondo inicial');
  s.shifts.push({id,cashierId:u.id,registerId:r.id,status:'open',openedAt:now,closedAt:null,openingCashCents:d.openingCashCents,payments:{cash:0,card:0,transfer:0},totalSalesCents:0,totalCostCents:0,saleCount:0,cashInCents:0,cashOutCents:0,expectedCashCents:null,closingCashCents:null,differenceCents:null,notes:''});u.openShiftId=id;r.openShiftId=id;log(id);result={id};
 }else if(action==='cash.move'){
  const shift=find(s,'shifts',d.shiftId);ownShift(shift);check(shift.status==='open','Turno cerrado.');check(['in','out'].includes(d.type),'Movimiento inválido.');integer(d.amountCents,'Importe',1);const reason=text(d.reason,'Motivo',500);const expected=shift.openingCashCents+shift.payments.cash+shift.cashInCents-shift.cashOutCents;check(d.type==='in'||d.amountCents<=expected,'El retiro excede el efectivo esperado.');shift[d.type==='in'?'cashInCents':'cashOutCents']+=d.amountCents;s.cashMovements.push({id,shiftId:shift.id,cashierId:shift.cashierId,type:d.type,amountCents:d.amountCents,reason,actorId,createdAt:now});log(shift.id,{type:d.type,amountCents:d.amountCents,reason});
 }else if(action==='shift.close'){
  const shift=find(s,'shifts',d.shiftId);ownShift(shift);money(d.closingCashCents,'Efectivo contado');if(shift.status==='closed'){check(shift.closingCashCents===d.closingCashCents,'El corte ya está cerrado con otro importe.');return {state:s,result:{id:shift.id}};}
  if(shift.cashierId!==u.id)text(d.notes,'Motivo del cierre administrativo',500);
  shift.expectedCashCents=shift.openingCashCents+shift.payments.cash+shift.cashInCents-shift.cashOutCents;shift.closingCashCents=d.closingCashCents;shift.differenceCents=d.closingCashCents-shift.expectedCashCents;shift.closedAt=now;shift.status='closed';shift.notes=String(d.notes||'').slice(0,500);find(s,'users',shift.cashierId).openShiftId=null;find(s,'registers',shift.registerId).openShiftId=null;log(shift.id);result={id:shift.id};
 }else if(action==='sale.create'){
  text(d.requestId,'ID de solicitud',100);check(/^[a-zA-Z0-9_-]+$/.test(d.requestId),'ID inválido.');const saleId=`${u.id}_${d.requestId}`;
  check(Array.isArray(d.items)&&d.items.length>0&&d.items.length<=50,'El carrito admite de 1 a 50 líneas.');const normalized=d.items.map(i=>({productId:text(i.productId,'Producto',150),qty:integer(i.qty,'Cantidad',1,10000)})).sort((a,b)=>a.productId.localeCompare(b.productId));check(new Set(normalized.map(x=>x.productId)).size===normalized.length,'Combina las líneas del mismo producto.');
  check(['cash','card','transfer'].includes(d.paymentMethod),'Forma de pago inválida.');money(d.paymentReceivedCents,'Recibido');money(d.expectedTotalCents,'Total');
  const fingerprint=JSON.stringify({shiftId:d.shiftId,items:normalized,paymentMethod:d.paymentMethod,paymentReceivedCents:d.paymentReceivedCents,expectedTotalCents:d.expectedTotalCents});const existing=s.sales.find(x=>x.id===saleId);if(existing){check(existing.fingerprint===fingerprint,'Esta solicitud ya se utilizó con otros datos.');return {state:s,result:{id:saleId}};}
  const shift=find(s,'shifts',d.shiftId);check(shift.cashierId===u.id&&shift.status==='open'&&u.openShiftId===shift.id,'Abre tu turno antes de vender.');check(find(s,'registers',shift.registerId).openShiftId===shift.id,'La caja no está asignada al turno.');
  const items=normalized.map(i=>{const p=find(s,'products',i.productId);check(p.active,`Producto inactivo: ${p.name}`);check(p.stock>=i.qty,`Stock insuficiente: ${p.name}`);return {productId:p.id,name:p.name,barcode:p.barcode,qty:i.qty,unitPriceCents:p.priceCents,unitCostCents:p.realCostCents,subtotalCents:p.priceCents*i.qty};});const totalSaleCents=items.reduce((a,i)=>a+i.subtotalCents,0),totalCostCents=items.reduce((a,i)=>a+i.unitCostCents*i.qty,0);money(totalSaleCents,'Total');money(totalCostCents,'Costo total');check(totalSaleCents===d.expectedTotalCents,'El precio cambió. Actualiza el carrito y confirma otra vez.');check(d.paymentMethod==='cash'?d.paymentReceivedCents>=totalSaleCents:d.paymentReceivedCents===totalSaleCents,'Pago insuficiente o importe no exacto.');
  const sale={id:saleId,cashierId:u.id,shiftId:shift.id,registerId:shift.registerId,items,totalSaleCents,totalCostCents,paymentMethod:d.paymentMethod,paymentReceivedCents:d.paymentReceivedCents,changeCents:d.paymentMethod==='cash'?d.paymentReceivedCents-totalSaleCents:0,status:'completed',businessDate:businessDate(now,s.settings.timezone),currency:s.settings.currency,createdAt:now,fingerprint};s.sales.push(sale);items.forEach((i,n)=>movement(find(s,'products',i.productId),-i.qty,'sale',saleId,'Venta POS',n));shift.totalSalesCents+=totalSaleCents;shift.totalCostCents+=totalCostCents;shift.saleCount++;shift.payments[d.paymentMethod]+=totalSaleCents;log(saleId,{totalSaleCents});result={id:saleId};
 }else if(action==='sale.void'){
  admin(u);const sale=find(s,'sales',d.id);check(sale.status==='completed','La venta ya está anulada.');const shift=find(s,'shifts',sale.shiftId);check(shift.status==='open','No se anulan ventas de cortes cerrados en esta versión.');const reason=text(d.reason,'Motivo',500);const cashAvailable=shift.openingCashCents+shift.payments.cash+shift.cashInCents-shift.cashOutCents;check(sale.paymentMethod!=='cash'||cashAvailable>=sale.totalSaleCents,'Registra una entrada de efectivo para cubrir la devolución.');sale.status='voided';sale.voidReason=reason;sale.voidedAt=now;sale.voidedBy=u.id;sale.items.forEach((i,n)=>movement(find(s,'products',i.productId),i.qty,'void',sale.id,reason,n));shift.totalSalesCents-=sale.totalSaleCents;shift.totalCostCents-=sale.totalCostCents;shift.saleCount--;shift.payments[sale.paymentMethod]-=sale.totalSaleCents;log(sale.id,{reason});
 }else if(action==='settings.save'){
  admin(u);text(d.name,'Nombre');check(d.currency==='MXN','Moneda disponible: MXN.');try{businessDate(now,d.timezone);}catch{throw new Error('Zona horaria inválida.');}s.settings={name:d.name.trim(),currency:'MXN',timezone:d.timezone,logoPath:d.logoPath||null,receiptMessage:String(d.receiptMessage||'').slice(0,300)};log('store');
 }else throw new Error('Operación no reconocida.');
 return {state:s,result};
}
