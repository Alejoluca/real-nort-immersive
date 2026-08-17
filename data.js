var featured=[],allProperties=[];
(function(){
  function done(parts){
    var feat=[], all=[], seen={};
    parts.forEach(function(p){
      if(p.featured) feat = p.featured;
      (p.allProperties||[]).forEach(function(x){
        if(x && x.id && !seen[x.id]){ seen[x.id]=1; all.push(x); }
      });
    });
    featured = feat;
    allProperties = all.length ? all : feat.slice();
    if(typeof window.__RN_ON_DATA==="function") window.__RN_ON_DATA();
  }
  Promise.all([
    fetch("catalog-a.json?v=8").then(function(r){return r.json()}).catch(function(){return {}}),
    fetch("catalog-b.json?v=8").then(function(r){return r.json()}).catch(function(){return {}}),
    fetch("catalog-c.json?v=8").then(function(r){return r.json()}).catch(function(){return {}})
  ]).then(done);
})();
