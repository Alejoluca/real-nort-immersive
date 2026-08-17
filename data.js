var featured=[],allProperties=[];
(function(){
  function boot(d){
    featured=d.featured||[];
    allProperties=d.allProperties||[];
    if(typeof window.__RN_ON_DATA==="function") window.__RN_ON_DATA();
  }
  if(typeof fetch!=="undefined"){
    fetch("catalog.json?v=20260817b").then(function(r){return r.json()}).then(boot).catch(function(e){
      console.warn("[RN] catalog.json load failed", e);
    });
  }
})();
