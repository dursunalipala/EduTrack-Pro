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

/* Background push: browser starts this worker even when the application page is closed. */
self.addEventListener("push",event=>{
 let data={};
 try{data=event.data?.json()||{}}catch{data={title:"Ortak Takip",body:"Yeni bir bildiriminiz var."}}
 const title=String(data.title||"Ortak Takip · Yeni bildirim").slice(0,160);
 const body=String(data.body||"Ortak Takip'te yeni bir işleminiz var.").slice(0,180);
 const url=typeof data.url==="string"&&/^\/(?!\/)/.test(data.url)?data.url:"/";
 const id=String(data.id||"");
 event.waitUntil((async()=>{
  await self.registration.showNotification(title,{
   body,icon:"./icons/icon-192.png",badge:"./icons/icon-192.png",
   tag:id?"ortak-"+id:undefined,renotify:!!id,
   vibrate:[160,60,100],silent:false,data:{url,id}
  });
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of clients)client.postMessage({type:"ortak-push-received",id});
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const target=event.notification.data?.url||"/";
 const url=new URL(target,self.registration.scope);
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of clients){
   if(new URL(client.url).origin===url.origin){
    await client.navigate(url.href);
    return client.focus();
   }
  }
  return self.clients.openWindow(url.href);
 })());
});
