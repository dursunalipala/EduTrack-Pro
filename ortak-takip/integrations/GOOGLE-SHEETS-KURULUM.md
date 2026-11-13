# Elit Randevu — Google Sheets → Ortak Takip (AppSheet'ten Bağımsız Bağlantı)

Bu bağlantı AppSheet'te Bot gerektirmez. AppSheet aynı dosyaya yazarken bağımsız Google Apps Script her 5 dakikada bir dosyayı okuyarak Ortak Takip'e **tek yönlü** güncel kayıtları gönderir.

## Kod

Dosya: [google-sheets-randevu-sync.gs](./google-sheets-randevu-sync.gs)

- Kaynak dosya ID: `12szwnUoY-5V7NgrOwDeGi3SsyA1QaHUR`
- Hedef: Supabase `ortak-takip-appsheet-sync` Edge Function.
- Güvenlik: Anahtar **kodda ve depoda bulunmaz**, Google Apps Script Script Properties'te saklanır.
- İlk kurulumda tüm geçmiş kayıtların yeni halini ID üzerinden eşleştirir; 120 satır/zamanlayıcı çalışması, devamı sonraki 5 dakikalık turda.
- Daha sonra yalnız değişiklik yapılan satırları tekrar gönderir.
- Kayıtlar kaynak tablodan silindiğinde Ortak Takip'ten otomatik silinmez (veri güvenliği).
- Bot, bildirim ve görevler Ortak Takip'in mevcut iş akışına bağlıdır.

## Sadece bir defalık Google hesabı kurulumu

1. [Apps Script'te yeni bağımsız proje aç](https://script.google.com/home/projects/create).
2. Varsayılan `Code.gs` içeriğini silip [kod dosyasının](./google-sheets-randevu-sync.gs) tamamını yapıştırın, kaydedin; proje adı `Elit Randevu → Ortak Takip` olsun.
3. Sol menüden **Project Settings (Proje Ayarları) → Script Properties (Komut Dosyası Özellikleri) → Add** seçin.
4. Özellik adı `ORTAK_TAKIP_SYNC_KEY`. Değeri önceki sohbette oluşturulup özel olarak iletilen **64 karakterlik güvenlik anahtarı**. Bu değeri kod içine veya herkese açık dosyalara eklemeyin.
5. Üstteki fonksiyon seçiminden `kurulumKontrol` seçip **Run** basın. Google'ın izin ekranında kendi kaynak dosyanıza okuma ve dış webhook'a güvenli veri gönderme izinlerini onaylayın. Execution log'da doğru sekme, satır ve sütun sayısı görülmeli; kişisel bilgi kaydedilmez.
6. `kurulumKontrol` başarılıysa **`zamanlayiciyiKur`** seçip **Run** basın. Tek bir 5 dakikalık otomatik tetikleyici kurar ve ilk aktarımı yapar.
7. Kontrol için `sonSenkronizasyonDurumu` fonksiyonunu çalıştırın; `triggerCount: 1` beklenir. Ortak Takip → Randevu Merkezi sayfasını yenileyin ve kaynak ID'lerle karşılaştırın.

## Çok önemli: Dosya gerçekten Google Sheets mi?

Paylaşılan URL `docs.google.com/spreadsheets/d/...` şeklinde, fakat bu URL Excel (.xlsx) dosyasının Google Sheets düzenleyicisinde açılması durumunda da kullanılabiliyor. İçindeki `sd=true` parametresi dosyanın biçimi hakkında kesin kanıt değildir.

`kurulumKontrol` `SpreadsheetApp.openById` ile dosyayı açamıyorsa **dosyayı rastgele kopyalayıp aktarmaya devam etmeyin**. AppSheet hâlâ eski Excel dosyasına yazıyor olabilir ve yeni Google Sheets kopyası güncel kalmayacaktır. Dosya türünü, AppSheet'in hangi dosyaya yazdığını kontrol ederek dönüştürme veya doğrudan Excel kaynağına erişen farklı aktarım yöntemini planlamak gerekir.

## Hata durumları

- `Script Properties` anahtarı eksik/hatalıysa kurulum başlamaz.
- Kaynak tablo `ID`, öğrenci/veli adı, görüşme tarihi başlıklarından birini içermiyorsa kod satırları göndermez.
- HTTP 207 durumunda hatalı satırlar teker teker izole edilir; hatasız kayıtların aktarımı sürer.
- Çalışmalar üst üste binmez (LockService). İlk turda 639 geçmiş kayıt olduğu için birden fazla 5 dakikalık tur gerekebilir.
- Günlük kullanımda Google Sheets satırının son güncel hali transfer edilir; AppSheet'in kaydettiği kayıt senkronizasyon sonrası dosyaya düştüğünde sonraki zamanlayıcı onu alır.
- Kullanıcının izin verdiği script Google hesabı üzerinden çalışır. Değişiklik olaylarına güvenilmediğinden zamanlayıcı kullanılır.
- Supabase üzerinde `last_synced_at` bilgisi ile güncellik kontrol edilir. Script Properties `ORTAK_LAST_SUMMARY` yalnız sayısal özet içerir.
- Bu entegrasyon *Ortak Takip → Google Sheets* ters yönde yazma yapmaz.

## Aktif olma durumu

GitHub'da script dosyasının bulunması, Google Apps Script'in yetkilendirildiği veya zamanlayıcısının kurulduğu anlamına **gelmez**. Kullanıcının Google hesabında yukarıdaki bir defalık kurulum tamamlandığında, canlı veride yeni kayıt doğrulanmalıdır.
