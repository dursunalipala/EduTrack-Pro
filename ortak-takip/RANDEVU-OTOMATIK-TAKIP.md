# Randevu Merkezi — Otomatik Takip Görevleri

**Uygulama:** Ortak Takip → Randevu Merkezi → Takip Görevleri.
**İş grubu:** Kayıt Yönetimi ve Öğrenci İşleri.

## Otomatik kurallar

- Yeni randevu **beklemede** ise ertesi gün takip görevi açılır.
- **İlk randevu** ise belirlenmiş randevu tarihi esas alınır.
- **Düşünecek** ise 3 gün sonra, **erteleme** ve **ön kayıt** ise 2 gün sonra takip görevi açılır.
- Personel **Arandı / Ulaşılamadı** kaydederse ertesi gün; **Görüşüldü / WhatsApp gönderildi** kaydederse 2 gün sonrasına görev ayarlanır.
- Randevuda **Sonraki Arama / Takip Tarihi** varsa, diğer otomatik tarihlere göre bu açıkça girilmiş tarih önceliklidir; geçmiş tarih bugüne çekilir.
- **Kayıt, olumsuz, başka okula kayıt, örgün veya yaş hatası** sonuçlarında açık otomatik takip iptal edilir. **Ön kayıt** kesin kayıt sayılmaz ve takip edilmeye devam eder.
- Bir randevunun aynı anda en fazla bir **aktif otomatik takip görevi** olur. Tamamlanan, iptal edilen veya arşivlenen görevlerin geçmişi korunur; sonraki gerçek takip işleminde gerekirse yeni görev açılır.
- Geçmişten içe aktarılan 639 randevuya topluca otomatik görev açılmaz. Tetikleyici, bundan sonraki kayıtları ve gerçekten değiştirilen kayıtları işler.

## Sorumluluk ve bildirimler

- **Üst sorumlu:** Kayıt Yönetimi ve Öğrenci İşleri iş grubunun aktif yöneticisi.
- **Uygulayıcı:** Randevuda seçilmiş aktif ilgili personel. Yoksa kayıt iş grubu sorumlusu.
- Atama, mevcut \`tasks\` bildirim akışını kullanır; görev atama bildirimleri, dönemsel bildirimler, e-posta/push tercihlerine göre çalışır.
- Personel görevi **Görev Takibi** ekranından yürütür; sonuç ve takip tarihi yine **Randevu Merkezi** kaydına işlenir.
- SMS/WhatsApp veliye otomatik gönderilmez: personel metni kontrol eder, WhatsApp'ta gönderir ve gönderim kaydını onaylar.

## Veri modeli ve güvenlik

- \`public.appointment_task_links\`: \`appointment_id\` + \`task_id\` ilişki tablosu, yalnızca bir *is_current=true* bağlantı.
- \`private.sync_appointment_followup_task(uuid,text)\`: tetikleyiciden çağrılan, \`search_path=''\` ile sınırlandırılmış, herkese kapalı görev senkronizasyonu.
- \`trg_appointment_auto_followup\`: randevu kaydı/sonuç/tarih/sorumlu güncellemesi.
- \`trg_appointment_contact_auto_followup\`: iletişim işlemi kaydı.
- \`appointment_task_links\` RLS aktiftir; kullanıcı yalnızca erişebildiği randevuya bağlı görev bağlantılarını görür; görevlerin içeriği ayrıca \`tasks\` RLS ile korunur.

## Kontroller

1. Yeni randevu → tek takip görevi.
2. Ulaşılamadı → aynı görev ertesi güne güncellenir.
3. Atanan personel değişti → görev uygulayıcısı değiştirilir.
4. Kayıt kesinleşti → açık takip iptal edilir.
5. Tekrar takip durumu → önceki görev geçmişte kalır, yeni aktif görev oluşturulur.
6. Ön kayıt → 2 gün sonraya takip görevi.
7. İletişim notu ve WhatsApp olayı → aynı randevu için mükerrer aktif görev oluşturulmaz.

Tüm testler \`BEGIN ... ROLLBACK\` içinde yapıldı; test kayıtları kalıcı değildir.
