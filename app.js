(async function(){
const WA="529843237592",FB="https://www.facebook.com/alejo.lucatelliperren",EMAIL=(window.RN_EMAIL||"alejolucatelli@gmail.com").trim();

function driveOpt(u,w){
  if(!u)return u;
  w=w||1200;
  if(u.indexOf("lh3.googleusercontent.com/d/")!==-1)
    return u.replace(/=w\d+.*/,"")+"=w"+w;
  return u;
}
function safeImg(p,i,w){
  const u=(p&&p.images&&p.images[Math.min(i||0,(p.images.length||1)-1)])||"";
  return driveOpt(u,w||1200);
}

function lazyBg(el,url,opts){
  if(!el||el.classList.contains("loaded")||el.dataset.loading==="1")return;
  el.dataset.loading="1";
  opts=opts||{};
  const fullW=opts.full||1400;
  const midW=opts.mid||700;
  const tinyW=opts.tiny||300;
  const priority=opts.priority||"auto";

  const isDrive=url&&url.indexOf("lh3.googleusercontent.com/d/")!==-1;
  const full=isDrive?driveOpt(url,fullW):url;
  const mid=isDrive?driveOpt(url,midW):null;
  const tiny=isDrive?driveOpt(url,tinyW):null;

  function load(src,done){
    if(!src){if(done)finish();return;}
    const img=new Image();
    img.decoding="async";
    if(priority==="high")try{img.fetchPriority="high"}catch(e){}
    img.onload=()=>{
      el.style.backgroundImage="url('"+src+"')";
      if(done)finish();
    };
    img.onerror=()=>{if(done)finish();};
    img.src=src;
  }
  function finish(){
    el.classList.add("loaded");
    el.dataset.loading="0";
  }

  if(tiny&&tiny!==full){
    load(tiny,false);
    if(mid&&mid!==full){
      load(mid,false);
      load(full,true);
    }else{
      load(full,true);
    }
  }else{
    load(full,true);
  }
}

let gridImgObs=null;
function ensureGridObs(){
  if(gridImgObs)return gridImgObs;
  gridImgObs=new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(!en.isIntersecting)return;
      const el=en.target;
      const u=el.getAttribute("data-bg");
      if(u){
        lazyBg(el,u,{mid:700,full:900,tiny:300,priority:"low"});
        gridImgObs.unobserve(el);
      }
    });
  },{root:null,rootMargin:"120% 0px",threshold:0.01});
  return gridImgObs;
}

const gallery=document.getElementById("gallery"),progressRail=document.getElementById("progressRail");
let currentIndex=0,wheelLock=false;
window.filterBeds="all";window.filterRegion="all";
let currentDetail=null,detailIdx=0,detailImgs=[],catalogMap=null,mapMarkers=[],detailIo=null,detailWheelLock=false;
window.catalogView="grid";

function findProp(id){return(featured||[]).find(p=>p.id===id)||(allProperties||[]).find(p=>p.id===id)}
window.findProp=findProp;
function getFiltered(){
  let s=(allProperties&&allProperties.length?allProperties:featured||[]).slice();
  if(window.filterBeds!=="all")s=s.filter(p=>p.bedsKey===window.filterBeds);
  if(window.filterRegion!=="all")s=s.filter(p=>p.regionKey===window.filterRegion);
  return s;
}
window.getFiltered=getFiltered;

function buildGallery(){
  if(!window.featured||!featured.length){
    gallery.innerHTML='<section class="slide active"><div class="slide-content" style="padding:4rem 2rem"><h1 class="slide-title">Cargando…</h1></div></section>';
    return;
  }
  const total=(allProperties&&allProperties.length)||featured.length;
  let h=`<section class="slide active" data-index="0"><div class="slide-bg loaded" style="background-image:url('${safeImg(featured[0],0,1100)}')"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">Tulum · Riviera Maya</span><h1 class="slide-title">Todas las propiedades.<br>Una experiencia.</h1><p class="slide-desc">Fotos reales. Filtra por zona y contáctanos por WhatsApp.</p><div class="slide-actions"><button type="button" class="cta gold" id="btnAllIntro">Ver todas (${total})</button><a class="cta" href="${waMsg({name:"Catálogo"})}" target="_blank" rel="noopener">WhatsApp</a></div></div><div class="scroll-hint">Desliza</div></section>`;
  featured.forEach((p,i)=>{
    const n=(p.images&&p.images.length)||1;
    h+=`<section class="slide" data-index="${i+1}" data-id="${p.id}"><div class="slide-bg" data-bg="${safeImg(p,0,1000)}"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">${p.tag||p.loc||""}</span><h2 class="slide-title">${p.name}</h2><p class="slide-location">${p.loc||"Tulum"}</p><p class="slide-desc">${(p.desc||"").slice(0,140)}${(p.desc&&p.desc.length>140)?"…":""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price||"Precio negociable"}</span></div></div><div class="slide-actions"><button type="button" class="cta" data-open="${p.id}">Ver galería (${n})</button><a class="cta gold" href="${waMsg(p)}" target="_blank" rel="noopener">WhatsApp</a></div></div></section>`;
  });
  const last=featured.length+1;
  h+=`<section class="slide" data-index="${last}"><div class="slide-bg" data-bg="${safeImg(featured[0],1,1000)}"></div><div class="slide-overlay"></div><div class="slide-content" style="max-width:480px"><span class="slide-tag">Contacto</span><h2 class="slide-title">Hablemos de tu próxima propiedad.</h2><p class="slide-desc">WhatsApp o email. Respuesta rápida.</p><div class="slide-actions"><a class="cta gold" href="https://wa.me/${WA}?text=${encodeURIComponent("Hola, vi Real Nort")}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(null)}">Email</a><button type="button" class="cta" id="btnAllEnd">Ver todas</button></div></div></section>`;
  gallery.innerHTML=h;
  setupAfterBuild();
}

function setupAfterBuild(){
  const slides=()=>Array.from(gallery.querySelectorAll(".slide"));
  progressRail.innerHTML="";
  slides().forEach((_,i)=>{
    const d=document.createElement("button");
    d.type="button";
    d.className="progress-dot"+(i===0?" active":"");
    d.onclick=()=>slides()[i].scrollIntoView({behavior:"smooth",block:"start"});
    progressRail.appendChild(d);
  });

  gallery.querySelectorAll(".slide-bg[data-bg]").forEach(el=>{
    new IntersectionObserver((ents)=>{
      ents.forEach(e=>{
        if(e.isIntersecting){
          const u=e.target.getAttribute("data-bg");
          if(u)lazyBg(e.target,u,{mid:800,full:1200,tiny:350,priority:"high"});
        }
      });
    },{root:gallery,rootMargin:"220% 0px",threshold:0}).observe(el);
  });

  const io=new IntersectionObserver((ents)=>{
    ents.forEach(en=>{
      if(!en.isIntersecting||en.intersectionRatio<.5)return;
      const s=en.target,ix=+s.dataset.index;
      slides().forEach(x=>x.classList.remove("active"));
      s.classList.add("active");
      currentIndex=ix;
      Array.from(progressRail.children).forEach((d,i)=>d.classList.toggle("active",i===ix));
    });
  },{threshold:[.5]});
  slides().forEach(s=>io.observe(s));

  gallery.addEventListener("wheel",e=>{
    if(wheelLock){e.preventDefault();return}
    if(Math.abs(e.deltaY)<12)return;
    e.preventDefault();
    const list=slides(),dir=e.deltaY>0?1:-1,n=Math.max(0,Math.min(list.length-1,currentIndex+dir));
    if(n===currentIndex)return;
    wheelLock=true;
    list[n].scrollIntoView({behavior:"smooth",block:"start"});
    setTimeout(()=>wheelLock=false,700);
  },{passive:false});

  document.getElementById("logoHome").onclick=e=>{e.preventDefault();gallery.scrollTo({top:0,behavior:"smooth"})};
  document.getElementById("btnAll").onclick=()=>window.openAll();
  document.getElementById("allClose").onclick=()=>window.closeAll();
  const bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");
  if(bg)bg.onclick=()=>setCatalogView("grid");
  if(bm)bm.onclick=()=>setCatalogView("map");
  ["btnAllIntro","btnAllEnd"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.onclick=()=>window.openAll();
  });
  gallery.onclick=e=>{
    const o=e.target.closest("[data-open]");
    if(o){const p=findProp(o.getAttribute("data-open"));if(p)openDetail(p)}
  };
  document.getElementById("detailBack").onclick=closeDetail;
  document.getElementById("detailClose").onclick=closeDetail;
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){
      if(document.getElementById("detail").classList.contains("open"))closeDetail();
      else if(document.getElementById("allOverlay").classList.contains("open"))window.closeAll();
    }
  });
}

function openDetail(p){
  currentDetail=p;
  detailIdx=0;
  const rich=p;
  detailImgs=((rich.images&&rich.images.length)?rich.images.slice():[safeImg(p,0,1400)]).map(u=>driveOpt(u,1400));
  const n=detailImgs.length;
  const slidesEl=document.getElementById("detailSlides");
  const rail=document.getElementById("detailRail");
  const counter=document.getElementById("detailCounter");
  const info=document.getElementById("detailInfo");
  const scrollEl=document.getElementById("detailScroll");

  slidesEl.innerHTML=detailImgs.map((src,i)=>`<div class="detail-slide${i===0?" loaded":""}" data-src="${src}" data-i="${i}"${i===0?` style="background-image:url('${driveOpt(src,900)}')"`:""}></div>`).join("");
  rail.innerHTML=detailImgs.map((_,i)=>`<button type="button" class="detail-rail-dot${i===0?" active":""}" data-i="${i}"></button>`).join("");
  if(counter)counter.textContent="1 / "+n;

  info.innerHTML=`<span class="slide-tag">${p.tag||p.loc||""}${n>1?" · "+n+" fotos":""}</span><h2 class="slide-title" style="font-size:clamp(1.5rem,3.5vw,2.2rem)">${p.name}</h2><p class="slide-location">${p.loc||"Tulum"}</p><p class="slide-desc">${p.desc||""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price||"Precio negociable"}</span></div></div><div class="slide-actions"><a class="cta gold" href="${waMsg(p)}" target="_blank" rel="noopener">WhatsApp</a><a class="cta" href="${emailMsg(p)}">Email</a><a class="cta" href="${mapsUrl(p)}" target="_blank" rel="noopener">Maps</a></div>`;

  document.getElementById("detail").classList.add("open");
  document.body.style.overflow="hidden";
  scrollEl.scrollTop=0;

  if(detailIo)detailIo.disconnect();
  detailIo=new IntersectionObserver((ents)=>{
    ents.forEach(en=>{
      if(!en.isIntersecting||en.intersectionRatio<.4)return;
      const i=+en.target.dataset.i;
      if(isNaN(i))return;
      detailIdx=i;
      rail.querySelectorAll(".detail-rail-dot").forEach((d,idx)=>d.classList.toggle("active",idx===i));
      if(counter)counter.textContent=(i+1)+" / "+n;
      loadDetailImg(i,"high");
      loadDetailImg(i+1,"auto");
      loadDetailImg(i+2,"low");
      if(i>0)loadDetailImg(i-1,"low");
    });
  },{root:scrollEl,threshold:[.4]});
  slidesEl.querySelectorAll(".detail-slide").forEach(s=>detailIo.observe(s));
  loadDetailImg(0,"high");
  loadDetailImg(1,"auto");
}
window.openDetail=openDetail;

function loadDetailImg(i,prio){
  const el=document.querySelectorAll("#detailSlides .detail-slide")[i];
  if(!el||el.classList.contains("loaded")||el.dataset.loading==="1")return;
  const src=el.getAttribute("data-src");
  if(src)lazyBg(el,src,{mid:900,full:1400,tiny:400,priority:prio||"auto"});
}

function closeDetail(){
  document.getElementById("detail").classList.remove("open");
  document.body.style.overflow="";
  currentDetail=null;
  if(detailIo){detailIo.disconnect();detailIo=null}
}

function setCatalogView(v){
  window.catalogView=v;
  const grid=document.getElementById("propGrid");
  const mapP=document.getElementById("mapPanel");
  const bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");
  if(v==="map"){
    if(grid)grid.hidden=true;
    if(mapP)mapP.hidden=false;
    if(bg)bg.setAttribute("aria-pressed","false");
    if(bm)bm.setAttribute("aria-pressed","true");
    setTimeout(()=>{initCatalogMap();updateMapMarkers(getFiltered())},60);
  }else{
    if(grid){grid.hidden=false;grid.style.display="grid"}
    if(mapP)mapP.hidden=true;
    if(bg)bg.setAttribute("aria-pressed","true");
    if(bm)bm.setAttribute("aria-pressed","false");
  }
}

function initCatalogMap(){
  if(typeof L==="undefined")return;
  const el=document.getElementById("catalogMap");
  if(!el)return;
  if(catalogMap){catalogMap.invalidateSize();return}
  catalogMap=L.map(el,{zoomControl:true,scrollWheelZoom:true}).setView([20.211,-87.455],13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{attribution:"© OSM © CARTO",maxZoom:19,subdomains:"abcd"}).addTo(catalogMap);
  setTimeout(()=>{if(catalogMap)catalogMap.invalidateSize()},120);
}
function updateMapMarkers(props){
  if(!catalogMap||typeof L==="undefined")return;
  mapMarkers.forEach(m=>catalogMap.removeLayer(m));
  mapMarkers=[];
  if(!props||!props.length)return;
  const bounds=[];
  props.forEach(p=>{
    if(p.lat==null||p.lng==null)return;
    const icon=L.divIcon({className:"rn-marker",html:'<div class="rn-pin"></div>',iconSize:[14,14],iconAnchor:[7,7]});
    const marker=L.marker([p.lat,p.lng],{icon});
    const html="<strong>"+(p.name||"")+'</strong><div class="pop-meta">'+(p.loc||"")+" · "+(p.beds||"")+"<br>"+(p.price||"Precio negociable")+'</div><div class="pop-actions"><button type="button" data-map-open="'+p.id+'">Ver</button><a href="'+mapsUrl(p)+'" target="_blank" rel="noopener">Maps</a></div>';
    marker.bindPopup(html,{maxWidth:260});
    marker.on("popupopen",function(){
      const btn=document.querySelector('[data-map-open="'+p.id+'"]');
      if(btn)btn.onclick=function(){closeAll();openDetail(p)};
    });
    marker.addTo(catalogMap);
    mapMarkers.push(marker);
    bounds.push([p.lat,p.lng]);
  });
  if(bounds.length===1)catalogMap.setView(bounds[0],15);
  else if(bounds.length>1)catalogMap.fitBounds(bounds,{padding:[40,40],maxZoom:15});
}

function openAll(){
  window.filterBeds="all";window.filterRegion="all";window.catalogView="grid";
  renderGridFallback();
  setCatalogView("grid");
  document.getElementById("allOverlay").classList.add("open");
  document.body.classList.add("catalog-open");
  document.body.style.overflow="hidden";
}
window.openAll=openAll;

function closeAll(){
  document.getElementById("allOverlay").classList.remove("open");
  document.body.classList.remove("catalog-open");
  document.body.style.overflow="";
  if(gridImgObs){gridImgObs.disconnect();gridImgObs=null}
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
  if(!filtered.length){
    grid.innerHTML='<div style="grid-column:1/-1;padding:4rem 1rem;text-align:center;color:rgba(255,255,255,.45)">Sin resultados</div>';
    return;
  }

  var html="";
  for(var i=0;i<filtered.length;i++){
    var p=filtered[i];
    var ni=(p.images&&p.images.length)||1;
    var src=(p.images&&p.images[0])||"";
    if(src.indexOf("lh3.googleusercontent.com/d/")!==-1)src=src.replace(/=w\d+.*/,"");
    var name=(p.name||"").replace(/</g,"");
    var loc=(p.loc||"Tulum").replace(/</g,"");
    var bedsTxt=(p.beds||"").replace(/</g,"");
    var price=(p.price||"Precio negociable").replace(/</g,"");
    html+='<article class="card" data-id="'+p.id+'">';
    html+='<div class="card-photo" data-bg="'+src+'"><span class="card-badge">'+ni+' fotos</span></div>';
    html+='<div class="card-info"><p class="card-loc">'+loc+'</p><h3 class="card-title">'+name+'</h3>';
    html+='<p class="card-sub">'+bedsTxt+(ni>1?" · "+ni+" fotos":"")+'</p>';
    html+='<div class="card-bottom"><span class="card-price">'+price+'</span><span class="card-link">Ver</span></div></div></article>';
  }
  grid.innerHTML=html;

  const obs=ensureGridObs();
  grid.querySelectorAll(".card-photo[data-bg]").forEach(el=>obs.observe(el));

  grid.querySelectorAll(".card").forEach(function(card){
    card.onclick=function(){
      var id=card.getAttribute("data-id");
      var p=findProp(id);
      if(p){closeAll();openDetail(p)}
    };
  });
  if(window.catalogView==="map")updateMapMarkers(filtered);
}
window.renderGrid=renderGridFallback;

function tryBuild(){
  if(typeof featured!=="undefined"&&featured.length){buildGallery();return true}
  return false;
}
if(!tryBuild()){
  window.__RN_ON_DATA=function(){tryBuild()};
  setTimeout(function(){if(!tryBuild())buildGallery()},3000);
}
})();
