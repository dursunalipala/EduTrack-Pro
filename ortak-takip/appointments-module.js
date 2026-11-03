/* Ortak Takip | Randevu Modülü
 * Sheet benzeri icmal + takvim + geçmiş, mevcut Supabase oturumu ve RLS ile.
 * Dosyalar yalnızca erişim izinleri ayrı yönetilen HTTPS bağlantılarıdır.
 */
import {createAppointmentImporter} from './appointments-import.js';
import {createAppointmentFollowup} from './appointments-followup.js';
export function createAppointmentModule({sb,WS,state,esc,toast,error,requireActiveSession,render}){
 const statuses=[
  ['kayit','Kayıt','✓','#138851'],['on_kayit','Ön Kayıt','☑','#a67d06'],
  ['baska_okula_kayit','Başka Okula Kayıt','⊘','#bb4450'],['ilk_randevu','İlk Randevu','◆','#008c91'],
  ['olumsuz','Olumsuz','−','#b5424d'],['cevap_yok','Cevap Yok','⌁','#a24589'],
  ['dusunecek','Düşünecek','⌛','#8062a3'],['erteleme','Erteleme','◷','#b78a13'],
  ['orgun','Örgün','♧','#0a7e80'],['yas_hatasi','Yaş Hatası','◴','#a77709'],
  ['beklemede','Beklemede','•','#64748b']
 ];
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const dateLabel=x=>{if(!x)return '—';const a=x.slice(0,10).split('-');return a.length===3?a[2]+'.'+a[1]+'.'+a[0]:'—'};
 const dtLabel=x=>x?dateLabel(x)+(x.includes('T')?' '+x.slice(11,16):''):'—';
 const money=x=>(x===null||x===undefined||x==='')?'—':Number(x).toLocaleString('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2});
 const statusObj=x=>statuses.find(s=>s[0]===x)||statuses[10];
 const statusBadge=x=>{const a=statusObj(x);return '<span class="appt-status" style="--appt-color:'+a[3]+'"><span aria-hidden="true">'+a[2]+'</span> '+esc(a[1])+'</span>'};
 const cell=x=>esc(x??'—');
 const phoneDigits=x=>{let d=String(x||'').replace(/\D/g,'');if(/^0?5\d{9}$/.test(d))d='90'+d.slice(-10);return d.length>=10&&d.length<=15?d:''};
 const phoneButtons=r=>followup.quickActions(r);
 const blank=()=>({full_name:'',education_status:'',school_unit:'aksam',followup_date:'',age:'',grade:'',aol_credit:'',quoted_amount:'',province:'İstanbul',district:'',phone:'',staff_user_id:'',staff_name:'',contact_date:today(),first_contact:'',appointment_date:'',appointment_time:'',branch:'SLT',outcome:'beklemede',notes:'',identity_document_url:'',document_url:''});
 const S=()=>state.appointmentsModule||(state.appointmentsModule={rows:[],loaded:false,loading:false,ownerId:null,tab:'icmal',page:1,search:'',result:'all',school:'all',branch:'all',order:'latest',calendarMode:'month',calendarDate:today(),selectedDay:today(),form:false,editingId:null,archive:false});
 const importer=createAppointmentImporter({sb,WS,state,esc,toast,error,requireActiveSession,render,reload:()=>load(true),getRows:()=>S().rows,today});
 const followup=createAppointmentFollowup({sb,WS,state,esc,toast,error,requireActiveSession,render,getRow:id=>S().rows.find(r=>r.id===id),getPhone:phoneDigits});
 const mayEdit=r=>['owner','manager'].includes(state.role)||state.role==='member'&&(r.created_by===state.user?.id||r.staff_user_id===state.user?.id);
 const mayArchive=()=>['owner','manager'].includes(state.role);
 const activeRows=()=>S().rows.filter(r=>S().archive?!!r.deleted_at:!r.deleted_at);
 const filterRows=()=>{
  const s=S();const search=s.search.trim().toLocaleLowerCase('tr-TR');
  let rows=activeRows().filter(r=>(s.result==='all'||r.outcome===s.result)&&(s.school==='all'||r.school_unit===s.school)&&(s.branch==='all'||r.branch===s.branch)&&(!search||[r.full_name,r.phone,r.district,r.province,r.first_contact,r.staff_name,r.notes,r.source_record_id].some(v=>String(v||'').toLocaleLowerCase('tr-TR').includes(search))));
  if(s.tab==='gecmis')rows=rows.filter(r=>r.appointment_date&&r.appointment_date<today());
  const key=s.order;rows.sort((a,b)=>{
   if(key==='latest')return (Number(b.source_record_id)||0)-(Number(a.source_record_id)||0)||(b.created_at||'').localeCompare(a.created_at||'');
   if(key==='name')return a.full_name.localeCompare(b.full_name,'tr');
   if(key==='amount')return (Number(b.quoted_amount)||0)-(Number(a.quoted_amount)||0);
   if(key==='contact')return (b.contact_date||'').localeCompare(a.contact_date||'');
   return ((a.appointment_date||'9999')+' '+(a.appointment_time||'')).localeCompare((b.appointment_date||'9999')+' '+(b.appointment_time||''));
  });
  return rows;
 };
 async function load(force=false){
  let s=S();const uid=state.user?.id;
  if(!uid)return;
  if(s.ownerId!==uid){reset();s=S();s.ownerId=uid}
  if(s.loading||s.loaded&&!force)return;
  s.loading=true;
  try{
   await requireActiveSession();
   const rows=[];let from=0;
   while(true){
    const {data,error:err}=await sb.from('appointments').select('*').eq('workspace_id',WS)
      .order('created_at',{ascending:false}).range(from,from+499);
    if(err)throw err;
    rows.push(...(data||[]));
    if(!data||data.length<500||from>=9500)break;
    from+=500;
   }
   s.rows=rows;s.loaded=true;
  }catch(e){error(e)}
  finally{s.loading=false;if(state.view==='appointments')render()}
 }
 function report(){
  const records=activeRows().filter(r=>!r.deleted_at);
  const total=records.length;
  const registered=records.filter(r=>['kayit','on_kayit'].includes(r.outcome)).length;
  const pending=records.filter(r=>['beklemede','ilk_randevu','erteleme','dusunecek'].includes(r.outcome)).length;
  const future=records.filter(r=>r.appointment_date&&r.appointment_date>=today()).length;
  const late=records.filter(r=>r.followup_date&&r.followup_date<today()&&!['kayit','on_kayit','olumsuz','baska_okula_kayit'].includes(r.outcome)).length;
  const potential=records.reduce((sum,r)=>sum+(Number(r.quoted_amount)||0),0);
  return {total,registered,pending,future,late,potential};
 }
 function stats(){
  const r=report();
  return '<div class="appt-stats"><div class="appt-metric"><small>Toplam Görüşme</small><strong>'+r.total+'</strong></div><div class="appt-metric"><small>Kayıt / Ön Kayıt</small><strong>'+r.registered+'</strong></div><div class="appt-metric"><small>Takip Bekleyen</small><strong>'+r.pending+'</strong></div><div class="appt-metric"><small>Bugün ve Sonrası</small><strong>'+r.future+'</strong></div><div class="appt-metric"><small>Geciken Aramalar</small><strong>'+r.late+'</strong></div><div class="appt-metric"><small>Görüşme Tutarları</small><strong class="appt-money">'+money(r.potential)+'</strong></div></div>';
 }
 function toolbar(){
  const s=S(),branches=[...new Set(s.rows.map(r=>r.branch).filter(Boolean))].sort();
  return '<div class="appt-toolbar"><div class="appt-actions-row"><button type="button" class="btn primary" id="apptNew">＋ Yeni Randevu</button><div class="appt-utility-row">'+(mayArchive()?'<button type="button" class="btn" id="apptImport">↑ İçe Aktar</button>':'')+'<button type="button" class="btn" id="apptExport">↓ CSV / Excel</button><button type="button" class="btn" id="apptPrint">⎙ Yazdır</button><button type="button" class="btn" id="apptReload">↻ Yenile</button></div></div><div class="appt-filters">'+
   '<input id="apptSearch" type="search" placeholder="Ad, telefon, not veya ilçe ara…" value="'+esc(s.search)+'" aria-label="Randevu ara">'+
   '<select id="apptResult" aria-label="Sonuç filtresi"><option value="all">Tüm sonuçlar</option>'+statuses.map(x=>'<option value="'+x[0]+'"'+(s.result===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+
   '<select id="apptSchool" aria-label="Kurum filtresi"><option value="all">Tüm kurumlar</option>'+[['aksam','Akşam Lisesi'],['ilkokul','İlkokul'],['anasinifi','Anaokulu'],['ortak','Ortak']].map(x=>'<option value="'+x[0]+'"'+(s.school===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+ 
   '<select id="apptBranch" aria-label="Şube filtresi"><option value="all">Tüm şubeler</option>'+branches.map(x=>'<option value="'+esc(x)+'"'+(s.branch===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>'+
   '<select id="apptOrder" aria-label="Sıralama"><option value="latest"'+(s.order==='latest'?' selected':'')+'>En son eklenen / ID ↓</option><option value="randevu"'+(s.order==='randevu'?' selected':'')+'>Randevu tarihine göre</option><option value="contact"'+(s.order==='contact'?' selected':'')+'>Görüşme tarihine göre</option><option value="name"'+(s.order==='name'?' selected':'')+'>Ad A-Z</option><option value="amount"'+(s.order==='amount'?' selected':'')+'>Tutar (yüksekten)</option></select>'+
   (mayArchive()?'<label class="appt-check"><input type="checkbox" id="apptArchive"'+(s.archive?' checked':'')+'> Arşiv</label>':'')+
   '</div></div>';
 }
 function sheet(){
  const allRows=filterRows(),pageSize=50,pages=Math.max(1,Math.ceil(allRows.length/pageSize));
  const page=Math.max(1,Math.min(Number(S().page||1),pages));S().page=page;
  const rows=allRows.slice((page-1)*pageSize,page*pageSize);
  const header=['ID','Veli / Öğrenci','İletişim','Kurum','Eğitim Durumu','Yaş','Sınıf','AÖL Kredi','Rakam','İl','İlçe','Görüşen Kişi','Görüşme Tarihi','İlk Görüşme','Randevu Tarihi','Randevu Saati','Randevu Şubesi','Randevu Sonucu','Notlar','Kimlik / Evrak','İşlem'];
  const tr=rows.map(r=>'<tr class="appt-data-row"><td class="appt-id">#'+esc(r.source_record_id||'—')+'</td><td class="appt-name"><button type="button" class="appt-name-btn" data-appt-edit="'+r.id+'">'+esc(r.full_name)+'</button><small>'+esc(r.source_record_id||'')+'</small></td>'+
   '<td>'+esc(r.phone||'—')+phoneButtons(r)+'</td><td>'+esc(({aksam:'Akşam Lisesi',ilkokul:'İlkokul',anasinifi:'Anaokulu',ortak:'Ortak'})[r.school_unit]||'—')+'</td><td>'+cell(r.education_status||'—')+'</td>'+
   '<td>'+cell(r.age)+'</td><td>'+cell(r.grade)+'</td><td>'+cell(r.aol_credit)+'</td><td>'+money(r.quoted_amount)+'</td>'+
   '<td>'+cell(r.province||'—')+'</td><td>'+cell(r.district||'—')+'</td><td>'+esc(r.staff_name||'—')+'</td>'+
   '<td>'+dateLabel(r.contact_date)+'</td><td class="appt-truncate" title="'+esc(r.first_contact||'')+'">'+esc(r.first_contact||'—')+'</td>'+
   '<td>'+dateLabel(r.appointment_date)+'</td><td>'+esc((r.appointment_time||'').slice(0,8)||'—')+'</td><td>'+esc(r.branch||'—')+'</td>'+
   '<td>'+(mayEdit(r)?'<select class="appt-quick-result" data-appt-quick="'+r.id+'" aria-label="Randevu sonucunu değiştir">'+statuses.map(v=>'<option value="'+v[0]+'"'+(v[0]===r.outcome?' selected':'')+'>'+esc(v[1])+'</option>').join('')+'</select>':statusBadge(r.outcome))+'</td><td class="appt-truncate" title="'+esc(r.notes||'')+'">'+esc(r.notes||'—')+'</td>'+
   '<td>'+[r.identity_document_url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(r.identity_document_url)+'">Kimlik</a>':'',r.document_url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(r.document_url)+'">Evrak</a>':''].filter(Boolean).join(' · ')+'</td>'+
   '<td><button type="button" class="btn sm" data-appt-edit="'+r.id+'">Aç</button> '+(mayArchive()?(r.deleted_at?'<button type="button" class="btn sm" data-appt-restore="'+r.id+'">Geri Al</button>':'<button type="button" class="btn sm" data-appt-archive="'+r.id+'">Arşivle</button>'):'')+'</td></tr>').join('');
  return '<div class="appt-table-wrap"><table class="appt-table"><thead><tr>'+header.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+tr+'</tbody></table></div>'+
   '<div class="appt-pagination"><span>'+allRows.length+' kaydın '+(allRows.length?((page-1)*pageSize+1):0)+'–'+Math.min(page*pageSize,allRows.length)+' arası · Sütunları sağa/sola kaydırabilirsiniz.</span><div><button class="btn sm" id="apptPagePrev" '+(page<=1?'disabled':'')+'>‹ Önceki</button><span>Sayfa '+page+' / '+pages+'</span><button class="btn sm" id="apptPageNext" '+(page>=pages?'disabled':'')+'>Sonraki ›</button></div></div>';
 }
 function monthAdd(isoDate,mode,num){
  const a=isoDate.split('-').map(Number),d=new Date(a[0],a[1]-1,a[2],12);
  if(mode==='month')d.setMonth(d.getMonth()+num);else d.setDate(d.getDate()+num*(mode==='week'?7:1));
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 }
 function calendar(){
  const s=S(),d=s.calendarDate.split('-').map(Number),basis=new Date(d[0],d[1]-1,d[2],12);
  let start,count,heading;
  if(s.calendarMode==='month'){start=new Date(d[0],d[1]-1,1,12);count=42;start.setDate(start.getDate()-((start.getDay()+6)%7));heading=basis.toLocaleDateString('tr-TR',{month:'long',year:'numeric'});}
  else if(s.calendarMode==='week'){start=new Date(basis);start.setDate(start.getDate()-((start.getDay()+6)%7));count=7;heading='Hafta · '+start.toLocaleDateString('tr-TR');}
  else{start=basis;count=1;heading=basis.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
  const rows=activeRows().filter(r=>!r.deleted_at&&r.appointment_date);
  const days=Array.from({length:count},(_,i)=>{
   const day=new Date(start);day.setDate(start.getDate()+i);
   const id=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
   const items=rows.filter(r=>r.appointment_date===id).sort((a,b)=>(a.appointment_time||'').localeCompare(b.appointment_time||''));
   return '<button type="button" class="appt-day'+(id===today()?' today':'')+(id===s.selectedDay?' selected':'')+(day.getMonth()!==basis.getMonth()&&count===42?' other':'')+'" data-appt-date="'+id+'"><span class="appt-daynum">'+(count===1?day.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric'}):day.getDate())+'</span>'+items.slice(0,count===1?12:2).map(r=>'<span class="appt-dayentry" title="'+esc(r.full_name)+'">'+esc((r.appointment_time||'').slice(0,5))+' '+esc(r.full_name)+'</span>').join('')+(items.length>(count===1?12:2)?'<span class="appt-more">+'+(items.length-(count===1?12:2))+' diğer</span>':'')+'</button>';
  }).join('');
  const selected=rows.filter(r=>r.appointment_date===s.selectedDay).sort((a,b)=>(a.appointment_time||'').localeCompare(b.appointment_time||''));
  return '<div class="appt-calbar"><div class="appt-toolbar-group"><button class="btn sm" id="apptPrev">‹</button><button class="btn sm" id="apptCurrent">Bugün</button><button class="btn sm" id="apptNext">›</button><b>'+esc(heading)+'</b></div><div class="appt-toolbar-group"><button class="btn sm'+(s.calendarMode==='day'?' primary':'')+'" data-appt-mode="day">Gün</button><button class="btn sm'+(s.calendarMode==='week'?' primary':'')+'" data-appt-mode="week">Hafta</button><button class="btn sm'+(s.calendarMode==='month'?' primary':'')+'" data-appt-mode="month">Ay</button></div></div>'+
  '<div class="appt-calgrid">'+(count>1?['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(t=>'<div class="appt-dow">'+t+'</div>').join(''):'')+days+'</div>'+
  '<div class="appt-daydetail"><h3>'+dateLabel(s.selectedDay)+' · '+selected.length+' randevu</h3>'+
  (selected.map(r=>'<div class="appt-event"><div><b>'+esc((r.appointment_time||'').slice(0,5)||'Saat yok')+' · '+esc(r.full_name)+'</b><div>'+statusBadge(r.outcome)+' <span class="muted">'+esc(r.branch||'')+'</span></div></div><div>'+phoneButtons(r)+'<button type="button" class="btn sm" data-appt-edit="'+r.id+'">Detay</button></div></div>').join('')||'<p class="muted">Bu güne ait randevu bulunmuyor.</p>')+'</div>';
 }

 function analysis(){
  const rows=filterRows();
  const total=rows.length;
  const conversion=total?Math.round(100*rows.filter(r=>r.outcome==='kayit').length/total):0;
  const sum=rows.reduce((a,r)=>a+(Number(r.quoted_amount)||0),0);
  const byStatus=statuses.map(([id,label])=>({label,count:rows.filter(r=>r.outcome===id).length}));
  const schoolLabels={aksam:'Akşam Lisesi',ilkokul:'İlkokul',anasinifi:'Anaokulu',ortak:'Ortak'};
  const bySchool=Object.entries(schoolLabels).map(([id,label])=>({label,count:rows.filter(r=>(r.school_unit||'aksam')===id).length}));
  const byPerson=[...new Set(rows.map(r=>r.staff_name?.trim()||'Belirtilmemiş'))]
   .map(name=>({label:name,count:rows.filter(r=>(r.staff_name?.trim()||'Belirtilmemiş')===name).length}))
   .sort((a,b)=>b.count-a.count).slice(0,12);
  const byMonth=[...new Set(rows.map(r=>r.contact_date?.slice(0,7)).filter(Boolean))].sort().reverse().slice(0,12).reverse()
   .map(m=>({label:m.split('-').reverse().join('.'),count:rows.filter(r=>r.contact_date?.startsWith(m)).length}));
  const chart=(title,items)=>'<section class="panel appt-analysis-panel"><h2>'+esc(title)+'</h2><div class="appt-report-bars">'+
   (items.filter(x=>x.count>0).map(x=>'<div class="appt-report-row"><span title="'+esc(x.label)+'">'+esc(x.label)+'</span>'+
    '<div class="appt-report-track"><i style="width:'+Math.min(100,100*x.count/Math.max(1,total))+'%"></i></div><b>'+x.count+'</b></div>').join('')||'<p class="muted small">Bu filtrede kayıt yok.</p>')+
   '</div></section>';
  return '<div class="appt-analytics-header"><div><h2>Kayıt ve Randevu Analizi</h2><p class="muted small">Yukarıdaki filtreler bu raporlara uygulanır. Kayıt dönüşümü kesin kayıt / toplam görüşme oranıdır.</p></div>'+
   '<div><strong>'+conversion+'%</strong><small>Kayıt dönüşüm oranı</small></div></div>'+
   '<div class="appt-stats"><div class="appt-metric"><small>Filtrelenen Görüşme</small><strong>'+total+'</strong></div>'+
   '<div class="appt-metric"><small>Kesin Kayıt</small><strong>'+rows.filter(r=>r.outcome==='kayit').length+'</strong></div>'+
   '<div class="appt-metric"><small>Ön Kayıt</small><strong>'+rows.filter(r=>r.outcome==='on_kayit').length+'</strong></div>'+
   '<div class="appt-metric"><small>Görüşülen Tutar (Gelir Değil)</small><strong>'+money(sum)+'</strong></div></div>'+
   '<div class="appt-analysis-grid">'+chart('Randevu Sonuçları',byStatus)+chart('Kurumlara Göre',bySchool)+
    chart('Görüşen Kişiye Göre',byPerson)+chart('Görüşme Ayları',byMonth)+'</div>';
 }
 const inp=(label,name,type,value,required=false)=>'<label>'+label+(required?' <em>*</em>':'')+'<input name="'+name+'" type="'+type+'" value="'+esc(value??'')+'"'+(required?' required':'')+(type==='number'?' min="0"':'')+'></label>';
 const area=(label,name,value,rows=2)=>'<label class="appt-wide">'+label+'<textarea name="'+name+'" rows="'+rows+'">'+esc(value||'')+'</textarea></label>';
 function editForm(){
  const s=S(),r=s.editingId?s.rows.find(x=>x.id===s.editingId):null;
  if(r&&!mayEdit(r))return '<div class="panel">Bu randevuyu düzenleme yetkiniz bulunmuyor. <button type="button" class="btn" id="apptCancel">Geri dön</button></div>';
  const d=r||blank();
  const nextNumber=['owner','manager'].includes(state.role)?'#'+(Math.max(0,...s.rows.map(x=>Number(x.source_record_id)||0))+1):'Otomatik';
  const staffOptions=state.members.filter(m=>m.is_active).map(m=>{const p=state.profiles.find(p=>p.id===m.user_id);return '<option value="'+esc(m.user_id)+'"'+(d.staff_user_id===m.user_id?' selected':'')+'>'+esc(p?.full_name||m.user_id.slice(0,8))+'</option>'}).join('');
  const resultButtons=statuses.map(a=>'<label class="appt-result-option"><input type="radio" name="outcome" value="'+a[0]+'"'+(d.outcome===a[0]?' checked':'')+'><span style="--appt-color:'+a[3]+'">'+a[2]+' '+esc(a[1])+'</span></label>').join('');
  return '<section class="appt-form"><div class="appt-form-head"><h2>'+(r?'Randevu Düzenle':'Yeni Randevu')+'</h2><button type="button" class="btn" id="apptCancel">← İcmale Dön</button></div><p class="muted small">* işaretli alanlar zorunludur. Belgeler için dosya yüklemek yerine kurumca yetkilendirilmiş bağlantı girin.</p>'+
  '<div class="appt-form-actions">'+(r?phoneButtons(r):'')+'</div><form id="apptForm" class="appt-form-grid">'+
  '<div class="appt-wide appt-new-id"><span>Kayıt ID</span><strong>'+esc(r?.source_record_id?'#'+r.source_record_id:nextNumber)+'</strong><small>'+(r?'Değiştirilemez':'Kaydederken veritabanı tarafından otomatik ve güvenli oluşturulur.')+'</small></div>'+
  inp('Veli / Öğrenci Adı Soyadı','full_name','text',d.full_name,true)+inp('Telefon','phone','tel',d.phone,true)+
  '<label>Kurum<select name="school_unit">'+[['aksam','Akşam Lisesi'],['ilkokul','İlkokul'],['anasinifi','Anaokulu'],['ortak','Ortak']].map(v=>'<option value="'+v[0]+'"'+(v[0]===(d.school_unit||'aksam')?' selected':'')+'>'+v[1]+'</option>').join('')+'</select></label>'+inp('Eğitim Durumu','education_status','text',d.education_status)+inp('Yaş','age','number',d.age)+
  inp('Sınıf','grade','number',d.grade)+inp('AÖL Kredisi','aol_credit','number',d.aol_credit)+
  inp('Görüşülen Rakam (₺)','quoted_amount','number',d.quoted_amount)+inp('İl','province','text',d.province)+
  inp('İlçe','district','text',d.district)+inp('Görüşen Kişi (Ad)','staff_name','text',d.staff_name)+
  '<label>İlgili Personel<select name="staff_user_id"><option value="">Personel seçilmedi</option>'+staffOptions+'</select></label>'+
  inp('Görüşme Tarihi','contact_date','date',d.contact_date,true)+
  area('İlk Görüşme / Kaynak','first_contact',d.first_contact)+
  inp('Randevu Tarihi','appointment_date','date',d.appointment_date)+inp('Randevu Saati','appointment_time','time',(d.appointment_time||'').slice(0,5))+
  inp('Randevu Şubesi','branch','text',d.branch)+inp('Sonraki Arama / Takip Tarihi','followup_date','date',d.followup_date)+
  '<fieldset class="appt-wide appt-result"><legend>Randevu Sonucu</legend><div class="appt-result-grid">'+resultButtons+'</div></fieldset>'+
  area('Notlar','notes',d.notes,4)+
  inp('Kimlik Belgesi HTTPS Bağlantısı','identity_document_url','url',d.identity_document_url)+
  inp('Evrak HTTPS Bağlantısı','document_url','url',d.document_url)+
  '<div class="appt-wide appt-form-bottom"><button type="button" class="btn" id="apptCancelBottom">Vazgeç</button><button type="submit" class="btn primary" id="apptSave">Kaydet</button></div></form></section>';
 }
 function view(){
  const s=S();
  if(!state.user||s.ownerId!==state.user.id)return '<section class="panel"><h2>Randevu Merkezi</h2><p class="muted">Oturum randevu kayıtları için hazırlanıyor…</p></section>';
  if(!s.loaded)return '<section class="panel"><h2>Randevu Merkezi</h2><p class="muted">'+(s.loading?'Randevular alınıyor…':'Randevu verileri yükleniyor…')+'</p></section>';
  if(importer.isOpen())return importer.view();
  return '<div class="appt-root">'+(s.form?editForm():'<div class="appt-intro"><div><h2>Elit Randevu Merkezi</h2><p>AppSheet düzenini koruyan, Sheet benzeri kayıt ve randevu takibi</p></div><span class="appt-live">● Canlı Supabase</span></div>'+
   stats()+toolbar()+'<div class="appt-tabs"><button class="'+(s.tab==='icmal'?'active':'')+'" data-appt-tab="icmal">▤ Randevu İcmali</button><button class="'+(s.tab==='takvim'?'active':'')+'" data-appt-tab="takvim">▦ Takvim</button><button class="'+(s.tab==='gecmis'?'active':'')+'" data-appt-tab="gecmis">◷ Geçmiş Randevular</button><button class="'+(s.tab==='analiz'?'active':'')+'" data-appt-tab="analiz">▥ Kayıt Analizi</button></div>'+
   (s.tab==='takvim'?calendar():s.tab==='analiz'?analysis():sheet()))+'</div>'+followup.view();
 }
 async function quickStatus(el){
  const row=S().rows.find(r=>r.id===el.dataset.apptQuick);if(!row||!mayEdit(row))return;
  const previous=row.outcome,value=el.value;if(!statuses.some(x=>x[0]===value)){el.value=previous;return;}
  el.disabled=true;
  try{
   await requireActiveSession();
   const {data,error:err}=await sb.from('appointments').update({outcome:value,updated_at:new Date().toISOString()}).eq('workspace_id',WS).eq('id',row.id).select('id').single();
   if(err||!data)throw Error(err?.message||'Randevu güncellenemedi.');
   row.outcome=value;render();toast('Randevu sonucu güncellendi.');
  }catch(ex){el.value=previous;error(ex)}finally{el.disabled=false}
 }
 async function save(form){
  const btn=document.getElementById('apptSave');if(btn)btn.disabled=true;
  try{
   await requireActiveSession();
   const fd=new FormData(form), s=S();
   const str=x=>String(fd.get(x)||'').trim();
   const payload={full_name:str('full_name'),school_unit:str('school_unit')||'aksam',followup_date:str('followup_date')||null,education_status:str('education_status'),age:str('age')===''?null:Number(str('age')),grade:str('grade')===''?null:Number(str('grade')),
    aol_credit:str('aol_credit')===''?null:Number(str('aol_credit')),quoted_amount:str('quoted_amount')===''?null:Number(str('quoted_amount')),
    province:str('province'),district:str('district'),phone:str('phone'),staff_name:str('staff_name'),staff_user_id:str('staff_user_id')||null,
    contact_date:str('contact_date'),first_contact:str('first_contact'),appointment_date:str('appointment_date')||null,
    appointment_time:str('appointment_time')||null,branch:str('branch'),outcome:str('outcome')||'beklemede',notes:str('notes'),
    identity_document_url:str('identity_document_url')||null,document_url:str('document_url')||null};
   if(payload.full_name.length<2||!payload.phone||!payload.contact_date)throw Error('Ad soyad, telefon ve görüşme tarihi zorunludur.');
   if(!statuses.some(x=>x[0]===payload.outcome))throw Error('Geçerli bir sonuç seçiniz.');
   if(!['aksam','ilkokul','anasinifi','ortak'].includes(payload.school_unit))throw Error('Kurum seçimi geçersiz.');
   for(const key of ['identity_document_url','document_url'])if(payload[key]&&!/^https:\/\//i.test(payload[key]))throw Error('Belge bağlantıları HTTPS ile başlamalıdır.');
   for(const key of ['age','grade','aol_credit','quoted_amount'])if(payload[key]!==null&&(!Number.isFinite(payload[key])||payload[key]<0))throw Error('Sayısal alan geçersiz.');
   const old=s.rows.find(r=>r.id===s.editingId);
   if(old&&!mayEdit(old))throw Error('Düzenleme yetkisi bulunmuyor.');
   const result=old?await sb.from('appointments').update(payload).eq('workspace_id',WS).eq('id',old.id).select('id,source_record_id').single():
    await sb.from('appointments').insert({...payload,workspace_id:WS,created_by:state.user.id}).select('id,source_record_id').single();
   if(result.error)throw result.error;
   s.form=false;s.editingId=null;await load(true);toast(old?'Randevu güncellendi.':'#'+result.data.source_record_id+' numaralı randevu eklendi.');
  }catch(e){error(e)}finally{if(btn)btn.disabled=false}
 }
 async function archive(id,restore){
  const s=S(),r=s.rows.find(x=>x.id===id);if(!r||!mayArchive())return;
  if(!confirm(restore?'Kayıt arşivden çıkarılsın mı?':'Randevu arşivlensin mi? Veriler silinmeyecek.'))return;
  try{
   await requireActiveSession();
   const {error:e}=await sb.from('appointments').update({deleted_at:restore?null:new Date().toISOString(),deleted_by:restore?null:state.user.id}).eq('workspace_id',WS).eq('id',id);
   if(e)throw e;await load(true);toast(restore?'Kayıt geri yüklendi.':'Kayıt arşivlendi.');
  }catch(e){error(e)}
 }
 const exportColumns=[['source_record_id','ID'],['full_name','Veli / Öğrenci'],['education_status','Eğitim Durumu'],['age','Yaş'],['grade','Sınıf'],['aol_credit','AÖL Kredi'],['quoted_amount','Rakam'],['province','İl'],['district','İlçe'],['phone','Telefon'],['staff_name','Görüşen Kişi'],['contact_date','Görüşme Tarihi'],['first_contact','İlk Görüşme'],['appointment_date','Randevu Tarihi'],['appointment_time','Randevu Saati'],['branch','Randevu Şubesi'],['outcome','Randevu Sonucu'],['notes','Notlar'],['identity_document_url','Kimlik'],['document_url','Evrak']];
 function csv(){
  const safe=x=>{let t=String(x??'');if(/^[\s]*[=+\-@]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
  const rows=[exportColumns.map(x=>safe(x[1])).join(';'),...filterRows().map(r=>exportColumns.map(x=>safe(r[x[0]])).join(';'))];
  const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='elit-randevu-'+today()+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 }
 function bind(){
  let s=S();if(!state.user)return;
  if(s.ownerId!==state.user.id){reset();s=S();s.ownerId=state.user.id}
  if(importer.isOpen()){importer.bind();return;}
  if(!s.loaded){if(!s.loading)void load();return}
  if(followup.isOpen()){followup.bindModal();return;}
  followup.bindLaunch();
  if(s.form){
   for(const id of ['apptCancel','apptCancelBottom'])document.getElementById(id)?.addEventListener('click',()=>{s.form=false;s.editingId=null;render()});
   document.getElementById('apptForm')?.addEventListener('submit',e=>{e.preventDefault();void save(e.currentTarget)});
   return;
  }
  document.getElementById('apptNew')?.addEventListener('click',()=>{s.form=true;s.editingId=null;render()});
  document.getElementById('apptImport')?.addEventListener('click',()=>importer.show());
  document.querySelectorAll('[data-appt-quick]').forEach(el=>el.addEventListener('change',()=>void quickStatus(el)));
  document.getElementById('apptPagePrev')?.addEventListener('click',()=>{s.page=Math.max(1,s.page-1);render()});
  document.getElementById('apptPageNext')?.addEventListener('click',()=>{s.page=(s.page||1)+1;render()});
  document.getElementById('apptReload')?.addEventListener('click',()=>void load(true));
  document.getElementById('apptExport')?.addEventListener('click',csv);
  document.getElementById('apptPrint')?.addEventListener('click',()=>window.print());
  document.getElementById('apptArchive')?.addEventListener('change',e=>{s.archive=e.target.checked;render()});
  for(const [id,key] of [['apptResult','result'],['apptSchool','school'],['apptBranch','branch'],['apptOrder','order']])document.getElementById(id)?.addEventListener('change',e=>{s[key]=e.target.value;s.page=1;render()});
  document.getElementById('apptSearch')?.addEventListener('input',e=>{
   s.search=e.target.value;s.page=1;const pos=e.target.selectionStart;
   clearTimeout(s.searchTimer);s.searchTimer=setTimeout(()=>{if(state.view!=='appointments'||s.form)return;render();const input=document.getElementById('apptSearch');if(input){input.focus();input.setSelectionRange(pos,pos)}},180);
  });
  document.querySelectorAll('[data-appt-tab]').forEach(b=>b.addEventListener('click',()=>{s.tab=b.dataset.apptTab;s.page=1;render()}));
  document.querySelectorAll('[data-appt-edit]').forEach(b=>b.addEventListener('click',()=>{s.editingId=b.dataset.apptEdit;s.form=true;render()}));
  document.querySelectorAll('[data-appt-archive]').forEach(b=>b.addEventListener('click',()=>void archive(b.dataset.apptArchive,false)));
  document.querySelectorAll('[data-appt-restore]').forEach(b=>b.addEventListener('click',()=>void archive(b.dataset.apptRestore,true)));
  if(s.tab==='takvim'){
   document.querySelectorAll('[data-appt-mode]').forEach(b=>b.addEventListener('click',()=>{s.calendarMode=b.dataset.apptMode;render()}));
   document.querySelectorAll('[data-appt-date]').forEach(b=>b.addEventListener('click',()=>{s.selectedDay=b.dataset.apptDate;if(s.calendarMode==='day')s.calendarDate=s.selectedDay;render()}));
   document.getElementById('apptCurrent')?.addEventListener('click',()=>{s.calendarDate=today();s.selectedDay=today();render()});
   for(const [id,delta] of [['apptPrev',-1],['apptNext',1]])document.getElementById(id)?.addEventListener('click',()=>{s.calendarDate=monthAdd(s.calendarDate,s.calendarMode,delta);s.selectedDay=s.calendarDate;render()});
  }
 }
 function reset(){importer.reset();followup.reset();state.appointmentsModule={...S(),rows:[],loaded:false,loading:false,ownerId:null,form:false,editingId:null};}
 return {view,bind,load,reset,report};
}
