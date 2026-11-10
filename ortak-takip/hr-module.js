/* Ortak Takip - İnsan Kaynakları, kurum bazlı personel yönetimi */
export function createHrModule({sb,WS,state,esc,toast,error}) {
 const S=()=>state.hr||(state.hr={organizations:[],employees:[],employments:[],selected:'all',query:'',loading:false,loaded:false});
 const safe=v=>esc(String(v??''));
 const owner=()=>state.role==='owner';
 async function load(){
  const s=S();s.loading=true;
  try {
   const [o,e,m]=await Promise.all([
    sb.from('hr_organizations').select('id,name,code,is_active').eq('workspace_id',WS).order('name'),
    sb.from('hr_employees').select('id,first_name,last_name,work_email,status').eq('workspace_id',WS).order('last_name'),
    sb.from('hr_employments').select('id,employee_id,organization_id,position_title,start_date,end_date,is_primary').eq('workspace_id',WS)
   ]);
   for(const r of [o,e,m])if(r.error)throw r.error;
   Object.assign(s,{organizations:o.data||[],employees:e.data||[],employments:m.data||[],loaded:true});
  }catch(e){error(e)}finally{s.loading=false}
 }
 function view(){
  const s=S(), orgs=s.organizations;
  const employments=s.employments.filter(x=>s.selected==='all'||x.organization_id===s.selected);
  const employeeIds=new Set(employments.map(x=>x.employee_id));
  const filtered=s.employees.filter(e=>(s.selected==='all'||employeeIds.has(e.id))&&
   (e.first_name+' '+e.last_name+' '+(e.work_email||'')).toLocaleLowerCase('tr').includes(s.query.toLocaleLowerCase('tr')));
  return `<div class="hr-module">
   <div class="titlebar"><div><h2>İnsan Kaynakları</h2><p class="muted small">Kurum bazlı personel yönetimi ve özlük kayıtları</p></div>
    <div class="actions"><button class="btn" data-hr-refresh>Yenile</button>${owner()?'<button class="btn primary" data-hr-add>Personel Ekle</button>':''}</div></div>
   <div class="hr-kpis"><div class="panel"><span class="muted">Personel</span><strong>${filtered.length}</strong></div><div class="panel"><span class="muted">Aktif</span><strong>${filtered.filter(x=>x.status==='active').length}</strong></div><div class="panel"><span class="muted">Kurum</span><strong>${orgs.length}</strong></div></div>
   <div class="panel"><div class="filters"><label>Kurum <select data-hr-org><option value="all">Tüm yetkili kurumlar</option>${orgs.map(o=>`<option value="${safe(o.id)}" ${s.selected===o.id?'selected':''}>${safe(o.name)}</option>`).join('')}</select></label><label>Personel ara <input data-hr-search value="${safe(s.query)}" placeholder="Ad, soyad veya e-posta"></label></div>
   ${s.loading?'<p>Yükleniyor…</p>':!filtered.length?'<div class="empty">Bu filtrede personel bulunamadı.</div>':`<div class="tablewrap"><table><thead><tr><th>Personel</th><th>Kurum / Görev</th><th>Durum</th></tr></thead><tbody>${filtered.map(e=>`<tr><td><strong>${safe(e.first_name)} ${safe(e.last_name)}</strong><div class="muted small">${safe(e.work_email||'')}</div></td><td>${employments.filter(x=>x.employee_id===e.id).map(x=>`<div>${safe(orgs.find(o=>o.id===x.organization_id)?.name||'Kurum')} · ${safe(x.position_title)}</div>`).join('')||'—'}</td><td>${safe(e.status==='active'?'Aktif':e.status==='on_leave'?'İzinli':'Pasif')}</td></tr>`).join('')}</tbody></table></div>`}
   </div></div>`;
 }
 function bind(root){
  root.querySelector('[data-hr-refresh]')?.addEventListener('click',async()=>{await load();draw(root)});
  root.querySelector('[data-hr-org]')?.addEventListener('change',e=>{S().selected=e.target.value;draw(root)});
  root.querySelector('[data-hr-search]')?.addEventListener('input',e=>{const s=S();s.query=e.target.value;const start=e.target.selectionStart;draw(root);const input=root.querySelector('[data-hr-search]');input?.focus();input?.setSelectionRange(start,start)});
  root.querySelector('[data-hr-add]')?.addEventListener('click',()=>add(root));
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
 return {mount,load,view};
}
