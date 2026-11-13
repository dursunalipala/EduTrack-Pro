/**
 * Elit Randevu AppSheet/Google Sheets -> Ortak Takip (Supabase)
 * Cift yonlu: Google Sheets <-> Ortak Takip. Kayitlar ID ile eslestirilir.
 * Yalnizca yeni/degisen randevular yazilir; iki taraf ayni kaydi degistirirse durdurulur.
 * Kurulum: https://script.google.com/home/projects/create
 * Script Property: ORTAK_TAKIP_SYNC_KEY = daha once olusturulan 64 karakterlik ozel anahtar
 * Once kurulumKontrol(), sonra zamanlayiciyiKur() calistirin.
 */
var ORTAK_CONFIG = {
  spreadsheetId: '12szwnUoY-5V7NgrOwDeGi3SsyA1QaHUR',
  sheetName: '', // Bos: basliginda ID, ad-soyad ve gorusme tarihi olan sayfayi otomatik bul
  endpoint: 'https://gnwliizxuryfnpqrynym.supabase.co/functions/v1/ortak-takip-appsheet-sync',
  outboxEndpoint: 'https://gnwliizxuryfnpqrynym.supabase.co/functions/v1/ortak-takip-sheet-outbox',
  secretProperty: 'ORTAK_TAKIP_SYNC_KEY',
  intervalMinutes: 5,
  batchSize: 20,
  maxRecordsPerRun: 120,
  syncFunction: 'ortakTakipSenkronizeEt'
};
var ORTAK_HEADERS = [
  'id','sourcerecordid','kayitid','recordid','rowid',
  'veliogrenciadisoyadi','adsoyad','ogrenciadisoyadi',
  'egitimdurumu','yas','sinif','aolkredi','kredi','rakam','tutar','ucret','fiyat',
  'il','ilce','gorusenkisi','personel','telefon','tel','ceptelefonu',
  'gorusmetarihi','ilkgorusmetarihi','ilkgorusme','gorusmenotu',
  'randevutarihi','randevusaat','randevusaati','saat','randevusubesi','sube',
  'randevusonucu','sonuc','durum','notlar','not','aciklama',
  'tekrararamatarihi','takiptarihi','sonrakigorusme'
];
var ORTAK_ID_ALIASES = ['id','sourcerecordid','kayitid','recordid','rowid'];
var ORTAK_NAME_ALIASES = ['veliogrenciadisoyadi','adsoyad','ogrenciadisoyadi'];
var ORTAK_DATE_ALIASES = ['gorusmetarihi','ilkgorusmetarihi'];

function normalizeOrtak_(value) {
  return String(value == null ? '' : value)
    .trim().toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
function ilkEslesen_(norms, aliases) {
  for (var i=0;i<aliases.length;i++) {
    var index=norms.indexOf(aliases[i]);
    if (index>=0) return index;
  }
  return -1;
}
function kaynakTablo_() {
  var spreadsheet;
  try {
    spreadsheet=SpreadsheetApp.openById(ORTAK_CONFIG.spreadsheetId);
  } catch (e) {
    throw new Error('Dosya Google Sheets olarak acilamadi. Drive uzerindeki dosya .xlsx ise bu senaryoda kaynak dosya turu yeniden degerlendirilmelidir. AppSheet kaynagini degistirmeden dosyayi donusturup yeni kopyayi okumayin.');
  }
  var all=ORTAK_CONFIG.sheetName
    ? [spreadsheet.getSheetByName(ORTAK_CONFIG.sheetName)].filter(Boolean)
    : spreadsheet.getSheets();
  for (var i=0;i<all.length;i++) {
    var sheet=all[i];
    if (!sheet || sheet.getLastRow()<1) continue;
    var header=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    var norms=header.map(normalizeOrtak_);
    var id=ilkEslesen_(norms,ORTAK_ID_ALIASES);
    var name=ilkEslesen_(norms,ORTAK_NAME_ALIASES);
    var date=ilkEslesen_(norms,ORTAK_DATE_ALIASES);
    if (id<0||name<0||date<0) continue;
    return {sheet:sheet,header:header,norms:norms,idIndex:id,nameIndex:name,dateIndex:date};
  }
  throw new Error('ID, VELI/OGRENCI ADI SOYADI ve GORUSME TARIHI basliklarini iceren randevu sekmesi bulunamadi. Yanlis dosya veya basliklar olabilir.');
}
function ozetKontrol_() {
  var table=kaynakTablo_();
  var allowed=ORTAK_HEADERS.filter(function(k){return table.norms.indexOf(k)>=0;}).length;
  return {sheet:table.sheet.getName(),dataRows:Math.max(0,table.sheet.getLastRow()-1),recognizedColumns:allowed};
}
function kurulumKontrol() {
  var o=ozetKontrol_();
  Logger.log('Tablo uygun. Sekme: %s | Satir: %s | Eslesen sutun: %s',o.sheet,o.dataRows,o.recognizedColumns);
  return o;
}
function zamanlayiciyiKur() {
  var secret=PropertiesService.getScriptProperties().getProperty(ORTAK_CONFIG.secretProperty)||'';
  if(!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('Once Project Settings > Script Properties alanina ORTAK_TAKIP_SYNC_KEY ekleyin. 64 karakterlik ozel anahtar yazilmali.');
  }
  kurulumKontrol();
  // Tek bir 5 dakikalik zamanlayici; tekrar kurulumda cift otomasyon olmaz.
  var old=ScriptApp.getProjectTriggers();
  old.forEach(function(t){
    if(t.getHandlerFunction()===ORTAK_CONFIG.syncFunction)ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(ORTAK_CONFIG.syncFunction)
    .timeBased().everyMinutes(ORTAK_CONFIG.intervalMinutes).create();
  Logger.log('5 dakikalik AppSheet/Google Sheets -> Ortak Takip zamanlayicisi kuruldu.');
  return ortakTakipSenkronizeEt();
}
function otHash_(text) {
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8);
  return bytes.map(function(n){return ('0'+(n&255).toString(16)).slice(-2);}).join('');
}
function otPayload_(raw,meta) {
  var obj={};
  for(var i=0;i<meta.header.length;i++){
    if(ORTAK_HEADERS.indexOf(meta.norms[i])>=0 && meta.header[i]){
      obj[String(meta.header[i]).trim()]=String(raw[i]==null?'':raw[i]).trim();
    }
  }
  return obj;
}
function otSendBatch_(batch,secret) {
  var response=UrlFetchApp.fetch(ORTAK_CONFIG.endpoint,{
    method:'post',
    contentType:'application/json; charset=utf-8',
    headers:{'x-ortak-sync-key':secret},
    payload:JSON.stringify({action:'upsert',records:batch.map(function(x){return x.row;})}),
    muteHttpExceptions:true,
    followRedirects:false
  });
  var code=response.getResponseCode();
  var body;
  try{body=JSON.parse(response.getContentText());}catch(e){body=null;}
  // 207: kimi satirlar kabul edildi, kimileri hatali. Tekli tekrar ile ayrisir.
  if(code===207&&body&&body.summary&&body.summary.errors>0) return {partial:true};
  if(code!==200||!body||body.ok!==true||body.summary && body.summary.errors>0){
    // Kisisel veriler ve anahtar hata loguna yazilmaz.
    throw new Error('Senkronizasyon servisi hatasi HTTP '+code+'; basarisiz kayit sayisi '+(body&&body.summary?body.summary.errors:'bilinmiyor'));
  }
  return body.summary;
}
function otSheetsToOrtak_(blockedSourceIds) {
  try{
    var secret=PropertiesService.getScriptProperties().getProperty(ORTAK_CONFIG.secretProperty)||'';
    if(!/^[0-9a-f]{64}$/i.test(secret))throw new Error('Senkronizasyon guvenlik anahtari tanimli degil');
    var meta=kaynakTablo_();
    var rowCount=meta.sheet.getLastRow();
    if(rowCount<=1){Logger.log('Randevu satiri bulunamadi; mevcut kayitlara dokunulmaz.');return;}
    var rows=meta.sheet.getRange(2,1,rowCount-1,meta.header.length).getDisplayValues();
    var props=PropertiesService.getScriptProperties();
    var prev=props.getProperties();
    var changed=[],ignored=0,empty=0;
    for(var j=0;j<rows.length;j++){
      var cells=rows[j];
      var originalId=String(cells[meta.idIndex]||'').trim().replace(/\.0$/,'');
      if(!originalId){empty++;continue;}
      if(blockedSourceIds && blockedSourceIds.has(originalId)){ignored++;continue;}
      var row=otPayload_(cells,meta);
      var key='ORTAK_ROW_'+otHash_(originalId).slice(0,32);
      var signature=otHash_(JSON.stringify(row)).slice(0,32);
      if(prev[key]===signature){ignored++;continue;}
      changed.push({row:row,key:key,signature:signature,sheetRow:j+2});
    }
    // En son eklenenler once islenir. Ilk aktarimda 639 kayit birden degil,
    // zamanlayici turlarina bolunur.
    changed.reverse();
    var done=0,failedBatches=0,created=0,updated=0,unchanged=0;
    var max=Math.min(changed.length,ORTAK_CONFIG.maxRecordsPerRun);
    for(var k=0;k<max;k+=ORTAK_CONFIG.batchSize){
      var batch=changed.slice(k,Math.min(k+ORTAK_CONFIG.batchSize,max));
      try{
        var result=otSendBatch_(batch,secret);
        var patch={};
        if(result.partial){
          // Hatali tek satir, diger 19 randevunun senkronizasyonunu durdurmasin.
          batch.forEach(function(item){
            try{
              var one=otSendBatch_([item],secret);
              if(one.partial)throw new Error('Gecersiz satir');
              patch[item.key]=item.signature;done++;
              created+=(one.created||0);updated+=(one.updated||0);
              unchanged+=(one.unchanged||0);
            }catch(singleError){
              failedBatches++;
              Logger.log('Bir satir aktarılamadi, tablo satir no %s (kisisel veri yazilmadi).',item.sheetRow);
            }
          });
        }else{
          batch.forEach(function(item){patch[item.key]=item.signature;});
          done+=batch.length;
          created+=(result.created||0);updated+=(result.updated||0);
          unchanged+=(result.unchanged||0);
        }
        if(Object.keys(patch).length)props.setProperties(patch,false);
      }catch(e){
        failedBatches++;
        Logger.log('Grup %s aktarilamadi: %s',Math.floor(k/ORTAK_CONFIG.batchSize)+1,String(e.message).slice(0,160));
      }
    }
    var summary='Sheet: '+meta.sheet.getName()+' | satir: '+rows.length+
      ' | aktarim denenen: '+max+' | basarili: '+done+
      ' | yeni: '+created+' | guncellenen: '+updated+
      ' | degismeyen: '+unchanged+' | sorunlu grup: '+failedBatches+
      ' | kalan/yeniden denenecek: '+Math.max(0,changed.length-done);
    props.setProperty('ORTAK_LAST_SUMMARY',summary);
    props.setProperty('ORTAK_LAST_RUN',new Date().toISOString());
    Logger.log(summary);
    if(failedBatches)throw new Error(failedBatches+' aktarim grubu hata verdi. Execution log ve Supabase servis loglarini kontrol edin.');
    return summary;
  }finally{/* Dis kilit ortakTakipSenkronizeEt tarafindan yonetilir. */}
}
function sonSenkronizasyonDurumu(){
  var p=PropertiesService.getScriptProperties();
  var result={
    lastRun:p.getProperty('ORTAK_LAST_RUN')||'Henuz calismadi',
    summary:p.getProperty('ORTAK_LAST_SUMMARY')||'Henuz ozet yok',
    triggerCount:ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()===ORTAK_CONFIG.syncFunction;}).length
  };
  Logger.log(JSON.stringify(result));return result;
}


/**
 * V2: Google Sheets'e yalnizca Ortak Takip'te degisen alanlar yazilir.
 * Google dosyasindaki taninmayan sutunlara ve formul hucrelerine dokunulmaz.
 * Iki tarafta farkli degisiklik saptanirsa randevu karantinaya alinir.
 */
var ORTAK_FIELD_HEADERS={
  full_name:['veliogrenciadisoyadi','adsoyad','ogrenciadisoyadi'],
  education_status:['egitimdurumu'],age:['yas'],grade:['sinif'],
  aol_credit:['aolkredi','kredi'],quoted_amount:['rakam','tutar','ucret','fiyat'],
  province:['il'],district:['ilce'],phone:['telefon','tel','ceptelefonu'],
  staff_name:['gorusenkisi','personel'],contact_date:['gorusmetarihi','ilkgorusmetarihi'],
  first_contact:['ilkgorusme','gorusmenotu'],appointment_date:['randevutarihi'],
  appointment_time:['randevusaat','randevusaati','saat'],branch:['randevusubesi','sube'],
  outcome:['randevusonucu','sonuc','durum'],notes:['notlar','not','aciklama'],
  followup_date:['tekrararamatarihi','takiptarihi','sonrakigorusme']
};
var ORTAK_OUTCOME_LABELS={
  kayit:'KAYIT',on_kayit:'ÖN KAYIT',baska_okula_kayit:'BAŞKA OKULA KAYIT',
  ilk_randevu:'İLK RANDEVU',olumsuz:'OLUMSUZ',cevap_yok:'CEVAP YOK',
  dusunecek:'DÜŞÜNECEK',erteleme:'ERTELEME',orgun:'ÖRGÜN',
  yas_hatasi:'YAŞ HATASI',beklemede:'BEKLEMEDE'
};

function otSignatureKey_(id){
  return 'ORTAK_ROW_'+otHash_(String(id)).slice(0,32);
}
function otSignature_(cells,meta){
  return otHash_(JSON.stringify(otPayload_(cells,meta))).slice(0,32);
}
function otNormalizedValue_(field,v){
  var s=String(v==null?'':v).trim();
  if(field==='outcome')return normalizeOrtak_(s);
  if(field==='phone'){
    var digits=s.replace(/\D/g,'');
    if(/^5\d{9}$/.test(digits))digits='0'+digits;
    return digits;
  }
  if(['age','grade','aol_credit','quoted_amount'].indexOf(field)>=0){
    if(!s)return '';
    var t=s.replace(/[₺\s]/g,'');
    if(t.indexOf(',')>=0&&t.indexOf('.')>=0)
      t=t.lastIndexOf(',')>t.lastIndexOf('.')?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
    else if(t.indexOf(',')>=0)t=t.replace(',','.');
    else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
    var num=Number(t);return Number.isFinite(num)?String(num):s;
  }
  if(field==='contact_date'||field==='appointment_date'||field==='followup_date'){
    if(!s)return '';
    var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m)return [m[1],String(+m[2]).padStart(2,'0'),String(+m[3]).padStart(2,'0')].join('-');
    m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if(m)return [m[3],String(+m[2]).padStart(2,'0'),String(+m[1]).padStart(2,'0')].join('-');
    return s;
  }
  if(field==='appointment_time'){
    if(!s)return '';
    var m=s.match(/(\d{1,2}):(\d{2})/);
    return m?String(+m[1]).padStart(2,'0')+':'+m[2]:s;
  }
  return s;
}
function otToSheetValue_(field,v){
  if(v==null||v==='')return '';
  if(field==='outcome')return ORTAK_OUTCOME_LABELS[String(v)]||String(v);
  if(['age','grade','aol_credit','quoted_amount'].indexOf(field)>=0)
    return Number(v);
  if(field==='contact_date'||field==='appointment_date'||field==='followup_date'){
    var m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)throw new Error('Tarih degeri gecersiz');
    return new Date(+m[1],+m[2]-1,+m[3]);
  }
  if(field==='appointment_time'){
    var t=String(v).match(/^(\d{1,2}):(\d{2})/);
    if(!t)throw new Error('Saat degeri gecersiz');
    return new Date(1899,11,30,+t[1],+t[2]);
  }
  return String(v);
}
function otOutboxCall_(method,body){
  var secret=PropertiesService.getScriptProperties()
    .getProperty(ORTAK_CONFIG.secretProperty)||'';
  if(!/^[0-9a-f]{64}$/i.test(secret))throw new Error('Senkronizasyon anahtari gecersiz');
  var opts={
    method:method,
    headers:{'x-ortak-sync-key':secret},
    muteHttpExceptions:true,followRedirects:false
  };
  if(body){opts.contentType='application/json';opts.payload=JSON.stringify(body);}
  var resp=UrlFetchApp.fetch(ORTAK_CONFIG.outboxEndpoint,opts);
  var obj;
  try{obj=JSON.parse(resp.getContentText());}catch(e){obj=null;}
  if(resp.getResponseCode()!==200||!obj||obj.ok!==true)
    throw new Error('Ortak Takip cift yonlu servis hatasi. HTTP '+resp.getResponseCode());
  return obj;
}
function otIndices_(meta){
  var positions={};
  Object.keys(ORTAK_FIELD_HEADERS).forEach(function(field){
    var index=ilkEslesen_(meta.norms,ORTAK_FIELD_HEADERS[field]);
    if(index>=0)positions[field]=index;
  });
  return positions;
}
function otOutboxSync_(){
  var result=otOutboxCall_('get');
  var queue=result.pending||[];
  var blocked=new Set((result.conflict_source_ids||[]).map(String));
  queue.forEach(function(x){if(x.source_record_id!=null)blocked.add(String(x.source_record_id));});
  if(!queue.length){
    if(result.conflicts)Logger.log('%s randevuda cift yonlu veri cakismasi var.',result.conflicts);
    return blocked;
  }

  var meta=kaynakTablo_(),sheet=meta.sheet;
  var rowCount=sheet.getLastRow(),columnCount=meta.header.length;
  var display=rowCount>1?sheet.getRange(2,1,rowCount-1,columnCount).getDisplayValues():[];
  var rowMap=new Map(),duplicates=new Set();
  display.forEach(function(cells,i){
    var id=String(cells[meta.idIndex]||'').trim().replace(/\.0$/,'');
    if(!id)return;
    if(rowMap.has(id))duplicates.add(id);
    else rowMap.set(id,i+2);
  });
  var positions=otIndices_(meta),props=PropertiesService.getScriptProperties();
  var cached=props.getProperties(),acked=[],conflicted=[],written=0;

  queue.forEach(function(item){
    if(!item||!item.id||!item.version)return;
    if(item.skip){acked.push({id:item.id,version:item.version});return;}
    var id=String(item.source_record_id||'').trim();
    if(!id){conflicted.push({id:item.id,version:item.version});return;}
    if(duplicates.has(id)){conflicted.push({id:item.id,version:item.version});return;}

    var fields=item.fields||{};
    // AppSheet'in gercek tablosunda bulunmayan istege bagli alanlar
    // (or. Sonraki Arama Tarihi) kaynaga yeni sutun eklemeden Ortak Takip'te kalir.
    var allNames=Object.keys(fields);
    var names=allNames.filter(function(field){return positions[field]!==undefined;});
    var excluded=allNames.filter(function(field){return positions[field]===undefined;});
    if(excluded.length)Logger.log('Sheets tablosunda bulunmayan %s alan Ortak Takip tarafinda kaldi.',excluded.length);
    if(!names.length){acked.push({id:item.id,version:item.version});return;}

    var sheetRow=rowMap.get(id)||null;
    var key=otSignatureKey_(id);
    try{
      if(!sheetRow){
        // Ortak Takip ID'leri negatif; AppSheet tarafindaki pozitif ID dizisi bozulmaz.
        // Pozitif ve tablodaki baska bir kayda ait kimlik otomatik uretilmez.
        if(!/^-\d+$/.test(id)||item.record_origin!=='ortak'){
          conflicted.push({id:item.id,version:item.version});return;
        }
        if(!('full_name' in fields)||!('contact_date' in fields)){
          conflicted.push({id:item.id,version:item.version});return;
        }
        var newCells=new Array(columnCount).fill('');
        newCells[meta.idIndex]=Number(id);
        names.forEach(function(field){newCells[positions[field]]=otToSheetValue_(field,fields[field]);});
        sheet.appendRow(newCells);
        sheetRow=sheet.getLastRow();rowMap.set(id,sheetRow);
        var wrote=sheet.getRange(sheetRow,1,1,columnCount).getDisplayValues()[0];
        props.setProperty(key,otSignature_(wrote,meta));
        acked.push({id:item.id,version:item.version});written++;
        return;
      }
      var current=sheet.getRange(sheetRow,1,1,columnCount).getDisplayValues()[0];
      var currentHash=otSignature_(current,meta),baseline=cached[key]||'';
      var alreadyDone=names.every(function(field){
        var desired=(field==='outcome')
          ?otToSheetValue_(field,fields[field]):fields[field];
        return otNormalizedValue_(field,current[positions[field]])===
               otNormalizedValue_(field,desired);
      });
      // Eger kullanici ayni degisikligi Sheet'te de yaptiysa yeniden yazma.
      // Diger Sheet alanlari degismis olabilir: eski hash'i sakla ki iceri alinsin.
      if(alreadyDone){
        acked.push({id:item.id,version:item.version});return;
      }
      // Kaynak verisi ilk kez goruluyorsa ve iki tarafta oynandiysa yazma yapma.
      if(!baseline||currentHash!==baseline){
        conflicted.push({id:item.id,version:item.version});return;
      }
      // Tum formuller ve hedef alanlar kontrol edilmeden hicbir veri degistirilmez.
      if(names.some(function(field){
        return !!sheet.getRange(sheetRow,positions[field]+1).getFormula();
      })){
        conflicted.push({id:item.id,version:item.version});return;
      }
      names.forEach(function(field){
        var cell=sheet.getRange(sheetRow,positions[field]+1);
        if(field==='phone')cell.setNumberFormat('@');
        if(field==='appointment_time')cell.setNumberFormat('hh:mm');
        cell.setValue(otToSheetValue_(field,fields[field]));
      });
      SpreadsheetApp.flush();
      var updated=sheet.getRange(sheetRow,1,1,columnCount).getDisplayValues()[0];
      props.setProperty(key,otSignature_(updated,meta));
      acked.push({id:item.id,version:item.version});written++;
    }catch(e){
      // Belirsiz yazim hatasi: onaylama. Tekrar denenir, farkli veri korunur.
      Logger.log('Ortak Takip -> Sheets aktarim sorunu, ID: %s',id);
    }
  });
  if(acked.length)otOutboxCall_('post',{action:'ack',entries:acked});
  if(conflicted.length)otOutboxCall_('post',{action:'conflict',entries:conflicted});
  Logger.log('Cift yonlu cikis: yazilan=%s; onaylanan=%s; cakisma=%s',
    written,acked.length,conflicted.length);
  return blocked;
}
function ortakTakipSenkronizeEt(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(3000)){
    Logger.log('Baska senkronizasyon calisiyor, bu tur atlandi.');return;
  }
  try{
    // Once Ortak Takip degisikliklerini guvenli sekilde Sheets'e yansit.
    // Herhangi bir kimlik dogrulama hatasinda giris akisina devam edilmez.
    var blocked=otOutboxSync_();
    // Bekleyen/cekismeli kayitlar Sheets -> Ortak Takip akisinda atlanir.
    return otSheetsToOrtak_(blocked);
  }finally{lock.releaseLock();}
}
function ciftYonluDurum(){
  var a=otOutboxCall_('get'),result={
    pending:(a.pending||[]).length,
    conflicts:a.conflicts||0,
    lastRun:PropertiesService.getScriptProperties().getProperty('ORTAK_LAST_RUN')||'Henuz yok',
    triggerCount:ScriptApp.getProjectTriggers()
      .filter(function(t){return t.getHandlerFunction()==='ortakTakipSenkronizeEt';}).length
  };
  Logger.log(JSON.stringify(result));return result;
}
