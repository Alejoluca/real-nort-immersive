(function(){

/* ——— NORT OS metrics + status (local phase) ——— */
window.NORT_OS = window.NORT_OS || {
  track: function (type, propertyId, meta) {
    try {
      var key = "nort_os_events_v1";
      var list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push({
        id: "ev_" + Math.random().toString(36).slice(2, 9),
        type: type,
        propertyId: propertyId || null,
        ts: Date.now(),
        meta: meta || {},
        source: "public"
      });
      if (list.length > 5000) list = list.slice(-5000);
      localStorage.setItem(key, JSON.stringify(list));
      // threshold mail queue for owners
      if (propertyId && (type === "card_click" || type === "detail_view")) {
        var st = JSON.parse(localStorage.getItem("nort_os_v1") || "{}");
        var props = (st && st.props) || {};
        var metaP = props[propertyId];
        if (metaP && metaP.ownerId) {
          var clicks = list.filter(function (e) {
            return e.propertyId === propertyId && (e.type === "card_click" || e.type === "detail_view");
          }).length;
          if (clicks > 0 && clicks % 10 === 0) {
            var q = JSON.parse(localStorage.getItem("nort_os_mail_queue") || "[]");
            q.push({ ts: Date.now(), kind: "threshold_10", propertyId: propertyId });
            localStorage.setItem("nort_os_mail_queue", JSON.stringify(q.slice(-200)));
          }
        }
      }
    } catch (e) {}
  },
  isPublished: function (propertyId) {
    try {
      var st = JSON.parse(localStorage.getItem("nort_os_v1") || "null");
      if (!st || !st.props || !st.props[propertyId]) return true;
      var s = st.props[propertyId].status || "published";
      return s === "published" || s === "reserved";
    } catch (e) { return true; }
  }
};
"use strict";
const WA="529843237592";
const EMAIL=(window.RN_EMAIL||"alejolucatelli@gmail.com").trim();

function waMsg(p){
  let t="Hola, vi *Real Nort México* y me interesa:\n\n*"+(p&&p.name||"Propiedad")+"*\n";
  if(p&&p.loc)t+="📍 "+p.loc+"\n";
  if(p&&p.price)t+="💰 "+p.price+"\n";
  return "https://wa.me/"+WA+"?text="+encodeURIComponent(t+"\n¿Más info?");
}
function emailMsg(p){
  return "mailto:"+EMAIL+"?subject="+encodeURIComponent("Consulta Real Nort")+
    "&body="+encodeURIComponent("Hola, me interesa "+(p&&p.name||"propiedades en Tulum"));
}
function mapsUrl(p){
  return p&&p.maps||("https://www.google.com/maps/search/?api=1&query="+
    encodeURIComponent((p&&p.name||"")+", Tulum Mexico"));
}

/* Drive size helper — always produces =wN */
function driveOpt(u,w){
  if(!u)return u;
  w=w||1200;
  if(w>1600)w=1600;
  if(w<120)w=120;
  if(u.indexOf("lh3.googleusercontent.com/d/")!==-1)
    return u.replace(/=w\d+.*/,"")+"=w"+w;
  return u;
}

/* Cover: prefer index 1 when there are 4+ fotos (evita baños/detalles de portada) */
function coverIdx(p){
  var n=(p&&p.images&&p.images.length)||0;
  if(n>=4)return 1;
  return 0;
}
function coverImg(p,w){
  return safeImg(p, coverIdx(p), w||900);
}

function imgSrc(p, idx, w){
  var u=(p&&p.images&&p.images[Math.min(idx||0, Math.max(0,(p.images.length||1)-1))])||"";
  return u?driveOpt(u,w):"";
}
function coverSrcSet(p){
  var u=(p&&p.images&&p.images[coverIdx(p)])||(p&&p.images&&p.images[0])||"";
  if(!u)return {src:"", srcset:"", sizes:""};
  var s120=driveOpt(u,120), s480=driveOpt(u,480), s640=driveOpt(u,640), s960=driveOpt(u,960);
  return {
    src:s640,
    srcset:s120+" 120w, "+s480+" 480w, "+s640+" 640w, "+s960+" 960w",
    sizes:"(max-width:600px) 50vw, (max-width:900px) 33vw, 25vw"
  };
}
function mapCardSrcSet(p){
  var u=(p&&p.images&&p.images[coverIdx(p)])||(p&&p.images&&p.images[0])||"";
  if(!u)return {src:"", srcset:"", sizes:""};
  var s240=driveOpt(u,240), s480=driveOpt(u,480), s720=driveOpt(u,720);
  return {
    src:s480,
    srcset:s240+" 240w, "+s480+" 480w, "+s720+" 720w",
    sizes:"(max-width:899px) 78vw, 340px"
  };
}
function prefetchImg(url){
  if(!url)return;
  try{ var img=new Image(); img.decoding="async"; img.src=url; }catch(e){}
}



function safeImg(p,i,w){
  const imgs=p&&p.images;
  if(!imgs||!imgs.length)return "";
  return driveOpt(imgs[Math.min(i||0,imgs.length-1)],w||1200);
}

/* Fast progressive BG: skip tiny on fast connections, sequential mid→full */
function lazyBg(el,url,opts){
  if(!el||!url)return;
  if(el.classList.contains("loaded")&&el.dataset.fullUrl===url)return;
  opts=opts||{};
  var fullW=opts.full||1200;
  var midW=opts.mid||700;
  var priority=opts.priority||"auto";
  var isDrive=url.indexOf("lh3.googleusercontent.com/d/")!==-1;
  var full=isDrive?driveOpt(url,fullW):url;
  var mid=isDrive?driveOpt(url,midW):null;
  var gen=String((+el.dataset.gen||0)+1);
  el.dataset.gen=gen;
  el.dataset.loading="1";

  function apply(src,isFinal){
    if(el.dataset.gen!==gen)return;
    el.style.backgroundImage="url('"+src+"')";
    if(isFinal){
      el.classList.add("loaded");
      el.dataset.loading="0";
      el.dataset.fullUrl=url;
    }
  }
  function load(src,isFinal){
    var img=new Image();
    img.decoding="async";
    if(priority==="high")try{img.fetchPriority="high"}catch(e){}
    img.onload=function(){apply(src,isFinal)};
    img.onerror=function(){
      if(isFinal){el.classList.add("loaded");el.dataset.loading="0"}
      else if(full)load(full,true);
    };
    img.src=src;
  }
  if(mid&&mid!==full){
    load(mid,false);
    load(full,true);
  }else{
    load(full,true);
  }
}

/* Grid observer — large rootMargin for prefetch */
let gridImgObs=null;
function hasIO(){return typeof IntersectionObserver!=="undefined"}
function ensureGridObs(){
  if(gridImgObs)return gridImgObs;
  if(!hasIO()){
    gridImgObs={observe:function(el){
      const u=el.getAttribute("data-bg");
      if(u)lazyBg(el,u,{mid:480,full:800,priority:"low"});
    },unobserve:function(){},disconnect:function(){}};
    return gridImgObs;
  }
  gridImgObs=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting)return;
      const el=en.target;
      const u=el.getAttribute("data-bg");
      if(u){
        lazyBg(el,u,{mid:480,full:800,priority:"low"});
        gridImgObs.unobserve(el);
      }
    });
  },{root:null,rootMargin:"200% 0px",threshold:0.01});
  return gridImgObs;
}

const gallery=document.getElementById("gallery");
const progressRail=document.getElementById("progressRail");
let currentIndex=0,wheelLock=false;
window.filterBeds="all";
window.filterRegion="all";
window.catalogView="grid";
let currentDetail=null,detailIdx=0,detailImgs=[],catalogMap=null,mapMarkers=[],detailIo=null;

function findProp(id){
  return (featured||[]).find(function(p){return p.id===id})||
         (allProperties||[]).find(function(p){return p.id===id});
}
window.findProp=findProp;

function getFiltered(){
  let s=(allProperties&&allProperties.length?allProperties:featured||[]).slice();
  // NORT OS availability
  if(window.NORT_OS&&window.NORT_OS.isPublished){
    s=s.filter(function(p){return window.NORT_OS.isPublished(p.id)});
  }
  if(window.filterBeds&&window.filterBeds!=="all"){
    s=s.filter(function(p){
      var k=p.bedsKey||"";
      if(window.filterBeds==="4plus"){
        if(k==="4"||k==="4plus"||k==="other")return true;
        var m=String(p.beds||"").match(/(\d+)/);
        return m && parseInt(m[1],10)>=4;
      }
      return k===window.filterBeds;
    });
  }
  if(window.filterRegion&&window.filterRegion!=="all"){
    s=s.filter(function(p){return p.regionKey===window.filterRegion});
  }
  return s;
}
window.getFiltered=getFiltered;

function esc(s){return String(s||"").replace(/</g,"").replace(/"/g,"&quot;")}

function buildGallery(){
  if(!gallery)return;
  if(!window.featured||!featured.length){
    gallery.innerHTML='<section class="slide active"><div class="slide-content" style="padding:4rem 2rem"><h1 class="slide-title">Cargando catálogo…</h1></div></section>';
    return;
  }
  /* Carrusel inicial aleatorio cada visita */
  var carousel=featured.slice();
  for(var si=carousel.length-1;si>0;si--){
    var sj=Math.floor(Math.random()*(si+1));
    var tmp=carousel[si];carousel[si]=carousel[sj];carousel[sj]=tmp;
  }
  if(carousel.length>4)carousel=carousel.slice(0,4);
  const total=(allProperties&&allProperties.length)||featured.length;
  const hero=coverImg(carousel[0],1000);
  let h='<section class="slide active" data-index="0">'+
    '<div class="slide-bg loaded" style="background-image:url(\''+hero+'\')"></div>'+
    '<div class="slide-overlay"></div>'+
    '<div class="slide-content">'+
    '<span class="slide-tag">Tulum · Riviera Maya</span>'+
    '<h1 class="slide-title">Todas las propiedades.<br>Una experiencia.</h1>'+
    '<p class="slide-desc">Fotos reales del inventario. Filtra por zona y escribe por WhatsApp.</p>'+
    '<div class="slide-actions">'+
    '<button type="button" class="cta gold" id="btnAllIntro">Ver todas ('+total+')</button>'+
    '<a class="cta" href="'+waMsg({name:"Catálogo"})+'" target="_blank" rel="noopener">WhatsApp</a>'+
    '</div></div><div class="scroll-hint">Desliza</div></section>';

  carousel.forEach(function(p,i){
    const n=(p.images&&p.images.length)||1;
    h+='<section class="slide" data-index="'+(i+1)+'" data-id="'+p.id+'">'+
      '<div class="slide-bg" data-bg="'+coverImg(p,1000)+'"></div>'+
      '<div class="slide-overlay"></div>'+
      '<div class="slide-content">'+
      '<span class="slide-tag">'+esc(p.tag||p.loc||"")+'</span>'+
      '<h2 class="slide-title">'+esc(p.name)+'</h2>'+
      '<p class="slide-location">'+esc(p.loc||"Tulum")+'</p>'+
      '<p class="slide-desc">'+esc((p.desc||"").slice(0,140))+'</p>'+
      '<div class="slide-meta">'+
      '<div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">'+esc(p.beds||"—")+'</span></div>'+
      '<div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">'+esc(p.price||"Precio negociable")+'</span></div>'+
      '</div>'+
      '<div class="slide-actions">'+
      '<button type="button" class="cta" data-open="'+p.id+'">Ver galería ('+n+')</button>'+
      '<a class="cta gold" href="'+waMsg(p)+'" target="_blank" rel="noopener">WhatsApp</a>'+
      '</div></div></section>';
  });

  const last=featured.length+1;
  h+='<section class="slide" data-index="'+last+'">'+
    '<div class="slide-bg" data-bg="'+safeImg(carousel[0],1,1000)+'"></div>'+
    '<div class="slide-overlay"></div>'+
    '<div class="slide-content" style="max-width:480px">'+
    '<span class="slide-tag">Contacto</span>'+
    '<h2 class="slide-title">Hablemos de tu próxima propiedad.</h2>'+
    '<p class="slide-desc">WhatsApp o email. Respuesta rápida.</p>'+
    '<div class="slide-actions">'+
    '<a class="cta gold" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Hola, vi Real Nort")+'" target="_blank" rel="noopener">WhatsApp</a>'+
    '<a class="cta" href="'+emailMsg(null)+'">Email</a>'+
    '<button type="button" class="cta" id="btnAllEnd">Ver todas</button>'+
    '</div></div></section>';

  gallery.innerHTML=h;
  setupAfterBuild();
}

var __rnSetupDone=false;
function setupAfterBuild(){
  const slides=function(){return Array.from(gallery.querySelectorAll(".slide"))};
  progressRail.innerHTML="";
  slides().forEach(function(_,i){
    const d=document.createElement("button");
    d.type="button";
    d.className="progress-dot"+(i===0?" active":"");
    d.setAttribute("aria-label","Sección "+(i+1));
    d.onclick=function(){slides()[i].scrollIntoView({behavior:"smooth",block:"start"})};
    progressRail.appendChild(d);
  });

  if(__rnSetupDone)return;
  __rnSetupDone=true;

  /* Prefetch slide backgrounds early */
  gallery.querySelectorAll(".slide-bg[data-bg]").forEach(function(el){
    new IntersectionObserver(function(ents){
      ents.forEach(function(e){
        if(e.isIntersecting){
          const u=e.target.getAttribute("data-bg");
          if(u)lazyBg(e.target,u,{mid:700,full:1200,priority:"high"});
        }
      });
    },{root:gallery,rootMargin:"180% 0px",threshold:0}).observe(el);
  });

  const io=new IntersectionObserver(function(ents){
    ents.forEach(function(en){
      if(!en.isIntersecting||en.intersectionRatio<.45)return;
      const s=en.target,ix=+s.dataset.index;
      slides().forEach(function(x){x.classList.remove("active")});
      s.classList.add("active");
      currentIndex=ix;
      Array.from(progressRail.children).forEach(function(d,i){d.classList.toggle("active",i===ix)});
    });
  },{threshold:[.45]});
  slides().forEach(function(s){io.observe(s)});

  /* Wheel snap only on desktop; touch/stylus use native scroll */
  var finePointer=true;
  try{finePointer=window.matchMedia("(hover:hover) and (pointer:fine)").matches}catch(e){}
  if(finePointer){
    gallery.addEventListener("wheel",function(e){
      if(wheelLock){e.preventDefault();return}
      if(Math.abs(e.deltaY)<10)return;
      e.preventDefault();
      const list=slides(),dir=e.deltaY>0?1:-1;
      const n=Math.max(0,Math.min(list.length-1,currentIndex+dir));
      if(n===currentIndex)return;
      wheelLock=true;
      list[n].scrollIntoView({behavior:"smooth",block:"start"});
      setTimeout(function(){wheelLock=false},550);
    },{passive:false});
  }

  document.getElementById("logoHome").onclick=function(e){
    e.preventDefault();gallery.scrollTo({top:0,behavior:"smooth"});
  };
  document.getElementById("btnAll").onclick=function(){openAll()};
  document.getElementById("allClose").onclick=function(){closeAll()};
  const bg=document.getElementById("btnViewGrid"),bm=document.getElementById("btnViewMap");
  if(bg)bg.onclick=function(){setCatalogView("grid")};
  if(bm)bm.onclick=function(){setCatalogView("map")};
  ["btnAllIntro","btnAllEnd"].forEach(function(id){
    const el=document.getElementById(id);
    if(el)el.onclick=function(){openAll()};
  });
  gallery.onclick=function(e){
    const o=e.target.closest("[data-open]");
    if(o){const p=findProp(o.getAttribute("data-open"));if(p)openDetail(p)}
  };
  document.getElementById("detailBack").onclick=closeDetail;
  document.getElementById("detailClose").onclick=closeDetail;
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){
      if(document.getElementById("detail").classList.contains("open"))closeDetail();
      else if(document.getElementById("allOverlay").classList.contains("open"))closeAll();
    }
  });
}


var __rnCtx={view:"grid", overlay:false};
function saveNavCtx(){
  __rnCtx={
    view: window.catalogView||"grid",
    overlay: !!(document.getElementById("allOverlay")&&document.getElementById("allOverlay").classList.contains("open")),
    beds: window.filterBeds||"all",
    region: window.filterRegion||"all"
  };
}
function restoreNavCtx(){
  if(!__rnCtx||!__rnCtx.overlay){
    document.body.style.overflow="";
    return;
  }
  window.filterBeds=__rnCtx.beds||"all";
  window.filterRegion=__rnCtx.region||"all";
  window.catalogView=__rnCtx.view||"grid";
  var ov=document.getElementById("allOverlay");
  if(ov){
    ov.classList.add("open");
    ov.style.setProperty("display","flex","important");
    document.body.classList.add("catalog-open");
    document.body.style.overflow="hidden";
  }
  renderGrid();
  setCatalogView(__rnCtx.view||"grid");
  // keep ctx for repeated back navigation within catalog
}

function openDetail(p){
  var ovOpen=document.getElementById("allOverlay");
  if(ovOpen&&ovOpen.classList.contains("open")){
    saveNavCtx();
    __rnCtx.overlay=true;
  }
  currentDetail=p;
  try{window.NORT_OS&&window.NORT_OS.track("detail_view",p.id,{name:p.name})}catch(e){}
  detailIdx=0;
  detailImgs=((p.images&&p.images.length)?p.images.slice():[]).map(function(u){return driveOpt(u,1400)});
  if(!detailImgs.length)detailImgs=[safeImg(p,0,1400)];
  const n=detailImgs.length;
  const slidesEl=document.getElementById("detailSlides");
  const rail=document.getElementById("detailRail");
  const counter=document.getElementById("detailCounter");
  const info=document.getElementById("detailInfo");
  const scrollEl=document.getElementById("detailScroll");

  slidesEl.innerHTML=detailImgs.map(function(src,i){
    return '<div class="detail-slide'+(i===0?" loaded":"")+'" data-src="'+src+'" data-i="'+i+'"'+
      (i===0?' style="background-image:url(\''+src+'\')"':'')+'></div>';
  }).join("");
  rail.innerHTML=detailImgs.map(function(_,i){
    return '<button type="button" class="detail-rail-dot'+(i===0?" active":"")+'" data-i="'+i+'" aria-label="Foto '+(i+1)+'"></button>';
  }).join("");
  if(counter)counter.textContent="1 / "+n;

  info.innerHTML=
    '<span class="slide-tag">'+esc(p.tag||p.loc||"")+(n>1?" · "+n+" fotos":"")+'</span>'+
    '<h2 class="slide-title" style="font-size:clamp(1.5rem,3.5vw,2.2rem)">'+esc(p.name)+'</h2>'+
    '<p class="slide-location">'+esc(p.loc||"Tulum")+'</p>'+
    '<p class="slide-desc">'+esc(p.desc||"")+'</p>'+
    '<div class="slide-meta">'+
    '<div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">'+esc(p.beds||"—")+'</span></div>'+
    '<div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">'+esc(p.price||"Precio negociable")+'</span></div>'+
    '</div>'+
    '<div class="slide-actions">'+
    '<a class="cta gold" href="'+waMsg(p)+'" target="_blank" rel="noopener">WhatsApp</a>'+
    '<a class="cta" href="'+emailMsg(p)+'">Email</a>'+
    '<a class="cta" href="'+mapsUrl(p)+'" target="_blank" rel="noopener">Maps</a>'+
    '</div>';

  var det=document.getElementById("detail");
  det.classList.add("open");
  det.style.setProperty("display","flex","important");
  document.body.style.overflow="hidden";
  scrollEl.scrollTop=0;

  if(detailIo)detailIo.disconnect();
  detailIo=new IntersectionObserver(function(ents){
    ents.forEach(function(en){
      if(!en.isIntersecting||en.intersectionRatio<.35)return;
      const i=+en.target.dataset.i;
      if(isNaN(i))return;
      detailIdx=i;
      rail.querySelectorAll(".detail-rail-dot").forEach(function(d,idx){d.classList.toggle("active",idx===i)});
      if(counter)counter.textContent=(i+1)+" / "+n;
      loadDetailImg(i,"high");
      loadDetailImg(i+1,"auto");
      loadDetailImg(i+2,"low");
      if(i>0)loadDetailImg(i-1,"low");
    });
  },{root:scrollEl,threshold:[.35]});
  slidesEl.querySelectorAll(".detail-slide").forEach(function(s){detailIo.observe(s)});
  loadDetailImg(0,"high");
  loadDetailImg(1,"auto");

  rail.onclick=function(e){
    const b=e.target.closest("[data-i]");
    if(!b)return;
    const i=+b.getAttribute("data-i");
    const el=slidesEl.querySelectorAll(".detail-slide")[i];
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
  };
}
window.openDetail=openDetail;

function loadDetailImg(i,prio){
  const el=document.querySelectorAll("#detailSlides .detail-slide")[i];
  if(!el||el.classList.contains("loaded")||el.dataset.loading==="1")return;
  const src=el.getAttribute("data-src");
  if(src)lazyBg(el,src,{mid:900,full:1400,priority:prio||"auto"});
}

function closeDetail(){
  var det=document.getElementById("detail");
  if(det){det.classList.remove("open");det.style.setProperty("display","none","important")}
  currentDetail=null;
  if(detailIo){try{detailIo.disconnect()}catch(e){} detailIo=null}
  if(__rnCtx&&__rnCtx.overlay){
    restoreNavCtx();
  }else{
    document.body.style.overflow="";
  }
}

function openAll(){
  try{
    window.filterBeds="all";
    window.filterRegion="all";
    window.catalogView="grid";
    try{closeMapSheet()}catch(e){}
    var ov=document.getElementById("allOverlay");
    if(!ov){console.error("allOverlay missing");return}
    ov.classList.add("open");
    ov.style.setProperty("display","flex","important");
    document.body.classList.add("catalog-open");
    document.body.style.overflow="hidden";
    renderGrid();
    setCatalogView("grid");
  }catch(err){
    console.error("openAll",err);
    var ov=document.getElementById("allOverlay");
    if(ov){ov.classList.add("open");ov.style.setProperty("display","flex","important")}
  }
}
window.openAll=openAll;

function closeAll(){
  var ov=document.getElementById("allOverlay");
  if(ov){ov.classList.remove("open");ov.style.setProperty("display","none","important")}
  document.body.classList.remove("catalog-open");
  document.body.style.overflow="";
  if(gridImgObs){try{gridImgObs.disconnect()}catch(e){} gridImgObs=null}
  try{closeMapSheet()}catch(e){}
  window.catalogView="grid";
}
window.closeAll=closeAll;

function setCatalogView(v){
  window.catalogView=v;
  const grid=document.getElementById("propGrid");
  const map=document.getElementById("mapPanel");
  const bg=document.getElementById("btnViewGrid");
  const bm=document.getElementById("btnViewMap");
  if(v==="map"){
    if(grid){
      grid.hidden=true;
      grid.setAttribute("hidden","");
      grid.style.setProperty("display","none","important");
    }
    if(map){
      map.hidden=false;
      map.removeAttribute("hidden");
      map.style.setProperty("display","flex","important");
    }
    if(bg)bg.setAttribute("aria-pressed","false");
    if(bm)bm.setAttribute("aria-pressed","true");
    // Leaflet needs layout after becoming visible
    requestAnimationFrame(function(){
      var rail=document.getElementById("mapRail");
      if(rail){rail.style.zIndex="20";rail.style.pointerEvents="auto";}
      var cmap=document.getElementById("catalogMap");
      if(cmap){cmap.style.zIndex="1";}
      ensureMap();
      updateMapMarkers(getFiltered());
      setTimeout(function(){
        if(catalogMap){try{catalogMap.invalidateSize(true)}catch(e){}}
        updateMapMarkers(getFiltered());
      },200);
    });
  }else{
    if(map){
      map.hidden=true;
      map.setAttribute("hidden","");
      map.style.setProperty("display","none","important");
    }
    if(grid){
      grid.hidden=false;
      grid.removeAttribute("hidden");
      grid.style.setProperty("display","grid","important");
    }
    if(bg)bg.setAttribute("aria-pressed","true");
    if(bm)bm.setAttribute("aria-pressed","false");
    closeMapSheet();
  }
}

function renderGrid(){
  const beds=[
    {key:"all",label:"Todas"},{key:"studio",label:"Estudios"},
    {key:"1",label:"1 Rec"},{key:"2",label:"2 Rec"},{key:"3",label:"3 Rec"},{key:"4plus",label:"4+ Rec"}
  ];
  const regions=[
    {key:"all",label:"Zonas"},{key:"aldea-zama",label:"Aldea Zama"},
    {key:"la-veleta",label:"La Veleta"},{key:"amira",label:"Amira"},
    {key:"holistika",label:"Holistika"},{key:"tulum",label:"Tulum"}
  ];
  const filtered=getFiltered();
  const fb=document.getElementById("filterBar");
  if(fb){
    fb.innerHTML=
      '<div class="filter-row"><span class="filter-label">Tipo</span>'+
      beds.map(function(f){
        return '<button type="button" class="filter-btn'+(window.filterBeds===f.key?" active":"")+'" data-beds="'+f.key+'">'+f.label+"</button>";
      }).join("")+
      '</div><div class="filter-row"><span class="filter-label">Zona</span>'+
      regions.map(function(f){
        return '<button type="button" class="filter-btn'+(window.filterRegion===f.key?" active":"")+'" data-region="'+f.key+'">'+f.label+"</button>";
      }).join("")+
      '<span class="filter-count">'+filtered.length+(filtered.length===1?" propiedad":" propiedades")+"</span></div>";
    fb.querySelectorAll("[data-beds]").forEach(function(b){
      b.onclick=function(){window.filterBeds=b.getAttribute("data-beds");renderGrid()};
    });
    fb.querySelectorAll("[data-region]").forEach(function(b){
      b.onclick=function(){window.filterRegion=b.getAttribute("data-region");renderGrid()};
    });
  }

  const grid=document.getElementById("propGrid");
  if(!grid)return;
  grid.hidden=false;grid.className="rn-grid";grid.style.display="grid";
  if(!filtered.length){
    grid.innerHTML='<div class="grid-empty">Sin resultados con estos filtros</div>';
    return;
  }

  /* First 8 cards: eager mid-size for instant paint; rest deferred */
  let html="";
  for(let i=0;i<filtered.length;i++){
    const p=filtered[i];
    const ni=(p.images&&p.images.length)||1;
    var src=coverImg(p,720);
    var raw=(p.images&&p.images[coverIdx(p)])||"";
    if(raw) raw=raw.replace(/=w\d+.*/,"");
    var eager=i<16;
    html+='<article class="rn-card" data-id="'+p.id+'">';
    if(eager&&src){
      html+='<div class="rn-card-media" style="background-image:url(\''+src+'\')"></div>';
    }else{
      html+='<div class="rn-card-media" data-bg="'+raw+'"></div>';
    }
    html+='<div class="rn-card-body">';
    html+='<p class="rn-card-loc">'+esc(p.loc||"Tulum")+'</p>';
    html+='<h3 class="rn-card-name">'+esc(p.name)+'</h3>';
    html+='<p class="rn-card-meta">'+esc(p.beds||"")+' · '+ni+' fotos</p>';
    html+='<p class="rn-card-price">'+esc(p.price||"Precio negociable")+'</p>';
    html+='</div></article>';
  }
  grid.innerHTML=html;
  grid.className = "rn-grid";
  grid.style.cssText = "display:grid;grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:14px;width:100%;box-sizing:border-box;align-items:start;overflow-y:auto;";
  if(window.matchMedia && window.matchMedia("(min-width:900px)").matches){
    grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  }
  if(window.matchMedia && window.matchMedia("(min-width:1200px)").matches){
    grid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  }
  grid.querySelectorAll(".rn-card").forEach(function(card){
    card.style.cssText = "display:flex;flex-direction:column;width:100%;min-width:0;background:#161616;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);margin:0;";
  });
  grid.querySelectorAll(".rn-card-media").forEach(function(el){
    var bg = el.style.backgroundImage || "";
    el.style.cssText = "display:block;width:100%;height:180px;min-height:180px;max-height:180px;flex:0 0 180px;background-color:#1c1c1e;background-size:cover;background-position:center;background-repeat:no-repeat;margin:0;padding:0;" + (bg ? "background-image:"+bg+";" : "");
  });
  grid.querySelectorAll(".rn-card-body").forEach(function(el){
    el.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:12px 14px 14px;flex:1 1 auto;min-height:72px;";
  });
  var obs=ensureGridObs();
  grid.querySelectorAll(".rn-card-media[data-bg]").forEach(function(el){obs.observe(el)});
  for(var pi=0;pi<Math.min(filtered.length,14);pi++){prefetchImg(coverImg(filtered[pi],480));}
  grid.querySelectorAll(".rn-card").forEach(function(card){
    card.onclick=function(){
      const p=findProp(card.getAttribute("data-id"));
      if(p){try{window.NORT_OS&&window.NORT_OS.track("card_click",p.id,{view:window.catalogView})}catch(e){}saveNavCtx();__rnCtx.overlay=true;__rnCtx.view=window.catalogView||"grid";var ov=document.getElementById("allOverlay");if(ov){ov.classList.remove("open");ov.style.setProperty("display","none","important")}document.body.classList.remove("catalog-open");openDetail(p)}
    };
  });
  if(window.catalogView==="map")updateMapMarkers(filtered);
}
window.renderGrid=renderGrid;


function closeMapSheet(){
  var s=document.getElementById("mapSheet");
  if(s){s.classList.remove("open");s.innerHTML=""}
  activeMapId=null;
  // reset pin styles
  mapMarkers.forEach(function(entry){
    try{entry.marker.setIcon(pricePinIcon(entry.label,false));entry.marker.setZIndexOffset(0)}catch(e){}
  });
  var rail=document.getElementById("mapRail");
  if(rail)rail.querySelectorAll(".map-card").forEach(function(c){c.classList.remove("active")});
}

function showMapSheet(p){
  var s=document.getElementById("mapSheet");
  if(!s||!p)return;
  var img=coverImg(p,640);
  var n=(p.images&&p.images.length)||0;
  s.innerHTML=
    '<button type="button" class="sheet-close" id="sheetClose" aria-label="Cerrar">×</button>'+
    '<div class="sheet-inner">'+
      '<div class="sheet-photo">'+(img?'<img class="sheet-img" alt="'+esc(p.name)+'" width="640" height="480" decoding="async" src="'+img+'" />':'')+'</div>'+
      '<div class="sheet-body">'+
        '<div class="sheet-loc">'+esc(p.loc||"Tulum")+'</div>'+
        '<div class="sheet-title">'+esc(p.name)+'</div>'+
        '<div class="sheet-meta">'+esc(p.beds||"")+(n?(" · "+n+" fotos"):"")+'</div>'+
        '<div class="sheet-price">'+esc(p.price||"Precio negociable")+'</div>'+
        '<div class="sheet-actions">'+
          '<button type="button" class="cta gold" id="sheetOpen">Ver galería</button>'+
          '<a class="cta" href="'+waMsg(p)+'" target="_blank" rel="noopener">WhatsApp</a>'+
        '</div>'+
      '</div>'+
    '</div>';
  s.classList.add("open");
  var btn=document.getElementById("sheetOpen");
  if(btn)btn.onclick=function(){saveNavCtx();__rnCtx.overlay=true;__rnCtx.view="map";window.catalogView="map";var ov=document.getElementById("allOverlay");if(ov){ov.classList.remove("open");ov.style.setProperty("display","none","important")}document.body.classList.remove("catalog-open");openDetail(p)};
  var ph=s.querySelector(".sheet-photo");
  if(ph)ph.onclick=function(){saveNavCtx();__rnCtx.overlay=true;__rnCtx.view="map";window.catalogView="map";var ov=document.getElementById("allOverlay");if(ov){ov.classList.remove("open");ov.style.setProperty("display","none","important")}document.body.classList.remove("catalog-open");openDetail(p)};
  var cl=document.getElementById("sheetClose");
  if(cl)cl.onclick=function(e){e.stopPropagation();closeMapSheet();if(catalogMap)setTimeout(function(){try{catalogMap.invalidateSize(true)}catch(err){}},60)};
  if(catalogMap)setTimeout(function(){try{catalogMap.invalidateSize(true)}catch(e){}},60);
}

function ensureMap(){
  if(typeof L==="undefined"){console.warn("Leaflet missing");return}
  var el=document.getElementById("catalogMap");
  if(!el)return;
  if(!catalogMap){
    catalogMap=L.map(el,{
      zoomControl:false,
      attributionControl:false,
      scrollWheelZoom:true,
      tap:true,
      preferCanvas:true
    }).setView([20.211,-87.465],12);
    L.control.zoom({position:"bottomright"}).addTo(catalogMap);
    // Light elegant basemap
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{
      maxZoom:18,
      subdomains:"abcd",
      updateWhenIdle:true,
      keepBuffer:2
    }).addTo(catalogMap);
    // close sheet when panning map empty area
    catalogMap.on("click",function(){closeMapSheet()});
  }
  setTimeout(function(){if(catalogMap)try{catalogMap.invalidateSize(true)}catch(e){}},80);
}

function pricePinIcon(label, active){
  return L.divIcon({
    className:"rn-marker",
    html:'<div class="rn-dot-pin'+(active?" active":"")+'" aria-hidden="true"></div>',
    iconSize:[0,0],
    iconAnchor:[0,0]
  });
}

function renderMapRail(list){
  var rail=document.getElementById("mapRail");
  if(!rail)return;
  if(!list.length){
    rail.innerHTML='<div style="pointer-events:auto;color:rgba(255,255,255,.5);padding:14px;font-size:13px">Sin resultados en esta zona</div>';
    return;
  }
  // Limit DOM for performance: show up to 24 cards in rail
  var slice=list.slice(0,24);
  rail.innerHTML=slice.map(function(p,i){
    var ms=mapCardSrcSet(p);
    return '<article class="map-card" data-id="'+p.id+'" data-i="'+i+'">'+
      '<div class="map-card-photo" style="position:relative;width:100%;height:120px;overflow:hidden;background:#1c1c1e">'+(ms.src?'<img class="map-card-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1"  alt="'+esc(p.name)+'" width="480" height="320" loading="lazy" decoding="async" src="'+ms.src+'" srcset="'+ms.srcset+'" sizes="'+ms.sizes+'" />':'')+'</div>'+
      '<div class="map-card-body">'+
      '<div class="map-card-loc">'+esc(p.loc||"Tulum")+'</div>'+
      '<div class="map-card-title">'+esc(p.name)+'</div>'+
      '<div class="map-card-price">'+esc(p.price||"Precio negociable")+'</div>'+
      '</div></article>';
  }).join("");
  rail.querySelectorAll(".map-card-img").forEach(function(img){
    function done(){ img.classList.add("loaded"); }
    if(img.complete && img.naturalWidth) done();
    else { img.addEventListener("load", done, {once:true}); img.addEventListener("error", done, {once:true}); }
  });
  rail.style.pointerEvents="auto";
  rail.style.overflowX="auto";
  rail.style.webkitOverflowScrolling="touch";
  rail.style.touchAction="pan-x";
  rail.querySelectorAll(".map-card").forEach(function(card){
    card.onclick=function(e){
      e.stopPropagation();
      var p=findProp(card.getAttribute("data-id"));
      if(!p)return;
      highlightMapProp(p.id);
      showMapSheet(p);
      if(p.lat!=null&&catalogMap){
        try{catalogMap.flyTo([p.lat,p.lng],14.5,{duration:.55})}catch(err){}
      }
    };
  });
}

var activeMapId=null;
function highlightMapProp(id){
  activeMapId=id;
  mapMarkers.forEach(function(entry){
    var on=entry.id===id;
    try{
      entry.marker.setIcon(pricePinIcon(entry.label,on));
      entry.marker.setZIndexOffset(on?2000:0);
    }catch(e){}
  });
  var rail=document.getElementById("mapRail");
  if(rail){
    rail.querySelectorAll(".map-card").forEach(function(c){
      c.classList.toggle("active",c.getAttribute("data-id")===id);
    });
  }
}

function updateMapMarkers(list){
  ensureMap();
  if(!catalogMap)return;
  mapMarkers.forEach(function(entry){try{catalogMap.removeLayer(entry.marker)}catch(e){}});
  mapMarkers=[];
  var bounds=[];
  list.forEach(function(p){
    if(p.lat==null||p.lng==null)return;
    var label=p.pricePin||"·";
    if(label.length>8)label=label.slice(0,8);
    var marker=L.marker([p.lat,p.lng],{
      icon:pricePinIcon(label,false),
      riseOnHover:true,
      keyboard:true,
      title:p.name
    }).addTo(catalogMap);
    marker.on("click",function(e){
      if(e&&e.originalEvent)e.originalEvent.stopPropagation();
      highlightMapProp(p.id);
      showMapSheet(p);
      var rail=document.getElementById("mapRail");
      if(rail){
        var card=rail.querySelector('.map-card[data-id="'+p.id+'"]');
        if(card)card.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});
      }
    });
    mapMarkers.push({id:p.id,marker:marker,label:label});
    bounds.push([p.lat,p.lng]);
  });
  renderMapRail(list);
  if(bounds.length){
    try{catalogMap.fitBounds(bounds,{padding:[48,48],maxZoom:13.5,animate:false})}catch(e){}
  }
  setTimeout(function(){if(catalogMap)try{catalogMap.invalidateSize(true)}catch(e){}},100);
}

function tryBuild(){
  if(typeof featured!=="undefined"&&featured&&featured.length){buildGallery();return true}
  return false;
}
if(!tryBuild()){
  window.__RN_ON_DATA=function(){tryBuild()};
  setTimeout(function(){if(!tryBuild())buildGallery()},2500);
}

document.addEventListener("click",function(ev){
  var a=ev.target&&ev.target.closest?ev.target.closest("a[href*='wa.me'],a[href*='whatsapp']"):null;
  if(!a)return;
  try{
    var id=(currentDetail&&currentDetail.id)||null;
    window.NORT_OS&&window.NORT_OS.track("whatsapp_click",id,{href:a.href});
  }catch(e){}
},true);
document.addEventListener("click",function(ev){
  var a=ev.target&&ev.target.closest?ev.target.closest("a[href^='mailto:']"):null;
  if(!a)return;
  try{
    var id=(currentDetail&&currentDetail.id)||null;
    window.NORT_OS&&window.NORT_OS.track("email_click",id,{href:a.href});
  }catch(e){}
},true);

})();