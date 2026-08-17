var featured=[],allProperties=[];
(function(){
  function go(){
    var raw=[].concat(window.__RN_PART1||[],window.__RN_PART2||[],window.__RN_PART3||[],window.__RN_PART4||[]);
    var seen={},pool=[];
    for(var i=0;i<raw.length;i++){
      var p=raw[i];if(!p||!p.id)continue;
      if(seen[p.id])continue;
      seen[p.id]=1;
      if(p.images&&p.images.length){
        p.images=p.images.map(function(u){return u.replace(/=w\d+.*/,"")+"=w1600"});
      }
      pool.push(p);
    }
    if(!pool.length){if(typeof window.__RN_ON_DATA==="function")window.__RN_ON_DATA();return}
    featured=pool.filter(function(p){return window.__RN_PART1&&window.__RN_PART1.some(function(f){return f.id===p.id})});
    if(!featured.length)featured=pool.slice(0,7);
    allProperties=pool;
    if(typeof window.__RN_ON_DATA==="function")window.__RN_ON_DATA();
  }
  function loadScript(src,cb){
    var s=document.createElement("script");
    s.src=src+"?v=32";s.async=true;s.onload=cb;s.onerror=cb;
    document.head.appendChild(s);
  }
  var done=0;
  function tick(){done++;if(done>=4)go()}
  loadScript("part1.js",tick);
  loadScript("part2.js",tick);
  loadScript("part3.js",tick);
  loadScript("part4.js",tick);
  setTimeout(function(){if(done<4)go()},5000);
})();
