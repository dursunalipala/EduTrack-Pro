// MEB annual calendar document reader. Extraction is a draft, never authoritative.
const months={ocak:1,subat:2,şubat:2,mart:3,nisan:4,mayis:5,mayıs:5,haziran:6,temmuz:7,agustos:8,ağustos:8,eylul:9,eylül:9,ekim:10,kasim:11,kasım:11,aralik:12,aralık:12};
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
const lower=s=>clean(s).toLocaleLowerCase("tr-TR");
const iso=(y,m,d)=>String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
function parseDate(s,defaultYear){const t=lower(s);let m=t.match(/(20\d\d)[-./](\d{1,2})[-./](\d{1,2})/);if(m)return iso(+m[1],+m[2],+m[3]);m=t.match(/(\d{1,2})\s*[-./ ]\s*(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\s*(20\d\d)?/);if(m)return iso(m[3]?+m[3]:defaultYear,months[m[2]],+m[1]);return null;}
function datesIn(s,year){const t=lower(s);const out=[];const re=/(\d{1,2})\s*(?:[-–]\s*(\d{1,2})\s*)?(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\s*(20\d\d)?/g;let m;while((m=re.exec(t))){const y=m[4]?+m[4]:year;out.push(iso(y,months[m[3]],+m[1]));if(m[2])out.push(iso(y,months[m[3]],+m[2]));}return out;}
function normalizeRows(lines){return lines.map(clean).filter(Boolean);}
function detect(lines,year){const rows=normalizeRows(lines),found=[],seen=new Set(),startYear=Number(year.slice(0,4));const rules=[
[/uyum e[gğ]itimi/i,"Uyum eğitimi","etkinlik","anaokulu"],
[/meslek[iî] (çalış|calis)|sene başı kurul/i,"Öğretmenlerin mesleki çalışmaları","etkinlik","tum"],
[/e[gğ]itim.*[öo][gğ]retim.*yılının başlangıcı|ders yılı başlangıcı/i,"Ders yılı başlangıcı","egitim","tum"],
[/1\.?\s*d[oö]nem ara tatil/i,"1. dönem ara tatili","tatil","tum"],
[/yarıyıl tatili/i,"Yarıyıl tatili","tatil","tum"],
[/2\.?\s*d[oö]nem ara tatil/i,"2. dönem ara tatili","tatil","tum"],
[/1\.?\s*d[oö]nemin sona ermesi/i,"1. dönemin sona ermesi","egitim","tum"],
[/2\.?\s*yarıyıl başlangıcı|2\.?\s*d[oö]nem başlangıcı/i,"2. dönem başlangıcı","egitim","tum"],
[/yılbaşı tatili/i,"Yılbaşı tatili","resmi_tatil","tum"],
[/cumhuriyet bayramı/i,"Cumhuriyet Bayramı","resmi_tatil","tum"],
[/ramazan bayramı/i,"Ramazan Bayramı","resmi_tatil","tum"],
[/kurban bayramı/i,"Kurban Bayramı","resmi_tatil","tum"],
[/23 nisan ulusal/i,"23 Nisan Ulusal Egemenlik ve Çocuk Bayramı","resmi_tatil","tum"],
[/19 mayıs atatürk/i,"19 Mayıs Atatürk’ü Anma Gençlik ve Spor Bayramı","resmi_tatil","tum"],
[/1 mayıs emek/i,"1 Mayıs Emek ve Dayanışma Günü","resmi_tatil","tum"],
[/e[gğ]itim.*[öo][gğ]retim.*yılının sona ermesi|ders yılı bitiş/i,"Ders yılı bitişi","egitim","tum"]
];for(let i=0;i<rows.length;i++){const line=rows[i];for(const [pattern,title,category,institution] of rules){if(!pattern.test(line))continue;let ds=datesIn(line,startYear);if(!ds.length)ds=datesIn(rows[i+1]||"",startYear);if(!ds.length){const raw=line.match(/20\d\d-\d\d-\d\d/g)||[];ds=raw;}if(!ds.length)continue;let first=ds[0],last=ds[ds.length-1];if(last<first){const tmp=first;first=last;last=tmp;}if(first.slice(0,4)<year.slice(0,4)||first.slice(0,4)>year.slice(5))continue;const key=title+"|"+first;if(seen.has(key))continue;seen.add(key);found.push({title,category,institution,starts_on:first,ends_on:last,day_fraction:category==="resmi_tatil"||category==="tatil"?0:1,source_name:"Otomatik taslak",notes:"Belgeden otomatik okundu; tarih ve iş günü etkisi yönetici tarafından doğrulanmalıdır."});}}return found;}
async function pdfLines(file){const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;const lines=[];for(let p=1;p<=Math.min(pdf.numPages,40);p++){const page=await pdf.getPage(p),text=await page.getTextContent(),groups=new Map();for(const item of text.items){if(!item.str?.trim())continue;const y=Math.round(item.transform[5]/4)*4;const arr=groups.get(y)||[];arr.push({x:item.transform[4],s:item.str});groups.set(y,arr);}for(const [y,items] of [...groups].sort((a,b)=>b[0]-a[0]))lines.push(items.sort((a,b)=>a.x-b.x).map(x=>x.s).join(" "));}return lines;}
async function excelLines(file){const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});const lines=[];for(const sheet of wb.SheetNames.slice(0,15)){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,raw:false,defval:""});for(const row of rows.slice(0,500))lines.push(row.join(" "));}return lines;}
function csvLines(fileText){return fileText.split(/\r?\n/);}
export async function readMebCalendar(file,year){const ext=file.name.split(".").pop().toLowerCase();const lines=ext==="pdf"?await pdfLines(file):["xlsx","xls"].includes(ext)?await excelLines(file):ext==="csv"?csvLines(await file.text()):[];if(!lines.length)throw Error("Belgeden okunabilir metin bulunamadı.");const items=detect(lines,year);return {items,lines:lines.length,warning:items.length?"Otomatik okuma taslaktır. Özellikle iki tarihli aralıklar, yarım günler ve iş günü toplamları elle doğrulanmalıdır.":"Bu dosya düzeninden güvenilir tarih çıkarılamadı. Taranmış PDF için OCR veya manuel giriş gerekir."};}
