var featured=[],allProperties=[];
(function(){
  function apply(d){
    if(!d)return;
    featured = d.featured || [];
    allProperties = d.allProperties || featured.slice();
    if(typeof window.__RN_ON_DATA==="function") window.__RN_ON_DATA();
  }
  function fail(){
    console.warn("Real Nort: catalog load failed");
    if(typeof window.__RN_ON_DATA==="function") window.__RN_ON_DATA();
  }
  fetch("catalog.json?v=33")
    .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(apply)
    .catch(function(){
      var done=0;
      function tick(){ done++; if(done>=4){
        var raw=[].concat(window.__RN_PART1||[],window.__RN_PART2||[],window.__RN_PART3||[],window.__RN_PART4||[]);
        var seen={},pool=[];
        for(var i=0;i<raw.length;i++){ var p=raw[i]; if(!p||!p.id||seen[p.id])continue; seen[p.id]=1; pool.push(p); }
        apply({featured:pool.slice(0,7), allProperties:pool});
      }}
      function load(src){ var s=document.createElement("script"); s.src=src+"?v=33"; s.async=true; s.onload=tick; s.onerror=tick; document.head.appendChild(s); }
      load("part1.js"); load("part2.js"); load("part3.js"); load("part4.js");
      setTimeout(function(){ if(done<4) tick(); }, 4000);
    });
})();
