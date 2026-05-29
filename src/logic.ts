// Adaptado para rodar no ambiente AI Studio / Vite
const DB_NAME = 'controlo_viaturas_db_v4';
const DB_VERSION = 1;
const STORE = 'viaturas';
const TAKT_TIME_MIN = 31;
const WORK_START = '07:40';
const WORK_END = '18:15';
const INTERVALOS_RETIFICACAO = [
  { inicio: '09:15', fim: '09:32' },
  { inicio: '12:07', fim: '12:37' },
  { inicio: '16:10', fim: '16:20' }
];
const OPERADORES_AZUIS = {
  '1111': { nome: 'Operador Azul 1', perfil: 'azul' },
  '2222': { nome: 'Operador Azul 2', perfil: 'azul' },
  '9999': { nome: 'Supervisor', perfil: 'supervisor' }
};
const DEFECTS = [
  ['lixo','LIXO'], ['escorrido','ESCORRIDO'], ['maReparacao','MÁ REP.'],
  ['anomaliaVedante','ANOM. VED.'], ['poros','POROS'], ['esmurrados','ESMURR.'],
  ['polir', 'POLIR'], ['rebarba', 'REBARBA'], ['pulverizado', 'PULV.'], ['falhado', 'FALHADO']
];

let db: any, currentRecords: any[] = [], recordBeingValidated: any = null, deferredPrompt: any = null;
const $ = (id: string): any => document.getElementById(id);

let appInitialized = false;

export function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  renderDefects();
  initDb().then(() => {
    initPwa();
    initTabs();
    initToggles();
    initCounters();
    initForm();
    initValidation();
    initTools();
    initFilters();
    initWorkTimeValidation();
    setDefaultDate();
    refreshAll();
  });
}

function initPwa(){
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
  $('installBtn').addEventListener('click', async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('installBtn').classList.add('hidden'); });
}

function initDb(){return new Promise<void>((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=(e: any)=>{const d=e.target.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id'});s.createIndex('status','status');s.createIndex('criadoEm','criadoEm');}};req.onsuccess=()=>{db=req.result;resolve();};req.onerror=()=>reject(req.error);});}
const store = (mode='readonly') => db.transaction(STORE,mode).objectStore(STORE);
const saveRecord = (r: any) => new Promise((res,rej)=>{const q=store('readwrite').put(r);q.onsuccess=()=>res(r);q.onerror=()=>rej(q.error);});
const getRecord = (id: string): Promise<any> => new Promise((res,rej)=>{const q=store().get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
const getAllRecords = (): Promise<any[]> => new Promise((res,rej)=>{const q=store().getAll();q.onsuccess=()=>res(q.result.sort((a: any,b: any)=>(b.criadoEm||'').localeCompare(a.criadoEm||'')));q.onerror=()=>rej(q.error);});
const deleteRecord = (id: string) => new Promise<void>((res,rej)=>{const q=store('readwrite').delete(id);q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});
const clearRecords = () => new Promise<void>((res,rej)=>{const q=store('readwrite').clear();q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});

function initWorkTimeValidation(){
  document.querySelectorAll('.work-time').forEach((input: any) => {
    input.min = WORK_START;
    input.max = WORK_END;
    input.addEventListener('change', () => validateWorkTimeInput(input));
    input.addEventListener('input', () => input.setCustomValidity(''));
  });
}
function validateWorkTimeInput(input: any){
  if(!input.value) { input.setCustomValidity(''); return true; }
  const ok = isWithinWorkHours(input.value);
  input.setCustomValidity(ok ? '' : `Só é permitido horário entre ${WORK_START} e ${WORK_END}.`);
  if(!ok){ input.reportValidity(); showToast(`Horário inválido: use apenas ${WORK_START} a ${WORK_END}.`); }
  return ok;
}
function validateAllWorkTimes(){
  let ok = true;
  document.querySelectorAll('.work-time').forEach((input: any) => { if(!validateWorkTimeInput(input)) ok = false; });
  return ok;
}
function isWithinWorkHours(hhmm: string){
  const t = timeToMinutes(hhmm);
  return t >= timeToMinutes(WORK_START) && t <= timeToMinutes(WORK_END);
}

function renderDefects(){
  $('defectsBox').innerHTML = DEFECTS.map(([id,label]) => `<div class="defect"><span title="${label}">${label}</span><button type="button" class="minus" data-defect="${id}">−</button><input id="def_${id}" type="number" min="0" value="0"><button type="button" class="plus" data-defect="${id}">+</button></div>`).join('');
}
function initTabs(){document.querySelectorAll('.tab').forEach((t: any)=>t.addEventListener('click',()=>openView(t.dataset.view)));}
function openView(id: string){document.querySelectorAll('.tab').forEach((t: any)=>t.classList.toggle('active',t.dataset.view===id));document.querySelectorAll('.view').forEach((v: any)=>v.classList.toggle('active',v.id===id));refreshAll();}
function initToggles(){document.querySelectorAll('.toggle button').forEach((btn: any)=>btn.addEventListener('click',()=>{const g=btn.closest('.toggle') as any;$(g.dataset.target).value=btn.dataset.value;g.querySelectorAll('button').forEach((b: any)=>b.classList.remove('selected'));btn.classList.add('selected');}));}
function setToggle(id: string,value: string){const input=$(id); if(!input) return; input.value=value; const g=document.querySelector(`.toggle[data-target="${id}"]`); if(g) g.querySelectorAll('button').forEach((b: any)=>b.classList.toggle('selected',b.dataset.value===value));}
function initCounters(){document.querySelectorAll('.plus,.minus').forEach((btn: any)=>btn.addEventListener('click',()=>{const input=$('def_'+btn.dataset.defect);const n=Number(input.value||0);input.value=btn.classList.contains('plus')?n+1:Math.max(0,n-1);updatePaintTotal();}));document.querySelectorAll('.defect input').forEach((i: any)=>i.addEventListener('input',updatePaintTotal));}
function updatePaintTotal(){const total = Object.values(getDefects()).reduce((a: number,b: any)=>a+Number(b||0),0);$('pinturaQtd').value=total;if(Number(total)>0)setToggle('pinturaSimNao','SIM');}

function initForm(){
  $('vehicleForm').addEventListener('submit',async (e: any)=>{e.preventDefault(); if(!validateAllWorkTimes()) return; const r=collectFormData();await saveRecord(r);showToast('Registo guardado.');clearForm();await refreshAll();openView('suspendedView');});
  $('newBtn').addEventListener('click',clearForm);
}
function collectFormData(){const now=new Date().toISOString();const id=$('recordId').value;return {id:id||crypto.randomUUID(),diaMes:$('diaMes').value.trim(),renban:$('renban').value.trim().toUpperCase(),vin:$('vin').value.trim().toUpperCase(),horaEntradaRetificacao:$('horaEntradaRetificacao').value,numDefeitosPorReparar:Number($('numDefeitosPorReparar').value||0),desmontaMonta:$('desmontaMonta').value,substituicaoPecas:$('substituicaoPecas').value,suspenso:$('suspenso').value,montagemSimNao:$('montagemSimNao').value,montagemQtd:Number($('montagemQtd').value||0),montagemDesignacao:$('montagemDesignacao').value.trim(),linhaMontFinal:$('linhaMontFinal').value.trim(),linhaTrimming:$('linhaTrimming').value.trim(),linhaChassi:$('linhaChassi').value.trim(),horaSaidaArc:$('horaSaidaArc').value,pinturaSimNao:$('pinturaSimNao').value,pinturaQtd:Number($('pinturaQtd').value||0),horaEntradaPintura:$('horaEntradaPintura').value,defeitosPintura:getDefects(),pinturaOutros:$('pinturaOutros').value.trim(),pinturaRetoque:$('pinturaRetoque').value,horaSaidaPintura:$('horaSaidaPintura').value,adicionalSimNao:$('adicionalSimNao').value,adicionalQtd:Number($('adicionalQtd').value||0),adicionalDesignacao:$('adicionalDesignacao').value.trim(),adicionalRetoque:$('adicionalRetoque').value,observacoes:$('observacoes').value.trim(),operadorVermelho:$('operadorVermelho').value.trim(),status:'AGUARDANDO_APTO_DRR',validacaoDrr:null,criadoEm:id?($('vehicleForm').dataset.criadoEm||now):now,atualizadoEm:now};}
function getDefects(){const o: any={};DEFECTS.forEach(([id])=>o[id]=Number($('def_'+id).value||0));return o;}
function clearForm(){$('vehicleForm').reset();$('recordId').value='';$('vehicleForm').dataset.criadoEm='';['desmontaMonta','substituicaoPecas','suspenso','pinturaRetoque','adicionalRetoque'].forEach(id=>setToggle(id,'N'));['montagemSimNao','pinturaSimNao','adicionalSimNao'].forEach(id=>setToggle(id,'NÃO'));DEFECTS.forEach(([id])=>$('def_'+id).value=0);$('numDefeitosPorReparar').value=0;$('montagemQtd').value=0;$('pinturaQtd').value=0;$('adicionalQtd').value=0;document.querySelectorAll('.work-time').forEach((i: any)=>i.setCustomValidity(''));setDefaultDate();}
function setDefaultDate(){const d=new Date();$('diaMes').value=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');}

async function refreshAll(){currentRecords=await getAllRecords();renderSuspended();renderHistory();}

function suspendedRecords(){return currentRecords.filter(r=>r.status==='AGUARDANDO_APTO_DRR'&&!r.validacaoDrr);}
function renderSuspended(){const list=$('suspendedList');const suspended=suspendedRecords();$('suspendedCount').textContent=suspended.length;if(!suspended.length){list.innerHTML='<article class="panel"><h2>Sem suspensos / aguardando</h2><p>Nenhuma viatura aguardando validação.</p></article>';return;}list.innerHTML=suspended.map(r=>cardHtml(r,true)).join('');bindCardButtons();}

function renderHistory(){const q=($('searchInput')?.value||'').toLowerCase();const st=$('statusFilter')?.value||'';const rows=currentRecords.filter(r=>(!st||r.status===st)&&(!q||[r.renban,r.vin,r.status,r.operadorVermelho].join(' ').toLowerCase().includes(q)));$('historyCards').innerHTML=rows.length?rows.map(r=>cardHtml(r,false)).join(''):'<article class="panel"><h2>Sem registos</h2><p>Nenhum registo encontrado.</p></article>';bindCardButtons();}
function cardHtml(r: any,isAwaitingValidation: boolean){const now = new Date(); const nowStr = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'); const current=calcBusinessMinutesDetailed(r.horaEntradaRetificacao, nowStr).businessMinutes;const v=r.validacaoDrr;const badgeClass=isAwaitingValidation?'pending':(r.status==='APTO_DRR_POSITIVO'?'good':'bad');const badgeText=isAwaitingValidation?(r.suspenso==='S'?'SUSPENSO':'AGUARDANDO VALIDAÇÃO'):(r.status==='APTO_DRR_POSITIVO'?'APTO / DRR positivo':'Não apto / DRR negativo');return `<article class="card"><h3>${esc(r.renban||'Sem Renban')}</h3><div class="meta"><b>Data:</b> ${fmt(r.criadoEm)}<br><b>VIN:</b> ${esc(r.vin||'-')}<br><b>Entrada:</b> ${r.horaEntradaRetificacao||'-'} | <b>ARC:</b> ${r.horaSaidaArc||'-'}<br><b>DRR atual:</b> ${isAwaitingValidation?current+' min úteis':'-'}${v?`<br><b>APTO/DRR:</b> ${v.horaAptoDrr} | <b>Útil:</b> ${v.tempoDrrUtilMinutos} min<br><b>Não contado:</b> ${v.tempoNaoContabilizadoMinutos} min`:''}</div><p><span class="badge ${badgeClass}">${badgeText}</span></p><div class="card-actions">${isAwaitingValidation?`<button class="btn btn-primary" data-validate-id="${r.id}" type="button">Validar</button>`:''}<button class="btn" data-edit-id="${r.id}" type="button">Editar</button><button class="btn btn-danger" data-delete-id="${r.id}" type="button">Excluir</button></div></article>`;}
function bindCardButtons(){document.querySelectorAll('[data-validate-id]').forEach((b: any)=>b.onclick=()=>openValidation(b.dataset.validateId));document.querySelectorAll('[data-edit-id]').forEach((b: any)=>b.onclick=()=>editRecord(b.dataset.editId));document.querySelectorAll('[data-delete-id]').forEach((b: any)=>b.onclick=()=>removeRecord(b.dataset.deleteId));}

function initValidation(){
  $('cancelValidateBtn').addEventListener('click',()=>$('validateDialog').close());
  $('horaAptoDrr').addEventListener('input',updateValidationPreview);
  $('validateForm').addEventListener('submit',async e=>{e.preventDefault(); if(!validateWorkTimeInput($('horaAptoDrr'))) return; const r=await getRecord($('validateRecordId').value);const hora=$('horaAptoDrr').value;const calc=calcBusinessMinutesDetailed(r.horaEntradaRetificacao,hora);const ok=calc.businessMinutes<=TAKT_TIME_MIN;r.validacaoDrr={horaAptoDrr:hora,tempoDrrUtilMinutos:calc.businessMinutes,tempoTotalRelogioMinutos:calc.rawMinutes,tempoNaoContabilizadoMinutos:calc.rawMinutes-calc.businessMinutes,resultadoApto:ok?'SIM':'NÃO',resultadoDrr:ok?'POSITIVO':'NEGATIVO',operadorAzul:'Validador',perfilOperador:'supervisor',validadoEm:new Date().toISOString()};r.status=ok?'APTO_DRR_POSITIVO':'NAO_APTO_DRR_NEGATIVO';r.atualizadoEm=new Date().toISOString();await saveRecord(r);$('validateDialog').close();showToast(ok?'APTO / DRR positivo.':'NÃO APTO / DRR negativo.');await refreshAll();});
}
async function openValidation(id){recordBeingValidated=await getRecord(id);$('validateRecordId').value=id;$('horaAptoDrr').value='';$('horaAptoDrr').setCustomValidity('');$('dialogVehicleInfo').innerHTML=`<b>Renban:</b> ${esc(recordBeingValidated.renban||'-')}<br><b>Entrada Ret.:</b> ${recordBeingValidated.horaEntradaRetificacao}<br><small>Permitido apenas ${WORK_START}-${WORK_END}.</small>`;$('validationPreview').className='result neutral';$('validationPreview').textContent='Informe a hora para pré-visualizar.';$('validateDialog').showModal();$('horaAptoDrr').focus();}
function updateValidationPreview(){if(!recordBeingValidated||!$('horaAptoDrr').value)return;if(!isWithinWorkHours($('horaAptoDrr').value)){ $('validationPreview').className='result bad'; $('validationPreview').innerHTML=`<b>HORÁRIO INVÁLIDO</b><br>Use apenas ${WORK_START} a ${WORK_END}.`; return; }const calc=calcBusinessMinutesDetailed(recordBeingValidated.horaEntradaRetificacao,$('horaAptoDrr').value);const ok=calc.businessMinutes<=TAKT_TIME_MIN;$('validationPreview').className='result '+(ok?'good':'bad');$('validationPreview').innerHTML=`<b>${ok?'APTO / DRR POSITIVO':'NÃO APTO / DRR NEGATIVO'}</b><br>Tempo útil: ${calc.businessMinutes} min<br>Não contado: ${calc.rawMinutes-calc.businessMinutes} min`;}

function timeToMinutes(hhmm){if(!hhmm)return 0;const [h,m]=hhmm.split(':').map(Number);return h*60+m;}
function calcRawMinutes(startHHMM,endHHMM){let s=timeToMinutes(startHHMM);let e=timeToMinutes(endHHMM);if(e<s)e+=1440;return {start:s,end:e,raw:e-s};}
function overlap(aStart,aEnd,bStart,bEnd){return Math.max(0,Math.min(aEnd,bEnd)-Math.max(aStart,bStart));}
function calcBusinessMinutesDetailed(startHHMM,endHHMM){if(!startHHMM||!endHHMM)return {businessMinutes:0,rawMinutes:0};const {start,end,raw}=calcRawMinutes(startHHMM,endHHMM);const workStart=timeToMinutes(WORK_START),workEnd=timeToMinutes(WORK_END);let business=0;for(let day=0;day<=Math.ceil(end/1440);day++){const offset=day*1440;const ws=workStart+offset,we=workEnd+offset;let workOverlap=overlap(start,end,ws,we);let breakOverlap=0;INTERVALOS_RETIFICACAO.forEach(i=>{breakOverlap+=overlap(start,end,timeToMinutes(i.inicio)+offset,timeToMinutes(i.fim)+offset);});business += Math.max(0,workOverlap-breakOverlap);}return {businessMinutes:business,rawMinutes:raw};}

async function editRecord(id){const r=await getRecord(id);if(!r)return;fillForm(r);openView('formView');showToast('Registo carregado.');}
function fillForm(r){$('recordId').value=r.id;$('vehicleForm').dataset.criadoEm=r.criadoEm||'';['diaMes','renban','vin','horaEntradaRetificacao','numDefeitosPorReparar','montagemQtd','montagemDesignacao','linhaMontFinal','linhaTrimming','linhaChassi','horaSaidaArc','pinturaQtd','horaEntradaPintura','pinturaOutros','horaSaidaPintura','adicionalQtd','adicionalDesignacao','observacoes','operadorVermelho'].forEach(id=>{if($(id))$(id).value=r[id]??''});['desmontaMonta','substituicaoPecas','suspenso','montagemSimNao','pinturaSimNao','pinturaRetoque','adicionalSimNao','adicionalRetoque'].forEach(id=>setToggle(id,r[id]||($(id).value)));const d=r.defeitosPintura||{};DEFECTS.forEach(([id])=>$('def_'+id).value=d[id]||0);}
function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const onSubmit = () => {
      cleanup();
      resolve(true);
    };
    
    const cleanup = () => {
      $('cancelConfirmBtn').removeEventListener('click', onCancel);
      $('submitConfirmBtn').removeEventListener('click', onSubmit);
      $('confirmDialog').close();
    };
    
    $('cancelConfirmBtn').addEventListener('click', onCancel);
    $('submitConfirmBtn').addEventListener('click', onSubmit);
    $('confirmDialog').showModal();
  });
}

async function removeRecord(id){
  const ok = await showCustomConfirm('Excluir registo', 'Deseja realmente excluir este registo?');
  if(!ok) return;
  await deleteRecord(id);
  showToast('Registo excluído.');
  await refreshAll();
}
function initFilters(){$('searchInput').addEventListener('input',renderHistory);$('statusFilter').addEventListener('change',renderHistory);}
function initTools(){$('exportCsvBtn').addEventListener('click',()=>exportCsv(currentRecords));$('backupJsonBtn').addEventListener('click',()=>download(`backup_controlo_viaturas_${stamp()}.json`,JSON.stringify(currentRecords,null,2),'application/json'));$('importJsonInput').addEventListener('change',importJson);$('clearDbBtn').addEventListener('click',async()=>{
  const ok = await showCustomConfirm('Limpar Base de Dados', 'Deseja apagar todos os dados locais?');
  if(!ok) return;
  await clearRecords();
  await refreshAll();
  showToast('Base local limpa.');
});}
async function importJson(e){const f=e.target.files[0];if(!f)return;const records=JSON.parse(await f.text());if(!Array.isArray(records)){showToast('Ficheiro inválido.');return;}for(const r of records)await saveRecord(r);await refreshAll();showToast('Backup importado.');e.target.value='';}
function exportCsv(records){if(!records.length){showToast('Não existem registos.');return;}const headers=['ID','Data Criacao','Dia/Mes','Renban','VIN','Hora Entrada Retificacao','Hora Saida ARC','Status','Hora APTO/DRR','Tempo DRR Util Min','Tempo Total Relogio Min','Tempo Nao Contabilizado Min','Resultado APTO','Resultado DRR','Operador Azul','Validado Em','Operador Vermelho','Observacoes','Montagem Qtd','Pintura Qtd','Lixo','Escorrido','Ma Reparacao','Anomalia Vedante','Poros','Esmurrados','Polir','Rebarba','Pulverizado','Falhado'];const lines=[headers.join(';')];records.forEach(r=>{const d=r.defeitosPintura||{},v=r.validacaoDrr||{};lines.push([r.id,fmt(r.criadoEm),r.diaMes,r.renban,r.vin,r.horaEntradaRetificacao,r.horaSaidaArc,r.status,v.horaAptoDrr,v.tempoDrrUtilMinutos,v.tempoTotalRelogioMinutos,v.tempoNaoContabilizadoMinutos,v.resultadoApto,v.resultadoDrr,v.operadorAzul,fmt(v.validadoEm),r.operadorVermelho,r.observacoes,r.montagemQtd,r.pinturaQtd,d.lixo,d.escorrido,d.maReparacao,d.anomaliaVedante,d.poros,d.esmurrados,d.polir,d.rebarba,d.pulverizado,d.falhado].map(csv).join(';'));});download(`controlo_viaturas_${stamp()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8;');}
function csv(v){const t=v==null?'':String(v);return '"'+t.replaceAll('"','""').replaceAll('\n',' ')+'"';}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
function showToast(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2600);}
function fmt(iso){if(!iso)return'';try{return new Date(iso).toLocaleString('pt-PT')}catch{return iso}}
function stamp(){return new Date().toISOString().slice(0,19).replaceAll(':','-');}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
