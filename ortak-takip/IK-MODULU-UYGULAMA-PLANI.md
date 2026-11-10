# Ortak Takip — İK Modülü Uygulama Planı

Durum: geliştirme dalı, canlı arayüz henüz değiştirilmedi.

## Mevcut altyapı
- Supabase: workspaces, workspace_members, profiles.
- İK tabloları: hr_organizations, hr_employees, hr_employments, hr_org_access, hr_leave_requests, hr_audit_logs.
- Tüm İK tablolarında RLS etkin; authenticated/anon tablo izinleri kapalı. Erişim politikaları test edilmeden açılmayacak.

## Kurum izolasyonu
- workspace_id tenant sınırı, organization_id kurum sınırı.
- Personel birden fazla kurumla hr_employments üzerinden ilişkilendirilir.
- Bir personelin uygulama hesabı olmayabilir; user_id nullable.
- Yönetici, kendi kurumunun yetkili kayıtlarını görür.
- Maaş ve sağlık verileri ayrı özel tablolar ve erişim kontrolleriyle ele alınır.
- İşlem günlüğü yalnızca sunucu tarafından yazılır.

## Geliştirme sırası
1. Yetki fonksiyonları ve RLS: güvenli test hesaplarıyla kurumlar arası erişim testleri.
2. Kurum kayıtları ve personel-kullanıcı eşleştirme; veri doğrulaması.
3. Personel kartı / kurum filtresi / işe giriş-çıkış ekranları.
4. İzin talebi ve onay akışı; bildirimler.
5. Evrak, ücret, performans, raporlar.
6. Mobil test, yetki testi, canlı yayın.

## Kabul testleri
- A kurumu müdürü B kurumunun personelini göremez veya değiştiremez.
- Personel yalnızca kendi kayıtlarını ve izin taleplerini görür.
- Adminin erişimi workspace ve kurum yetkileriyle doğrulanır.
- Yetkisiz REST istekleri reddedilir.
- Mevcut görevler ve kullanıcı hesapları etkilenmez.
- Kritik değişiklikler denetim günlüğüne yazılır.

## Entegrasyon
Render static site: ortak-takip/
GitHub main otomatik yayın; geliştirme dalında hazırlık ve test yapılacak.
