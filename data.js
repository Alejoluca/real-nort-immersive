var featured=[],allProperties=[];
(function(){
  function go(){
    var p1 = window.__RN_PART1 || [];
    var p2 = window.__RN_PART2 || [];
    var pool = p1.concat(p2);
    if(!pool.length){
      // fallback if parts fail
      featured = [];
      allProperties = [];
      if(typeof window.__RN_ON_DATA === "function") window.__RN_ON_DATA();
      return;
    }
    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    shuffle(pool);
    var n = Math.min(pool.length, 6 + Math.floor(Math.random()*3));
    featured = pool.slice(0, n);
    allProperties = pool;
    if(typeof window.__RN_ON_DATA === "function") window.__RN_ON_DATA();
  }
  function loadScript(src, cb){
    var s = document.createElement("script");
    s.src = src;
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }
  var loaded = 0;
  function check(){
    loaded++;
    if(loaded >= 2) go();
  }
  loadScript("part1.js", check);
  loadScript("part2.js", check);
  // safety timeout
  setTimeout(function(){ if(loaded < 2) go(); }, 3000);
})();
