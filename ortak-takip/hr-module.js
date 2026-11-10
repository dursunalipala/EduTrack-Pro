/* Ortak Takip - İnsan Kaynakları, kurum bazlı personel yönetimi */
export function createHrModule({sb,WS,state,esc,toast,error}) {
 const S=()=>state.hr||(state.hr={organizations:[],employees:[],employments:[],leaves:[],access:[],myEmployeeId:null,selected:'all',query:'',loading:false,loaded:false});
 const safe=v=>esc(String(v??''));
 const owner=()=>state.role==='owner';
 const selfEmployee=()=>S().employees.find(e=>e.id===S().myEmployeeId);
 async function load(){
  const s=S();s.loading=true;
  try {
   const [o,e,m,l,a,me]=await Promise.all([
    sb.from('hr_organizations').select('id,name,code,is_active').eq('workspace_id',WS).order('name'),
    sb.rpc('hr_visible_employee_roster',{p_workspace_id:WS}),
    sb.from('hr_employments').select('id,employee_id,organization_id,position_title,start_date,end_date,is_primary').eq('workspace_id',WS),
    sb.from('hr_leave_requests').select('id,employee_id,organization_id,leave_type,starts_on,ends_on,status,note').eq('workspace_id',WS).order('created_at',{ascending:false}).limit(100),
    sb.from('hr_org_access').select('organization_id,access_level,user_id').eq('workspace_id',WS),
    sb.from('hr_employees').select('id').eq('workspace_id',WS).eq('user_id',state.user.id).maybeSingle()
   ]);
   for(const r of [o,e,m,l,a,me])if(r.error)throw r.error;
   Object.assign(s,{organizations:o.data||[],employees:e.data||[],employments:m.data||[],leaves:l.data||[],access:a.data||[],myEmployeeId:me.data?.id||null,loaded:true});
  }catch(e){error(e)}finally{s.loading=false}
 }
 function view(){
  const s=S(), orgs=s.organizations;
  const managed=new Set(s.access.filter(a=>a.user_id===state.user?.id&&['hr_admin','hr_manager'].includes(a.access_level)).map(a=>a.organization_id));
  const canDecide=l=>owner()||managed.has(l.organization_id);
  const employments=s.employments.filter(x=>s.selected==='all'||x.organization_id===s.selected);
  const employeeIds=new Set(employments.map(x=>x.employee_id));
  const filtered=s.employees.filter(e=>(s.selected==='all'||employeeIds.has(e.id))&&
   (e.first_name+' '+e.last_name+' '+(e.work_email||'')).toLocaleLowerCase('tr').includes(s.query.toLocaleLowerCase('tr')));
  return `<div class="hr-module">
   <div class="titlebar"><div><h2>İnsan Kaynakları</h2><p class="muted small">Kurum bazlı personel yönetimi ve özlük kayıtları</p></div>
    <div class="actions"><button class="btn" data-hr-refresh>Yenile</button>${owner()?'<button class="btn" data-hr-add-org>Kurum Ekle</button><button class="btn" data-hr-access>Yetki Yönetimi</button><button class="btn primary" data-hr-add>Personel Ekle</button>':''}</div></div>
   <div class="hr-kpis"><div class="panel"><span class="muted">Personel</span><strong>${filtered.length}</strong></div><div class="panel"><span class="muted">Aktif</span><strong>${filtered.filter(x=>x.status==='active').length}</strong></div><div class="panel"><span class="muted">Kurum</span><strong>${orgs.length}</strong></div></div>
   <div class="panel"><div class="filters"><label>Kurum <select data-hr-org><option value="all">Tüm yetkili kurumlar</option>${orgs.map(o=>`<option value="${safe(o.id)}" ${s.selected===o.id?'selected':''}>${safe(o.name)}</option>`).join('')}</select></label><label>Personel ara <input data-hr-search value="${safe(s.query)}" placeholder="Ad, soyad veya e-posta"></label></div>
   ${s.loading?'<p>Yükleniyor…</p>':!filtered.length?'<div class="empty">Bu filtrede personel bulunamadı.</div>':`<div class="tablewrap"><table><thead><tr><th>Personel</th><th>Kurum / Görev</th><th>Durum</th>${owner()?'<th>İşlem</th>':''}</tr></thead><tbody>${filtered.map(e=>`<tr><td><strong>${safe(e.first_name)} ${safe(e.last_name)}</strong><div class="muted small">${safe(e.work_email||'')}</div></td><td>${employments.filter(x=>x.employee_id===e.id).map(x=>`<div>${safe(orgs.find(o=>o.id===x.organization_id)?.name||'Kurum')} · ${safe(x.position_title)}</div>`).join('')||'—'}</td><td>${safe(e.status==='active'?'Aktif':e.status==='on_leave'?'İzinli':'Pasif')}</td>${owner()?`<td><button class="btn sm" data-hr-edit="${safe(e.id)}">Düzenle</button> <button class="btn sm" data-hr-assign="${safe(e.id)}">Kurum Ata</button> <button class="btn sm" data-hr-link="${safe(e.id)}">Hesap Bağla</button></td>`:''}</tr>`).join('')}</tbody></table></div>`}
   </div><div class="panel"><div class="row"><h2>İzin Talepleri</h2><button class="btn primary" data-hr-request>İzin Talebi Oluştur</button></div>${s.leaves.filter(l=>s.selected==="all"||l.organization_id===s.selected).length?`<div class="tablewrap"><table><thead><tr><th>Personel</th><th>Kurum</th><th>Tür / Tarih</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${s.leaves.filter(l=>s.selected==="all"||l.organization_id===s.selected).map(l=>`<tr><td>${safe(s.employees.find(e=>e.id===l.employee_id)?.first_name||"")} ${safe(s.employees.find(e=>e.id===l.employee_id)?.last_name||"")}</td><td>${safe(orgs.find(o=>o.id===l.organization_id)?.name||"")}</td><td>${safe(l.leave_type)} · ${safe(l.starts_on)} – ${safe(l.ends_on)}</td><td>${safe(l.status)}</td><td>${l.status==="pending"&&canDecide(l)?`<button class="btn sm" data-hr-leave="${safe(l.id)}" data-decision="approved">Onayla</button> <button class="btn sm" data-hr-leave="${safe(l.id)}" data-decision="rejected">Reddet</button>`:"—"}</td></tr>`).join("")}</tbody></table></div>`:"<p class=\"muted\">İzin talebi bulunamadı.</p>"}</div></div>`;
 }
 function bind(root){
  root.querySelector('[data-hr-refresh]')?.addEventListener('click',async()=>{await load();draw(root)});
  root.querySelector('[data-hr-org]')?.addEventListener('change',e=>{S().selected=e.target.value;draw(root)});
  root.querySelector('[data-hr-search]')?.addEventListener('input',e=>{const s=S();s.query=e.target.value;const start=e.target.selectionStart;draw(root);const input=root.querySelector('[data-hr-search]');input?.focus();input?.setSelectionRange(start,start)});
  root.querySelector('[data-hr-add]')?.addEventListener('click',()=>add(root));
  root.querySelector('[data-hr-add-org]')?.addEventListener('click',()=>addOrganization(root));
  root.querySelector('[data-hr-access]')?.addEventListener('click',()=>manageAccess(root));
  root.querySelectorAll('[data-hr-edit]').forEach(b=>b.addEventListener('click',()=>editEmployee(root,b.dataset.hrEdit)));
  root.querySelectorAll('[data-hr-link]').forEach(b=>b.addEventListener('click',()=>linkAccount(root,b.dataset.hrLink)));
  root.querySelectorAll('[data-hr-assign]').forEach(b=>b.addEventListener('click',()=>assign(root,b.dataset.hrAssign)));
  root.querySelector('[data-hr-request]')?.addEventListener('click',()=>requestLeave(root));
  root.querySelectorAll('[data-hr-leave]').forEach(b=>b.addEventListener('click',()=>decideLeave(root,b.dataset.hrLeave,b.dataset.decision)));
 }
 function draw(root){root.innerHTML=view();bind(root)}
 async function mount(root){if(!S().loaded)await load();draw(root)}
 function add(root){
  if(!owner())return;
  const s=S();if(!s.organizations.length){toast('Önce İK kurum kaydı oluşturulmalıdır.');return}
  const overlay=document.createElement('div');overlay.className='hr-overlay';
  overlay.innerHTML=`<form class="hr-dialog"><h2>Personel Ekle</h2><label>Ad<input name="first" maxlength="100" required></label><label>Soyad<input name="last" maxlength="100" required></label><label>İş e-postası<input name="email" type="email"></label><label>Kurum<select name="org" required>${s.organizations.map(o=>`<option value="${safe(o.id)}">${safe(o.name)}</option>`).join('')}</select></label><label>Unvan<input name="title" maxlength="150"></label><label>İşe giriş<input name="start" type="date" required></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div><p class="muted small">Yeni personel uygulama hesabı açmaz. Hesap eşleştirmesi ayrıca yapılır.</p></form>`;
  document.body.append(overlay);
  overlay.querySelector('[data-hr-cancel]').onclick=()=>overlay.remove();
  overlay.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
   try{
    const payload={workspace_id:WS,first_name:String(fd.get('first')).trim(),last_name:String(fd.get('last')).trim(),work_email:String(fd.get('email')).trim()||null};
    const {data:employee,error:err}=await sb.from('hr_employees').insert(payload).select('id').single();if(err)throw err;
    const {error:employmentError}=await sb.from('hr_employments').insert({workspace_id:WS,employee_id:employee.id,organization_id:fd.get('org'),position_title:String(fd.get('title')).trim(),start_date:fd.get('start'),is_primary:true});
    if(employmentError){toast('Personel oluşturuldu ancak kurum ataması başarısız. İK yöneticisi kaydı kontrol etmelidir.');throw employmentError}
    overlay.remove();await load();draw(root);toast('Personel kaydedildi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }

 function modal(html){
  const overlay=document.createElement('div');overlay.className='hr-overlay';
  overlay.innerHTML=html;document.body.append(overlay);
  overlay.querySelector('[data-hr-cancel]')?.addEventListener('click',()=>overlay.remove());
  return overlay;
 }
 function addOrganization(root){
  if(!owner())return;
  const overlay=modal('<form class="hr-dialog"><h2>İK Kurumu Ekle</h2><label>Kurum adı<input name="name" required minlength="2" maxlength="180"></label><label>Kurum kodu<input name="code" required pattern="[a-z0-9_-]+" placeholder="elit-ilkokul"></label><p class="small muted">Kurum kodu küçük harf, rakam, tire veya alt çizgi içermelidir.</p><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>');
  overlay.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const f=ev.currentTarget,fd=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const {error:err}=await sb.from('hr_organizations').insert({workspace_id:WS,name:String(fd.get('name')).trim(),code:String(fd.get('code')).trim()});
    if(err)throw err;overlay.remove();await load();draw(root);toast('Kurum eklendi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }
 function editEmployee(root,id){
  if(!owner())return;
  const person=S().employees.find(x=>x.id===id);if(!person)return;
  const overlay=modal('<form class="hr-dialog"><h2>Personel Bilgilerini Düzenle</h2><label>Ad<input name="first" required maxlength="100"></label><label>Soyad<input name="last" required maxlength="100"></label><label>İş e-postası<input name="email" type="email"></label><label>Durum<select name="status"><option value="active">Aktif</option><option value="on_leave">İzinli</option><option value="inactive">Pasif</option></select></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>');
  const f=overlay.querySelector('form');
  f.elements.first.value=person.first_name;f.elements.last.value=person.last_name;f.elements.email.value=person.work_email||'';f.elements.status.value=person.status;
  f.onsubmit=async ev=>{
   ev.preventDefault();const fd=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const {error:err}=await sb.from('hr_employees').update({first_name:String(fd.get('first')).trim(),last_name:String(fd.get('last')).trim(),work_email:String(fd.get('email')).trim()||null,status:fd.get('status')}).eq('workspace_id',WS).eq('id',id);
    if(err)throw err;overlay.remove();await load();draw(root);toast('Personel bilgileri güncellendi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }

 async function decideLeave(root,id,decision){
  if(!['approved','rejected'].includes(decision))return;
  const item=S().leaves.find(x=>x.id===id);if(!item||item.status!=='pending')return;
  if(!window.confirm(decision==='approved'?'İzin talebi onaylansın mı?':'İzin talebi reddedilsin mi?'))return;
  try{
   const {error:err}=await sb.rpc('hr_decide_leave',{p_request_id:id,p_decision:decision});
   if(err)throw err;
   await load();draw(root);toast(decision==='approved'?'İzin onaylandı':'İzin reddedildi');
  }catch(e){error(e)}
 }
 function assign(root,id){
  if(!owner())return;
  const person=S().employees.find(x=>x.id===id),orgs=S().organizations.filter(o=>o.is_active);
  if(!person||!orgs.length){toast('Aktif kurum bulunamadı');return}
  const overlay=modal(`<form class="hr-dialog"><h2>Kurum Görevlendirmesi</h2><p class="muted">${safe(person.first_name)} ${safe(person.last_name)}</p><label>Kurum<select name="org" required>${orgs.map(o=>`<option value="${safe(o.id)}">${safe(o.name)}</option>`).join('')}</select></label><label>Görev / Unvan<input name="title" maxlength="150" required></label><label>Başlangıç tarihi<input type="date" name="start" required></label><label>Bitiş tarihi (isteğe bağlı)<input type="date" name="end"></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Görevlendir</button></div></form>`);
  overlay.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const f=ev.currentTarget,fd=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const start=String(fd.get('start')),end=String(fd.get('end'));if(end&&end<start)throw Error('Bitiş tarihi başlangıçtan önce olamaz');
    const org=String(fd.get('org'));
    if(S().employments.some(m=>m.employee_id===id&&m.organization_id===org&&(!m.end_date||m.end_date>=start)))throw Error('Bu kurumda çakışan görevlendirme var; önce mevcut kaydı kontrol edin');
    const {error:err}=await sb.from('hr_employments').insert({workspace_id:WS,employee_id:id,organization_id:org,position_title:String(fd.get('title')).trim(),start_date:start,end_date:end||null,is_primary:false});
    if(err)throw err;overlay.remove();await load();draw(root);toast('Kurum görevlendirmesi kaydedildi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }

 function requestLeave(root){
  const person=selfEmployee();if(!person){toast('İzin talebi için kullanıcı hesabınızın personel kaydına bağlanması gerekiyor.');return}
  const assignments=S().employments.filter(m=>m.employee_id===person.id);
  if(!assignments.length){toast('Aktif kurum görevlendirmesi bulunamadı');return}
  const overlay=modal(`<form class="hr-dialog"><h2>İzin Talebi Oluştur</h2><label>Kurum<select name="org" required>${assignments.map(m=>`<option value="${safe(m.organization_id)}">${safe(S().organizations.find(o=>o.id===m.organization_id)?.name||'Kurum')}</option>`).join('')}</select></label><label>İzin türü<select name="type"><option value="annual">Yıllık izin</option><option value="sick">Sağlık izni</option><option value="unpaid">Ücretsiz izin</option><option value="parental">Ebeveyn izni</option><option value="other">Diğer</option></select></label><label>Başlangıç<input type="date" name="start" required></label><label>Bitiş<input type="date" name="end" required></label><label>Açıklama<textarea name="note" maxlength="1000"></textarea></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Talep Gönder</button></div></form>`);
  overlay.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const f=ev.currentTarget,fd=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const start=String(fd.get('start')),end=String(fd.get('end'));if(end<start)throw Error('Bitiş tarihi başlangıçtan önce olamaz');
    const {error:err}=await sb.from('hr_leave_requests').insert({workspace_id:WS,employee_id:person.id,organization_id:fd.get('org'),leave_type:fd.get('type'),starts_on:start,ends_on:end,note:String(fd.get('note')).trim()});
    if(err)throw err;overlay.remove();await load();draw(root);toast('İzin talebi gönderildi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }

 function linkAccount(root,id){
  if(!owner())return;
  const person=S().employees.find(e=>e.id===id);if(!person)return;
  const members=state.members.filter(m=>m.is_active!==false);
  if(!members.length){toast('Bağlanabilecek aktif kullanıcı bulunamadı');return}
  const overlay=modal(`<form class="hr-dialog"><h2>Personel Hesabını Eşleştir</h2><p>${safe(person.first_name)} ${safe(person.last_name)}</p><label>Mevcut kullanıcı<select name="user" required>${members.map(m=>`<option value="${safe(m.user_id)}">${safe(state.profiles.find(p=>p.id===m.user_id)?.full_name||m.user_id)}</option>`).join('')}</select></label><p class="small muted">Bu işlem yeni hesap oluşturmaz. Seçilen aktif kullanıcıyı personel kaydıyla ilişkilendirir.</p><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Eşleştir</button></div></form>`);
  overlay.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const f=ev.currentTarget,button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const userId=String(new FormData(f).get('user'));
    if(!window.confirm('Seçilen kullanıcı hesabı bu personel kaydına bağlansın mı?'))return;
    const {error:err}=await sb.rpc('hr_link_employee_account',{p_employee_id:id,p_user_id:userId});
    if(err)throw err;overlay.remove();await load();draw(root);toast('Personel hesabı eşleştirildi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }

 function manageAccess(root){
  if(!owner())return;
  const orgs=S().organizations, members=(state.members||[]).filter(m=>m.is_active!==false);
  if(!orgs.length||!members.length){toast('Kurum ve aktif kullanıcı kaydı gerekli');return}
  const overlay=modal(`<form class="hr-dialog"><h2>Kurum İK Yetkisi</h2><label>Kurum<select name="org" required>${orgs.map(o=>`<option value="${safe(o.id)}">${safe(o.name)}</option>`).join('')}</select></label><label>Kullanıcı<select name="user" required>${members.map(m=>`<option value="${safe(m.user_id)}">${safe((state.profiles||[]).find(p=>p.id===m.user_id)?.full_name||m.user_id)}</option>`).join('')}</select></label><label>Yetki<select name="level"><option value="hr_manager">Kurum İK Yöneticisi</option><option value="hr_admin">Kurum İK Admini</option><option value="employee">Personel</option><option value="viewer">İzleyici</option></select></label><p class="small muted">Yetkiler yalnızca seçilen kurum için geçerlidir. Admin erişimi ayrıca korunur.</p><div data-hr-existing></div><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Yetkiyi Kaydet</button></div></form>`);
  const f=overlay.querySelector('form');
  const existing=overlay.querySelector('[data-hr-existing]');
  const renderExisting=()=>{
   const org=f.elements.org.value;
   const grants=S().access.filter(a=>a.organization_id===org);
   existing.innerHTML='<h3>Mevcut Yetkiler</h3>'+(grants.length?grants.map(a=>`<div class="row" style="justify-content:space-between;gap:8px;margin:8px 0"><span>${safe((state.profiles||[]).find(p=>p.id===a.user_id)?.full_name||a.user_id)} · ${safe(a.access_level)}</span><button type="button" class="btn sm" data-hr-revoke="${safe(a.user_id)}">Yetkiyi Kaldır</button></div>`).join(''):'<p class="muted small">Bu kurum için yetki kaydı yok.</p>');
   existing.querySelectorAll('[data-hr-revoke]').forEach(b=>b.onclick=async()=>{
    if(!window.confirm('Bu kullanıcının seçilen kurum İK yetkisi kaldırılsın mı?'))return;
    b.disabled=true;
    try{
     const {error:err}=await sb.from('hr_org_access').delete().eq('workspace_id',WS).eq('organization_id',org).eq('user_id',b.dataset.hrRevoke);
     if(err)throw err;await load();renderExisting();toast('Kurum yetkisi kaldırıldı');
    }catch(e){error(e);b.disabled=false}
   });
  };
  f.elements.org.addEventListener('change',renderExisting);
  renderExisting();
  f.onsubmit=async ev=>{
   ev.preventDefault();const fd=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const org=String(fd.get('org')),user=String(fd.get('user')),level=String(fd.get('level'));
    if(!window.confirm('Bu kullanıcıya seçilen kurum için '+level+' yetkisi verilsin mi?'))return;
    const {error:err}=await sb.from('hr_org_access').upsert({workspace_id:WS,organization_id:org,user_id:user,access_level:level},{onConflict:'organization_id,user_id'});
    if(err)throw err;overlay.remove();await load();draw(root);toast('Kurum yetkisi kaydedildi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }
 return {mount,load,view};
}
