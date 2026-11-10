# İK Modülü — RLS doğrulama ve kabul testleri

## Uygulanan altyapı
- Kurum, personel, çalışma ilişkisi, kurum erişimi ve izin talebi tablolarında RLS politikaları.
- Sadece workspace owner yönetim yazma yetkisi; kullanıcı kendi personel kaydını okuyabilir.
- İK yöneticileri kurum bazında çalışma ilişkilerini ve izinleri okuyabilir.
- Personel kendi kurumuna bağlı geçerli istihdam ilişkisi varsa bekleyen izin talebi açabilir.
- Denetim kayıtları normal kullanıcıya açılmaz.

## Yayın öncesi zorunlu testler
1. Workspace sahibi kurum ve personel kaydı oluşturabilir.
2. Yetkisiz oturum kurum ve personel kayıtlarını okuyamaz.
3. Kurum A yöneticisi kurum B çalışma ilişkilerini ve izinlerini göremez.
4. Kurum A yöneticisinin başka kuruma ait kayıt değiştirmesi reddedilir.
5. Personel kendi izin talebini oluşturabilir, başka personel adına oluşturamaz.
6. Personel izin onay durumunu doğrudan değiştiremez.
7. Kurum yetkisi olmayan kullanıcı personel kayıtlarına erişemez.
8. Denetim günlükleri doğrudan istemci tarafından okunamaz/yazılamaz.
9. Gerçek hesaplarla RLS döngü ve performans testleri yapılır.

## Açık tasarım konuları
- İK yöneticisinin kurum personel kartlarını görmesi için güvenli ve döngüsüz RLS/servis katmanı.
- Personel-kurum eşleştirmesi ve onay akışı sunucu tarafında doğrulanmalı.
- İzin onayında employment kurum eşleşmesi ayrıca doğrulanmalı.
- Hassas özlük, sağlık ve maaş verileri ayrı güvenli depolama katmanında tutulmalı.
- HR audit log sunucu tarafı işlemlerle yazılmalı.
- Kurumlar arasında veri izolasyonu test edilmeden main dalına birleştirilmemeli.

## Durum
Veritabanı politikaları uygulandı; gerçek kullanıcılarla uçtan uca testler ve arayüz entegrasyonu bekliyor.

## İzin bildirimi entegrasyonu (11 Kasım 2026)
- `hr_leave_notify_trigger`: yeni bekleyen talepte ilgili kurumun aktif İK yöneticilerine ve aktif workspace sahiplerine `user_notifications` kaydı açar.
- Onay veya ret durumunda personelin bağlı hesabına `user_notifications` kaydı açar.
- Bildirim yükü yalnızca modül, kurum ve talep kimliğini içerir; izin açıklaması ve sağlık verisi içermez.
- İzin kontrol tetikleyicisi ve bildirim tetikleyicisi etkin olarak doğrulandı.
- Veritabanında henüz İK kurum kaydı bulunmadığından gerçek kullanıcıya bildirim gönderimi uçtan uca sınanmadı.
- Test: iki kurum ve en az üç test kullanıcısı (admin, müdür, personel) ile izin açma, bildirim alıcıları, onay/red, kendi iznini onaylama engeli ve kurumlar arası erişim izolasyonu doğrulanmalı.
- Bildirim sesi, push ve e-posta teslimi ayrıca test edilmeli; bu değişiklik yalnızca uygulama içi kayıt üretir.
