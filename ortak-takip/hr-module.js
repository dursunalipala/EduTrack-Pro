/* Ortak Takip - İnsan Kaynakları, kurum bazlı personel yönetimi */
export function createHrModule({sb,WS,state,esc,toast,error}) {
 const S=()=>state.hr||(state.hr={organizations:[],employees:[],employments:[],leaves:[],access:[],myEmployeeId:null,selected:'all',query:'',loading:false,loaded:false,hiringOpenings:[],hiringCandidates:[],hiringInterviews:[],hiringActivity:[],hiringPromotions:[],hiringDocuments:[],hiringMessages:[],hiringLinks:[],section:'staff',hiringDisplay:'list',hiringFilters:{search:'',organization:'all',opening:'all',stage:'all',priority:'all',interview:'all',sort:'priority'}});
 const safe=v=>esc(String(v??''));
 const leaveTypeLabel={annual:'Yıllık İzin',sick:'Sağlık İzni',unpaid:'Ücretsiz İzin',parental:'Ebeveyn İzni',other:'Diğer İzin'};
 const leaveStatusLabel={pending:'Onay Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',cancelled:'İptal Edildi'};
 const owner=()=>state.role==='owner';
 const canViewHiring=()=>owner()||(state.role==='manager'&&S().access.some(a=>a.user_id===state.user.id&&['hr_manager','manager','admin','manage','write','full'].includes(a.access_level)));
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
   const [jobs,candidates,interviews,activity,promotions,documents,messages,links]=(owner()||(state.role==='manager'&&(a.data||[]).some(x=>x.user_id===state.user.id&&['hr_manager','manager','admin','manage','write','full'].includes(x.access_level))))?await Promise.all([
    sb.from('hr_job_openings').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}),
    sb.from('hr_candidates').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}),
    sb.from('hr_candidate_interviews').select('*').eq('workspace_id',WS).order('interviewed_at',{ascending:false}).limit(500),
    sb.from('hr_candidate_activity').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}).limit(1000),
    sb.from('hr_candidate_promotions').select('*').eq('workspace_id',WS),
    sb.from('hr_candidate_documents').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}),
    sb.from('hr_candidate_messages').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}).limit(500),
    sb.from('hr_application_links').select('opening_id,token,enabled').eq('workspace_id',WS)
   ]):[{data:[]},{data:[]},{data:[]},{data:[]},{data:[]},{data:[]},{data:[]},{data:[]}];
   for(const r of [jobs,candidates,interviews,activity,promotions,documents,messages,links])if(r.error)throw r.error;
   Object.assign(s,{hiringOpenings:jobs.data||[],hiringCandidates:candidates.data||[],hiringInterviews:interviews.data||[],hiringActivity:activity.data||[],hiringPromotions:promotions.data||[],hiringDocuments:documents.data||[],hiringMessages:messages.data||[],hiringLinks:links.data||[],organizations:o.data||[],employees:(e.data||[]).map(person=>({...person,id:person.employee_id})),employments:m.data||[],leaves:l.data||[],access:a.data||[],myEmployeeId:me.data?.id||null,loaded:true});
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
  if(s.section==='hiring')return hiringView();
  return `<div class="hr-module">
   <div class="titlebar"><div><h2>İnsan Kaynakları</h2><p class="muted small">Kurum bazlı personel yönetimi ve özlük kayıtları</p></div>
    <div class="actions"><button class="btn" data-hr-refresh>Yenile</button>${owner()?'<button class="btn" data-hr-add-org>Kurum Ekle</button><button class="btn" data-hr-access>Yetki Yönetimi</button><button class="btn primary" data-hr-add>Personel Ekle</button><button class="btn" data-hr-import-users>Ortaklar ve Ekipten Aktar</button>':''}</div></div>
   <div class="actions" style="margin-bottom:12px"><button class="btn primary" data-hr-tab="staff">Personel Yönetimi</button><button class="btn" data-hr-tab="hiring">İşe Alım</button></div><div class="hr-kpis"><div class="panel"><span class="muted">Personel</span><strong>${filtered.length}</strong></div><div class="panel"><span class="muted">Aktif</span><strong>${filtered.filter(x=>x.status==='active').length}</strong></div><div class="panel"><span class="muted">Kurum</span><strong>${orgs.length}</strong></div></div>
   <div class="panel"><div class="filters"><label>Kurum <select data-hr-org><option value="all">Tüm yetkili kurumlar</option>${orgs.map(o=>`<option value="${safe(o.id)}" ${s.selected===o.id?'selected':''}>${safe(o.name)}</option>`).join('')}</select></label><label>Personel ara <input data-hr-search value="${safe(s.query)}" placeholder="Ad, soyad veya e-posta"></label></div>
   ${s.loading?'<p>Yükleniyor…</p>':!filtered.length?'<div class="empty">Bu filtrede personel bulunamadı.</div>':`<div class="tablewrap hr-employee-table"><table><thead><tr><th>Personel</th><th>Kurum / Görev</th><th>Durum</th>${owner()?'<th>İşlem</th>':''}</tr></thead><tbody>${filtered.map(e=>`<tr><td data-label="Personel"><strong>${safe(e.first_name)} ${safe(e.last_name)}</strong><div class="muted small">${safe(e.work_email||'')}</div></td><td data-label="Kurum / Görev">${employments.filter(x=>x.employee_id===e.id).map(x=>`<div>${safe(orgs.find(o=>o.id===x.organization_id)?.name||'Kurum')} · ${safe(x.position_title)}${x.is_primary?' <span class="muted small">· Birincil</span>':''}</div>`).join('')||'—'}</td><td data-label="Durum">${safe(e.status==='active'?'Aktif':e.status==='on_leave'?'İzinli':'Pasif')}</td>${owner()?`<td data-label="İşlemler" class="hr-employee-actions"><button class="btn sm" data-hr-edit="${safe(e.id)}">Düzenle</button> <button class="btn sm" data-hr-assign="${safe(e.id)}">Görev Yeri</button> <button class="btn sm" data-hr-link="${safe(e.id)}">Hesap Bağla</button></td>`:''}</tr>`).join('')}</tbody></table></div>`}
   </div><div class="panel hr-leave-panel"><div class="row hr-leave-heading"><h2>İzin Talepleri</h2><button class="btn primary" data-hr-request>İzin Talebi Oluştur</button></div>${s.leaves.filter(l=>s.selected==="all"||l.organization_id===s.selected).length?`<div class="tablewrap hr-leave-table"><table><thead><tr><th>Personel</th><th>Kurum</th><th>Tür / Tarih</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${s.leaves.filter(l=>s.selected==="all"||l.organization_id===s.selected).map(l=>`<tr><td data-label="Personel">${safe(s.employees.find(e=>e.id===l.employee_id)?.first_name||"")} ${safe(s.employees.find(e=>e.id===l.employee_id)?.last_name||"")}</td><td data-label="Kurum">${safe(orgs.find(o=>o.id===l.organization_id)?.name||"")}</td><td data-label="Tür / Tarih">${safe(leaveTypeLabel[l.leave_type]||l.leave_type)} · ${safe(l.starts_on)} – ${safe(l.ends_on)}</td><td data-label="Durum">${safe(leaveStatusLabel[l.status]||l.status)}</td><td data-label="İşlem">${l.status==="pending"&&canDecide(l)?`<button class="btn sm" data-hr-leave="${safe(l.id)}" data-decision="approved">Onayla</button> <button class="btn sm" data-hr-leave="${safe(l.id)}" data-decision="rejected">Reddet</button>`:"—"}</td></tr>`).join("")}</tbody></table></div>`:"<p class=\"muted\">İzin talebi bulunamadı.</p>"}</div></div>`;
 }
 function bind(root){
  root.querySelectorAll('[data-hr-tab]').forEach(b=>b.addEventListener('click',()=>{S().section=b.dataset.hrTab;draw(root)}));
  root.querySelectorAll('[data-hr-filter]').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{const f=S().hiringFilters||(S().hiringFilters={});f[el.dataset.hrFilter]=el.value;if(el.dataset.hrFilter==='sort')draw(root);else applyHiringFilters(root)}));
  root.querySelector('[data-hr-clear-filters]')?.addEventListener('click',()=>{S().hiringFilters={search:'',organization:'all',opening:'all',stage:'all',priority:'all',interview:'all',sort:'priority'};draw(root)});
  root.querySelector('[data-hr-new-job]')?.addEventListener('click',()=>addJob(root));
  root.querySelectorAll('[data-hr-application-link]').forEach(b=>b.addEventListener('click',()=>applicationLink(root,b.dataset.hrApplicationLink)));
  root.querySelectorAll('[data-hr-new-candidate]').forEach(b=>b.addEventListener('click',()=>addCandidate(root,b.dataset.hrNewCandidate)));
  root.querySelectorAll('[data-hr-display]').forEach(b=>b.addEventListener('click',()=>{S().hiringDisplay=b.dataset.hrDisplay;draw(root)}));
  root.querySelectorAll('[data-hr-expand]').forEach(b=>b.addEventListener('click',()=>{const tr=b.closest('[data-hr-candidate-row]');const expanded=tr.classList.toggle('hr-expanded');b.setAttribute('aria-expanded',String(expanded));b.textContent=expanded?'Kapat':'Detay'}));
  root.querySelectorAll('[data-hr-documents]').forEach(b=>b.addEventListener('click',()=>candidateDocuments(root,b.dataset.hrDocuments)));
  root.querySelectorAll('[data-hr-review]').forEach(b=>b.addEventListener('click',()=>candidateReview(root,b.dataset.hrReview)));
  root.querySelectorAll('[data-hr-history]').forEach(b=>b.addEventListener('click',()=>candidateHistory(b.dataset.hrHistory)));
  root.querySelectorAll('[data-hr-promote]').forEach(b=>b.addEventListener('click',()=>candidatePromote(root,b.dataset.hrPromote)));
  root.querySelectorAll('[data-hr-candidate-edit]').forEach(b=>b.addEventListener('click',()=>candidateForm(root,b.dataset.hrCandidateEdit)));
  root.querySelectorAll('[data-hr-message]').forEach(b=>b.addEventListener('click',()=>candidateMessage(b.dataset.hrMessage,b.dataset.channel)));
  root.querySelectorAll('[data-hr-cv-export]').forEach(b=>b.addEventListener('click',()=>exportCandidateCv(b.dataset.hrCvExport)));
  root.querySelectorAll('[data-hr-candidate-delete]').forEach(b=>b.addEventListener('click',()=>deleteCandidate(root,b.dataset.hrCandidateDelete)));
  root.querySelectorAll('[data-hr-stage]').forEach(b=>b.addEventListener('change',()=>updateStage(root,b.dataset.hrStage,b.value)));
  root.querySelectorAll('[data-hr-job-status]').forEach(b=>b.addEventListener('change',()=>updateJobStatus(root,b.dataset.hrJobStatus,b.value)));
  root.querySelector('[data-hr-refresh]')?.addEventListener('click',async()=>{await load();draw(root)});
  root.querySelector('[data-hr-org]')?.addEventListener('change',e=>{S().selected=e.target.value;draw(root)});
  root.querySelector('[data-hr-search]')?.addEventListener('input',e=>{const s=S();s.query=e.target.value;const start=e.target.selectionStart;draw(root);const input=root.querySelector('[data-hr-search]');input?.focus();input?.setSelectionRange(start,start)});
  root.querySelector('[data-hr-import-users]')?.addEventListener('click',()=>importWorkspaceUsers(root));
  root.querySelector('[data-hr-add]')?.addEventListener('click',()=>add(root));
  root.querySelector('[data-hr-add-org]')?.addEventListener('click',()=>addOrganization(root));
  root.querySelector('[data-hr-access]')?.addEventListener('click',()=>manageAccess(root));
  root.querySelectorAll('[data-hr-edit]').forEach(b=>b.addEventListener('click',()=>editEmployee(root,b.dataset.hrEdit)));
  root.querySelectorAll('[data-hr-link]').forEach(b=>b.addEventListener('click',()=>linkAccount(root,b.dataset.hrLink)));
  root.querySelectorAll('[data-hr-assign]').forEach(b=>b.addEventListener('click',()=>assign(root,b.dataset.hrAssign)));
  root.querySelector('[data-hr-request]')?.addEventListener('click',()=>requestLeave(root));
  root.querySelectorAll('[data-hr-leave]').forEach(b=>b.addEventListener('click',()=>decideLeave(root,b.dataset.hrLeave,b.dataset.decision)));
 }
 function draw(root){root.innerHTML=view();bind(root);if(S().section==='hiring')applyHiringFilters(root)}
 async function mount(root){if(!S().loaded)await load();draw(root)}
 function add(root){
  if(!owner())return;
  const s=S();if(!s.organizations.some(o=>o.is_active)){toast('Önce aktif İK kurum kaydı oluşturulmalıdır.');return}
  const overlay=document.createElement('div');overlay.className='hr-overlay';
  overlay.innerHTML=`<form class="hr-dialog"><h2>Personel Ekle</h2><label>Ad<input name="first" maxlength="100" required></label><label>Soyad<input name="last" maxlength="100" required></label><label>İş e-postası<input name="email" type="email"></label><label>Kurum<select name="org" required>${s.organizations.filter(o=>o.is_active).map(o=>`<option value="${safe(o.id)}">${safe(o.name)}</option>`).join('')}</select></label><label>Unvan<input name="title" maxlength="150" required></label><label>İşe giriş<input name="start" type="date" required></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div><p class="muted small">Yeni personel uygulama hesabı açmaz. Hesap eşleştirmesi ayrıca yapılır.</p></form>`;
  document.body.append(overlay);
  overlay.querySelector('[data-hr-cancel]').onclick=()=>overlay.remove();
  overlay.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
   try{
    const {error:err}=await sb.rpc('hr_create_employee',{
     p_workspace_id:WS,p_first_name:String(fd.get('first')).trim(),
     p_last_name:String(fd.get('last')).trim(),p_work_email:String(fd.get('email')).trim(),
     p_organization_id:String(fd.get('org')),p_position_title:String(fd.get('title')).trim(),
     p_start_date:String(fd.get('start'))
    });
    if(err)throw err;
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
  const assignments=S().employments.filter(x=>x.employee_id===id);
  if(!person||!orgs.length){toast('Aktif kurum bulunamadı');return}
  const options=assignments.map(x=>`<option value="${safe(x.id)}">${safe(orgs.find(o=>o.id===x.organization_id)?.name||'Kurum')} · ${safe(x.position_title)}${x.is_primary?' (Birincil)':''}</option>`).join('');
  const overlay=modal(`<form class="hr-dialog"><h2>Görev Yeri / Okul Türü</h2><p class="muted">${safe(person.first_name)} ${safe(person.last_name)}</p><label>İşlem<select name="assignment">${options}<option value="new">+ Yeni görev yeri ekle</option></select></label><label>Okul / Kurum<select name="org" required>${orgs.map(o=>`<option value="${safe(o.id)}">${safe(o.name)}</option>`).join('')}</select></label><label>Görev / Unvan<input name="title" maxlength="150" required></label><label>Başlangıç tarihi<input type="date" name="start" required></label><label>Bitiş tarihi (isteğe bağlı)<input type="date" name="end"></label><label><input type="checkbox" name="primary" checked> Birincil görev yeri</label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form=overlay.querySelector('form'),choice=form.elements.assignment;
  const fill=()=>{
   const x=assignments.find(a=>a.id===choice.value);
   form.elements.org.value=x?.organization_id||orgs[0].id;
   form.elements.title.value=x?.position_title||'';
   form.elements.start.value=x?.start_date||new Date().toISOString().slice(0,10);
   form.elements.end.value=x?.end_date||'';
   form.elements.primary.checked=x?!!x.is_primary:true;
  };
  choice.onchange=fill;fill();
  form.onsubmit=async ev=>{
   ev.preventDefault();const fd=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
   try{
    const start=String(fd.get('start')),end=String(fd.get('end')),org=String(fd.get('org')),existing=String(fd.get('assignment')),primary=fd.has('primary');
    if(end&&end<start)throw Error('Bitiş tarihi başlangıçtan önce olamaz');
    const duplicate=S().employments.some(m=>m.employee_id===id&&m.id!==existing&&m.organization_id===org&&(!m.end_date||m.end_date>=start));
    if(duplicate)throw Error('Bu kurumda çakışan başka bir görevlendirme var');
    const values={organization_id:org,position_title:String(fd.get('title')).trim(),start_date:start,end_date:end||null,is_primary:primary};
    if(!primary&&existing!=='new'&&assignments.find(a=>a.id===existing)?.is_primary&&!assignments.some(a=>a.id!==existing&&a.is_primary))throw Error('Önce başka bir görev yerini birincil seçin');
    if(primary){
     const {error:clearError}=await sb.from('hr_employments').update({is_primary:false}).eq('workspace_id',WS).eq('employee_id',id).eq('is_primary',true);
     if(clearError)throw clearError;
    }
    const result=existing==='new'?await sb.from('hr_employments').insert({...values,workspace_id:WS,employee_id:id}):await sb.from('hr_employments').update(values).eq('workspace_id',WS).eq('employee_id',id).eq('id',existing);
    if(result.error)throw result.error;
    overlay.remove();await load();draw(root);toast('Görev yeri güncellendi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }


 async function importWorkspaceUsers(root){
  if(!owner())return;
  const {data:users,error:err}=await sb.rpc('hr_importable_workspace_users',{p_workspace_id:WS});
  if(err){error(err);return}
  const eligible=(users||[]).filter(u=>!u.already_linked);
  const orgs=S().organizations.filter(o=>o.is_active!==false);
  if(!orgs.length){toast('Önce aktif bir kurum tanımlayın');return}
  const o=modal(`<div class="hr-dialog"><h2>Ortaklar ve Ekipten Personel Aktar</h2>
   <p class="muted small">Hesap ve yetkiler değişmez. Yalnızca seçtiğiniz kişiler için personel kaydı açılır. Her kişi için kurum, görev ve işe başlama tarihini kontrol edin.</p>
   <p>${eligible.length} aktarılabilir kullanıcı • ${(users||[]).length-eligible.length} zaten bağlı</p>
   <div style="max-height:55vh;overflow:auto">
   ${eligible.map(u=>`<div class="panel hr-import-user" data-import-user="${safe(u.user_id)}" style="margin:8px 0">
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-import-check> <strong>${safe(u.full_name)}</strong></label>
    <p class="muted small">${safe(u.email)}</p>
    <label>Kurum<select data-import-org>${orgs.map(x=>`<option value="${safe(x.id)}">${safe(x.name)}</option>`).join('')}</select></label>
    <label>Görev / Ünvan<input data-import-title value="${safe(u.position_title||'')}" placeholder="Görev / Ünvan" maxlength="120"></label>
    <label>İşe Başlama Tarihi<input data-import-start type="date"></label>
   </div>`).join('')||'<p>Aktarılabilecek yeni kullanıcı yok.</p>'}</div>
   <div class="actions"><button class="btn" data-hr-cancel>Kapat</button><button class="btn primary" data-import-submit ${eligible.length?'':'disabled'}>Seçilenleri Aktar</button></div></div>`);
  o.querySelector('[data-import-submit]')?.addEventListener('click',async()=>{
   const rows=[...o.querySelectorAll('.hr-import-user')].filter(x=>x.querySelector('[data-import-check]').checked);
   if(!rows.length){toast('En az bir kullanıcı seçin');return}
   for(const row of rows)if(!row.querySelector('[data-import-title]').value.trim()||!row.querySelector('[data-import-start]').value){toast('Seçilen herkes için görev ve işe başlama tarihi gerekli');return}
   if(!window.confirm(rows.length+' kişi için personel kaydı oluşturulsun mu?'))return;
   const btn=o.querySelector('[data-import-submit]');btn.disabled=true;let done=0,failed=[];
   for(const row of rows){const u=eligible.find(x=>x.user_id===row.dataset.importUser);
    const {error:failure}=await sb.rpc('hr_import_workspace_user',{p_workspace_id:WS,p_user_id:u.user_id,p_organization_id:row.querySelector('[data-import-org]').value,p_position_title:row.querySelector('[data-import-title]').value.trim(),p_start_date:row.querySelector('[data-import-start]').value});
    if(failure)failed.push(u.full_name+': '+failure.message);else done++;
   }
   o.remove();await load();draw(root);toast(done+' personel kaydı oluşturuldu');
   if(failed.length)window.alert('Aktarılamayanlar:\n'+failed.join('\n'));
  });
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

 const hiringStages={applied:'Başvuru',screening:'Ön Değerlendirme',call:'Kesinlikle Çağrılacak',interview:'Görüşme',offer:'Teklif',hired:'İşe Alındı',rejected:'Olumsuz'};
 const hiringStatus={open:'Açık',paused:'Beklemede',closed:'Kapalı'};
 function applyHiringFilters(root){
  const f=S().hiringFilters||{},now=Date.now();let shown=0;
  root.querySelectorAll('[data-hr-candidate-row]').forEach(tr=>{
   const c=S().hiringCandidates.find(x=>x.id===tr.dataset.hrCandidateRow);if(!c)return;
   const j=S().hiringOpenings.find(x=>x.id===c.opening_id);
   const term=String(f.search||'').toLocaleLowerCase('tr-TR').trim();
   const searchable=[c.full_name,c.email,c.phone,c.previous_employers,c.education,c.skills,c.branch,j?.title].join(' ').toLocaleLowerCase('tr-TR');
   const when=c.interview_at?new Date(c.interview_at).getTime():null;
   const ok=(!term||searchable.includes(term))&&(!f.organization||f.organization==='all'||j?.organization_id===f.organization)
    &&(!f.opening||f.opening==='all'||c.opening_id===f.opening)
    &&(!f.stage||f.stage==='all'||c.stage===f.stage)
    &&(!f.priority||f.priority==='all'||String(c.priority||2)===f.priority)
    ;
   const matchInterview=!f.interview||f.interview==='all'||(f.interview==='scheduled'&&when!==null)
    ||(f.interview==='unscheduled'&&when===null)
    ||(f.interview==='upcoming'&&when!==null&&when>=now)
    ||(f.interview==='past'&&when!==null&&when<now);
   tr.hidden=!(ok&&matchInterview);if(!tr.hidden)shown++;
  });
  root.querySelectorAll('[data-hr-opening-panel]').forEach(p=>{const f=S().hiringFilters||{};const j=S().hiringOpenings.find(x=>x.id===p.dataset.hrOpeningPanel);
   p.hidden=!!((f.organization&&f.organization!=='all'&&j?.organization_id!==f.organization)||(f.opening&&f.opening!=='all'&&j?.id!==f.opening));
   const count=p.querySelector('[data-hr-opening-count]');if(count)count.textContent=p.querySelectorAll('[data-hr-candidate-row]:not([hidden])').length+' aday';
  });
  const counter=root.querySelector('[data-hr-filter-count]');if(counter)counter.textContent=shown+' aday gösteriliyor';
 }
 function hiringSort(a,b){
  const sort=S().hiringFilters?.sort||'priority';
  if(sort==='newest')return String(b.created_at||'').localeCompare(String(a.created_at||''));
  if(sort==='name')return String(a.full_name).localeCompare(String(b.full_name),'tr');
  if(sort==='interview')return String(a.interview_at||'9999').localeCompare(String(b.interview_at||'9999'));
  if(sort==='stage')return String(a.stage).localeCompare(String(b.stage));
  return (a.priority||2)-(b.priority||2)||String(a.interview_at||'9999').localeCompare(String(b.interview_at||'9999'));
 }
 function hiringView(){
  const s=S();if(!canViewHiring())return '<div class="hr-module"><h2>İşe Alım</h2><p>Bu alan yalnızca yönetici yetkisine açıktır.</p><button class="btn" data-hr-tab="staff">Personel Yönetimine Dön</button></div>';
  const f=s.hiringFilters||(s.hiringFilters={search:'',organization:'all',opening:'all',stage:'all',priority:'all',interview:'all',sort:'priority'});
  return `<div class="hr-module hr-hiring-view hr-display-${safe(s.hiringDisplay||'list')}"><div class="titlebar"><div><h2>İşe Alım</h2><p class="muted">İlanlar, aday başvuruları ve görüşme aşamaları</p></div><button class="btn primary" data-hr-new-job>Yeni İlan</button></div>
   <div class="actions" style="margin-bottom:12px"><button class="btn" data-hr-tab="staff">Personel Yönetimi</button><button class="btn primary" data-hr-tab="hiring">İşe Alım</button></div>
   <div class="hr-kpis"><div class="panel">İlanlar<strong>${s.hiringOpenings.length}</strong></div><div class="panel">Açık İlan<strong>${s.hiringOpenings.filter(j=>j.status==='open').length}</strong></div><div class="panel">Adaylar<strong>${s.hiringCandidates.length}</strong></div></div>
   <div class="panel"><h3>Aday Filtreleme ve Sıralama</h3><div class="hr-filter-grid">
   <label>Ara<input data-hr-filter="search" placeholder="Ad, telefon, deneyim, pozisyon..." value="${safe(f.search||'')}"></label>
   <label>Kurum<select data-hr-filter="organization"><option value="all">Tüm kurumlar</option>${s.organizations.map(o=>`<option value="${safe(o.id)}" ${f.organization===o.id?'selected':''}>${safe(o.name)}</option>`).join('')}</select></label>
   <label>Pozisyon<select data-hr-filter="opening"><option value="all">Tüm pozisyonlar</option>${s.hiringOpenings.map(j=>`<option value="${safe(j.id)}" ${f.opening===j.id?'selected':''}>${safe(j.title)}</option>`).join('')}</select></label>
   <label>Başvuru Durumu<select data-hr-filter="stage"><option value="all">Tüm durumlar</option>${Object.entries(hiringStages).map(([v,n])=>`<option value="${v}" ${f.stage===v?'selected':''}>${safe(n)}</option>`).join('')}</select></label>
   <label>Öncelik<select data-hr-filter="priority"><option value="all">Tüm öncelikler</option>${[['1','Acil'],['2','Normal'],['3','Yedek']].map(([v,n])=>`<option value="${v}" ${f.priority===v?'selected':''}>${n}</option>`).join('')}</select></label>
   <label>Görüşme<select data-hr-filter="interview"><option value="all">Tüm görüşmeler</option>${[['scheduled','Planlanan'],['unscheduled','Planlanmayan'],['upcoming','Yaklaşan'],['past','Geçmiş']].map(([v,n])=>`<option value="${v}" ${f.interview===v?'selected':''}>${n}</option>`).join('')}</select></label>
   <label>Sıralama<select data-hr-filter="sort">${[['priority','Öncelik'],['interview','Görüşme Tarihi'],['newest','En Yeni Başvuru'],['name','Aday Adı'],['stage','Başvuru Durumu']].map(([v,n])=>`<option value="${v}" ${f.sort===v?'selected':''}>${n}</option>`).join('')}</select></label>
   </div><div class="actions"><span class="muted" data-hr-filter-count></span><button class="btn" data-hr-clear-filters>Filtreleri Temizle</button></div><div class="actions hr-view-switch"><span class="muted small">Görünüm:</span><button class="btn sm" data-hr-display="list" aria-pressed="${s.hiringDisplay!=='cards'}">☷ Liste</button><button class="btn sm" data-hr-display="cards" aria-pressed="${s.hiringDisplay==='cards'}">▦ Kart</button></div></div>
   ${s.hiringOpenings.length?s.hiringOpenings.map(j=>`<div class="panel" data-hr-opening-panel="${safe(j.id)}"><div class="row"><div><h3>${safe(j.title)}</h3><p class="muted">${safe(s.organizations.find(o=>o.id===j.organization_id)?.name||'Kurum')} · ${safe(j.department||'Genel')} · ${safe(j.employment_type)}</p></div><label>İlan durumu<select data-hr-job-status="${safe(j.id)}">${Object.entries(hiringStatus).map(([v,n])=>`<option value="${v}" ${j.status===v?'selected':''}>${n}</option>`).join('')}</select></label><span class="muted small" data-hr-opening-count></span><button class="btn" data-hr-application-link="${safe(j.id)}">Başvuru Linki</button><button class="btn primary" data-hr-new-candidate="${safe(j.id)}">Aday Ekle</button></div>
    <div class="tablewrap"><table><thead><tr><th>Aday</th><th>İletişim</th><th>Başvuru Aşaması</th><th>Görüşme / İşlem</th></tr></thead><tbody>${s.hiringCandidates.filter(c=>c.opening_id===j.id).sort(hiringSort).map(c=>`<tr data-hr-candidate-row="${safe(c.id)}" class="hr-candidate-stage-${safe(c.stage)}"><td data-label="Aday"><div class="hr-candidate-identity"><strong>${safe(c.full_name)}</strong><button type="button" class="btn sm hr-expand-btn" data-hr-expand="${safe(c.id)}" aria-expanded="false">Detay</button></div><div class="muted small hr-candidate-branch">Branş: ${safe(c.branch||j.department||j.title||'Belirtilmedi')}</div><div class="muted small">${c.priority===1?'🔴 Acil / Öncelikli':c.priority===3?'⚪ Yedek':'🟡 Normal'}</div><div class="muted small">${safe(c.note||'')}</div>${c.retain_until&&c.retain_until<new Date().toISOString().slice(0,10)?'<div class="muted small" style="color:#d97706">⚠ Saklama süresi doldu – inceleyin</div>':''}</td><td data-label="İletişim">${safe(c.email||'')}<div>${safe(c.phone||'')}</div></td><td data-label="Başvuru Durumu"><select data-hr-stage="${safe(c.id)}">${Object.entries(hiringStages).map(([v,n])=>`<option value="${v}" ${c.stage===v?'selected':''}>${n}</option>`).join('')}</select></td><td data-label="Görüşme ve İşlemler"><div class="muted small">${c.interview_at?safe(new Date(c.interview_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})):'Görüşme planlanmadı'}</div><div class="muted small">${safe((state.profiles||[]).find(p=>p.id===c.interviewer_id)?.full_name||'')}</div><div class="muted small">${safe(c.interview_notes||'')}</div><div class="hr-candidate-actions"><button class="btn sm" data-hr-candidate-edit="${safe(c.id)}">CV / Düzenle</button> <button class="btn sm" data-hr-message="${safe(c.id)}" data-channel="whatsapp">WhatsApp</button> <button class="btn sm" data-hr-message="${safe(c.id)}" data-channel="email">E-posta</button> <button class="btn sm" data-hr-cv-export="${safe(c.id)}">CV Aktar</button> <button class="btn sm" data-hr-documents="${safe(c.id)}">Belgeler</button> <button class="btn sm" data-hr-review="${safe(c.id)}">Değerlendir</button> <button class="btn sm" data-hr-history="${safe(c.id)}">Geçmiş</button> ${c.stage!=='rejected'&&!s.hiringPromotions.some(p=>p.candidate_id===c.id)?`<button class="btn sm" data-hr-promote="${safe(c.id)}">Personel Yap</button>`:''} ${s.hiringPromotions.some(p=>p.candidate_id===c.id)?'<span class="muted small">Personel kaydına aktarıldı</span>':`<button class="btn sm" data-hr-candidate-delete="${safe(c.id)}">Sil</button>`}</div></td></tr>`).join('')||'<tr><td colspan="4">Henüz aday yok.</td></tr>'}</tbody></table></div></div>`).join(''):'<div class="panel"><p>Henüz ilan oluşturulmadı. Yeni İlan ile başlayabilirsiniz.</p></div>'}</div>`;
 }


 const candidateTemplates={
  interview:{name:'Görüşme Daveti',subject:'İş Görüşmesi Daveti',body:'Sayın {ad},\n{pozisyon} pozisyonu için başvurunuz değerlendirilmiştir. Sizi {tarih} tarihinde görüşmeye davet ediyoruz. Uygunluğunuzu teyit etmenizi rica ederiz.\nSaygılarımızla,\n{kurum}'},
  confirm:{name:'Görüşme Hatırlatması',subject:'İş Görüşmesi Hatırlatması',body:'Sayın {ad},\n{pozisyon} pozisyonu için {tarih} tarihinde planlanan görüşmenizi hatırlatırız.\n{kurum}'},
  documents:{name:'Evrak Talebi',subject:'Başvuru Evrakları',body:'Sayın {ad},\n{pozisyon} başvurunuzun değerlendirilmesi için gerekli belgeler konusunda bizimle iletişime geçmenizi rica ederiz. Lütfen hassas belgeleri güvenli bir kanaldan paylaşınız.\n{kurum}'},
  offer:{name:'İş Teklifi İçin İletişim',subject:'Başvurunuz Hakkında',body:'Sayın {ad},\n{pozisyon} başvurunuzla ilgili teklif görüşmesi yapmak istiyoruz. Uygun olduğunuz zamanı bildirmenizi rica ederiz.\n{kurum}'},
  result:{name:'Başvuru Sonucu',subject:'İş Başvurunuz Hakkında',body:'Sayın {ad},\n{pozisyon} başvurunuz için teşekkür ederiz. Değerlendirme sonucunda bu aşamada olumlu ilerleyemediğimizi bildirmek isteriz.\n{kurum}'}
 };
 function candidateText(c,template){
  const j=S().hiringOpenings.find(x=>x.id===c.opening_id),org=S().organizations.find(x=>x.id===j?.organization_id);
  const dt=c.interview_at?new Date(c.interview_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'[tarih ve saat belirlenecek]';
  return template.replace(/\n/g,'\n').replace(/\{(ad|pozisyon|tarih|kurum)\}/g,(_,k)=>({ad:c.full_name,pozisyon:j?.title||'ilgili',tarih:dt,kurum:org?.name||'İnsan Kaynakları'})[k]);
 }
 function candidateMessage(id,channel){
  if(!owner())return;const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const mailOptions=[...(c.email?[{email:c.email,label:'Aday • '+c.email}]:[]),...(state.members||[]).filter(m=>m.is_active!==false).map(m=>{
   const p=(state.profiles||[]).find(p=>p.id===m.user_id);return {email:p?.email||m.email||'',label:(p?.full_name||'Ekip')+' • '+(p?.email||m.email||'')};
  }).filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email))];
  const o=modal(`<form class="hr-dialog"><h2>${channel==='whatsapp'?'WhatsApp':'E-posta'} Mesajı</h2>
  <label>Hazır Mesaj<select name="template">${Object.entries(candidateTemplates).map(([k,v])=>`<option value="${k}">${safe(v.name)}</option>`).join('')}</select></label>
  ${channel==='email'?`<label>Gönderilecek E-posta Listesi<select name="recipient"><option value="">Alıcı seçin veya aşağıya yazın</option>${mailOptions.map(x=>`<option value="${safe(x.email)}">${safe(x.label)}</option>`).join('')}</select></label><label>Alıcı E-posta<input name="email" type="email" value="${safe(c.email||'')}" required></label><label>Konu<input name="subject" required></label>`:`<p class="muted">Adayın kayıtlı telefonu: ${safe(c.phone||'Bulunmuyor')}</p>`}
  <label>Mesaj Metni<textarea name="message" rows="9" required></textarea></label>
  <div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button class="btn primary" type="submit">${channel==='whatsapp'?'WhatsApp’ta Aç':'E-posta Uygulamasında Aç'}</button></div>
  <p class="muted small">Mesaj gönderimi için cihazınızdaki ilgili uygulama açılır. Gönderme işlemini siz onaylarsınız.</p></form>`);
  const f=o.querySelector('form');
  const fill=()=>{const t=candidateTemplates[f.elements.template.value];if(!t)return;f.elements.message.value=candidateText(c,t.body);if(f.elements.subject)f.elements.subject.value=t.subject};
  f.elements.template.addEventListener('change',fill);fill();
  f.elements.recipient?.addEventListener('change',()=>{if(f.elements.recipient.value)f.elements.email.value=f.elements.recipient.value});
  f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f),msg=String(d.get('message')||'').trim();if(!msg)return;
   let recipient='';if(channel==='email'){const to=String(d.get('email')||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){toast('Geçerli alıcı e-posta adresi girin');return}
    recipient=to;window.location.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(String(d.get('subject')||''))+'&body='+encodeURIComponent(msg);
   }else{let tel=String(c.phone||'').replace(/\D/g,'');if(/^05\d{9}$/.test(tel))tel='90'+tel.slice(1);else if(/^5\d{9}$/.test(tel))tel='90'+tel;
    if(!/^\d{10,15}$/.test(tel)){toast('WhatsApp için geçerli aday telefonu gerekli');return}
    recipient=tel;window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
   }
   const {error:logError}=await sb.from('hr_candidate_messages').insert({workspace_id:WS,candidate_id:id,channel,recipient,subject:channel==='email'?String(d.get('subject')||''):null,message:msg,status:'prepared',created_by:state.user.id});
   if(logError)error(logError);else toast('Mesaj taslağı geçmişe kaydedildi (gönderim doğrulanmadı)');o.remove();
  };
 }
 function exportCandidateCv(id){
  if(!owner())return;const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const j=S().hiringOpenings.find(x=>x.id===c.opening_id),org=S().organizations.find(x=>x.id===j?.organization_id);
  const rows=[['Başvurulan Kurum',org?.name],['Pozisyon',j?.title],['Branş',c.branch||j?.department||j?.title],['Aday',c.full_name],['E-posta',c.email],['Telefon',c.phone],['Önceki İş Yerleri',c.previous_employers],['Tecrübe (Yıl)',c.experience_years],['Eğitim',c.education],['Yetenekler / Sertifikalar',c.skills],['Maaş Beklentisi (TL)',c.salary_expectation],['Başvuru Durumu',hiringStages[c.stage]],['Öncelik',c.priority],['Görüşme Tarihi',c.interview_at?new Date(c.interview_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):''],['Görüşme Notları',c.interview_notes],['Başvuru Notları',c.note]];
  const generatedAt=new Date().toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'long',timeStyle:'short'});
  const appliedAt=c.created_at?new Date(c.created_at).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
  const docNumber='CV-'+String(c.id||'').slice(0,8).toUpperCase();
  const group=(title,keys)=>'<section class="section"><h2>'+safe(title)+'</h2><div class="fields">'+rows.filter(([k])=>keys.includes(k)).map(([k,v])=>'<div class="field"><div class="field-label">'+safe(k)+'</div><div class="field-value">'+safe(v??'—')+'</div></div>').join('')+'</div></section>';
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(c.full_name)} | Elit Koleji CV</title><style>
  @page{size:A4;margin:14mm 13mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#1b2e47;background:#eef2f7;margin:0;padding:22px}.sheet{max-width:820px;margin:auto;background:#fff;box-shadow:0 10px 32px #102b4a18;min-height:900px}.masthead{background:#112d51;color:#fff;padding:26px 30px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;align-items:center;gap:14px}.mark{width:62px;height:62px;display:flex;align-items:center;justify-content:center;background:#fff;color:#112d51;border:2px solid #45c1c5;border-radius:12px;font-weight:900;font-size:27px;letter-spacing:-3px}.brand-name{font-size:22px;font-weight:800;letter-spacing:.3px}.brand-sub{font-size:11px;color:#c9e3ee;margin-top:5px;letter-spacing:1.3px}.doc-label{text-align:right;font-size:11px;color:#d9e8f3;line-height:1.8}.doc-label strong{display:block;font-size:15px;color:white}.accent{height:6px;background:linear-gradient(90deg,#2eb8c0,#5b9bd5,#112d51)}.content{padding:25px 30px 20px}.eyebrow{color:#277f94;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase}.candidate{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:1px solid #dce6ef;padding:12px 0 19px}.candidate h1{font-size:27px;line-height:1.15;margin:3px 0 7px;color:#112d51}.candidate .role{font-size:14px;color:#516981}.stamp{border:1.5px solid #258e9e;color:#186f82;border-radius:10px;padding:10px 12px;text-align:center;min-width:150px;transform:rotate(-2deg);font-size:11px;font-weight:700;line-height:1.7}.stamp .date{font-size:14px;font-weight:800}.section{margin:22px 0;break-inside:avoid}.section h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#143b64;margin:0 0 11px;padding:0 0 8px;border-bottom:2px solid #2eb8c0}.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}.field{min-width:0;padding:9px 11px;border-radius:7px;background:#f5f8fb;break-inside:avoid}.field-label{font-size:10px;color:#647990;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px}.field-value{font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.footer{border-top:1px solid #dce6ef;margin-top:24px;padding:13px 30px 20px;color:#62758a;font-size:10px;line-height:1.6}.footer strong{color:#143b64}.toolbar{text-align:center;padding:14px}.toolbar button{background:#166f90;color:white;border:0;border-radius:9px;padding:12px 22px;font-weight:bold;cursor:pointer}@media(max-width:550px){body{padding:0}.masthead{padding:17px}.content{padding:17px}.brand-name{font-size:18px}.mark{width:48px;height:48px;font-size:22px}.fields{grid-template-columns:1fr}.stamp{min-width:110px;font-size:9px}.candidate h1{font-size:22px}.footer{padding:15px}}@media print{body{background:white;padding:0}.sheet{max-width:none;min-height:0;box-shadow:none}.toolbar{display:none}.masthead{-webkit-print-color-adjust:exact;print-color-adjust:exact}.accent,.field{-webkit-print-color-adjust:exact;print-color-adjust:exact}.section{break-inside:avoid}}
  </style></head><body><div class="sheet"><header class="masthead"><div class="brand"><div class="mark">EK</div><div><div class="brand-name">ELİT KOLEJİ</div><div class="brand-sub">İNSAN KAYNAKLARI · ADAY DOSYASI</div></div></div><div class="doc-label">BELGE NO<strong>${safe(docNumber)}</strong>Oluşturulma: ${safe(generatedAt)}</div></header><div class="accent"></div><main class="content"><div class="eyebrow">İş Başvurusu / Özgeçmiş</div><div class="candidate"><div><h1>${safe(c.full_name)}</h1><div class="role">${safe(j?.title||'Aday')} · ${safe(c.branch||j?.department||'Branş belirtilmedi')}</div></div><div class="stamp">DİJİTAL KAYIT<div class="date">${safe(generatedAt)}</div>Ortak Takip İK</div></div>
  ${group('Başvuru ve İletişim',['Başvurulan Kurum','Pozisyon','Branş','Aday','E-posta','Telefon'])}
  ${group('Eğitim ve Mesleki Geçmiş',['Eğitim','Önceki İş Yerleri','Tecrübe (Yıl)','Yetenekler / Sertifikalar'])}
  ${group('Başvuru Değerlendirmesi',['Maaş Beklentisi (TL)','Başvuru Durumu','Öncelik','Görüşme Tarihi','Görüşme Notları','Başvuru Notları'])}
  <div class="field"><div class="field-label">Başvuru Kayıt Tarihi</div><div class="field-value">${safe(appliedAt)}</div></div></main><footer class="footer"><strong>Elit Koleji · Özel Çekmeköy Elit Eğitim Kurumları Ltd. Şti.</strong><div>Bu belge kişisel veri içerir; yalnızca yetkili kişilerce işe alım değerlendirmesinde kullanılmalıdır.</div><div>Belge oluşturulma tarihi dijital olarak yazılmıştır; resmî onay, elektronik imza veya mühür niteliğinde değildir.</div></footer></div><div class="toolbar"><button onclick="window.print()">PDF Olarak Kaydet / Yazdır</button></div></body></html>`;
  const w=window.open('','_blank');if(!w){toast('CV için açılır pencereye izin verin');return}w.document.open();w.document.write(html);w.document.close();
 }



 async function candidateDocuments(root,id){
  if(!owner())return;const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const docs=S().hiringDocuments.filter(x=>x.candidate_id===id);
  const o=modal(`<div class="hr-dialog"><h2>Belgeler • ${safe(c.full_name)}</h2>
   <p class="muted small">Özel depolama: PDF, JPG, PNG veya DOCX • En fazla 10 MB. Yalnızca yetkili yönetici erişebilir.</p>
   <label>Belge Yükle<input type="file" data-hr-file accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
   <button class="btn primary" data-hr-upload>Yükle</button>
   <h3>Yüklenen Belgeler</h3>
   ${docs.length?docs.map(x=>`<div class="row" style="margin:8px 0"><span>${safe(x.filename)}</span><button class="btn sm" data-hr-open-doc="${safe(x.id)}">Aç</button><button class="btn sm" data-hr-delete-doc="${safe(x.id)}">Sil</button></div>`).join(''):'<p>Henüz belge yüklenmedi.</p>'}
   <div class="actions"><button class="btn" data-hr-cancel>Kapat</button></div></div>`);
  o.querySelector('[data-hr-upload]').onclick=async()=>{
   const file=o.querySelector('[data-hr-file]').files?.[0];if(!file){toast('Belge seçin');return}
   const allowed=['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
   if(file.size>10485760||!allowed.includes(file.type)){toast('Dosya türü veya boyutu uygun değil');return}
   const path=WS+'/'+id+'/'+crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   const button=o.querySelector('[data-hr-upload]');button.disabled=true;
   try{const {error:up}=await sb.storage.from('hr-candidate-documents').upload(path,file,{contentType:file.type,upsert:false});if(up)throw up;
    const {error:db}=await sb.from('hr_candidate_documents').insert({workspace_id:WS,candidate_id:id,storage_path:path,filename:file.name,content_type:file.type,uploaded_by:state.user.id});
    if(db){await sb.storage.from('hr-candidate-documents').remove([path]);throw db}
    o.remove();await load();draw(root);candidateDocuments(root,id);toast('Belge güvenli alana yüklendi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
  o.querySelectorAll('[data-hr-open-doc]').forEach(b=>b.onclick=async()=>{const x=docs.find(x=>x.id===b.dataset.hrOpenDoc);if(!x)return;
   const {data,error:err}=await sb.storage.from('hr-candidate-documents').createSignedUrl(x.storage_path,60);
   if(err){error(err);return}window.open(data.signedUrl,'_blank','noopener,noreferrer');
  });
  o.querySelectorAll('[data-hr-delete-doc]').forEach(b=>b.onclick=async()=>{const x=docs.find(x=>x.id===b.dataset.hrDeleteDoc);if(!x||!window.confirm('Belge kalıcı silinsin mi?'))return;
   const {error:del}=await sb.storage.from('hr-candidate-documents').remove([x.storage_path]);if(del){error(del);return}
   const {error:db}=await sb.from('hr_candidate_documents').delete().eq('id',x.id).eq('workspace_id',WS);
   if(db){error(db);return}o.remove();await load();draw(root);candidateDocuments(root,id);toast('Belge silindi');
  });
 }


 async function applicationLink(root,openingId){
  if(!owner())return;
  let l=S().hiringLinks.find(x=>x.opening_id===openingId);
  if(!l){const {data,error:err}=await sb.from('hr_application_links').insert({opening_id:openingId,workspace_id:WS}).select('opening_id,token,enabled').single();
   if(err){error(err);return}l=data;S().hiringLinks.push(l);
  }
  const url=new URL('./basvuru.html',location.href);url.searchParams.set('k',l.token);
  const o=modal(`<div class="hr-dialog"><h2>Online CV Başvuru Bağlantısı</h2>
   <p class="muted small">Adaylar bu bağlantı üzerinden giriş yapmadan CV formu doldurabilir. Başvurular ilgili ilan altında listelenir.</p>
   <label>Başvuru Adresi<input data-hr-link-url readonly value="${safe(url.href)}"></label>
   <label class="check" style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-hr-link-enabled ${l.enabled?'checked':''}> Başvuru bağlantısı açık</label>
   <div class="actions"><button class="btn" data-hr-copy-link>Bağlantıyı Kopyala</button><button class="btn" data-hr-share-link>Paylaş</button><button class="btn" data-hr-cancel>Kapat</button></div>
   <p class="muted small">Bağlantı açık olduğu sürece herkes formu doldurabilir. Başvuru bitince bağlantıyı kapatın. Aday bilgileri yalnızca yetkili kullanıcılar tarafından görüntülenir.</p></div>`);
  o.querySelector('[data-hr-copy-link]').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);toast('Başvuru bağlantısı kopyalandı')}catch(e){window.prompt('Bağlantıyı kopyalayın',url.href)}};
  o.querySelector('[data-hr-share-link]').onclick=async()=>{const job=S().hiringOpenings.find(x=>x.id===openingId);const msg='🎓 ELİT KOLEJİ | İŞ BAŞVURULARI\n\n📌 Pozisyon: '+(job?.title||'Eğitim Kadrosu')+'\n\nEkibimize katılmak için online CV başvuru formunu doldurabilirsiniz.\n\n🔗 Başvuru bağlantısı:\n'+url.href;window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer')};
  o.querySelector('[data-hr-link-enabled]').onchange=async e=>{const enabled=e.target.checked;const {error:err}=await sb.from('hr_application_links').update({enabled}).eq('opening_id',openingId).eq('workspace_id',WS);
   if(err){e.target.checked=!enabled;error(err)}else{l.enabled=enabled;toast(enabled?'Başvuru bağlantısı açıldı':'Başvuru bağlantısı kapatıldı')}
  };
 }

 function candidateReview(root,id){
  if(!owner())return;const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const members=(state.members||[]).filter(m=>m.is_active!==false);
  const o=modal(`<form class="hr-dialog"><h2>Görüşme Değerlendirmesi • ${safe(c.full_name)}</h2>
  <label>Görüşmeci<select name="interviewer"><option value="">Belirtilmedi</option>${members.map(m=>`<option value="${safe(m.user_id)}" ${c.interviewer_id===m.user_id?'selected':''}>${safe((state.profiles||[]).find(p=>p.id===m.user_id)?.full_name||m.user_id)}</option>`).join('')}</select></label>
  <label>Görüşme Tarihi<input type="datetime-local" name="date" required></label>
  <label>Mesleki Yeterlilik<select name="professional">${[1,2,3,4,5].map(v=>`<option value="${v}">${v} / 5</option>`).join('')}</select></label>
  <label>İletişim Becerisi<select name="communication">${[1,2,3,4,5].map(v=>`<option value="${v}">${v} / 5</option>`).join('')}</select></label>
  <label>Kuruma Uygunluk<select name="suitability">${[1,2,3,4,5].map(v=>`<option value="${v}">${v} / 5</option>`).join('')}</select></label>
  <label>Karar<select name="decision"><option value="pending">Karar Bekliyor</option><option value="positive">Olumlu</option><option value="negative">Olumsuz</option><option value="follow_up">Yeniden Görüşme</option></select></label>
  <label>Görüşme Notları<textarea name="notes" rows="4" required maxlength="5000"></textarea></label>
  <div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button class="btn primary" type="submit">Değerlendirmeyi Kaydet</button></div></form>`);
  const f=o.querySelector('form');const dt=c.interview_at?new Date(c.interview_at):new Date();
  f.elements.date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(dt).replace(' ','T');
  f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f),btn=f.querySelector('[type=submit]');btn.disabled=true;
   try{const date=String(d.get('date'))+':00+03:00';
    const {error:err}=await sb.from('hr_candidate_interviews').insert({workspace_id:WS,candidate_id:id,interviewer_id:d.get('interviewer')||null,interviewed_at:new Date(date).toISOString(),professional_score:Number(d.get('professional')),communication_score:Number(d.get('communication')),suitability_score:Number(d.get('suitability')),decision:String(d.get('decision')),notes:String(d.get('notes')).trim(),created_by:state.user.id});
    if(err)throw err;o.remove();await load();draw(root);toast('Görüşme değerlendirmesi kaydedildi');
   }catch(e){error(e)}finally{btn.disabled=false}
  };
 }
 function candidateHistory(id){
  if(!owner())return;const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const records=[...S().hiringActivity.filter(x=>x.candidate_id===id).map(x=>({date:x.created_at,title:({created:'Aday eklendi',updated:'Aday güncellendi',stage:'Başvuru aşaması',schedule:'Görüşme planı',interview:'Değerlendirme'})[x.action]||x.action,detail:x.detail||'',actor:x.actor_id})),
  ...S().hiringMessages.filter(x=>x.candidate_id===id).map(x=>({date:x.created_at,title:(x.channel==='email'?'E-posta':'WhatsApp')+' taslağı açıldı',detail:'Alıcı: '+x.recipient+' • '+(x.subject||'')+'\n'+x.message+'\nGönderim doğrulanmadı',actor:x.created_by})),
  ...S().hiringInterviews.filter(x=>x.candidate_id===id).map(x=>({date:x.interviewed_at,title:'Görüşme puanları: '+[x.professional_score,x.communication_score,x.suitability_score].join(' / '),detail:x.notes||'',actor:x.interviewer_id}))].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  modal(`<div class="hr-dialog"><h2>${safe(c.full_name)} • İşlem ve Görüşme Geçmişi</h2>
  <div style="max-height:60vh;overflow:auto">${records.length?records.map(x=>`<div class="panel" style="margin:8px 0"><strong>${safe(x.title)}</strong><p class="muted small">${safe(new Date(x.date).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}))} • ${safe((state.profiles||[]).find(p=>p.id===x.actor)?.full_name||'Sistem / Yetkili')}</p><p style="white-space:pre-wrap">${safe(x.detail)}</p></div>`).join(''):'<p>Henüz işlem geçmişi bulunmuyor.</p>'}</div>
  <div class="actions"><button class="btn" data-hr-cancel>Kapat</button></div></div>`);
 }
 function candidatePromote(root,id){
  if(!owner()||S().hiringPromotions.some(p=>p.candidate_id===id))return;
  const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const j=S().hiringOpenings.find(x=>x.id===c.opening_id);
  const o=modal(`<form class="hr-dialog"><h2>Personel Kaydına Aktar</h2><p><strong>${safe(c.full_name)}</strong> • ${safe(j?.title||'Pozisyon')}</p>
  <p class="muted small">Bu işlem adayın mevcut kurum ve pozisyon bilgilerini kullanarak personel kaydı oluşturur. Tekrar çalıştırılamaz.</p>
  <label>İşe Başlama Tarihi<input name="start" type="date" required></label>
  <div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Personel Olarak Kaydet</button></div></form>`);
  const f=o.querySelector('form');f.elements.start.value=new Date().toISOString().slice(0,10);
  f.onsubmit=async e=>{e.preventDefault();if(!window.confirm(c.full_name+' personel listesine aktarılsın mı?'))return;
   const btn=f.querySelector('[type=submit]');btn.disabled=true;
   try{const {error:err}=await sb.rpc('hr_promote_candidate',{p_candidate_id:id,p_start_date:f.elements.start.value});
    if(err)throw err;o.remove();await load();draw(root);toast('Aday personel listesine aktarıldı');
   }catch(e){error(e)}finally{btn.disabled=false}
  };
 }

 function candidateForm(root,id,presetStage){
  if(!owner())return;
  const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  const members=(state.members||[]).filter(m=>m.is_active!==false);
  const o=modal(`<form class="hr-dialog" style="max-width:720px"><h2>Aday CV / Başvuru Dosyası</h2>
  <label>Ad Soyad<input name="full_name" required maxlength="180"></label><label>Branş / Uzmanlık Alanı<input name="branch" maxlength="120" placeholder="Örn. Okul Öncesi, Matematik, İngilizce"></label>
  <div class="hr-cv-grid"><label>E-posta<input name="email" type="email"></label><label>Telefon<input name="phone"></label>
  <label>Önceki İş Yerleri<textarea name="previous_employers" rows="3"></textarea></label>
  <label>Eğitim / Mezuniyet<textarea name="education" rows="3"></textarea></label>
  <label>Tecrübe (yıl)<input type="number" name="experience_years" min="0" max="70" step=".5"></label>
  <label>Maaş Beklentisi (TL)<input type="number" name="salary_expectation" min="0" step="1"></label>
  <label>Öncelik<select name="priority"><option value="1">1 - Acil / Öncelikli</option><option value="2">2 - Normal</option><option value="3">3 - Yedek</option></select></label>
  <label>Başvuru Aşaması<select name="stage">${Object.entries(hiringStages).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
  <label>Görüşme Tarihi / Saati<input type="datetime-local" name="interview_at"></label>
  <label>Görüşmeyi Yapacak Kişi<select name="interviewer_id"><option value="">Seçilmedi</option>${members.map(m=>`<option value="${safe(m.user_id)}">${safe((state.profiles||[]).find(p=>p.id===m.user_id)?.full_name||m.user_id)}</option>`).join('')}</select></label></div>
  <label>Yetenekler / Sertifikalar<textarea name="skills" rows="2"></textarea></label>
  <label>Başvuru Notları<textarea name="note" rows="3"></textarea></label>
  <label>Görüşme Notları<textarea name="interview_notes" rows="3"></textarea></label>
  <div class="hr-cv-grid"><label>KVKK Aydınlatma Tarihi<input type="date" name="privacy_notice_at"></label><label>Saklama Son Tarihi<input type="date" name="retain_until"></label></div>
  <label>KVKK / Saklama Açıklaması<textarea name="privacy_note" rows="2"></textarea></label>
  <p class="muted small">Görüşme tarihi kaydedilince Ortak Takip takviminde etkinlik oluşur; görüşmeciye uygulama içi bildirim gönderilir. Harici SMS ve WhatsApp otomatik gönderilmez.</p>
  <div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Değişiklikleri Kaydet</button></div></form>`);
  const f=o.querySelector('form');
  for(const k of ['full_name','branch','email','phone','previous_employers','education','experience_years','salary_expectation','priority','stage','interviewer_id','skills','note','interview_notes'])if(f.elements[k])f.elements[k].value=c[k]??'';
  if(presetStage&&f.elements.stage)f.elements.stage.value=presetStage;
  if(c.privacy_notice_at)f.elements.privacy_notice_at.value=String(c.privacy_notice_at).slice(0,10);
  if(c.retain_until)f.elements.retain_until.value=String(c.retain_until).slice(0,10);
  if(f.elements.privacy_note)f.elements.privacy_note.value=c.privacy_note||'';
  if(c.interview_at){const dt=new Date(c.interview_at);f.elements.interview_at.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(dt).replace(' ','T')}
  f.onsubmit=async ev=>{ev.preventDefault();const d=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;
   try{
    const data={};for(const k of ['full_name','branch','email','phone','previous_employers','education','skills','note','interview_notes','stage','interviewer_id'])data[k]=String(d.get(k)||'').trim()||null;
    for(const k of ['experience_years','salary_expectation'])data[k]=d.get(k)===''?null:Number(d.get(k));
    data.priority=Number(d.get('priority'));
    data.privacy_notice_at=d.get('privacy_notice_at')?String(d.get('privacy_notice_at'))+'T00:00:00+03:00':null;
    data.retain_until=d.get('retain_until')||null;data.privacy_note=String(d.get('privacy_note')||'').trim()||null;
    const local=String(d.get('interview_at')||'');data.interview_at=local?new Date(local+':00+03:00').toISOString():null;
    if(data.stage==='call'&&!data.interview_at)throw Error('Kesinlikle çağrılacak aday için görüşme tarihi belirleyin.');
    if(data.interview_at&&!data.interviewer_id)throw Error('Görüşme için sorumlu kişiyi seçin.');
    const {error:err}=await sb.from('hr_candidates').update(data).eq('workspace_id',WS).eq('id',id);
    if(err)throw err;o.remove();await load();draw(root);toast('Aday CV ve görüşme bilgileri güncellendi');
   }catch(e){error(e)}finally{button.disabled=false}
  };
 }
 async function deleteCandidate(root,id){
  if(!owner())return;const c=S().hiringCandidates.find(x=>x.id===id);if(!c)return;
  if(S().hiringPromotions.some(p=>p.candidate_id===id)){toast('Personel kaydına aktarılmış aday silinemez');return}
  if(S().hiringDocuments.some(d=>d.candidate_id===id)){toast('Önce adayın Belgeler bölümündeki dosyalarını silin');return}
  if(!window.confirm(c.full_name+' aday kaydı ve bağlı görüşme takvim etkinliği kalıcı silinsin mi?'))return;
  const {error:err}=await sb.from('hr_candidates').delete().eq('workspace_id',WS).eq('id',id);
  if(err){error(err);return}await load();draw(root);toast('Aday silindi');
 }
 function addJob(root){
  if(!owner())return;
  const orgs=S().organizations.filter(o=>o.is_active);
  if(!orgs.length){toast('Aktif kurum bulunamadı');return}
  const o=modal(`<form class="hr-dialog"><h2>Yeni İş İlanı</h2><label>Kurum<select name="org" required>${orgs.map(x=>`<option value="${safe(x.id)}">${safe(x.name)}</option>`).join('')}</select></label><label>Pozisyon<input name="title" required maxlength="150"></label><label>Bölüm<input name="department" maxlength="120"></label><label>Çalışma Şekli<select name="type"><option value="full_time">Tam Zamanlı</option><option value="part_time">Yarı Zamanlı</option><option value="contract">Sözleşmeli</option><option value="intern">Stajyer</option></select></label><label>Açıklama<textarea name="description" maxlength="3000"></textarea></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div></form>`);
  o.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,d=new FormData(f),b=f.querySelector('[type=submit]');b.disabled=true;try{
   const {error:err}=await sb.from('hr_job_openings').insert({workspace_id:WS,organization_id:d.get('org'),title:String(d.get('title')).trim(),department:String(d.get('department')).trim()||null,employment_type:d.get('type'),description:String(d.get('description')).trim()||null});
   if(err)throw err;o.remove();await load();draw(root);toast('İlan oluşturuldu');
  }catch(e){error(e)}finally{b.disabled=false}};
 }
 function addCandidate(root,openingId){
  if(!owner()||!S().hiringOpenings.some(j=>j.id===openingId))return;
  const o=modal('<form class="hr-dialog"><h2>Aday Başvurusu</h2><label>Ad Soyad<input name="name" maxlength="180" required></label><label>E-posta<input name="email" type="email" maxlength="254"></label><label>Telefon<input name="phone" maxlength="30"></label><label>Branş<input name="branch" maxlength="120" placeholder="Örn. Okul Öncesi, Matematik"></label><label>Görüşme Notu<textarea name="note" maxlength="2000"></textarea></label><div class="actions"><button type="button" class="btn" data-hr-cancel>Vazgeç</button><button type="submit" class="btn primary">Adayı Kaydet</button></div></form>');
  o.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,d=new FormData(f),b=f.querySelector('[type=submit]');b.disabled=true;try{
   const {data:created,error:err}=await sb.from('hr_candidates').insert({workspace_id:WS,opening_id:openingId,full_name:String(d.get('name')).trim(),email:String(d.get('email')).trim()||null,phone:String(d.get('phone')).trim()||null,branch:String(d.get('branch')).trim()||null,note:String(d.get('note')).trim()||null}).select('id').single();
   if(err)throw err;o.remove();await load();draw(root);toast('Aday kaydedildi');candidateForm(root,created.id);
  }catch(e){error(e)}finally{b.disabled=false}};
 }
 async function updateStage(root,id,stage){
  if(!owner()||!Object.keys(hiringStages).includes(stage))return;
  if(stage==='call'){candidateForm(root,id,'call');draw(root);return}
  const {error:err}=await sb.from('hr_candidates').update({stage}).eq('workspace_id',WS).eq('id',id);
  if(err){error(err);await load();draw(root)}else{const c=S().hiringCandidates.find(x=>x.id===id);if(c)c.stage=stage;draw(root);toast('Başvuru aşaması güncellendi')}
 }
 async function updateJobStatus(root,id,status){
  if(!owner()||!Object.keys(hiringStatus).includes(status))return;
  const {error:err}=await sb.from('hr_job_openings').update({status}).eq('workspace_id',WS).eq('id',id);
  if(err){error(err);await load();draw(root)}else{const j=S().hiringOpenings.find(x=>x.id===id);if(j)j.status=status;draw(root);toast('İlan durumu güncellendi')}
 }
 return {mount,load,view};
}
