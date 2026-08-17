var featured=[],allProperties=[];
(function(){
  var urls=["catalog-a.json","catalog-b.json","catalog-c.json","catalog-d.json","catalog-e.json","catalog-f.json"];
  var pending=urls.length;
  var collected={featured:[],allProperties:[]};
  function finish(){
    pending--;
    if(pending>0)return;
    var seen={};
    featured=collected.featured||[];
    featured.forEach(function(p){if(p&&p.id)seen[p.id]=1});
    (collected.allProperties||[]).forEach(function(p){
      if(p&&p.id&&!seen[p.id]){seen[p.id]=1;allProperties.push(p)}
    });
    featured.forEach(function(p){if(p&&p.id&&!seen[p.id]){seen[p.id]=1;allProperties.unshift(p)}});
    if(!allProperties.length)allProperties=featured.slice();
    if(typeof window.__RN_ON_DATA==="function")window.__RN_ON_DATA();
  }
  urls.forEach(function(url){
    fetch(url+"?v=35")
      .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
      .then(function(d){
        if(d.featured&&d.featured.length)collected.featured=d.featured;
        if(d.allProperties&&d.allProperties.length)
          collected.allProperties=collected.allProperties.concat(d.allProperties);
        finish();
      })
      .catch(function(){finish()});
  });
  setTimeout(function(){if(pending>0){pending=0;finish()}},8000);
})();
