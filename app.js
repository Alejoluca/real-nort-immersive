(async function(){
const WA="529843237592",FB="https://www.facebook.com/alejo.lucatelliperren",IG="https://www.instagram.com/alejo_lucatelli/",EMAIL=(window.RN_EMAIL||"alejolucatelli@gmail.com").trim();
const metrics={events:[],track(n,d){this.events.push({name:n,t:Date.now(),...d});try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:"rn_"+n,...d})}catch(e){}}};
window.__RN_METRICS=metrics;
function driveOpt(u,w){if(!u)return u;w=w||1600;if(u.indexOf("lh3.googleusercontent.com/d/")!==-1)return u.replace(/=w\d+.*/,"")+"=w"+w;return u}
function waMsg(p){let t="Hola, vi *Real Nort México* y me interesa:\n\n*"+((p&&p.name)||"Propiedad")+"*\n";if(p&&p.loc)t+="📍 "+p.loc+"\n";if(p&&p.price)t+="💰 "+p.price+"\n";return"https://wa.me/"+WA+"?text="+encodeURIComponent(t+"\n¿Más info?")}
function emailMsg(p){return"mailto:"+EMAIL+"?subject="+encodeURIComponent("Consulta Real Nort")+"&body="+encodeURIComponent("Hola, me interesa "+((p&&p.name)||"propiedades en Tulum"))}
function mapsUrl(p){return(p&&p.maps)||("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(((p&&p.name)||"")+", Tulum Mexico"))}
function safeImg(p,i,w){const u=(p&&p.images&&p.images[Math.min(i||0,(p.images.length||1)-1)])||"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1200";return driveOpt(u,w||1600)}
function lazyBg(el,url){if(!el||el.classList.contains("loaded")||el.dataset.loading==="1")return;el.dataset.loading="1";const full=url;let pre=null;if(full&&full.indexOf("lh3.googleusercontent.com/d/")!==-1)pre=full.replace(/=w\d+.*/,"")+"=w400";function apply(src,done){const img=new Image();img.decoding="async";img.onload=()=>{el.style.backgroundImage="url('"+src+"')";if(done){el.classList.add("loaded");el.dataset.loading="0"}};img.onerror=()=>{if(done){el.classList.add("loaded");el.dataset.loading="0"}};img.src=src}if(pre&&pre!==full){apply(pre,false);apply(full,true)}else apply(full,true)}
window.driveOpt=driveOpt;window.safeImg=safeImg;window.lazyBg=lazyBg;window.waMsg=waMsg;window.emailMsg=emailMsg;window.mapsUrl=mapsUrl;
const gallery=document.getElementById("gallery"),progressRail=document.getElementById("progressRail");
let currentIndex=0,wheelLock=false;window.filterBeds="all";window.filterRegion="all";let currentDetail=null,detailIdx=0;window.gridImgObs=null;let detailImgs=[];let catalogMap=null,mapMarkers=[];window.catalogView="grid";let detailWheelLock=false,detailIo=null;
function findProp(id){return(featured||[]).find(p=>p.id===id)||(allProperties||[]).find(p=>p.id===id)}
window.findProp=findProp;
function getFiltered(){let s=(allProperties&&allProperties.length?allProperties:featured).slice();if(window.filterBeds!=="all")s=s.filter(p=>p.bedsKey===window.filterBeds);if(window.filterRegion!=="all")s=s.filter(p=>p.regionKey===window.filterRegion);return s}
window.getFiltered=getFiltered;
function buildGallery(){
if(!window.featured||!featured.length){gallery.innerHTML='<section class="slide active"><div class="slide-content" style="padding:4rem 2rem"><h1 class="slide-title">Cargando…</h1></div></section>';return}
metrics.track("page_view",{featured:featured.length,all:(allProperties||[]).length});
const total=(allProperties&&allProperties.length)||featured.length;
let h=`<section class="slide active" data-index="0"><div class="slide-bg loaded" style="background-image:url('${safeImg(featured[0],0,1600)}')"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">Tulum · Riviera Maya</span><h1 class="slide-title">Todas las propiedades.<br>Una experiencia.</h1><p class="slide-desc">Fotos reales. Filtra por zona, abre el mapa y contáctanos.</p><div class="slide-actions"><button type="button" class="cta gold" id="btnAllIntro">Ver todas (${total})</button><a class="cta" href="${waMsg({name:"Catálogo"})}" target="_blank" rel="noopener">WhatsApp</a></div></div><div class="scroll-hint">Desliza</div></section>`;
featured.forEach((p,i)=>{const n=(p.images&&p.images.length)||1;h+=`<section class="slide" data-index="${i+1}" data-id="${p.id}"><div class="slide-bg" data-bg="${safeImg(p,0,1400)}"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">${p.tag||p.loc||""}</span><h2 class="slide-title">${p.name}</h2><p class="slide-location">${p.loc||"Tulum"}</p><p class="slide-desc">${p.desc||""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price||"Precio negociable"}</span></div></div><div class="slide-actions"><button type="button" class="cta" data-open="${p.id}">Ver galería (${n})</button><a class="cta gold" href="${waMsg(p)}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(p)}">Email</a></div></div></section>`});
const last=featured.length+1;
h+=`<section class="slide" data-index="${last}" data-final="true"><div class="slide-bg" data-bg="${safeImg(featured[0],1,1400)}"></div><div class="slide-overlay"></div><div class="slide-content" style="max-width:520px"><span class="slide-tag">Contacto</span><h2 class="slide-title">Hablemos de tu próxima propiedad.</h2><p class="slide-desc">WhatsApp, email o Facebook.</p><div class="slide-actions"><a class="cta gold" href="https://wa.me/${WA}?text=${encodeURIComponent("Hola, vi Real Nort")}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(null)}">Email</a><a class="cta" href="${FB}" target="_blank" rel="noopener">Facebook</a></div><form class="contact-form" id="contactForm" novalidate><div class="form-row"><input name="name" placeholder="Tu nombre" required/><input name="phone" placeholder="WhatsApp" required/></div><input name="email" type="email" placeholder="Email"/><select name="channel"><option>WhatsApp</option><option>Email</option></select><textarea name="message" placeholder="Mensaje" rows="2"></textarea><button type="submit" class="form-submit">Enviar</button><p class="form-note">+52 984 323 7592 · ${EMAIL}</p></form><button type="button" class="cta" id="btnAllEnd">Ver todas</button></div></section>`;
gallery.innerHTML=h;setupAfterBuild()}
function setupAfterBuild(){
const slides=()=>Array.from(gallery.querySelectorAll(".slide"));
progressRail.innerHTML="";slides().forEach((_,i)=>{const d=document.createElement("button");d.type="button";d.className="progress-dot"+(i===0?" active":"");d.onclick=()=>slides()[i].scrollIntoView({behavior:"smooth",block:"start"});progressRail.appendChild(d)});
gallery.querySelectorAll(".slide-bg[data-bg]").forEach(el=>new IntersectionObserver((ents)=>{ents.forEach(e=>{if(e.isIntersecting){const u=e.target.getAttribute("data-bg");if(u)lazyBg(e.target,u)}})},{root:gallery,rootMargin:"200% 0px"}).observe(el));
const io=new IntersectionObserver((ents)=>{ents.forEach(en=>{if(!en.isIntersecting||en.intersectionRatio<.5)return;const s=en.target,ix=parseInt(s.dataset.index,10);slides().forEach(x=>x.classList.remove("active"));s.classList.add("active");currentIndex=ix;Array.from(progressRail.children).forEach((d,i)=>d.classList.toggle("active",i===ix))})},{threshold:[.5]});
slides().forEach(s=>io.observe(s));
gallery.addEventListener("wheel",e=>{if(wheelLock){e.preventDefault();return}if(Math.abs(e.deltaY)<12)return;e.preventDefault();const list=slides(),dir=e.deltaY>0?1:-1,n=Math.max(0,Math.min(list.length-1,currentIndex+dir));if(n===currentIndex)return;wheelLock=true;list[n].scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>wheelLock=false,700)},{passive:false});
document.getElementById("logoHome").onclick=e=>{e.preventDefault();gallery.scrollTo({top:0,behavior:"smooth"})};
document.getElementById("btnAll").onclick=()=>openAll();
document.getElementById("allClose").onclick=()=>closeAll();
const bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");
if(bg)bg.onclick=()=>setCatalogView("grid");if(bm)bm.onclick=()=>setCatalogView("map");
const be=document.getElementById("btnEmail");if(be){be.href=emailMsg(null)}
["btnAllIntro","btnAllEnd"].forEach(id=>{const el=document.getElementById(id);if(el)el.onclick=()=>openAll()});
gallery.onclick=e=>{const o=e.target.closest("[data-open]");if(o){const p=findProp(o.getAttribute("data-open"));if(p)openDetail(p)}};
document.getElementById("detailBack").onclick=closeDetail;
document.getElementById("detailClose").onclick=closeDetail;
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(document.getElementById("detail").classList.contains("open"))closeDetail();else if(document.getElementById("allOverlay").classList.contains("open"))closeAll()}if(document.getElementById("detail").classList.contains("open")){if(e.key==="ArrowDown"||e.key==="ArrowRight"){e.preventDefault();detailNav(1)}if(e.key==="ArrowUp"||e.key==="ArrowLeft"){e.preventDefault();detailNav(-1)}}});
const ds=document.getElementById("detailScroll");
if(ds)ds.addEventListener("wheel",e=>{if(!currentDetail)return;if(detailWheelLock){e.preventDefault();return}if(Math.abs(e.deltaY)<12)return;e.preventDefault();detailWheelLock=true;detailNav(e.deltaY>0?1:-1);setTimeout(()=>detailWheelLock=false,650)},{passive:false});
document.addEventListener("submit",e=>{if(e.target.id!=="contactForm")return;e.preventDefault();const f=e.target,name=f.querySelector('[name="name"]'),phone=f.querySelector('[name="phone"]');if(!name.value.trim()||(phone.value||"").replace(/\D/g,"").length<10)return;let t="Hola, soy *"+name.value.trim()+"*\nTel: "+phone.value.trim()+"\n\nConsulta desde web Real Nort";window.open("https://wa.me/"+WA+"?text="+encodeURIComponent(t),"_blank","noopener")});
}
function openDetail(p){
if(!p)return;currentDetail=p;detailIdx=0;
const fromFeat=(featured||[]).find(x=>x.id===p.id);const rich=fromFeat&&fromFeat.images&&fromFeat.images.length?fromFeat:p;
detailImgs=((rich.images&&rich.images.length)?rich.images.slice():[safeImg(p,0,1600)]).map(u=>driveOpt(u,1600));
const slidesEl=document.getElementById("detailSlides"),rail=document.getElementById("detailRail"),info=document.getElementById("detailInfo"),counter=document.getElementById("detailCounter"),scrollEl=document.getElementById("detailScroll");
const n=detailImgs.length;
slidesEl.innerHTML=detailImgs.map((src,i)=>`<div class="detail-slide${i===0?" loaded":""}" data-src="${src}" data-i="${i}"${i===0?` style="background-image:url('${src}')"`:""}></div>`).join("");
rail.innerHTML=detailImgs.map((_,i)=>`<button type="button" class="detail-rail-dot${i===0?" active":""}" data-i="${i}"></button>`).join("");
rail.querySelectorAll(".detail-rail-dot").forEach(d=>d.onclick=()=>goDetail(+d.dataset.i));
const full=fromFeat||p;if(counter)counter.textContent="1 / "+n;
info.innerHTML=`<span class="slide-tag">${full.tag||full.loc||""}${n>1?" · "+n+" fotos":""}</span><h2 class="slide-title" style="font-size:clamp(1.5rem,3.5vw,2.4rem)">${full.name}</h2><p class="slide-location">${full.loc||"Tulum"}</p><p class="slide-desc">${full.desc||""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${full.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${full.price||"Precio negociable"}</span></div></div><div class="slide-actions"><a class="cta gold" href="${waMsg(full)}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(full)}">Email</a><a class="cta" href="${mapsUrl(full)}" target="_blank" rel="noopener">Google Maps</a><a class="cta" href="${FB}" target="_blank" rel="noopener">Facebook</a></div>`;
document.getElementById("detail").classList.add("open");document.body.style.overflow="hidden";if(scrollEl)scrollEl.scrollTop=0;
if(detailIo)detailIo.disconnect();
detailIo=new IntersectionObserver((ents)=>{ents.forEach(en=>{if(!en.isIntersecting||en.intersectionRatio<.45)return;const i=+en.target.dataset.i;if(isNaN(i))return;detailIdx=i;rail.querySelectorAll(".detail-rail-dot").forEach((d,idx)=>d.classList.toggle("active",idx===i));if(counter)counter.textContent=(i+1)+" / "+n;loadDetailImg(i);loadDetailImg(i+1)})},{root:scrollEl,threshold:[.45]});
slidesEl.querySelectorAll(".detail-slide").forEach(s=>detailIo.observe(s));loadDetailImg(0);loadDetailImg(1);metrics.track("detail_view",{id:p.id,photos:n})}
window.openDetail=openDetail;
function loadDetailImg(i){const el=document.querySelectorAll("#detailSlides .detail-slide")[i];if(!el||el.classList.contains("loaded"))return;const src=el.getAttribute("data-src");if(src)lazyBg(el,src)}
function goDetail(i){if(!currentDetail)return;const n=detailImgs.length||1;detailIdx=Math.max(0,Math.min(n-1,i));const slides=document.querySelectorAll("#detailSlides .detail-slide");if(slides[detailIdx])slides[detailIdx].scrollIntoView({behavior:"smooth",block:"start"});loadDetailImg(detailIdx);loadDetailImg(detailIdx+1)}
function detailNav(d){if(currentDetail)goDetail(detailIdx+d)}
function closeDetail(){document.getElementById("detail").classList.remove("open");document.body.style.overflow="";currentDetail=null;if(detailIo){detailIo.disconnect();detailIo=null}}
window.closeDetail=closeDetail;
function setCatalogView(view){window.catalogView=view==="map"?"map":"grid";const grid=document.getElementById("propGrid"),panel=document.getElementById("mapPanel"),bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");if(grid)grid.hidden=window.catalogView==="map";if(panel)panel.hidden=window.catalogView!=="map";if(bg)bg.setAttribute("aria-pressed",window.catalogView==="grid"?"true":"false");if(bm)bm.setAttribute("aria-pressed",window.catalogView==="map"?"true":"false");if(window.catalogView==="map")setTimeout(()=>{initCatalogMap();updateMapMarkers(getFiltered())},60)}
window.setCatalogView=setCatalogView;
function initCatalogMap(){if(typeof L==="undefined")return;const el=document.getElementById("catalogMap");if(!el)return;if(catalogMap){catalogMap.invalidateSize();return}catalogMap=L.map(el,{zoomControl:true,scrollWheelZoom:true}).setView([20.211,-87.455],13);L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{attribution:"© OSM © CARTO",maxZoom:19,subdomains:"abcd"}).addTo(catalogMap);setTimeout(()=>{if(catalogMap)catalogMap.invalidateSize()},120)}
function updateMapMarkers(props){if(!catalogMap||typeof L==="undefined")return;mapMarkers.forEach(m=>catalogMap.removeLayer(m));mapMarkers=[];if(!props||!props.length)return;const bounds=[];props.forEach(p=>{if(p.lat==null||p.lng==null)return;const icon=L.divIcon({className:"rn-marker",html:'<div class="rn-pin"></div>',iconSize:[14,14],iconAnchor:[7,7]});const marker=L.marker([p.lat,p.lng],{icon});const html="<strong>"+(p.name||"")+'</strong><div class="pop-meta">'+(p.loc||"")+" · "+(p.beds||"")+"<br>"+(p.price||"Precio negociable")+'</div><div class="pop-actions"><button type="button" data-map-open="'+p.id+'">Ver</button><a href="'+mapsUrl(p)+'" target="_blank" rel="noopener">Maps</a></div>';marker.bindPopup(html,{maxWidth:260});marker.on("popupopen",function(){const btn=document.querySelector('[data-map-open="'+p.id+'"]');if(btn)btn.onclick=function(){closeAll();openDetail(p)}});marker.addTo(catalogMap);mapMarkers.push(marker);bounds.push([p.lat,p.lng])});if(bounds.length===1)catalogMap.setView(bounds[0],15);else if(bounds.length>1)catalogMap.fitBounds(bounds,{padding:[40,40],maxZoom:15})}
window.updateMapMarkers=updateMapMarkers;
function openAll(){window.filterBeds="all";window.filterRegion="all";window.catalogView="grid";if(typeof window.renderGrid==="function")window.renderGrid();else renderGridFallback();setCatalogView("grid");document.getElementById("allOverlay").classList.add("open");document.body.style.overflow="hidden"}
window.openAll=openAll;
function closeAll(){document.getElementById("allOverlay").classList.remove("open");document.body.style.overflow="";if(window.gridImgObs){window.gridImgObs.disconnect();window.gridImgObs=null}}
window.closeAll=closeAll;
function renderGridFallback(){
const filtered=getFiltered();
const grid=document.getElementById("propGrid");
if(!grid)return;
if(!filtered.length){grid.innerHTML='<div style="grid-column:1/-1;padding:2rem;text-align:center;color:rgba(255,255,255,.4)">Sin resultados</div>';return}
grid.innerHTML=filtered.map(p=>{const ni=(p.images&&p.images.length)||1;const d=(p.desc||"").slice(0,72);return'<article class="card" data-id="'+p.id+'"><div class="card-media"><div class="card-img" data-bg="'+safeImg(p,0,900)+'" data-n="'+ni+'"></div></div><div class="card-body"><p class="card-tag">'+(p.loc||"Tulum")+'</p><h3 class="card-name">'+p.name+'</h3><p class="card-meta">'+(p.beds||"")+(ni>1?' · '+ni+' fotos':'')+'</p>'+(d?'<p class="card-desc">'+d+(p.desc&&p.desc.length>72?'…':'')+'</p>':'')+'<div class="card-foot"><span class="card-price">'+(p.price||"Precio negociable")+'</span><span class="card-cta">Ver</span></div></div></article>'}).join("");
if(window.gridImgObs)window.gridImgObs.disconnect();
window.gridImgObs=new IntersectionObserver((ents)=>{ents.forEach(e=>{if(!e.isIntersecting)return;const el=e.target,u=el.getAttribute("data-bg");if(u)lazyBg(el,u);window.gridImgObs.unobserve(el)})},{root:grid,rootMargin:"400px 0px"});
grid.querySelectorAll(".card-img[data-bg]").forEach(el=>window.gridImgObs.observe(el));
grid.querySelectorAll(".card").forEach(card=>card.onclick=()=>{const p=findProp(card.dataset.id);if(p){closeAll();openDetail(p)}})}
window.renderGrid=renderGridFallback;
function tryBuild(){if(typeof featured!=="undefined"&&featured.length){buildGallery();return true}return false}
if(!tryBuild()){window.__RN_ON_DATA=function(){tryBuild()};setTimeout(function(){if(!tryBuild())buildGallery()},3000)}
})();
