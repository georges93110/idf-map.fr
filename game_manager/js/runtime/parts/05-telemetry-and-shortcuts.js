/*
 * Game2 runtime chunk: 05-telemetry-and-shortcuts.js
 * Telemetrie, WebSocket, raccourcis clavier.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
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
        if (pipWindow && !pipWindow.closed) {
          if (telemetryConnected) clearWindowTelemetryOverlay(pipWindow);
          else ensureWindowTelemetryOverlay(pipWindow, copy);
        }
        Object.keys(tabRefs).forEach(function (id) {
          var ref = tabRefs[id];
          if (!ref || ref.closed) return;
          if (telemetryConnected) clearWindowTelemetryOverlay(ref);
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
      function extractTelemetryPaused(data) {
        var payload = data && typeof data === "object" ? data : null;
        if (!payload) return null;
        var pools = [payload, payload.data, payload.payload];
        for (var i = 0; i < pools.length; i += 1) {
          var src = pools[i];
          if (!src || typeof src !== "object") continue;
          if (Object.prototype.hasOwnProperty.call(src, "paused")) {
            return src.paused === true;
          }
        }
        return null;
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
        gameContextMapBlocked = nextMap !== REQUIRED_GAME_CONTEXT_MAP;
        syncGameContextBlockModal();
        if (mapChanged) {
          reloadPageForGameContextChange();
        }
        return true;
      }
      function refreshTelemetryVisibility() {
        var isNonInteractive = !FORCE_DEV_UI && telemetryUiMode !== 2;
        var wsSilent = lastWsMessageAt === 0 || (Date.now() - lastWsMessageAt) > WS_SILENCE_HIDE_MS;
        var isMenuOpen = document.body.classList.contains("is-main-menu-open");
        var shouldHide = isNonInteractive && (telemetryPaused || wsSilent) && !isMenuOpen;
        if (el.overlayRoot) {
          el.overlayRoot.style.visibility = shouldHide ? "hidden" : "";
        }
      }
      function hardSetTelemetryPausedWidgetsHidden(hidden) {
        document.body.classList.toggle("is-telemetry-paused-widgets", !!hidden);

        document
          .querySelectorAll(".overlay-window[data-widget-type]")
          .forEach(function (widget) {
            if (hidden) {
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
                if (hidden) {
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
      function applyTelemetryPausedState(pausedRaw) {
        var nextPaused = !!pausedRaw;
        telemetryPaused = nextPaused;

        document.body.classList.toggle("is-telemetry-paused", telemetryPaused);

        // En mode 2, les widgets doivent rester visibles même si telemetry est en pause.
        // En mode 1, la pause telemetry les cache.
        var shouldHardHideWidgets = telemetryPaused && telemetryUiMode !== 2;
        hardSetTelemetryPausedWidgetsHidden(shouldHardHideWidgets);

        updateSaeivSimulationPauseState();
        syncWidgetsPauseState();

        // Sécurité après sync/rerender.
        shouldHardHideWidgets = telemetryPaused && telemetryUiMode !== 2;
        hardSetTelemetryPausedWidgetsHidden(shouldHardHideWidgets);
      }
      function startTelemetryVisibilityWatch() {
        if (telemetryVisibilityTimer) return;
        telemetryVisibilityTimer = setInterval(refreshTelemetryVisibility, 500);
      }

      var OVERLAY_SHORTCUT_SCOPE_OVERLAY = "idf_telemetry";
      var OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE = "idf_telemetry_destination_announcement";
      var OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS = "idf_telemetry_zoom_gps";
      var OVERLAY_SHORTCUT_SCOPE_HIDE_UI = "idf_telemetry_hide_ui";
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
      var OVERLAY_TOGGLE_DEFAULT_SHORTCUT = {
        keys: ["Delete"],
        display: "Suppr"
      };
      var overlayShortcutBtn = null;
      var overlayDestinationShortcutBtn = null;
      var overlayZoomGpsShortcutBtn = null;
      var overlayHideUiShortcutBtn = null;
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
        }
      };

      function normalizeOverlayShortcutScope(scope) {
        var safeScope = String(scope || "").trim();
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) return OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) return OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS;
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) return OVERLAY_SHORTCUT_SCOPE_HIDE_UI;
        return OVERLAY_SHORTCUT_SCOPE_OVERLAY;
      }
      function getShortcutScopeLabel(scope) {
        var safeScope = normalizeOverlayShortcutScope(scope);
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) return "Annonce Destination";
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) return "Zoom GPS";
        if (safeScope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) return "Cacher l'UI en jeu";
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
          OVERLAY_SHORTCUT_SCOPE_HIDE_UI
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
        var fallbackText = safeScope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE
          ? shortcutDisplayText(OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT, "T")
          : "[ Aucun ]";
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

        }
        if (isRecordingShortcut) return;
        if (data.action === "current") {
          // Si le serveur n'a pas encore de raccourci pour ce scope, on lui envoie le défaut
          if (!data.shortcut || !data.shortcut.keys || !data.shortcut.keys.length) {
            var defaultConfig = OVERLAY_TOGGLE_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE) defaultConfig = OVERLAY_DESTINATION_ANNOUNCE_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS) defaultConfig = OVERLAY_ZOOM_GPS_DEFAULT_SHORTCUT;
            if (scope === OVERLAY_SHORTCUT_SCOPE_HIDE_UI) defaultConfig = OVERLAY_HIDE_UI_DEFAULT_SHORTCUT;

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
        var zoomDirection = String(direction || "in").trim().toLowerCase() === "out" ? "out" : "in";
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

      /**
       * Gestionnaire des evenements clavier natifs envoyes par le serveur telemetry
       * Permet de reagir a des touches precises (ex: VK_E = 0x45)
       */
      function handleKeyEvent(raw) {
        if (!raw || raw.type !== "keyEvent") return;

        // On ne traite que l'appui initial (down) et on ignore l'auto-repeat du clavier
        if (raw.phase === "down" && !raw.repeat) {
          var vk = Number(raw.vk);
          var keyName = VK_MAP[vk] || "0x" + vk.toString(16).toUpperCase();

          // --- Support des raccourcis via le flux VK ---
          // On vérifie si la touche pressée correspond à l'un de nos raccourcis enregistrés
          var zoomGpsShortcut = getEffectiveShortcutForScope(OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS);
          if (zoomGpsShortcut && zoomGpsShortcut.keys && zoomGpsShortcut.keys.indexOf(keyName) >= 0) {
            triggerGpsZoomFromShortcut(isShiftModifierActive(raw) ? "out" : "in");
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
        if (telemetryUiMode === 2) {
          firstVisitMode1HintEnabled = false;
        }
        if (modeChanged) {
          if (typeof closeMainMenuInfoView === "function") {
            closeMainMenuInfoView();
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
        hardSetTelemetryPausedWidgetsHidden(telemetryPaused && telemetryUiMode !== 2);
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
        applyTelemetryPausedState(telemetryPaused);
        syncGlobalLoadingVisibility();
        var loadingScreen = document.getElementById("globalLoadingScreen");
        var loadingInProgress = !!loadingScreen && loadingScreen.classList.contains("is-active");

        if (loadingInProgress && mainMenuModal) {
          mainMenuModal.classList.remove("is-open", "is-forced");
          document.body.classList.remove("is-main-menu-open");
        }
        return true;
      }
      function handleDefaultStartupMode() {
        var startupMode = normalizeDefaultStartupMode(defaultStartupMode);

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
        }

        document.body.classList.remove("is-main-menu-open");

        if (loadingScreen) {
          loadingScreen.classList.remove("is-active");
          syncGlobalLoadingVisibility();
          document.body.classList.remove("is-loading-blocking-ui");
        }

        apply();

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
      function buildRemotePanelTelemetryPayload(raw, signal) {
        var payload = raw && typeof raw === "object"
          ? raw
          : (signal && typeof signal === "object" ? signal : null);
        if (!payload) return null;
        return {
          source: "game2",
          action: "telemetry",
          time: Date.now(),
          data: payload
        };
      }
      function getRemotePanelWsSocket() {
        return remoteServerWs && remoteServerWs.socket ? remoteServerWs.socket : null;
      }
      function isRemotePanelWsOpen() {
        var socket = getRemotePanelWsSocket();
        return !!socket && socket.readyState === WebSocket.OPEN;
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
        remotePanelTelemetryQueuedPayload = null;
        if (!payload) return;
        remotePanelTelemetryInFlight = true;
        sendRemotePanelWsPayload(payload);
        remotePanelTelemetryInFlight = false;
        if (remotePanelTelemetryQueuedPayload) flushRemotePanelTelemetryQueue();
      }
      function sendTelemetryToRemotePanel(raw, signal) {
        if (!signal || typeof signal !== "object") return;
        if (!getRemotePanelWsUrl()) return;
        remotePanelTelemetryQueuedPayload = buildRemotePanelTelemetryPayload(raw, signal);
        if (!remotePanelTelemetryQueuedPayload) return;
        if (!isRemotePanelWsOpen()) {
          startRemotePanelWsBridge();
          return;
        }
        flushRemotePanelTelemetryQueue();
      }
      function stopRemotePanelWsBridge() {
        if (remoteServerWsPingTimer) {
          clearInterval(remoteServerWsPingTimer);
          remoteServerWsPingTimer = 0;
        }
        if (remoteServerWsReconnectTimer) {
          clearTimeout(remoteServerWsReconnectTimer);
          remoteServerWsReconnectTimer = 0;
        }
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
        remoteServerWsLastPongAtMs = 0;
      }
      function sendRemotePanelWsPing() {
        if (!isRemotePanelWsOpen()) return;
        try {
          getRemotePanelWsSocket().send(JSON.stringify({
            type: "ping",
            time: Date.now()
          }));
          if (remoteServerWs) {
            remoteServerWs.online = true;
            remoteServerWsLastPongAtMs = Date.now();
          }
        } catch (err0) {
          remoteServerWsLastEventText = "Ping WebSocket panel echoue.";
          try { getRemotePanelWsSocket().close(); } catch (err1) { }
        }
      }
      function handleRemotePanelWsMessage(event) {
        if (!remoteServerWs || remoteServerWs.socket !== (event && (event.currentTarget || event.target))) return;
        remoteServerWsLastPongAtMs = Date.now();
        remoteServerWsLastMessageAtMs = Date.now();
        remoteServerWsLastMessageText = String(event && event.data || "");
        if (remoteServerWs) remoteServerWs.online = true;
        if (!event || typeof event.data !== "string" || !event.data) return;
        try {
          var parsed = null;
          try { parsed = JSON.parse(event.data); } catch (err0) { parsed = null; }
          var playersCount = null;
          if (parsed && typeof extractRemoteServerPlayersCount === "function") {
            try { playersCount = extractRemoteServerPlayersCount(parsed); } catch (err1) { playersCount = null; }
          }
          if (playersCount !== null) remoteServerWsPlayersCount = playersCount;
        } catch (err2) { }
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
        if (remoteServerWsPingTimer) {
          clearInterval(remoteServerWsPingTimer);
          remoteServerWsPingTimer = 0;
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
        remoteServerWsLastEventText = "Connexion WebSocket au panel en cours...";
        socket.onopen = function () {
          if (!remoteServerWs || remoteServerWs.socket !== socket) return;
          remoteServerWs.online = true;
          remoteServerWsLastPongAtMs = Date.now();
          remoteServerWsLastEventText = "WebSocket panel connecte.";
          flushRemotePanelTelemetryQueue();
          sendRemotePanelWsPing();
          if (!remoteServerWsPingTimer) {
            remoteServerWsPingTimer = setInterval(sendRemotePanelWsPing, REMOTE_SERVER_WS_PING_INTERVAL_MS);
          }
        };
        socket.onmessage = handleRemotePanelWsMessage;
        socket.onerror = function () {
          if (!remoteServerWs || remoteServerWs.socket !== socket) return;
          remoteServerWs.online = false;
          remoteServerWsLastEventText = "Erreur WebSocket panel.";
          try { socket.close(); } catch (err0) { }
        };
        socket.onclose = function () {
          if (!remoteServerWs || remoteServerWs.socket !== socket) return;
          if (remoteServerWsPingTimer) {
            clearInterval(remoteServerWsPingTimer);
            remoteServerWsPingTimer = 0;
          }
          remoteServerWs.online = false;
          remoteServerWs = null;
          remoteServerWsLastPongAtMs = 0;
          remoteServerWsLastEventText = "WebSocket panel deconnecte, reconnexion...";
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
        setTelemetryConnectionState(false, "Aucun signal telemetrie.");
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
          var nextVehicleName = String(saeivVehicleName || "").trim();
          if (nextVehicleName && nextVehicleName !== previousVehicleName) {
            saeivLastStateKey = "";
            syncSaeivExternalState(true);
          }
          if (!signal) return;
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
        stopRemotePanelWsBridge();
      }
      function startTelemetryConnectionWatch() {
        stopTelemetryConnectionWatch();
        startRemotePanelWsBridge();
        setTelemetryConnectionState(false, "Connexion ouverte, attente signal X/Y/Z/Heading...");
        connectTelemetryWs();
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
            return;
          }
          var age = Date.now() - telemetryLastPacketAt;
          if (age > TELEMETRY_PACKET_TIMEOUT_MS) {
            telemetryValidBurstCount = 0;
            setTelemetryConnectionState(false, "Signal telemetrie perdu (X/Y/Z/Heading).");
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
        if (!telemetryConnected && event.key === "Enter") {
          event.preventDefault();
        }
      });

