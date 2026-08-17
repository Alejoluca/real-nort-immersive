var featured=[],allProperties=[];
(function(){
  function go(){
    var pool=[].concat(window.__RN_PART1||[],window.__RN_PART2||[],window.__RN_PART3||[],window.__RN_PART4||[]);
    if(!pool.length){if(typeof window.__RN_ON_DATA==="function")window.__RN_ON_DATA();return}
    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
    shuffle(pool);
    var n=Math.min(pool.length,6+Math.floor(Math.random()*3));
    featured=pool.slice(0,n);
    allProperties=pool;
    if(typeof window.__RN_ON_DATA==="function")window.__RN_ON_DATA();
  }
  function loadScript(src,cb){
    var s=document.createElement("script");
    s.src=src+"?v=25";s.async=true;s.onload=cb;s.onerror=cb;
    document.head.appendChild(s);
  }
  var done=0,need=4;
  function tick(){done++;if(done>=need)go()}
  loadScript("part1.js",tick);
  loadScript("part2.js",tick);
  loadScript("part3.js",tick);
  loadScript("part4.js",tick);
  setTimeout(function(){if(done<need)go()},4000);
})();
