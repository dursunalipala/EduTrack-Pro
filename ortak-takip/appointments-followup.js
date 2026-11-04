/* Ortak Takip | Randevu iletişim merkezi
   WhatsApp bağlantısı kullanıcı onayıyla açılır. Sistem kendiliğinden veliye mesaj göndermez.
 */
export function createAppointmentFollowup({sb,WS,state,esc,toast,error,requireActiveSession,render,getRow,getPhone,reload}) {
 const stages=[
  ['hatirlatma','Randevu hatırlatması'],['yeniden','Yeni randevu planlama'],
  ['takip','Görüşme sonrası takip'],['kayit','Kayıt teşekkür mesajı'],
  ['on_kayit','Ön kayıt tamamlanması'],['belge','Belge bilgilendirmesi'],
  ['ulasma','Ulaşma girişimi'],['tesekkur','Teşekkür / İletişimde kalalım']
 ];
 const S={id:null,template:'takip',message:'',rows:[],loading:false,busy:false};
 const find=()=>S.id?getRow(S.id):null;
 const clean=s=>String(s??'').trim();
 const dateTR=v=>v?String(v).slice(0,10).split('-').reverse().join('.'):'belirlenecek';
 const greeting=r=>'Sayın '+clean(r.full_name||'Velimiz')+',';
 function selectTemplate(r){
  if(r.outcome==='kayit')return 'kayit';
  if(r.outcome==='on_kayit')return 'on_kayit';
  if(r.outcome==='ilk_randevu')return 'hatirlatma';
  if(r.outcome==='erteleme')return 'yeniden';
  if(r.outcome==='cevap_yok')return 'ulasma';
  if(['olumsuz','baska_okula_kayit','orgun','yas_hatasi'].includes(r.outcome))return 'tesekkur';
  return 'takip';
 }
 function compose(r,key){
  const name=r.school_unit==='anasinifi'?'Elit Anaokulu':r.school_unit==='ilkokul'?'Elit İlkokulu':'Elit Eğitim Kurumları';
  const when=r.appointment_date?' '+dateTR(r.appointment_date)+(r.appointment_time?' saat '+String(r.appointment_time).slice(0,5):''):'';
  const suffix='\n\n'+name+'\nİletişim: Okul kayıt birimi';
  const intro=greeting(r)+'\n\n';
  const bodies={
   hatirlatma:'Okulumuzdaki görüşme randevunuzu hatırlatmak isteriz.'+(when?' Randevu: '+when.trim()+'.':'')+' Sizi ağırlamaktan memnuniyet duyarız.',
   yeniden:'Önceki görüşmemiz kapsamında size uygun yeni bir randevu oluşturmak istiyoruz. Uygun olduğunuz gün ve saati bizimle paylaşabilir misiniz?',
   takip:'Okulumuzla yaptığınız görüşmenin ardından kayıt sürecinizle ilgili sorularınız olup olmadığını öğrenmek isteriz. İhtiyaç duyduğunuz konularda yardımcı olabiliriz.',
   kayit:'Okulumuza göstermiş olduğunuz güven için teşekkür ederiz. Kayıt sürecinizle ilgili bilgi veya desteğe ihtiyaç duyarsanız bizimle iletişime geçebilirsiniz.',
   on_kayit:'Ön kayıt sürecinizi tamamlamak ve gerekli bilgileri paylaşmak üzere sizinle iletişime geçiyoruz. Uygun olduğunuzda bize dönüş yapabilir misiniz?',
   belge:'Kayıt işlemlerinizle ilgili belgeler hakkında bilgi paylaşmak üzere iletişime geçiyoruz. Evrak durumunu netleştirmek için bizimle görüşebilirsiniz.',
   ulasma:'Sizinle görüşmek için iletişime geçtik ancak ulaşamadık. Uygun olduğunuzda bize geri dönüş yapabilir misiniz?',
   tesekkur:'Okulumuzla iletişime geçtiğiniz için teşekkür ederiz. İleride bir sorunuz olursa size yardımcı olmaktan memnuniyet duyarız.'
  };
  return intro+(bodies[key]||bodies.takip)+suffix;
 }
 const phone=()=>getPhone(find()?.phone);
 const waIcon='<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 3.3C9.1 3.3 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.7 6.3L3.5 28.5l6.7-1.7c1.8 1 3.8 1.5 5.8 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.3 16 3.3zm0 22.6c-1.9 0-3.7-.5-5.3-1.5l-.4-.3-3.9 1.1 1.1-3.8-.3-.4a10 10 0 0 1-1.6-5.3c0-5.7 4.7-10.3 10.4-10.3s10.3 4.6 10.3 10.3S21.7 25.9 16 25.9zm5.7-7.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7 0-1.9-.9-3.1-2.3-4-3.9-.2-.3 0-.5.2-.7l.6-.7c.2-.2.3-.5.4-.7.1-.2 0-.5-.1-.7s-.7-1.7-.9-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.3 0-.7.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.3 3.2 1.5 3.4c.2.2 2.4 3.7 5.9 5.2.8.3 1.4.5 1.9.6.8.2 1.5.2 2.1.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/></svg>';
 function quickActions(r){
  const digits=getPhone(r.phone);if(!digits)return '<span class="appt-no-phone" title="Geçerli telefon bulunamadı">Telefon yok</span>';
  return '<div class="appt-quick">'+
    '<a class="appt-call-btn" href="tel:+'+esc(digits)+'" title="Veliyi ara" aria-label="Veliyi telefonla ara">☎</a>'+
    '<button type="button" class="appt-wa-btn" data-appt-wa="'+esc(r.id)+'" title="Duruma göre WhatsApp mesajı hazırla" aria-label="WhatsApp mesajı hazırla">'+waIcon+'</button></div>';
 }
 async function loadEvents(id){
  S.loading=true;
  try{
   const {data,error:err}=await sb.from('appointment_contacts').select('id,actor_id,channel,note,created_at')
     .eq('workspace_id',WS).eq('appointment_id',id).order('created_at',{ascending:false}).limit(25);
   if(err)throw err;
   if(S.id===id)S.rows=data||[];
  }catch(e){error(e)}
  finally{if(S.id===id){S.loading=false;render()}}
 }
 function open(id){
  const r=getRow(id);if(!r)return;
  S.id=id;S.template=selectTemplate(r);S.message=compose(r,S.template);S.rows=[];S.loading=false;
  render();void loadEvents(id);
 }
 function close(){S.id=null;S.message='';S.rows=[];render()}
 function link(){
  const digits=phone();
  return digits?'https://wa.me/'+digits+'?text='+encodeURIComponent(S.message.trim()):'#';
 }
 const types={call_attempted:'Arama yapıldı',call_completed:'Telefon görüşmesi yapıldı',unreachable:'Ulaşılamadı',whatsapp_confirmed:'WhatsApp ile bilgilendirildi',note:'Görüşme notu'};
 function historyHtml(){
  if(S.loading)return '<p class="muted small">İletişim geçmişi yükleniyor…</p>';
  if(!S.rows.length)return '<p class="muted small">Henüz iletişim kaydı bulunmuyor.</p>';
  return S.rows.map(h=>'<div class="appt-contact-event"><strong>'+esc(types[h.channel]||h.channel)+'</strong><span>'+
    esc(new Date(h.created_at).toLocaleString('tr-TR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}))+
    '</span>'+(h.note?'<small>'+esc(h.note)+'</small>':'')+'</div>').join('');
 }
 function view(){
  const r=find();if(!r)return '';
  const digits=phone();
  return '<div class="appt-wa-backdrop" id="apptWaBackdrop"><section class="appt-wa-modal" role="dialog" aria-modal="true" aria-label="Veli iletişim merkezi">'+
   '<div class="appt-wa-head"><div><h2>Veli İletişim Merkezi</h2><p><b>#'+esc(r.source_record_id||'—')+'</b> · '+esc(r.full_name)+'</p></div><button type="button" class="btn" id="apptWaClose">✕</button></div>'+
   '<div class="appt-wa-details"><span>Randevu: <b>'+esc(dateTR(r.appointment_date))+'</b></span><span>Durum: <b>'+esc(r.outcome)+'</b></span>'+
   '<span>Takip: <b>'+esc(dateTR(r.followup_date))+'</b></span></div>'+
   '<label class="appt-wa-label">Mesaj türü<select id="apptWaTemplate">'+stages.map(([k,label])=>'<option value="'+k+'"'+(k===S.template?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
   '<label class="appt-wa-label">Göndermeden önce metni kontrol edin<textarea id="apptWaMessage" rows="7">'+esc(S.message)+'</textarea></label>'+
   '<div class="appt-wa-actions">'+(digits?'<a id="apptWaGo" class="appt-wa-send" target="_blank" rel="noopener noreferrer" href="'+esc(link())+'">'+waIcon+' WhatsApp’ta Aç</a>'+
   '<a class="btn" href="tel:+'+esc(digits)+'">☎ Veliyi Ara</a>':'<p class="muted">Telefon numarası geçersiz; önce randevu kaydını düzeltin.</p>')+'</div>'+
   '<p class="appt-wa-tip">Mesaj yalnızca WhatsApp’ta açılır. Gönderim otomatik değildir. Gönderdiyseniz aşağıdan manuel olarak kaydedebilirsiniz.</p>'+
   '<div class="appt-contact-buttons"><button class="btn" type="button" data-appt-log="call_attempted">☎ Arandı</button><button class="btn" type="button" data-appt-log="call_completed">✓ Görüşüldü</button>'+
   '<button class="btn" type="button" data-appt-log="unreachable">◷ Ulaşılamadı</button><button class="btn" type="button" data-appt-log="whatsapp_confirmed">✓ WhatsApp Gönderildi</button></div>'+
   '<div class="appt-contact-timeline"><h3>İletişim geçmişi</h3>'+historyHtml()+'</div></section></div>';
 }
 async function record(channel){
  if(S.busy||!find())return;
  if(channel==='whatsapp_confirmed'&&!confirm('WhatsApp mesajını gerçekten gönderdiğinizi onaylıyor musunuz?'))return;
  try{
   S.busy=true;await requireActiveSession();
   const {error:err}=await sb.from('appointment_contacts').insert({
    workspace_id:WS,appointment_id:S.id,actor_id:state.user.id,channel,
    note:channel==='whatsapp_confirmed'?'WhatsApp gönderimi personel tarafından onaylandı.':''
   });
   if(err)throw err;toast('İletişim kaydedildi. Takip görevi oluşturuldu veya güncellendi.');await loadEvents(S.id);if(reload)await reload();
  }catch(e){error(e)}finally{S.busy=false}
 }
 function bindModal(){
  document.getElementById('apptWaClose')?.addEventListener('click',close);
  document.getElementById('apptWaBackdrop')?.addEventListener('click',e=>{if(e.target.id==='apptWaBackdrop')close()});
  document.getElementById('apptWaTemplate')?.addEventListener('change',e=>{S.template=e.target.value;S.message=compose(find(),S.template);render()});
  document.getElementById('apptWaMessage')?.addEventListener('input',e=>{
   S.message=e.target.value;const el=document.getElementById('apptWaGo');if(el)el.href=link();
  });
  document.querySelectorAll('[data-appt-log]').forEach(b=>b.addEventListener('click',()=>void record(b.dataset.apptLog)));
 }
 function bindLaunch(){
  document.querySelectorAll('[data-appt-wa]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.apptWa)));
 }
 return {quickActions,open,close,view,bindLaunch,bindModal,isOpen:()=>!!S.id,reset:()=>{S.id=null;S.rows=[];}};
}
