/*
 * Ortak Takip - Yönetim Raporlama Merkezi (v1)
 * Read-only, workspace-scoped analytics. No privileged keys and no data mutations.
 */
export function createReportingModule(api){
 const {state, sb, WS, esc, options, toast, render, memberName, streamName, loadReportLibrary, canManage, refresh}=api;
 const trDate=v=>v?new Date(v.length===10?v+'T12:00:00':v).toLocaleDateString('tr-TR'):'—';
 const localISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const nowDay=()=>localISO(new Date());
 const schoolName={all:'Tüm kurumlar',ortak:'Ortak',aksam:'Elit Akşam Lisesi',ilkokul:'Elit İlkokulu',anasinifi:'Elit Anaokulu',ortaokul:'Ortaokul'};
 const statusName={taslak:'Taslak',beklemede:'Beklemede',devam_ediyor:'Devam ediyor',kontrol_bekliyor:'Kontrol bekliyor',tamamlandi:'Tamamlandı',iptal:'İptal'};
 const priorityName={dusuk:'Düşük',normal:'Normal',yuksek:'Yüksek',kritik:'Kritik'};
 const tabs=[['overview','Genel Bakış'],['tasks','Görevler'],['goals','Hedefler'],['people','Ortaklar & Ekip'],['streams','İş Grupları'],['catalog','İş Havuzu'],['calendar','Takvim'],['inspection','Teftiş'],['documents','Evrak Merkezi'],['digital','Dijital Merkez'],['notifications','Bildirimler'],['audit','İşlem Geçmişi']];
 const R=()=>state.managementReport||(state.managementReport={
  period:'all',from:'',to:'',school:'all',stream:'all',person:'all',status:'all',priority:'all',tab:'overview',
  extras:{answers:[],queue:[],audit:[]},loaded:false,loading:false,loadError:'',truncated:[]});
 const num=x=>Number(x||0).toLocaleString('tr-TR');
 const percent=(a,b)=>b?Math.round(a*100/b):0;
 const isOpen=x=>!['tamamlandi','iptal'].includes(x.status);
 const monthKey=v=>v?String(v).slice(0,7):'';
 const selectPerson=t=>[t.assigned_to,t.executor_id,t.reviewer_id,...(t.helper_user_ids||[]),...(t.collaborator_user_ids||[])];
 const matchesSchool=x=>R().school==='all'||(x.school_unit||'ortak')===R().school;
 const matchesStream=x=>R().stream==='all'||x.workstream_id===R().stream;
 const matchesPerson=x=>R().person==='all'||selectPerson(x).includes(R().person);
 const effectiveRange=()=>{
  const r=R(),now=new Date(),today=nowDay(),fromMonth=localISO(new Date(now.getFullYear(),now.getMonth(),1));
  if(r.period==='month')return {from:fromMonth,to:today,label:'Bu ay'};
  if(r.period==='30')return {from:localISO(new Date(now.getFullYear(),now.getMonth(),now.getDate()-29)),to:today,label:'Son 30 gün'};
  if(r.period==='year')return {from:now.getFullYear()+'-01-01',to:today,label:'Bu yıl'};
  if(r.period==='custom')return {from:r.from||'',to:r.to||'',label:(r.from||'Başlangıç')+' – '+(r.to||'Bugün')};
  return {from:'',to:'',label:'Tüm zamanlar'};
 };
 const inRange=value=>{
  if(!value)return R().period==='all';
  const v=String(value).slice(0,10),rng=effectiveRange();
  return (!rng.from||v>=rng.from)&&(!rng.to||v<=rng.to);
 };
 const scopedItems=()=>({
  tasks:state.tasks.filter(t=>matchesSchool(t)&&matchesStream(t)&&matchesPerson(t)&&inRange(t.created_at)
     &&(R().status==='all'||t.status===R().status)&&(R().priority==='all'||t.priority===R().priority)),
  goals:state.goals.filter(g=>matchesSchool(g)&&matchesStream(g)&&(R().person==='all'||g.owner_id===R().person)
    &&(R().period==='all'||inRange(g.period_start||g.created_at)||inRange(g.period_end))),
  catalog:state.catalog.filter(c=>matchesSchool(c)&&matchesStream(c)&&(R().person==='all'||c.assigned_to===R().person)&&inRange(c.created_at)),
  events:state.events.filter(e=>(R().person==='all'||e.assigned_to===R().person)&&inRange(e.starts_at)),
  resources:state.digitalResources.filter(d=>!d.is_archived&&matchesSchool(d)&&(R().person==='all'||d.responsible_id===R().person)&&inRange(d.created_at)),
  documents:(state.inspection?.docs||[]).filter(d=>matchesSchool(d)&&inRange(d.created_at)),
  sessions:(state.inspection?.sessions||[]).filter(s=>matchesSchool(s)&&inRange(s.created_at)),
  queue:(R().loaded?R().extras.queue:state.notificationQueue).filter(n=>(R().person==='all'||n.recipient_id===R().person)&&inRange(n.created_at)),
  activity:state.taskActivities.filter(a=>inRange(a.created_at)&&(R().person==='all'||a.actor_id===R().person)),
  transfers:state.taskAssignmentHistory.filter(h=>inRange(h.changed_at)&&(R().person==='all'||[h.changed_by,h.executor_id].includes(R().person))),
  audit:(R().extras.audit||[]).filter(a=>inRange(a.happened_at)&&(R().person==='all'||a.actor_id===R().person))
 });
 function aggregate(){
  const d=scopedItems(),tasks=d.tasks,valid=tasks.filter(t=>t.status!=='iptal'),done=valid.filter(t=>t.status==='tamamlandi'),open=tasks.filter(isOpen),today=nowDay(),
  late=open.filter(t=>t.due_date&&t.due_date<today),review=tasks.filter(t=>t.status==='kontrol_bekliyor'),
  critical=open.filter(t=>t.priority==='kritik'),
  goalRated=d.goals.filter(g=>Number(g.target_value)>0&&g.actual_value!=null),
  goalRate=goalRated.length?Math.round(goalRated.reduce((a,g)=>a+Math.min(100,100*Number(g.actual_value)/Number(g.target_value)),0)/goalRated.length):null;
  const groups=state.streams.filter(w=>R().stream==='all'||R().stream===w.id).map(w=>{
   const items=valid.filter(t=>t.workstream_id===w.id);
   return {name:w.name,id:w.id,lead:memberName(w.lead_user_id),total:items.length,done:items.filter(t=>t.status==='tamamlandi').length,late:items.filter(t=>isOpen(t)&&t.due_date&&t.due_date<today).length};
  });
  const people=state.members.filter(m=>R().person==='all'||m.user_id===R().person).map(m=>{
   const items=valid.filter(t=>selectPerson(t).includes(m.user_id));
   return {name:memberName(m.user_id),userId:m.user_id,role:m.role,active:m.is_active&&!m.archived_at,
    total:items.length,done:items.filter(t=>t.status==='tamamlandi').length,
    late:items.filter(t=>isOpen(t)&&t.due_date&&t.due_date<today).length,
    pending:items.filter(t=>t.status==='kontrol_bekliyor').length,
    goals:d.goals.filter(g=>g.owner_id===m.user_id).length,
    actions:d.activity.filter(a=>a.actor_id===m.user_id).length};
  });
  return {d,tasks,valid,done,open,late,review,critical,goalRated,goalRate,groups,people,today};
 }
 const chartColors=['#197e92','#3b82f6','#e6a23c','#e1535b','#8b5cf6','#36a985','#94a3b8'];
 const empty='<p class="rep-empty">Seçilen filtrelerde kayıt bulunmuyor.</p>';
 const bar=(label,value,max,color,caption)=>{
  const p=max?Math.min(100,Math.max(0,Math.round(value*100/max))):0;
  return '<div class="rep-bar-item"><div class="rep-bar-meta"><span>'+esc(label)+'</span><strong>'+esc(caption??num(value))+'</strong></div>'+
    '<div class="rep-bar-track"><span style="width:'+p+'%;background:'+esc(color||chartColors[0])+'"></span></div></div>';
 };
 const donut=(values)=>{
  const total=values.reduce((s,x)=>s+x[1],0);let p=0;
  const stops=values.map((v,i)=>{const start=p;p+=total?100*v[1]/total:0;return chartColors[i%chartColors.length]+' '+start+'% '+p+'%';}).join(', ');
  return '<div class="rep-donut-row"><div class="rep-donut" style="background:'+(total?'conic-gradient('+stops+')':'#e8eef5')+'"><span><strong>'+num(total)+'</strong><small>görev</small></span></div>'+
   '<div class="rep-donut-legend">'+values.map((v,i)=>'<div><i style="background:'+chartColors[i%chartColors.length]+'"></i><span>'+esc(v[0])+'</span><b>'+num(v[1])+'</b></div>').join('')+'</div></div>';
 };
 const panel=(title,content)=>'<section class="rep-panel"><h3>'+esc(title)+'</h3>'+content+'</section>';
 const table=(cols,rows)=>{
  if(!rows.length)return empty;
  return '<div class="rep-tablewrap"><table class="rep-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead>'+
   '<tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 };
 const reportTables=a=>{
  const d=a.d,ids=new Set(a.tasks.map(t=>t.id)),today=a.today;
  const answers=(R().extras.answers||[]).filter(x=>d.sessions.some(s=>s.id===x.session_id));
  const inspectionRows=d.sessions.map(s=>{
    const ans=answers.filter(x=>x.session_id===s.id),ok=ans.filter(x=>x.status==='uygun').length,
    missing=ans.filter(x=>x.status==='eksik').length,pending=ans.filter(x=>x.status==='incelenmedi').length;
    return [s.title||'Ön denetim',schoolName[s.school_unit]||s.school_unit,s.academic_year,s.status||'—',
      ans.length,ok,missing,pending,ans.filter(x=>x.status==='eksik'&&x.is_critical).length,trDate(s.created_at)];
  });
  const notes=[];
  for(const t of d.activity.filter(x=>ids.has(x.task_id)))notes.push([trDate(t.created_at),'Görev işlemi',memberName(t.actor_id),state.tasks.find(x=>x.id===t.task_id)?.title||'Görev',t.action,t.deleted_at?'Not silindi':t.note||'']);
  for(const t of d.transfers.filter(x=>ids.has(x.task_id)))notes.push([trDate(t.changed_at),'Görev devri',memberName(t.changed_by),state.tasks.find(x=>x.id===t.task_id)?.title||'Görev',t.change_type||'Devir',memberName(t.prior_executor_id)+' → '+memberName(t.executor_id)]);
  for(const t of d.audit)notes.push([trDate(t.happened_at),'Dijital kaynak',memberName(t.actor_id),t.resource_id||'',t.action||'', 'Kaynak işlem kaydı']);
  for(const t of state.memberStatusHistory.filter(x=>inRange(x.happened_at)))notes.push([trDate(t.happened_at),'Üye durumu',memberName(t.changed_by),memberName(t.user_id),t.action||'',t.note||'']);
  notes.sort((x,y)=>y[0].localeCompare(x[0],'tr'));
  const ds={
   tasks:{name:'Görevler',cols:['Görev','Kurum','İş grubu','Üst sorumlu','Uygulayıcı','Kontrol','Durum','Öncelik','İlerleme %','Başlangıç','Son tarih','Tamamlanma'],rows:d.tasks.map(t=>[t.title,schoolName[t.school_unit]||'Ortak',streamName(t.workstream_id),memberName(t.assigned_to),memberName(t.executor_id),memberName(t.reviewer_id),statusName[t.status]||t.status,priorityName[t.priority]||t.priority,t.progress||0,trDate(t.start_date),trDate(t.due_date),trDate(t.completed_at)])},
   goals:{name:'Hedefler',cols:['Hedef','Kurum','Tür','Kategori','İş grubu','Sorumlu','Hedef değer','Gerçekleşme','Birim','Oran %','Onay','Başlangıç','Bitiş'],rows:d.goals.map(g=>[g.title,schoolName[g.school_unit]||'Ortak',g.goal_level,g.metric_category,streamName(g.workstream_id),memberName(g.owner_id),g.target_value??'—',g.actual_value??'—',g.unit,Number(g.target_value)>0&&g.actual_value!=null?percent(g.actual_value,g.target_value):'—',g.approval_status,trDate(g.period_start),trDate(g.period_end)])},
   people:{name:'Ortaklar ve Ekip',cols:['Kişi','Rol','Üyelik','İlgili görev','Tamamlanan','Geciken','Kontrol bekleyen','Hedef','İşlem'],rows:a.people.map(x=>[x.name,x.role,x.active?'Aktif':'Pasif/Arşiv',x.total,x.done,x.late,x.pending,x.goals,x.actions])},
   streams:{name:'İş Grupları',cols:['İş grubu','Yönetici','Toplam görev','Tamamlanan','Geciken','Tamamlanma %'],rows:a.groups.map(x=>[x.name,x.lead,x.total,x.done,x.late,percent(x.done,x.total)])},
   catalog:{name:'İş ve Görev Havuzu',cols:['Görev tanımı','Kurum','İş grubu','Sorumlu','Tekrar','Öncelik','Otomatik','Durum','Başlangıç','Bitiş'],rows:d.catalog.map(x=>[x.title,schoolName[x.school_unit]||'Ortak',streamName(x.workstream_id),memberName(x.assigned_to),x.cadence,priorityName[x.priority]||x.priority,x.auto_enabled?'Evet':'Hayır',x.is_active?'Aktif':'Pasif',trDate(x.start_on),trDate(x.end_on)])},
   calendar:{name:'Takvim',cols:['Etkinlik','Başlangıç','Bitiş','Sorumlu','Bağlı görev','Açıklama'],rows:d.events.map(e=>[e.title,new Date(e.starts_at).toLocaleString('tr-TR'),new Date(e.ends_at).toLocaleString('tr-TR'),memberName(e.assigned_to),state.tasks.find(t=>t.id===e.task_id)?.title||'—',e.details||''])},
   inspection:{name:'Teftiş',cols:['Oturum','Kurum','Eğitim yılı','Durum','Kontrol sayısı','Uygun','Eksik','İncelenmedi','Kritik eksik','Tarih'],rows:inspectionRows},
   documents:{name:'Evrak Merkezi',cols:['Belge','Kurum','Kategori','Son geçerlilik','Durum','Açıklama'],rows:d.documents.map(x=>[x.title,schoolName[x.school_unit]||'Ortak',x.category,trDate(x.expires_on),x.expires_on&&x.expires_on<today?'Süresi geçmiş':x.expires_on&&x.expires_on<=localISO(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+30))?'30 gün içinde dolacak':'Takipte',x.notes||''])},
   digital:{name:'Dijital Merkez',cols:['Bağlantı','Kurum','Kategori','Sorumlu','Durum','Eklenme'],rows:d.resources.map(x=>[x.title,schoolName[x.school_unit]||'Ortak',x.category,memberName(x.responsible_id),x.status,trDate(x.created_at)])},
   notifications:{name:'Bildirimler',cols:['Bildirim türü','Alıcı','Durum','Oluşturma','Gönderim','Hata'],rows:d.queue.map(x=>[x.kind,memberName(x.recipient_id),x.status,trDate(x.created_at),trDate(x.sent_at),x.last_error||''])},
   audit:{name:'İşlem Geçmişi',cols:['Tarih','Alan','İşlemi yapan','Kayıt','İşlem','Açıklama'],rows:notes}
  };
  return ds;
 };
 function overview(a,sets){
  const n=a.valid.length,done=a.done.length,late=a.late.length;
  const stats=[
   ['Toplam görev',n,'İptal edilenler hariç'],['Tamamlanan',done,'Görev tamamlanma oranı %'+percent(done,n)],['Geciken',late,'Bugün itibarıyla'],['Kontrol bekleyen',a.review.length,'Onay sürecinde'],
   ['Kritik açık görev',a.critical.length,'Öncelikli takip'],['Hedefler',a.d.goals.length,a.goalRate===null?'Ölçülebilir hedef yok':'Ortalama ilerleme %'+a.goalRate],
   ['Planlı etkinlik',a.d.events.length,'Takvim kayıtları'],['Teftiş oturumu',a.d.sessions.length,'Ön denetim'],
   ['Kurumsal evrak',a.d.documents.length,'Drive bağlantı kayıtları'],['Dijital kaynak',a.d.resources.length,'Aktif bağlantılar'],['İş havuzu',a.d.catalog.length,'Görev şablonları'],['Bildirim kaydı',a.d.queue.length,R().loaded?'Seçili dönem':'Yüklenen son kayıtlar']
  ];
  const groups=a.groups.map((w,i)=>bar(w.name,w.done,Math.max(w.total,1),chartColors[i%chartColors.length],w.done+'/'+w.total+' · %'+percent(w.done,w.total)));
  const people=a.people.map((m,i)=>bar(m.name,m.done,Math.max(m.total,1),chartColors[i%chartColors.length],m.done+'/'+m.total));
  const months=[],now=new Date();for(let i=5;i>=0;i--)months.push(localISO(new Date(now.getFullYear(),now.getMonth()-i,1)).slice(0,7));
  const trend=months.map(m=>({month:m,created:a.tasks.filter(t=>monthKey(t.created_at)===m).length,done:a.tasks.filter(t=>monthKey(t.completed_at)===m).length}));
  const max=Math.max(1,...trend.map(x=>Math.max(x.created,x.done)));
  const trendChart='<div class="rep-trend">'+trend.map(x=>'<div class="rep-trend-month"><div class="rep-trend-bars"><i title="Açılan: '+x.created+'" style="height:'+Math.max(2,Math.round(100*x.created/max))+'%;background:#207d9b"></i><i title="Tamamlanan: '+x.done+'" style="height:'+Math.max(2,Math.round(100*x.done/max))+'%;background:#37b6a5"></i></div><small>'+esc(x.month.slice(5))+'/'+esc(x.month.slice(2,4))+'</small></div>').join('')+'</div><p class="rep-hint">■ Açılan görev &nbsp; <span style="color:#36a985">■</span> Tamamlanan görev · Son 6 takvim ayı</p>';
  return '<div class="rep-kpis">'+stats.map((s,i)=>'<div class="rep-kpi"><span>'+esc(s[0])+'</span><strong>'+num(s[1])+'</strong><small>'+esc(s[2])+'</small></div>').join('')+'</div>'+
   '<div class="rep-grid">'+
   panel('Görevlerin Durum Dağılımı',donut([['Tamamlandı',done],['Devam ediyor',a.tasks.filter(t=>t.status==='devam_ediyor').length],['Beklemede',a.tasks.filter(t=>t.status==='beklemede').length],['Kontrol bekliyor',a.review.length],['Taslak',a.tasks.filter(t=>t.status==='taslak').length],['İptal',a.tasks.filter(t=>t.status==='iptal').length]]))+
   panel('İş Grupları Tamamlanma Performansı',groups.join('')||empty)+
   panel('Altı Aylık Görev Eğilimi',trendChart)+
   panel('Ortaklar ve Ekip İş Yükü',people.join('')||empty)+
   '</div>'+panel('Yaklaşan Riskler',table(['Görev','Kurum','Sorumlu','Son tarih','Durum'],
   a.open.filter(t=>t.due_date&&t.due_date<=localISO(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+7))).sort((x,y)=>x.due_date.localeCompare(y.due_date)).slice(0,25).map(t=>[t.title,schoolName[t.school_unit]||'Ortak',memberName(t.executor_id||t.assigned_to),trDate(t.due_date),t.due_date<a.today?'Gecikmiş':statusName[t.status]||t.status])))+
   '<p class="rep-hint">Görev tamamlama oranında iptal edilenler paydadan çıkarılır. Dönem filtresi görevlerin oluşturulma tarihini; takvimde başlangıç tarihini; diğer alanlarda ilgili kayıt tarihini esas alır. Geçmiş dönem raporları kayıtların mevcut durumunu gösterir, geçmişteki anlık durumu yeniden oluşturmaz.</p>';
 }
 function view(){
  if(!canManage())return '<p>Raporlama için Yönetici veya Admin yetkisi gereklidir.</p>';
  const r=R(),a=aggregate(),sets=reportTables(a),range=effectiveRange();
  const menus='<div class="rep-filtergrid"><label>Dönem<select id="repPeriod">'+options([['all','Tüm zamanlar'],['month','Bu ay'],['30','Son 30 gün'],['year','Bu yıl'],['custom','Özel tarih aralığı']],r.period)+'</select></label>'+
   (r.period==='custom'?'<label>Başlangıç<input type="date" id="repFrom" value="'+esc(r.from)+'"></label><label>Bitiş<input type="date" id="repTo" value="'+esc(r.to)+'"></label>':'')+
   '<label>Kurum<select id="repSchool">'+options([['all','Tüm kurumlar'],['ortak','Ortak'],['aksam','Akşam Lisesi'],['ilkokul','İlkokul'],['anasinifi','Anaokulu'],['ortaokul','Ortaokul']],r.school)+'</select></label>'+
   '<label>İş grubu<select id="repStream">'+options([['all','Tüm iş grupları'],...state.streams.map(x=>[x.id,x.name])],r.stream)+'</select></label>'+
   '<label>İlgili kişi<select id="repPerson">'+options([['all','Tüm ekip'],...state.members.map(x=>[x.user_id,memberName(x.user_id)])],r.person)+'</select></label>'+
   '<label>Görev durumu<select id="repStatus">'+options([['all','Tüm durumlar'],...Object.entries(statusName)],r.status)+'</select></label>'+
   '<label>Öncelik<select id="repPriority">'+options([['all','Tüm öncelikler'],...Object.entries(priorityName)],r.priority)+'</select></label></div>';
  return '<div class="rep-root"><div class="rep-hero"><div><span class="rep-eyebrow">ORTAK TAKİP • YÖNETİM ANALİTİĞİ</span><h2>Yönetim Raporlama Merkezi</h2><p>Kurum, görev, hedef, ortak, teftiş, evrak ve dijital operasyonlar tek noktada. <b>'+esc(range.label)+'</b> · '+esc(new Date().toLocaleString('tr-TR'))+'</p></div><div class="rep-hero-actions"><button class="btn" id="repReload">↻ Güncelle</button><button class="btn" id="repPrint">Yazdır</button><button class="btn" id="repExcel">Excel · Tüm Modüller</button><button class="btn primary" id="repPdf">PDF · Yönetim Raporu</button></div></div>'+
   '<section class="rep-filters">'+menus+'</section>'+
   '<div class="rep-tabs" role="tablist" aria-label="Rapor kategorisi">'+tabs.map(x=>'<button type="button" role="tab" aria-selected="'+(r.tab===x[0])+'" data-rep-tab="'+x[0]+'" class="'+(r.tab===x[0]?'active':'')+'">'+esc(x[1])+'</button>').join('')+'</div>'+
   (r.loading?'<p class="rep-info">Teftiş, bildirim ve dijital işlem ayrıntıları güvenli şekilde yükleniyor…</p>':r.loadError?'<p class="rep-error">Bazı ek rapor kaynakları okunamadı: '+esc(r.loadError)+'</p>':'')+
   (r.truncated.length?'<p class="rep-info">Büyük veri kümelerinde '+esc(r.truncated.join(', '))+' kayıtları için güvenli sorgu sınırına ulaşıldı; bu başlıklarda tüm geçmişi göstermek için sayfalama geliştirilebilir.</p>':'')+
   (r.tab==='overview'?overview(a,sets):'<div class="rep-table-title"><div><h3>'+esc(sets[r.tab].name)+'</h3><p>'+num(sets[r.tab].rows.length)+' kayıt · Seçili filtreler · '+esc(range.label)+'</p></div><button class="btn sm" id="repCsv">Bu tabloyu CSV indir</button></div>'+
     (r.tab==='goals'?panel('Hedef Gerçekleşme',dGoalBars(a)):'')+
     (r.tab==='people'?panel('Kişi Bazında Tamamlanan / Toplam Görev',a.people.map((p,i)=>bar(p.name,p.done,Math.max(p.total,1),chartColors[i%chartColors.length],p.done+'/'+p.total)).join('')||empty):'')+
     (r.tab==='streams'?panel('İş Grubu Performansı',a.groups.map((p,i)=>bar(p.name,p.done,Math.max(p.total,1),chartColors[i%chartColors.length],p.done+'/'+p.total)).join('')||empty):'')+
     panel('Ayrıntılı '+sets[r.tab].name+' Tablosu',table(sets[r.tab].cols,sets[r.tab].rows))))+
   '<p class="rep-footnote">Raporlar giriş yapan kişinin kurum içi yetkileriyle erişebildiği verilere dayanır. PDF ve Excel dosyaları kullanıcı cihazına indirilir; rapor üretimi başka bir sunucuya veri göndermez. Kayıt / finansal sonuçlar yalnızca sistemde gerçek veri girilmişse raporlanır.</p></div>';
 }
 function dGoalBars(a){const goals=a.d.goals.filter(x=>Number(x.target_value)>0).slice(0,20);return goals.length?goals.map((g,i)=>bar(g.title,Math.min(Number(g.actual_value||0),Number(g.target_value)),Number(g.target_value),chartColors[i%chartColors.length],String(g.actual_value??'—')+' / '+g.target_value+' '+(g.unit||''))).join(''):empty;}
 async function loadExtras(force=false){
  const r=R();if(r.loading||(!force&&r.loaded))return;
  r.loading=true;r.loadError='';r.truncated=[];
  const fetchPages=async(table,fields,order)=>{
   let rows=[];for(let page=0;page<5;page++){
    let req=sb.from(table).select(fields).eq('workspace_id',WS).order(order,{ascending:false}).range(page*1000,page*1000+999);
    const {data,error}=await req;if(error)throw error;rows.push(...(data||[]));
    if((data||[]).length<1000)return rows;
   }
   r.truncated.push(table);return rows;
  };
  try{
   const jobs=await Promise.allSettled([
    fetchPages('inspection_answers','session_id,status,is_critical,updated_at','updated_at'),
    fetchPages('notification_queue','recipient_id,kind,status,created_at,sent_at,last_error','created_at'),
    fetchPages('digital_resource_audit','resource_id,actor_id,action,happened_at','happened_at')
   ]);
   const keys=['answers','queue','audit'];
   for(let i=0;i<jobs.length;i++){
    if(jobs[i].status==='fulfilled')r.extras[keys[i]]=jobs[i].value;
    else r.loadError+=(r.loadError?' · ':'')+[ 'Teftiş cevapları','Bildirim kayıtları','Dijital işlem geçmişi'][i];
   }
   r.loaded=true;
  }catch(e){r.loadError=e?.message||'Bağlantı hatası';r.loaded=true}
  finally{r.loading=false;if(state.view==='reports')render()}
 }
 function csvCell(x){let v=String(x??'');if(/^[\s]*[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
 const download=(name,blob)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 const fileName=ext=>'ortak-takip-yonetim-raporu-'+nowDay()+'.'+ext;
 function csv(){
  const r=reportTables(aggregate())[R().tab];if(!r){toast('Lütfen bir ayrıntı raporu seçin.');return;}
  const content='\ufeff'+[r.cols,...r.rows].map(x=>x.map(csvCell).join(';')).join('\r\n');
  download(fileName('csv'),new Blob([content],{type:'text/csv;charset=utf-8'}));toast('Seçili tablo CSV olarak indirildi.');
 }
 async function excel(){
  try{
   await loadReportLibrary('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',()=>!!window.XLSX);
   const data=reportTables(aggregate()),book=window.XLSX.utils.book_new(),a=aggregate();
   const summary=[['ORTAK TAKİP - YÖNETİM RAPORU'],['Rapor tarihi',new Date().toLocaleString('tr-TR')],['Dönem',effectiveRange().label],['Kurum',schoolName[R().school]],['Toplam görev (iptaller hariç)',a.valid.length],['Tamamlanan',a.done.length],['Geciken',a.late.length],['Hedef sayısı',a.d.goals.length],['Teftiş oturumu',a.d.sessions.length],['Evrak',a.d.documents.length],['Dijital kaynak',a.d.resources.length]];
   window.XLSX.utils.book_append_sheet(book,window.XLSX.utils.aoa_to_sheet(summary),'Yönetim Özeti');
   for(const k of Object.keys(data)){
    const x=data[k],sanitise=v=>{const s=String(v??'');return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;};
    window.XLSX.utils.book_append_sheet(book,window.XLSX.utils.aoa_to_sheet([x.cols,...x.rows.map(row=>row.map(sanitise))]),x.name.slice(0,31));
   }
   window.XLSX.writeFile(book,fileName('xlsx'),{compression:true});toast('Çok sayfalı Excel yönetim raporu indirildi.');
  }catch(e){console.error('Excel:',e);toast('Excel üretilemedi. Bağlantınızı kontrol edip tekrar deneyin.');}
 }
 const pdfTable=(cols,rows,cap=1200)=>({table:{headerRows:1,widths:Array(cols.length).fill('*'),body:[[...cols.map(c=>({text:String(c),bold:true,color:'#ffffff',fontSize:7}))],...rows.slice(0,cap).map(r=>r.map(c=>({text:String(c??'—'),fontSize:6.7})))]},layout:{fillColor:(i)=>i===0?'#173451':i%2===0?'#f0f5f9':null,hLineColor:()=>'#e3edf4',vLineColor:()=>'#e3edf4'}});
 async function pdf(){
  try{
   await loadReportLibrary('https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/pdfmake.min.js',()=>!!window.pdfMake);
   await loadReportLibrary('https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/vfs_fonts.js',()=>!!(window.pdfMake?.vfs&&Object.keys(window.pdfMake.vfs).length));
   const a=aggregate(),data=reportTables(a),sections=[
    {text:'ORTAK TAKİP | YÖNETİM RAPORU',fontSize:20,bold:true,color:'#173451'},
    {text:'Rapor: '+new Date().toLocaleString('tr-TR')+'   Dönem: '+effectiveRange().label+'   Kurum: '+schoolName[R().school],margin:[0,4,0,12],color:'#53677d',fontSize:9},
    {columns:[['Görev',a.valid.length],['Tamamlandı',a.done.length],['Geciken',a.late.length],['Hedef',a.d.goals.length],['Ön Denetim',a.d.sessions.length],['Evrak',a.d.documents.length]].map(x=>({stack:[{text:num(x[1]),bold:true,fontSize:16,color:'#197e92'},{text:x[0],fontSize:8}]})),margin:[0,0,0,15]}
   ];
   for(const k of Object.keys(data)){
    const x=data[k];sections.push({text:x.name+' ('+x.rows.length+')',fontSize:12,bold:true,color:'#173451',margin:[0,15,0,6],pageBreak:k==='tasks'?'before':undefined});
    if(x.rows.length)sections.push(pdfTable(x.cols,x.rows));
    else sections.push({text:'Bu kapsamda kayıt yok.',fontSize:9,color:'#6b7280'});
    if(x.rows.length>1200)sections.push({text:'PDF görünümünde ilk 1.200 kayıt gösterildi. Tamamı için Excel kullanın.',fontSize:8,italics:true});
   }
   const doc={pageSize:'A4',pageOrientation:'landscape',pageMargins:[25,30,25,30],content:sections,
     defaultStyle:{font:'Roboto',fontSize:9},footer:(page,count)=>({text:'Ortak Takip • '+page+' / '+count,alignment:'right',margin:[0,0,27,0],fontSize:8,color:'#8291a0'})};
   window.pdfMake.createPdf(doc).download(fileName('pdf'));toast('Yönetim raporu PDF indiriliyor.');
  }catch(e){console.error('PDF:',e);toast('PDF hazırlanamadı. Yazdır / PDF kaydet seçeneğini kullanabilirsiniz.');}
 }
 function printReport(){
  const a=aggregate(),data=reportTables(a);
  let section=document.getElementById('printReport');
  if(!section){section=document.createElement('section');section.id='printReport';document.body.appendChild(section)}
  section.innerHTML='<h1>ORTAK TAKİP | YÖNETİM RAPORU</h1><div class="print-meta">Rapor tarihi: '+esc(new Date().toLocaleString('tr-TR'))+' | Dönem: '+esc(effectiveRange().label)+' | Kurum: '+esc(schoolName[R().school])+'</div>'+
    '<div class="print-kpi">'+[['Toplam görev',a.valid.length],['Tamamlanan',a.done.length],['Geciken',a.late.length],['Hedef',a.d.goals.length],['Evrak',a.d.documents.length]].map(x=>'<span>'+esc(x[0])+': <b>'+num(x[1])+'</b></span>').join('')+'</div>'+
    Object.values(data).map(x=>'<h2>'+esc(x.name)+' ('+x.rows.length+')</h2>'+table(x.cols,x.rows.slice(0,1200))+(x.rows.length>1200?'<p>İlk 1.200 kayıt gösteriliyor. Tam veri için Excel kullanın.</p>':'')).join('');
  window.print();
 }
 function bind(){
  if(!canManage())return;
  const onchange=(id,key)=>document.getElementById(id)?.addEventListener('change',e=>{R()[key]=e.target.value;render()});
  for(const [id,key] of [['repPeriod','period'],['repFrom','from'],['repTo','to'],['repSchool','school'],['repStream','stream'],['repPerson','person'],['repStatus','status'],['repPriority','priority']])onchange(id,key);
  document.querySelectorAll('[data-rep-tab]').forEach(b=>b.addEventListener('click',()=>{R().tab=b.dataset.repTab;render()}));
  document.getElementById('repReload')?.addEventListener('click',async()=>{R().loaded=false;await refresh();});
  document.getElementById('repCsv')?.addEventListener('click',csv);
  document.getElementById('repExcel')?.addEventListener('click',excel);
  document.getElementById('repPdf')?.addEventListener('click',pdf);
  document.getElementById('repPrint')?.addEventListener('click',printReport);
  if(!R().loaded&&!R().loading)void loadExtras();
 }
 return {view,bind,loadExtras};
}
