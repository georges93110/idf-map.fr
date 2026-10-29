// One service clock owned by game.html. Widgets only render snapshots.
var IDFBusService = (function () {
  "use strict";
  function count(n) { return Math.max(0, Math.floor(Number(n) || 0)); }
  function door(position, available) {
    if (!available || typeof position !== "number" || !Number.isFinite(position) || position < 0 || position > 1) return "unknown";
    return position >= 0.5 ? "open" : "closed";
  }
  function completed(view, isStopped) {
    return !!(view && (view.ready || view.flowComplete));
  }
  function Service() { this.reset(); }
  Service.prototype.reset = function () {
    this.nativeView = null; this.key = ""; this.lastTime = null; this.dwell = 0; this.serial = 0;
    this.inBus = 0; this.boardTotal = 0; this.alightTotal = 0;
    this.boardDone = 0; this.alightDone = 0; this.active = [];
    this.boardDelay = 0; this.alightDelay = 0; this.leftBehind = 0;
    this.entry = "unknown"; this.exit = "unknown"; this.stopped = false;
    this.flowComplete = false; this.ready = false;
  };
  Service.prototype.begin = function (plan) {
    if (plan.key === this.key) return;
    this.reset(); this.key = plan.key; this.inBus = count(plan.inBus);
    this.boardTotal = plan.terminus ? 0 : count(plan.board);
    this.alightTotal = plan.terminus ? this.inBus : Math.min(this.inBus, count(plan.alight));
  };
  Service.prototype.tick = function (input) {
    // Long pauses, disconnected sockets and throttled tabs never cause catch-up transfers.
    var elapsed = this.lastTime === null ? 0 : input.now - this.lastTime;
    this.lastTime = input.now;
    var dt = elapsed >= 0 && elapsed <= 500 ? elapsed : 0;
    var wasStopped = this.stopped;
    var previousEntry = this.entry, previousExit = this.exit;
    if (elapsed > 500 || elapsed < 0) this.dwell = 0;
    this.entry = door(input.entry, input.available);
    this.exit = door(input.exit, input.available);
    this.stopped = input.inReach === true && input.paused !== true && input.fresh === true &&
      typeof input.speed === "number" && Number.isFinite(input.speed) && Math.abs(input.speed) < 0.5;
    this.dwell = this.stopped ? this.dwell + dt : 0;
    var canMove = this.stopped && this.dwell >= 1000;
    var capacity = input.unlimited === true ? Infinity : Math.max(1, count(input.capacity));
    // A capacity setting change cancels uncommitted boarding; onboard passengers are preserved.
    var incoming = this.active.filter(function (p) { return p.type === "in"; });
    var cancellable = incoming.filter(function (p) { return p.progress <= 0.6; });
    var overflow = this.inBus + incoming.length - capacity;
    while (overflow > 0 && cancellable.length) {
      var cancelled = cancellable.pop();
      this.active.splice(this.active.indexOf(cancelled), 1);
      overflow--;
    }
    var self = this;
    this.active = this.active.filter(function (p) {
      var open = p.type === "in" ? self.entry === "open" : self.exit === "open";
      var wasOpen = p.type === "in" ? previousEntry === "open" : previousExit === "open";
      // A passenger who already crossed the 0.6 door boundary has completed the
      // physical transfer. Let the remaining visual walk finish if the door closes
      // or the bus starts moving; passengers still at the boundary stay blocked.
      var crossedDoor = p.progress > 0.6;
      if ((canMove && wasStopped) || crossedDoor) {
        var next = Math.min(1, p.progress + dt / (p.type === "in" ? 4800 : 3200));
        // 0.6 is the bus boundary in the widget path. Only crossing needs an open door.
        // Once inside (boarding) or outside (alighting), walking continues independently.
        p.progress = crossedDoor || (open && wasOpen) ? next : Math.min(0.6, next);
      }
      if (p.progress < 1) return true;
      if (p.type === "in") { self.boardDone++; self.inBus++; }
      else { self.alightDone++; self.inBus--; }
      return false;
    });
    var activeIn = this.active.filter(function (p) { return p.type === "in"; }).length;
    var activeOut = this.active.length - activeIn;
    if (canMove && this.entry === "open") this.boardDelay = Math.max(0, this.boardDelay - dt);
    if (canMove && this.exit === "open") this.alightDelay = Math.max(0, this.alightDelay - dt);
    if (canMove && this.exit === "open" && this.alightDelay === 0 &&
        this.alightDone + activeOut < this.alightTotal && activeOut < this.inBus) {
      this.active.push({ id: ++this.serial, type: "out", progress: 0, queueIndex: -1 });
      this.alightDelay = 700;
    }
    if (canMove && this.entry === "open" && this.boardDelay === 0 &&
        this.boardDone + activeIn < this.boardTotal && this.inBus + activeIn < capacity) {
      // The widget removes the last waiting point when this passenger starts.
      // Preserve that exact slot so the same point begins walking without teleporting.
      var queueIndex = Math.max(0, this.boardTotal - this.boardDone - activeIn - 1);
      this.active.push({ id: ++this.serial, type: "in", progress: 0, queueIndex: queueIndex });
      this.boardDelay = 700;
    }
    var full = this.inBus >= capacity && this.alightDone >= this.alightTotal;
    this.leftBehind = full && !this.active.length ? this.boardTotal - this.boardDone : 0;
    this.flowComplete = !this.active.length && this.alightDone === this.alightTotal &&
      (this.boardDone === this.boardTotal || full);
    this.ready = this.flowComplete;
    return this.snapshot();
  };
  Service.prototype.snapshot = function () {
    if (this.nativeView) return Object.assign({}, this.nativeView);
    var activeIn = this.active.filter(function (p) { return p.type === "in"; }).length;
    var activeOut = this.active.length - activeIn;
    var waiting = Math.max(0, this.boardTotal - this.boardDone - activeIn);
    return {
      version: 2, key: this.key, inBus: this.inBus,
      boardingTotal: this.boardTotal, boardingDone: this.boardDone,
      alightingTotal: this.alightTotal, alightingDone: this.alightDone,
      waiting: waiting,
      entryNeedsOpen: waiting > 0 || this.active.some(function (p) { return p.type === "in" && p.progress <= 0.6; }),
      exitNeedsOpen: this.alightTotal - this.alightDone - activeOut > 0 || this.active.some(function (p) { return p.type === "out" && p.progress <= 0.6; }),
      leftBehind: this.leftBehind, flowComplete: this.flowComplete, ready: this.ready,
      active: !this.ready, entry: this.entry, exit: this.exit,
      particles: this.active.map(function (p) {
        return { id: p.id, type: p.type, progress: p.progress, queueIndex: p.queueIndex };
      })
    };
  };
  return { Service: Service, door: door, completed: completed };
})();
var saeivBusService = new IDFBusService.Service();
var saeivBoardingValidationAudio = null;
var saeivBoardingValidationToken = 0;
var saeivBoardingValidationQueue = [];
var saeivBoardingValidationBusy = false;
// Largest declared percentages have priority. Below 100, share the remainder
// among unspecified weights, otherwise top up the smallest. Above 100, trim
// the smallest first (80+40 -> 80+20). Keep all four outcome families separate.
function saeivValidationWeights(files) {
  var rows=files.map(function(file){var m=String(file).match(/^(Pass|Error)(_Ticket)?(?:_(.*))?\.mp3$/i);
    if(!m)return null;var n=m[3]===undefined?NaN:Number(m[3].replace(',','.'));
    return {file:file,declared:Number.isFinite(n)&&n>=0?n:null,weight:0};
  }).filter(Boolean).sort(function(a,b){return (b.declared||0)-(a.declared||0)||a.file.localeCompare(b.file);});
  var left=100;
  rows.forEach(function(r){if(r.declared!==null){r.weight=Math.min(left,r.declared);left-=r.weight;}});
  var unknown=rows.filter(function(r){return r.declared===null;});
  if(unknown.length)unknown.forEach(function(r){r.weight=left/unknown.length;});
  else if(rows.length)rows[rows.length-1].weight+=left;
  return rows;
}
function saeivValidationFiles(pack,outcome) {
  var prefix='sounds/bus/validations/'+pack+'/',files=[];
  if(typeof convoyClipCatalog==='object')Object.keys(convoyClipCatalog).forEach(function(id){
    var path=convoyClipCatalog[id];if(typeof path!=='string'||path.indexOf(prefix)!==0)return;
    var file=path.slice(prefix.length),m=file.match(/^(Pass|Error)(_Ticket)?(?:_[a-z0-9.,+-]+)?\.mp3$/i);
    if(m&&(m[1]+(m[2]||'')).toLowerCase()===outcome.toLowerCase()&&files.indexOf(file)<0)files.push(file);
  });
  if(!files.length)files.push(outcome+'.mp3');
  return files;
}
function saeivValidationPool(pack,outcome) {
  return Promise.all(saeivValidationFiles(pack,outcome).map(function(file){var url=buildSaeivBusSoundUrl('validations',pack,file.slice(0,-4));
    return Promise.resolve(probeSaeivSoundFileAvailability(url)).then(function(ok){return ok?file:null;}).catch(function(){return null;});
  })).then(function(found){return saeivValidationWeights(found.filter(Boolean));});
}
function saeivValidationPick(rows,roll) {
  if(rows.length===1)return rows[0].file;
  var point=Math.max(0,Math.min(.999999999,roll===undefined?Math.random():roll))*100;
  for(var i=0;i<rows.length;i++){point-=rows[i].weight;if(point<0)return rows[i].file;}
  return '';
}
function playSaeivBoardingValidationSound(boarded, outcome) {
  if (boarded <= 0 || typeof Audio !== "function" || saeivPassengerValidationSoundsEnabled !== true) return;
  var config = getActiveSaeivLineAudioConfig();
  if (!config.validationSoundPack || config.validationSoundsAllowed === false) return;
  var key = String(saeivRouteState && saeivRouteState.selectedKey || "");
  for (var i=0;i<Math.min(256,boarded);i++) {
    var result=outcome;
    if (result!=="Pass" && result!=="Error") {
      // Legacy DLL fallback only. Current DLLs send each person's actual outcome.
      var roll=Math.random();result=roll<.70?"Pass":roll<.73?"Error":"";
    }
    if(result && saeivBoardingValidationQueue.length<256)
      saeivBoardingValidationQueue.push({result:result,pack:config.validationSoundPack,key:key});
  }
  processSaeivBoardingValidationQueue();
}
function processSaeivBoardingValidationQueue() {
  if(saeivBoardingValidationBusy)return;
  var next=saeivBoardingValidationQueue.shift();if(!next)return;
  var valid=function(){var current=getActiveSaeivLineAudioConfig();return saeivPassengerValidationSoundsEnabled===true &&
    next.key===String(saeivRouteState&&saeivRouteState.selectedKey||"") && current.validationSoundsAllowed!==false && current.validationSoundPack===next.pack;};
  if(!valid()){processSaeivBoardingValidationQueue();return;}
  var token=++saeivBoardingValidationToken,finished=false;saeivBoardingValidationBusy=true;
  var finish=function(){if(finished)return;finished=true;saeivBoardingValidationBusy=false;saeivBoardingValidationAudio=null;processSaeivBoardingValidationQueue();};
  saeivValidationPool(next.pack,next.result).then(function(pool){
    var file=saeivValidationPick(pool),url=file&&buildSaeivBusSoundUrl('validations',next.pack,file.slice(0,-4));
    if(!url||token!==saeivBoardingValidationToken||!valid()){finish();return;}
    var audio=createBusSpatialAudio(url,"validator");saeivBoardingValidationAudio=audio;
    setBusAudioLevel(audio,.5);audio.onended=audio.onerror=finish;
    try{Promise.resolve(audio.play()).catch(finish);}catch(_){finish();}
  }).catch(finish);
}
function getSaeivBusServiceKey() {
  if (!saeivRouteState || saeivRouteState.started !== true || !saeivPassengerState) return "";
  return [saeivRouteState.selectedKey, saeivRouteSelectedAtMs, saeivRouteStartedAtMs,
    saeivPassengerState.targetIndex, saeivPassengerState.targetUid].join(":");
}
function getSaeivBusServiceSnapshot() {
  var key = getSaeivBusServiceKey();
  return key && saeivBusService.key === key ? saeivBusService.snapshot() : null;
}
function getSaeivDoorsState() {
  var sig = telemetryLastSignal || {};
  var age = Date.now() - telemetryLastPacketAt;
  var fresh = telemetryLastPacketAt > 0 && age >= 0 && age <= 1500;
  var available = fresh && !telemetryPaused && sig.busDoorsAvailable === true && sig.busDoorsStatus === "ok";
  return {
    fresh: fresh, available: available, sampleAt: telemetryLastPacketAt,
    entry: available ? sig.busEntryDoorPosition : null,
    exit: available ? sig.busExitDoorPosition : null,
    entryState: IDFBusService.door(sig.busEntryDoorPosition, available),
    exitState: IDFBusService.door(sig.busExitDoorPosition, available)
  };
}
