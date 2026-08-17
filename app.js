(function(){
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
  if(u.indexOf("lh3.googleusercontent.com/d/")!==-1)
    return u.replace(/=w\d+.*/,"")+"=w"+w;
  return u;
}
function safeImg(p,i,w){
  const imgs=p&&p.images;
  if(!imgs||!imgs.length)return "";
  return driveOpt(imgs[Math.min(i||0,imgs.length-1)],w||1200);
}

/* Fast progressive BG: skip tiny on fast connections, sequential mid→full */
function lazyBg(el,url,opts){
  if(!el||el.classList.contains("loaded")||el.dataset.loading==="1")return;
  el.dataset.loading="1";
  opts=opts||{};
  const fullW=opts.full||1200;
  const midW=opts.mid||700;
  const skipTiny=opts.skipTiny!==false; // default skip tiny for speed
  const priority=opts.priority||"auto";
  const isDrive=url&&url.indexOf("lh3.googleusercontent.com/d/")!==-1;
  const full=isDrive?driveOpt(url,fullW):url;
  const mid=isDrive?driveOpt(url,midW):null;

  function setBg(src,done){
    const img=new Image();
    img.decoding="async";
    if(priority==="high")try{img.fetchPriority="high"}catch(e){}
    img.onload=function(){
      if(el.dataset.loading!=="1"&&!done)return;
      el.style.backgroundImage="url('"+src+"')";
      if(done){el.classList.add("loaded");el.dataset.loading="0"}
    };
    img.onerror=function(){
      if(done){el.classList.add("loaded");el.dataset.loading="0"}
    };
    img.src=src;
  }

  if(mid&&mid!==full){
    setBg(mid,false);
    setBg(full,true);
  }else{
    setBg(full,true);
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
      if(u)lazyBg(el,u,{mid:700,full:1100,priority:"low"});
    },unobserve:function(){},disconnect:function(){}};
    return gridImgObs;
  }
  gridImgObs=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting)return;
      const el=en.target;
      const u=el.getAttribute("data-bg");
      if(u){
        lazyBg(el,u,{mid:700,full:1100,priority:"low"});
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
  if(window.filterBeds!=="all")s=s.filter(function(p){return p.bedsKey===window.filterBeds});
  if(window.filterRegion!=="all")s=s.filter(function(p){return p.regionKey===window.filterRegion});
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
  const total=(allProperties&&allProperties.length)||featured.length;
  const hero=safeImg(featured[0],0,1100);
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

  featured.forEach(function(p,i){
    const n=(p.images&&p.images.length)||1;
    h+='<section class="slide" data-index="'+(i+1)+'" data-id="'+p.id+'">'+
      '<div class="slide-bg" data-bg="'+driveOpt(p.images[0],1000)+'"></div>'+
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
    '<div class="slide-bg" data-bg="'+safeImg(featured[0],1,1000)+'"></div>'+
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
          if(u)lazyBg(e.target,u,{mid:700,full:1100,priority:"high"});
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

function openDetail(p){
  currentDetail=p;
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
      (i===0?' style="background-image:url(\''+driveOpt(src,900)+'\')"':'')+'></div>';
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
  if(src)lazyBg(el,src,{mid:800,full:1400,priority:prio||"auto"});
}

function closeDetail(){
  var det=document.getElementById("detail");
  if(det){det.classList.remove("open");det.style.setProperty("display","none","important")}
  document.body.style.overflow="";
  currentDetail=null;
  if(detailIo){try{detailIo.disconnect()}catch(e){} detailIo=null}
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
    {key:"1",label:"1 Rec"},{key:"2",label:"2 Rec"},{key:"3",label:"3 Rec"}
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
  grid.hidden=false;grid.style.display="grid";
  if(!filtered.length){
    grid.innerHTML='<div class="grid-empty">Sin resultados con estos filtros</div>';
    return;
  }

  /* First 8 cards: eager mid-size for instant paint; rest deferred */
  let html="";
  for(let i=0;i<filtered.length;i++){
    const p=filtered[i];
    const ni=(p.images&&p.images.length)||1;
    let src=(p.images&&p.images[0])||"";
    if(src.indexOf("lh3.googleusercontent.com/d/")!==-1)src=src.replace(/=w\d+.*/,"");
    const eager=i<16;
    html+='<article class="card" data-id="'+p.id+'">';
    if(eager&&src){
      html+='<div class="card-photo loaded" style="background-image:url(\''+driveOpt(src,900)+'\')"><span class="card-badge">'+ni+' fotos</span></div>';
    }else{
      html+='<div class="card-photo" data-bg="'+src+'"><span class="card-badge">'+ni+' fotos</span></div>';
    }
    html+='<div class="card-info"><p class="card-loc">'+esc(p.loc||"Tulum")+'</p>'+
      '<h3 class="card-title">'+esc(p.name)+'</h3>'+
      '<p class="card-sub">'+esc(p.beds||"")+(ni>1?" · "+ni+" fotos":"")+'</p>'+
      '<div class="card-bottom"><span class="card-price">'+esc(p.price||"Precio negociable")+'</span>'+
      '<span class="card-link">Ver</span></div></div></article>';
  }
  grid.innerHTML=html;

  const obs=ensureGridObs();
  grid.querySelectorAll(".card-photo[data-bg]").forEach(function(el){obs.observe(el)});
  grid.querySelectorAll(".card").forEach(function(card){
    card.onclick=function(){
      const p=findProp(card.getAttribute("data-id"));
      if(p){closeAll();openDetail(p)}
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
  var img=(p.images&&p.images[0])?driveOpt(p.images[0],700):"";
  var n=(p.images&&p.images.length)||0;
  s.innerHTML=
    '<button type="button" class="sheet-close" id="sheetClose" aria-label="Cerrar">×</button>'+
    '<div class="sheet-inner">'+
      '<div class="sheet-photo"'+(img?' style="background-image:url(\''+img+'\')"':'')+'></div>'+
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
  if(btn)btn.onclick=function(){closeAll();openDetail(p)};
  var ph=s.querySelector(".sheet-photo");
  if(ph)ph.onclick=function(){closeAll();openDetail(p)};
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
    html:'<div class="rn-price-pin'+(active?" active":"")+'">'+esc(label)+"</div>",
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
    var img=(p.images&&p.images[0])?driveOpt(p.images[0],500):"";
    return '<article class="map-card" data-id="'+p.id+'" data-i="'+i+'">'+
      '<div class="map-card-photo"'+(img?' style="background-image:url(\''+img+'\')"':'')+'></div>'+
      '<div class="map-card-body">'+
      '<div class="map-card-loc">'+esc(p.loc||"Tulum")+'</div>'+
      '<div class="map-card-title">'+esc(p.name)+'</div>'+
      '<div class="map-card-price">'+esc(p.price||"Precio negociable")+'</div>'+
      '</div></article>';
  }).join("");
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
    if(label.length>14)label=label.slice(0,14);
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
})();
