(async function(){
const WA="529843237592",FB="https://www.facebook.com/alejo.lucatelliperren",EMAIL=(window.RN_EMAIL||"alejolucatelli@gmail.com").trim();
function driveOpt(u,w){if(!u)return u;w=w||1200;if(u.indexOf("lh3.googleusercontent.com/d/")!==-1)return u.replace(/=w\d+.*/,"")+"=w"+w;return u}
function waMsg(p){let t="Hola, vi *Real Nort México* y me interesa:\n\n*"+((p&&p.name)||"Propiedad")+"*\n";if(p&&p.loc)t+="📍 "+p.loc+"\n";if(p&&p.price)t+="💰 "+p.price+"\n";return"https://wa.me/"+WA+"?text="+encodeURIComponent(t+"\n¿Más info?")}
function emailMsg(p){return"mailto:"+EMAIL+"?subject="+encodeURIComponent("Consulta Real Nort")+"&body="+encodeURIComponent("Hola, me interesa "+((p&&p.name)||"propiedades en Tulum"))}
function mapsUrl(p){return(p&&p.maps)||("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(((p&&p.name)||"")+", Tulum Mexico"))}
function safeImg(p,i,w){const u=(p&&p.images&&p.images[Math.min(i||0,(p.images.length||1)-1)])||"";return driveOpt(u,w||1200)}
function lazyBg(el,url){if(!el||el.classList.contains("loaded")||el.dataset.loading==="1")return;el.dataset.loading="1";const full=url;let pre=null;if(full&&full.indexOf("lh3.googleusercontent.com/d/")!==-1)pre=full.replace(/=w\d+.*/,"")+"=w400";function apply(src,done){const img=new Image();img.decoding="async";img.onload=()=>{el.style.backgroundImage="url('"+src+"')";if(done){el.classList.add("loaded");el.dataset.loading="0"}};img.onerror=()=>{if(done){el.classList.add("loaded");el.dataset.loading="0"}};img.src=src}if(pre&&pre!==full){apply(pre,false);apply(full,true)}else apply(full,true)}
const gallery=document.getElementById("gallery"),progressRail=document.getElementById("progressRail");
let currentIndex=0,wheelLock=false;window.filterBeds="all";window.filterRegion="all";let currentDetail=null,detailIdx=0,detailImgs=[],catalogMap=null,mapMarkers=[],detailIo=null,detailWheelLock=false;window.catalogView="grid";
function findProp(id){return(featured||[]).find(p=>p.id===id)||(allProperties||[]).find(p=>p.id===id)}
window.findProp=findProp;
function getFiltered(){let s=(allProperties&&allProperties.length?allProperties:featured||[]).slice();if(window.filterBeds!=="all")s=s.filter(p=>p.bedsKey===window.filterBeds);if(window.filterRegion!=="all")s=s.filter(p=>p.regionKey===window.filterRegion);return s}
window.getFiltered=getFiltered;
function buildGallery(){
if(!window.featured||!featured.length){gallery.innerHTML='<section class="slide active"><div class="slide-content" style="padding:4rem 2rem"><h1 class="slide-title">Cargando…</h1></div></section>';return}
const total=(allProperties&&allProperties.length)||featured.length;
let h=`<section class="slide active" data-index="0"><div class="slide-bg loaded" style="background-image:url('${safeImg(featured[0],0,1200)}')"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">Tulum · Riviera Maya</span><h1 class="slide-title">Todas las propiedades.<br>Una experiencia.</h1><p class="slide-desc">Fotos reales. Filtra por zona y contáctanos por WhatsApp.</p><div class="slide-actions"><button type="button" class="cta gold" id="btnAllIntro">Ver todas (${total})</button><a class="cta" href="${waMsg({name:"Catálogo"})}" target="_blank" rel="noopener">WhatsApp</a></div></div><div class="scroll-hint">Desliza</div></section>`;
featured.forEach((p,i)=>{const n=(p.images&&p.images.length)||1;h+=`<section class="slide" data-index="${i+1}" data-id="${p.id}"><div class="slide-bg" data-bg="${safeImg(p,0,1000)}"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">${p.tag||p.loc||""}</span><h2 class="slide-title">${p.name}</h2><p class="slide-location">${p.loc||"Tulum"}</p><p class="slide-desc">${p.desc||""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price||"Precio negociable"}</span></div></div><div class="slide-actions"><button type="button" class="cta" data-open="${p.id}">Ver galería (${n})</button><a class="cta gold" href="${waMsg(p)}" target="_blank" rel="noopener">WhatsApp</a></div></div></section>`});
const last=featured.length+1;
h+=`<section class="slide" data-index="${last}"><div class="slide-bg" data-bg="${safeImg(featured[0],1,1000)}"></div><div class="slide-overlay"></div><div class="slide-content" style="max-width:480px"><span class="slide-tag">Contacto</span><h2 class="slide-title">Hablemos de tu próxima propiedad.</h2><p class="slide-desc">WhatsApp o email. Respuesta rápida.</p><div class="slide-actions"><a class="cta gold" href="https://wa.me/${WA}?text=${encodeURIComponent("Hola, vi Real Nort")}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(null)}">Email</a><button type="button" class="cta" id="btnAllEnd">Ver todas</button></div></div></section>`;
gallery.innerHTML=h;setupAfterBuild()}
function setupAfterBuild(){
const slides=()=>Array.from(gallery.querySelectorAll(".slide"));
progressRail.innerHTML="";slides().forEach((_,i)=>{const d=document.createElement("button");d.type="button";d.className="progress-dot"+(i===0?" active":"");d.onclick=()=>slides()[i].scrollIntoView({behavior:"smooth",block:"start"});progressRail.appendChild(d)});
gallery.querySelectorAll(".slide-bg[data-bg]").forEach(el=>new IntersectionObserver((ents)=>{ents.forEach(e=>{if(e.isIntersecting){const u=e.target.getAttribute("data-bg");if(u)lazyBg(e.target,u)}})},{root:gallery,rootMargin:"180% 0px"}).observe(el));
const io=new IntersectionObserver((ents)=>{ents.forEach(en=>{if(!en.isIntersecting||en.intersectionRatio<.5)return;const s=en.target,ix=+s.dataset.index;slides().forEach(x=>x.classList.remove("active"));s.classList.add("active");currentIndex=ix;Array.from(progressRail.children).forEach((d,i)=>d.classList.toggle("active",i===ix))})},{threshold:[.5]});
slides().forEach(s=>io.observe(s));
gallery.addEventListener("wheel",e=>{if(wheelLock){e.preventDefault();return}if(Math.abs(e.deltaY)<12)return;e.preventDefault();const list=slides(),dir=e.deltaY>0?1:-1,n=Math.max(0,Math.min(list.length-1,currentIndex+dir));if(n===currentIndex)return;wheelLock=true;list[n].scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>wheelLock=false,700)},{passive:false});
document.getElementById("logoHome").onclick=e=>{e.preventDefault();gallery.scrollTo({top:0,behavior:"smooth"})};
document.getElementById("btnAll").onclick=()=>window.openAll();
document.getElementById("allClose").onclick=()=>window.closeAll();
const bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");
if(bg)bg.onclick=()=>setCatalogView("grid");if(bm)bm.onclick=()=>setCatalogView("map");
["btnAllIntro","btnAllEnd"].forEach(id=>{const el=document.getElementById(id);if(el)el.onclick=()=>window.openAll()});
gallery.onclick=e=>{const o=e.target.closest("[data-open]");if(o){const p=findProp(o.getAttribute("data-open"));if(p)openDetail(p)}};
document.getElementById("detailBack").onclick=closeDetail;
document.getElementById("detailClose").onclick=closeDetail;
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(document.getElementById("detail").classList.contains("open"))closeDetail();else if(document.getElementById("allOverlay").classList.contains("open"))window.closeAll()}});
}
function openDetail(p){
if(!p)return;currentDetail=p;detailIdx=0;
const rich=p;detailImgs=((rich.images&&rich.images.length)?rich.images.slice():[safeImg(p,0,1200)]).map(u=>driveOpt(u,1200));
const slidesEl=document.getElementById("detailSlides"),rail=document.getElementById("detailRail"),info=document.getElementById("detailInfo"),counter=document.getElementById("detailCounter"),scrollEl=document.getElementById("detailScroll");
const n=detailImgs.length;
slidesEl.innerHTML=detailImgs.map((src,i)=>`<div class="detail-slide${i===0?" loaded":""}" data-src="${src}" data-i="${i}"${i===0?` style="background-image:url('${src}')"`:""}></div>`).join("");
rail.innerHTML=detailImgs.map((_,i)=>`<button type="button" class="detail-rail-dot${i===0?" active":""}" data-i="${i}"></button>`).join("");
rail.querySelectorAll(".detail-rail-dot").forEach(d=>d.onclick=()=>goDetail(+d.dataset.i));
if(counter)counter.textContent="1 / "+n;
info.innerHTML=`<span class="slide-tag">${p.tag||p.loc||""}${n>1?" · "+n+" fotos":""}</span><h2 class="slide-title" style="font-size:clamp(1.5rem,3.5vw,2.2rem)">${p.name}</h2><p class="slide-location">${p.loc||"Tulum"}</p><p class="slide-desc">${p.desc||""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price||"Precio negociable"}</span></div></div><div class="slide-actions"><a class="cta gold" href="${waMsg(p)}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(p)}">Email</a><a class="cta" href="${mapsUrl(p)}" target="_blank" rel="noopener">Maps</a></div>`;
document.getElementById("detail").classList.add("open");document.body.style.overflow="hidden";if(scrollEl)scrollEl.scrollTop=0;
if(detailIo)detailIo.disconnect();
detailIo=new IntersectionObserver((ents)=>{ents.forEach(en=>{if(!en.isIntersecting||en.intersectionRatio<.45)return;const i=+en.target.dataset.i;if(isNaN(i))return;detailIdx=i;rail.querySelectorAll(".detail-rail-dot").forEach((d,idx)=>d.classList.toggle("active",idx===i));if(counter)counter.textContent=(i+1)+" / "+n;loadDetailImg(i);loadDetailImg(i+1)})},{root:scrollEl,threshold:[.45]});
slidesEl.querySelectorAll(".detail-slide").forEach(s=>detailIo.observe(s));loadDetailImg(0);loadDetailImg(1)}
window.openDetail=openDetail;
function loadDetailImg(i){const el=document.querySelectorAll("#detailSlides .detail-slide")[i];if(!el||el.classList.contains("loaded"))return;const src=el.getAttribute("data-src");if(src)lazyBg(el,src)}
function goDetail(i){if(!currentDetail)return;const n=detailImgs.length||1;detailIdx=Math.max(0,Math.min(n-1,i));const slides=document.querySelectorAll("#detailSlides .detail-slide");if(slides[detailIdx])slides[detailIdx].scrollIntoView({behavior:"smooth",block:"start"})}
function closeDetail(){document.getElementById("detail").classList.remove("open");document.body.style.overflow="";currentDetail=null;if(detailIo){detailIo.disconnect();detailIo=null}}
window.closeDetail=closeDetail;
function setCatalogView(view){window.catalogView=view==="map"?"map":"grid";const grid=document.getElementById("propGrid"),panel=document.getElementById("mapPanel"),bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");if(grid)grid.hidden=window.catalogView==="map";if(panel)panel.hidden=window.catalogView!=="map";if(bg)bg.setAttribute("aria-pressed",window.catalogView==="grid"?"true":"false");if(bm)bm.setAttribute("aria-pressed",window.catalogView==="map"?"true":"false");if(window.catalogView==="map")setTimeout(()=>{initCatalogMap();updateMapMarkers(getFiltered())},60)}
function loadLeaflet(cb){if(typeof L!=="undefined"){cb();return}if(window.__rnLeafletLoading){window.__rnLeafletLoading.push(cb);return}window.__rnLeafletLoading=[cb];var link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);var s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.onload=function(){var q=window.__rnLeafletLoading||[];window.__rnLeafletLoading=null;q.forEach(function(fn){try{fn()}catch(e){}})};document.head.appendChild(s)}
function initCatalogMap(){loadLeaflet(function(){if(typeof L==="undefined")return;const el=document.getElementById("catalogMap");if(!el)return;if(catalogMap){catalogMap.invalidateSize();return}catalogMap=L.map(el,{zoomControl:true,scrollWheelZoom:true}).setView([20.211,-87.455],13);L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{attribution:"© OSM © CARTO",maxZoom:19}).addTo(catalogMap);setTimeout(function(){if(catalogMap)catalogMap.invalidateSize()},120)})}
function updateMapMarkers(props){if(!catalogMap||typeof L==="undefined")return;mapMarkers.forEach(m=>catalogMap.removeLayer(m));mapMarkers=[];if(!props||!props.length)return;const bounds=[];props.forEach(p=>{if(p.lat==null||p.lng==null)return;const icon=L.divIcon({className:"rn-marker",html:'<div class="rn-pin"></div>',iconSize:[12,12],iconAnchor:[6,6]});const marker=L.marker([p.lat,p.lng],{icon});marker.bindPopup("<strong>"+(p.name||"")+"</strong>");marker.addTo(catalogMap);mapMarkers.push(marker);bounds.push([p.lat,p.lng])});if(bounds.length===1)catalogMap.setView(bounds[0],15);else if(bounds.length>1)catalogMap.fitBounds(bounds,{padding:[40,40],maxZoom:15})}
function openAll(){
window.filterBeds="all";window.filterRegion="all";window.catalogView="grid";
var g=document.getElementById("gallery"),pr=document.getElementById("progressRail");
if(g){g.style.visibility="hidden";g.style.pointerEvents="none"}
if(pr)pr.style.visibility="hidden";
document.body.classList.add("catalog-open");
var panel=document.getElementById("mapPanel"),grid=document.getElementById("propGrid");
if(panel)panel.hidden=true;if(grid){grid.hidden=false;grid.style.display="grid"}
var ov=document.getElementById("allOverlay");
if(ov){ov.style.background="#000";ov.style.opacity="1";ov.style.pointerEvents="auto";ov.classList.add("open")}
renderGridFallback();
document.body.style.overflow="hidden";
}
window.openAll=openAll;
function closeAll(){
document.getElementById("allOverlay").classList.remove("open");
var ov=document.getElementById("allOverlay");if(ov){ov.style.opacity="";ov.style.pointerEvents=""}
document.body.classList.remove("catalog-open");
document.body.style.overflow="";
var g=document.getElementById("gallery"),pr=document.getElementById("progressRail");
if(g){g.style.visibility="";g.style.pointerEvents=""}
if(pr)pr.style.visibility="";
}
window.closeAll=closeAll;
function renderGridFallback(){
const beds=[{key:"all",label:"Todas"},{key:"studio",label:"Estudios"},{key:"1",label:"1 Rec"},{key:"2",label:"2 Rec"},{key:"3",label:"3 Rec"}];
const regions=[{key:"all",label:"Zonas"},{key:"aldea-zama",label:"Aldea Zama"},{key:"la-veleta",label:"La Veleta"},{key:"amira",label:"Amira"},{key:"holistika",label:"Holistika"},{key:"tulum",label:"Tulum"}];
const filtered=getFiltered();
const fb=document.getElementById("filterBar");
if(fb){
fb.innerHTML='<div class="filter-row"><span class="filter-label">Tipo</span>'+beds.map(f=>'<button type="button" class="filter-btn'+(window.filterBeds===f.key?" active":"")+'" data-beds="'+f.key+'">'+f.label+"</button>").join("")+'</div><div class="filter-row"><span class="filter-label">Zona</span>'+regions.map(f=>'<button type="button" class="filter-btn'+(window.filterRegion===f.key?" active":"")+'" data-region="'+f.key+'">'+f.label+"</button>").join("")+'<span class="filter-count">'+filtered.length+(filtered.length===1?" propiedad":" propiedades")+"</span></div>";
fb.querySelectorAll("[data-beds]").forEach(b=>b.onclick=function(){window.filterBeds=b.getAttribute("data-beds");renderGridFallback()});
fb.querySelectorAll("[data-region]").forEach(b=>b.onclick=function(){window.filterRegion=b.getAttribute("data-region");renderGridFallback()});
}
const grid=document.getElementById("propGrid");
if(!grid)return;
grid.hidden=false;grid.style.display="grid";
if(!filtered.length){grid.innerHTML='<div style="grid-column:1/-1;padding:4rem 1rem;text-align:center;color:rgba(255,255,255,.45)">Sin resultados</div>';return}
var html="";
for(var i=0;i<filtered.length;i++){
var p=filtered[i];
var ni=(p.images&&p.images.length)||1;
var src=(p.images&&p.images[0])||"";
if(src.indexOf("lh3.googleusercontent.com/d/")!==-1)src=src.replace(/=w\d+.*/,"")+"=w700";
var name=(p.name||"").replace(/</g,"");
var loc=(p.loc||"Tulum").replace(/</g,"");
var bedsTxt=(p.beds||"").replace(/</g,"");
var price=(p.price||"Precio negociable").replace(/</g,"");
html+='<article class="card" data-id="'+p.id+'">';
html+='<div class="card-photo" style="background-image:url(\''+src+'\')"><span class="card-badge">'+ni+' fotos</span></div>';
html+='<div class="card-info"><p class="card-loc">'+loc+'</p><h3 class="card-title">'+name+'</h3>';
html+='<p class="card-sub">'+bedsTxt+(ni>1?" · "+ni+" fotos":"")+'</p>';
html+='<div class="card-bottom"><span class="card-price">'+price+'</span><span class="card-link">Ver</span></div></div></article>';
}
grid.innerHTML=html;
grid.querySelectorAll(".card").forEach(function(card){
card.onclick=function(){
var id=card.getAttribute("data-id");
var p=findProp(id);
if(p){closeAll();openDetail(p)}
};
});
}
window.renderGrid=renderGridFallback;
function tryBuild(){if(typeof featured!=="undefined"&&featured.length){buildGallery();return true}return false}
if(!tryBuild()){window.__RN_ON_DATA=function(){tryBuild()};setTimeout(function(){if(!tryBuild())buildGallery()},3000)}
})();
