export function createMeetingModule({sb,WS,state,esc,toast,onAskAI}){
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
  const [ag,de,di,mi]=await Promise.all([sb.from("meeting_agenda").select("id,title,status").eq("meeting_id",id).order("sort_order"),sb.from("meeting_decisions").select("id,decision_text,status,due_date").eq("meeting_id",id),sb.from("meeting_directives").select("id,directive_text,status,due_date").eq("meeting_id",id),sb.from("meeting_minutes").select("meeting_id,draft_text,approved_text,status,approved_at").eq("meeting_id",id).maybeSingle()]);
  if(!document.getElementById("meetingDetail")||selected!==id)return;
  el.innerHTML='<div class="meeting-card-head"><h3>Toplantı ayrıntıları</h3><button class="btn sm" id="meetingClose">Kapat</button></div><h4>Gündem önerileri</h4>'+(ag.data||[]).map(x=>'<p>• '+e(x.title)+' <small>('+e(x.status)+')</small></p>').join("")+'<form id="meetingAgendaForm"><input name="title" required minlength="3" maxlength="240" placeholder="Yeni gündem önerisi"><button class="btn primary">Gündem ekle</button></form><h4>Kararlar</h4>'+((de.data||[]).map(x=>'<p>• '+e(x.decision_text)+' <small>('+e(decisionNames[x.status]||x.status)+')</small></p>').join("")||'<p>Henüz karar kaydı yok.</p>')+(canManage()?'<form id="meetingDecisionForm"><textarea name="decision_text" required minlength="3" rows="2" placeholder="Alınan karar" style="width:100%"></textarea><label>Son tarih<input name="due_date" type="date"></label><button class="btn primary">Karar kaydet</button></form>':'')+'<h4>MEM talimatları</h4>'+((di.data||[]).map(x=>'<p>• '+e(x.directive_text)+' <small>('+e(x.status)+')</small></p>').join("")||'<p>Talimat kaydı yok.</p>');
  const currentMeeting=rows.find(x=>x.id===id);
  if(currentMeeting){
   const share=document.createElement("section");share.className="meeting-share";
   share.innerHTML='<h4>Bildirim ve paylaşım</h4><p class="meeting-muted">E-posta ve WhatsApp bağlantıları mesaj taslağını açar. Gönderme işlemini siz onaylarsınız.</p><div class="meeting-actions"><button type="button" class="btn sm" data-share="whatsapp">WhatsApp</button><button type="button" class="btn sm" data-share="email">E-posta</button><button type="button" class="btn sm" data-share="copy">Metni kopyala</button></div>'+
    (state.role==="owner"?'<form id="meetingNotifyForm"><label>Uygulama içi bildirim alıcısı<select name="recipient_id" required><option value="">Alıcı seçin</option></select></label><button class="btn primary" type="submit">Bildirim gönder</button></form>':'');
   el.append(share);
   const msg=['Ortak Takip | Toplantı: '+currentMeeting.title,'Tür: '+(types[currentMeeting.type]||currentMeeting.type),'Tarih: '+fmt(currentMeeting.starts_at),'Yer: '+(currentMeeting.location||'Belirtilmedi'),'Durum: '+(statusNames[currentMeeting.status]||currentMeeting.status),currentMeeting.meeting_url?'Katılım: '+currentMeeting.meeting_url:''].filter(Boolean).join("\n");
   share.querySelectorAll("[data-share]").forEach(button=>button.onclick=async()=>{
    const kind=button.dataset.share;
    if(kind==="whatsapp")window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank","noopener,noreferrer");
    else if(kind==="email")window.location.href="mailto:?subject="+encodeURIComponent("Toplantı: "+currentMeeting.title)+"&body="+encodeURIComponent(msg);
    else try{await navigator.clipboard.writeText(msg);toast("Toplantı metni kopyalandı")}catch{toast("Kopyalama desteklenmiyor")}
   });
   const notifyForm=share.querySelector("#meetingNotifyForm");
   if(notifyForm){
    const {data:members,error:membersError}=await sb.from("workspace_members").select("user_id,role").eq("workspace_id",WS).eq("is_active",true);
    if(!document.contains(notifyForm)||selected!==id)return;
    if(membersError){toast("Alıcı listesi yüklenemedi: "+membersError.message)}
    else {
     const ids=[...new Set((members||[]).map(m=>m.user_id).filter(Boolean))];
     if(ids.length){
      const {data:profiles}=await sb.from("profiles").select("id,full_name").in("id",ids);
      const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.full_name]));
      const select=notifyForm.querySelector("select");
      ids.forEach(uid=>{const option=document.createElement("option");option.value=uid;option.textContent=names[uid]||"Üye ("+uid.slice(0,8)+")";select.append(option)});
     }
    }
    notifyForm.onsubmit=async ev=>{
     ev.preventDefault();const button=notifyForm.querySelector("button");button.disabled=true;
     const recipient_id=new FormData(notifyForm).get("recipient_id");
     const batch_id=crypto.randomUUID();
     const payload={body:msg.slice(0,1500),sender_id:state.user.id,batch_id,meeting_id:id};
     const {error}=await sb.from("user_notifications").insert({workspace_id:WS,recipient_id,kind:"admin_message",title:("Toplantı: "+currentMeeting.title).slice(0,120),payload});
     button.disabled=false;
     if(error){toast("Bildirim gönderilemedi: "+error.message);return}
     toast("Uygulama içi bildirim oluşturuldu");
    };
   }
  }
  const minutes=mi.data||null;
  const minutesSection=document.createElement("section");
  minutesSection.className="meeting-minutes";
  minutesSection.innerHTML='<h4>Toplantı tutanağı</h4><p class="meeting-muted">Yapay zekâ taslağını buraya yapıştırıp düzenleyebilirsiniz. Yönetici onayı olmadan resmî tutanak oluşmaz.</p>'+
   (minutes?.status==="approved"?
    '<div class="meeting-approved"><strong>Onaylı tutanak</strong><p class="meeting-minute-text">'+e(minutes.approved_text||"")+'</p></div>':
    (canManage()?'<form id="meetingMinutesForm"><textarea name="draft_text" rows="7" maxlength="30000" required placeholder="Tutanak taslağını buraya yazın veya yapay zekâ çıktısını yapıştırın.">'+e(minutes?.draft_text||"")+'</textarea><div class="meeting-actions"><button class="btn" type="submit" name="action" value="save">Taslağı kaydet</button><button class="btn primary" type="submit" name="action" value="approve">Tutanağı onayla</button></div></form>':
    '<p>'+(minutes?.draft_text?e(minutes.draft_text):"Henüz tutanak taslağı yok.")+'</p>'));
  el.append(minutesSection);
  const minutesForm=minutesSection.querySelector("#meetingMinutesForm");
  if(minutesForm)minutesForm.onsubmit=async event=>{
   event.preventDefault();
   const action=event.submitter?.value||"save";
   const content=String(new FormData(minutesForm).get("draft_text")||"").trim();
   if(content.length<10){toast("Tutanak en az 10 karakter olmalıdır.");return}
   if(action==="approve"&&!confirm("Tutanak onaylandıktan sonra bu ekrandan değiştirilemez. Onaylıyor musunuz?"))return;
   const btns=[...minutesForm.querySelectorAll("button")];btns.forEach(b=>b.disabled=true);
   const payload={meeting_id:id,draft_text:content,status:action==="approve"?"approved":"draft",approved_text:action==="approve"?content:null,approved_by:action==="approve"?state.user.id:null,approved_at:action==="approve"?new Date().toISOString():null,updated_at:new Date().toISOString()};
   const {error}=await sb.from("meeting_minutes").upsert(payload,{onConflict:"meeting_id"});
   if(error){toast("Tutanak kaydedilemedi: "+error.message);btns.forEach(b=>b.disabled=false);return}
   toast(action==="approve"?"Tutanak onaylandı":"Tutanak taslağı kaydedildi");await loadDetail(id);
  };
  const meeting=rows.find(x=>x.id===id);
  if(meeting&&typeof onAskAI==="function"){
   const aiBtn=document.createElement("button");aiBtn.type="button";aiBtn.className="btn sm";aiBtn.textContent="✦ Yapay Zekâ ile Toplantıyı Değerlendir";
   el.querySelector(".meeting-card-head")?.after(aiBtn);
   aiBtn.onclick=()=>{
    const agenda=(ag.data||[]).map(x=>x.title).join("; ");
    const decisions=(de.data||[]).map(x=>x.decision_text).join("; ");
    const prompt=["Aşağıdaki toplantı için gündem düzeni, toplantı tutanağı taslağı ve kararların takip planını öner. Yalnızca verilen bilgilere dayan, alınmamış kararları alınmış gibi gösterme.","Toplantı: "+meeting.title,"Tür: "+(types[meeting.type]||meeting.type),"Açıklama: "+(meeting.description||"Belirtilmedi"),"Gündem: "+(agenda||"Henüz yok"),"Kayıtlı kararlar: "+(decisions||"Henüz yok")].join("\\n").slice(0,1450);
    onAskAI(prompt);
   };
  }
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
