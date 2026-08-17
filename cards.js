/* Apple-level catalog cards — patches renderGrid after app.js */
(function(){
  function patch(){
    if(typeof renderGrid!=="function"&&typeof window.renderGrid!=="function"){
      /* hook via openAll path: replace grid builder on next open */
    }
    var _orig = null;
    function appleRender(){
      var beds=[{key:"all",label:"Todas"},{key:"studio",label:"Estudios"},{key:"1",label:"1 Rec"},{key:"2",label:"2 Rec"},{key:"3",label:"3 Rec"}];
      var regions=[{key:"all",label:"Todas zonas"},{key:"aldea-zama",label:"Aldea Zama"},{key:"la-veleta",label:"La Veleta"},{key:"region-15",label:"Región 15"},{key:"amira",label:"Amira"},{key:"holistika",label:"Holistika"},{key:"centro",label:"Centro"},{key:"tulum-norte",label:"Tulum Norte"},{key:"tulum",label:"Tulum"}];
      var filtered=(typeof getFiltered==="function")?getFiltered():(window.allProperties||[]);
      var fb=document.getElementById("filterBar");
      if(fb){
        fb.innerHTML='<div class="filter-row"><span class="filter-label">Tipo</span>'+beds.map(function(f){return '<button type="button" class="filter-btn'+(window.filterBeds===f.key?' active':'')+'" data-beds="'+f.key+'">'+f.label+'</button>'}).join('')+'</div><div class="filter-row"><span class="filter-label">Zona</span>'+regions.map(function(f){return '<button type="button" class="filter-btn'+(window.filterRegion===f.key?' active':'')+'" data-region="'+f.key+'">'+f.label+'</button>'}).join('')+'<span class="filter-count">'+filtered.length+(filtered.length===1?' propiedad':' propiedades')+'</span></div>';
        fb.querySelectorAll('[data-beds]').forEach(function(b){b.onclick=function(){window.filterBeds=b.dataset.beds;appleRender()}});
        fb.querySelectorAll('[data-region]').forEach(function(b){b.onclick=function(){window.filterRegion=b.dataset.region;appleRender()}});
      }
      var grid=document.getElementById("propGrid");
      if(!grid)return;
      if(!filtered.length){grid.innerHTML='<div style="grid-column:1/-1;padding:2rem;text-align:center;color:rgba(255,255,255,.4)">Sin resultados</div>';return}
      grid.innerHTML=filtered.map(function(p){
        var ni=(p.images&&p.images.length)||1;
        var d=(p.desc||"").slice(0,72);
        var img=(typeof safeImg==="function")?safeImg(p,0,900):(p.images&&p.images[0])||"";
        return '<article class="card" data-id="'+p.id+'"><div class="card-media"><div class="card-img" data-bg="'+img+'" data-n="'+ni+'"></div></div><div class="card-body"><p class="card-tag">'+(p.loc||"Tulum")+'</p><h3 class="card-name">'+p.name+'</h3><p class="card-meta">'+(p.beds||"")+(ni>1?' · '+ni+' fotos':'')+'</p>'+(d?'<p class="card-desc">'+d+(p.desc&&p.desc.length>72?'…':'')+'</p>':'')+'<div class="card-foot"><span class="card-price">'+(p.price||"Precio negociable")+'</span><span class="card-cta">Ver</span></div></div></article>';
      }).join("");
      if(window.gridImgObs)try{window.gridImgObs.disconnect()}catch(e){}
      var obs=new IntersectionObserver(function(ents){ents.forEach(function(e){if(!e.isIntersecting)return;var el=e.target,u=el.getAttribute("data-bg");if(u&&typeof lazyBg==="function")lazyBg(el,u);obs.unobserve(el)})},{root:grid,rootMargin:"400px 0px"});
      window.gridImgObs=obs;
      grid.querySelectorAll(".card-img[data-bg]").forEach(function(el){obs.observe(el)});
      grid.querySelectorAll(".card").forEach(function(card){card.onclick=function(){var p=(typeof findProp==="function")?findProp(card.dataset.id):(window.allProperties||[]).find(function(x){return x.id===card.dataset.id});if(p){if(typeof closeAll==="function")closeAll();if(typeof openDetail==="function")openDetail(p)}}});
      if(window.catalogView==="map"&&typeof updateMapMarkers==="function")updateMapMarkers(filtered);
    }
    /* Override openAll to use apple render */
    var tries=0;
    function install(){
      tries++;
      if(typeof openAll==="function"){
        var _open=openAll;
        openAll=function(){
          window.filterBeds="all";window.filterRegion="all";window.catalogView="grid";
          appleRender();
          if(typeof setCatalogView==="function")setCatalogView("grid");
          var ov=document.getElementById("allOverlay");if(ov)ov.classList.add("open");
          document.body.style.overflow="hidden";
        };
        window.renderGrid=appleRender;
        return;
      }
      if(tries<40)setTimeout(install,150);
    }
    install();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",patch);else patch();
})();
