// One service clock owned by game.html. Widgets only render snapshots.
var IDFBusService = (function () {
  "use strict";
  function count(n) { return Math.max(0, Math.floor(Number(n) || 0)); }
  function door(position, available) {
    if (!available || typeof position !== "number" || !Number.isFinite(position) || position < 0 || position > 1) return "unknown";
    return position >= 0.5 ? "open" : "closed";
  }
  function completed(view, isStopped) {
    return !!(view && (view.ready || (view.flowComplete && isStopped !== true)));
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
    var hadWork = this.boardTotal + this.alightTotal > 0;
    this.ready = this.flowComplete && (!hadWork || (this.stopped && this.entry === "closed" && this.exit === "closed"));
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
function playSaeivBoardingValidationSound(boarded, everyPassenger) {
  if (boarded <= 0 || typeof Audio !== "function" || saeivPassengerValidationSoundsEnabled !== true) return;
  if (getActiveSaeivLineAudioConfig().validationSoundsAllowed === false) return;
  var roll = everyPassenger ? 0.5 : Math.random();
  if (roll >= 0.8) return;
  if (saeivBoardingValidationAudio) saeivBoardingValidationAudio.pause();
  saeivBoardingValidationAudio = new Audio("sounds/bus/" + (roll < 0.01 ? "navigo_ratp_error.mp3" : "navigo_ratp_pass.mp3"));
  saeivBoardingValidationAudio.volume = Math.max(0, Math.min(1, getGlobalAudioVolumeFactor() / 2));
  saeivBoardingValidationAudio.play().catch(function () {});
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
