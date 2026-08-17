/* Bulletproof catalog — Safari iOS safe */
(function(){
  function qs(id){return document.getElementById(id)}
  function hideGallery(hide){
    var g=qs("gallery"), pr=qs("progressRail");
    if(g){g.style.visibility=hide?"hidden":"";g.style.pointerEvents=hide?"none":""}
    if(pr){pr.style.visibility=hide?"hidden":""}
  }
  function imgUrl(p){
    var u=(p&&p.images&&p.images[0])||"";
    if(!u)return "";
    if(u.indexOf("lh3.googleusercontent.com/d/")!==-1){
      return u.replace(/=w\d+.*/,"")+"=w800";
    }
    return u;
  }
  function render(){
    var all=(window.allProperties&&window.allProperties.length)?window.allProperties:(window.featured||[]);
    var beds=window.filterBeds||"all";
    var region=window.filterRegion||"all";
    var filtered=all.slice();
    if(beds!=="all")filtered=filtered.filter(function(p){return p.bedsKey===beds});
    if(region!=="all")filtered=filtered.filter(function(p){return p.regionKey===region});

    var bedsF=[{key:"all",label:"Todas"},{key:"studio",label:"Estudios"},{key:"1",label:"1 Rec"},{key:"2",label:"2 Rec"},{key:"3",label:"3 Rec"}];
    var regionsF=[{key:"all",label:"Todas zonas"},{key:"aldea-zama",label:"Aldea Zama"},{key:"la-veleta",label:"La Veleta"},{key:"region-15",label:"Región 15"},{key:"amira",label:"Amira"},{key:"holistika",label:"Holistika"},{key:"centro",label:"Centro"},{key:"tulum-norte",label:"Tulum Norte"},{key:"tulum",label:"Tulum"}];

    var fb=qs("filterBar");
    if(fb){
      fb.innerHTML='<div class="filter-row"><span class="filter-label">Tipo</span>'+
        bedsF.map(function(f){return '<button type="button" class="filter-btn'+(beds===f.key?" active":"")+'" data-beds="'+f.key+'">'+f.label+"</button>"}).join("")+
        '</div><div class="filter-row"><span class="filter-label">Zona</span>'+
        regionsF.map(function(f){return '<button type="button" class="filter-btn'+(region===f.key?" active":"")+'" data-region="'+f.key+'">'+f.label+"</button>"}).join("")+
        '<span class="filter-count">'+filtered.length+(filtered.length===1?" propiedad":" propiedades")+"</span></div>";
      fb.querySelectorAll("[data-beds]").forEach(function(b){b.onclick=function(){window.filterBeds=b.getAttribute("data-beds");render()}});
      fb.querySelectorAll("[data-region]").forEach(function(b){b.onclick=function(){window.filterRegion=b.getAttribute("data-region");render()}});
    }

    var grid=qs("propGrid");
    if(!grid)return;
    if(!filtered.length){
      grid.innerHTML='<div style="grid-column:1/-1;padding:3rem 1rem;text-align:center;color:rgba(255,255,255,.45)">Sin resultados</div>';
      return;
    }

    var html="";
    for(var i=0;i<filtered.length;i++){
      var p=filtered[i];
      var ni=(p.images&&p.images.length)||1;
      var src=imgUrl(p);
      var desc=(p.desc||"").slice(0,70);
      html+='<article class="card" data-id="'+p.id+'">';
      html+='<div class="card-media"><div class="card-img" style="background-image:url(\''+src+'\')" data-n="'+ni+'"></div></div>';
      html+='<div class="card-body">';
      html+='<p class="card-tag">'+(p.loc||"Tulum")+"</p>";
      html+='<h3 class="card-name">'+(p.name||"")+"</h3>";
      html+='<p class="card-meta">'+(p.beds||"")+(ni>1?" · "+ni+" fotos":"")+"</p>";
      if(desc)html+='<p class="card-desc">'+desc+(p.desc&&p.desc.length>70?"…":"")+"</p>";
      html+='<div class="card-foot"><span class="card-price">'+(p.price||"Precio negociable")+'</span><span class="card-cta">Ver</span></div>';
      html+="</div></article>";
    }
    grid.innerHTML=html;

    grid.querySelectorAll(".card").forEach(function(card){
      card.onclick=function(){
        var id=card.getAttribute("data-id");
        var p=null;
        if(typeof findProp==="function")p=findProp(id);
        if(!p){
          var pool=(window.allProperties||[]).concat(window.featured||[]);
          for(var j=0;j<pool.length;j++){if(pool[j].id===id){p=pool[j];break}}
        }
        if(p){
          closeCatalog();
          if(typeof openDetail==="function")openDetail(p);
        }
      };
    });
  }

  function openCatalog(){
    window.filterBeds="all";
    window.filterRegion="all";
    window.catalogView="grid";
    var ov=qs("allOverlay");
    var panel=qs("mapPanel");
    var grid=qs("propGrid");
    if(panel)panel.hidden=true;
    if(grid)grid.hidden=false;
    var bg=qs("btnViewGrid"),bm=qs("btnViewMap");
    if(bg)bg.setAttribute("aria-pressed","true");
    if(bm)bm.setAttribute("aria-pressed","false");
    hideGallery(true);
    render();
    if(ov)ov.classList.add("open");
    document.body.classList.add("catalog-open");
    document.body.style.overflow="hidden";
  }
  function closeCatalog(){
    var ov=qs("allOverlay");
    if(ov)ov.classList.remove("open");
    document.body.classList.remove("catalog-open");
    document.body.style.overflow="";
    hideGallery(false);
  }

  function install(){
    window.renderGrid=render;
    window.openAll=openCatalog;
    window.closeAll=closeCatalog;
    var btnAll=qs("btnAll");
    if(btnAll)btnAll.onclick=function(e){e.preventDefault();openCatalog()};
    var allClose=qs("allClose");
    if(allClose)allClose.onclick=function(){closeCatalog()};
    ["btnAllIntro","btnAllEnd"].forEach(function(id){
      var el=qs(id);if(el)el.onclick=function(){openCatalog()};
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
  else install();
  var n=0;
  var t=setInterval(function(){
    n++;
    install();
    if(window.allProperties&&window.allProperties.length){install();clearInterval(t)}
    if(n>25)clearInterval(t);
  },250);
})();
