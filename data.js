var featured=[],allProperties=[];
(function(){
  function apply(d){
    if(!d)return;
    if(d.featured && d.featured.length) featured = d.featured;
    if(d.allProperties && d.allProperties.length){
      var seen = {};
      featured.forEach(function(p){ if(p&&p.id) seen[p.id]=1; });
      d.allProperties.forEach(function(p){
        if(p&&p.id&&!seen[p.id]){ seen[p.id]=1; allProperties.push(p); }
      });
      featured.forEach(function(p){ if(p&&p.id&&!seen[p.id]){ seen[p.id]=1; allProperties.unshift(p); } });
      if(!allProperties.length) allProperties = featured.slice();
    }
    if(typeof window.__RN_ON_DATA==="function") window.__RN_ON_DATA();
  }
  var pending = 3, collected = {featured:[], allProperties:[]};
  function done(){
    pending--;
    if(pending>0)return;
    apply(collected);
  }
  function load(url, key){
    fetch(url+"?v=33")
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){
        if(d.featured) collected.featured = d.featured;
        if(d.allProperties) collected.allProperties = collected.allProperties.concat(d.allProperties);
        done();
      })
      .catch(function(){ done(); });
  }
  load("catalog-a.json", "a");
  load("catalog-b.json", "b");
  load("catalog-c.json", "c");
  setTimeout(function(){ if(pending>0){ pending=0; apply(collected); } }, 6000);
})();
