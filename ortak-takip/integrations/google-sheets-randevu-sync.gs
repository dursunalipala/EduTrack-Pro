/**
 * Elit Randevu AppSheet/Google Sheets -> Ortak Takip (Supabase)
 * Tek yonlu. Kaynak dosyaya veya AppSheet'e hicbir veri yazmaz.
 * Kurulum: https://script.google.com/home/projects/create
 * Script Property: ORTAK_TAKIP_SYNC_KEY = daha once olusturulan 64 karakterlik ozel anahtar
 * Once kurulumKontrol(), sonra zamanlayiciyiKur() calistirin.
 */
var ORTAK_CONFIG = {
  spreadsheetId: '12szwnUoY-5V7NgrOwDeGi3SsyA1QaHUR',
  sheetName: '', // Bos: basliginda ID, ad-soyad ve gorusme tarihi olan sayfayi otomatik bul
  endpoint: 'https://gnwliizxuryfnpqrynym.supabase.co/functions/v1/ortak-takip-appsheet-sync',
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
function ortakTakipSenkronizeEt() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(3000)){Logger.log('Baska senkronizasyon calisiyor; bu tur atlandi.');return;}
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
  }finally{lock.releaseLock();}
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
