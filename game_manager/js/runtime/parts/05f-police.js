      var policeState = null, policeStateAt = 0;
      function policeFrames() {
        var docs=[document], frames=[];
        if(typeof pipWindow!=='undefined'&&pipWindow&&!pipWindow.closed)docs.push(pipWindow.document);
        docs.forEach(function(doc){doc.querySelectorAll('iframe').forEach(function(f){
          if(f.dataset.widgetType==='police_demo'||/\/police_demo\.html(?:[?#]|$)/.test(f.src))frames.push(f);
        });});return frames;
      }
      function policePublish(message) {
        policeFrames().forEach(function(f){if(f.contentWindow)f.contentWindow.postMessage(message,location.origin==='null'?'*':location.origin);});
      }
      function receivePoliceState(raw) {
        if(!raw||raw.protocol!==1)return;
        if(raw.type==='policeState'){policeState=raw;policeStateAt=Date.now();}
        policePublish(raw);
      }
      window.addEventListener('message',function(event){
        if(event.origin!==location.origin||!policeFrames().some(function(f){return f.contentWindow===event.source;}))return;
        var m=event.data;if(!m||m.protocol!==1)return;
        if(m.type==='policeSubscribe'){
          event.source.postMessage(policeState&&Date.now()-policeStateAt<3000?policeState:{type:'policeOffline',protocol:1},event.origin==='null'?'*':event.origin);return;
        }
        if(m.type!=='policeCommand')return;
        if(!policeState||Date.now()-policeStateAt>=3000||!telemetryWs||telemetryWs.readyState!==WebSocket.OPEN){
          event.source.postMessage({type:'policeOffline',protocol:1},event.origin==='null'?'*':event.origin);return;
        }
        // Do not replace context on an already issued command. A stale command
        // must not spawn or charge in a different profile after reconnect.
        telemetryWs.send(JSON.stringify(m));
      });
