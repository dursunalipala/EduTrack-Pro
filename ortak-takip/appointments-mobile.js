/* Mobile-first Randevu İcmali cards.
 * Pure presentation: all actions reuse the established appointment module handlers.
 */
export function renderAppointmentCards(rows,{esc,statuses,statusBadge,phoneButtons,dateLabel,money,taskButton,mayArchive,mayEdit}){
 const schoolMap={aksam:'Akşam Lisesi',ilkokul:'İlkokul',anasinifi:'Anaokulu',ortak:'Ortak'};
 const asText=(x)=>esc(x??'—');
 return rows.length?rows.map(r=>{
  const name=asText(r.full_name),id=asText(r.id);
  const result=mayEdit(r)?'<label class="appt-card-result-label">Randevu sonucu<select class="appt-quick-result" data-appt-quick="'+id+'" aria-label="Randevu sonucunu güncelle">'+
   statuses.map(v=>'<option value="'+v[0]+'"'+(v[0]===r.outcome?' selected':'')+'>'+esc(v[1])+'</option>').join('')+'</select></label>':'';
  const appointment=r.appointment_date?dateLabel(r.appointment_date)+(r.appointment_time?' · '+esc(String(r.appointment_time).slice(0,5)):''):'Belirlenmedi';
  const details=[
   ['Eğitim',r.education_status],['Yaş / Sınıf',String(r.age??'—')+' / '+String(r.grade??'—')],
   ['Görüşme',dateLabel(r.contact_date)],['Takip tarihi',dateLabel(r.followup_date)],
   ['Şube',r.branch],['Görüşülen tutar',money(r.quoted_amount)]
  ];
  const extra=details.map(([key,value])=>'<span><small>'+esc(key)+'</small><strong>'+asText(value)+'</strong></span>').join('');
  return '<article class="appt-mobile-card">'+
   '<div class="appt-card-top"><span class="appt-card-id">#'+asText(r.source_record_id)+'</span><span class="appt-card-school">'+esc(schoolMap[r.school_unit]||'Kurum belirtilmedi')+'</span></div>'+
   '<button type="button" class="appt-card-name" data-appt-edit="'+id+'">'+name+'</button>'+
   '<div class="appt-card-badges">'+statusBadge(r.outcome)+'</div>'+
   '<div class="appt-card-brief"><span><small>Randevu</small><strong>'+appointment+'</strong></span>'+
   '<span><small>Görüşen kişi</small><strong>'+asText(r.staff_name||'Belirtilmedi')+'</strong></span></div>'+
   '<div class="appt-card-actionbar">'+
    '<div class="appt-card-phone">'+(r.phone?'<small>Telefon</small><strong>'+esc(r.phone)+'</strong>':'<small>Telefon kaydı yok</small>')+'</div>'+
    '<div class="appt-card-quick">'+phoneButtons(r)+'</div>'+
    '<button type="button" class="appt-card-open" data-appt-edit="'+id+'" aria-label="'+name+' kaydını aç">Aç <span aria-hidden="true">›</span></button>'+
   '</div>'+
   '<details class="appt-card-details"><summary>Diğer bilgiler ve işlemler</summary><div class="appt-card-detailbody">'+
    '<div class="appt-card-detailgrid">'+extra+'</div>'+
    (r.notes?'<p class="appt-card-notes"><b>Not:</b> '+esc(String(r.notes).slice(0,260))+(r.notes.length>260?'…':'')+'</p>':'')+
    result+
    '<div class="appt-card-moreactions">'+taskButton(r.id)+(mayArchive()?(r.deleted_at?'<button type="button" class="btn sm" data-appt-restore="'+id+'">Arşivden çıkar</button>':'<button type="button" class="btn sm" data-appt-archive="'+id+'">Arşivle</button>'):'')+'</div>'+
   '</div></details></article>';
 }).join(''):'<p class="appt-card-empty">Bu filtrelerle eşleşen randevu bulunamadı.</p>';
}
