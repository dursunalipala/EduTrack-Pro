# Ortak Takip – Randevu Merkezi

Bu modül mevcut Ortak Takip kullanıcı oturumu ve Supabase `public.appointments` tablosuyla çalışır. Google Sheets/AppSheet kaynağını değiştirmez.

## Ekranlar
- **Randevu İcmali:** Sütunlu tablo, hızlı sonuç güncelleme, arama, kurum/şube/sonuç filtresi, sıralama
- **Takvim:** Gün / hafta / ay randevu takibi
- **Geçmiş Randevular:** Tarihi geçmiş randevular
- **Kayıt Analizi:** Sonuç, kurum, personel ve aya göre dağılım; kayıt dönüşümü ve görüşülen tutarlar
- **Yeni Randevu:** Eğitim durumu, yaş, sınıf, AÖL kredisi, görüşme bilgileri, görüşen personel, sonraki arama tarihi, notlar

## Mevcut AppSheet verilerini alma
1. Kaynak Google Sheets dosyasını açın.
2. **Dosya → İndir → Virgülle ayrılmış değerler (.csv)** seçin. Çok sekmeli dosyada ilgili sekmeden CSV alın.
3. Ortak Takip → **Randevu Merkezi → CSV İçe Aktar**.
4. Dosyayı seçin; sistem yeni/mükerrer/hatalı satır sayılarını ve önizlemeyi gösterir.
5. Sayıları gözden geçirip kutucuğu işaretleyerek onaylayın.
6. Veriler 100 kayıtlık gruplarla eklenir; mevcut kayıtlar **güncellenmez**.

**Not:** İçe aktarım sadece Admin/Yönetici içindir. Zorunlu alanlar: `ID`, `VELİ/ÖĞRENCİ ADI SOYADI`, `GÖRÜŞME TARİHİ`. Bağlantı veri aktarımı mevcut Google Sheets'i etkilemez; Google hesabınıza otomatik senkronizasyon yapmaz. CSV yerel olarak tarayıcıda okunur, yalnızca onay verilen yeni satırlar Supabase'e yazılır.

## Tekil kayıt ve yetkiler
- `(workspace_id, source_record_id)` birleşimi benzersizdir; tekrarlanan AppSheet ID'leri tekrar eklenmez.
- Admin ve Yönetici tüm randevuları görebilir; personel yalnızca oluşturduğu veya kendisine atanmış kayıtlara erişebilir.
- Arşivleme verileri kalıcı silmez.
- Kimlik ve evrak dosyaları veritabanında tutulmaz. Bağlantı verilirse dosyanın bulunduğu servisin paylaşım izinleri ayrıca geçerlidir.

## Çıktılar
CSV/Excel çıktısı ve yazdırma görünümü mevcut. Sunulan ücretler **teklif/görüşülen tutardır**, tahsilat veya kesin gelir değildir.

## Güvenlik
Veriler RLS ile korunur. Yapay zekâ araçları bu modüle otomatik olarak sınırsız erişim elde etmez. İçe aktarılan kişisel veriler için kurumun KVKK aydınlatma, erişim ve saklama politikaları uygulanmalıdır.
