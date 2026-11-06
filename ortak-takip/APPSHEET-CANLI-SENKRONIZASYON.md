# Ortak Takip — AppSheet Canlı Senkronizasyon Kurulumu (Kasım 2026)

**Kaynak:** Elit Randevu Uygulaması / AppSheet
**Hedef:** `public.appointments` (Ortak Takip / Supabase)
**Yön:** AppSheet → Ortak Takip. Ters yönde veri yazılmaz.

## Hazır olanlar
- 639 önceki AppSheet kaydı kaynak ID ile eşleşir.
- Webhook: `https://gnwliizxuryfnpqrynym.supabase.co/functions/v1/ortak-takip-appsheet-sync`
- Güvenlik: `x-ortak-sync-key` header'ı zorunlu. **Anahtar bu repoda tutulmaz.**
- Değişiklikler ID eşleşirse mevcut satırı günceller; yeni ID ile gelenler eklenir.
- Silinmeler kalıcı silme değil, arşive alma şeklindedir.
- Yeni/değişen randevulara ilişkin otomatik takip görevi mevcut kurallarla oluşturulur veya güncellenir.

## AppSheet bot 1 — yeni kayıt ve değişiklik
1. AppSheet uygulamasının düzenleyicisinde **Automation → Bots → New Bot**.
2. Event source = **App**, Table = AppSheet kayıtların tutulduğu randevu tablosu.
3. Data change type: **Adds** ve **Updates**.
4. Process içinde Step = **Call a webhook**.
5. Preset **Custom**, HTTP Verb **POST**, Content Type **JSON**.
6. URL: `https://gnwliizxuryfnpqrynym.supabase.co/functions/v1/ortak-takip-appsheet-sync`
7. HTTP Headers'e ayrı satır olarak `x-ortak-sync-key: <ÖZEL_ANAHTAR>` yazın.
8. **Body ve Body Template boş** bırakılır: AppSheet değişen satırın kolonlarını JSON olarak otomatik gönderir.
9. Save, test kaydı güncelle, Automation Monitor / Audit History'de başarılı HTTP yanıtını kontrol et.

## AppSheet bot 2 — silinenler (isteğe bağlı)
1. Ayrı bot, Event source = App, Data change type = **Deletes**, Table = aynı.
2. Aynı URL, HTTP Verb = POST, Content Type = JSON, aynı güvenli header.
3. Body:
```json
{"action":"delete","record":{"ID":"<<[ID]>>"}}
```
4. Silinen satır Ortak Takip'te arşivlenir. AppSheet'teki satır geri gelirse güncelleme işlemi arşivden çıkarır.

## Gönderilen alanlar
ID; VELİ/ÖĞRENCİ ADI SOYADI; EĞİTİM DURUMU; YAŞ; SINIF; AÖL KREDİ; RAKAM; İL; İLÇE; GÖRÜŞEN KİŞİ; TELEFON; GÖRÜŞME TARİHİ; İLK GÖRÜŞME; RANDEVU TARİHİ; RANDEVU SAAT; RANDEVU ŞUBESİ; RANDEVU SONUCU; NOTLAR; isteğe bağlı TAKİP TARİHİ.

İçerik yalnızca tanınan alanları günceller; telefon ve tarihler denetlenir; yerel AppSheet dosya yolları HTTPS bağlantısına çevrilmez.

## Güncellik ve veri kaynağı ilkesi
- AppSheet ana kaynak; aynı alanlar iki ekranda değiştirilmemelidir. AppSheet'te yapılan sonraki değişiklik Ortak Takip'teki aynı alanı yeniden günceller.
- Bot olayları AppSheet'te **veri değişikliği uygulamadan sunucuya senkronize edildiğinde** oluşur; her telefon tuşuna basıldığında anında değil.
- Google Sheets dosyasında AppSheet dışından elle değiştirilen satırlar standart App botu ile her zaman tetiklenmez. Bunlar için ayrı Sheets olayları veya dönemsel CSV karşılaştırması gerekebilir.
- Botlar etkinleştirilene kadar otomatik aktarım başlamaz. Canlı endpoint ve gizli anahtarın varlığı tek başına otomasyon değildir.
- Ağ/kota/abonelik kısıtlarını ve Automation/Audit History hata kayıtlarını takip edin.

## Testler
- AppSheet ID'si mevcut bir randevunun NOTLAR alanını değiştirin → Ortak Takip'te aynı ID güncellenmeli, toplam kayıt sayısı artmamalı.
- AppSheet'te yeni ID'li bir satır ekleyin → Ortak Takip toplamı 1 artmalı.
- Aynı satırda tekrar değişiklik yapın → mükerrer ID oluşmamalı.
- Bot olayı başarısızsa AppSheet Audit History ve webhook hata yanıtını kontrol edin.

## Güvenlik
- `x-ortak-sync-key` değerini e-postalarda, paylaşılmış ekran görüntülerinde, GitHub dosyalarında, tarayıcı konsolunda veya AppSheet Body içinde yazmayın.
- AppSheet yetkilileri dışında gösterilmeyecek şekilde güvenli saklayın.
- Sızma şüphesinde `appsheet_sync_keys.active = false` ile anahtarı pasifleştirip yenisini üretin.
- Veli/öğrenci kişisel verileri için kurumun KVKK erişim, saklama ve aydınlatma süreçleri geçerlidir.
