# Elit Randevu – Çift Yönlü Google Sheets / Ortak Takip Senkronizasyonu

**Durum (13 Kasım 2026):** Supabase'te çift yönlü kuyruk, kimlik doğrulamalı çıkış servisi ve eşzamanlı değişiklik koruması kurulu. Ancak Google Apps Script, kullanıcının Google hesabında güncellenmeden Ortak Takip → Sheets yönü başlayamaz.

## Bir defalık kurulum

1. Halihazırda kullandığınız **Elit Randevu – Ortak Takip Senkronizasyonu** Apps Script projesini açın.
2. Mevcut `Code.gs` içeriğini kaldırın, aşağıdaki güncel dosyanın **tamamını** yerine yapıştırın:
   [Güncel çift yönlü Code.gs](./google-sheets-randevu-sync.gs).
3. Kaydedin (**Ctrl+S**). `ORTAK_TAKIP_SYNC_KEY` Script Property'si aynen kalır; yeni anahtar veya yeni proje gerekmez.
4. **`kurulumKontrol`** işlevini çalıştırın: Sayfa1 ve veri satırı sayısını göstermeli.
5. **`ciftYonluDurum`** işlevini çalıştırın: bağlantıya erişmeli, `triggerCount:1` göstermeli; bu sırada yeni izinler istenirse Google hesabınızdan onaylayın.
6. **Tetikleyiciler** ekranında `ortakTakipSenkronizeEt` fonksiyonuna ait **yalnız bir** zamanlayıcı bulunduğunu kontrol edin. Önceki 5 dakikalık zamanlayıcı korunur; **`zamanlayiciyiKur` tekrar çalıştırılmamalıdır.**

## Test

- Ortak Takip'te mevcut bir randevunun *Notlar* alanına yalnızca test için kısa bir ibare yazın. Kaydedin. Bir sonraki 5 dakikalık turdan sonra aynı AppSheet ID'nin Google Sheets `NOTLAR` sütununda güncellendiğini kontrol edin.
- Google Sheets/AppSheet tarafında aynı kaydın başka bir alanını düzenleyin; yeniden bir zamanlayıcı turundan sonra Ortak Takip'te yansıyıp yansımadığını inceleyin.
- Tekrarlanan Google Sheet satırları silinmez; Ortak Takip'te de kayıtlar kalıcı silinmez.

## Koruma

- AppSheet'teki mevcut pozitif ID'ler değişmez.
- Ortak Takip'te açılan **yeni** kayıtlar negatif sayısal ID ile oluşturulur (ör. `-763`) ve Google Sheets'e aynı ID ile eklenir. AppSheet'in pozitif otomatik numaralandırmasıyla çakışmaz. AppSheet uygulamanızın sayısal anahtar alanının negatif sayıları kabul ettiğini bir yeni kayıt testiyle ayrıca doğrulayın.
- Sadece `Randevu İcmali`nin eşleşen sütunlarına yazılır; formül içeren hücrelerin üzerine yazılmaz.
- Aynı kayıt iki tarafta farklı biçimde değişmişse, otomatik yazma durdurulur ve kayıt `conflict` durumuna alınır. Bu tür kayıtlar yönetici tarafından incelenmelidir. Sistem otomatik olarak birini doğru kabul etmez.
- Kayıt silme ve arşivleme Google Sheets tarafında otomatik silmeye çevrilmez.
- Script Property'deki özel anahtar asla dosya içine, GitHub deposuna, ekran görüntülerine veya WhatsApp mesajına eklenmemelidir.
- Eski tek yönlü Script'in yeni çift yönlü kodla tamamen değiştirilmesi gerekir. Eski kodla kalınırsa yalnızca Sheets → Ortak Takip çalışır.

## Aktarım bileşenleri

- `public.appointment_sheet_outbox`: Kullanıcının Ortak Takip'te yaptığı değişiklikleri izleyen güvenli kuyruk.
- `private.queue_appointment_sheet_change`: Kullanıcının değişen sütunlarını kuyruğa kaydeden sunucu tetikleyicisi.
- `ortak-takip-sheet-outbox` Supabase Edge Function: Google Apps Script'in bekleyen değişiklikleri kimlik doğrulamalı çekmesi, `ack` ve `conflict` durumu bildirmesi.
- `ortak-takip-appsheet-sync` Supabase Edge Function v2: Google Sheets'ten gelen kayıtları yalnız bekleyen bir yerel değişiklik yoksa eşleştirir; Ortak Takip kaynaklı kayıtları da kabul eder.
- `otOutboxSync_` Apps Script fonksiyonu önce Ortak Takip → Google Sheets değişikliklerini işler, sonra `otSheetsToOrtak_` fonksiyonu Google Sheets → Ortak Takip değişikliklerini işler.
- `PropertiesService` kopya veriyi değil yalnız satır imzasını saklar.

## Bilinmesi gerekenler

- Çift yönlü aktarım internet bağlantısına, Google Apps Script tetikleyicisinin çalışmasına ve AppSheet'in kaynak dosyaya yazmasına bağlıdır; **anlık değil**, planlandığı gibi yaklaşık 5 dakikada bir gerçekleşir.
- İlk toplu eşleştirme tamamlanmadan aynı kaydın iki tarafta farklı güncellenmesi halinde sistem çakışma gösterebilir. Bu, veri kaybından daha güvenli bir davranıştır.
- Google Sheets'in gerçek sütun tipleri ve AppSheet'in yeni negatif sayısal ID'yi kabul ettiği Google hesabı üzerinden henüz uçtan uca test edilmemiştir.
