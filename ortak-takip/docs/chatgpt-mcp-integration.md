# Ortak Takip – ChatGPT MCP entegrasyonu (uygulama planı)

Durum: OAuth izin ekranı yayında; MCP uç noktası ve ChatGPT bağlantısı **henüz yok**.

## Amaç
ChatGPT içinde, Supabase Auth OAuth 2.1 yetkilendirmesiyle Ortak Takip'in görev, randevu ve toplantı verilerine salt okunur erişim.

## Mimari
1. ChatGPT MCP istemcisi -> HTTPS `/mcp` (Streamable HTTP) -> kullanıcıya ait OAuth erişim tokenı.
2. MCP sunucusu, tokenı Supabase Auth üzerinden doğrular; token yoksa/yanlışsa 401 döner. Supabase JWT'nin `aud`, `iss`, `exp` ve gerekli scope/resource bağlamı da kontrol edilir.
3. MCP araçları `tasks_list`, `appointments_list`, `meetings_list`; kullanıcı tokenı ile Supabase Data API sorgulanır, RLS geçerlidir.
4. Supabase Auth OAuth 2.1 authorization endpoint ve token endpoint kullanılır. Kullanıcı onayı `/oauth/consent` sayfasındadır. Geri dönüş URI'si ChatGPT bağlantısı oluşturulduktan sonra **aynen** kaydedilir.
5. OAuth discovery / protected resource metadata ve 401 WWW-Authenticate başlıkları, ChatGPT istemcisinin beklentilerine göre canlı test edilir.
6. Hiçbir servis rolü anahtarı, kullanıcı parolası veya refresh tokenı ChatGPT konuşmasına, GitHub deposuna veya tarayıcı kaynak koduna konmaz.

## Güvenlik
- İlk sürüm salt okunur.
- Randevuların ad, telefon, kimlik, not ve belge alanları MCP yanıtına dahil edilmez.
- Çalışma alanı ve modül bazlı RLS aynen korunur; salt çalışma alanı üyeliği, modül yetkisi yerine geçmez.
- İzin ekranı istenen istemciyi ve izinleri gösterir; onay kullanıcı eylemi gerektirir.
- İstemci kaydı ve OAuth geri dönüş adresi doğrulanmadan canlı yetkilendirme testi yapılmaz.

## Doğrulama kapıları
- [x] Supabase OAuth Server etkin (kullanıcının ekran görüntüsü).
- [x] `/oauth/consent` sayfası mobilde açılıyor.
- [x] Salt okunur `ortak-takip-chatgpt-read` Edge Function ACTIVE.
- [ ] MCP sunucusu kodu ve dağıtımı.
- [ ] MCP `initialize`, `tools/list`, `tools/call` protokol testleri.
- [ ] OAuth istemci kaydı ve redirect URI doğrulaması.
- [ ] Yetkili kullanıcıyla OAuth oturum açma.
- [ ] Rol/çalışma alanı izolasyonu ve gerçek görev sorgusu.
- [ ] ChatGPT özel eklentisi/bağlantısı.

## Uygulama notu
Var olan Supabase Edge Function, MCP protokolünü uygulamaz; onu doğrudan ChatGPT MCP URL'si olarak kullanmayın. MCP endpointi ayrı geliştirilmeli. `/oauth/consent` yalnızca izin ekranıdır, OAuth callback değildir.
