/*
 * Ortak Takip - Teftiş ve Kurumsal Evrak Merkezi
 * First-party module. Does not upload binary files or request Google tokens.
 * The Google Drive file's own sharing permissions remain authoritative.
 */
export function createInspectionModule(api) {
  const {sb, WS, state, esc, options, toast, error, requireActiveSession, render, canManage, openFindingTask} = api;
  const schoolOptions = [['anasinifi','Elit Anaokulu / Anasınıfı'],['ilkokul','Elit İlkokulu'],['aksam','Elit Akşam Lisesi'],['ortaokul','Ortaokul (kurum eklenirse)']];
  const docSchools = [['all','Tüm kurumlar'],['ortak','Ortak kurum evrakları'],...schoolOptions];
  const docCategories = [['resmiyet','Resmî Belgeler'],['personel','Personel'],['guvenlik','Güvenlik'],['egitim','Eğitim'],['ogrenci','Öğrenci İşleri'],['fiziki','Fiziki Şartlar'],['mali','Mali İşler'],['diger','Diğer']];
  const statuses = [['incelenmedi','İncelenmedi'],['uygun','Uygun'],['eksik','Eksik'],['uygulanamaz','Uygulanamaz']];
  const tr = v => String(v || '');
  const label = (arr,key) => arr.find(row=>row[0]===key)?.[1] || key;
  const legalURL = 'https://tkb.meb.gov.tr/www/denetim-rehberleri/icerik/291';
  const common = [
    ['kurum_izni','Resmî Belgeler','Kurum açma ve çalışma izni belgeleri kontrol edildi mi?',true],
    ['yerlesim','Resmî Belgeler','Onaylı yerleşim planı, mevcut kullanım ve kontenjan karşılaştırıldı mı?',true],
    ['duyurular','Resmî Belgeler','Zorunlu ilan, bildirim ve resmî yazışmalar gözden geçirildi mi?',false],
    ['atamalar','Personel','Personel çalışma izinleri, görevlendirmeler ve özlük dosyaları kontrol edildi mi?',true],
    ['sozlesmeler','Personel','Personel sözleşmeleri ve ilgili kayıtlar güncel mi?',false],
    ['yangin','Güvenlik','Yangın güvenliği, tahliye planları ve gerekli kontroller değerlendirildi mi?',true],
    ['isg','Güvenlik','İş sağlığı, güvenliği ve acil durum tedbirleri kontrol edildi mi?',true],
    ['fiziki','Fiziki Şartlar','Derslikler, ortak alanlar ve erişilebilirlik koşulları değerlendirildi mi?',false],
    ['hijyen','Fiziki Şartlar','Temizlik, hijyen ve sağlıkla ilgili önlemler kontrol edildi mi?',false],
    ['mebbis','Yönetim','MEBBİS, e-Okul ve gerektiği durumlarda EBYS işlemleri kontrol edildi mi?',false],
    ['kurullar','Yönetim','Kurul, komisyon ve yönetim kayıtları gözden geçirildi mi?',false],
    ['ogrenci','Öğrenci İşleri','Kayıt, nakil, devam-devamsızlık ve öğrenci dosyaları incelendi mi?',false],
    ['planlar','Eğitim','Eğitim planları ve uygulama kayıtları gözden geçirildi mi?',false],
    ['ucret','Mali ve Sözleşmeler','Ücret ilanı, sözleşme ve ilgili özel okul işlemleri kontrol edildi mi?',false]
  ];
  const specific = {
    anasinifi: [
      ['okuloncesi_program','Eğitim','Okul öncesi eğitim programına uygun planlama ve gözlem kayıtları incelendi mi?',false],
      ['gelisim','Öğrenci İşleri','Çocuk gelişimi takip ve aile iletişim kayıtları kontrol edildi mi?',false]
    ],
    ilkokul: [
      ['siniflar','Eğitim','İlkokul sınıf/şube, ders ve öğretmen dağılım işlemleri kontrol edildi mi?',false],
      ['olcme','Eğitim','İlkokul düzeyine uygun öğrenci gelişimi ve ölçme kayıtları incelendi mi?',false]
    ],
    ortaokul: [
      ['olcme','Eğitim','Ders planı, ölçme-değerlendirme ve sınav işlemleri gözden geçirildi mi?',false],
      ['rehberlik','Eğitim','Rehberlik faaliyetleri ve ilgili kayıtlar kontrol edildi mi?',false]
    ],
    aksam: [
      ['sinav','Eğitim','Sınav, değerlendirme ve öğrenci başarısına ilişkin kayıtlar kontrol edildi mi?',false],
      ['mezuniyet','Öğrenci İşleri','Mezuniyet, öğrenci geçişi ve devam kayıtları incelendi mi?',false]
    ]
  };
  const checklist = unit => [...common,...(specific[unit]||[])].map(([key,category,title,critical])=>({key,category,title,critical}));
  const S = () => state.inspection || (state.inspection = {unit:'ilkokul',sessionId:null,docs:[],sessions:[],answers:[],docUnit:'all',docSearch:'',docForm:false,editDocId:null,busy:false});
  const current = () => S().sessions.find(s=>s.id===S().sessionId);
  const answerFor = key => S().answers.find(x=>x.criterion_key===key);
  const count = () => {
    const rows=checklist(S().unit),result={total:rows.length,ok:0,missing:0,pending:0,na:0,critical:0};
    for(const x of rows){
      const status=answerFor(x.key)?.status||'incelenmedi';
      if(status==='uygun')result.ok++;
      else if(status==='eksik'){result.missing++;if(x.critical)result.critical++;}
      else if(status==='uygulanamaz')result.na++;
      else result.pending++;
    }
    result.percent=Math.round(result.ok/Math.max(1,result.total-result.na)*100);
    result.ready=result.pending===0&&result.missing===0&&result.critical===0;
    return result;
  };
  const validDriveURL = input => {
    try {
      const u=new URL(String(input||'').trim());
      return u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname)&&!u.username&&!u.password&&u.href.length<=1900?u.href:'';
    } catch { return ''; }
  };
  function docOptions(selected,unit) {
    const docs=S().docs.filter(x=>x.school_unit===unit||x.school_unit==='ortak');
    return options([['','Belge bağlama'],...docs.map(d=>[d.id,d.title])],selected);
  }
  async function load() {
    if(!canManage())return;
    const [documents,sessions]=await Promise.all([
      sb.from('institution_documents').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}).limit(500),
      sb.from('inspection_sessions').select('*').eq('workspace_id',WS).order('created_at',{ascending:false}).limit(200)
    ]);
    if(documents.error)throw documents.error;
    if(sessions.error)throw sessions.error;
    S().docs=documents.data||[];
    S().sessions=sessions.data||[];
    if(!current())S().sessionId=S().sessions.find(x=>x.school_unit===S().unit)?.id||null;
    await loadAnswers();
  }
  async function loadAnswers() {
    if(!S().sessionId){S().answers=[];return;}
    const result=await sb.from('inspection_answers').select('*').eq('workspace_id',WS).eq('session_id',S().sessionId);
    if(result.error)throw result.error;
    S().answers=result.data||[];
  }
  const docLink = (url,title='Drive üzerinde aç')=>{
    const safe=validDriveURL(url);
    return safe?'<a href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer" class="btn sm">'+esc(title)+' ↗</a>':'';
  };
  function view() {
    if(!canManage())return '<p class="muted">Bu modüle yalnızca Admin ve Yönetici erişebilir.</p>';
    const s=S(),selected=current(),stats=count(),rows=checklist(s.unit);
    const sessionOpts=s.sessions.filter(x=>x.school_unit===s.unit).map(x=>[x.id,(x.title||'Ön Denetim')+' · '+x.academic_year+' · '+new Date(x.created_at).toLocaleDateString('tr-TR')+(x.status==='completed'?' ✓':'')]);
    const html=['<div class="inspection-hero"><div><h2>Denetime Hazırlık ve Öz Değerlendirme</h2><p>Okul müdürü ve kurum sahibi için iç kontrol. Resmî MEB denetimi veya uygunluk belgesi değildir.</p></div><a href="'+legalURL+'" target="_blank" rel="noopener noreferrer" class="btn sm">MEB denetim rehberleri ↗</a></div>',
      '<div class="inspection-toolbar"><label>Kurum<select id="inspectionSchool">'+options(schoolOptions,s.unit)+'</select></label><label>Denetim oturumu<select id="inspectionSession">'+options([['','Yeni oturum seçin'],...sessionOpts],selected?.id||'')+'</select></label><button type="button" class="btn teal" id="inspectionNew">+ Yeni Ön Denetim</button><button type="button" class="btn" data-view="documents">Evrak Merkezi</button></div>'];
    if(!selected){
      html.push('<div class="inspection-empty"><h3>Bu kurum için henüz ön denetim yok</h3><p>Yeni Ön Denetim seçeneğiyle ilk kontrolünüzü başlatın.</p></div>');
      return html.join('');
    }
    html.push('<div class="inspection-stats"><div><strong>'+stats.percent+'%</strong><span>Ön kontrol uygunluğu</span></div><div><strong>'+stats.ok+'</strong><span>Uygun</span></div><div><strong>'+stats.missing+'</strong><span>Eksik</span></div><div><strong>'+stats.pending+'</strong><span>İncelenmedi</span></div><div><strong>'+stats.critical+'</strong><span>Kritik eksik</span></div></div>');
    html.push('<div class="inspection-readiness '+(stats.ready?'ok':'warn')+'"><strong>'+(stats.ready?'Ön kontrollerin tamamı uygun':'Eksikler veya tamamlanmamış kontroller var')+'</strong><span>Bu sonuç yalnızca girilen cevaplara dayalı iç değerlendirmedir. Mevzuat uygunluğu ayrıca yetkili kişilerce doğrulanmalıdır.</span></div>');
    if(selected.status==='completed') html.push('<p class="inspection-note">Bu denetim tamamlanmış ve değişikliğe kapatılmıştır. Yeni kontrol için ayrı oturum açın.</p>');
    let last='';
    for(const row of rows){
      if(row.category!==last){if(last)html.push('</div>');last=row.category;html.push('<h3 class="inspection-category">'+esc(last)+'</h3><div class="inspection-checklist">');}
      const a=answerFor(row.key),status=a?.status||'incelenmedi',doc=s.docs.find(d=>d.id===a?.document_id);
      html.push('<article class="inspection-check" data-criterion="'+esc(row.key)+'"><div class="inspection-check-title"><strong>'+esc(row.title)+'</strong>'+(row.critical?'<span class="inspection-critical">Kritik</span>':'')+'</div>',
        '<div class="inspection-check-fields"><label>Sonuç<select name="status" '+(selected.status==='completed'?'disabled':'')+'>'+options(statuses,status)+'</select></label><label>Kanıt belgesi<select name="document_id" '+(selected.status==='completed'?'disabled':'')+'>'+docOptions(a?.document_id||'',s.unit)+'</select></label></div>',
        '<label class="inspection-note-label">Açıklama<textarea name="note" rows="2" maxlength="3000" '+(selected.status==='completed'?'disabled':'')+' placeholder="Gözlem, eksik, yapılacak işlem...">'+esc(a?.note||'')+'</textarea></label>',
        '<div class="inspection-check-actions">'+(doc?docLink(doc.drive_url,'Belgeyi Gör'):'')+(selected.status==='completed'?'':(status==='eksik'?'<button type="button" class="btn sm" data-inspection-task="'+esc(row.key)+'">Göreve Aktar</button>':'')+'<button type="button" class="btn teal sm" data-check-save="'+esc(row.key)+'">Kontrolü Kaydet</button>')+'</div></article>');
    }
    if(last)html.push('</div>');
    html.push('<div class="inspection-footer"><button type="button" class="btn" id="inspectionPrint">Yazdır / PDF</button><button type="button" class="btn" id="inspectionCsv">Excel için CSV</button>'+(selected.status==='draft'?'<button type="button" class="btn teal" id="inspectionComplete">Ön Denetimi Tamamla</button>':'')+'</div>');
    return html.join('');
  }
  function docsView() {
    if(!canManage())return '<p class="muted">Bu alana erişim yetkiniz yok.</p>';
    const s=S();
    const docs=s.docs.filter(d=>(s.docUnit==='all'||d.school_unit===s.docUnit)&&(!s.docSearch||[d.title,d.notes,d.category].some(x=>tr(x).toLocaleLowerCase('tr-TR').includes(s.docSearch.toLocaleLowerCase('tr-TR')))));
    const edit=s.docs.find(d=>d.id===s.editDocId);
    const html=['<div class="inspection-hero"><div><h2>Kurumsal Evrak Merkezi</h2><p>Belgeler Google Drive üzerinde kalır; uygulamaya sadece adları, bağlantıları ve açıklamaları kaydedilir.</p></div><a class="btn sm" href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noopener noreferrer">Google Drive ↗</a></div>',
      '<div class="inspection-toolbar"><label>Kurum<select id="docSchoolFilter">'+options(docSchools,s.docUnit)+'</select></label><label>Belge ara<input id="docSearch" type="search" placeholder="Belge adı veya açıklama..." value="'+esc(s.docSearch)+'"></label><button type="button" class="btn teal" id="docNew">+ Drive Bağlantısı Ekle</button></div>',
      '<p class="inspection-note">Güvenlik: Drive bağlantısı eklemek belge erişimi vermez. Google Drive paylaşım ayarlarında yalnızca yetkili kişiler bulunmalıdır. Öğrenci ve personel dosyaları için KVKK değerlendirmesi yapılmadan belge eklemeyin.</p>'];
    if(s.docForm)html.push('<form id="inspectionDocForm" class="inspection-doc-form"><h3>'+(edit?'Evrak Bağlantısını Düzenle':'Evrak Bağlantısı Ekle')+'</h3><div class="inspection-check-fields"><label>Belge adı<input name="title" minlength="3" maxlength="220" required value="'+esc(edit?.title||'')+'"></label><label>Kurum<select name="school_unit">'+options(docSchools.filter(x=>x[0]!=='all'),edit?.school_unit||'ortak')+'</select></label><label>Belge sınıfı<select name="category">'+options(docCategories,edit?.category||'resmiyet')+'</select></label><label>Geçerlilik / kontrol tarihi<input type="date" name="expires_on" value="'+esc(edit?.expires_on||'')+'"></label></div><label>Google Drive / Google Docs bağlantısı<input name="drive_url" type="url" required maxlength="1900" placeholder="https://drive.google.com/file/d/..." value="'+esc(edit?.drive_url||'')+'"></label><label>Açıklama<textarea name="notes" rows="2" maxlength="1500">'+esc(edit?.notes||'')+'</textarea></label><div class="inspection-check-actions"><button class="btn teal" type="submit">Kaydet</button><button class="btn" type="button" id="docCancel">Vazgeç</button></div></form>');
    if(!docs.length)html.push('<div class="inspection-empty">Bu filtreye uygun evrak bağlantısı bulunamadı.</div>');
    else html.push('<div class="inspection-doc-grid">'+docs.map(d=>'<article class="inspection-doc-card"><div class="inspection-doc-icon">▤</div><div><strong>'+esc(d.title)+'</strong><p>'+esc(label(docSchools,d.school_unit))+' · '+esc(label(docCategories,d.category))+'</p>'+(d.expires_on?'<p>Kontrol tarihi: '+esc(d.expires_on)+'</p>':'')+(d.notes?'<p>'+esc(d.notes)+'</p>':'')+'</div><div class="inspection-check-actions">'+docLink(d.drive_url,'Drive’da Aç')+'<button type="button" class="btn sm" data-doc-edit="'+esc(d.id)+'">Düzenle</button></div></article>').join('')+'</div>');
    return html.join('');
  }
  async function setSchool(unit) {
    if(!schoolOptions.some(x=>x[0]===unit))return;
    S().unit=unit;
    S().sessionId=S().sessions.find(x=>x.school_unit===unit)?.id||null;
    try { await loadAnswers(); render(); } catch(e){error(e);}
  }
  async function selectSession(id) {
    const selected=S().sessions.find(x=>x.id===id&&x.school_unit===S().unit);
    S().sessionId=selected?.id||null;
    try { await loadAnswers(); render(); } catch(e){error(e);}
  }
  async function newSession() {
    const year=prompt('Eğitim öğretim yılı (ör. 2026-2027)', '2026-2027');
    if(year===null)return;
    if(!/^20\d{2}-20\d{2}$/.test(year)){toast('Yılı 2026-2027 biçiminde yazın.');return;}
    if(!canManage()||S().busy)return;
    S().busy=true;
    try {
      await requireActiveSession();
      const result=await sb.from('inspection_sessions').insert({workspace_id:WS,school_unit:S().unit,academic_year:year,title:'Kurum Ön Denetimi',created_by:state.user.id}).select('id').single();
      if(result.error)throw result.error;
      S().sessionId=result.data.id;
      await load(); render(); toast('Ön denetim açıldı.');
    }catch(e){error(e);}finally{S().busy=false;}
  }
  async function saveCheck(key,node) {
    const session=current(),item=checklist(S().unit).find(x=>x.key===key);
    if(!session||session.status==='completed'||!item||!node||S().busy)return;
    const status=node.querySelector('[name="status"]').value;
    const note=node.querySelector('[name="note"]').value.trim();
    const document_id=node.querySelector('[name="document_id"]').value||null;
    if(!statuses.some(x=>x[0]===status))return;
    if(document_id&&!S().docs.some(d=>d.id===document_id&&(d.school_unit==='ortak'||d.school_unit===S().unit))){toast('Belge erişimi uygun değil.');return;}
    S().busy=true;
    try {
      await requireActiveSession();
      const payload={workspace_id:WS,session_id:session.id,criterion_key:key,criterion_title:item.title,category:item.category,is_critical:item.critical,status,note,document_id,updated_by:state.user.id,updated_at:new Date().toISOString()};
      const response=await sb.from('inspection_answers').upsert(payload,{onConflict:'session_id,criterion_key'});
      if(response.error)throw response.error;
      await loadAnswers();render();toast('Kontrol kaydedildi.');
    }catch(e){error(e);}finally{S().busy=false;}
  }
  async function complete() {
    const session=current(),stats=count();
    if(!session||session.status!=='draft'||S().busy)return;
    if(stats.pending){toast('Önce incelenmemiş '+stats.pending+' kontrolü cevaplayın.');return;}
    if(!confirm('Bu ön denetimi kapatmak istiyor musunuz? Eksiklikler varsa raporda görünmeye devam eder.'))return;
    S().busy=true;
    try {
      await requireActiveSession();
      const response=await sb.from('inspection_sessions').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',session.id).eq('workspace_id',WS);
      if(response.error)throw response.error;
      await load();render();toast('Ön denetim tamamlandı.');
    }catch(e){error(e);}finally{S().busy=false;}
  }
  async function saveDocument(form) {
    if(S().busy||!canManage())return;
    const fd=new FormData(form),url=validDriveURL(fd.get('drive_url'));
    if(!url){toast('Yalnızca drive.google.com veya docs.google.com üzerindeki HTTPS bağlantılarını ekleyin.');return;}
    const payload={workspace_id:WS,title:tr(fd.get('title')).trim(),school_unit:fd.get('school_unit'),category:fd.get('category'),drive_url:url,notes:tr(fd.get('notes')).trim(),expires_on:fd.get('expires_on')||null,updated_at:new Date().toISOString()};
    if(!docSchools.some(x=>x[0]===payload.school_unit&&x[0]!=='all')||!docCategories.some(x=>x[0]===payload.category))return;
    S().busy=true;
    try {
      await requireActiveSession();
      const id=S().editDocId;
      const response=id?await sb.from('institution_documents').update(payload).eq('id',id).eq('workspace_id',WS):await sb.from('institution_documents').insert({...payload,created_by:state.user.id});
      if(response.error)throw response.error;
      S().docForm=false;S().editDocId=null;
      await load();render();toast(id?'Evrak güncellendi.':'Drive bağlantısı kaydedildi.');
    }catch(e){error(e);}finally{S().busy=false;}
  }
  function downloadCSV() {
    const session=current();if(!session)return;
    const rows=[['Kurum','Dönem','Alan','Kontrol maddesi','Kritik','Sonuç','Açıklama','Drive bağlantısı']];
    for(const item of checklist(S().unit)){const a=answerFor(item.key),doc=S().docs.find(d=>d.id===a?.document_id); rows.push([label(schoolOptions,S().unit),session.academic_year,item.category,item.title,item.critical?'Evet':'Hayır',label(statuses,a?.status||'incelenmedi'),a?.note||'',doc?.drive_url||'']);}
    const csv='\uFEFF'+rows.map(row=>row.map(cell=>'"'+tr(cell).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ortak-takip-teftis-'+S().unit+'-'+session.academic_year+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function bind() {
    if(state.view==='inspection') {
      document.getElementById('inspectionSchool')?.addEventListener('change',e=>{void setSchool(e.target.value);});
      document.getElementById('inspectionSession')?.addEventListener('change',e=>{void selectSession(e.target.value);});
      document.getElementById('inspectionNew')?.addEventListener('click',()=>void newSession());
      document.querySelectorAll('[data-check-save]').forEach(btn=>btn.addEventListener('click',()=>void saveCheck(btn.dataset.checkSave,btn.closest('[data-criterion]'))));
      document.querySelectorAll('[data-inspection-task]').forEach(btn=>btn.addEventListener('click',()=>{
        const criterion=checklist(S().unit).find(item=>item.key===btn.dataset.inspectionTask);
        if(criterion&&typeof openFindingTask==='function')openFindingTask({title:criterion.title,critical:criterion.critical,school_unit:S().unit,note:answerFor(criterion.key)?.note||''});
      }));
      document.getElementById('inspectionComplete')?.addEventListener('click',()=>void complete());
      document.getElementById('inspectionPrint')?.addEventListener('click',()=>window.print());
      document.getElementById('inspectionCsv')?.addEventListener('click',downloadCSV);
    }
    if(state.view==='documents') {
      document.getElementById('docSchoolFilter')?.addEventListener('change',e=>{S().docUnit=e.target.value;render()});
      document.getElementById('docSearch')?.addEventListener('input',e=>{S().docSearch=e.target.value;const pos=e.target.selectionStart;render();const search=document.getElementById('docSearch');search?.focus();search?.setSelectionRange(pos,pos);});
      document.getElementById('docNew')?.addEventListener('click',()=>{S().docForm=true;S().editDocId=null;render()});
      document.getElementById('docCancel')?.addEventListener('click',()=>{S().docForm=false;S().editDocId=null;render()});
      document.getElementById('inspectionDocForm')?.addEventListener('submit',e=>{e.preventDefault();void saveDocument(e.currentTarget)});
      document.querySelectorAll('[data-doc-edit]').forEach(btn=>btn.addEventListener('click',()=>{S().editDocId=btn.dataset.docEdit;S().docForm=true;render();document.getElementById('inspectionDocForm')?.scrollIntoView({block:'start',behavior:'smooth'});}));
    }
  }
  function reset() {state.inspection={unit:'ilkokul',sessionId:null,docs:[],sessions:[],answers:[],docUnit:'all',docSearch:'',docForm:false,editDocId:null,busy:false};}
  return {load,view,docsView,bind,reset};
}
