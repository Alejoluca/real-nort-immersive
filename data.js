var featured=[],allProperties=[];
(function(){
  function go(){
    var p1 = window.__RN_PART1 || [];
    var p2 = window.__RN_PART2 || [];
    var pool = p1.concat(p2);
    if(!pool.length) return;
    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    shuffle(pool);
    var n = Math.min(pool.length, 6 + Math.floor(Math.random()*3));
    featured = pool.slice(0, n);
    allProperties = pool;
    if(typeof window.__RN_ON_DATA === "function") window.__RN_ON_DATA();
  }
  if(window.__RN_PART1 && window.__RN_PART2) go();
  else {
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if((window.__RN_PART1 && window.__RN_PART2) || tries > 30){ clearInterval(t); go(); }
    }, 40);
  }
})();
