export function createMeetingModule({sb,WS,state,esc,toast}){
 const types={board:"Yönetim Kurulu",partners:"Ortaklar",school_management:"Okul Yönetimi",teachers:"Öğretmenler Kurulu",department:"Zümre / Kurul",mem:"MEM Müdürler Toplantısı",other:"Diğer"};
 let rows=[],selected=null,loading=false,problem="";
 const statusNames={requested:"Talep Edildi",scheduled:"Planlandı",in_progress:"Devam Ediyor",minutes_pending:"Tutanak Bekleniyor",completed:"Tamamlandı",cancelled:"İptal Edildi"};
 const decisionNames={draft:"Taslak",approved:"Onaylandı",in_progress:"Devam Ediyor",awaiting_review:"Kontrol Bekliyor",completed:"Tamamlandı",cancelled:"İptal Edildi"};
 const canManage=()=>["owner","manager"].includes(state.role);
 const e=x=>esc(String(x??""));
 const fmt=x=>x?new Date(x).toLocaleString("tr-TR",{dateStyle:"medium",timeStyle:"short"}):"Tarih belirlenmedi";
 const canCreate=()=>["owner","manager","member"].includes(state.role);
 async function refresh(){
  if(loading)return;loading=true;
  const {data,error}=await sb.from("meetings").select("id,title,type,status,starts_at,location,meeting_url,description,created_by").eq("workspace_id",WS).order("created_at",{ascending:false}).limit(100);
  loading=false;problem=error?.message||"";rows=data||[];paint();
 }
 function view(){return '<section id="meetingRoot" class="meeting-module"><div class="meeting-loading">Toplantılar yükleniyor…</div></section>'}
 function paint(){
  const root=document.getElementById("meetingRoot");if(!root)return;
  root.innerHTML='<div class="meeting-toolbar"><div><h2>Toplantı ve Karar Merkezi</h2><p>Toplantı talepleri, gündemler, kararlar ve MEM talimatları</p></div>'+(canCreate()?'<button class="btn primary" id="meetingNew">+ Toplantı Talebi</button>':'')+'</div>'+
  (problem?'<div class="meeting-alert">Toplantı verileri henüz kullanılamıyor. Veritabanı kurulumu ve erişim izinleri kontrol edilmeli.<small>'+e(problem)+'</small></div>':'')+
  '<div class="meeting-stats"><div><b>'+rows.length+'</b><span>Toplantı</span></div><div><b>'+rows.filter(x=>x.status==="requested").length+'</b><span>Talep</span></div><div><b>'+rows.filter(x=>x.status==="scheduled").length+'</b><span>Planlanan</span></div><div><b>'+rows.filter(x=>x.type==="mem").length+'</b><span>MEM</span></div></div>'+
  '<div class="meeting-cards">'+(rows.length?rows.map(x=>'<article class="meeting-card"><div class="meeting-card-head"><strong>'+e(x.title)+'</strong><span>'+e(types[x.type]||x.type)+'</span></div><p>'+e(fmt(x.starts_at))+' · '+e(x.location||"Yer belirtilmedi")+'</p><p>Durum: '+e(statusNames[x.status]||x.status)+'</p><div class="meeting-actions"><button class="btn sm" data-meeting-open="'+e(x.id)+'">Gündem / Kararlar</button>'+(x.meeting_url?'<a class="btn sm" target="_blank" rel="noopener noreferrer" href="'+e(x.meeting_url)+'">Toplantıya katıl</a>':'')+'</div></article>').join(""):'<div class="meeting-empty">Henüz erişebildiğiniz bir toplantı kaydı bulunmuyor.</div>')+'</div>'+
  (selected?'<div id="meetingDetail" class="meeting-detail"></div>':'');
  root.querySelector("#meetingNew")?.addEventListener("click",openForm);
  root.querySelectorAll("[data-meeting-open]").forEach(b=>b.addEventListener("click",()=>openDetail(b.dataset.meetingOpen)));
  if(selected)loadDetail(selected);
 }
 function openForm(){
  const root=document.getElementById("meetingRoot");if(!root)return;
  root.insertAdjacentHTML("beforeend",'<div class="meeting-dialog"><form id="meetingForm"><h3>Yeni toplantı talebi</h3><label>Başlık<input name="title" required minlength="3" maxlength="240"></label><label>Tür<select name="type">'+Object.entries(types).map(([k,v])=>'<option value="'+k+'">'+e(v)+'</option>').join("")+'</select></label><label>Tarih / Saat<input type="datetime-local" name="starts_at"></label><label>Yer<input name="location" maxlength="250"></label><label>Google Meet / Toplantı bağlantısı<input name="meeting_url" type="url" placeholder="https://meet.google.com/..."></label><label>Açıklama<textarea name="description" rows="3"></textarea></label><div class="meeting-actions"><button type="button" class="btn" id="meetingCancel">Vazgeç</button><button class="btn primary" type="submit">Talebi kaydet</button></div></form></div>');
  const form=root.querySelector("#meetingForm");root.querySelector("#meetingCancel").onclick=()=>root.querySelector(".meeting-dialog")?.remove();
  form.onsubmit=async ev=>{ev.preventDefault();const f=new FormData(form);const raw=String(f.get("starts_at")||"");const url=String(f.get("meeting_url")||"").trim();if(url&&!/^https:\/\//i.test(url)){toast("HTTPS bağlantısı girin");return}
   const record={workspace_id:WS,created_by:state.user.id,title:String(f.get("title")).trim(),type:f.get("type"),status:"requested",description:String(f.get("description")||""),location:String(f.get("location")||""),meeting_url:url||null,starts_at:raw?new Date(raw).toISOString():null};
   const {error}=await sb.from("meetings").insert(record);if(error){toast("Toplantı kaydedilemedi: "+error.message);return}toast("Toplantı talebi kaydedildi");selected=null;await refresh();
  };
 }
 async function openDetail(id){selected=id;paint()}
 async function loadDetail(id){
  const el=document.getElementById("meetingDetail");if(!el)return;
  const [ag,de,di]=await Promise.all([sb.from("meeting_agenda").select("id,title,status").eq("meeting_id",id).order("sort_order"),sb.from("meeting_decisions").select("id,decision_text,status,due_date").eq("meeting_id",id),sb.from("meeting_directives").select("id,directive_text,status,due_date").eq("meeting_id",id)]);
  if(!document.getElementById("meetingDetail")||selected!==id)return;
  el.innerHTML='<div class="meeting-card-head"><h3>Toplantı ayrıntıları</h3><button class="btn sm" id="meetingClose">Kapat</button></div><h4>Gündem önerileri</h4>'+(ag.data||[]).map(x=>'<p>• '+e(x.title)+' <small>('+e(x.status)+')</small></p>').join("")+'<form id="meetingAgendaForm"><input name="title" required minlength="3" maxlength="240" placeholder="Yeni gündem önerisi"><button class="btn primary">Gündem ekle</button></form><h4>Kararlar</h4>'+((de.data||[]).map(x=>'<p>• '+e(x.decision_text)+' <small>('+e(x.status)+')</small></p>').join("")||'<p>Henüz karar kaydı yok.</p>')+'<h4>MEM talimatları</h4>'+((di.data||[]).map(x=>'<p>• '+e(x.directive_text)+' <small>('+e(x.status)+')</small></p>').join("")||'<p>Talimat kaydı yok.</p>');
  if(canManage()){
   const m=rows.find(x=>x.id===id);
   const actions=document.createElement("div");actions.className="meeting-actions";
   if(m?.status==="requested")actions.innerHTML='<button class="btn primary" data-meeting-status="scheduled">Toplantıyı planla</button><button class="btn" data-meeting-status="cancelled">Talebi iptal et</button>';
   else if(m?.status==="scheduled")actions.innerHTML='<button class="btn primary" data-meeting-status="in_progress">Toplantıyı başlat</button><button class="btn" data-meeting-status="cancelled">İptal et</button>';
   else if(m?.status==="in_progress")actions.innerHTML='<button class="btn primary" data-meeting-status="minutes_pending">Toplantıyı bitir</button>';
   el.querySelector(".meeting-card-head")?.after(actions);
   actions.querySelectorAll("[data-meeting-status]").forEach(btn=>btn.onclick=async()=>{
    const status=btn.dataset.meetingStatus;
    if(status==="cancelled"&&!confirm("Toplantı iptal edilsin mi?"))return;
    btn.disabled=true;
    const {error}=await sb.from("meetings").update({status}).eq("id",id).eq("workspace_id",WS);
    if(error){toast("Durum değiştirilemedi: "+error.message);btn.disabled=false;return}
    toast("Toplantı durumu güncellendi");await refresh();
   });
   const decisionForm=el.querySelector("#meetingDecisionForm");
   if(decisionForm)decisionForm.onsubmit=async event=>{
    event.preventDefault();const btn=decisionForm.querySelector("button");btn.disabled=true;
    const form=new FormData(decisionForm);
    const record={meeting_id:id,decision_text:String(form.get("decision_text")||"").trim(),due_date:form.get("due_date")||null,status:"draft"};
    const {error}=await sb.from("meeting_decisions").insert(record);
    btn.disabled=false;if(error){toast("Karar kaydedilemedi: "+error.message);return}
    toast("Karar taslağı kaydedildi");await loadDetail(id);
   };
  }
  el.querySelector("#meetingClose").onclick=()=>{selected=null;paint()};
  el.querySelector("#meetingAgendaForm").onsubmit=async ev=>{ev.preventDefault();const title=new FormData(ev.target).get("title");const {error}=await sb.from("meeting_agenda").insert({meeting_id:id,proposed_by:state.user.id,title:String(title).trim()});if(error)toast(error.message);else{toast("Gündem önerisi eklendi");loadDetail(id)}};
 }
 return {view,mount:refresh};
}
