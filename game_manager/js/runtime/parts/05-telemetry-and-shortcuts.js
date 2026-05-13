/*
 * Game2 runtime chunk: 05-telemetry-and-shortcuts.js
 * Telemetrie, WebSocket, raccourcis clavier.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      var remotePanelBusRouteGeometryCacheKey = "";
      var remotePanelBusRouteGeometryCache = null;
      var remotePanelBusRouteGeometryLastSentKey = "";
      var remotePanelBusRouteGeometryLastSentAt = 0;
      var REMOTE_PANEL_ROUTE_GEOMETRY_RESEND_MS = 6000;

      function isPipBrowserSupported() {
        var dpi = window.documentPictureInPicture;
        return !!(dpi && typeof dpi.requestWindow === "function");
      }
      function getPipUnavailableReasonText() {
        if (isPipBrowserSupported()) return "";
        return "PIP indisponible: Document Picture-in-Picture non supporte par ce navigateur.";
      }
      function refreshPipAvailabilityUi() {
        if (!el.outputColPip) return;
        var unavailable = !!ENABLE_TAB_AND_PIP_OUTPUTS && !isPipBrowserSupported();
        el.outputColPip.classList.toggle("is-unavailable", unavailable);
        el.outputColPip.setAttribute("aria-disabled", unavailable ? "true" : "false");
        if (unavailable && el.listPip) {
          el.listPip.innerHTML = "";
        }
        if (el.outputPipUnavailableBadge) {
          if (unavailable) {
            el.outputPipUnavailableBadge.hidden = false;
            el.outputPipUnavailableBadge.textContent = getPipUnavailableReasonText();
          } else {
            el.outputPipUnavailableBadge.hidden = true;
            el.outputPipUnavailableBadge.textContent = "";
          }
        }
      }
      function getListEl(output) {
        if (!isOutputEnabled(output)) return null;
        if (output === "inline") return el.listInline;
        if (output === "tab") return el.listTab;
        if (output === "pip") return el.listPip;
        return null;
      }
      function isOutputEnabled(output) {
        var kind = String(output || "");
        if (kind === "inline") return true;
        if (kind === "tab") return !!ENABLE_TAB_AND_PIP_OUTPUTS;
        if (kind === "pip") return !!ENABLE_TAB_AND_PIP_OUTPUTS && isPipBrowserSupported();
        return false;
      }
      function applyOutputVisibility() {
        var showExtra = !!ENABLE_TAB_AND_PIP_OUTPUTS;
        if (el.outputColTab) el.outputColTab.hidden = !showExtra;
        if (el.outputColPip) el.outputColPip.hidden = !showExtra;
        if (el.outputLists) {
          el.outputLists.classList.toggle("is-extra-disabled", !showExtra);
          el.outputLists.style.gridTemplateColumns = showExtra ? "" : "1fr";
        }
        refreshPipAvailabilityUi();
      }
      function enforceOutputModeConstraints() {
        if (!isOutputEnabled("tab") && lanes.tab && lanes.tab.length) {
          lanes.tab.slice().forEach(function (id) { forceInline(id); });
        }
        if (!isOutputEnabled("pip") && lanes.pip && lanes.pip.length) {
          lanes.pip.slice().forEach(function (id) { forceInline(id); });
        }
        if (!isOutputEnabled("tab")) {
          Object.keys(tabRefs).forEach(function (id) {
            var ref = tabRefs[id];
            if (ref && !ref.closed) {
              try { ref.close(); } catch (err) { }
            }
            delete tabRefs[id];
          });
        }
        if (!isOutputEnabled("pip")) {
          if (pipWindow) {
            try { pipWindow.close(); } catch (err2) { }
          }
          pipWindow = null;
          pipActiveIds = [];
        }
      }

      function isType(type) {
        return Object.prototype.hasOwnProperty.call(TYPES, type);
      }
      function typeAspectRatio(type) {
        var r = Number(TYPE_ASPECT_RATIO[type]);
        if (!Number.isFinite(r) || r <= 0) return 1;
        return r;
      }
      function isAspectRatioLocked(type) {
        var safeType = normalizeWidgetType(type);
        if (!safeType) return true;
        return true;
      }
      function setTelemetryDotState(state) {
        if (!el.telemetryDot) return;
        var safe = String(state || "checking").toLowerCase();
        el.telemetryDot.classList.remove("is-online", "is-offline", "is-checking");
        if (safe !== "online" && safe !== "offline") safe = "checking";
        el.telemetryDot.classList.add("is-" + safe);
        if (safe === "online") {
          el.telemetryDot.setAttribute("aria-label", "Connexion OK");
          el.telemetryDot.title = "Connexion OK";
          if (el.telemetryDotStatus) el.telemetryDotStatus.textContent = "En jeu";
        } else if (safe === "offline") {
          el.telemetryDot.setAttribute("aria-label", "Connexion perdue");
          el.telemetryDot.title = "Connexion perdue";
          if (el.telemetryDotStatus) el.telemetryDotStatus.textContent = "Déconnecté";
        } else {
          el.telemetryDot.setAttribute("aria-label", "Verification connexion");
          el.telemetryDot.title = "Verification connexion";
          if (el.telemetryDotStatus) el.telemetryDotStatus.textContent = "En jeu (dans un menu)";
        }
      }
      function buildTelemetryErrorCopy(reason) {
        var summary = "ERREUR : Télémétrie non connectée";
        return {
          summary: summary,
          detail: "",
          external: summary
        };
      }
      function setTelemetryConnectionState(isConnected, reason) {
        var nextConnected = !!isConnected;
        if (!nextConnected && telemetryOfflineLock) return;
        telemetryConnected = nextConnected;
        telemetryLastErrorReason = telemetryConnected
          ? ""
          : String(reason || "Connexion indisponible.");
        telemetryOfflineLock = !telemetryConnected;
        setTelemetryDotState(telemetryConnected ? "online" : "offline");
        if (!telemetryConnected) {
          var copy = buildTelemetryErrorCopy(telemetryLastErrorReason);
          if (el.telemetryErrorText) el.telemetryErrorText.textContent = copy.summary;
          if (el.telemetryErrorHelp) el.telemetryErrorHelp.textContent = copy.detail;
        }
        if (el.telemetryErrorOverlay) {
          el.telemetryErrorOverlay.hidden = telemetryConnected;
        }
        document.body.classList.toggle("is-telemetry-blocked", !telemetryConnected);
        syncExternalTelemetryBlocks();
      }
      function ensureWindowTelemetryOverlay(win, copy) {
        if (!win || win.closed) return;
        var doc = null;
        try { doc = win.document; } catch (err) { doc = null; }
        if (!doc) return;
        var fallback = buildTelemetryErrorCopy("");
        var safeCopy = copy && typeof copy === "object" ? copy : fallback;
        var summary = String(safeCopy.summary || fallback.summary);
        if (!doc.getElementById("idfTelemetryBlockStyle")) {
          var style = doc.createElement("style");
          style.id = "idfTelemetryBlockStyle";
          style.textContent =
            "#idfTelemetryBlock{position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;padding:20px;}" +
            "#idfTelemetryBlockShell{position:relative;overflow:hidden;width:min(700px,94vw);border-radius:16px;border:1px solid rgba(239,68,68,.28);background:linear-gradient(180deg,rgba(28,33,42,.98) 0%,rgba(18,22,30,.995) 100%);box-shadow:0 18px 42px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.05);padding:clamp(20px,3vw,30px);display:flex;align-items:center;justify-content:center;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;}" +
            "#idfTelemetryBlockShell::after{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,rgba(239,68,68,.1),rgba(239,68,68,.75),rgba(239,68,68,.1));animation:idfTelemetryAccent 3.2s ease-in-out infinite;pointer-events:none;}" +
            "#idfTelemetryBlockText{position:relative;z-index:1;margin:0;color:#f3f4f6;font-size:clamp(calc(18px * var(--idf-notification-scale,1)),calc(2.6vw * var(--idf-notification-scale,1)),calc(24px * var(--idf-notification-scale,1)));line-height:1.35;font-weight:700;letter-spacing:.015em;text-align:center;animation:idfTelemetryTextSoft 3.4s ease-in-out infinite;text-shadow:0 0 8px rgba(239,68,68,.18);}" +
            "@keyframes idfTelemetryTextSoft{0%,100%{opacity:.9;color:#f3f4f6}50%{opacity:1;color:#fee2e2}}" +
            "@keyframes idfTelemetryAccent{0%,100%{opacity:.35}50%{opacity:.85}}";
          try { doc.head.appendChild(style); } catch (err) { }
        }
        try {
          if (doc.documentElement) {
            doc.documentElement.style.setProperty("--idf-notification-scale", String(clampNotificationScalePercent(notificationScalePercent) / 100));
          }
        } catch (errScale) { }

        if (!doc.body) {
          try {
            win.addEventListener("load", function () {
              ensureWindowTelemetryOverlay(win, safeCopy);
            }, { once: true });
          } catch (err) { }
          return;
        }

        var overlay = doc.getElementById("idfTelemetryBlock");
        if (!overlay) {
          overlay = doc.createElement("div");
          overlay.id = "idfTelemetryBlock";
          overlay.innerHTML =
            '<div id="idfTelemetryBlockShell">' +
            '<p id="idfTelemetryBlockText"></p>' +
            "</div>";
          doc.body.appendChild(overlay);
        }
        var textEl = doc.getElementById("idfTelemetryBlockText");
        if (textEl) textEl.textContent = summary;
      }
      function clearWindowTelemetryOverlay(win) {
        if (!win || win.closed) return;
        var doc = null;
        try { doc = win.document; } catch (err) { doc = null; }
        if (!doc) return;
        var overlay = doc.getElementById("idfTelemetryBlock");
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }
      function syncExternalTelemetryBlocks() {
        var copy = buildTelemetryErrorCopy(telemetryLastErrorReason);
        var widgetsLive = typeof areTelemetryWidgetsLive === "function" ? areTelemetryWidgetsLive() : telemetryConnected;
        if (pipWindow && !pipWindow.closed) {
          if (widgetsLive) clearWindowTelemetryOverlay(pipWindow);
          else ensureWindowTelemetryOverlay(pipWindow, copy);
        }
        Object.keys(tabRefs).forEach(function (id) {
          var ref = tabRefs[id];
          if (!ref || ref.closed) return;
          if (widgetsLive) clearWindowTelemetryOverlay(ref);
          else ensureWindowTelemetryOverlay(ref, copy);
        });
      }
      function toFiniteNumber(value) {
        var n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      function pickTelemetryNumber(source, keys) {
        if (!source || typeof source !== "object") return null;
        var aliases = Array.isArray(keys) ? keys : [];
        for (var i = 0; i < aliases.length; i += 1) {
          var key = aliases[i];
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
          var value = toFiniteNumber(source[key]);
          if (value !== null) return value;
        }
        return null;
      }
      function pickTelemetryString(source, keys) {
        if (!source || typeof source !== "object") return "";
        var aliases = Array.isArray(keys) ? keys : [];
        for (var i = 0; i < aliases.length; i += 1) {
          var key = aliases[i];
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
          var value = String(source[key] == null ? "" : source[key]).trim();
          if (value) return value;
        }
        return "";
      }
      function extractTelemetryVehicleName(data) {
        var payload = data && typeof data === "object" ? data : null;
        if (!payload) return "";
        var pools = [payload, payload.data, payload.payload];
        for (var i = 0; i < pools.length; i += 1) {
          var src = pools[i];
          if (!src || typeof src !== "object") continue;
          var name = pickTelemetryString(src, ["vehicleName", "vehicle_name", "vehicle"]);
          if (name) return name;
        }
        return "";
      }
      function extractTelemetrySignal(data) {
        var payload = data && typeof data === "object" ? data : null;
        if (!payload) return null;
        var pools = [
          payload,
          payload.data,
          payload.payload
        ];
        var x = null;
        var y = null;
        var z = null;
        var heading = null;
        var speedKmh = null;
        var truckDamagePercent = null;
        var trailerDamagePercent = null;
        var cargoDamagePercent = null;
        var vehicleName = "";
        for (var i = 0; i < pools.length; i += 1) {
          var src = pools[i];
          if (!src || typeof src !== "object") continue;
          if (x === null) x = pickTelemetryNumber(src, ["x", "X"]);
          if (y === null) y = pickTelemetryNumber(src, ["y", "Y"]);
          if (z === null) z = pickTelemetryNumber(src, ["z", "Z"]);
          if (heading === null) heading = pickTelemetryNumber(src, ["heading", "Heading"]);
          if (speedKmh === null) speedKmh = pickTelemetryNumber(src, ["speedKmh", "speed_kmh", "speed"]);
          if (truckDamagePercent === null) truckDamagePercent = pickTelemetryNumber(src, ["truckDamagePercent", "truck_damage_percent", "damage", "wearSum"]);
          if (trailerDamagePercent === null) trailerDamagePercent = pickTelemetryNumber(src, ["trailerDamagePercent", "trailer_damage_percent", "trailerDamage", "trailerWearSum"]);
          if (cargoDamagePercent === null) cargoDamagePercent = pickTelemetryNumber(src, ["cargoDamagePercent", "cargo_damage_percent", "cargoDamage", "cargoWear"]);
          if (!vehicleName) vehicleName = pickTelemetryString(src, ["vehicleName", "vehicle_name", "vehicle"]);
        }
        if (x === null || y === null || z === null || heading === null) return null;
        return {
          x: x,
          y: y,
          z: z,
          heading: heading,
          speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0,
          truckDamagePercent: Number.isFinite(truckDamagePercent) ? truckDamagePercent : 0,
          trailerDamagePercent: Number.isFinite(trailerDamagePercent) ? trailerDamagePercent : 0,
          cargoDamagePercent: Number.isFinite(cargoDamagePercent) ? cargoDamagePercent : 0,
          vehicleName: vehicleName
        };
      }

      var telemetryPaused = false;
      var saeivIrlPauseTotalMs = 0;
      var saeivIrlPauseStartAtMs = 0;
      var lastWsMessageAt = 0;
      var WS_SILENCE_HIDE_MS = 1000;
      var telemetryVisibilityTimer = 0;
      var telemetryWidgetsHiddenState = null;
      var telemetryWidgetsHiddenNodeCount = -1;
      function normalizeTelemetryBooleanText(value) {
        var text = String(value == null ? "" : value).trim().toLowerCase();
        if (!text) return null;
        if (["true", "1", "yes", "oui", "on", "pause", "paused", "menu", "main_menu", "in_menu"].indexOf(text) >= 0) return true;
        if (["false", "0", "no", "non", "off", "drive", "driving", "game", "play", "playing"].indexOf(text) >= 0) return false;
        return null;
      }
      function readTelemetryBooleanFlag(source, keys) {
        if (!source || typeof source !== "object") return null;
        var foundFalse = false;
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
          var value = source[key];
          if (value === true) return true;
          if (value === false) {
            foundFalse = true;
            continue;
          }
          if (typeof value === "number" && Number.isFinite(value)) {
            if (value !== 0) return true;
            foundFalse = true;
            continue;
          }
          var parsed = normalizeTelemetryBooleanText(value);
          if (parsed === true) return true;
          if (parsed === false) foundFalse = true;
        }
        return foundFalse ? false : null;
      }
      function extractTelemetryPaused(data) {
        var payload = data && typeof data === "object" ? data : null;
        if (!payload) return null;
        var pools = [
          payload,
          payload.data,
          payload.payload,
          payload.gameContext,
          payload.game_context,
          payload.data && payload.data.gameContext,
          payload.data && payload.data.game_context,
          payload.payload && payload.payload.gameContext,
          payload.payload && payload.payload.game_context
        ];
        var pauseKeys = [
          "paused",
          "isPaused",
          "gamePaused",
          "isGamePaused",
          "pause",
          "inMenu",
          "isInMenu",
          "menuOpen",
          "isMenuOpen",
          "mainMenu",
          "isMainMenuOpen",
          "inPauseMenu",
          "isInPauseMenu"
        ];
        var inGameKeys = ["inGame", "isInGame", "gameActive", "isGameActive", "driving", "isDriving"];
        var foundFalse = false;
        for (var i = 0; i < pools.length; i += 1) {
          var src = pools[i];
          if (!src || typeof src !== "object") continue;
          var flag = readTelemetryBooleanFlag(src, pauseKeys);
          if (flag === true) return true;
          if (flag === false) foundFalse = true;
          var inGameFlag = readTelemetryBooleanFlag(src, inGameKeys);
          if (inGameFlag === false) return true;
          if (inGameFlag === true) foundFalse = true;
          var state = pickTelemetryString(src, ["state", "status", "mode", "uiMode", "ui_mode", "gameState", "game_state", "screen", "screenName"]);
          var normalized = state.replace(/[-\s]+/g, "_").toLowerCase();
          if (normalized.indexOf("pause") >= 0 || normalized.indexOf("menu") >= 0) return true;
          if (normalized === "drive" || normalized === "driving" || normalized === "game" || normalized === "play" || normalized === "playing") {
            foundFalse = true;
          }
        }
        return foundFalse ? false : null;
      }
      function normalizeGameContextMapName(value) {
        var raw = String(value == null ? "" : value).trim();
        if (!raw) return "";
        raw = raw.replace(/\\/g, "/");
        var parts = raw.split("/");
        return String(parts[parts.length - 1] || raw).trim().toLowerCase();
      }
      function pickGameContextMapName(source) {
        if (!source || typeof source !== "object") return "";
        return pickTelemetryString(source, [
          "map",
          "mapName",
          "map_name",
          "mapModule",
          "map_module",
          "mapFile",
          "map_file",
          "mapId",
          "map_id",
          "currentMap",
          "current_map"
        ]);
      }
      function hasTelemetryCoordinateFields(source) {
        if (!source || typeof source !== "object") return false;
        return (
          (Object.prototype.hasOwnProperty.call(source, "x") || Object.prototype.hasOwnProperty.call(source, "X")) &&
          (Object.prototype.hasOwnProperty.call(source, "y") || Object.prototype.hasOwnProperty.call(source, "Y")) &&
          (Object.prototype.hasOwnProperty.call(source, "z") || Object.prototype.hasOwnProperty.call(source, "Z")) &&
          (Object.prototype.hasOwnProperty.call(source, "heading") || Object.prototype.hasOwnProperty.call(source, "Heading"))
        );
      }
      function findGameContextPayload(data) {
        var payload = data && typeof data === "object" ? data : null;
        if (!payload) return null;
        var pools = [
          { value: payload, nested: false },
          { value: payload.data, nested: false },
          { value: payload.payload, nested: false },
          { value: payload.gameContext, nested: true },
          { value: payload.game_context, nested: true }
        ];
        for (var i = 0; i < pools.length; i += 1) {
          var entry = pools[i];
          var src = entry && entry.value;
          if (!src || typeof src !== "object") continue;
          var type = String(src.type || src.kind || "").trim().toLowerCase();
          if (type === "gamecontext" || type === "game_context") {
            if (pickGameContextMapName(src)) return src;
            if (src.data && typeof src.data === "object" && pickGameContextMapName(src.data)) return src.data;
            if (src.payload && typeof src.payload === "object" && pickGameContextMapName(src.payload)) return src.payload;
            if (src.gameContext && typeof src.gameContext === "object" && pickGameContextMapName(src.gameContext)) return src.gameContext;
            if (src.game_context && typeof src.game_context === "object" && pickGameContextMapName(src.game_context)) return src.game_context;
            return src;
          }
          if (entry.nested && pickGameContextMapName(src)) return src;
          if (!type && pickGameContextMapName(src) && !hasTelemetryCoordinateFields(src)) return src;
        }
        return null;
      }
      function syncGameContextBlockModal() {
        var modal = document.getElementById("gameContextBlockModal");
        if (!modal) return;
        var textEl = document.getElementById("gameContextBlockText");
        if (textEl) {
          var systemLabel = (typeof readSystemName === "function" ? readSystemName() : "") || "Systeme";
          textEl.textContent = systemLabel + " n'est pas compatible avec ce profil.\nVous devez démarrer un profil avec la map Île-de-France de chargée.";
        }
        var visible = telemetryUiMode === 2 && gameContextMapBlocked === true;
        modal.style.display = visible ? "flex" : "none";
        modal.setAttribute("aria-hidden", visible ? "false" : "true");
        document.body.classList.toggle("is-game-context-blocked", gameContextMapBlocked === true);
      }
      function reloadPageForGameContextChange() {
        if (gameContextReloadPending) return;
        gameContextReloadPending = true;
        try { sessionStorage.removeItem(RELOAD_NOTICE_INTENT_KEY); } catch (err0) { }
        try { sessionStorage.removeItem("overlay_reload_tab_intent"); } catch (err1) { }
        window.location.reload();
      }
      function handleTelemetryGameContext(data) {
        var context = findGameContextPayload(data);
        if (!context) return false;
        var mapName = pickGameContextMapName(context);
        if (!mapName) return false;
        var previousMap = normalizeGameContextMapName(gameContextMapName);
        var nextMap = normalizeGameContextMapName(mapName);
        var mapChanged = !!previousMap && !!nextMap && previousMap !== nextMap;
        gameContextMapName = mapName;
        try { sessionStorage.setItem("idf_game2_last_context_map", mapName); } catch (err0) { }
        gameContextMapBlocked = nextMap !== REQUIRED_GAME_CONTEXT_MAP;
        syncGameContextBlockModal();
        if (mapChanged) {
          reloadPageForGameContextChange();
        }
        return true;
      }
      function refreshTelemetryVisibility() {
        if (el.overlayRoot) {
          el.overlayRoot.style.removeProperty("visibility");
        }
        hardSetTelemetryPausedWidgetsHidden(shouldHideTelemetryWidgets());
        syncExternalTelemetryBlocks();
      }
      function hasRecentTelemetryPositionSignal(nowMs) {
        var lastPacketAt = Number(telemetryLastPacketAt);
        if (!Number.isFinite(lastPacketAt) || lastPacketAt <= 0) return false;
        var now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
        var maxAge = Math.max(600, Number(TELEMETRY_PACKET_TIMEOUT_MS) || 1000);
        return now - lastPacketAt <= maxAge;
      }
      function shouldHideTelemetryWidgets() {
        if (telemetryUiMode === 2) return false;
        return telemetryPaused === true || !hasRecentTelemetryPositionSignal();
      }
      function areTelemetryWidgetsLive() {
        return telemetryConnected === true && !shouldHideTelemetryWidgets();
      }
      function hardSetTelemetryPausedWidgetsHidden(hidden) {
        var nextHidden = !!hidden;
        var widgets = document.querySelectorAll(".overlay-window[data-widget-type]");
        if (
          telemetryWidgetsHiddenState === nextHidden &&
          telemetryWidgetsHiddenNodeCount === widgets.length
        ) {
          return;
        }
        telemetryWidgetsHiddenState = nextHidden;
        telemetryWidgetsHiddenNodeCount = widgets.length;
        document.body.classList.toggle("is-telemetry-paused-widgets", nextHidden);
        document.body.classList.toggle("is-telemetry-widgets-hidden", nextHidden);

        widgets.forEach(function (widget) {
            if (nextHidden) {
              widget.style.setProperty("display", "none", "important");
              widget.style.setProperty("opacity", "0", "important");
              widget.style.setProperty("visibility", "hidden", "important");
              widget.style.setProperty("pointer-events", "none", "important");
              widget.style.setProperty("transition", "none", "important");
              widget.style.setProperty("animation", "none", "important");
            } else {
              widget.style.removeProperty("display");
              widget.style.removeProperty("opacity");
              widget.style.removeProperty("visibility");
              widget.style.removeProperty("pointer-events");
              widget.style.removeProperty("transition");
              widget.style.removeProperty("animation");
            }

            widget
              .querySelectorAll(".overlay-window-content, .overlay-window-frame, iframe")
              .forEach(function (el) {
                if (nextHidden) {
                  el.style.setProperty("display", "none", "important");
                  el.style.setProperty("opacity", "0", "important");
                  el.style.setProperty("visibility", "hidden", "important");
                  el.style.setProperty("pointer-events", "none", "important");
                  el.style.setProperty("transition", "none", "important");
                  el.style.setProperty("animation", "none", "important");
                } else {
                  el.style.removeProperty("display");
                  el.style.removeProperty("opacity");
                  el.style.removeProperty("visibility");
                  el.style.removeProperty("pointer-events");
                  el.style.removeProperty("transition");
                  el.style.removeProperty("animation");
                }
              });
          });
      }
      function applyTelemetryPausedState(pausedRaw, options) {
        var nextPaused = !!pausedRaw;
        var changed = telemetryPaused !== nextPaused;
        var force = !!(options && options.force);
        telemetryPaused = nextPaused;

        document.body.classList.toggle("is-telemetry-paused", telemetryPaused);
        if (!changed && !force) return false;

        // Les widgets ne sont visibles qu'avec une position recente et hors pause/menu.
        refreshTelemetryVisibility();

        updateSaeivSimulationPauseState();
        syncWidgetsPauseState();

        // Sécurité après sync/rerender.
        refreshTelemetryVisibility();
        return true;
      }
      function startTelemetryVisibilityWatch() {
        if (telemetryVisibilityTimer) return;
        telemetryVisibilityTimer = setInterval(refreshTelemetryVisibility, 500);
      }

      var OVERLAY_SHORTCUT_SCOPE_OVERLAY = "idf_telemetry";
      var OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE = "idf_telemetry_destination_announcement";
      var OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS = "idf_telemetry_zoom_gps";
      var OVERLAY_SHORTCUT_SCOPE_HIDE_UI = "idf_telemetry_hide_ui";
      var OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST = "idf_telemetry_player_list";
      var PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED = true;
      var OVERLAY_ZOOM_GPS_DEFAULT_SHORTCUT = {
        keys: ["F5"],
        display: "F5"
      };
      var OVERLAY_HIDE_UI_DEFAULT_SHORTCUT = {
        keys: ["F3"],
        display: "F3"
      };
      var OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT = {
        keys: ["T"],
        display: "T"
      };
      var OVERLAY_PLAYER_LIST_DEFAULT_SHORTCUT = {
        keys: ["Tab"],
        display: "Tab"
      };
      var OVERLAY_TOGGLE_DEFAULT_SHORTCUT = {
        keys: ["Delete"],
        display: "Suppr"
      };
      var overlayShortcutBtn = null;
      var overlayDestinationShortcutBtn = null;
      var overlayZoomGpsShortcutBtn = null;
      var overlayHideUiShortcutBtn = null;
      var overlayPlayerListShortcutBtn = null;
      var playerListShortcutHoldActive = false;
      var playerListShortcutUnavailableNotifiedAt = 0;
      var isRecordingShortcut = false;
      var recordingShortcutScope = OVERLAY_SHORTCUT_SCOPE_OVERLAY;
      var overlayShortcutStateByScope = {
        idf_telemetry: null,
        idf_telemetry_destination_announcement: {
          keys: ["T"],
          display: "T"
        },
        idf_telemetry_zoom_gps: {
          keys: ["F5"],
          display: "F5"
        },
        idf_telemetry_hide_ui: {
          keys: ["F3"],
          display: "F3"
        },
        idf_telemetry_player_list: {
          keys: ["Tab"],
          display: "Tab"
        }
      };

      function normalizeOverlayShortcutScope(scope) {
        var safeScope = String(scope || "").trim();
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) return OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) return OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) return OVERLAY_SHORTCUT_SCOPE_HIDE_UI;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) return OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST;
        return OVERLAY_SHORTCUT_SCOPE_OVERLAY;
      }
      function getShortcutScopeLabel(scope) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) return "Annonce Destination";
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) return "Zoom GPS";
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) return "Cacher l'UI en jeu";
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) return "Liste joueurs";
        return "Menu Principal";
      }
      function getOverlayShortcutButtonByScope(scope) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) {
          if (!overlayDestinationShortcutBtn) {
            overlayDestinationShortcutBtn = document.getElementById("overlayDestinationShortcutBtn");
          }
          return overlayDestinationShortcutBtn;
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) {
          if (!overlayZoomGpsShortcutBtn) {
            overlayZoomGpsShortcutBtn = document.getElementById("overlayZoomGpsShortcutBtn");
          }
          return overlayZoomGpsShortcutBtn;
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) {
          if (!overlayHideUiShortcutBtn) {
            overlayHideUiShortcutBtn = document.getElementById("overlayHideUiShortcutBtn");
          }
          return overlayHideUiShortcutBtn;
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) {
          if (!overlayPlayerListShortcutBtn) {
            overlayPlayerListShortcutBtn = document.getElementById("overlayPlayerListShortcutBtn");
          }
          return overlayPlayerListShortcutBtn;
        }
        if (!overlayShortcutBtn) {
          overlayShortcutBtn = document.getElementById("overlayShortcutBtn");
        }
        return overlayShortcutBtn;
      }
      function shortcutDisplayText(shortcut, fallbackText) {
        var safeFallback = String(fallbackText || "").trim();
        if (!shortcut || typeof shortcut !== "object") return safeFallback;
        var display = String(shortcut.display || "").trim();
        if (display) return display;
        var keys = Array.isArray(shortcut.keys) ? shortcut.keys : [];
        if (!keys.length) return safeFallback;
        return keys.join(" + ");
      }
      function cloneShortcutConfig(shortcut) {
        if (!shortcut || typeof shortcut !== "object") return null;
        var keys = Array.isArray(shortcut.keys)
          ? shortcut.keys.map(function (k) { return String(k || "").trim(); }).filter(Boolean)
          : [];
        var display = String(shortcut.display || "").trim();
        if (!keys.length && !display) return null;
        return {
          keys: keys,
          display: display
        };
      }
      function normalizeShortcutKeyToken(token) {
        var raw = String(token || "").trim();
        if (!raw) return "";
        var lower = raw.toLowerCase();
        if (lower === "control" || lower === "ctrl") return "ctrl";
        if (lower === "shift") return "shift";
        if (lower === "alt") return "alt";
        if (lower === "meta" || lower === "win" || lower === "os") return "win";
        if (lower === "delete" || lower === "del" || lower === "suppr") return "suppr";
        if (lower === "escape" || lower === "esc" || lower === "echap") return "echap";
        if (lower === "enter" || lower === "return" || lower === "entree" || lower === "entrée") return "entree";
        if (lower === " " || lower === "space" || lower === "espace") return "espace";
        if (lower === "tab") return "tab";
        if (lower === "arrowup" || lower === "up" || lower === "haut") return "up";
        if (lower === "arrowdown" || lower === "down" || lower === "bas") return "down";
        if (lower === "arrowleft" || lower === "left" || lower === "gauche") return "left";
        if (lower === "arrowright" || lower === "right" || lower === "droite") return "right";
        return raw.length === 1 ? raw.toUpperCase() : raw;
      }
      function shortcutSignature(shortcut) {
        var cfg = cloneShortcutConfig(shortcut);
        if (!cfg || !Array.isArray(cfg.keys) || !cfg.keys.length) return "";
        return cfg.keys.map(normalizeShortcutKeyToken).filter(Boolean).join("+");
      }
      function getEffectiveShortcutForScope(scope) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        var current = cloneShortcutConfig(overlayShortcutStateByScope[safeScope]);
        if (current) return current;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) {
          return cloneShortcutConfig(OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT);
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) {
          return cloneShortcutConfig(OVERLAY_ZOOM_GPS_DEFAULT_SHORTCUT);
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) {
          return cloneShortcutConfig(OVERLAY_HIDE_UI_DEFAULT_SHORTCUT);
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) {
          return cloneShortcutConfig(OVERLAY_PLAYER_LIST_DEFAULT_SHORTCUT);
        }
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_OVERLAY) {
          return cloneShortcutConfig(OVERLAY_TOGGLE_DEFAULT_SHORTCUT);
        }
        return null;
      }
      function setShortcutStateForScope(scope, shortcut) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        overlayShortcutStateByScope[safeScope] = cloneShortcutConfig(shortcut);
      }
      function getConflictingShortcutScope(scope, shortcut) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        var targetSig = shortcutSignature(shortcut);
        if (!targetSig) return null;

        var allScopes = [
          OVERLAY_SHORTCUT_SCOPE_OVERLAY,
          OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE,
          OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS,
          OVERLAY_SHORTCUT_SCOPE_HIDE_UI,
          OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST
        ];
        for (var i = 0; i < allScopes.length; i++) {
          var s = allScopes[i];
          if (s === safeScope) continue;
          var otherSig = shortcutSignature(getEffectiveShortcutForScope(s));
          if (otherSig && targetSig === otherSig) return s;
        }
        return null;
      }
      function updateShortcutUIForScope(scope, shortcut) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        setShortcutStateForScope(safeScope, shortcut);
        var button = getOverlayShortcutButtonByScope(safeScope);
        if (!button) return;
        var effectiveShortcut = getEffectiveShortcutForScope(safeScope);
        var fallbackText = "[ Aucun ]";
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) fallbackText = shortcutDisplayText(OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT, "T");
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) fallbackText = shortcutDisplayText(OVERLAY_ZOOM_GPS_DEFAULT_SHORTCUT, "F5");
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) fallbackText = shortcutDisplayText(OVERLAY_HIDE_UI_DEFAULT_SHORTCUT, "F3");
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) fallbackText = shortcutDisplayText(OVERLAY_PLAYER_LIST_DEFAULT_SHORTCUT, "Tab");
        var textSpan = button.querySelector(".shortcut-text");
        if (textSpan) {
          textSpan.textContent = shortcutDisplayText(effectiveShortcut, fallbackText);
        } else {
          button.textContent = shortcutDisplayText(effectiveShortcut, fallbackText);
        }
      }

      function handleOverlayShortcutMessage(data) {
        if (!data || typeof data !== "object") return;
        var scope = normalizeOverlayShortcutScope(data.scope);
        if (data.action === "trigger") {
          if (scope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) {
            triggerSaeivDestinationAnnouncementFromShortcut();
            return;
          }
          if (scope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) {
            triggerGpsZoomFromShortcut();
            return;
          }
          if (scope === OVERLAY_SHORTCUT_SCOPE_OVERLAY) {
            applyTelemetryUiMode(telemetryUiMode === 2 ? 1 : 2);
            return;
          }
          if (scope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) {
            triggerHideUiToggleFromShortcut();
            return;
          }
          if (scope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) {
            return;
          }

        }
        if (isRecordingShortcut) return;
        if (data.action === "current") {
          // Si le serveur n'a pas encore de raccourci pour ce scope, on lui envoie le défaut
          if (!data.shortcut || !data.shortcut.keys || !data.shortcut.keys.length) {
            var defaultConfig = OVERLAY_TOGGLE_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) defaultConfig = OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) defaultConfig = OVERLAY_ZOOM_GPS_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) defaultConfig = OVERLAY_HIDE_UI_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) defaultConfig = OVERLAY_PLAYER_LIST_DEFAULT_SHORTCUT;

            sendShortcutToBridge(defaultConfig.keys, defaultConfig.display, scope);
          }
          updateShortcutUIForScope(scope, data.shortcut);
        }
      }

      function triggerHideUiToggleFromShortcut() {
        var next = !hideUiWhenManagerHidden;

        applyHideUiWhenManagerHidden(next, {
          syncUi: true,
          render: true
        });

        saveWidgetLayoutState();

        if (typeof showOverlayNotification === "function") {
          showOverlayNotification(
            next ? "UI en jeu masquée" : "UI en jeu affichée",
            1200
          );
        }
      }

      function triggerGpsZoomFromShortcut(direction) {
        var zoomDirection = String(direction || "out").trim().toLowerCase() === "in" ? "in" : "out";
        var zoomSyncState = null;
        document
          .querySelectorAll('iframe[data-widget-type="gps_mini"], iframe[data-widget-type="waze"]')
          .forEach(function (frame) {
            if (zoomSyncState) return;
            try {
              var win = frame && frame.contentWindow;
              if (!win || typeof win.idfGpsGetZoomSyncState !== "function") return;
              var state = win.idfGpsGetZoomSyncState();
              if (state && typeof state === "object") {
                zoomSyncState = state;
              }
            } catch (err) { }
          });

        if (zoomSyncState) {
          var syncPayload = { kind: "waze-dev", type: "zoom_sync", source: "game", zoomState: zoomSyncState };
          sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_WAZE, syncPayload);
          document
            .querySelectorAll('iframe[data-widget-type="gps_mini"], iframe[data-widget-type="waze"]')
            .forEach(function (frame) {
              try {
                if (frame.contentWindow) {
                  if (typeof frame.contentWindow.idfGpsApplyZoomSyncState === "function") {
                    frame.contentWindow.idfGpsApplyZoomSyncState(zoomSyncState);
                  }
                  frame.contentWindow.postMessage({
                    scope: WIDGET_BRIDGE_SCOPE,
                    channel: WIDGET_BRIDGE_CHANNEL_WAZE,
                    payload: syncPayload,
                    ts: Date.now()
                  }, "*");
                }
              } catch (err) { }
            });
        }

        var payload = { kind: "waze-dev", type: zoomDirection === "out" ? "zoom_out" : "zoom_in", source: "game" };

        // Chemin existant via WebSocket / bridge
        sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_WAZE, payload);
        sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_SAEIV, { kind: "saeiv-dev", type: payload.type, source: "game" });

        // Fallback direct vers les iframes GPS visibles dans l'overlay
        document
          .querySelectorAll('iframe[data-widget-type="gps_mini"], iframe[data-widget-type="waze"], iframe[data-widget-type="gps_ets2_old"]')
          .forEach(function (frame) {
            try {
              if (frame.contentWindow) {
                frame.contentWindow.postMessage({
                  scope: WIDGET_BRIDGE_SCOPE,
                  channel: WIDGET_BRIDGE_CHANNEL_WAZE,
                  payload: payload,
                  ts: Date.now()
                }, "*");
              }
            } catch (err) { }
          });
      }
      function isShiftModifierActive(raw) {
        if (!raw || typeof raw !== "object") return false;
        if (raw.shiftKey === true || raw.shift === true) return true;
        var keys = Array.isArray(raw.keys) ? raw.keys : [];
        for (var i = 0; i < keys.length; i += 1) {
          if (String(keys[i] || "").trim().toLowerCase() === "shift") return true;
        }
        var modifiers = raw.modifiers;
        if (Array.isArray(modifiers)) {
          for (var j = 0; j < modifiers.length; j += 1) {
            if (String(modifiers[j] || "").trim().toLowerCase() === "shift") return true;
          }
        } else if (typeof modifiers === "string") {
          if (/(^|[,+\s])shift($|[,+\s])/i.test(modifiers)) return true;
        } else if (modifiers && typeof modifiers === "object") {
          if (modifiers.shift === true || modifiers.Shift === true) return true;
        }
        return false;
      }

      function isRawShortcutModifierActive(raw, name) {
        if (!raw || typeof raw !== "object") return false;
        var safeName = String(name || "").trim().toLowerCase();
        if (!safeName) return false;
        if (safeName === "ctrl" && (raw.ctrlKey === true || raw.controlKey === true || raw.ctrl === true || raw.control === true)) return true;
        if (safeName === "shift" && (raw.shiftKey === true || raw.shift === true)) return true;
        if (safeName === "alt" && (raw.altKey === true || raw.alt === true)) return true;
        if (safeName === "win" && (raw.metaKey === true || raw.winKey === true || raw.meta === true || raw.win === true)) return true;
        var keys = Array.isArray(raw.keys) ? raw.keys : [];
        for (var i = 0; i < keys.length; i += 1) {
          var key = normalizeShortcutKeyToken(keys[i]).toLowerCase();
          if (safeName === "ctrl" && key === "ctrl") return true;
          if (safeName === "shift" && key === "shift") return true;
          if (safeName === "alt" && key === "alt") return true;
          if (safeName === "win" && key === "win") return true;
        }
        var modifiers = raw.modifiers;
        if (Array.isArray(modifiers)) {
          for (var j = 0; j < modifiers.length; j += 1) {
            if (normalizeShortcutKeyToken(modifiers[j]).toLowerCase() === safeName) return true;
          }
        } else if (typeof modifiers === "string") {
          if (new RegExp("(^|[,+\\s])" + safeName + "($|[,+\\s])", "i").test(modifiers)) return true;
        } else if (modifiers && typeof modifiers === "object") {
          if (safeName === "ctrl" && (modifiers.ctrl === true || modifiers.control === true)) return true;
          if (safeName === "shift" && modifiers.shift === true) return true;
          if (safeName === "alt" && modifiers.alt === true) return true;
          if (safeName === "win" && (modifiers.win === true || modifiers.meta === true)) return true;
        }
        return false;
      }
      function normalizeBrowserShortcutMainKey(key) {
        var mainKey = String(key || "").trim();
        if (!mainKey) return "";
        var lower = mainKey.toLowerCase();
        if (mainKey === " ") return "Espace";
        if (lower === "delete" || lower === "del") return "Suppr";
        if (lower === "escape" || lower === "esc") return "Echap";
        if (lower === "enter" || lower === "return") return "Entree";
        if (lower === "arrowup") return "Up";
        if (lower === "arrowdown") return "Down";
        if (lower === "arrowleft") return "Left";
        if (lower === "arrowright") return "Right";
        if (lower === "backspace") return "Backspace";
        if (lower === "tab") return "Tab";
        if (lower === "insert") return "Insert";
        if (lower === "home") return "Home";
        if (lower === "end") return "End";
        if (lower === "pageup") return "PageUp";
        if (lower === "pagedown") return "PageDown";
        return mainKey.length === 1 ? mainKey.toUpperCase() : mainKey;
      }
      function shortcutMatchesKeySet(scope, keys) {
        var shortcut = getEffectiveShortcutForScope(scope);
        var eventShortcut = {
          keys: Array.isArray(keys) ? keys : [],
          display: ""
        };
        return !!shortcutSignature(eventShortcut) && shortcutSignature(eventShortcut) === shortcutSignature(shortcut);
      }
      function shortcutMatchesRawKeyEvent(scope, keyName, raw) {
        var keys = [];
        if (isRawShortcutModifierActive(raw, "ctrl")) keys.push("Ctrl");
        if (isRawShortcutModifierActive(raw, "shift")) keys.push("Shift");
        if (isRawShortcutModifierActive(raw, "alt")) keys.push("Alt");
        if (isRawShortcutModifierActive(raw, "win")) keys.push("Win");
        keys.push(normalizeBrowserShortcutMainKey(keyName));
        return shortcutMatchesKeySet(scope, keys);
      }
      function shortcutMatchesBrowserEvent(scope, event) {
        if (!event || typeof event !== "object") return false;
        var keyName = normalizeBrowserShortcutMainKey(event.key);
        if (!keyName) return false;
        var keys = [];
        if (event.ctrlKey) keys.push("Ctrl");
        if (event.shiftKey) keys.push("Shift");
        if (event.altKey) keys.push("Alt");
        if (event.metaKey) keys.push("Win");
        keys.push(keyName);
        return shortcutMatchesKeySet(scope, keys);
      }
      function extractRemoteServerPlayersCount(parsed) {
        var roots = [parsed, parsed && parsed.data, parsed && parsed.payload];
        for (var i = 0; i < roots.length; i += 1) {
          var root = roots[i];
          if (!root || typeof root !== "object") continue;
          var keys = [
            "players",
            "playerCount",
            "player_count",
            "connectedPlayers",
            "connected_players",
            "onlinePlayers",
            "online_players",
            "connections",
            "clients",
            "count"
          ];
          for (var j = 0; j < keys.length; j += 1) {
            var value = root[keys[j]];
            if (Array.isArray(value)) return value.length;
            var n = Number(value);
            if (Number.isFinite(n) && n >= 0) return Math.max(0, Math.floor(n));
          }
        }
        return null;
      }
      function normalizeRemoteServerPlayerListEntry(entry, index) {
        if (typeof entry === "string") {
          var text = String(entry || "").trim();
          return text ? { name: text } : null;
        }
        if (!entry || typeof entry !== "object") return null;
        var keys = [
          "displayname",
          "displayName",
          "display_name",
          "steamName",
          "steam_name",
          "personaname",
          "personaName",
          "nickname",
          "name",
          "playerName",
          "player_name",
          "username",
          "userName"
        ];
        var name = "";
        for (var i = 0; i < keys.length; i += 1) {
          var value = String(entry[keys[i]] || "").trim();
          if (value) {
            name = value;
            break;
          }
        }
        if (!name) name = "Joueur " + (index + 1);
        return { name: name };
      }
      function extractRemoteServerPlayerList(parsed) {
        var roots = [parsed, parsed && parsed.data, parsed && parsed.payload];
        var keys = [
          "playerList",
          "player_list",
          "playersList",
          "players_list",
          "connectedPlayers",
          "connected_players",
          "onlinePlayers",
          "online_players",
          "clients",
          "connections",
          "players"
        ];
        for (var i = 0; i < roots.length; i += 1) {
          var root = roots[i];
          if (!root || typeof root !== "object") continue;
          for (var j = 0; j < keys.length; j += 1) {
            var value = root[keys[j]];
            var list = [];
            if (Array.isArray(value)) {
              list = value;
            } else if (value && typeof value === "object" && !Number.isFinite(Number(value))) {
              list = Object.keys(value).map(function (key) { return value[key]; });
            }
            if (!list.length) continue;
            var normalized = list
              .map(function (entry, index) { return normalizeRemoteServerPlayerListEntry(entry, index); })
              .filter(Boolean);
            if (normalized.length) return normalized;
          }
        }
        return [];
      }
      function readTelemetryConvoyActiveFromSource(source) {
        if (!source || typeof source !== "object") return null;
        var gameContext = source.gameContext || source.game_context;
        if (gameContext && typeof gameContext === "object") {
          var inServerValue = gameContext.inServer;
          if (typeof inServerValue === "boolean") return inServerValue;
          if (inServerValue === 1 || inServerValue === "1" || inServerValue === "true") return true;
          if (inServerValue === 0 || inServerValue === "0" || inServerValue === "false") return false;
        }
        var keys = ["inServer", "inConvoy", "isInConvoy", "convoyActive", "isConvoy", "multiplayer", "isMultiplayer"];
        for (var i = 0; i < keys.length; i += 1) {
          if (!Object.prototype.hasOwnProperty.call(source, keys[i])) continue;
          var value = source[keys[i]];
          if (typeof value === "boolean") return value;
          if (value === 1 || value === "1" || value === "true") return true;
          if (value === 0 || value === "0" || value === "false") return false;
        }
        var convoy = source.convoy || source.Convoy || source.session || source.multiplayerSession;
        if (convoy && typeof convoy === "object") {
          return readTelemetryConvoyActiveFromSource(convoy);
        }
        return null;
      }
      function updateTelemetryConvoyState(raw, signal) {
        var roots = [
          raw,
          raw && raw.data,
          raw && raw.payload,
          raw && raw.gameContext,
          raw && raw.game_context,
          raw && raw.data && raw.data.gameContext,
          raw && raw.data && raw.data.game_context,
          raw && raw.payload && raw.payload.gameContext,
          raw && raw.payload && raw.payload.game_context,
          raw && raw.convoy,
          raw && raw.session,
          signal,
          signal && signal.data,
          signal && signal.payload,
          signal && signal.gameContext,
          signal && signal.game_context,
          signal && signal.data && signal.data.gameContext,
          signal && signal.data && signal.data.game_context,
          signal && signal.payload && signal.payload.gameContext,
          signal && signal.payload && signal.payload.game_context,
          signal && signal.convoy,
          signal && signal.session
        ];
        var active = null;
        for (var i = 0; i < roots.length; i += 1) {
          active = readTelemetryConvoyActiveFromSource(roots[i]);
          if (active !== null) break;
        }
        if (active !== null) {
          telemetryConvoyActive = active;
          if (active === false) telemetryConvoyPlayerList = [];
        }
        if (typeof extractRemoteServerPlayerList === "function") {
          for (var j = 0; j < roots.length; j += 1) {
            var list = [];
            try { list = extractRemoteServerPlayerList(roots[j]); } catch (errList) { list = []; }
            if (!list.length) continue;
            telemetryConvoyPlayerList = list;
            remoteServerWsPlayerList = list;
            remoteServerWsPlayersCount = list.length;
            break;
          }
        }
      }
      function getKnownConvoyPlayersCount() {
        if (Array.isArray(telemetryConvoyPlayerList) && telemetryConvoyPlayerList.length > 0) {
          return telemetryConvoyPlayerList.length;
        }
        if (telemetryConvoyActive !== true) return null;
        var wsCount = Number(remoteServerWsPlayersCount);
        if (Number.isFinite(wsCount) && wsCount >= 0) return Math.floor(wsCount);
        var listCount = Array.isArray(remoteServerWsPlayerList) ? remoteServerWsPlayerList.length : 0;
        if (listCount > 0) return listCount;
        return null;
      }
      function isLocalPlayerInConvoy() {
        return telemetryConvoyActive === true;
      }
      function isPlayerListAvailableForCurrentConvoy() {
        return isLocalPlayerInConvoy();
      }
      function ensurePlayerListHoldPopupElements() {
        if (!el.playerListHoldPopup) el.playerListHoldPopup = document.getElementById("playerListHoldPopup");
        if (!el.playerListHoldMeta) el.playerListHoldMeta = document.getElementById("playerListHoldMeta");
        if (!el.playerListHoldBody) el.playerListHoldBody = document.getElementById("playerListHoldBody");
        return !!(el.playerListHoldPopup && el.playerListHoldMeta && el.playerListHoldBody);
      }
      function renderPlayerListHoldPopup() {
        if (!ensurePlayerListHoldPopupElements()) return false;
        var players = Array.isArray(telemetryConvoyPlayerList) && telemetryConvoyPlayerList.length
          ? telemetryConvoyPlayerList.slice()
          : (Array.isArray(remoteServerWsPlayerList) ? remoteServerWsPlayerList.slice() : []);
        var knownPlayersCount = getKnownConvoyPlayersCount();
        var playersCount = Number.isFinite(Number(knownPlayersCount)) ? Number(knownPlayersCount) : players.length;
        playersCount = Math.max(0, Math.floor(Number(playersCount) || 0));
        el.playerListHoldMeta.textContent = Number.isFinite(Number(knownPlayersCount))
          ? playersCount + " joueur" + (playersCount > 1 ? "s" : "") + " en convoi"
          : "Convoi actif";
        el.playerListHoldBody.innerHTML = "";
        if (players.length) {
          players.forEach(function (player, index) {
            var row = document.createElement("div");
            row.className = "player-list-row";
            var number = document.createElement("span");
            number.className = "player-list-row-index";
            number.textContent = String(index + 1).padStart(2, "0");
            var name = document.createElement("span");
            name.className = "player-list-row-name";
            name.textContent = String(player && player.name || player || ("Joueur " + (index + 1)));
            row.appendChild(number);
            row.appendChild(name);
            el.playerListHoldBody.appendChild(row);
          });
        } else {
          var empty = document.createElement("p");
          empty.className = "player-list-empty";
          empty.textContent = playersCount > 0
            ? "Liste detaillee non recue. " + playersCount + " joueur" + (playersCount > 1 ? "s" : "") + " detecte" + (playersCount > 1 ? "s" : "") + "."
            : "Liste detaillee non recue.";
          el.playerListHoldBody.appendChild(empty);
        }
        return true;
      }
      function showPlayerListHoldPopup() {
        if (!renderPlayerListHoldPopup()) return false;
        playerListShortcutHoldActive = true;
        el.playerListHoldPopup.classList.add("is-visible");
        el.playerListHoldPopup.setAttribute("aria-hidden", "false");
        return true;
      }
      function hidePlayerListHoldPopup() {
        playerListShortcutHoldActive = false;
        if (!ensurePlayerListHoldPopupElements()) return false;
        el.playerListHoldPopup.classList.remove("is-visible");
        el.playerListHoldPopup.setAttribute("aria-hidden", "true");
        return true;
      }
      function notifyPlayerListUnavailableInSolo() {
        var now = Date.now();
        if (now - playerListShortcutUnavailableNotifiedAt < 1200) return;
        playerListShortcutUnavailableNotifiedAt = now;
        if (typeof showOverlayNotification === "function") {
          showOverlayNotification("Liste des joueurs indisponible en solo", 1800);
        }
      }
      function triggerPlayerListHoldDown(source) {
        if (PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) {
          hidePlayerListHoldPopup();
          return false;
        }
        if (isRecordingShortcut) return false;
        if (telemetryUiMode !== 1) return false;
        if (!isPlayerListAvailableForCurrentConvoy()) {
          hidePlayerListHoldPopup();
          notifyPlayerListUnavailableInSolo();
          return true;
        }
        return showPlayerListHoldPopup();
      }
      function triggerPlayerListHoldUp() {
        if (PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) {
          hidePlayerListHoldPopup();
          return false;
        }
        if (!playerListShortcutHoldActive) return false;
        return hidePlayerListHoldPopup();
      }
      function isRawKeyDownPhase(raw, phase) {
        if (phase === "down" || phase === "keydown" || phase === "pressed" || phase === "press") return true;
        if (raw && (raw.down === true || raw.isDown === true || raw.pressed === true)) return true;
        return false;
      }
      function isRawKeyUpPhase(raw, phase) {
        if (phase === "up" || phase === "keyup" || phase === "released" || phase === "release") return true;
        if (raw && (raw.up === true || raw.isUp === true || raw.released === true)) return true;
        return false;
      }

      /**
       * Gestionnaire des evenements clavier natifs envoyes par le serveur telemetry
       * Permet de reagir a des touches precises (ex: VK_E = 0x45)
       */
      function handleKeyEvent(raw) {
        if (!raw || raw.type !== "keyEvent") return;
        var rawPhase = String(raw.phase || "").trim().toLowerCase();
        var rawVk = Number(raw.vk);
        var rawKeyName = VK_MAP[rawVk] || "0x" + rawVk.toString(16).toUpperCase();

        if (!PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED && shortcutMatchesRawKeyEvent(OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST, rawKeyName, raw)) {
          if (isRawKeyDownPhase(raw, rawPhase) && !raw.repeat) {
            triggerPlayerListHoldDown("telemetry");
            return;
          }
          if (isRawKeyUpPhase(raw, rawPhase)) {
            triggerPlayerListHoldUp();
            return;
          }
        }

        // On ne traite que l'appui initial (down) et on ignore l'auto-repeat du clavier
        if (raw.phase === "down" && !raw.repeat) {
          var vk = Number(raw.vk);
          var keyName = VK_MAP[vk] || "0x" + vk.toString(16).toUpperCase();

          // --- Support des raccourcis via le flux VK ---
          // On vérifie si la touche pressée correspond à l'un de nos raccourcis enregistrés
          var zoomGpsShortcut = getEffectiveShortcutForScope(OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS);
          if (zoomGpsShortcut && zoomGpsShortcut.keys && zoomGpsShortcut.keys.indexOf(keyName) >= 0) {
            triggerGpsZoomFromShortcut(isShiftModifierActive(raw) ? "in" : "out");
          }

          var hideUiShortcut = getEffectiveShortcutForScope(OVERLAY_SHORTCUT_SCOPE_HIDE_UI);
          if (hideUiShortcut && hideUiShortcut.keys && hideUiShortcut.keys.indexOf(keyName) >= 0) {
            triggerHideUiToggleFromShortcut();
          }

          var announceShortcut = getEffectiveShortcutForScope(OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE);
          if (announceShortcut && announceShortcut.keys && announceShortcut.keys.indexOf(keyName) >= 0) {
            triggerSaeivDestinationAnnouncementFromShortcut();
          }

          var menuShortcut = getEffectiveShortcutForScope(OVERLAY_SHORTCUT_SCOPE_OVERLAY);
          if (menuShortcut && menuShortcut.keys && menuShortcut.keys.indexOf(keyName) >= 0) {
            var nextMode = telemetryUiMode === 2 ? "Fermé" : "Ouvert";
            applyTelemetryUiMode(telemetryUiMode === 2 ? 1 : 2);
          }

          // --- Interactions natives spécifiques ---
          // 1. Echap (0x1B) : Fermer le menu principal
          if (vk === 0x1B) {
            var mainMenu = document.getElementById("mainMenuModal");
            if (mainMenu && mainMenu.classList.contains("is-open")) {
              if (!mainMenu.classList.contains("is-forced")) {
                mainMenu.classList.remove("is-open");
                document.body.classList.remove("is-main-menu-open");
                if (typeof window.pauseGuideVideo === "function") window.pauseGuideVideo();
                if (typeof window.closeMainMenuInfoView === "function") window.closeMainMenuInfoView();
                renderManager();
                if (typeof refreshManagerUi === "function") refreshManagerUi();
              }
            }
          }
        }
      }

      function preventInteraction(e) {
        if (!isRecordingShortcut) return;
        var targetButton = getOverlayShortcutButtonByScope(recordingShortcutScope);
        if (e.target && targetButton && (e.target === targetButton || e.target.closest("#" + targetButton.id))) {
          return;
        }

        // Cancel recording on click or any pointer interaction outside
        if (e.type.includes("click") || e.type.includes("down") || e.type.includes("up")) {
          stopShortcutRecording();
        }

        e.preventDefault();
        e.stopPropagation();
      }

      function startShortcutRecording(scope) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        var targetButton = getOverlayShortcutButtonByScope(safeScope);
        if (!targetButton) return;
        recordingShortcutScope = safeScope;
        isRecordingShortcut = true;

        var textSpan = targetButton.querySelector(".shortcut-text");
        if (textSpan) textSpan.textContent = "Appuyez sur une touche...";
        else targetButton.textContent = "Appuyez sur une touche...";

        targetButton.classList.add("is-selected", "is-recording");

        window.addEventListener("keydown", onShortcutKeyDown, true);
        window.addEventListener("click", preventInteraction, true);
        window.addEventListener("mousedown", preventInteraction, true);
        window.addEventListener("mouseup", preventInteraction, true);
        window.addEventListener("pointerdown", preventInteraction, true);
        window.addEventListener("pointerup", preventInteraction, true);
        window.addEventListener("mousemove", preventInteraction, true);
        window.addEventListener("pointermove", preventInteraction, true);
        window.addEventListener("contextmenu", preventInteraction, true);
      }

      function stopShortcutRecording() {
        if (!isRecordingShortcut) return;
        var scope = recordingShortcutScope;
        var targetButton = getOverlayShortcutButtonByScope(scope);
        isRecordingShortcut = false;
        if (targetButton) {
          targetButton.classList.remove("is-selected", "is-recording");
          targetButton.blur();
        }
        // Restaurer le texte d'origine à partir de l'état actuel
        updateShortcutUIForScope(scope);
        recordingShortcutScope = OVERLAY_SHORTCUT_SCOPE_OVERLAY;

        window.removeEventListener("keydown", onShortcutKeyDown, true);
        window.removeEventListener("click", preventInteraction, true);
        window.removeEventListener("mousedown", preventInteraction, true);
        window.removeEventListener("mouseup", preventInteraction, true);
        window.removeEventListener("pointerdown", preventInteraction, true);
        window.removeEventListener("pointerup", preventInteraction, true);
        window.removeEventListener("mousemove", preventInteraction, true);
        window.removeEventListener("pointermove", preventInteraction, true);
        window.removeEventListener("contextmenu", preventInteraction, true);
      }

      function resetShortcutForScope(scope, skipNotification) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        var defaultConfig = OVERLAY_TOGGLE_DEFAULT_SHORTCUT;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) defaultConfig = OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) defaultConfig = OVERLAY_ZOOM_GPS_DEFAULT_SHORTCUT;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) defaultConfig = OVERLAY_HIDE_UI_DEFAULT_SHORTCUT;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST) defaultConfig = OVERLAY_PLAYER_LIST_DEFAULT_SHORTCUT;


        updateShortcutUIForScope(safeScope, defaultConfig);
        sendShortcutToBridge(defaultConfig.keys, defaultConfig.display, safeScope);
        saveWidgetLayoutState();
        if (!skipNotification) showOverlayNotification("Raccourci réinitialisé", 1200);
      }

      function onShortcutKeyDown(e) {
        e.preventDefault();
        e.stopPropagation();

        var mainKey = e.key;

        /* Ignorer les modificateurs seuls */
        if (mainKey === "Control" || mainKey === "Shift" || mainKey === "Alt" || mainKey === "Meta" || mainKey === "OS") {
          return;
        }

        // Validation des touches autorisées
        var isSpecialKey = mainKey.length > 1; // F1-F12, Enter, Escape, Arrow..., Backspace, etc.
        var isAlphanumeric = /^[a-zA-Z0-9]$/.test(mainKey);
        var isAllowedException = [" ", "*", "²", ",", ".", ";", ":", "!", "*", "-", "+", "/"].includes(mainKey);

        if (mainKey === "Dead" || mainKey === "Unidentified" || (!isSpecialKey && !isAlphanumeric && !isAllowedException)) {
          showOverlayNotification(
            "Touche non supportée",
            "Cette touche ne peut pas être utilisée.",
            2500
          );
          stopShortcutRecording();
          return;
        }

        var keys = [];
        if (e.ctrlKey) keys.push("Ctrl");
        if (e.shiftKey) keys.push("Shift");
        if (e.altKey) keys.push("Alt");
        if (e.metaKey) keys.push("Win");

        if (mainKey === " ") mainKey = "Espace";
        if (mainKey.toLowerCase() === "delete") mainKey = "Suppr";
        if (mainKey.toLowerCase() === "del") mainKey = "Suppr";
        if (mainKey.toLowerCase() === "escape") mainKey = "Echap";
        if (mainKey.toLowerCase() === "esc") mainKey = "Echap";
        if (mainKey.toLowerCase() === "enter") mainKey = "Entree";
        if (mainKey.toLowerCase() === "return") mainKey = "Entree";
        if (mainKey.toLowerCase() === "arrowup") mainKey = "Up";
        if (mainKey.toLowerCase() === "arrowdown") mainKey = "Down";
        if (mainKey.toLowerCase() === "arrowleft") mainKey = "Left";
        if (mainKey.toLowerCase() === "arrowright") mainKey = "Right";
        if (mainKey.toLowerCase() === "backspace") mainKey = "Backspace";
        if (mainKey.toLowerCase() === "tab") mainKey = "Tab";
        if (mainKey.toLowerCase() === "insert") mainKey = "Insert";
        if (mainKey.toLowerCase() === "home") mainKey = "Home";
        if (mainKey.toLowerCase() === "end") mainKey = "End";
        if (mainKey.toLowerCase() === "pageup") mainKey = "PageUp";
        if (mainKey.toLowerCase() === "pagedown") mainKey = "PageDown";
        if (mainKey.length === 1) mainKey = mainKey.toUpperCase();

        keys.push(mainKey);

        var display = keys.join(" + ");
        var targetScope = recordingShortcutScope;
        var previousShortcut = getEffectiveShortcutForScope(targetScope);
        var nextShortcut = { keys: keys, display: display };

        var conflictScope = getConflictingShortcutScope(targetScope, nextShortcut);

        if (conflictScope) {
          stopShortcutRecording();

          updateShortcutUIForScope(targetScope, previousShortcut);
          sendShortcutToBridge(previousShortcut.keys, previousShortcut.display, targetScope);
          saveWidgetLayoutState();

          showOverlayNotification(
            "Raccourci déjà utilisé",
            "Ce raccourci est déjà assigné à " + getShortcutScopeLabel(conflictScope) + ".",
            2200
          );

          return;
        }

        stopShortcutRecording();

        updateShortcutUIForScope(targetScope, nextShortcut);
        sendShortcutToBridge(keys, display, targetScope);
        saveWidgetLayoutState();
      }

      function sendShortcutToBridge(keys, display, scope) {
        var ws = telemetryWs;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        var safeScope = normalizeOverlayShortcutScope(scope);
        try {
          ws.send(JSON.stringify({
            type: "overlayShortcut",
            action: "set",
            scope: safeScope,
            version: 1,
            shortcut: {
              keys: keys,
              display: display
            }
          }));
        } catch (err) { }
      }

      function normalizeTelemetryUiMode(value) {
        var n = Math.floor(Number(value));
        if (n === 2) return 2;
        return 1;
      }
      function extractTelemetryUiMode(data) {
        var payload = data && typeof data === "object" ? data : null;
        if (!payload) return null;
        var pools = [payload, payload.data, payload.payload];
        for (var i = 0; i < pools.length; i += 1) {
          var src = pools[i];
          if (!src || typeof src !== "object") continue;
          if (!Object.prototype.hasOwnProperty.call(src, "mode")) continue;
          var mode = normalizeTelemetryUiMode(src.mode);
          return mode;
        }
        return null;
      }
      function closeManagerTransientPanels() {
        if (typeof stopShortcutRecording === "function") {
          stopShortcutRecording();
        }
        if (typeof window.disengageOverlayEditMode === "function") {
          window.disengageOverlayEditMode();
        }
        var confirmModal = document.getElementById("customConfirmModal");
        if (confirmModal) confirmModal.style.display = "none";
        var settingsBox = document.getElementById("overlaySettingsBox");
        if (settingsBox) settingsBox.style.display = "none";
        var settingsBtn = document.getElementById("overlayToggleSettingsBtn");
        if (settingsBtn) settingsBtn.classList.remove("is-selected");
        var modeSettingsBox = document.getElementById("overlayModeSettingsBox");
        if (modeSettingsBox) modeSettingsBox.style.display = "none";
        var modeSettingsBtn = document.getElementById("overlayToggleModeSettingsBtn");
        if (modeSettingsBtn) modeSettingsBtn.classList.remove("is-selected");
      }
      function syncGlobalLoadingVisibility() {
        var loadingScreen = document.getElementById("globalLoadingScreen");
        var loadingInProgress = !!loadingScreen && loadingScreen.classList.contains("is-active");
        var visible = loadingInProgress && telemetryUiMode === 2;

        document.body.classList.toggle("is-loading-visible", visible);

        // Important : bloque le manager tant que le chargement existe,
        // même si le loading est invisible en telemetry mode 1.
        document.body.classList.toggle("is-loading-blocking-ui", loadingInProgress);
      }
      function applyTelemetryUiMode(modeRaw) {
        if (FORCE_DEV_UI) return false;
        var nextMode = normalizeTelemetryUiMode(modeRaw);

        var mainMenu = document.getElementById("mainMenuModal");
        var isMenuOpen = mainMenu && mainMenu.classList.contains("is-open");

        if (nextMode === telemetryUiMode && !isMenuOpen) return false;

        // On ne ferme pas les panneaux si le menu est ouvert (l'utilisateur est en train d'interagir)
        if (!isMenuOpen) closeManagerTransientPanels();
        var modeChanged = (nextMode !== telemetryUiMode);
        var transitioningToMode2 = (nextMode === 2 && telemetryUiMode !== 2);
        telemetryUiMode = nextMode;
        if (telemetryUiMode !== 1 && typeof hidePlayerListHoldPopup === "function") {
          hidePlayerListHoldPopup();
        }
        if (telemetryUiMode === 2) {
          firstVisitMode1HintEnabled = false;
        }
        if (modeChanged) {
          if (typeof window.pauseGuideVideo === "function") window.pauseGuideVideo();
          if (typeof window.pauseMainMenuInfoVideos === "function") window.pauseMainMenuInfoVideos();
          if (typeof window.closeMainMenuInfoView === "function") {
            window.closeMainMenuInfoView();
          } else {
            var infoViewFallback = document.getElementById("mainMenuInfoView");
            var mainMenuBodyFallback = document.getElementById("mainMenuBody");
            var indicatorFallback = document.getElementById("mainMenuInfoPageIndicator");
            if (mainMenuBodyFallback) mainMenuBodyFallback.classList.remove("is-info-view-open");
            if (infoViewFallback) {
              infoViewFallback.setAttribute("aria-hidden", "true");
              infoViewFallback.querySelectorAll(".main-menu-info-page.is-active").forEach(function (page) {
                page.classList.remove("is-active");
              });
              infoViewFallback.querySelectorAll("iframe").forEach(function (iframe) {
                if (!iframe || !iframe.contentWindow) return;
                try {
                  iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
                } catch (err) { }
              });
            }
            if (indicatorFallback) indicatorFallback.textContent = "Informations";
          }
        }
        syncWebsocketMode1HintVisibility();
        syncGlobalLoadingVisibility();
        syncGameContextBlockModal();
        refreshTelemetryVisibility();
        // Affichage du menu lors d'une transition vers le mode interactif si le jeu n'est pas encore débloqué
        var loadingScreen = document.getElementById("globalLoadingScreen");
        var loadingInProgress = !!loadingScreen && loadingScreen.classList.contains("is-active");

        if (
          transitioningToMode2 &&
          !isGameUnlocked &&
          !loadingInProgress
        ) {
          handleDefaultStartupMode();
        }
        managerState.visible = telemetryUiMode === 2;
        renderManager();
        applyTelemetryPausedState(telemetryPaused, { force: true });
        syncGlobalLoadingVisibility();
        var loadingScreen = document.getElementById("globalLoadingScreen");
        var loadingInProgress = !!loadingScreen && loadingScreen.classList.contains("is-active");

        if (loadingInProgress && mainMenuModal) {
          mainMenuModal.classList.remove("is-open", "is-forced");
          document.body.classList.remove("is-main-menu-open");
          if (typeof window.pauseGuideVideo === "function") window.pauseGuideVideo();
          if (typeof window.closeMainMenuInfoView === "function") window.closeMainMenuInfoView();
        }
        return true;
      }
      function resolveConfiguredDefaultStartupMode() {
        var startupMode = normalizeDefaultStartupMode(defaultStartupMode);

        try {
          var urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has("dev")) {
            startupMode = GAME_MODES.FREE;
          }
        } catch (e) { }

        return startupMode;
      }

      function handleDefaultStartupMode() {
        var startupMode = resolveConfiguredDefaultStartupMode();

        // Priorité au paramètre URL ?dev pour le mode libre par défaut
        try {
          var urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has("dev")) {
            startupMode = GAME_MODES.FREE;
          }
        } catch (e) { }

        if (startupMode === DEFAULT_STARTUP_MODE_MENU) {
          var startMenu = document.getElementById("mainMenuModal");
          var startupTab = String(startupMenuPreferredTab || "").trim().toLowerCase();
          if (startupTab !== "settings" && startupTab !== "guide" && startupTab !== "status" && startupTab !== "play") {
            startupTab = "play";
          }

          if (startMenu && !startMenu.classList.contains("is-open")) {
            if (typeof switchMainMenuTab === "function") {
              switchMainMenuTab(startupTab);
            }

            startMenu.classList.add("is-open", "is-forced");
            document.body.classList.add("is-main-menu-open");
          }

          startupMenuPreferredTab = "";

          return;
        }

        startDefaultModeDirectly(startupMode);
      }

      function forceDirectStartupWidgetsVisible() {
        document.body.classList.add("is-game-unlocked");
        document.body.classList.remove("is-main-menu-open");
        if (el.overlayRoot) {
          el.overlayRoot.style.removeProperty("visibility");
        }
        refreshTelemetryVisibility();
      }

      function maybeStartConfiguredDefaultGameMode() {
        var startupMode = resolveConfiguredDefaultStartupMode();
        if (startupMode === DEFAULT_STARTUP_MODE_MENU) return false;
        if (!isModeEnabled(startupMode)) return false;
        if (isGameUnlocked && normalizeGameMode(currentGameMode) === startupMode) {
          forceDirectStartupWidgetsVisible();
          return true;
        }
        startDefaultModeDirectly(startupMode);
        return true;
      }

      function startDefaultModeDirectly(mode) {
        var startupMode = normalizeDefaultStartupMode(mode);

        if (startupMode === DEFAULT_STARTUP_MODE_MENU) return;
        if (!isModeEnabled(startupMode)) return;

        setGameMode(startupMode, { apply: false });

        var loadingScreen = document.getElementById("globalLoadingScreen");

        // On débloque le jeu immédiatement
        isGameUnlocked = true;
        document.body.classList.add("is-game-unlocked");

        var mainMenuModal = document.getElementById("mainMenuModal");
        if (mainMenuModal) {
          mainMenuModal.classList.remove("is-open", "is-forced");
          if (typeof window.pauseGuideVideo === "function") window.pauseGuideVideo();
          if (typeof window.closeMainMenuInfoView === "function") window.closeMainMenuInfoView();
        }

        document.body.classList.remove("is-main-menu-open");

        if (loadingScreen) {
          loadingScreen.classList.remove("is-active");
          syncGlobalLoadingVisibility();
          document.body.classList.remove("is-loading-blocking-ui");
        }

        apply();
        forceDirectStartupWidgetsVisible();

        if (typeof refreshManagerUi === "function") {
          refreshManagerUi();
        }
      }
      function stopTelemetryReconnectTimer() {
        if (!telemetryReconnectTimer) return;
        clearTimeout(telemetryReconnectTimer);
        telemetryReconnectTimer = 0;
      }
      function scheduleTelemetryReconnect() {
        if (telemetryReconnectTimer) return;
        telemetryReconnectTimer = setTimeout(function () {
          telemetryReconnectTimer = 0;
          connectTelemetryWs();
        }, telemetryReconnectDelayMs);
        telemetryReconnectDelayMs = Math.min(5000, Math.round(telemetryReconnectDelayMs * 1.5));
      }
      function closeTelemetryWs() {
        if (!telemetryWs) return;
        try { telemetryWs.onopen = null; } catch (err) { }
        try { telemetryWs.onmessage = null; } catch (err) { }
        try { telemetryWs.onerror = null; } catch (err) { }
        try { telemetryWs.onclose = null; } catch (err) { }
        try { telemetryWs.close(); } catch (err) { }
        telemetryWs = null;
      }
      function normalizeRemotePanelWsUrl(raw) {
        var url = String(raw || "").trim();
        if (!url) return "";
        if (/^wss?:\/\//i.test(url)) return url.replace(/\/+$/, "");
        if (/^https:\/\//i.test(url)) return url.replace(/^https:\/\//i, "wss://").replace(/\/+$/, "");
        if (/^http:\/\//i.test(url)) return url.replace(/^http:\/\//i, "ws://").replace(/\/+$/, "");
        return "";
      }
      function getRemotePanelWsUrl() {
        return normalizeRemotePanelWsUrl(REMOTE_SERVER_WS_DEFAULT_URL);
      }
      function isRemotePanelEmptyIdentityText(value) {
        var text = String(value == null ? "" : value).trim();
        return !text || /^(null|nil|undefined|none|nan|n\/a|unknown|inconnu|anonymous|anonyme)$/i.test(text);
      }
      function isRemotePanelTechnicalIdentityText(value) {
        var text = String(value == null ? "" : value).trim();
        if (!text) return false;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return true;
        if (/^[0-9a-f]{24,}$/i.test(text)) return true;
        if (/^\d{15,20}$/.test(text)) return true;
        if (/^(player|client|user|session|socket)[_-]?[0-9a-f-]{8,}$/i.test(text)) return true;
        return false;
      }
      function normalizeRemotePanelIdentityText(value, allowTechnical) {
        var text = String(value == null ? "" : value).trim();
        if (isRemotePanelEmptyIdentityText(text)) return "";
        if (!allowTechnical && isRemotePanelTechnicalIdentityText(text)) return "";
        return text;
      }
      function readRemotePanelIdentityString(source, keys, allowTechnical) {
        if (!source || typeof source !== "object") return "";
        var aliases = Array.isArray(keys) ? keys : [];
        for (var i = 0; i < aliases.length; i += 1) {
          var key = aliases[i];
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
          var value = normalizeRemotePanelIdentityText(source[key], !!allowTechnical);
          if (value) return value;
        }
        return "";
      }
      function readRemotePanelStoredIdentityString(keys, allowTechnical) {
        var aliases = Array.isArray(keys) ? keys : [];
        var params = null;
        try { params = new URLSearchParams(window.location.search || ""); } catch (err0) { params = null; }
        for (var i = 0; i < aliases.length; i += 1) {
          var key = aliases[i];
          var value = "";
          if (params) {
            try { value = normalizeRemotePanelIdentityText(params.get(key), !!allowTechnical); } catch (err1) { value = ""; }
            if (value) return value;
          }
          try { value = normalizeRemotePanelIdentityText(window.localStorage && window.localStorage.getItem(key), !!allowTechnical); } catch (err2) { value = ""; }
          if (value) return value;
          try { value = normalizeRemotePanelIdentityText(window.sessionStorage && window.sessionStorage.getItem(key), !!allowTechnical); } catch (err3) { value = ""; }
          if (value) return value;
        }
        return "";
      }
      function buildRemotePanelPlayerIdentity(raw, signal) {
        var pools = [
          raw,
          raw && raw.data,
          raw && raw.payload,
          raw && raw.identity,
          raw && raw.playerIdentity,
          raw && raw.player_identity,
          raw && raw.data && raw.data.identity,
          raw && raw.data && raw.data.playerIdentity,
          raw && raw.data && raw.data.player_identity,
          raw && raw.payload && raw.payload.identity,
          raw && raw.payload && raw.payload.playerIdentity,
          raw && raw.payload && raw.payload.player_identity,
          raw && raw.player,
          raw && raw.client,
          raw && raw.user,
          raw && raw.steam,
          raw && raw.profile,
          raw && raw.gameContext && raw.gameContext.identity,
          raw && raw.gameContext && raw.gameContext.playerIdentity,
          raw && raw.gameContext && raw.gameContext.player_identity,
          raw && raw.game_context && raw.game_context.identity,
          raw && raw.game_context && raw.game_context.playerIdentity,
          raw && raw.game_context && raw.game_context.player_identity,
          signal,
          signal && signal.data,
          signal && signal.payload,
          signal && signal.identity,
          signal && signal.playerIdentity,
          signal && signal.player_identity,
          signal && signal.data && signal.data.identity,
          signal && signal.data && signal.data.playerIdentity,
          signal && signal.data && signal.data.player_identity,
          signal && signal.payload && signal.payload.identity,
          signal && signal.payload && signal.payload.playerIdentity,
          signal && signal.payload && signal.payload.player_identity,
          signal && signal.player,
          signal && signal.client,
          signal && signal.user,
          signal && signal.steam,
          signal && signal.profile,
          signal && signal.gameContext && signal.gameContext.identity,
          signal && signal.gameContext && signal.gameContext.playerIdentity,
          signal && signal.gameContext && signal.gameContext.player_identity,
          signal && signal.game_context && signal.game_context.identity,
          signal && signal.game_context && signal.game_context.playerIdentity,
          signal && signal.game_context && signal.game_context.player_identity
        ];
        var steamid = "";
        var displayname = "";
        var name = "";
        var technicalId = "";
        for (var i = 0; i < pools.length; i += 1) {
          var source = pools[i];
          if (!source || typeof source !== "object") continue;
          if (!steamid) steamid = readRemotePanelIdentityString(source, ["steamid", "steamId", "steamID", "steam_id"], true);
          if (!technicalId) technicalId = readRemotePanelIdentityString(source, ["pccClientId", "pcc_client_id", "clientId", "client_id", "playerId", "player_id", "connectionId", "connection_id", "socketId", "socket_id", "from"], true);
          if (!displayname) displayname = readRemotePanelIdentityString(source, ["displayname", "displayName", "display_name", "steamDisplayName", "steam_display_name", "steamName", "steam_name", "steamPersonaName", "steam_persona_name", "personaname", "personaName", "persona_name", "nickname", "nick"]);
          if (!name) name = readRemotePanelIdentityString(source, ["name", "playerName", "player_name", "playerNick", "player_nick", "username", "userName", "user_name"]);
        }
        if (!technicalId) technicalId = getLocalPccClientId();
        if (!steamid) steamid = readRemotePanelStoredIdentityString(["steamid", "steamId", "steamID", "steam_id", "idf_steamid", "idf_steam_id"], true);
        if (!displayname) displayname = readRemotePanelStoredIdentityString(["displayname", "displayName", "display_name", "steamDisplayName", "steam_display_name", "steamName", "steam_name", "steamPersonaName", "steam_persona_name", "personaname", "personaName", "persona_name", "nickname", "nick", "idf_displayname", "idf_steam_name"]);
        if (!name) name = readRemotePanelStoredIdentityString(["name", "playerName", "player_name", "playerNick", "player_nick", "username", "userName", "user_name", "idf_name", "idf_player_name"]);
        if (!steamid && !technicalId && !displayname && !name) return null;
        var identity = {};
        if (technicalId) {
          identity.id = technicalId;
          identity.playerId = technicalId;
          identity.clientId = technicalId;
          identity.pccClientId = technicalId;
        }
        if (steamid) identity.steamid = steamid;
        if (displayname) identity.displayname = displayname;
        if (name) identity.name = name;
        return identity;
      }
      function remotePanelRoundNumber(value, digits) {
        var number = Number(value);
        if (!Number.isFinite(number)) return null;
        var factor = Math.pow(10, Math.max(0, Math.round(Number(digits) || 0)));
        return Math.round(number * factor) / factor;
      }
      function remotePanelPositiveInt(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.max(0, Math.round(number));
      }
      function remotePanelGameModeLabel(mode, menuOpen) {
        if (menuOpen) return "Desactive (menu)";
        var normalized = "";
        try {
          normalized = typeof normalizeGameMode === "function" ? normalizeGameMode(mode) : String(mode || "").trim().toLowerCase();
        } catch (err0) {
          normalized = String(mode || "").trim().toLowerCase();
        }
        if (normalized === "free") return "Mode libre";
        if (normalized === "bus") return "Mode bus";
        return normalized || "Mode inconnu";
      }
      function remotePanelParseWorldPoint(rawPoint) {
        if (!rawPoint || typeof rawPoint !== "object") return null;
        if (typeof parseWorldPoint3D === "function") {
          try {
            var parsed = parseWorldPoint3D(rawPoint);
            if (parsed) return parsed;
          } catch (err0) { }
        }
        var hasZKey =
          Object.prototype.hasOwnProperty.call(rawPoint, "z") ||
          Object.prototype.hasOwnProperty.call(rawPoint, "Z");
        var x = Number(rawPoint.x ?? rawPoint.X);
        var y = Number(hasZKey ? (rawPoint.z ?? rawPoint.Z) : (rawPoint.y ?? rawPoint.Y));
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        var h = Number(rawPoint.h ?? rawPoint.H ?? rawPoint.height ?? rawPoint.alt ?? rawPoint.altitude);
        if (!Number.isFinite(h) && hasZKey) h = Number(rawPoint.y ?? rawPoint.Y);
        var out = { x: x, y: y };
        if (Number.isFinite(h)) out.h = h;
        return out;
      }
      function remotePanelCompactWorldPoint(rawPoint) {
        var point = remotePanelParseWorldPoint(rawPoint);
        if (!point) return null;
        var out = {
          x: remotePanelRoundNumber(point.x, 2),
          y: remotePanelRoundNumber(point.y, 2)
        };
        if (Number.isFinite(Number(point.h))) out.h = remotePanelRoundNumber(point.h, 2);
        return out;
      }
      function remotePanelCompactWorldPoints(points) {
        var source = Array.isArray(points) ? points : [];
        var out = [];
        for (var i = 0; i < source.length; i += 1) {
          var point = remotePanelCompactWorldPoint(source[i]);
          if (!point) continue;
          var last = out[out.length - 1];
          if (last && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) continue;
          out.push(point);
        }
        return out;
      }
      function remotePanelGetStopExactWorldPoint(stop) {
        if (!stop || typeof stop !== "object") return null;
        if (typeof getSaeivStopExactWorldPoint === "function") {
          try {
            var exact = getSaeivStopExactWorldPoint(stop);
            if (exact) return exact;
          } catch (err0) { }
        }
        var x = Number(stop.X ?? stop.x);
        var y = Number(stop.Z ?? stop.z ?? stop.Y ?? stop.y);
        var h = Number(stop.Y ?? stop.h ?? stop.height);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        var out = { x: x, y: y };
        if (Number.isFinite(h)) out.h = h;
        return out;
      }
      function remotePanelGetServedStopIndices() {
        var out = [];
        try {
          var log = saeivStopServedLog && typeof saeivStopServedLog === "object" ? saeivStopServedLog : null;
          if (log) {
            Object.keys(log).forEach(function (key) {
              if (log[key] !== true) return;
              var index = Math.floor(Number(key));
              if (Number.isFinite(index) && index >= 0 && out.indexOf(index) === -1) out.push(index);
            });
          }
        } catch (err0) { }
        out.sort(function (a, b) { return a - b; });
        return out;
      }
      function remotePanelBuildRouteStopPayload(entries, reachedIndex, targetIndex, servedStopIndices) {
        var list = Array.isArray(entries) ? entries : [];
        var servedSet = new Set(Array.isArray(servedStopIndices) ? servedStopIndices : []);
        var out = [];
        for (var i = 0; i < list.length; i += 1) {
          var entry = list[i];
          var point = remotePanelCompactWorldPoint(remotePanelGetStopExactWorldPoint(entry));
          if (!point) continue;
          var served = servedSet.has(i) || (Number.isFinite(reachedIndex) && i <= reachedIndex);
          out.push({
            index: i,
            uid: Number.isFinite(Number(entry && entry.uid)) ? Math.floor(Number(entry.uid)) : null,
            name: String(entry && entry.name || ""),
            x: point.x,
            y: point.y,
            h: Number.isFinite(Number(point.h)) ? point.h : null,
            served: served,
            reached: Number.isFinite(reachedIndex) && i <= reachedIndex,
            current: Number.isFinite(targetIndex) && i === targetIndex
          });
        }
        return out;
      }
      function remotePanelKickBusRouteGeometryLoads() {
        try {
          if (typeof ensureNavGraphLoaded === "function") ensureNavGraphLoaded().catch(function () { });
        } catch (err0) { }
        try {
          if (typeof ensureNavStopLinksLoaded === "function") ensureNavStopLinksLoaded().catch(function () { });
        } catch (err1) { }
        try {
          if (typeof ensureNavBridgesLoaded === "function") ensureNavBridgesLoaded().catch(function () { });
        } catch (err2) { }
      }
      function remotePanelBusRouteGeometryReady() {
        var hasGraph = false;
        try { hasGraph = !!navGraph; } catch (err0) { hasGraph = false; }
        var hasStopLinks = false;
        try { hasStopLinks = navStopLinksLoaded === true; } catch (err1) { hasStopLinks = false; }
        var hasBridges = false;
        try { hasBridges = navBridgeLoaded === true; } catch (err2) { hasBridges = false; }
        return hasGraph && hasStopLinks && hasBridges;
      }
      function remotePanelBuildBusRouteGeometryCacheKey(entries, saeiv) {
        var list = Array.isArray(entries) ? entries : [];
        var first = list[0] || {};
        var last = list[list.length - 1] || {};
        var bridgeRuleId = "";
        try {
          var rule = typeof getActiveSaeivNavBridgeRule === "function" ? getActiveSaeivNavBridgeRule() : null;
          bridgeRuleId = String(rule && rule.id || "");
        } catch (err0) { bridgeRuleId = ""; }
        var graphReady = remotePanelBusRouteGeometryReady() ? "1" : "0";
        var bridgeVersion = "";
        var stopLinksVersion = "";
        try { bridgeVersion = String(navBridgeLoadedVersion || ""); } catch (err1) { bridgeVersion = ""; }
        try { stopLinksVersion = String(navStopLinksLoadedVersion || ""); } catch (err2) { stopLinksVersion = ""; }
        return [
          String(saeiv && saeiv.selectedKey || ""),
          String(saeiv && saeiv.selectedLineUid || ""),
          String(saeiv && saeiv.selectedRouteUid || ""),
          String(list.length),
          String(first && first.uid || ""),
          String(last && last.uid || ""),
          graphReady,
          bridgeVersion,
          stopLinksVersion,
          bridgeRuleId
        ].join("|");
      }
      function remotePanelBuildBusRouteGeometrySegments(entries) {
        var list = Array.isArray(entries) ? entries : [];
        if (list.length < 2) return [];
        var fullRoute = [];
        try {
          if (typeof buildSaeivMapStyleRouteWorldPoints === "function") {
            fullRoute = buildSaeivMapStyleRouteWorldPoints(list);
          }
        } catch (err0) {
          fullRoute = [];
        }
        var bridgeRule = null;
        var navOptions = null;
        try {
          bridgeRule = typeof getActiveSaeivNavBridgeRule === "function" ? getActiveSaeivNavBridgeRule() : null;
          navOptions = typeof getNavBridgeOptionsForRule === "function" ? getNavBridgeOptionsForRule(bridgeRule) : null;
        } catch (err1) {
          bridgeRule = null;
          navOptions = null;
        }
        var segments = [];
        for (var i = 0; i < list.length - 1; i += 1) {
          var points = [];
          try {
            if (Array.isArray(fullRoute) && fullRoute.length >= 2 && typeof sliceSaeivRouteWorldPointsBetweenStops === "function") {
              points = sliceSaeivRouteWorldPointsBetweenStops(fullRoute, list, i, i + 1);
            }
          } catch (err2) {
            points = [];
          }
          if ((!Array.isArray(points) || points.length < 2) && typeof buildSaeivWorldPolylineFromStops === "function") {
            try { points = buildSaeivWorldPolylineFromStops(list, i, i + 1, navOptions); } catch (err3) { points = []; }
          }
          var compact = remotePanelCompactWorldPoints(points);
          if (compact.length < 2) {
            var fromPoint = remotePanelCompactWorldPoint(remotePanelGetStopExactWorldPoint(list[i]));
            var toPoint = remotePanelCompactWorldPoint(remotePanelGetStopExactWorldPoint(list[i + 1]));
            compact = [];
            if (fromPoint) compact.push(fromPoint);
            if (toPoint) compact.push(toPoint);
          }
          if (compact.length >= 2) {
            segments.push({
              fromIndex: i,
              toIndex: i + 1,
              points: compact
            });
          }
        }
        return segments;
      }
      function buildRemotePanelBusRouteGeometry(saeiv, reachedIndex, targetIndex) {
        var state = null;
        try { state = saeivRouteState && typeof saeivRouteState === "object" ? saeivRouteState : null; } catch (err0) { state = null; }
        var entries = state && Array.isArray(state.stops) ? state.stops : [];
        if (!entries.length) return null;
        remotePanelKickBusRouteGeometryLoads();
        try {
          if (typeof applyNavStopLinksToEntries === "function") applyNavStopLinksToEntries(entries);
        } catch (err1) { }
        var servedStopIndices = remotePanelGetServedStopIndices();
        var stops = remotePanelBuildRouteStopPayload(entries, reachedIndex, targetIndex, servedStopIndices);
        var ready = remotePanelBusRouteGeometryReady();
        var cacheKey = remotePanelBuildBusRouteGeometryCacheKey(entries, saeiv);
        if (!ready) {
          remotePanelBusRouteGeometryCacheKey = "";
          remotePanelBusRouteGeometryCache = null;
          return {
            schema: "idf-map-bus-route-v1",
            pending: true,
            cacheKey: cacheKey,
            reachedIndex: reachedIndex,
            targetIndex: targetIndex,
            servedStopIndices: servedStopIndices,
            stops: stops,
            segments: []
          };
        }
        if (cacheKey !== remotePanelBusRouteGeometryCacheKey || !remotePanelBusRouteGeometryCache) {
          var segments = remotePanelBuildBusRouteGeometrySegments(entries);
          remotePanelBusRouteGeometryCacheKey = cacheKey;
          remotePanelBusRouteGeometryCache = {
            schema: "idf-map-bus-route-v1",
            pending: false,
            cacheKey: cacheKey,
            segments: segments,
            segmentCount: segments.length
          };
        }
        return Object.assign({}, remotePanelBusRouteGeometryCache, {
          reachedIndex: reachedIndex,
          targetIndex: targetIndex,
          servedStopIndices: servedStopIndices,
          stops: stops
        });
      }
      function shouldSendRemotePanelBusRouteGeometry(geometry) {
        if (!geometry || typeof geometry !== "object") return false;
        var key = String(geometry.cacheKey || "");
        if (!key) return false;
        var now = Date.now();
        if (geometry.pending === true) return key !== remotePanelBusRouteGeometryLastSentKey;
        if (key !== remotePanelBusRouteGeometryLastSentKey) return true;
        return (now - remotePanelBusRouteGeometryLastSentAt) >= REMOTE_PANEL_ROUTE_GEOMETRY_RESEND_MS;
      }
      function markRemotePanelBusRouteGeometrySent(geometry) {
        if (!geometry || typeof geometry !== "object") return;
        remotePanelBusRouteGeometryLastSentKey = String(geometry.cacheKey || "");
        remotePanelBusRouteGeometryLastSentAt = Date.now();
      }
      function buildRemotePanelBusLineBonusState(saeiv) {
        if (!saeiv || typeof saeiv !== "object") return null;
        var lineSelected = saeiv.lineSelected === true || saeiv.routeSelected === true || saeiv.selected === true;
        if (!lineSelected) return null;
        var stopCount = remotePanelPositiveInt(saeiv.routeStopCount);
        var reachedIndex = Math.floor(Number(saeiv.routeReachedIndex));
        if (!Number.isFinite(reachedIndex)) reachedIndex = -1;
        var reachedStops = remotePanelPositiveInt(saeiv.routeReachedStopsCount);
        if (!reachedStops && reachedIndex >= 0) reachedStops = Math.max(0, reachedIndex + 1);
        var remainingStops = stopCount;
        if (stopCount > 0) {
          remainingStops = saeiv.routeStarted === true ? Math.max(0, stopCount - reachedStops) : stopCount;
          if (saeiv.routeCompleted === true) remainingStops = 0;
        }
        var boardingTotal = remotePanelPositiveInt(saeiv.stopBoardingTotal);
        var boardingDone = Math.min(boardingTotal, remotePanelPositiveInt(saeiv.stopBoardingDone));
        var alightingTotal = remotePanelPositiveInt(saeiv.stopAlightingTotal);
        var alightingDone = Math.min(alightingTotal, remotePanelPositiveInt(saeiv.stopAlightingDone));
        var targetStopIndex = Math.max(0, Math.round(Number(saeiv.routeTargetIndex) || 0));
        var state = {
          active: true,
          lineNumber: String(saeiv.lineNumber || ""),
          routeName: String(saeiv.routeName || ""),
          selectedKey: String(saeiv.selectedKey || ""),
          started: saeiv.routeStarted === true,
          waitingStart: saeiv.routeWaitingStart === true,
          completed: saeiv.routeCompleted === true,
          currentStopName: String(saeiv.stopName || ""),
          currentStopLabel: String(saeiv.currentStopLabel || ""),
          nextStopName: String(saeiv.nextStopName || ""),
          thirdStopName: String(saeiv.thirdStopName || ""),
          stopCount: stopCount,
          reachedStopIndex: reachedIndex,
          reachedStops: reachedStops,
          servedStops: remotePanelPositiveInt(saeiv.routeServedStopsCount),
          remainingStops: remainingStops,
          targetStopIndex: targetStopIndex,
          missedStops: remotePanelPositiveInt(saeiv.routeMissedStopsCount),
          lateStops: remotePanelPositiveInt(saeiv.routeLateStopsCount),
          passengersInBus: remotePanelPositiveInt(saeiv.passengersInBus),
          passengersAtStop: remotePanelPositiveInt(saeiv.passengersAtStop),
          transportedPassengers: remotePanelPositiveInt(saeiv.routeTransportedPassengers),
          busMaxCapacity: remotePanelPositiveInt(saeiv.busMaxCapacity),
          busMaxCapacityDisplay: String(saeiv.busMaxCapacityDisplay || saeiv.busMaxCapacity || ""),
          busMaxCapacityUnlimited: saeiv.busMaxCapacityUnlimited === true,
          stopRequested: saeiv.stopRequested === true,
          stopNecessary: saeiv.stopNecessary === true,
          boardingTotal: boardingTotal,
          boardingDone: boardingDone,
          boardingRemaining: Math.max(0, boardingTotal - boardingDone),
          alightingTotal: alightingTotal,
          alightingDone: alightingDone,
          alightingRemaining: Math.max(0, alightingTotal - alightingDone),
          distanceToCurrentStopM: remotePanelRoundNumber(saeiv.distanceToDisplayStopM ?? saeiv.distanceToDisplayStopGpsM, 1),
          etaRemainingMinutes: remotePanelRoundNumber(saeiv.etaRemainingMinutes, 1),
          liveDelayMinutes: remotePanelRoundNumber(saeiv.routeLiveDelayMinutes, 1),
          liveElapsedMs: remotePanelPositiveInt(saeiv.routeLiveElapsedMs),
          vehicleAtStop: saeiv.vehicleAtStop === true,
          vehicleName: String(saeiv.vehicleName || ""),
          routeGeometryKey: "",
          routeGeometryPending: false,
          routeGeometryUpdatedAt: 0
        };
        return state;
      }
      function buildRemotePanelGame2BonusState() {
        var menuOpen = false;
        try { menuOpen = document.body && document.body.classList.contains("is-main-menu-open"); } catch (err0) { menuOpen = false; }
        var mode = "";
        try { mode = String(currentGameMode || ""); } catch (err1) { mode = ""; }
        var normalizedMode = mode;
        try {
          normalizedMode = typeof normalizeGameMode === "function" ? normalizeGameMode(mode) : mode;
        } catch (err2) { }
        var saeiv = null;
        try {
          if (typeof buildSaeivStatePayloadFromGame === "function") saeiv = buildSaeivStatePayloadFromGame();
        } catch (err3) {
          saeiv = null;
        }
        return {
          title: "Etat interface IDF Map",
          kind: "game2_html_state",
          updatedAt: Date.now(),
          gameMode: {
            key: menuOpen ? "disabled" : String(normalizedMode || mode || ""),
            label: remotePanelGameModeLabel(normalizedMode || mode, menuOpen),
            raw: String(mode || ""),
            menuOpen: menuOpen,
            gameUnlocked: (typeof isGameUnlocked !== "undefined") ? isGameUnlocked === true : null,
            telemetryPaused: (typeof telemetryPaused !== "undefined") ? telemetryPaused === true : null,
            telemetryUiMode: (typeof telemetryUiMode !== "undefined") ? Number(telemetryUiMode) : null
          },
          busLine: buildRemotePanelBusLineBonusState(saeiv)
        };
      }
      function getDiscordPresenceIntervalMs() {
        var value = Math.round(Number(DISCORD_PRESENCE_SEND_INTERVAL_MS));
        return Number.isFinite(value) && value >= 15000 ? value : 15000;
      }
      function normalizeDiscordPresenceText(value) {
        return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
      }
      function limitDiscordPresenceText(value, fallback, maxLength) {
        var text = normalizeDiscordPresenceText(value);
        if (!text) text = normalizeDiscordPresenceText(fallback);
        var max = Math.max(1, Math.round(Number(maxLength) || 128));
        if (text.length <= max) return text;
        if (max <= 3) return text.slice(0, max);
        return text.slice(0, max - 3).replace(/\s+$/g, "") + "...";
      }
      function getDiscordPresenceProductName() {
        var name = "";
        var version = "";
        try { name = String(systemName || "").trim(); } catch (err0) { name = ""; }
        try { version = String(gameVersion || "").trim(); } catch (err1) { version = ""; }
        if (name && version) return name + " - " + version;
        return name || version || "IDF Map";
      }
      function getDiscordPresenceConvoyLabel() {
        return telemetryConvoyActive === true ? "Convoi" : "Solo";
      }
      function formatDiscordPresenceEta(minutes) {
        var n = Number(minutes);
        if (!Number.isFinite(n) || n <= 0) return "";
        var total = Math.max(1, Math.round(n));
        var hours = Math.floor(total / 60);
        var mins = total % 60;
        if (hours > 0) return "ETA " + String(hours) + "h" + String(mins).padStart(2, "0");
        return "ETA " + String(total) + " min";
      }
      function formatDiscordPresencePassengers(busLine) {
        if (!busLine || typeof busLine !== "object") return "";
        var passengers = Math.max(0, Math.round(Number(busLine.passengersInBus) || 0));
        var capacity = Math.max(0, Math.round(Number(busLine.busMaxCapacity) || 0));
        if (busLine.busMaxCapacityUnlimited === true || capacity <= 0) {
          return String(passengers) + " passagers";
        }
        return String(passengers) + "/" + String(capacity) + " passagers";
      }
      function resolveDiscordPresenceRouteStartTimestamp(busLine, nowSec) {
        if (busLine && busLine.started === true) {
          var key = String(busLine.selectedKey || busLine.lineNumber || busLine.routeName || "bus").trim() || "bus";
          if (discordPresenceRouteKey !== key || !discordPresenceRouteStartedAtSec) {
            discordPresenceRouteKey = key;
            discordPresenceRouteStartedAtSec = nowSec;
          }
          return discordPresenceRouteStartedAtSec;
        }
        if (!busLine || busLine.completed !== true) {
          discordPresenceRouteKey = "";
          discordPresenceRouteStartedAtSec = 0;
        }
        return discordPresenceSessionStartedAtSec || nowSec;
      }
      function buildDiscordPresenceBusDetails(busLine, gameModeState) {
        var paused = gameModeState && gameModeState.telemetryPaused === true;
        if (!busLine || busLine.active !== true) return paused ? "Mode bus - En pause" : "Mode bus - Hors service";
        var line = String(busLine.lineNumber || "").trim();
        var lineText = line ? ("ligne " + line) : "ligne bus";
        if (busLine.completed === true) return "Mode bus - Service termine " + lineText;
        if (paused) return "Mode bus - En pause " + lineText;
        if (busLine.started === true) return "Mode bus - Conduit un bus " + lineText;
        if (busLine.waitingStart === true) return "Mode bus - Pret au depart " + lineText;
        return "Mode bus - Ligne selectionnee " + lineText;
      }
      function buildDiscordPresenceBusState(busLine) {
        var parts = [];
        var vehicle = String(
          (busLine && busLine.vehicleName) ||
          saeivVehicleName ||
          (telemetryLastSignal && telemetryLastSignal.vehicleName) ||
          ""
        ).trim();
        if (vehicle) parts.push(vehicle);
        if (busLine && busLine.active === true) {
          if (busLine.started === true || busLine.completed === true) {
            parts.push(formatDiscordPresencePassengers(busLine));
            var stopName = String(busLine.currentStopName || busLine.nextStopName || "").trim();
            if (stopName) parts.push((busLine.vehicleAtStop === true ? "Arret " : "Vers ") + stopName);
            var served = Math.max(0, Math.round(Number(busLine.servedStops) || 0));
            var stopCount = Math.max(0, Math.round(Number(busLine.stopCount) || 0));
            if (stopCount > 0) parts.push("arrets desservis " + String(served) + "/" + String(stopCount));
            var eta = formatDiscordPresenceEta(busLine.etaRemainingMinutes);
            if (eta) parts.push(eta);
          } else {
            var routeName = String(busLine.routeName || "").trim();
            if (routeName) parts.push(routeName);
          }
        }
        parts.push(getDiscordPresenceConvoyLabel());
        return parts.filter(Boolean).join(" - ");
      }
      function buildDiscordPresencePayload() {
        var nowSec = Math.floor(Date.now() / 1000);
        var productName = getDiscordPresenceProductName();
        var bonus = null;
        try { bonus = buildRemotePanelGame2BonusState(); } catch (err0) { bonus = null; }
        var gameModeState = bonus && bonus.gameMode ? bonus.gameMode : {};
        var busLine = bonus && bonus.busLine ? bonus.busLine : null;
        var modeKey = String(gameModeState.key || "").trim().toLowerCase();
        var modeLabel = String(gameModeState.label || remotePanelGameModeLabel(modeKey, false)).trim();
        var details = "";
        var state = "";
        if (gameModeState.menuOpen === true) {
          details = "Menu - " + (modeLabel || "Interface");
          state = productName + " - " + getDiscordPresenceConvoyLabel();
        } else if (modeKey === "bus") {
          details = buildDiscordPresenceBusDetails(busLine, gameModeState);
          state = buildDiscordPresenceBusState(busLine);
        } else if (modeKey === "free") {
          details = gameModeState.telemetryPaused === true ? "Mode libre - En pause" : "Mode libre - En conduite";
          state = [
            String(saeivVehicleName || (telemetryLastSignal && telemetryLastSignal.vehicleName) || "").trim(),
            getDiscordPresenceConvoyLabel()
          ].filter(Boolean).join(" - ");
        } else {
          details = modeLabel || "Interface IDF Map";
          state = getDiscordPresenceConvoyLabel();
        }
        var timestamps = {
          start: resolveDiscordPresenceRouteStartTimestamp(busLine, nowSec)
        };
        var etaMinutes = busLine && busLine.started === true && busLine.completed !== true ? Number(busLine.etaRemainingMinutes) : Number.NaN;
        if (Number.isFinite(etaMinutes) && etaMinutes > 0) {
          timestamps.end = nowSec + Math.max(60, Math.round(etaMinutes * 60));
        }
        return {
          type: "discordPresence",
          version: 1,
          source: "html",
          activity: {
            type: 0,
            name: limitDiscordPresenceText(productName, "IDF Map", 128),
            details: limitDiscordPresenceText(details, productName, 128),
            state: limitDiscordPresenceText(state, getDiscordPresenceConvoyLabel(), 128),
            timestamps: timestamps,
            assets: {
              large_image: "idf_map",
              large_text: limitDiscordPresenceText(productName, "IDF Map", 128),
              small_image: "ets2",
              small_text: "Euro Truck Simulator 2"
            },
            instance: false
          }
        };
      }
      function getDiscordPresenceSocket() {
        return telemetryWs && telemetryWs.readyState === WebSocket.OPEN ? telemetryWs : null;
      }
      function sendDiscordPresenceUpdate() {
        var now = Date.now();
        var intervalMs = getDiscordPresenceIntervalMs();
        var lastSentAt = Number(discordPresenceLastSentAtMs) || 0;
        if (lastSentAt > 0 && (now - lastSentAt) < intervalMs) return false;
        var socket = getDiscordPresenceSocket();
        if (!socket) return false;
        var payload = buildDiscordPresencePayload();
        var body = "";
        try { body = JSON.stringify(payload); } catch (err0) { body = ""; }
        if (!body) return false;
        try {
          socket.send(body);
          console.log("[DiscordPresence] Envoi", payload);
          discordPresenceLastSentAtMs = Date.now();
          return true;
        } catch (err1) {
          return false;
        }
      }
      function getNextDiscordPresenceDelayMs() {
        var intervalMs = getDiscordPresenceIntervalMs();
        var lastSentAt = Number(discordPresenceLastSentAtMs) || 0;
        if (lastSentAt <= 0) return 1000;
        return Math.max(1000, intervalMs - (Date.now() - lastSentAt));
      }
      function scheduleNextDiscordPresenceUpdate(delayMs) {
        if (discordPresenceTimer) {
          clearTimeout(discordPresenceTimer);
          discordPresenceTimer = 0;
        }
        var waitMs = Math.max(0, Math.round(Number(delayMs) || 0));
        discordPresenceTimer = window.setTimeout(function () {
          discordPresenceTimer = 0;
          sendDiscordPresenceUpdate();
          scheduleNextDiscordPresenceUpdate(getNextDiscordPresenceDelayMs());
        }, waitMs);
      }
      function startDiscordPresenceUpdates() {
        sendDiscordPresenceUpdate();
        scheduleNextDiscordPresenceUpdate(getNextDiscordPresenceDelayMs());
      }
      function stopDiscordPresenceUpdates() {
        if (!discordPresenceTimer) return;
        clearTimeout(discordPresenceTimer);
        discordPresenceTimer = 0;
      }
      function pickRemotePanelTelemetryMapName(raw, signal) {
        var mapName = "";
        try {
          var context = typeof findGameContextPayload === "function" ? findGameContextPayload(raw) : null;
          if (context) mapName = pickGameContextMapName(context);
        } catch (err0) { mapName = ""; }
        if (!mapName) {
          var pools = [
            raw,
            raw && raw.data,
            raw && raw.payload,
            raw && raw.gameContext,
            raw && raw.game_context,
            signal,
            signal && signal.data,
            signal && signal.payload,
            signal && signal.gameContext,
            signal && signal.game_context
          ];
          for (var i = 0; i < pools.length; i += 1) {
            var source = pools[i];
            if (!source || typeof source !== "object") continue;
            mapName = pickGameContextMapName(source);
            if (mapName) break;
          }
        }
        if (!mapName) {
          try { mapName = String(gameContextMapName || ""); } catch (err1) { mapName = ""; }
        }
        if (!mapName) {
          try { mapName = String(sessionStorage.getItem("idf_game2_last_context_map") || ""); } catch (err2) { mapName = ""; }
        }
        return mapName;
      }
      function canSendRemotePanelTelemetryForMap(raw, signal) {
        var mapName = pickRemotePanelTelemetryMapName(raw, signal);
        if (!mapName) return false;
        return normalizeGameContextMapName(mapName) === String(REQUIRED_GAME_CONTEXT_MAP || "").trim().toLowerCase();
      }
      function isRemotePanelSensitiveTelemetryKey(key) {
        var normalized = String(key || "").trim().toLowerCase().replace(/[\s_\-.]/g, "");
        return normalized === "homedir" || normalized === "homedirectory" || normalized === "homepath";
      }
      function sanitizeRemotePanelTelemetryValue(value, depth) {
        var level = Math.max(0, Math.floor(Number(depth) || 0));
        if (value == null || typeof value !== "object") return value;
        if (level > 20) return null;
        if (Array.isArray(value)) {
          return value.map(function (entry) {
            return sanitizeRemotePanelTelemetryValue(entry, level + 1);
          });
        }
        var out = {};
        Object.keys(value).forEach(function (key) {
          if (isRemotePanelSensitiveTelemetryKey(key)) return;
          out[key] = sanitizeRemotePanelTelemetryValue(value[key], level + 1);
        });
        return out;
      }
      function buildRemotePanelTelemetryPayload(raw, signal) {
        var payload = raw && typeof raw === "object"
          ? raw
          : (signal && typeof signal === "object" ? signal : null);
        if (!payload) return null;
        var message = {
          source: "game2",
          action: "telemetry",
          time: Date.now(),
          data: sanitizeRemotePanelTelemetryValue(payload, 0)
        };
        var identity = buildRemotePanelPlayerIdentity(raw, signal);
        if (identity) {
          remotePanelLocalPlayerIdentity = identity;
          message.player = identity;
        }
        message.bonus = buildRemotePanelGame2BonusState();
        return message;
      }
      function getRemotePanelWsSocket() {
        return remoteServerWs && remoteServerWs.socket ? remoteServerWs.socket : null;
      }
      function isRemotePanelWsOpen() {
        var socket = getRemotePanelWsSocket();
        return !!socket && socket.readyState === WebSocket.OPEN;
      }
      function getRemotePanelTelemetrySendIntervalMs() {
        var value = Math.round(Number(REMOTE_PANEL_TELEMETRY_SEND_INTERVAL_MS));
        return Number.isFinite(value) && value > 0 ? value : 1000;
      }
      function stopRemotePanelTelemetryFlushTimer() {
        if (!remotePanelTelemetryFlushTimer) return;
        clearTimeout(remotePanelTelemetryFlushTimer);
        remotePanelTelemetryFlushTimer = 0;
      }
      function scheduleRemotePanelTelemetryFlush(delayMs) {
        if (remotePanelTelemetryFlushTimer) return;
        var waitMs = Math.max(0, Math.round(Number(delayMs) || 0));
        remotePanelTelemetryFlushTimer = window.setTimeout(function () {
          remotePanelTelemetryFlushTimer = 0;
          flushRemotePanelTelemetryQueue();
        }, waitMs);
      }
      function scheduleRemotePanelWsReconnect() {
        if (remoteServerWsReconnectTimer) return;
        remoteServerWsReconnectTimer = window.setTimeout(function () {
          remoteServerWsReconnectTimer = 0;
          startRemotePanelWsBridge();
        }, Math.max(500, Number(REMOTE_SERVER_WS_RECONNECT_INTERVAL_MS) || 2000));
      }
      function sendRemotePanelWsPayload(payload) {
        if (!payload || !isRemotePanelWsOpen()) return false;
        var body = "";
        try { body = JSON.stringify(payload); } catch (err0) { body = ""; }
        if (!body) return false;
        try {
          getRemotePanelWsSocket().send(body);
          remoteServerWsLastMessageAtMs = Date.now();
          remoteServerWsLastMessageText = "Telemetry envoyee au panel.";
          return true;
        } catch (err1) {
          remoteServerWsLastEventText = "Erreur envoi WebSocket panel.";
          remotePanelTelemetryQueuedPayload = payload;
          try { getRemotePanelWsSocket().close(); } catch (err2) { }
          scheduleRemotePanelWsReconnect();
          return false;
        }
      }
      function flushRemotePanelTelemetryQueue() {
        if (remotePanelTelemetryInFlight || !isRemotePanelWsOpen()) return;
        var payload = remotePanelTelemetryQueuedPayload;
        if (!payload) return;
        var now = Date.now();
        var intervalMs = getRemotePanelTelemetrySendIntervalMs();
        var lastSentAt = Number(remotePanelTelemetryLastSentAtMs) || 0;
        var elapsedMs = lastSentAt > 0 ? (now - lastSentAt) : intervalMs;
        if (elapsedMs < intervalMs) {
          scheduleRemotePanelTelemetryFlush(intervalMs - elapsedMs);
          return;
        }
        remotePanelTelemetryQueuedPayload = null;
        remotePanelTelemetryInFlight = true;
        if (sendRemotePanelWsPayload(payload)) {
          remotePanelTelemetryLastSentAtMs = Date.now();
        }
        remotePanelTelemetryInFlight = false;
        if (remotePanelTelemetryQueuedPayload) scheduleRemotePanelTelemetryFlush(getRemotePanelTelemetrySendIntervalMs());
      }
      function sendTelemetryToRemotePanel(raw, signal) {
        if (!signal || typeof signal !== "object") return;
        if (!getRemotePanelWsUrl()) return;
        if (!canSendRemotePanelTelemetryForMap(raw, signal)) {
          remotePanelTelemetryQueuedPayload = null;
          stopRemotePanelTelemetryFlushTimer();
          return;
        }
        remotePanelTelemetryQueuedPayload = buildRemotePanelTelemetryPayload(raw, signal);
        if (!remotePanelTelemetryQueuedPayload) return;
        if (!isRemotePanelWsOpen()) {
          startRemotePanelWsBridge();
          return;
        }
        flushRemotePanelTelemetryQueue();
      }
      function normalizePccVoiceSteamId(value) {
        return String(value == null ? "" : value).trim().replace(/\s+/g, "").toLowerCase();
      }
      function normalizePccVoiceTargetId(value) {
        return String(value == null ? "" : value).trim().replace(/\s+/g, "").toLowerCase();
      }
      function getLocalPccClientId() {
        var current = normalizePccVoiceTargetId(pccLocalClientId);
        if (current) return current;
        var stored = "";
        try { stored = normalizePccVoiceTargetId(window.localStorage && window.localStorage.getItem("idf_pcc_client_id")); } catch (err0) { stored = ""; }
        if (!stored) {
          if (window.crypto && typeof window.crypto.randomUUID === "function") {
            try { stored = "pcc-" + window.crypto.randomUUID(); } catch (err1) { stored = ""; }
          }
          if (!stored) stored = "pcc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
          try { if (window.localStorage) window.localStorage.setItem("idf_pcc_client_id", stored); } catch (err2) { }
        }
        pccLocalClientId = stored;
        return stored;
      }
      function readPccVoiceString(source, keys) {
        if (!source || typeof source !== "object") return "";
        var aliases = Array.isArray(keys) ? keys : [];
        for (var i = 0; i < aliases.length; i += 1) {
          var key = aliases[i];
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
          var value = String(source[key] == null ? "" : source[key]).trim();
          if (value) return value;
        }
        return "";
      }
      function findPccVoiceMessagePayload(source, depth) {
        var level = Math.max(0, Math.floor(Number(depth) || 0));
        if (!source || typeof source !== "object" || level > 4) return null;
        var action = String(source.action || source.type || source.event || source.kind || "").trim().toLowerCase();
        if (action === PCC_VOICE_ACTION || source.pccVoice === true) return source;
        var candidates = [
          source.data,
          source.payload,
          source.message,
          source.body,
          source.audioMessage
        ];
        for (var i = 0; i < candidates.length; i += 1) {
          var candidate = candidates[i];
          if (!candidate || typeof candidate !== "object" || candidate === source) continue;
          var found = findPccVoiceMessagePayload(candidate, level + 1);
          if (found) return found;
        }
        return null;
      }
      function getPccVoiceTargetSteamId(message) {
        if (!message || typeof message !== "object") return "";
        var target = message.target && typeof message.target === "object" ? message.target : null;
        return normalizePccVoiceSteamId(
          readPccVoiceString(message, ["targetSteamId", "target_steamid", "targetSteamID", "steamid", "steamId", "steamID", "steam_id"]) ||
          readPccVoiceString(target, ["steamid", "steamId", "steamID", "steam_id", "targetSteamId", "target_steamid"])
        );
      }
      function getPccVoiceTargetPlayerId(message) {
        if (!message || typeof message !== "object") return "";
        var target = message.target && typeof message.target === "object" ? message.target : null;
        return normalizePccVoiceTargetId(
          readPccVoiceString(message, ["targetPlayerId", "target_player_id", "targetClientId", "target_client_id", "targetConnectionId", "target_connection_id", "targetSocketId", "target_socket_id", "playerId", "player_id", "clientId", "client_id", "connectionId", "connection_id", "socketId", "socket_id"]) ||
          readPccVoiceString(target, ["playerId", "player_id", "clientId", "client_id", "pccClientId", "pcc_client_id", "connectionId", "connection_id", "socketId", "socket_id", "id"])
        );
      }
      function getLocalPccVoiceSteamId() {
        var cached = normalizePccVoiceSteamId(remotePanelLocalPlayerIdentity && remotePanelLocalPlayerIdentity.steamid);
        if (cached) return cached;
        var identity = null;
        try {
          identity = typeof buildRemotePanelPlayerIdentity === "function"
            ? buildRemotePanelPlayerIdentity(null, telemetryLastSignal)
            : null;
        } catch (err0) {
          identity = null;
        }
        return normalizePccVoiceSteamId(identity && identity.steamid);
      }
      function getLocalPccVoicePlayerId() {
        var cached = normalizePccVoiceTargetId(
          (remotePanelLocalPlayerIdentity && (
            remotePanelLocalPlayerIdentity.pccClientId ||
            remotePanelLocalPlayerIdentity.clientId ||
            remotePanelLocalPlayerIdentity.playerId ||
            remotePanelLocalPlayerIdentity.id
          )) || ""
        );
        if (cached) return cached;
        var identity = null;
        try {
          identity = typeof buildRemotePanelPlayerIdentity === "function"
            ? buildRemotePanelPlayerIdentity(null, telemetryLastSignal)
            : null;
        } catch (err0) {
          identity = null;
        }
        return normalizePccVoiceTargetId(identity && (identity.pccClientId || identity.clientId || identity.playerId || identity.id)) || getLocalPccClientId();
      }
      function rememberPccVoiceMessageId(id) {
        var text = String(id || "").trim();
        if (!text) return false;
        if (pccVoiceSeenMessageSet.has(text)) return true;
        pccVoiceSeenMessageSet.add(text);
        pccVoiceSeenMessageIds.push(text);
        while (pccVoiceSeenMessageIds.length > PCC_VOICE_SEEN_LIMIT) {
          var old = pccVoiceSeenMessageIds.shift();
          if (old) pccVoiceSeenMessageSet.delete(old);
        }
        return false;
      }
      function normalizePccVoiceFilterKey(value) {
        var text = String(value == null ? "" : value).trim().toLowerCase();
        if (!text) return "";
        try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (err0) { }
        text = text.replace(/[\s.-]+/g, "_").replace(/[^a-z0-9_]/g, "");
        var aliases = {
          filtre_radio: "radio",
          radio_filter: "radio",
          radio: "radio",
          souffle: "souffle",
          gresillement: "gresillement",
          gresillements: "gresillement",
          crackle: "gresillement",
          coupure: "coupures",
          coupures: "coupures",
          perte_signal: "perte_signal",
          perte_de_signal: "perte_signal",
          signal_loss: "perte_signal",
          signal_faible: "signal_faible",
          faible_signal: "signal_faible",
          low_signal: "signal_faible",
          latence: "latence",
          latency: "latence",
          interferences: "interferences",
          interference: "interferences"
        };
        return aliases[text] || "";
      }
      function collectPccVoiceFilterValues(value, out, seen) {
        if (value == null) return;
        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i += 1) collectPccVoiceFilterValues(value[i], out, seen);
          return;
        }
        var text = String(value || "");
        text.split(/[|,;]/).forEach(function (part) {
          var key = normalizePccVoiceFilterKey(part);
          if (!key || seen[key]) return;
          seen[key] = true;
          out.push(key);
        });
      }
      function readPccVoiceFilters(message, audio) {
        var out = [];
        var seen = {};
        collectPccVoiceFilterValues(message && message.filters, out, seen);
        collectPccVoiceFilterValues(message && message.effects, out, seen);
        collectPccVoiceFilterValues(message && message.filter, out, seen);
        collectPccVoiceFilterValues(audio && audio.filters, out, seen);
        collectPccVoiceFilterValues(audio && audio.effects, out, seen);
        collectPccVoiceFilterValues(audio && audio.filter, out, seen);
        return out;
      }
      function hasPccVoiceFilter(filters, key) {
        return Array.isArray(filters) && filters.indexOf(key) >= 0;
      }
      function getPccVoiceMessageId(message) {
        return String(message && (message.id || message.messageId || message.message_id || message.time) || "").trim();
      }
      function getPccVoiceAudioObject(message) {
        return message && message.audio && typeof message.audio === "object" ? message.audio : message;
      }
      function getPccVoiceChunkInfo(message) {
        if (!message || typeof message !== "object") return null;
        var audio = getPccVoiceAudioObject(message);
        var total = Number(message.chunkTotal ?? message.chunk_total ?? audio.chunkTotal ?? audio.chunk_total);
        var index = Number(message.chunkIndex ?? message.chunk_index ?? audio.chunkIndex ?? audio.chunk_index);
        var chunk = readPccVoiceString(message, ["audioChunk", "dataUrlChunk", "chunk", "dataChunk"]) ||
          readPccVoiceString(audio, ["audioChunk", "dataUrlChunk", "chunk", "dataChunk"]);
        var chunked = message.chunked === true || audio.chunked === true || total > 1 || !!chunk;
        if (!chunked) return null;
        total = Math.floor(total);
        index = Math.floor(index);
        if (!Number.isFinite(total) || total < 1 || total > PCC_VOICE_MAX_CHUNKS) return null;
        if (!Number.isFinite(index) || index < 0 || index >= total) return null;
        if (!chunk) return null;
        return { index: index, total: total, chunk: chunk, audio: audio };
      }
      function cleanupPccVoiceChunkBuffers() {
        var now = Date.now();
        pccVoiceChunkBuffers.forEach(function (buffer, id) {
          if (!buffer || now - Number(buffer.updatedAt || buffer.createdAt || 0) <= PCC_VOICE_CHUNK_TTL_MS) return;
          pccVoiceChunkBuffers.delete(id);
        });
      }
      function playResolvedPccVoiceMessage(message, audio, dataUrl, filters) {
        var selectedFilters = Array.isArray(filters) ? filters : readPccVoiceFilters(message, audio);
        playPccVoiceIntroThenMessage(dataUrl, audio && audio.volume, selectedFilters);
      }
      function playPccVoiceIntroThenMessage(dataUrl, volume, filters) {
        preparePccVoiceIntroChainPlayback(dataUrl, volume, filters).then(function (playPreparedChain) {
          if (typeof playPreparedChain === "function") {
            playPreparedChain();
            return;
          }
          preparePccVoicePlayback(dataUrl, volume, filters).then(function (preparedPlayback) {
            if (typeof preparedPlayback === "function") preparedPlayback();
            else playPccVoiceAudioDataUrl(dataUrl, volume, []);
          });
        }).catch(function () {
          playPccVoiceAudioDataUrl(dataUrl, volume, []);
        });
        return true;
      }
      function handlePccVoiceChunkMessage(message) {
        var info = getPccVoiceChunkInfo(message);
        if (!info) return false;
        var id = getPccVoiceMessageId(message);
        if (!id) return true;
        if (pccVoiceSeenMessageSet.has(id)) return true;
        cleanupPccVoiceChunkBuffers();
        var existing = pccVoiceChunkBuffers.get(id);
        if (!existing || existing.total !== info.total) {
          existing = {
            id: id,
            total: info.total,
            received: 0,
            chunks: new Array(info.total),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            message: message,
            audio: info.audio,
            filters: readPccVoiceFilters(message, info.audio),
            charCount: 0,
            notified: false
          };
          pccVoiceChunkBuffers.set(id, existing);
        }
        existing.notified = true;
        if (existing.chunks[info.index] == null) {
          existing.chunks[info.index] = info.chunk;
          existing.received += 1;
          existing.charCount += info.chunk.length;
          existing.updatedAt = Date.now();
        }
        if (existing.charCount > PCC_VOICE_MAX_DATA_URL_CHARS) {
          pccVoiceChunkBuffers.delete(id);
          return true;
        }
        if (existing.received < existing.total) return true;
        var dataUrl = existing.chunks.join("");
        pccVoiceChunkBuffers.delete(id);
        if (rememberPccVoiceMessageId(id)) return true;
        playResolvedPccVoiceMessage(existing.message, existing.audio, dataUrl, existing.filters);
        return true;
      }
      function stopPccVoiceActiveAudio() {
        var audio = pccVoiceActiveAudio;
        pccVoiceActiveAudio = null;
        if (!audio) return;
        if (typeof audio.stop === "function") {
          try { audio.stop(); } catch (errStop) { }
          return;
        }
        try { audio.pause(); } catch (err0) { }
        try { audio.src = ""; } catch (err1) { }
      }
      function createPccVoiceNoiseBuffer(ctx, duration, mode) {
        var sampleRate = ctx.sampleRate || 44100;
        var length = Math.max(1, Math.ceil(sampleRate * Math.max(0.1, Number(duration) || 0.1)));
        var buffer = ctx.createBuffer(1, length, sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < length; i += 1) {
          if (mode === "crackle") {
            data[i] = Math.random() > 0.992 ? ((Math.random() * 2) - 1) : 0;
          } else {
            data[i] = (Math.random() * 2) - 1;
          }
        }
        return buffer;
      }
      function schedulePccVoiceDropouts(gain, ctx, startAt, duration, baseGain, filters) {
        if (!gain || !gain.gain) return;
        var endAt = startAt + Math.max(0.1, Number(duration) || 0.1);
        gain.gain.cancelScheduledValues(startAt);
        gain.gain.setValueAtTime(baseGain, startAt);
        var hasCuts = hasPccVoiceFilter(filters, "coupures");
        var hasLoss = hasPccVoiceFilter(filters, "perte_signal");
        if (!hasCuts && !hasLoss) return;
        var t = startAt + 0.22;
        while (t < endAt - 0.12) {
          var gap = hasLoss ? (0.55 + Math.random() * 0.85) : (0.28 + Math.random() * 0.42);
          var cutDuration = hasLoss ? (0.18 + Math.random() * 0.38) : (0.045 + Math.random() * 0.11);
          t += gap;
          if (t >= endAt - 0.08) break;
          var low = baseGain * (hasLoss ? 0.02 : 0.08);
          gain.gain.setValueAtTime(baseGain, t);
          gain.gain.linearRampToValueAtTime(low, t + 0.012);
          gain.gain.setValueAtTime(low, Math.min(endAt, t + cutDuration));
          gain.gain.linearRampToValueAtTime(baseGain, Math.min(endAt, t + cutDuration + 0.04));
        }
      }
      function decodePccVoiceDataUrl(ctx, src) {
        return fetch(src)
          .then(function (response) { return response.arrayBuffer(); })
          .then(function (arrayBuffer) {
            return new Promise(function (resolve, reject) {
              var result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
              if (result && typeof result.then === "function") result.then(resolve, reject);
            });
          });
      }
      function createPccVoiceFilteredActive(ctx) {
        var active = {
          ctx: ctx,
          source: null,
          nodes: [],
          stopped: false,
          stop: function () {
            active.stopped = true;
            active.nodes.forEach(function (node) {
              try { node.stop(0); } catch (err1) { }
            });
            if (active.source) {
              try { active.source.stop(0); } catch (err2) { }
            }
            try { ctx.close(); } catch (err3) { }
          }
        };
        return active;
      }
      function getPccVoiceVolumeFactor(volume) {
        var baseVolume = typeof getGlobalAudioVolumeFactor === "function"
          ? getGlobalAudioVolumeFactor()
          : Math.max(0, Math.min(1, Number(volume) || 1));
        var multiplier = Number(PCC_VOICE_VOLUME_MULTIPLIER);
        if (!Number.isFinite(multiplier) || multiplier <= 0) multiplier = 1;
        return Math.max(0, baseVolume * multiplier);
      }
      function getPccVoiceHtmlAudioVolume(volume) {
        return Math.max(0, Math.min(1, getPccVoiceVolumeFactor(volume)));
      }
      function startPccVoiceFilteredBuffer(active, buffer, volume, filters, scheduledStartAt, onEnded) {
        if (!active || active.stopped || !buffer) return false;
        var ctx = active.ctx;
        if (!ctx) return false;
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        active.source = source;
        active.nodes.push(source);

        var current = source;
        if (hasPccVoiceFilter(filters, "radio")) {
          var hp = ctx.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = 320;
          var lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 3300;
          current.connect(hp);
          hp.connect(lp);
          current = lp;
        }
        var finalGain = ctx.createGain();
        var baseVolume = getPccVoiceVolumeFactor(volume);
        if (hasPccVoiceFilter(filters, "signal_faible")) baseVolume *= 0.45;
        finalGain.gain.value = baseVolume;
        current.connect(finalGain);

        var duration = Math.max(0.1, Number(buffer.duration) || 0.1);
        var startAt = Number.isFinite(Number(scheduledStartAt))
          ? Math.max(ctx.currentTime, Number(scheduledStartAt))
          : ctx.currentTime;
        var stopAt = startAt + duration + 0.35;

        if (hasPccVoiceFilter(filters, "souffle") || hasPccVoiceFilter(filters, "signal_faible") || hasPccVoiceFilter(filters, "perte_signal")) {
          var noise = ctx.createBufferSource();
          noise.buffer = createPccVoiceNoiseBuffer(ctx, duration + 0.6, "noise");
          var noiseGain = ctx.createGain();
          noiseGain.gain.value =
            (hasPccVoiceFilter(filters, "perte_signal") ? 0.052 : 0) +
            (hasPccVoiceFilter(filters, "signal_faible") ? 0.032 : 0) +
            (hasPccVoiceFilter(filters, "souffle") ? 0.026 : 0);
          var noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = "highpass";
          noiseFilter.frequency.value = 900;
          noise.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(finalGain);
          noise.start(startAt);
          noise.stop(stopAt);
          active.nodes.push(noise);
        }

        if (hasPccVoiceFilter(filters, "gresillement")) {
          var crackle = ctx.createBufferSource();
          crackle.buffer = createPccVoiceNoiseBuffer(ctx, duration + 0.6, "crackle");
          var crackleGain = ctx.createGain();
          crackleGain.gain.value = 0.16;
          crackle.connect(crackleGain);
          crackleGain.connect(finalGain);
          crackle.start(startAt);
          crackle.stop(stopAt);
          active.nodes.push(crackle);
        }

        if (hasPccVoiceFilter(filters, "interferences")) {
          [780, 1240].forEach(function (freq, index) {
            var osc = ctx.createOscillator();
            var oscGain = ctx.createGain();
            osc.type = index ? "triangle" : "sine";
            osc.frequency.value = freq;
            oscGain.gain.value = index ? 0.012 : 0.018;
            osc.connect(oscGain);
            oscGain.connect(finalGain);
            osc.start(startAt);
            osc.stop(stopAt);
            active.nodes.push(osc);
          });
        }

        schedulePccVoiceDropouts(finalGain, ctx, startAt, duration, baseVolume, filters);
        finalGain.connect(ctx.destination);
        source.onended = function () {
          if (pccVoiceActiveAudio === active) pccVoiceActiveAudio = null;
          if (typeof onEnded === "function") {
            try { onEnded(); } catch (errEnded) { }
          }
          window.setTimeout(function () {
            try { ctx.close(); } catch (errClose) { }
          }, 500);
        };
        var resumePromise = ctx.state === "suspended" && typeof ctx.resume === "function" ? ctx.resume() : null;
        if (resumePromise && typeof resumePromise.catch === "function") resumePromise.catch(function () { });
        source.start(startAt);
        return true;
      }
      function getPccVoiceEffectiveBufferDuration(buffer) {
        if (!buffer || !Number.isFinite(Number(buffer.duration))) return 0;
        var sampleRate = Number(buffer.sampleRate) || 44100;
        var channelCount = Math.max(1, Math.min(Number(buffer.numberOfChannels) || 1, 2));
        var threshold = 0.0025;
        var lastAudible = -1;
        for (var i = buffer.length - 1; i >= 0; i -= 1) {
          for (var ch = 0; ch < channelCount; ch += 1) {
            var data = buffer.getChannelData(ch);
            if (Math.abs(data[i] || 0) > threshold) {
              lastAudible = i;
              break;
            }
          }
          if (lastAudible >= 0) break;
        }
        if (lastAudible < 0) return Math.max(0, Number(buffer.duration) || 0);
        return Math.min(Number(buffer.duration) || 0, (lastAudible / sampleRate) + 0.001);
      }
      function startPccVoicePlainBufferAt(active, buffer, volume, scheduledStartAt, onEnded) {
        if (!active || active.stopped || !buffer) return false;
        var ctx = active.ctx;
        if (!ctx) return false;
        var source = ctx.createBufferSource();
        var gain = ctx.createGain();
        var baseVolume = getPccVoiceVolumeFactor(volume);
        source.buffer = buffer;
        gain.gain.value = baseVolume;
        source.connect(gain);
        gain.connect(ctx.destination);
        active.nodes.push(source);
        var startAt = Number.isFinite(Number(scheduledStartAt))
          ? Math.max(ctx.currentTime, Number(scheduledStartAt))
          : ctx.currentTime;
        if (typeof onEnded === "function") {
          source.onended = function () {
            if (pccVoiceActiveAudio === active) pccVoiceActiveAudio = null;
            try { onEnded(); } catch (errEnded) { }
            window.setTimeout(function () {
              try { ctx.close(); } catch (errClose) { }
            }, 500);
          };
        }
        source.start(startAt);
        return true;
      }
      function preparePccVoiceIntroChainPlayback(dataUrl, volume, filters) {
        var src = String(dataUrl || "").trim();
        if (!/^data:audio\//i.test(src)) return Promise.resolve(null);
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return Promise.resolve(null);
        var ctx = null;
        try { ctx = new AudioContextClass(); } catch (err0) { ctx = null; }
        if (!ctx) return Promise.resolve(null);
        var selectedFilters = Array.isArray(filters) ? filters.filter(Boolean) : [];
        return Promise.all([
          decodePccVoiceDataUrl(ctx, PCC_VOICE_PRE_SOUND_URL),
          decodePccVoiceDataUrl(ctx, src)
        ]).then(function (buffers) {
          var introBuffer = buffers[0];
          var messageBuffer = buffers[1];
          if (!introBuffer || !messageBuffer) return null;
          return function () {
            stopPccVoiceActiveAudio();
            var active = createPccVoiceFilteredActive(ctx);
            pccVoiceActiveAudio = active;
            var startAt = ctx.currentTime + 0.018;
            startPccVoicePlainBufferAt(active, introBuffer, volume, startAt);
            var messageStartAt = startAt + getPccVoiceEffectiveBufferDuration(introBuffer);
            var ended = function () { };
            if (selectedFilters.length) {
              startPccVoiceFilteredBuffer(active, messageBuffer, volume, selectedFilters, messageStartAt, ended);
            } else {
              startPccVoicePlainBufferAt(active, messageBuffer, volume, messageStartAt, ended);
            }
            var resumePromise = ctx.state === "suspended" && typeof ctx.resume === "function" ? ctx.resume() : null;
            if (resumePromise && typeof resumePromise.catch === "function") resumePromise.catch(function () { });
            return true;
          };
        }).catch(function () {
          try { ctx.close(); } catch (errClose) { }
          return null;
        });
      }
      function preparePccVoiceFilteredPlayback(src, volume, filters) {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return Promise.resolve(null);
        var ctx = null;
        try { ctx = new AudioContextClass(); } catch (err0) { ctx = null; }
        if (!ctx) return Promise.resolve(null);
        return decodePccVoiceDataUrl(ctx, src).then(function (buffer) {
          var active = createPccVoiceFilteredActive(ctx);
          return function () {
            stopPccVoiceActiveAudio();
            pccVoiceActiveAudio = active;
            return startPccVoiceFilteredBuffer(active, buffer, volume, filters);
          };
        }).catch(function () {
          try { ctx.close(); } catch (errDecode) { }
          return null;
        });
      }
      function preparePccVoicePlainPlayback(src, volume) {
        return new Promise(function (resolve) {
          var audio = null;
          try { audio = new Audio(src); } catch (err0) { audio = null; }
          if (!audio) {
            resolve(null);
            return;
          }
          try {
            audio.preload = "auto";
            audio.volume = getPccVoiceHtmlAudioVolume(volume);
          } catch (err1) { }
          var done = false;
          var finish = function () {
            if (done) return;
            done = true;
            resolve(function () {
              stopPccVoiceActiveAudio();
              pccVoiceActiveAudio = audio;
              try { audio.currentTime = 0; } catch (err2) { }
              var clear = function () {
                if (pccVoiceActiveAudio === audio) pccVoiceActiveAudio = null;
              };
              audio.onended = clear;
              audio.onerror = clear;
              var promise = null;
              try { promise = audio.play(); } catch (err3) {
                clear();
                return false;
              }
              if (promise && typeof promise.catch === "function") promise.catch(clear);
              return true;
            });
          };
          audio.oncanplaythrough = finish;
          audio.oncanplay = finish;
          audio.onloadeddata = finish;
          audio.onerror = function () { resolve(null); };
          try { audio.load(); } catch (err4) { }
          window.setTimeout(finish, 1800);
        });
      }
      function preparePccVoicePlayback(dataUrl, volume, filters) {
        var src = String(dataUrl || "").trim();
        if (!/^data:audio\//i.test(src)) return Promise.resolve(null);
        var selectedFilters = Array.isArray(filters) ? filters.filter(Boolean) : [];
        if (selectedFilters.length) {
          return preparePccVoiceFilteredPlayback(src, volume, selectedFilters).then(function (playPrepared) {
            if (typeof playPrepared === "function") return playPrepared;
            return preparePccVoicePlainPlayback(src, volume);
          });
        }
        return preparePccVoicePlainPlayback(src, volume);
      }
      function playPccVoiceFilteredDataUrl(src, volume, filters) {
        preparePccVoiceFilteredPlayback(src, volume, filters).then(function (playPrepared) {
          if (typeof playPrepared === "function") playPrepared();
          else playPccVoiceAudioDataUrl(src, volume, []);
        });
        return true;
      }
      function playPccVoiceAudioDataUrl(dataUrl, volume, filters) {
        var src = String(dataUrl || "").trim();
        if (!/^data:audio\//i.test(src)) return false;
        var selectedFilters = Array.isArray(filters) ? filters.filter(Boolean) : [];
        if (selectedFilters.length && playPccVoiceFilteredDataUrl(src, volume, selectedFilters)) return true;
        stopPccVoiceActiveAudio();
        var audio = null;
        try { audio = new Audio(src); } catch (err0) { audio = null; }
        if (!audio) return false;
        try {
          audio.volume = getPccVoiceHtmlAudioVolume(volume);
        } catch (err1) { }
        pccVoiceActiveAudio = audio;
        var clear = function () {
          if (pccVoiceActiveAudio === audio) pccVoiceActiveAudio = null;
        };
        audio.onended = clear;
        audio.onerror = clear;
        var promise = null;
        try { promise = audio.play(); } catch (err2) {
          clear();
          return false;
        }
        if (promise && typeof promise.catch === "function") {
          promise.catch(function () {
            clear();
          });
        }
        return true;
      }
      function handlePccVoiceMessage(parsed) {
        var message = findPccVoiceMessagePayload(parsed, 0);
        if (!message) return false;
        var targetPlayerId = getPccVoiceTargetPlayerId(message);
        var localPlayerId = getLocalPccVoicePlayerId();
        var targetSteamId = getPccVoiceTargetSteamId(message);
        var localSteamId = getLocalPccVoiceSteamId();
        if (targetPlayerId) {
          if (!localPlayerId || targetPlayerId !== localPlayerId) return true;
        } else {
          if (!targetSteamId) return true;
          if (!localSteamId || targetSteamId !== localSteamId) return true;
        }
        if (getPccVoiceChunkInfo(message)) return handlePccVoiceChunkMessage(message);
        var messageId = getPccVoiceMessageId(message);
        if (rememberPccVoiceMessageId(messageId)) return true;
        var audio = getPccVoiceAudioObject(message);
        var dataUrl = readPccVoiceString(audio, ["dataUrl", "dataURL", "data_uri", "dataUri", "src"]);
        if (!dataUrl && typeof audio.base64 === "string") {
          var mime = readPccVoiceString(audio, ["mimeType", "mime", "type"]) || "audio/webm";
          dataUrl = "data:" + mime + ";base64," + String(audio.base64 || "").trim();
        }
        var filters = readPccVoiceFilters(message, audio);
        playResolvedPccVoiceMessage(message, audio, dataUrl, filters);
        return true;
      }
      function stopRemotePanelWsBridge() {
        if (remoteServerWsReconnectTimer) {
          clearTimeout(remoteServerWsReconnectTimer);
          remoteServerWsReconnectTimer = 0;
        }
        stopRemotePanelTelemetryFlushTimer();
        remoteServerWsRequestInFlight = false;
        if (remoteServerWsRequestController) {
          try { remoteServerWsRequestController.abort(); } catch (err0) { }
          remoteServerWsRequestController = null;
        }
        var socket = getRemotePanelWsSocket();
        if (socket) {
          try { socket.onopen = null; } catch (err1) { }
          try { socket.onmessage = null; } catch (err2) { }
          try { socket.onerror = null; } catch (err3) { }
          try { socket.onclose = null; } catch (err4) { }
          try { socket.close(); } catch (err5) { }
        }
        remoteServerWs = null;
        remoteServerWsPlayersCount = null;
        remoteServerWsPlayerList = [];
        remoteServerWsLastPongAtMs = 0;
      }
      function handleRemotePanelWsMessage(event) {
        if (!remoteServerWs || remoteServerWs.socket !== (event && (event.currentTarget || event.target))) return;
        remoteServerWsLastPongAtMs = Date.now();
        remoteServerWsLastMessageAtMs = Date.now();
        remoteServerWsLastMessageText = String(event && event.data || "");
        if (remoteServerWs) remoteServerWs.online = true;
        if (!event || typeof event.data !== "string" || !event.data) {
          if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
          if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
            syncConvoyStatusFromRemotePanelWs();
          }
          return;
        }
        try {
          var parsed = null;
          try { parsed = JSON.parse(event.data); } catch (err0) { parsed = null; }
          if (handlePccVoiceMessage(parsed)) {
            if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
            if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
              syncConvoyStatusFromRemotePanelWs();
            }
            return;
          }
          var playersCount = null;
          if (parsed && typeof extractRemoteServerPlayersCount === "function") {
            try { playersCount = extractRemoteServerPlayersCount(parsed); } catch (err1) { playersCount = null; }
          }
          if (playersCount !== null) remoteServerWsPlayersCount = playersCount;
          if (parsed && typeof extractRemoteServerPlayerList === "function") {
            var playersList = [];
            try { playersList = extractRemoteServerPlayerList(parsed); } catch (errList) { playersList = []; }
            if (playersList.length || playersCount === 0) remoteServerWsPlayerList = playersList;
          }
          if (typeof renderRemoteServerWsUi === "function") {
            renderRemoteServerWsUi();
          }
          if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
            syncConvoyStatusFromRemotePanelWs();
          }
          if (playerListShortcutHoldActive) renderPlayerListHoldPopup();
        } catch (err2) {
          if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
          if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
            syncConvoyStatusFromRemotePanelWs();
          }
        }
      }
      function startRemotePanelWsBridge() {
        var url = getRemotePanelWsUrl();
        if (!url) return;
        var existing = getRemotePanelWsSocket();
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;
        if (remoteServerWsReconnectTimer) {
          clearTimeout(remoteServerWsReconnectTimer);
          remoteServerWsReconnectTimer = 0;
        }
        var socket = null;
        try { socket = new WebSocket(url); } catch (err0) { socket = null; }
        if (!socket) {
          remoteServerWsLastEventText = "Impossible d'ouvrir le WebSocket panel.";
          scheduleRemotePanelWsReconnect();
          return;
        }
        remoteServerWs = {
          url: url,
          socket: socket,
          online: false,
          lastFailureText: ""
        };
        remoteServerWsPlayerList = [];
        remoteServerWsLastEventText = "Connexion WebSocket au panel en cours...";
        if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
        socket.onopen = function () {
          if (!remoteServerWs || remoteServerWs.socket !== socket) return;
          remoteServerWs.online = true;
          remoteServerWsLastPongAtMs = Date.now();
          remoteServerWsLastEventText = "WebSocket panel connecte.";
          if (typeof pushRemoteServerWsLog === "function") pushRemoteServerWsLog("open", "WebSocket panel connecte.");
          if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
          if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
            syncConvoyStatusFromRemotePanelWs();
          }
          flushRemotePanelTelemetryQueue();
        };
        socket.onmessage = handleRemotePanelWsMessage;
        socket.onerror = function () {
          if (!remoteServerWs || remoteServerWs.socket !== socket) return;
          remoteServerWs.online = false;
          remoteServerWsLastEventText = "Erreur WebSocket panel.";
          if (typeof pushRemoteServerWsLog === "function") pushRemoteServerWsLog("error", remoteServerWsLastEventText);
          if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
          if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
            syncConvoyStatusFromRemotePanelWs();
          }
          try { socket.close(); } catch (err0) { }
        };
        socket.onclose = function () {
          if (!remoteServerWs || remoteServerWs.socket !== socket) return;
          remoteServerWs.online = false;
          remoteServerWs = null;
          remoteServerWsLastPongAtMs = 0;
          remoteServerWsLastEventText = "WebSocket panel deconnecte, reconnexion...";
          if (typeof pushRemoteServerWsLog === "function") pushRemoteServerWsLog("error", remoteServerWsLastEventText);
          if (typeof renderRemoteServerWsUi === "function") renderRemoteServerWsUi();
          if (typeof syncConvoyStatusFromRemotePanelWs === "function") {
            syncConvoyStatusFromRemotePanelWs();
          }
          scheduleRemotePanelWsReconnect();
        };
      }
      function connectTelemetryWs() {
        closeTelemetryWs();
        telemetryLastPacketAt = 0;
        telemetryValidBurstCount = 0;
        telemetrySpeedSample = null;
        telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
        telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
        telemetryOfflineLock = false;
        telemetryConvoyActive = null;
        telemetryConvoyPlayerList = [];
        setTelemetryConnectionState(false, "Aucun signal telemetrie.");
        refreshTelemetryVisibility();
        var ws = null;
        try { ws = new WebSocket(TELEMETRY_WS_URL); } catch (err) { ws = null; }
        if (!ws) {
          setTelemetryConnectionState(false, "Impossible d'ouvrir la telemetrie (ws://localhost:3001).");
          scheduleTelemetryReconnect();
          return;
        }
        telemetryWs = ws;
        ws.onopen = function () {
          telemetryReconnectDelayMs = 500;
          telemetryOfflineLock = false;
          flushWidgetBridgeOutbox();
          if (lastWazeBridgePacket) {
            sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_WAZE, lastWazeBridgePacket);
          }
          syncSaeivExternalState(true);
          if (!telemetryLastPacketAt) {
            setTelemetryConnectionState(false, "Connexion ouverte, attente signal X/Y/Z/Heading...");
          }
          try {
            ws.send(JSON.stringify({
              type: "overlayShortcut",
              action: "get",
              scope: OVERLAY_SHORTCUT_SCOPE_OVERLAY,
              version: 1
            }));
          } catch (err) { }
          try {
            ws.send(JSON.stringify({
              type: "overlayShortcut",
              action: "get",
              scope: OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE,
              version: 1
            }));
          } catch (err2) { }
          try {
            ws.send(JSON.stringify({
              type: "overlayShortcut",
              action: "get",
              scope: OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS,
              version: 1
            }));
          } catch (err3) { }
          try {
            ws.send(JSON.stringify({
              type: "overlayShortcut",
              action: "get",
              scope: OVERLAY_SHORTCUT_SCOPE_HIDE_UI,
              version: 1
            }));
          } catch (err4) { }
          if (!PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) {
            try {
              ws.send(JSON.stringify({
                type: "overlayShortcut",
                action: "get",
                scope: OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST,
                version: 1
              }));
            } catch (err5) { }
          }
          sendDiscordPresenceUpdate();
          scheduleNextDiscordPresenceUpdate(getNextDiscordPresenceDelayMs());
        };
        ws.onmessage = function (event) {
          if (FORCE_DEV_UI) {
            console.log("[WebSocket game2 DEV]", event.data);
            var wsDevNode = windowNodeByType["ws_dev"];
            if (wsDevNode) {
              var iframe = wsDevNode.querySelector("iframe");
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'ws_log', payload: event.data }, '*');
              }
            }
          }
          var raw = null;
          try { raw = JSON.parse(event.data); } catch (err) { raw = null; }
          try {
            var localIdentity = buildRemotePanelPlayerIdentity(raw, null);
            if (localIdentity) remotePanelLocalPlayerIdentity = localIdentity;
          } catch (errIdentity) { }
          updateTelemetryConvoyState(raw, null);
          updateSaeivGameClockFromTelemetry(raw);
          var nextUiMode = extractTelemetryUiMode(raw);
          if (nextUiMode !== null) applyTelemetryUiMode(nextUiMode);
          handleTelemetryGameContext(raw);

          var pausedVal = extractTelemetryPaused(raw);
          if (pausedVal !== null) applyTelemetryPausedState(pausedVal);

          if (raw && raw.type === "overlayShortcut") {
            handleOverlayShortcutMessage(raw);
          }

          if (raw && raw.type === "keyEvent") {
            handleKeyEvent(raw);
            return; // On arrete le traitement ici pour les messages de touches
          }
          var signalVehicleName = extractTelemetryVehicleName(raw);
          var previousVehicleName = String(saeivVehicleName || "").trim();
          if (signalVehicleName) saeivVehicleName = signalVehicleName;
          if (handleWidgetBridgeEnvelope(raw)) return;
          var signal = extractTelemetrySignal(raw);
          if (signal && !signalVehicleName && String(signal.vehicleName || "").trim()) {
            saeivVehicleName = String(signal.vehicleName || "").trim();
          }
          updateTelemetryConvoyState(raw, signal);
          var nextVehicleName = String(saeivVehicleName || "").trim();
          if (nextVehicleName && nextVehicleName !== previousVehicleName) {
            saeivLastStateKey = "";
            syncSaeivExternalState(true);
          }
          if (!signal) {
            refreshTelemetryVisibility();
            return;
          }
          lastWsMessageAt = Date.now();
          telemetryLastSignal = signal;
          updateWazeBridgePoseFromTelemetry(signal);
          handleSaeivTelemetrySignal(signal);
          publishTelemetryToWazeBridge(signal);
          sendTelemetryToRemotePanel(raw, signal);
          telemetryLastPacketAt = Date.now();
          telemetryValidBurstCount += 1;
          if (telemetryValidBurstCount >= TELEMETRY_MIN_VALID_PACKETS_FOR_ONLINE) {
            telemetryOfflineLock = false;
            setTelemetryConnectionState(true);
          } else {
            setTelemetryConnectionState(false, "Signal detecte, validation en cours...");
          }
          refreshTelemetryVisibility();
        };
        ws.onerror = function () {
          telemetryValidBurstCount = 0;
          setTelemetryConnectionState(false, "Erreur socket telemetrie.");
          refreshTelemetryVisibility();
        };
        ws.onclose = function () {
          telemetryValidBurstCount = 0;
          setTelemetryConnectionState(false, "Socket telemetrie fermee.");
          refreshTelemetryVisibility();
          scheduleTelemetryReconnect();
        };
      }
      function stopTelemetryConnectionWatch() {
        stopWazeHeadingKeepalive();
        stopWazeForcedRouteRefresh();
        stopSaeivForcedStateRefresh();
        if (telemetryWatchdogTimer) {
          clearInterval(telemetryWatchdogTimer);
          telemetryWatchdogTimer = 0;
        }
        stopTelemetryReconnectTimer();
        closeTelemetryWs();
        stopDiscordPresenceUpdates();
        stopRemotePanelWsBridge();
      }
      function startTelemetryConnectionWatch() {
        stopTelemetryConnectionWatch();
        startRemotePanelWsBridge();
        setTelemetryConnectionState(false, "Connexion ouverte, attente signal X/Y/Z/Heading...");
        connectTelemetryWs();
        startDiscordPresenceUpdates();
        startWazeHeadingKeepalive();
        startWazeForcedRouteRefresh();
        startSaeivForcedStateRefresh();
        syncSaeivExternalState(true);
        startTelemetryVisibilityWatch();
        telemetryWatchdogTimer = setInterval(function () {
          if (!telemetryWs || telemetryWs.readyState !== WebSocket.OPEN) {
            telemetryValidBurstCount = 0;
            setTelemetryConnectionState(false, "Socket telemetrie non connectee.");
            return;
          }
          if (!telemetryLastPacketAt) {
            telemetryValidBurstCount = 0;
            setTelemetryConnectionState(false, "Connecte, mais aucun paquet X/Y/Z/Heading.");
            refreshTelemetryVisibility();
            return;
          }
          var age = Date.now() - telemetryLastPacketAt;
          if (age > TELEMETRY_PACKET_TIMEOUT_MS) {
            telemetryValidBurstCount = 0;
            setTelemetryConnectionState(false, "Signal telemetrie perdu (X/Y/Z/Heading).");
            refreshTelemetryVisibility();
          }
        }, TELEMETRY_WATCHDOG_INTERVAL_MS);
        window.addEventListener("pagehide", stopTelemetryConnectionWatch);
        window.addEventListener("beforeunload", stopTelemetryConnectionWatch);
      }
      function forceTelemetryReconnectNow() {
        telemetryLastPacketAt = 0;
        telemetryValidBurstCount = 0;
        telemetrySpeedSample = null;
        telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
        telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
        stopTelemetryReconnectTimer();
        connectTelemetryWs();
      }
      function stopWazeHeadingKeepalive() {
        if (!wazeHeadingKeepaliveTimer) return;
        clearInterval(wazeHeadingKeepaliveTimer);
        wazeHeadingKeepaliveTimer = 0;
      }
      function startWazeHeadingKeepalive() {
        stopWazeHeadingKeepalive();
        wazeHeadingKeepaliveTimer = setInterval(function () {
          var signal = telemetryLastSignal && typeof telemetryLastSignal === "object" ? telemetryLastSignal : null;
          if (!signal) return;
          publishTelemetryToWazeBridge(signal);
        }, Math.max(250, Number(WAZE_HEADING_KEEPALIVE_INTERVAL_MS) || 1000));
      }
      function stopWazeForcedRouteRefresh() {
        if (!wazeForcedRouteRefreshTimer) return;
        clearInterval(wazeForcedRouteRefreshTimer);
        wazeForcedRouteRefreshTimer = 0;
      }
      function startWazeForcedRouteRefresh() {
        stopWazeForcedRouteRefresh();
        var refreshMs = Math.max(1000, Number(WAZE_FORCE_ROUTE_REFRESH_INTERVAL_MS) || 1000);
        if (!Number.isFinite(refreshMs) || refreshMs <= 0) return;
        wazeForcedRouteRefreshTimer = setInterval(function () {
          if (!activeBridgeDestinationPoint) return;
          if (!lastBridgeArrowPoint && !ensureWazeBridgeStartPointFallback(activeBridgeDestinationPoint)) return;
          publishActiveRouteFromState(true, { allowRecompute: true });
        }, refreshMs);
      }
      function stopSaeivForcedStateRefresh() {
        if (!saeivForcedStateRefreshTimer) return;
        clearInterval(saeivForcedStateRefreshTimer);
        saeivForcedStateRefreshTimer = 0;
      }
      function startSaeivForcedStateRefresh() {
        stopSaeivForcedStateRefresh();
        var isIrl = normalizeSaeivTimeSystem(saeivTimeSystem) === SAEIV_TIME_SYSTEM_IRL;
        var baseMs = isIrl ? Number(SAEIV_FORCE_STATE_REFRESH_INTERVAL_IRL_MS) : Number(SAEIV_FORCE_STATE_REFRESH_INTERVAL_MS);
        var refreshMs = Math.max(180, Number(baseMs) || 1000);
        if (!Number.isFinite(refreshMs) || refreshMs <= 0) return;
        saeivForcedStateRefreshTimer = setInterval(function () {
          syncSaeivExternalState(true);
        }, refreshMs);
      }
      if (el.telemetryErrorOverlay) {
        el.telemetryErrorOverlay.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
        });
      }
      var gameContextBlockModalEl = document.getElementById("gameContextBlockModal");
      if (gameContextBlockModalEl) {
        ["click", "pointerdown", "pointerup", "mousedown", "mouseup", "contextmenu"].forEach(function (eventName) {
          gameContextBlockModalEl.addEventListener(eventName, function (event) {
            event.preventDefault();
            event.stopPropagation();
          });
        });
      }
      window.addEventListener("keydown", function (event) {
        if (PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) return;
        if (isRecordingShortcut) return;
        if (!shortcutMatchesBrowserEvent(OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST, event)) return;
        var handled = triggerPlayerListHoldDown("browser");
        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      window.addEventListener("keyup", function (event) {
        if (PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) return;
        if (!shortcutMatchesBrowserEvent(OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST, event)) return;
        if (triggerPlayerListHoldUp()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      window.addEventListener("blur", function () {
        hidePlayerListHoldPopup();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) hidePlayerListHoldPopup();
      });
      window.addEventListener("keydown", function (event) {
        if (!telemetryConnected && event.key === "Enter") {
          event.preventDefault();
        }
      });

