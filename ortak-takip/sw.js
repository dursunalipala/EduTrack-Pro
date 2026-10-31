/* Ortak Takip PWA: no caching of authenticated pages or Supabase responses. */
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
 if(event.request.mode!=="navigate")return;
 event.respondWith(
  fetch(event.request).catch(()=>new Response(
   '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ortak Takip</title><body style="font:16px system-ui;padding:32px;color:#142c49"><h2>Ortak Takip</h2><p>Bağlantı yok. Görevlerinize erişmek için internete bağlanıp yeniden deneyin.</p></body></html>',
   {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  ))
 );
});
