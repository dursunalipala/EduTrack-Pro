/* Ortak Takip - Randevu ve Kayıt Takip Merkezi
 * Dedicated Supabase table, no AppSheet access or undocumented automatic sync.
 * All writes are protected by database RLS and an active authenticated session.
 */
export function createAppointmentsModule(api) {
  const {sb,WS,state,esc,options,toast,error,requireActiveSession,render,canManage}=api;
  const $=id=>document.getElementById(id);
  const statuses=[['ilk_randevu','İlk Randevu'],['beklemede','Beklemede'],['dusunecek','Düşünecek'],['tekrar_aranacak','Tekrar Aranacak'],['kayit','Kayıt Yapıldı'],['olumsuz','Olumsuz'],['iptal','İptal']];
  const schools=[['aksam','Akşam Lisesi'],['ilkokul','İlkokul'],['anasinifi','Anaokulu'],['ortak','Ortak']];
  const schoolName=k=>schools.find(x=>x[0]===k)?.[1]||k;
  const resultName=k=>statuses.find(x=>x[0]===k)?.[1]||k;
  const S=()=>state.appointments||(state.appointments={rows:[],tab:'icmal',search:'',school:'all',result:'all',editing:null,formOpen:false,busy:false,loaded:false,selectedDay:''});
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const dateTR=s=>s?String(s).slice(0,10).split('-').reverse().join('.'):'—';
  const money=n=>n===null||n===undefined||n===''?'—':Number(n).toLocaleString('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2});
  const clock=s=>s?String(s).slice(0,5):'—';
  const labelHtml=(name,control)=>'<label><span>'+esc(name)+'</span>'+control+'</label>';
  const input=(name,value,type='text',extra='')=>'<input name="'+name+'" type="'+type+'" value="'+esc(value??'')+'" '+extra+'>';
  const select=(name,items,value)=>'<select name="'+name+'">'+options(items,value)+'</select>';
  const safeDigits=x=>{let d=String(x||'').replace(/\D/g,'');if(/^0\d{10}$/.test(d))d='9'+d;if(/^\d{10}$/.test(d))d='90'+d;return /^\d{10,15}$/.test(d)?d:''};
  const statusBadge=k=>'<span class="apt-status status-'+esc(k)+'">'+esc(resultName(k))+'</span>';
  function filtered() {
    const s=S(),q=s.search.trim().toLocaleLowerCase('tr-TR'),now=today();
    return s.rows.filter(r=>(s.school==='all'||r.school_unit===s.school)
      &&(s.result==='all'||r.result===s.result)
      &&(s.tab!=='gecmis'||(r.appointment_date&&r.appointment_date<now))
      &&(s.tab!=='takvim'||!s.selectedDay||r.appointment_date===s.selectedDay)
      &&(!q||[r.legacy_id,r.contact_name,r.contact_phone,r.education_status,r.staff_name,r.city,r.district,r.branch,r.first_contact_note,r.notes].some(v=>String(v??'').toLocaleLowerCase('tr-TR').includes(q))))
    .sort((a,b)=>(Number(b.legacy_id||0)-Number(a.legacy_id||0))||String(b.created_at).localeCompare(String(a.created_at)));
  }
  async function load() {
    const s=S(),all=[];
    for(let from=0;from<5000;from+=1000){
      const r=await sb.from('appointments').select('*').eq('workspace_id',WS).is('deleted_at',null)
        .order('created_at',{ascending:false}).range(from,from+999);
      if(r.error) { s.loaded=true; throw r.error; }
      all.push(...(r.data||[]));if((r.data||[]).length<1000)break;
    }
    s.rows=all;s.loaded=true;
  }
  function metrics(rows) {
    const total=rows.length,registered=rows.filter(r=>r.result==='kayit').length,
      waiting=rows.filter(r=>['beklemede','ilk_randevu','tekrar_aranacak','dusunecek'].includes(r.result)).length,
      pastDue=rows.filter(r=>r.followup_date&&r.followup_date<today()&&!['kayit','olumsuz','iptal'].includes(r.result)).length;
    return {total,registered,waiting,pastDue,rate:total?Math.round(100*registered/total):0};
  }
  const kpi=(name,value,subtitle,cls='')=>'<div class="apt-kpi '+cls+'"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong><small>'+esc(subtitle)+'</small></div>';
  function toolbar() {
    const s=S();
    return '<div class="apt-hero"><div><h2>Randevu ve Kayıt Takip Merkezi</h2><p>Google Sheets benzeri liste, görüşme geçmişi, takvim ve kayıt performansı.</p></div><button class="btn primary" id="aptNew" type="button">+ Yeni Randevu</button></div>'+
     '<div class="apt-tabs">'+[['icmal','Randevu İcmal'],['takvim','Takvim'],['gecmis','Geçmiş Randevular'],['rapor','Kayıt Analizi']].map(([k,n])=>'<button class="'+(s.tab===k?'active':'')+'" type="button" data-apt-tab="'+k+'">'+n+'</button>').join('')+'</div>'+
     '<div class="apt-filters"><input id="aptSearch" type="search" placeholder="İsim, telefon, not, ID ara…" value="'+esc(s.search)+'" aria-label="Randevularda arama">'+
     '<select id="aptSchool" aria-label="Kurum">'+options([['all','Tüm kurumlar'],...schools],s.school)+'</select>'+
     '<select id="aptStatus" aria-label="Randevu sonucu">'+options([['all','Tüm sonuçlar'],...statuses],s.result)+'</select>'+
     '<button class="btn" id="aptReset" type="button">Filtreleri Temizle</button>'+
     '<button class="btn" id="aptExport" type="button">CSV / Excel Çıktısı</button></div>';
  }
  function tableView(rows) {
    const head=['ID','Veli / Öğrenci','Eğitim','Yaş','Sınıf','AÖL Kredi','Rakam','İl / İlçe','Görüşen','Telefon','İlk Görüşme','Randevu Tarihi','Saat','Şube','Randevu Sonucu','İşlemler'];
    return '<div class="panel apt-panel"><div class="apt-listmeta"><strong>Randevu İcmal Tablosu</strong><span>'+rows.length+' kayıt · Sütunlarda yatay kaydırabilirsiniz</span></div>'+
      '<div class="apt-gridwrap"><table class="apt-grid"><thead><tr>'+head.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+esc(r.legacy_id||String(r.id).slice(0,8))+'</td><td><button class="apt-name" type="button" data-apt-edit="'+esc(r.id)+'">'+esc(r.contact_name)+'</button></td>'+
      '<td>'+esc(r.education_status||schoolName(r.school_unit))+'</td><td>'+esc(r.age??'—')+'</td><td>'+esc(r.grade||'—')+'</td><td>'+esc(r.aol_credits??'—')+'</td><td>'+esc(money(r.quote_amount))+'</td>'+
      '<td>'+esc([r.city,r.district].filter(Boolean).join(' / ')||'—')+'</td><td>'+esc(r.staff_name||'—')+'</td>'+
      '<td>'+phoneLink(r.contact_phone)+'</td><td>'+esc(dateTR(r.meeting_date))+'</td><td>'+esc(dateTR(r.appointment_date))+'</td><td>'+esc(clock(r.appointment_time))+'</td><td>'+esc(r.branch||'—')+'</td>'+
      '<td><select class="apt-quick-result" aria-label="'+esc(r.contact_name)+' randevu sonucu" data-apt-status="'+esc(r.id)+'">'+options(statuses,r.result)+'</select></td>'+
      '<td><div class="apt-actions"><button type="button" class="btn sm" data-apt-edit="'+esc(r.id)+'">Düzenle</button>'+whatsApp(r.contact_phone)+
      (canManage()?'<button type="button" class="btn sm" data-apt-archive="'+esc(r.id)+'">Arşivle</button>':'')+'</div></td></tr>').join('')+
      '</tbody></table></div>'+(rows.length?'':'<div class="empty">Bu kriterlerde randevu bulunamadı. İlk randevu için + Yeni Randevu seçebilirsiniz.</div>')+
      '<p class="apt-hint">Durum alanını tablodan doğrudan değiştirebilirsiniz. Ayrıntılar ve diğer alanlar için isme veya Düzenle butonuna dokunun.</p></div>';
  }
  function phoneLink(phone) {
    const digits=String(phone||'').replace(/[^\d+]/g,'');
    return digits?'<a href="tel:'+esc(digits)+'">'+esc(phone)+'</a>':'—';
  }
  function whatsApp(phone) {
    const digits=safeDigits(phone);
    return digits?'<a class="btn sm" href="https://wa.me/'+esc(digits)+'" target="_blank" rel="noopener noreferrer" title="WhatsApp ile aç">WhatsApp ↗</a>':'';
  }
  function calendarView(rows) {
    const s=S(),base=new Date(),year=base.getFullYear(),month=base.getMonth(),
      first=new Date(year,month,1).getDay(),offset=(first+6)%7,last=new Date(year,month+1,0).getDate(),
      current=today(),byDate={};
    for(const r of s.rows){if(r.appointment_date)byDate[r.appointment_date]=(byDate[r.appointment_date]||0)+1}
    const d=n=>year+'-'+String(month+1).padStart(2,'0')+'-'+String(n).padStart(2,'0');
    return '<div class="apt-cal-layout"><div class="panel"><h2>'+base.toLocaleDateString('tr-TR',{month:'long',year:'numeric'})+' · Randevu Takvimi</h2>'+
      '<div class="apt-month">'+['Pt','Sa','Ça','Pe','Cu','Ct','Pa'].map(x=>'<div class="apt-weekday">'+x+'</div>').join('')+
      Array.from({length:offset},()=>'<div class="apt-day blank"></div>').join('')+
      Array.from({length:last},(_,i)=>{const day=i+1,key=d(day);return '<button type="button" data-apt-day="'+key+'" class="apt-day '+(key===current?'today ':'')+(key===s.selectedDay?'selected':'')+'"><strong>'+day+'</strong>'+(byDate[key]?'<small>'+byDate[key]+' randevu</small>':'')+'</button>'}).join('')+
      '</div><p class="apt-hint">Bir güne dokunarak o tarihe ait randevuları listeleyin.</p></div><div class="panel"><div class="apt-listmeta"><strong>'+(s.selectedDay?dateTR(s.selectedDay):'Tüm tarihler')+'</strong><button id="aptAllDays" class="btn sm" type="button">Tümünü Göster</button></div>'+
      (rows.length?rows.slice(0,60).map(r=>'<div class="apt-cal-item"><span>'+esc(dateTR(r.appointment_date))+' '+esc(clock(r.appointment_time))+'</span><strong>'+esc(r.contact_name)+'</strong>'+statusBadge(r.result)+'<button class="btn sm" data-apt-edit="'+esc(r.id)+'" type="button">Aç</button></div>').join(''):'<p class="muted">Randevu bulunamadı.</p>')+'</div></div>';
  }
  function reportView(rows) {
    const m=metrics(rows),distribution=statuses.map(([k,n])=>({key:k,name:n,count:rows.filter(r=>r.result===k).length}));
    const bySchool=schools.map(([k,n])=>({name:n,count:rows.filter(r=>r.school_unit===k).length}));
    const graph=(title,data)=>'<section class="panel"><h2>'+esc(title)+'</h2><div class="apt-bars">'+data.map(r=>'<div class="apt-bar-row"><span>'+esc(r.name)+'</span><div><i style="width:'+Math.min(100,Math.round(100*r.count/Math.max(1,m.total)))+'%"></i></div><strong>'+r.count+'</strong></div>').join('')+'</div></section>';
    return '<div class="apt-kpis">'+kpi('Toplam',m.total,'Filtrelenmiş kayıt')+kpi('Kayıt Yapıldı',m.registered,'Kayıtla sonuçlanan')+
      kpi('Kayıt Dönüşümü',m.rate+'%','Kayıt / tüm randevular')+kpi('Aktif Görüşme',m.waiting,'Bekleyen, düşünecek, tekrar arama')+'</div>'+
      '<div class="apt-reportgrid">'+graph('Sonuca Göre Dağılım',distribution)+graph('Kuruma Göre Dağılım',bySchool)+'</div>'+
      '<p class="apt-hint">Raporlar yalnızca yeni modüle kaydedilen randevuları kapsar. AppSheet verileri içe aktarılmadan eski kayıtlar burada görünmez.</p>';
  }
  function form() {
    const s=S(),r=s.rows.find(x=>x.id===s.editing)||{},isEdit=!!r.id;
    const fields=[
      labelHtml('Veli / Öğrenci Ad Soyad *',input('contact_name',r.contact_name,'text','required maxlength="200"')),
      labelHtml('Telefon',input('contact_phone',r.contact_phone,'tel','maxlength="30"')),
      labelHtml('Kurum',select('school_unit',schools,r.school_unit||'aksam')),
      labelHtml('Eğitim Durumu',input('education_status',r.education_status)),
      labelHtml('Yaş',input('age',r.age,'number','min="0" max="120"')),
      labelHtml('Sınıf',input('grade',r.grade)),
      labelHtml('AÖL Kredisi',input('aol_credits',r.aol_credits,'number','min="0" max="500"')),
      labelHtml('Görüşülen Rakam (TL)',input('quote_amount',r.quote_amount,'number','min="0" step="0.01"')),
      labelHtml('İl',input('city',r.city)),
      labelHtml('İlçe / Semt',input('district',r.district)),
      labelHtml('Görüşen Kişi',input('staff_name',r.staff_name)),
      labelHtml('Görüşme Tarihi',input('meeting_date',r.meeting_date,'date')),
      labelHtml('Randevu Tarihi',input('appointment_date',r.appointment_date,'date')),
      labelHtml('Randevu Saati',input('appointment_time',r.appointment_time?String(r.appointment_time).slice(0,5):'','time')),
      labelHtml('Randevu Şubesi',input('branch',r.branch)),
      labelHtml('Randevu Sonucu',select('result',statuses,r.result||'beklemede')),
      labelHtml('Tekrar Arama / Takip Tarihi',input('followup_date',r.followup_date,'date')),
      labelHtml('İlk Görüşme Notu','<textarea name="first_contact_note" rows="3">'+esc(r.first_contact_note||'')+'</textarea>'),
      labelHtml('Görüşme / Kayıt Notları','<textarea name="notes" rows="3">'+esc(r.notes||'')+'</textarea>')
    ];
    return '<div class="apt-scrim" id="aptScrim"><div class="apt-dialog" role="dialog" aria-modal="true" aria-label="Randevu Formu"><div class="apt-dialoghead"><h2>'+(isEdit?'Randevuyu Düzenle':'Yeni Randevu')+'</h2><button type="button" id="aptClose" class="btn">✕ Kapat</button></div>'+
      '<form id="aptForm"><div class="apt-fields">'+fields.join('')+'</div><div class="apt-formfooter"><small>Veriler Ortak Takip Supabase hesabında saklanır.</small>'+
      '<button class="btn primary" type="submit" '+(s.busy?'disabled':'')+'>'+(isEdit?'Değişiklikleri Kaydet':'Randevu Oluştur')+'</button></div></form></div></div>';
  }
  function view() {
    const s=S(),rows=filtered(),m=metrics(s.rows);
    return toolbar()+
      '<div class="apt-kpis">'+kpi('Toplam Randevu',m.total,'Sistemdeki aktif kayıt')+
      kpi('Bekleyen Görüşme',m.waiting,'İşlem bekleyenler')+
      kpi('Kayıt Yapıldı',m.registered,'Sonuçlandırılan kayıt')+
      kpi('Geciken Takip',m.pastDue,'Takip tarihi geçmiş','urgent')+'</div>'+
      (!s.loaded?'<section class="panel"><p class="muted">Randevular yükleniyor…</p></section>':
       s.tab==='takvim'?calendarView(rows):s.tab==='rapor'?reportView(rows):tableView(rows))+
      (s.formOpen?form():'');
  }
  async function save(ev) {
    ev.preventDefault();const s=S();if(s.busy)return;
    s.busy=true;const button=$('aptForm')?.querySelector('button[type=submit]');if(button)button.disabled=true;
    try{
      await requireActiveSession();
      const fd=new FormData(ev.currentTarget),str=k=>String(fd.get(k)||'').trim();
      const row={
        contact_name:str('contact_name'),contact_phone:str('contact_phone'),school_unit:str('school_unit'),
        education_status:str('education_status'),age:str('age')===''?null:Number(str('age')),
        grade:str('grade'),aol_credits:str('aol_credits')===''?null:Number(str('aol_credits')),
        quote_amount:str('quote_amount')===''?null:Number(str('quote_amount')),
        city:str('city'),district:str('district'),staff_name:str('staff_name'),
        meeting_date:str('meeting_date')||null,appointment_date:str('appointment_date')||null,
        appointment_time:str('appointment_time')||null,branch:str('branch'),
        result:str('result'),followup_date:str('followup_date')||null,
        first_contact_note:str('first_contact_note'),notes:str('notes'),
        updated_by:state.user.id,updated_at:new Date().toISOString()
      };
      if(row.contact_name.length<2)throw Error('Veli / öğrenci adı giriniz.');
      if(s.editing){
        const res=await sb.from('appointments').update(row).eq('id',s.editing).eq('workspace_id',WS).select('id').single();
        if(res.error)throw res.error;
      }else{
        const res=await sb.from('appointments').insert({...row,workspace_id:WS,created_by:state.user.id}).select('id').single();
        if(res.error)throw res.error;
      }
      s.formOpen=false;s.editing=null;await load();render();toast('Randevu kaydedildi.');
    }catch(e){error(e)}finally{s.busy=false;if(button)button.disabled=false}
  }
  async function quickStatus(id,value,el) {
    const s=S(),rec=s.rows.find(x=>x.id===id);if(!rec)return;
    const old=rec.result;el.disabled=true;
    try{
      await requireActiveSession();
      if(!statuses.some(x=>x[0]===value))throw Error('Geçersiz randevu sonucu.');
      const res=await sb.from('appointments').update({result:value,updated_by:state.user.id,updated_at:new Date().toISOString()})
       .eq('id',id).eq('workspace_id',WS).select('id').single();
      if(res.error)throw res.error;
      rec.result=value;render();toast('Randevu sonucu güncellendi.');
    }catch(e){el.value=old;error(e)}finally{el.disabled=false}
  }
  async function archive(id) {
    if(!canManage()||!confirm('Bu randevu arşivlensin mi? Kayıt veritabanından kalıcı silinmez.'))return;
    try{
      await requireActiveSession();
      const res=await sb.from('appointments').update({deleted_at:new Date().toISOString(),deleted_by:state.user.id,updated_by:state.user.id})
       .eq('id',id).eq('workspace_id',WS).select('id').single();
      if(res.error)throw res.error;
      await load();render();toast('Randevu arşivlendi.');
    }catch(e){error(e)}
  }
  function csvExport() {
    const cols=[['legacy_id','ID'],['contact_name','Veli / Öğrenci'],['education_status','Eğitim Durumu'],['age','Yaş'],
      ['grade','Sınıf'],['aol_credits','AÖL Kredi'],['quote_amount','Rakam'],['city','İl'],['district','İlçe'],
      ['staff_name','Görüşen Kişi'],['contact_phone','Telefon'],['meeting_date','Görüşme Tarihi'],['first_contact_note','İlk Görüşme'],
      ['appointment_date','Randevu Tarihi'],['appointment_time','Randevu Saati'],['branch','Şube'],['result','Randevu Sonucu'],['notes','Notlar']];
    const safeCsv=v=>{let x=String(v??'');if(/^[\s]*[=+\-@]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const rows=[cols.map(c=>safeCsv(c[1])).join(';'),...filtered().map(r=>cols.map(([key])=>safeCsv(r[key])).join(';'))];
    const blob=new Blob(['\ufeff',rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ortak-takip-randevular-'+today()+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function bind() {
    const s=S();
    document.querySelectorAll('[data-apt-tab]').forEach(b=>b.onclick=()=>{s.tab=b.dataset.aptTab;s.selectedDay='';render()});
    $('aptNew')?.addEventListener('click',()=>{s.editing=null;s.formOpen=true;render();$('aptForm')?.querySelector('[name=contact_name]')?.focus()});
    $('aptSearch')?.addEventListener('change',e=>{s.search=e.target.value;render()});
    $('aptSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();s.search=e.target.value;render()}});
    $('aptSchool')?.addEventListener('change',e=>{s.school=e.target.value;render()});
    $('aptStatus')?.addEventListener('change',e=>{s.result=e.target.value;render()});
    $('aptReset')?.addEventListener('click',()=>{s.search='';s.school='all';s.result='all';s.selectedDay='';render()});
    $('aptExport')?.addEventListener('click',csvExport);
    document.querySelectorAll('[data-apt-day]').forEach(b=>b.onclick=()=>{s.selectedDay=b.dataset.aptDay;render()});
    $('aptAllDays')?.addEventListener('click',()=>{s.selectedDay='';render()});
    document.querySelectorAll('[data-apt-edit]').forEach(b=>b.onclick=()=>{s.editing=b.dataset.aptEdit;s.formOpen=true;render()});
    document.querySelectorAll('[data-apt-status]').forEach(el=>el.addEventListener('change',()=>quickStatus(el.dataset.aptStatus,el.value,el)));
    document.querySelectorAll('[data-apt-archive]').forEach(b=>b.onclick=()=>archive(b.dataset.aptArchive));
    $('aptClose')?.addEventListener('click',()=>{s.formOpen=false;s.editing=null;render()});
    $('aptScrim')?.addEventListener('click',e=>{if(e.target.id==='aptScrim'){s.formOpen=false;s.editing=null;render()}});
    $('aptForm')?.addEventListener('submit',save);
  }
  return {load,view,bind};
}
