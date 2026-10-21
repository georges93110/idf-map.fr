(function(){
  "use strict";
  function key(value) {
    var name=String(value||"").replace(/\\/g,"/").split("/").pop().replace(/\.mbd$/i,"").toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)?name:"";
  }
  var params=new URLSearchParams(location.search),required=params.has("idfFloatUi")||params.has("telemetryPort");
  var selected=key(params.get("map")) || (required?"":"idf");
  function version(value){return typeof value==='string'&&/^[a-z0-9][a-z0-9_.-]{0,63}$/i.test(value)&&!/^default$/i.test(value)?value:'default';}
  var dataVersion=version(params.get('dataVersion'));
  var dataRevision=/^\d+:\d+$/.test(params.get('dataRevision')||'')?params.get('dataRevision'):'';
  function file(name) {
    var clean=String(name||"").replace(/^\/+/,"").replace(/^(?:DBus|Mode(?:%20| )Bus)\//i,"Mode%20Bus/");
    if(clean.split("/").some(function(part){return part==="..";}))throw Error("Invalid map path");
    // All data in a mode is replaced together. Keep repeated fetch remapping idempotent.
    if(dataVersion!=='default')clean=clean.replace(/^(Mode(?:%20| )[a-z0-9_-]+)\/(.*)$/i,function(_,mode,rest){
      return mode+'/'+(rest.indexOf(dataVersion+'/')===0?'':encodeURIComponent(dataVersion)+'/')+rest;
    });
    return (location.pathname.indexOf("/saeiv/")===0?"https://idf-map.fr":"")+"/idf-rp/maps/"+(selected||"__unsupported__")+"/"+clean;
  }
  function remap(value){
    var url;try{url=new URL(value,location.href);}catch(_){return value;}
    if(url.origin!==location.origin)return value;
    var pathname=decodeURI(url.pathname),match;
    // Only bus XML follows the game map. Web-map JSON and tiles stay in website.
    if((match=pathname.match(/^(?:\/saeiv)?\/(?:map_files\/IDF-RP|idf-rp\/maps\/idf)\/(Mode(?:%20| )Bus\/.+)$/)))
      return new URL(file(match[1])+url.search,location.href).href;
    if((match=pathname.match(/^(?:\/saeiv)?\/map_files\/[^/]+\/(Mode(?:%20| )Bus\/.+)$/)))
      return new URL(file(match[1])+url.search,location.href).href;
    if((match=pathname.match(/^\/map_files\/IDF-RP\/(.+)$/)))
      return new URL('/map_files/'+(match[1]==='uber_eats_restaurants.json'?'':'website/')+match[1]+url.search,location.href).href;
    return url.href;
  }
  var originalFetch=window.fetch;
  if(originalFetch)window.fetch=function(input,options){
    var raw=typeof input==="string"||input instanceof URL?String(input):input.url,mapped=remap(raw);
    return originalFetch.call(this,mapped===raw?input:(typeof input==="string"||input instanceof URL?mapped:new Request(mapped,input)),options);
  };
  window.IDF_MAP_CONTEXT={key:key,selected:selected,dataVersion:dataVersion,dataRevision:dataRevision,version:version,file:file,remap:remap,
    widget:function(value){var u=new URL(value,location.href);if(selected)u.searchParams.set("map",selected);u.searchParams.set('dataVersion',dataVersion);u.searchParams.set('dataRevision',dataRevision);return u.href;},
    hasWebsiteMap:selected==="idf"};
})();
