/* Ortak Takip: local CSV preview/import for legacy AppSheet appointments.
 * File stays in the browser until Admin confirms import. Never mutates source Google Sheet.
 */
export function createAppointmentImporter({sb,WS,state,esc,toast,error,requireActiveSession,render,reload,getRows,today}) {
 const isAdmin=()=>['owner','manager'].includes(state.role);
 const norm=x=>String(x??'').trim().toLocaleLowerCase('tr-TR').replace(/[ıİ]/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 const fields={
  source_record_id:['ID','Kayit ID','Record ID','Row ID'],
  full_name:['VELİ/ÖĞRENCİ ADI SOYADI','VELI OGRENCI ADI SOYADI','Ad Soyad','AD SOYAD','Öğrenci Adı Soyadı'],
  education_status:['EĞİTİM DURUMU','Egitim Durumu'],
  age:['YAŞ','YAS'],
  grade:['SINIF'],
  aol_credit:['AÖL KREDİ','AOL KREDI','KREDİ'],
  quoted_amount:['RAKAM','TUTAR','ÜCRET','FIYAT'],
  province:['İL','IL'],
  district:['İLÇE','ILCE'],
  staff_name:['GÖRÜŞEN KİŞİ','GORUSEN KISI','PERSONEL'],
  phone:['TELEFON','TEL','CEP TELEFONU'],
  contact_date:['GÖRÜŞME TARİHİ','GORUSME TARIHI','İLK GÖRÜŞME TARİHİ'],
  first_contact:['İLK GÖRÜŞME','ILK GORUSME','GÖRÜŞME NOTU'],
  appointment_date:['RANDEVU TARİHİ','RANDEVU TARIHI'],
  appointment_time:['RANDEVU SAAT','RANDEVU SAATİ','SAAT'],
  branch:['RANDEVU ŞUBESİ','RANDEVU SUBESI','ŞUBE'],
  outcome:['RANDEVU SONUCU','RANDEVU SONUC','SONUÇ','DURUM'],
  notes:['NOTLAR','NOT','AÇIKLAMA'],
  followup_date:['TEKRAR ARAMA TARİHİ','TAKİP TARİHİ','SONRAKİ GÖRÜŞME']
 };
 const aliases=Object.fromEntries(Object.entries(fields).flatMap(([k,values])=>[k,...values].map(x=>[norm(x),k])));
 const statusNames={
  kayit:'kayit',kesinkayit:'kayit',kayityapildi:'kayit',onkayit:'on_kayit',
  baskaokulakayit:'baska_okula_kayit',ilkrandevu:'ilk_randevu',olumsuz:'olumsuz',
  cevapyok:'cevap_yok',dusunecek:'dusunecek',erteleme:'erteleme',ertelendi:'erteleme',
  orgun:'orgun',yashatasi:'yas_hatasi',beklemede:'beklemede',tekrararanacak:'beklemede',
  kayitdegil:'olumsuz'
 };
 const safeValue=(s,max=1500)=>String(s??'').trim().slice(0,max);
 const blankNumeric=v=>!String(v??'').trim()||/^[-—–]+$/.test(String(v).replace(/[₺\s]/g,''));
 const parseNumber=v=>{
  let s=String(v??'').trim().replace(/[₺\s]/g,'');
  if(!s||s==='-'||s==='—')return null;
  if(s.includes(',')&&s.includes('.')){
    s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  }else if(s.includes(',')){s=s.replace(/\./g,'').replace(',','.')}
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=Number(s);return Number.isFinite(n)&&n>=0?n:null;
 };
 const partsDate=v=>{
  const s=String(v??'').trim();
  if(!s)return {date:null,time:null};
  let m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?/);
  if(m)return validDate(+m[3],+m[2],+m[1],m[4]?+m[4]:null,m[5]?+m[5]:null);
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?/);
  if(m)return validDate(+m[1],+m[2],+m[3],m[4]?+m[4]:null,m[5]?+m[5]:null);
  if(/^\d{5}(?:\.\d+)?$/.test(s)){
   const d=new Date(Date.UTC(1899,11,30)+Math.floor(Number(s))*86400000);
   if(d.getUTCFullYear()>=1990&&d.getUTCFullYear()<=2100)
    return validDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),null,null);
  }
  return {date:null,time:null};
 };
 function validDate(y,m,d,h,minute){
  const v=new Date(Date.UTC(y,m-1,d));
  if(v.getUTCFullYear()!==y||v.getUTCMonth()+1!==m||v.getUTCDate()!==d)return {date:null,time:null};
  const date=[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
  const time=h!==null&&minute!==null&&h>=0&&h<=23&&minute>=0&&minute<=59?String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0'):null;
  return {date,time};
 }
 function parseTime(v){
  const s=String(v??'').trim(),m=s.match(/^(?:\d{1,2}[.\/]\d{1,2}[.\/]\d{4}\s+)?(\d{1,2}):(\d{2})(?::\d{2})?/);
  if(!m)return null;
  const h=+m[1],min=+m[2];return h<24&&min<60?String(h).padStart(2,'0')+':'+String(min).padStart(2,'0'):null;
 }
 const inferredSchool=education=>{const n=norm(education);return n.includes('anaokul')||n.includes('anasinif')?'anasinifi':n.includes('ilkokul')?'ilkokul':'aksam'};
 function parseCSV(text,delimiter){
  const rows=[];let record=[],value='',quoted=false;
  text=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(ch==='"'){
    if(quoted&&text[i+1]==='"'){value+='"';i++}
    else quoted=!quoted;
   }else if(ch===delimiter&&!quoted){record.push(value);value=''}
   else if((ch==='\n'||ch==='\r')&&!quoted){
    if(ch==='\r'&&text[i+1]==='\n')i++;
    record.push(value);if(record.some(x=>x.trim()!==''))rows.push(record);record=[];value='';
   }else value+=ch;
  }
  if(quoted)throw Error('CSV dosyasında kapanmamış tırnak var.');
  record.push(value);if(record.some(x=>x.trim()!==''))rows.push(record);
  return rows;
 }
 function detectDelimiter(text){
  const header=String(text).split(/\r?\n/,1)[0]||'';
  return [';',',','\t'].map(d=>({d,n:parseCSV(header,d)[0]?.length||0})).sort((a,b)=>b.n-a.n)[0].d;
 }
 const st={open:false,busy:false,preview:[],fileName:'',columns:[],issues:[],summary:null,ready:false};
 function clear(){st.preview=[];st.columns=[];st.issues=[];st.summary=null;st.ready=false;st.fileName=''}
 function cancel(){st.open=false;clear();render()}
 function buildMap(header){
  const map={};header.forEach((h,i)=>{const field=aliases[norm(h)];if(field&&map[field]===undefined)map[field]=i});return map;
 }
 function candidate(row,idx,map){
  const get=k=>map[k]===undefined?'':safeValue(row[map[k]]);
  const id=get('source_record_id').replace(/\.0$/,'');
  const name=get('full_name');
  if(!id||name.length<2)return {error:'Satır '+idx+': ID veya ad soyad eksik',index:idx};
  const aDate=partsDate(get('appointment_date')),cDate=partsDate(get('contact_date')),fuDate=partsDate(get('followup_date'));
  const age=parseNumber(get('age')),grade=parseNumber(get('grade')),aol=parseNumber(get('aol_credit')),amount=parseNumber(get('quoted_amount'));
  const problem=[];
  if(get('appointment_date')&&!aDate.date)problem.push('randevu tarihi');
  if(!cDate.date)problem.push('görüşme tarihi (zorunlu veya geçersiz)');
  if(!blankNumeric(get('age'))&&age===null||age!==null&&(age>120||!Number.isInteger(age)))problem.push('yaş');
  if(!blankNumeric(get('grade'))&&grade===null||grade!==null&&(grade>13||!Number.isInteger(grade)))problem.push('sınıf');
  if(!blankNumeric(get('aol_credit'))&&aol===null||aol!==null&&(aol>1000||!Number.isInteger(aol)))problem.push('kredi');
  if(!blankNumeric(get('quoted_amount'))&&amount===null||amount!==null&&amount>1000000000)problem.push('rakam');
  if(problem.length)return {error:'Satır '+idx+': Geçersiz '+problem.join(', '),index:idx};
  const education=get('education_status');
  let phone=get('phone').replace(/[^\d+]/g,'');
  if(/^5\d{9}$/.test(phone))phone='0'+phone;
  const originalOutcome=get('outcome'),textOutcome=norm(originalOutcome),outcome=statusNames[textOutcome]||'beklemede';
  const notes=get('notes')+(originalOutcome&&!statusNames[textOutcome]?'\nAppSheet özgün sonuç: '+originalOutcome:'');
  return {row:{
    workspace_id:WS,source_record_id:id,full_name:name.slice(0,200),phone:phone.slice(0,30),
    education_status:education.slice(0,200),school_unit:inferredSchool(education),
    age,grade,aol_credit:aol,quoted_amount:amount,province:get('province')||'İstanbul',
    district:get('district'),staff_name:get('staff_name'),contact_date:cDate.date,
    first_contact:get('first_contact'),appointment_date:aDate.date,
    appointment_time:parseTime(get('appointment_time'))||aDate.time,
    branch:get('branch')||'OFİS',outcome,notes,followup_date:fuDate.date,
    created_by:state.user.id
  },index:idx};
 }
 async function inspectFile(file){
  if(!isAdmin())throw Error('İçe aktarma yetkisi yalnızca Admin ve Yöneticidedir.');
  if(!file||!/\.csv$/i.test(file.name))throw Error('Google Sheets dosyasını CSV olarak dışa aktarın. Sadece .csv kabul edilir.');
  if(file.size>8*1024*1024)throw Error('Dosya en fazla 8 MB olabilir.');
  const text=await file.text();const raw=parseCSV(text,detectDelimiter(text));
  if(raw.length<2)throw Error('CSV içinde başlık satırı ve en az bir kayıt bulunmalı.');
  if(raw.length>15001)throw Error('Tek aktarımda en fazla 15.000 kayıt destekleniyor.');
  const map=buildMap(raw[0]);
  if(map.source_record_id===undefined||map.full_name===undefined)
   throw Error('Gerekli ID ve VELİ/ÖĞRENCİ ADI SOYADI sütunları bulunamadı.');
  const seen=new Set(),existing=new Set(getRows().map(r=>r.source_record_id).filter(Boolean));
  const preview=[],issues=[];let duplicate=0,invalid=0;
  raw.slice(1).forEach((record,i)=>{
    const parsed=candidate(record,i+2,map);
    if(parsed.error){invalid++;if(issues.length<15)issues.push(parsed.error);return}
    const id=parsed.row.source_record_id;
    if(seen.has(id)||existing.has(id)){duplicate++;return}
    seen.add(id);preview.push(parsed.row);
  });
  st.preview=preview;st.columns=Object.keys(map);st.issues=issues;st.fileName=file.name;
  st.summary={total:raw.length-1,valid:preview.length,duplicate,invalid};
  st.ready=true;render();
 }
 function view(){
  const s=st.summary;
  return '<section class="panel appt-import-panel"><div class="appt-form-head"><h2>Google Sheets / AppSheet · CSV Aktarımı</h2><button class="btn" id="apptImportBack" type="button">← Randevu Merkezine Dön</button></div>'+
   '<p class="muted small">Google Sheets → Dosya → İndir → Virgülle ayrılmış değerler (.csv). Dosya yalnızca bu tarayıcıda okunur; onaylamadan kayıt oluşturulmaz.</p>'+
   '<label class="appt-import-file">CSV dosyanızı seçin<input type="file" id="apptImportFile" accept=".csv,text/csv" '+(st.busy?'disabled':'')+'></label>'+
   (s?'<div class="appt-stats appt-import-summary">'+[
    ['Dosyadaki satır',s.total],['Aktarılabilir',s.valid],['Mükerrer ID',s.duplicate],['Hatalı satır',s.invalid]
   ].map(([k,v])=>'<div class="appt-metric"><small>'+k+'</small><strong>'+v+'</strong></div>').join('')+'</div>'+
   '<p><b>Dosya:</b> '+esc(st.fileName)+' · <b>Eşleşen sütun:</b> '+st.columns.length+'</p>'+
   (st.issues.length?'<details><summary>Hatalı kayıtlar ('+s.invalid+')</summary><p>'+st.issues.map(esc).join(' · ')+'</p></details>':'')+
   '<div class="appt-table-wrap"><table class="appt-table"><thead><tr><th>ID</th><th>Ad Soyad</th><th>Eğitim</th><th>Görüşme Tarihi</th><th>Randevu</th><th>Sonuç</th></tr></thead><tbody>'+
   st.preview.slice(0,8).map(r=>'<tr><td>'+esc(r.source_record_id)+'</td><td>'+esc(r.full_name)+'</td><td>'+esc(r.education_status)+'</td><td>'+esc(r.contact_date)+'</td><td>'+esc(r.appointment_date||'—')+'</td><td>'+esc(r.outcome)+'</td></tr>').join('')+
   '</tbody></table></div><p class="appt-counter">Önizlemede ilk 8 aktarılabilir kayıt gösteriliyor. Mevcut ID numaraları atlanır; mevcut kayıtlar değiştirilmez.</p>'+
   '<label class="appt-import-confirm"><input type="checkbox" id="apptImportApprove" '+(st.busy?'disabled':'')+'> '+s.valid+' yeni randevunun Ortak Takip’e eklenmesini onaylıyorum.</label>'+
   '<button type="button" class="btn primary" id="apptImportCommit" disabled>'+(st.busy?'Aktarılıyor…':'Onayla ve İçe Aktar')+'</button>'+
   '<p id="apptImportProgress" role="status" class="muted small"></p>':'')+'</section>';
 }
 async function commit(){
  if(!st.ready||!st.preview.length||st.busy||!isAdmin()||!document.getElementById('apptImportApprove')?.checked)return;
  if(!confirm(st.preview.length+' yeni randevu Ortak Takip sistemine aktarılsın mı? Mevcut kayıtlar değiştirilmez.'))return;
  st.busy=true;let imported=0;
  const button=document.getElementById('apptImportCommit');if(button)button.disabled=true;
  try{
   await requireActiveSession();
   for(let i=0;i<st.preview.length;i+=100){
    const batch=st.preview.slice(i,i+100);
    const {error:err}=await sb.from('appointments').insert(batch);
    if(err)throw err;
    imported+=batch.length;
    const progress=document.getElementById('apptImportProgress');
    if(progress)progress.textContent=imported+' / '+st.preview.length+' randevu aktarıldı.';
   }
   clear();st.open=false;await reload();toast(imported+' randevu başarıyla içe aktarıldı.');
  }catch(e){error(e);toast(imported+' kayıt aktarıldı. Hata sonrası işlemi yeniden deneyin: ID eşleştirmesi mükerrerleri atlayacaktır.');st.ready=false}
  finally{st.busy=false;if(st.open)render()}
 }
 function bind(){
  document.getElementById('apptImportBack')?.addEventListener('click',cancel);
  document.getElementById('apptImportFile')?.addEventListener('change',async e=>{
    try{clear();const file=e.target.files?.[0];if(file)await inspectFile(file)}
    catch(ex){clear();error(ex);render()}
  });
  document.getElementById('apptImportApprove')?.addEventListener('change',e=>{
    const b=document.getElementById('apptImportCommit');if(b)b.disabled=!e.target.checked||!st.summary?.valid||st.busy;
  });
  document.getElementById('apptImportCommit')?.addEventListener('click',commit);
 }
 return {show:()=>{st.open=true;render()},cancel,view,bind,isOpen:()=>st.open,reset:()=>{st.open=false;clear();}};
}
