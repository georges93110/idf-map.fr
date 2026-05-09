/*
 * Game2 runtime chunk: 09-interactions-main-menu.js
 * Bindings manager, menu principal, statut convoi.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function startOverlayInteractionBindings() {
        if (el.overlayManager) {
          setupAllSidesResize(el.overlayManager, "__manager__");
          el.overlayManager.addEventListener("pointerdown", function () {
            bringManagerToFront();
            saveWidgetLayoutState();
          });
        }
        if (el.overlayManagerTitlebar) {
          el.overlayManagerTitlebar.addEventListener("pointerdown", function (event) {
            if (event.button !== 0) return;
            if (event.target && event.target.closest && event.target.closest("button")) return;
            bringManagerToFront();
            activeOverlayDrag = {
              pointerId: event.pointerId,
              mode: "manager-move",
              type: "__manager__",
              startX: event.clientX,
              startY: event.clientY,
              originX: managerState.x,
              originY: managerState.y,
              originWidth: managerState.width,
              originHeight: managerState.height
            };
            setOverlayDragCursor(node);
            setOverlayDragCursor(el.overlayManager);
            try { el.overlayManagerTitlebar.setPointerCapture(event.pointerId); } catch (err) { }
            event.preventDefault();
          });
        }
        function applyPreset1() {
          if (typeof window.disengageOverlayEditMode === "function") {
            window.disengageOverlayEditMode();
          }
          windowsByType = {
            "saeiv_mini": { x: 1091, y: 7.5, width: 270, height: 158, z: 23 },
            "saeiv": { x: 565, y: 20, width: 270, height: 152.29, z: 22 },
            "waze": { x: 1227, y: 336.5, width: 135, height: 292.5, z: 24 }
          };
          managerState = { x: 4.5, y: 2.5, width: OVERLAY_MANAGER_BASE_WIDTH, height: OVERLAY_MANAGER_BASE_HEIGHT, z: 182, visible: true };
          managerScalePercent = clampManagerScalePercent(OVERLAY_MANAGER_SCALE_DEFAULT);
          telemetryOverlayAlphaPercent = clampTelemetryOverlayAlphaPercent(TELEMETRY_OVERLAY_ALPHA_DEFAULT);
          notificationScalePercent = clampNotificationScalePercent(NOTIFICATION_SCALE_DEFAULT);
          globalAudioVolumePercent = clampGlobalAudioVolumePercent(GLOBAL_AUDIO_VOLUME_DEFAULT);
          applySaeivTimeSystem(SAEIV_TIME_SYSTEM_DEFAULT, { syncUi: true, persist: true });
          applyStopAnnouncementSoundsEnabled(true, { syncUi: true });
          applyPassengerValidationSoundsEnabled(false, { syncUi: true, syncState: false });
          applyHideUiWhenManagerHidden(false, { syncUi: true, render: false });
          applyUnknownBusCapacityInputValue(String(SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT), { syncUi: true, syncState: false });
          applyForceListedCapacityForAllBuses(false, { syncUi: true, syncState: false });
          applyShowExperimentalWidgets(false, { syncUi: true, apply: false });
          applyManagerScalePercent(managerScalePercent, { render: false, syncUi: true });
          applyTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent, { syncUi: true });
          applyNotificationScalePercent(notificationScalePercent, { syncUi: true });
          applyGlobalAudioVolumePercent(globalAudioVolumePercent, { syncUi: true });
          syncSaeivExternalState(true);

          ensureWidgetTypeEnabled("saeiv_mini", true);
          ensureWidgetTypeEnabled("waze", true);
          ensureWidgetTypeEnabled("saeiv", false);
          ensureWidgetTypeEnabled("bus_status", true);
          apply();
        }

        var confirmModal = document.getElementById("customConfirmModal");

        if (el.overlayReloadPageBtn) {
          el.overlayReloadPageBtn.addEventListener("click", function (event) {
            event.preventDefault();
            try {
              sessionStorage.setItem(RELOAD_NOTICE_INTENT_KEY, "1");
            } catch (err) { }
            window.location.reload();
          });
        }

        if (el.overlayResetLayoutBtn) {
          el.overlayResetLayoutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (confirmModal) confirmModal.style.display = "flex";
          });
        }

        var modalYes = document.getElementById("modalConfirmYes");
        if (modalYes) {
          modalYes.addEventListener("click", function (event) {
            event.preventDefault();
            try { localStorage.removeItem(WIDGET_LAYOUT_STORAGE_KEY); } catch (e) { }
            if (confirmModal) confirmModal.style.display = "none";

            // Supprimer d'abord tous les widgets du DOM
            if (typeof windowNodeByType !== "undefined" && windowNodeByType) {
              Object.keys(windowNodeByType).forEach(function (type) {
                var node = windowNodeByType[type];
                if (node && node.parentNode) node.parentNode.removeChild(node);
              });
            }

            widgetsById = Object.create(null);
            lanes = { inline: [], tab: [], pip: [] };
            windowsByType = Object.create(null);
            windowNodeByType = Object.create(null);

            managerState = { x: 4.5, y: 2.5, width: OVERLAY_MANAGER_BASE_WIDTH, height: OVERLAY_MANAGER_BASE_HEIGHT, z: 182, visible: true };
            managerScalePercent = clampManagerScalePercent(OVERLAY_MANAGER_SCALE_DEFAULT);
            telemetryOverlayAlphaPercent = clampTelemetryOverlayAlphaPercent(TELEMETRY_OVERLAY_ALPHA_DEFAULT);
            notificationScalePercent = clampNotificationScalePercent(NOTIFICATION_SCALE_DEFAULT);
            globalAudioVolumePercent = clampGlobalAudioVolumePercent(GLOBAL_AUDIO_VOLUME_DEFAULT);
            applySaeivTimeSystem(SAEIV_TIME_SYSTEM_DEFAULT, { syncUi: true, persist: true });
            applyStopAnnouncementSoundsEnabled(true, { syncUi: true });
            applyPassengerValidationSoundsEnabled(false, { syncUi: true, syncState: false });
            applyHideUiWhenManagerHidden(false, { syncUi: true, render: false });
            applyDefaultStartupMode(DEFAULT_STARTUP_MODE_MENU, { syncUi: true });
            applyNotificationSoundsEnabled(true, { syncUi: true });
            applyUnknownBusCapacityInputValue(String(SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT), { syncUi: true, syncState: false });
            applyForceListedCapacityForAllBuses(false, { syncUi: true, syncState: false });
            applyShowExperimentalWidgets(false, { syncUi: true, apply: false });
            applyManagerScalePercent(managerScalePercent, { render: false, syncUi: true });
            applyTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent, { syncUi: true });
            applyNotificationScalePercent(notificationScalePercent, { syncUi: true });
            applyGlobalAudioVolumePercent(globalAudioVolumePercent, { syncUi: true });

            // Reset shortcuts to defaults
            if (typeof resetShortcutForScope === "function") {
              resetShortcutForScope(OVERLAY_SHORTCUT_SCOPE_OVERLAY, true);
              resetShortcutForScope(OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE, true);
              resetShortcutForScope(OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS, true);
              resetShortcutForScope(OVERLAY_SHORTCUT_SCOPE_HIDE_UI, true);
              if (typeof PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED === "undefined" || !PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) {
                resetShortcutForScope(OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST, true);
              }
            }

            syncSaeivExternalState(true);
            showOverlayNotification("Données réinitialisées", 2000);

            apply();
          });
        }

        var modalNo = document.getElementById("modalConfirmNo");
        if (modalNo) {
          modalNo.addEventListener("click", function (event) {
            event.preventDefault();
            if (confirmModal) confirmModal.style.display = "none";
          });
        }

        // Gestionnaires du Menu Principal
        var mainMenuBtn = document.getElementById("overlayMainMenuBtn");
        var mainMenuModal = document.getElementById("mainMenuModal");
        var mainMenuCloseBtn = document.getElementById("mainMenuCloseBtn");

        function toggleManagerScalePreview(show) {
          if (show) document.body.classList.add("is-previewing-manager");
          else document.body.classList.remove("is-previewing-manager");
        }

      var currentTabIndex = 0;
      var tabOrder = ["play", "guide", "status", "settings"];

      function setupBrowserZoomGuard() {
        if (window.__idfZoomGuardBound) return;
        window.__idfZoomGuardBound = true;

        // Block Ctrl/Cmd + wheel/pinch zoom from browser.
        window.addEventListener("wheel", function (event) {
          if (!event) return;
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
          }
        }, { passive: false, capture: true });

        // Block Ctrl/Cmd keyboard zoom shortcuts (+, -, 0).
        window.addEventListener("keydown", function (event) {
          if (!event) return;
          if (!(event.ctrlKey || event.metaKey)) return;

          var key = String(event.key || "").toLowerCase();
          var code = String(event.code || "");
          var shouldBlock =
            key === "+" ||
            key === "-" ||
            key === "=" ||
            key === "_" ||
            key === "0" ||
            code === "Equal" ||
            code === "Minus" ||
            code === "Digit0" ||
            code === "NumpadAdd" ||
            code === "NumpadSubtract" ||
            code === "Numpad0";

          if (shouldBlock) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, true);

        // Safari pinch-zoom events.
        ["gesturestart", "gesturechange", "gestureend"].forEach(function (evtName) {
          window.addEventListener(evtName, function (event) {
            event.preventDefault();
          }, { passive: false, capture: true });
        });
      }
      setupBrowserZoomGuard();

      function pauseGuideVideo() {
        var iframe = document.getElementById("guideVideoIframe");
        if (iframe && iframe.contentWindow) {
            try {
              iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            } catch (err) { }
          }
        }

        function pauseMainMenuInfoVideos() {
          document.querySelectorAll("#mainMenuInfoView iframe").forEach(function (iframe) {
            if (!iframe || !iframe.contentWindow) return;
            try {
              iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
            } catch (err) { }
          });
        }

        function closeMainMenuInfoView() {
          var infoView = document.getElementById("mainMenuInfoView");
          var mainMenuBody = document.getElementById("mainMenuBody");
          var indicator = document.getElementById("mainMenuInfoPageIndicator");
          if (!infoView || !mainMenuBody) return;
          mainMenuBody.classList.remove("is-info-view-open");
          infoView.setAttribute("aria-hidden", "true");
          infoView.querySelectorAll(".main-menu-info-page.is-active").forEach(function (page) {
            page.classList.remove("is-active");
          });
          if (indicator) indicator.textContent = "Informations";
          pauseMainMenuInfoVideos();
        }

        function openMainMenuInfoView(targetId) {
          var infoView = document.getElementById("mainMenuInfoView");
          var mainMenuBody = document.getElementById("mainMenuBody");
          var indicator = document.getElementById("mainMenuInfoPageIndicator");
          if (!infoView || !mainMenuBody) return;
          var target = document.getElementById(String(targetId || ""));
          if (!target || !target.classList.contains("main-menu-info-page")) return;
          infoView.querySelectorAll(".main-menu-info-page").forEach(function (page) {
            page.classList.toggle("is-active", page === target);
          });
          var pageTitle = target.getAttribute("data-info-title") || "";
          if (!pageTitle) {
            var h4 = target.querySelector("h4");
            pageTitle = h4 ? String(h4.textContent || "").trim() : "Informations";
          }
          if (indicator) indicator.textContent = pageTitle;
          mainMenuBody.classList.add("is-info-view-open");
          infoView.setAttribute("aria-hidden", "false");
        }

        function switchMainMenuTab(tabName) {
          var tabs = document.querySelectorAll(".main-menu-tab");
          var panels = document.querySelectorAll(".main-menu-tab-panel");

          tabs.forEach(function (t) {
            t.classList.toggle("is-active", t.getAttribute("data-tab") === tabName);
          });

          panels.forEach(function (p) {
            var isActive = p.id === "mainMenuTab_" + tabName;
            p.classList.toggle("is-active", isActive);
          });

          if (tabName === "status") {
            startConvoyStatusPolling();
          } else {
            stopConvoyStatusPolling();
          }

          // Gestion dynamique de l'onglet Jouer si une session est active
          if (tabName === "play") {
            var resumeContainer = document.getElementById("resumeSessionContainer");
            if (resumeContainer) resumeContainer.style.display = isGameUnlocked ? "flex" : "none";
            refreshModeButtonsUi();
          }

          if (tabName !== "guide") {
            pauseGuideVideo();
          }
          if (tabName !== "play") {
            closeMainMenuInfoView();
          }
        }
        window.switchMainMenuTab = switchMainMenuTab; // Expose to global for other functions

        // Variables de statut (regroupées ici pour éviter tout problème de scope)
        var convoyStatusPollTimer = 0;
        var convoyStatusRequestId = 0;
        var convoyStatusAgeTicker = 0;
        var convoyStatusAgeBaseSeconds = null;
        var convoyStatusAgeBaseAtMs = 0;
        var convoyStatusViewState = "loading";
        var convoyStatusLatest = { online: false, players: 0, ageSeconds: null };
        var CONVOY_STATUS_REFRESH_MS = 5000;

        function fetchConvoyStatus(callback) {
          var url = "https://panel.idf-map.fr/idfmap/stats/statsDedicatedServer.php";
          var done = false;
          var safeCallback = function (data) {
            if (done) return;
            done = true;
            callback(data);
          };

          // Watchdog ultra-court (5s) pour forcer le basculement en erreur
          setTimeout(function () { safeCallback(null); }, 5000);

          try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.timeout = 4500;

            xhr.onreadystatechange = function () {
              if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                  try {
                    var data = JSON.parse(xhr.responseText);
                    if (data && typeof data === "object" && "online" in data && (!data.error)) {
                      safeCallback(data);
                    } else {
                      safeCallback(null);
                    }
                  } catch (e) {
                    safeCallback(null);
                  }
                } else {
                  safeCallback(null);
                }
              }
            };

            xhr.ontimeout = function () { safeCallback(null); };
            xhr.onerror = function () { safeCallback(null); };
            xhr.send();
          } catch (e) {
            safeCallback(null);
          }
        }

        function formatConvoyAgeDuration(ageSeconds) {
          var totalSeconds = Math.max(0, Math.floor(ageSeconds));
          var hours = Math.floor(totalSeconds / 3600);
          var minutes = Math.floor((totalSeconds % 3600) / 60);
          var seconds = totalSeconds % 60;
          var res = "";
          if (hours > 0) res += hours + "h ";
          if (minutes > 0 || hours > 0) res += minutes + "m ";
          res += seconds + "s";
          return res;
        }
        function normalizeConvoyStatusPayload(payload) {
          if (!payload || typeof payload !== "object") return null;
          var players = Number(payload.players);
          var ageSeconds = Number(payload.ageSeconds);
          if (!Number.isFinite(ageSeconds)) ageSeconds = Number(payload.age);
          return {
            online: !!payload.online,
            players: Number.isFinite(players) ? Math.max(0, Math.floor(players)) : 0,
            ageSeconds: Number.isFinite(ageSeconds) ? Math.max(0, Math.floor(ageSeconds)) : 0
          };
        }
        function readConvoyStatusFromRemoteServerWs() {
          var hasWsState = !!remoteServerWs || remoteServerWsLastPongAtMs > 0;
          if (!hasWsState) return null;
          var players = Number(remoteServerWsPlayersCount);
          if (!Number.isFinite(players)) {
            players = Array.isArray(remoteServerWsPlayerList) ? remoteServerWsPlayerList.length : 0;
          }
          var ageSeconds = remoteServerWsLastPongAtMs > 0
            ? Math.max(0, Math.floor((Date.now() - remoteServerWsLastPongAtMs) / 1000))
            : 0;
          return {
            online: typeof isRemoteServerWsOnline === "function" ? isRemoteServerWsOnline() : !!(remoteServerWs && remoteServerWs.online),
            players: players,
            ageSeconds: ageSeconds
          };
        }
        function applyConvoyStatusPayload(payload) {
          var normalized = normalizeConvoyStatusPayload(payload);
          if (!normalized) return false;
          convoyStatusLatest = normalized;
          convoyStatusAgeBaseSeconds = convoyStatusLatest.ageSeconds;
          convoyStatusAgeBaseAtMs = Date.now();
          convoyStatusViewState = "ready";
          setConvoyStatusVisualState("ready");
          renderConvoyStatusAge();
          renderRemoteServerWsUi();
          return true;
        }
        function syncConvoyStatusFromRemotePanelWs() {
          var panel = document.getElementById("mainMenuTab_status");
          var isStatusVisible = !!(panel && panel.classList.contains("is-active"));
          if (!isStatusVisible && convoyStatusViewState !== "ready") return false;
          var fallback = readConvoyStatusFromRemoteServerWs();
          return fallback ? applyConvoyStatusPayload(fallback) : false;
        }

        function convoyAgeSecondsNow() {
          if (!Number.isFinite(convoyStatusAgeBaseSeconds) || convoyStatusAgeBaseSeconds === null) return null;
          var elapsed = Math.max(0, Math.floor((Date.now() - convoyStatusAgeBaseAtMs) / 1000));
          return Math.max(0, Math.floor(convoyStatusAgeBaseSeconds + elapsed));
        }

        function renderConvoyStatusAge() {
          var elAge = document.getElementById("homeConvoyStatusAge");
          if (!elAge) return;
          if (convoyStatusViewState === "error") {
            elAge.hidden = false;
            elAge.classList.add("is-error");
            elAge.textContent = "Erreur";
            return;
          }
          elAge.classList.remove("is-error");
          var ageNow = convoyAgeSecondsNow();
          if (ageNow === null) {
            elAge.textContent = "";
            return;
          }
          elAge.textContent = "Mis à jour il y a " + formatConvoyAgeDuration(ageNow);
        }

        function setConvoyStatusVisualState(state) {
          convoyStatusViewState = state;
          var elImg = document.getElementById("homeConvoyStatusImage");
          var elLoading = document.getElementById("homeConvoyStatusLoading");
          var elSummary = document.getElementById("homeConvoyStatusSummary");
          var elError = document.getElementById("homeConvoyStatusError");

          if (elImg) {
            elImg.style.display = (state === "ready") ? "block" : "none";
            elImg.style.opacity = (state === "ready") ? "1" : "0";
            if (state !== "ready") elImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          }

          if (elLoading) elLoading.style.display = (state === "loading") ? "flex" : "none";
          if (elError) elError.style.display = (state === "error") ? "flex" : "none";
          if (elSummary) elSummary.style.display = (state === "ready") ? "flex" : "none";

          if (state === "ready" && elSummary) {
            var isOnline = convoyStatusLatest.online;
            var players = convoyStatusLatest.players;
            if (elSummary) elSummary.innerHTML = "";
            if (elImg) {
              var playersCount = Number.isFinite(players) ? Math.max(0, Math.floor(players)) : 0;
              var imageName = "HS.png";
              if (isOnline) {
                if (playersCount >= 16) imageName = "16etplus.png";
                else imageName = playersCount + ".png";
              }
              elImg.src = "../ressources/" + imageName;
            }
          }
        }

        function refreshConvoyStatus() {
          if (convoyStatusViewState !== "ready") setConvoyStatusVisualState("loading");
          var requestId = ++convoyStatusRequestId;

          fetchConvoyStatus(function (payload) {
            if (requestId !== convoyStatusRequestId) return;

            if (!payload) {
              if (!syncConvoyStatusFromRemotePanelWs()) {
                setConvoyStatusVisualState("error");
                renderConvoyStatusAge();
              }
              return;
            }

            applyConvoyStatusPayload(payload);
          });
        }

        function startConvoyStatusPolling() {
          if (convoyStatusPollTimer) return;
          if (typeof startRemotePanelWsBridge === "function") startRemotePanelWsBridge();
          refreshConvoyStatus();
          convoyStatusPollTimer = window.setInterval(refreshConvoyStatus, CONVOY_STATUS_REFRESH_MS);
          if (!convoyStatusAgeTicker) {
            convoyStatusAgeTicker = window.setInterval(renderConvoyStatusAge, 1000);
          }
        }

        function stopConvoyStatusPolling() {
          if (convoyStatusPollTimer) {
            window.clearInterval(convoyStatusPollTimer);
            convoyStatusPollTimer = 0;
          }
          if (convoyStatusAgeTicker) {
            window.clearInterval(convoyStatusAgeTicker);
            convoyStatusAgeTicker = 0;
          }
        }
        function normalizeRemoteServerWsUrl(raw) {
          var url = String(raw || "").trim();
          if (!url) return "";
          if (/^wss?:\/\//i.test(url)) return url.replace(/\/+$/, "");
          if (/^https:\/\//i.test(url)) return url.replace(/^https:\/\//i, "wss://").replace(/\/+$/, "");
          if (/^http:\/\//i.test(url)) return url.replace(/^http:\/\//i, "ws://").replace(/\/+$/, "");
          return "";
        }
        function shortenRemoteServerText(value, maxLen) {
          var text = String(value == null ? "" : value);
          var limit = Math.max(40, Math.round(Number(maxLen) || 240));
          if (text.length <= limit) return text;
          return text.slice(0, Math.max(0, limit - 1)) + "…";
        }
        function getRemoteServerWsUrl() {
          return normalizeRemoteServerWsUrl(REMOTE_SERVER_WS_DEFAULT_URL);
        }
        function isRemoteServerWsOnline() {
          var socket = remoteServerWs && remoteServerWs.socket;
          return !!remoteServerWs &&
            remoteServerWs.online === true &&
            (!socket || socket.readyState === WebSocket.OPEN) &&
            remoteServerWsLastPongAtMs > 0 &&
            (Date.now() - remoteServerWsLastPongAtMs) <= REMOTE_SERVER_WS_ONLINE_WINDOW_MS;
        }
        function hasRemoteServerWsSession() {
          return !!remoteServerWs;
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
        function describeRemoteServerWsReadyState() {
          if (!remoteServerWs) return "STOPPED";
          if (isRemoteServerWsOnline()) return "ONLINE";
          if (remoteServerWs.socket && remoteServerWs.socket.readyState === WebSocket.CONNECTING) return "CONNECTING";
          if (remoteServerWsRequestInFlight) return "POLLING";
          return "WAITING";
        }
        function formatRemoteServerWsError(err, url, statusCode, statusText) {
          var parts = ["Erreur heartbeat HTTP"];
          var targetUrl = String(url || "").trim();
          if (targetUrl) parts.push("url=" + targetUrl);
          parts.push("state=" + describeRemoteServerWsReadyState());
          if (Number.isFinite(Number(statusCode))) {
            var code = Math.floor(Number(statusCode));
            var label = String(statusText || "").trim();
            parts.push("http=" + code + (label ? " " + label : ""));
          }
          var message = String(err && (err.message || err.reason || err.error && err.error.message) || err || "").trim();
          if (message) parts.push("message=" + message);
          return parts.join(" | ");
        }
        function formatRemoteServerWsClose(reason) {
          var parts = ["WebSocket panel arr\u00eat\u00e9"];
          var text = String(reason || "").trim();
          if (text) parts.push("reason=" + text);
          return parts.join(" | ");
        }
        function formatRemoteServerTimestamp(ts) {
          var ms = Number(ts);
          if (!Number.isFinite(ms) || ms <= 0) return "-";
          try {
            return new Date(ms).toLocaleTimeString("fr-FR");
          } catch (err) {
            return "-";
          }
        }
        function pushRemoteServerWsLog(kind, text) {
          var entry = {
            kind: String(kind || "info"),
            text: shortenRemoteServerText(String(text || "").trim() || "-", 320),
            at: Date.now()
          };
          remoteServerWsLogEntries.push(entry);
          if (remoteServerWsLogEntries.length > REMOTE_SERVER_WS_LOG_LIMIT) {
            remoteServerWsLogEntries.splice(0, remoteServerWsLogEntries.length - REMOTE_SERVER_WS_LOG_LIMIT);
          }
          renderRemoteServerWsUi();
        }
        function stopRemoteServerWsPing() {
          if (remoteServerWsPingTimer) {
            clearInterval(remoteServerWsPingTimer);
            remoteServerWsPingTimer = 0;
          }
          remoteServerWsRequestInFlight = false;
          if (remoteServerWsRequestController) {
            try { remoteServerWsRequestController.abort(); } catch (err0) { }
            remoteServerWsRequestController = null;
          }
        }
        function sendRemoteServerHeartbeat() {
          if (!remoteServerWs || remoteServerWsRequestInFlight) return;
          var url = getRemoteServerWsUrl();
          if (!url) {
            remoteServerWsLastEventText = "Adresse WebSocket invalide.";
            renderRemoteServerWsUi();
            return;
          }

          remoteServerWsRequestInFlight = true;
          var controller = null;
          try {
            controller = typeof AbortController === "function" ? new AbortController() : null;
          } catch (err1) {
            controller = null;
          }
          remoteServerWsRequestController = controller;

          var timeoutId = window.setTimeout(function () {
            if (controller) {
              try { controller.abort(); } catch (err2) { }
            }
          }, REMOTE_SERVER_WS_REQUEST_TIMEOUT_MS);

          fetch(url + "/ping", {
            method: "POST",
            cache: "no-store",
            headers: { "Accept": "application/json" },
            signal: controller ? controller.signal : undefined
          }).then(function (response) {
            return response.text().then(function (bodyText) {
              return {
                response: response,
                bodyText: String(bodyText || "")
              };
            });
          }).then(function (payload) {
            if (!remoteServerWs) return;
            var response = payload.response;
            var bodyText = payload.bodyText;
            var parsed = null;
            if (bodyText) {
              try { parsed = JSON.parse(bodyText); } catch (err3) { parsed = null; }
            }

            remoteServerWsLastMessageAtMs = Date.now();
            remoteServerWsLastMessageText = shortenRemoteServerText(
              bodyText || (parsed ? JSON.stringify(parsed) : ("HTTP " + response.status)),
              600
            );

            if (!response.ok) {
              remoteServerWs.online = false;
              remoteServerWsLastEventText = formatRemoteServerWsError(null, url, response.status, response.statusText);
              if (remoteServerWs.lastFailureText !== remoteServerWsLastEventText) {
                pushRemoteServerWsLog("error", remoteServerWsLastEventText);
              }
              remoteServerWs.lastFailureText = remoteServerWsLastEventText;
              return;
            }

            if (!parsed || parsed.ok !== true) {
              remoteServerWs.online = false;
              remoteServerWsLastEventText = "Heartbeat refus\u00e9 ou r\u00e9ponse invalide.";
              if (remoteServerWs.lastFailureText !== remoteServerWsLastEventText) {
                pushRemoteServerWsLog("error", remoteServerWsLastEventText);
              }
              remoteServerWs.lastFailureText = remoteServerWsLastEventText;
              return;
            }

            remoteServerWsLastPongAtMs = Date.now();
            var playersCount = extractRemoteServerPlayersCount(parsed);
            if (playersCount !== null) remoteServerWsPlayersCount = playersCount;
            var playersList = extractRemoteServerPlayerList(parsed);
            if (playersList.length || playersCount === 0) remoteServerWsPlayerList = playersList;
            if (typeof playerListShortcutHoldActive !== "undefined" && playerListShortcutHoldActive && typeof renderPlayerListHoldPopup === "function") {
              renderPlayerListHoldPopup();
            }

            var becameOnline = !remoteServerWs.online;
            remoteServerWs.online = true;
            remoteServerWs.lastFailureText = "";
            remoteServerWsLastEventText = "Heartbeat OK";
            if (becameOnline) {
              pushRemoteServerWsLog("open", "Serveur joignable via " + url);
            }
          }).catch(function (err) {
            if (!remoteServerWs) return;
            var isAbort = !!(err && (err.name === "AbortError" || /abort/i.test(String(err.message || ""))));
            if (isAbort && !remoteServerWsRequestController) return;
            remoteServerWs.online = false;
            remoteServerWsLastEventText = formatRemoteServerWsError(err, url);
            if (remoteServerWs.lastFailureText !== remoteServerWsLastEventText) {
              pushRemoteServerWsLog("error", remoteServerWsLastEventText);
            }
            remoteServerWs.lastFailureText = remoteServerWsLastEventText;
          }).finally(function () {
            clearTimeout(timeoutId);
            remoteServerWsRequestInFlight = false;
            remoteServerWsRequestController = null;
            renderRemoteServerWsUi();
          });
        }
        function startRemoteServerWsPing() {
          stopRemoteServerWsPing();
          remoteServerWsPingTimer = setInterval(sendRemoteServerHeartbeat, REMOTE_SERVER_WS_PING_INTERVAL_MS);
          sendRemoteServerHeartbeat();
        }
        function closeRemoteServerWs(options) {
          var opts = options && typeof options === "object" ? options : {};
          remoteServerWsManualClose = opts.manual === true;
          stopRemoteServerWsPing();
          if (!remoteServerWs) {
            renderRemoteServerWsUi();
            return;
          }
          var socket = remoteServerWs.socket;
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
          renderRemoteServerWsUi();
        }
        function renderRemoteServerWsUi() {
          var state = "offline";
          if (hasRemoteServerWsSession()) {
            if (isRemoteServerWsOnline()) state = "online";
            else if (remoteServerWsLastPongAtMs > 0) state = "offline";
            else state = "connecting";
          }
          if (el.remoteServerWsBadge) {
            el.remoteServerWsBadge.classList.remove("is-online", "is-offline", "is-connecting");
            el.remoteServerWsBadge.classList.add(state === "online" ? "is-online" : (state === "connecting" ? "is-connecting" : "is-offline"));
            el.remoteServerWsBadge.textContent =
              state === "online" ? "Connect\u00e9" :
                (state === "connecting" ? "Connexion..." : "D\u00e9connect\u00e9");
          }
          if (el.remoteServerWsState) {
            if (!hasRemoteServerWsSession()) {
              el.remoteServerWsState.textContent = remoteServerWsLastEventText || "Aucune connexion active.";
            } else if (state === "online") {
              el.remoteServerWsState.textContent = "Serveur joignable. WebSocket panel actif.";
            } else if (remoteServerWsLastPongAtMs > 0) {
              el.remoteServerWsState.textContent = remoteServerWsLastEventText || "Connexion perdue, nouvelle tentative...";
            } else {
              el.remoteServerWsState.textContent = remoteServerWsLastEventText || "Connexion WebSocket au serveur en cours...";
            }
          }
          if (el.remoteServerWsConnectBtn) {
            el.remoteServerWsConnectBtn.disabled = hasRemoteServerWsSession();
            el.remoteServerWsConnectBtn.hidden = hasRemoteServerWsSession();
          }
          if (el.remoteServerWsDisconnectBtn) {
            el.remoteServerWsDisconnectBtn.disabled = !hasRemoteServerWsSession();
            el.remoteServerWsDisconnectBtn.hidden = !hasRemoteServerWsSession();
          }
          if (el.remoteServerWsPlayers) {
            var playersNow = Number.isFinite(Number(remoteServerWsPlayersCount))
              ? Math.max(0, Math.floor(Number(remoteServerWsPlayersCount)))
              : (convoyStatusLatest && convoyStatusLatest.online ? Math.max(0, Math.floor(Number(convoyStatusLatest.players) || 0)) : null);
            el.remoteServerWsPlayers.textContent = playersNow === null ? "-" : String(playersNow);
          }
          if (el.remoteServerWsLastEvent) {
            el.remoteServerWsLastEvent.textContent = remoteServerWsLastEventText || "-";
          }
          if (el.remoteServerWsLastMessageAt) {
            el.remoteServerWsLastMessageAt.textContent = formatRemoteServerTimestamp(remoteServerWsLastMessageAtMs);
          }
          if (el.remoteServerWsLastMessage) {
            el.remoteServerWsLastMessage.textContent = remoteServerWsLastMessageText || "Aucune r\u00e9ponse re\u00e7ue.";
          }
          if (el.remoteServerWsLog) {
            el.remoteServerWsLog.innerHTML = "";
            if (!remoteServerWsLogEntries.length) {
              var empty = document.createElement("div");
              empty.className = "gm-server-log-entry";
              empty.textContent = "Aucun \u00e9v\u00e9nement.";
              el.remoteServerWsLog.appendChild(empty);
            } else {
              remoteServerWsLogEntries.slice().reverse().forEach(function (entry) {
                var row = document.createElement("div");
                row.className = "gm-server-log-entry" +
                  (entry.kind === "error" ? " is-error" : (entry.kind === "open" ? " is-open" : (entry.kind === "message" ? " is-message" : "")));
                row.textContent = "[" + formatRemoteServerTimestamp(entry.at) + "] " + entry.text;
                el.remoteServerWsLog.appendChild(row);
              });
            }
          }
        }
        function connectRemoteServerWs() {
          var url = getRemoteServerWsUrl();
          if (!url) {
            remoteServerWsLastEventText = "Adresse WebSocket invalide.";
            pushRemoteServerWsLog("error", remoteServerWsLastEventText);
            return;
          }
          closeRemoteServerWs({ manual: false, reason: "Reconnect" });
          remoteServerWsManualClose = false;
          remoteServerWsPlayersCount = null;
          remoteServerWsPlayerList = [];
          remoteServerWsLastPongAtMs = 0;
          remoteServerWsLastMessageAtMs = 0;
          remoteServerWsLastMessageText = "";
          remoteServerWsLastEventText = "Connexion WebSocket au serveur en cours...";
          pushRemoteServerWsLog("info", "Connexion WebSocket sur " + url);
          renderRemoteServerWsUi();
          if (typeof startRemotePanelWsBridge === "function") {
            startRemotePanelWsBridge();
          }
        }
        function disconnectRemoteServerWs() {
          remoteServerWsLastEventText = formatRemoteServerWsClose("User disconnect");
          pushRemoteServerWsLog("info", remoteServerWsLastEventText);
          if (typeof stopRemotePanelWsBridge === "function") {
            stopRemotePanelWsBridge();
          } else {
            closeRemoteServerWs({ manual: true, reason: "User disconnect" });
          }
          renderRemoteServerWsUi();
        }
        function syncServerSectionSystemName() {
          var resolved = "";
          try {
            if (typeof readSystemName === "function") resolved = String(readSystemName() || "").trim();
          } catch (err0) { resolved = ""; }
          if (!resolved) {
            try { resolved = String(systemName || "").trim(); } catch (err1) { resolved = ""; }
          }
          document.querySelectorAll(".system-name-display").forEach(function (node) {
            node.textContent = resolved || "IDFRP";
          });
        }

        if (mainMenuBtn && mainMenuModal) {
          mainMenuBtn.addEventListener("click", function (event) {
            event.preventDefault();
            if (mainMenuModal.classList.contains("is-open")) {
              // Si on ferme via le bouton menu, on considère qu'on "revient au jeu/manager"
              mainMenuModal.classList.remove("is-open", "is-forced");
              document.body.classList.remove("is-main-menu-open");
              closeMainMenuInfoView();
              pauseGuideVideo();
              renderStage();
              renderManager();
            } else {
              if (typeof switchMainMenuTab === "function") switchMainMenuTab("play");
              mainMenuModal.classList.add("is-open");
              renderManager();
            }
          });
        }
        if (mainMenuCloseBtn && mainMenuModal) {
          mainMenuCloseBtn.addEventListener("click", function (event) {
            event.preventDefault();
            if (mainMenuModal.classList.contains("is-forced")) return;
            mainMenuModal.classList.remove("is-open");
            closeMainMenuInfoView();
            pauseGuideVideo();
            renderManager();
          });
        }

        var mainMenuPlayBtn = document.getElementById("mainMenuPlayBtn");
        var mainMenuInfoBackBtn = document.getElementById("mainMenuInfoBackBtn");

        function launchGameAction(event, customMsg) {
          if (event) event.preventDefault();

          var loadingScreen = document.getElementById("globalLoadingScreen");
          var loadingSubtext = document.getElementById("globalLoadingSubtext");
          var skipLoading = (telemetryUiMode === 1);

          if (loadingSubtext) {
            var msg = customMsg;
            if (!msg) {
              msg = isGameUnlocked ? "Changement de mode..." : "Initialisation de la simulation...";
            }
            loadingSubtext.textContent = msg;
          }

          var finalizeLaunch = function () {
            isGameUnlocked = true;
            closeMainMenuInfoView();
            if (mainMenuModal) {
              mainMenuModal.classList.remove("is-forced");
              mainMenuModal.classList.remove("is-open");
            }
            document.body.classList.remove("is-main-menu-open");
            document.body.classList.add("is-game-unlocked");

            if (loadingScreen) {
              loadingScreen.classList.remove("is-active");
              syncGlobalLoadingVisibility();
              document.body.classList.remove("is-loading-blocking-ui");

              var overlayManager = document.getElementById("overlayManager");
              if (overlayManager) {
                overlayManager.style.removeProperty("display");
                overlayManager.style.removeProperty("opacity");
                overlayManager.style.removeProperty("visibility");
                overlayManager.style.removeProperty("pointer-events");
              }
              // On attend la fin de la transition CSS (0.4s) avant d'afficher les widgets
              setTimeout(function () {
                apply();
                if (typeof refreshManagerUi === "function") refreshManagerUi();
              }, 400);
            } else {
              apply();
              if (typeof refreshManagerUi === "function") refreshManagerUi();
            }
          };

          if (loadingScreen && !skipLoading) {
            // Mise à jour de la version au lancement
            var versionEl = document.getElementById("globalLoadingVersionPart");
            if (versionEl && typeof gameVersion !== "undefined") {
              versionEl.textContent = gameVersion;
            }
            loadingScreen.classList.add("is-active");
            syncGlobalLoadingVisibility();
            document.body.classList.add("is-loading-blocking-ui");

            var overlayManager = document.getElementById("overlayManager");
            if (overlayManager) {
              overlayManager.style.setProperty("display", "none", "important");
              overlayManager.style.setProperty("opacity", "0", "important");
              overlayManager.style.setProperty("visibility", "hidden", "important");
              overlayManager.style.setProperty("pointer-events", "none", "important");
            }

            // Fermer le menu immédiatement dès le début du chargement
            if (mainMenuModal) {
              mainMenuModal.classList.remove("is-open");
              document.body.classList.remove("is-main-menu-open");
            }

            // Délai de chargement simulé (+2 secondes demandées)
            setTimeout(finalizeLaunch, 3000);
          } else {
            // Lancement instantané
            finalizeLaunch();
          }
        }

        if (mainMenuPlayBtn) mainMenuPlayBtn.addEventListener("click", launchGameAction);
        document.querySelectorAll(".play-mode-beta-tag[data-role='play-action']").forEach(function (playBtn) {
          playBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            var mode = normalizeGameMode(playBtn.getAttribute("data-mode"));
            if (!mode || !isModeEnabled(mode)) return;

            if (isGameUnlocked && mode === currentGameMode) {
              return;
            }

            if (mode !== currentGameMode) {
              setGameMode(mode, { apply: false });
            }
            launchGameAction(event);
          });
        });

        document.querySelectorAll(".play-mode-info-btn[data-info-target]").forEach(function (infoBtn) {
          infoBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var targetId = infoBtn.getAttribute("data-info-target");
            if (!targetId) return;
            openMainMenuInfoView(targetId);
          });
        });

        if (mainMenuInfoBackBtn) {
          mainMenuInfoBackBtn.addEventListener("click", function (event) {
            event.preventDefault();
            closeMainMenuInfoView();
          });
        }

        var resumeSessionBtn = document.getElementById("resumeSessionBtn");
        if (resumeSessionBtn) {
          resumeSessionBtn.addEventListener("click", function (event) {
            event.preventDefault();
            if (mainMenuModal) {
              mainMenuModal.classList.remove("is-forced", "is-open");
              document.body.classList.remove("is-main-menu-open");
              renderStage();
              renderManager();
            }
          });
        }

        // Fermer si clic sur le fond flou (uniquement si non forcé)
        if (mainMenuModal) {
          mainMenuModal.addEventListener("click", function (event) {
            if (mainMenuModal.classList.contains("is-forced")) return;
            if (event.target === mainMenuModal) {
              mainMenuModal.classList.remove("is-open");
              closeMainMenuInfoView();
              pauseGuideVideo();
              renderStage();
              renderManager();
              if (typeof refreshManagerUi === "function") refreshManagerUi();
            }
          });
        }

        // Gestion des onglets du Menu Principal
        var mainMenuTabs = document.querySelectorAll(".main-menu-tab");
        if (mainMenuTabs && mainMenuTabs.length > 0) {
          mainMenuTabs.forEach(function (tabBtn) {
            tabBtn.addEventListener("click", function (event) {
              event.preventDefault();
              var tabName = tabBtn.getAttribute("data-tab");
              if (!tabName) return;

              mainMenuTabs.forEach(function (btn) { btn.classList.remove("is-active"); });
              tabBtn.classList.add("is-active");

              var allPanels = document.querySelectorAll(".main-menu-tab-panel");
              allPanels.forEach(function (panel) { panel.classList.remove("is-active"); });
              var targetPanel = document.getElementById("mainMenuTab_" + tabName);
              if (targetPanel) targetPanel.classList.add("is-active");

              // Trigger the specific logic for the tab (e.g. status polling)
              switchMainMenuTab(tabName);
            });
          });
        }
        syncServerSectionSystemName();
        renderRemoteServerWsUi();
        if (el.remoteServerWsConnectBtn) {
          el.remoteServerWsConnectBtn.addEventListener("click", function (event) {
            event.preventDefault();
            connectRemoteServerWs();
          });
        }
        if (el.remoteServerWsDisconnectBtn) {
          el.remoteServerWsDisconnectBtn.addEventListener("click", function (event) {
            event.preventDefault();
            disconnectRemoteServerWs();
          });
        }
        window.addEventListener("pagehide", function () {
          closeRemoteServerWs({ manual: true, reason: "Page hide" });
        });
        window.addEventListener("beforeunload", function () {
          closeRemoteServerWs({ manual: true, reason: "Unload" });
        });

        var settingsBtn = document.getElementById("overlayToggleSettingsBtn");
        var settingsBox = document.getElementById("overlaySettingsBox");
        var modeSettingsBtn = document.getElementById("overlayToggleModeSettingsBtn");
        var modeSettingsBox = document.getElementById("overlayModeSettingsBox");
        function toggleExclusiveManagerBox(targetBtn, targetBox, otherBtn, otherBox) {
          if (!targetBtn || !targetBox) return;
          var isHidden = targetBox.style.display === "none" || targetBox.style.display === "";
          if (isHidden) {
            targetBox.style.display = "block";
            targetBtn.classList.add("is-selected");
            if (otherBox) otherBox.style.display = "none";
            if (otherBtn) otherBtn.classList.remove("is-selected");
          } else {
            targetBox.style.display = "none";
            targetBtn.classList.remove("is-selected");
          }
        }
        if (settingsBtn) {
          settingsBtn.addEventListener("click", function (event) {
            event.preventDefault();
            if (typeof switchMainMenuTab === "function" && mainMenuModal) {
              switchMainMenuTab("settings");
              mainMenuModal.classList.add("is-open");
              renderManager();
            }
          });
        }
        if (modeSettingsBtn) {
          modeSettingsBtn.addEventListener("click", function (event) {
            event.preventDefault();
            if (typeof switchMainMenuTab === "function" && mainMenuModal) {
              switchMainMenuTab("settings");
              mainMenuModal.classList.add("is-open");
              renderManager();
            }
          });
        }

        var shortcutBtn = document.getElementById("overlayShortcutBtn");
        var destinationShortcutBtn = document.getElementById("overlayDestinationShortcutBtn");
        var playerListShortcutBtn = document.getElementById("overlayPlayerListShortcutBtn");
        if (typeof PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED !== "undefined" && PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED) {
          document.querySelectorAll('[data-temporary-disabled="player-list-tab"]').forEach(function (row) {
            row.hidden = true;
            row.setAttribute("aria-hidden", "true");
            row.style.setProperty("display", "none", "important");
            row.querySelectorAll("button").forEach(function (button) {
              button.disabled = true;
              button.setAttribute("aria-disabled", "true");
              button.setAttribute("tabindex", "-1");
            });
          });
        }
        if (shortcutBtn) {
          shortcutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (isRecordingShortcut && normalizeOverlayShortcutScope(recordingShortcutScope) === OVERLAY_SHORTCUT_SCOPE_OVERLAY) {
              stopShortcutRecording();
            } else {
              if (isRecordingShortcut) stopShortcutRecording();
              startShortcutRecording(OVERLAY_SHORTCUT_SCOPE_OVERLAY);
            }
          });
        }
        var zoomGpsShortcutBtn = document.getElementById("overlayZoomGpsShortcutBtn");
        if (zoomGpsShortcutBtn) {
          zoomGpsShortcutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (
              isRecordingShortcut &&
              normalizeOverlayShortcutScope(recordingShortcutScope) === OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS
            ) {
              stopShortcutRecording();
            } else {
              if (isRecordingShortcut) stopShortcutRecording();
              startShortcutRecording(OVERLAY_SHORTCUT_SCOPE_ZOOM_GPS);
            }
          });
        }
        if (destinationShortcutBtn) {
          destinationShortcutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (
              isRecordingShortcut &&
              normalizeOverlayShortcutScope(recordingShortcutScope) === OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE
            ) {
              stopShortcutRecording();
            } else {
              if (isRecordingShortcut) stopShortcutRecording();
              startShortcutRecording(OVERLAY_SHORTCUT_SCOPE_DESTINATION_ANNOUNCE);
            }
          });
        }
        var hideUiShortcutBtn = document.getElementById("overlayHideUiShortcutBtn");
        if (hideUiShortcutBtn) {
          hideUiShortcutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (
              isRecordingShortcut &&
              normalizeOverlayShortcutScope(recordingShortcutScope) === OVERLAY_SHORTCUT_SCOPE_HIDE_UI
            ) {
              stopShortcutRecording();
            } else {
              if (isRecordingShortcut) stopShortcutRecording();
              startShortcutRecording(OVERLAY_SHORTCUT_SCOPE_HIDE_UI);
            }
          });
        }
        if (
          playerListShortcutBtn &&
          (typeof PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED === "undefined" || !PLAYER_LIST_SHORTCUT_TEMPORARILY_DISABLED)
        ) {
          playerListShortcutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (
              isRecordingShortcut &&
              normalizeOverlayShortcutScope(recordingShortcutScope) === OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST
            ) {
              stopShortcutRecording();
            } else {
              if (isRecordingShortcut) stopShortcutRecording();
              startShortcutRecording(OVERLAY_SHORTCUT_SCOPE_PLAYER_LIST);
            }
          });
        }

        // Navigation horizontale pour les modes de jeu
        var scrollContainer = document.getElementById("playModesContainer");
        var scrollLeftBtn = document.getElementById("scrollModesLeft");
        var scrollRightBtn = document.getElementById("scrollModesRight");

        if (scrollContainer) {
          // --- Drag to scroll ---
          var isDown = false;
          var startX;
          var scrollLeft;
          var dragged = false;

          scrollContainer.addEventListener("mousedown", function (e) {
            isDown = true;
            scrollContainer.style.cursor = "grabbing";
            scrollContainer.classList.add("is-dragging");
            startX = e.pageX - scrollContainer.offsetLeft;
            scrollLeft = scrollContainer.scrollLeft;
            dragged = false;
            scrollContainer.style.scrollBehavior = "auto";
          });

          scrollContainer.addEventListener("mouseleave", function () {
            isDown = false;
            scrollContainer.style.cursor = "grab";
            scrollContainer.classList.remove("is-dragging");
            scrollContainer.style.scrollBehavior = "smooth";
          });

          scrollContainer.addEventListener("mouseup", function () {
            isDown = false;
            scrollContainer.style.cursor = "grab";
            scrollContainer.classList.remove("is-dragging");
            scrollContainer.style.scrollBehavior = "smooth";
          });

          window.addEventListener("mouseup", function () {
            isDown = false;
            scrollContainer.style.cursor = "grab";
            scrollContainer.classList.remove("is-dragging");
            scrollContainer.style.scrollBehavior = "smooth";
          });

          scrollContainer.addEventListener("mousemove", function (e) {
            if (!isDown) return;
            e.preventDefault();
            var x = e.pageX - scrollContainer.offsetLeft;
            var walk = (x - startX) * 1.5;
            if (Math.abs(walk) > 5) {
              dragged = true;
            }
            scrollContainer.scrollLeft = scrollLeft - walk;
          });

          // Empêcher le clic si on a draggé
          scrollContainer.addEventListener("click", function (e) {
            if (dragged) {
              e.preventDefault();
              e.stopPropagation();
            }
          }, true);

          // Défilement à la molette
          scrollContainer.addEventListener("wheel", function (event) {
            if (event.deltaY !== 0) {
              event.preventDefault();
              scrollContainer.scrollLeft += event.deltaY;
            }
          }, { passive: false });

          // Flèches de navigation
          if (scrollLeftBtn) {
            scrollLeftBtn.addEventListener("click", function () {
              scrollContainer.scrollLeft -= 400;
            });
          }
          if (scrollRightBtn) {
            scrollRightBtn.addEventListener("click", function () {
              scrollContainer.scrollLeft += 400;
            });
          }

          // Masquer les flèches si non nécessaire
          var updateArrows = function () {
            var canScrollLeft = scrollContainer.scrollLeft > 5;
            var canScrollRight = scrollContainer.scrollLeft < (scrollContainer.scrollWidth - scrollContainer.clientWidth - 5);
            if (scrollLeftBtn) scrollLeftBtn.style.opacity = canScrollLeft ? "1" : "0";
            if (scrollLeftBtn) scrollLeftBtn.style.pointerEvents = canScrollLeft ? "auto" : "none";
            if (scrollRightBtn) scrollRightBtn.style.opacity = canScrollRight ? "1" : "0";
            if (scrollRightBtn) scrollRightBtn.style.pointerEvents = canScrollRight ? "auto" : "none";
          };

          scrollContainer.addEventListener("scroll", updateArrows);
          window.addEventListener("resize", updateArrows);
          // Initial check with a small delay for DOM rendering
          setTimeout(updateArrows, 200);
        }

        document.querySelectorAll(".shortcut-reset-btn").forEach(function (btn) {
          btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var scope = btn.getAttribute("data-scope");
            if (scope) resetShortcutForScope(scope);
          });
        });
        if (el.overlayManagerScale) {
          el.overlayManagerScale.addEventListener("input", function () {
            updateSliderFill(this);
            applyManagerScalePercent(el.overlayManagerScale.value, { render: true, syncUi: true });
            saveWidgetLayoutState();
          });
          el.overlayManagerScale.addEventListener("pointerdown", function () { toggleManagerScalePreview(true); });
          el.overlayManagerScale.addEventListener("pointerup", function () { toggleManagerScalePreview(false); });
          el.overlayManagerScale.addEventListener("pointerleave", function () { toggleManagerScalePreview(false); });
          el.overlayManagerScale.addEventListener("pointercancel", function () { toggleManagerScalePreview(false); });
        }
        if (el.overlayBackdropOpacity) {
          el.overlayBackdropOpacity.addEventListener("input", function () {
            updateSliderFill(this);
            applyTelemetryOverlayAlphaPercent(el.overlayBackdropOpacity.value, { syncUi: true });
            saveWidgetLayoutState();
          });
        }
        if (el.overlayNotificationScale) {
          el.overlayNotificationScale.addEventListener("input", function () {
            updateSliderFill(this);
            applyNotificationScalePercent(el.overlayNotificationScale.value, { syncUi: true });
            saveWidgetLayoutState();
          });
          el.overlayNotificationScale.addEventListener("pointerdown", function () { toggleNotificationScalePreview(true); });
          el.overlayNotificationScale.addEventListener("pointerup", function () { toggleNotificationScalePreview(false); });
          el.overlayNotificationScale.addEventListener("pointerleave", function () { toggleNotificationScalePreview(false); });
          el.overlayNotificationScale.addEventListener("pointercancel", function () { toggleNotificationScalePreview(false); });
        }
        if (el.overlayGlobalAudioVolume) {
          el.overlayGlobalAudioVolume.addEventListener("input", function () {
            updateSliderFill(this);
            applyGlobalAudioVolumePercent(el.overlayGlobalAudioVolume.value, { syncUi: true });
            saveWidgetLayoutState();
          });
        }
        if (el.overlayTimeSystemDisplay && el.overlayTimeSystemMenu) {
          el.overlayTimeSystemDisplay.addEventListener("click", function (event) {
            event.stopPropagation();
            var isHidden = el.overlayTimeSystemMenu.hidden;
            // Close other menus if open
            if (typeof closeOverlayWidgetAddMenu === "function") closeOverlayWidgetAddMenu();
            el.overlayTimeSystemMenu.hidden = !isHidden;
            el.overlayTimeSystemDisplay.setAttribute("aria-expanded", !isHidden);
          });

          el.overlayTimeSystemMenu.querySelectorAll(".manager-widget-menu-item").forEach(function (item) {
            item.addEventListener("click", function (event) {
              event.stopPropagation();
              var val = item.dataset.value;
              var prevTimeSystem = normalizeSaeivTimeSystem(saeivTimeSystem);
              applySaeivTimeSystem(val, { syncUi: true });
              saveWidgetLayoutState();
              syncSaeivExternalState(true);
              var nextTimeSystem = normalizeSaeivTimeSystem(saeivTimeSystem);

              if (nextTimeSystem !== prevTimeSystem) {
                try {
                  sessionStorage.setItem(RELOAD_NOTICE_INTENT_KEY, "1");
                } catch (e) { }
                window.location.reload();
              }

              el.overlayTimeSystemMenu.hidden = true;
              el.overlayTimeSystemDisplay.setAttribute("aria-expanded", "false");
            });
          });

          // Fermer le menu si on clique ailleurs
          window.addEventListener("pointerdown", function (event) {
            if (el.overlayTimeSystemMenu && !el.overlayTimeSystemMenu.hidden) {
              if (!el.overlayTimeSystemWrapper.contains(event.target)) {
                el.overlayTimeSystemMenu.hidden = true;
                el.overlayTimeSystemDisplay.setAttribute("aria-expanded", "false");
              }
            }
          }, true);
        }
        if (el.overlayShowExperimentalWidgets) {
          el.overlayShowExperimentalWidgets.addEventListener("change", function () {
            applyShowExperimentalWidgets(!!el.overlayShowExperimentalWidgets.checked, { syncUi: true });
            refreshManagerUi();
            saveWidgetLayoutState();
          });
        }
        if (el.overlayHideUiWhenManagerHidden) {
          el.overlayHideUiWhenManagerHidden.addEventListener("change", function () {
            applyHideUiWhenManagerHidden(!!el.overlayHideUiWhenManagerHidden.checked, { syncUi: true, render: true });
            saveWidgetLayoutState();
          });
        }

        if (el.overlayDefaultStartupModeDisplay && el.overlayDefaultStartupModeMenu) {
          el.overlayDefaultStartupModeDisplay.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (typeof closeOverlayWidgetAddMenu === "function") {
              closeOverlayWidgetAddMenu();
            }

            if (el.overlayTimeSystemMenu) {
              el.overlayTimeSystemMenu.hidden = true;
            }

            rebuildDefaultStartupModeOptions();

            var willOpen = el.overlayDefaultStartupModeMenu.hidden === true;
            el.overlayDefaultStartupModeMenu.hidden = !willOpen;
            el.overlayDefaultStartupModeDisplay.setAttribute("aria-expanded", String(willOpen));
          });

          window.addEventListener("pointerdown", function (event) {
            if (!el.overlayDefaultStartupModeMenu || el.overlayDefaultStartupModeMenu.hidden) return;

            var wrap = el.overlayDefaultStartupModeDisplay.parentElement;

            if (wrap && !wrap.contains(event.target)) {
              el.overlayDefaultStartupModeMenu.hidden = true;
              el.overlayDefaultStartupModeDisplay.setAttribute("aria-expanded", "false");
            }
          }, true);
        }

        if (el.overlayDefaultStartupMode) {
          el.overlayDefaultStartupMode.addEventListener("change", function () {
            applyDefaultStartupMode(el.overlayDefaultStartupMode.value, { syncUi: true });
            saveWidgetLayoutState();
          });
        }

        if (el.overlayStopAnnouncementSounds) {
          el.overlayStopAnnouncementSounds.addEventListener("change", function () {
            applyStopAnnouncementSoundsEnabled(!!el.overlayStopAnnouncementSounds.checked, { syncUi: true });
            saveWidgetLayoutState();
          });
        }
        if (el.overlayPassengerValidationSounds) {
          el.overlayPassengerValidationSounds.addEventListener("change", function () {
            applyPassengerValidationSoundsEnabled(!!el.overlayPassengerValidationSounds.checked, { syncUi: true, syncState: true });
            saveWidgetLayoutState();
          });
        }
        if (el.overlayNotificationSoundsEnabled) {
          el.overlayNotificationSoundsEnabled.addEventListener("change", function () {
            applyNotificationSoundsEnabled(!!el.overlayNotificationSoundsEnabled.checked, { syncUi: true });
            saveWidgetLayoutState();
          });
        }
        if (el.overlayUnknownBusCapacitySlider) {
          el.overlayUnknownBusCapacitySlider.addEventListener("input", function () {
            var slider = el.overlayUnknownBusCapacitySlider;
            var val = Number(slider.value);
            if (val > SAEIV_BUS_UNLIMITED_THRESHOLD) {
              applyUnknownBusCapacityInputValue(String(SAEIV_BUS_UNLIMITED_THRESHOLD + 1), { syncUi: true, syncState: true });
            } else {
              applyUnknownBusCapacityInputValue(String(val), { syncUi: true, syncState: true });
            }
            saveWidgetLayoutState();
          });
        }
        if (el.overlayForceListedBusCapacity) {
          el.overlayForceListedBusCapacity.addEventListener("change", function () {
            applyForceListedCapacityForAllBuses(!!el.overlayForceListedBusCapacity.checked, { syncUi: true, syncState: true });
            saveWidgetLayoutState();
          });
        }

        var preset1Btn = document.getElementById("overlayPreset1Btn");
        if (preset1Btn) {
          preset1Btn.addEventListener("click", function (event) {
            event.preventDefault();
            applyPreset1();
          });
        }

        var editModeBtn = document.getElementById("overlayToggleEditModeBtn");

        if (editModeBtn) {
          editModeBtn.addEventListener("click", function (event) {
            event.preventDefault();
            toggleOverlayEditMode();
          });
        }

        window.addEventListener("contextmenu", function (event) {
          if (event.target && event.target.closest && event.target.closest("button")) return;

          if (!isOverlayManagerVisibleForLayoutEdit()) {
            window.disengageOverlayEditMode();
            return;
          }

          event.preventDefault();
          toggleOverlayEditMode();
        }, true);

        var widgetAddSelect = el.overlayWidgetAddSelect;
        var widgetAddDisplay = el.overlayWidgetAddDisplay;
        var widgetAddMenu = el.overlayWidgetAddMenu;
        var widgetAddBtn = el.overlayWidgetAddBtn;
        function handleWidgetAdd() {
          var type = normalizeWidgetType(widgetAddSelect && widgetAddSelect.value);
          if (!isType(type)) return;
          ensureWidgetTypeEnabled(type, true);

          var existingState = windowsByType[type];
          var defaults = getOverlayTypeDefaults(type);
          var w = (existingState && existingState.width) ? existingState.width : defaults.width;
          var h = (existingState && existingState.height) ? existingState.height : defaults.height;

          var targetX = scaleUiSize(20);
          var targetY = scaleUiSize(60);
          var gap = scaleUiSize(15);
          var viewportW = window.innerWidth || 1280;
          var viewportH = window.innerHeight || 720;
          var found = false;
          var maxAttempts = 50;
          var attempts = 0;

          while (!found && attempts < maxAttempts) {
            attempts++;
            var collision = false;

            if (typeof managerState !== "undefined") {
              var mx = managerState.x, my = managerState.y, mw = managerState.width, mh = managerState.height;
              if (targetX < mx + mw && targetX + w > mx &&
                targetY < my + mh && targetY + h > my) {
                collision = true;
              }
            }

            var activeTypes = typeof getInlineActiveTypes === "function" ? getInlineActiveTypes() : [];
            var keys = Object.keys(windowsByType);
            for (var k = 0; k < keys.length; k++) {
              var otherType = keys[k];
              if (otherType === type) continue;

              var other = windowsByType[otherType];
              if (!other) continue;
              if (activeTypes.indexOf(otherType) === -1) continue;

              var ox = other.x, oy = other.y, ow = other.width, oh = other.height;
              if (targetX < ox + ow && targetX + w > ox &&
                targetY < oy + oh && targetY + h > oy) {
                collision = true;
                break;
              }
            }

            if (!collision) {
              found = true;
            } else {
              targetX += w + gap;
              if (targetX + w > viewportW - scaleUiSize(20)) {
                targetX = scaleUiSize(20);
                targetY += h + gap + scaleUiSize(40);
              }
            }
          }

          if (!found) {
            targetX = defaults.x;
            targetY = defaults.y;
          }

          windowsByType[type] = {
            x: targetX,
            y: targetY,
            width: w,
            height: h,
            z: bumpOverlayZ()
          };

          if (typeof overlayEditMode !== "undefined" && !overlayEditMode) {
            toggleOverlayEditMode();
          }
          apply();
        }
        if (widgetAddSelect) {
          widgetAddSelect.addEventListener("change", function () {
            syncOverlayWidgetSelectedTypeFromSelect();
            if (widgetAddBtn) widgetAddBtn.disabled = !widgetAddSelect.value;
            refreshOverlayWidgetExperimentalBadge(overlayWidgetSelectedType);
            updateOverlayWidgetAddDisplay();
          });
        }
        if (widgetAddDisplay) {
          widgetAddDisplay.addEventListener("click", function (event) {
            event.preventDefault();
            toggleOverlayWidgetAddMenu();
          });
        }
        window.addEventListener("pointerdown", function (event) {
          if (!overlayWidgetMenuOpen) return;
          var target = event.target;
          if (widgetAddMenu && widgetAddMenu.contains(target)) return;
          if (widgetAddDisplay && widgetAddDisplay.contains(target)) return;
          closeOverlayWidgetAddMenu();
        }, true);
        if (widgetAddBtn) {
          widgetAddBtn.addEventListener("click", function (event) {
            event.preventDefault();
            handleWidgetAdd();
          });
        }

        window.addEventListener("keydown", function (event) {
          if (!telemetryConnected && event.key === "Enter") {
            event.stopImmediatePropagation();
          }
        }, true);

        window.addEventListener("pointermove", function (event) {
          if (!activeOverlayDrag) return;
          if (event.pointerId !== activeOverlayDrag.pointerId) return;
          if (event.pointerType !== "touch" && Number(event.buttons) === 0) {
            activeOverlayDrag = null;
            clearOverlayDragCursor();
            updatePresetSelectionIndicators();
            saveWidgetLayoutState();
            return;
          }
          var dx = event.clientX - activeOverlayDrag.startX;
          var dy = event.clientY - activeOverlayDrag.startY;

          if (activeOverlayDrag.mode === "manager-move") {
            managerState.x = activeOverlayDrag.originX + dx;
            managerState.y = activeOverlayDrag.originY + dy;
            clampOverlayRect(managerState, OVERLAY_MANAGER_MIN_WIDTH, OVERLAY_MANAGER_MIN_HEIGHT);
            renderManager();
            event.preventDefault();
            return;
          }

          if (activeOverlayDrag.mode === "manager-resize") {
            var dir = activeOverlayDrag.dir || "se";

            var anchorX = (dir.indexOf("w") !== -1) ? (activeOverlayDrag.originX + activeOverlayDrag.originWidth) : activeOverlayDrag.originX;
            var anchorY = (dir.indexOf("n") !== -1) ? (activeOverlayDrag.originY + activeOverlayDrag.originHeight) : activeOverlayDrag.originY;

            var reqW = (dir.indexOf("w") !== -1) ? (activeOverlayDrag.originWidth - dx) : (activeOverlayDrag.originWidth + dx);
            var reqH = (dir.indexOf("n") !== -1) ? (activeOverlayDrag.originHeight - dy) : (activeOverlayDrag.originHeight + dy);

            if (dir.indexOf("w") !== -1 || dir.indexOf("e") !== -1) {
              var nextWidth = Math.max(reqW, OVERLAY_MANAGER_MIN_WIDTH);
              managerState.width = nextWidth;
              managerState.x = (dir.indexOf("w") !== -1) ? (anchorX - nextWidth) : anchorX;
            }
            if (dir.indexOf("n") !== -1 || dir.indexOf("s") !== -1) {
              var nextHeight = Math.max(reqH, OVERLAY_MANAGER_MIN_HEIGHT);
              managerState.height = nextHeight;
              managerState.y = (dir.indexOf("n") !== -1) ? (anchorY - nextHeight) : anchorY;
            }

            clampOverlayRect(managerState, OVERLAY_MANAGER_MIN_WIDTH, OVERLAY_MANAGER_MIN_HEIGHT);
            renderManager();
            event.preventDefault();
            return;
          }

          var type = normalizeWidgetType(activeOverlayDrag.type);
          var state = ensureWindowState(type);
          if (!state) return;

          if (activeOverlayDrag.mode === "move") {
            state.x = activeOverlayDrag.originX + dx;
            state.y = activeOverlayDrag.originY + dy;
          } else if (activeOverlayDrag.mode === "resize") {
            var dir = activeOverlayDrag.dir || "se";
            var minW = 120;
            var minH = 80;

            if (isAspectRatioLocked(type)) {
              var ratio = typeAspectRatio(type);

              var anchorX = (dir.indexOf("w") !== -1) ? (activeOverlayDrag.originX + activeOverlayDrag.originWidth) : activeOverlayDrag.originX;
              var anchorY = (dir.indexOf("n") !== -1) ? (activeOverlayDrag.originY + activeOverlayDrag.originHeight) : activeOverlayDrag.originY;

              var reqW = (dir.indexOf("w") !== -1) ? (activeOverlayDrag.originWidth - dx) : (activeOverlayDrag.originWidth + dx);
              var reqH = (dir.indexOf("n") !== -1) ? (activeOverlayDrag.originHeight - dy) : (activeOverlayDrag.originHeight + dy);

              var nextWidth = (dir.indexOf("w") !== -1 || dir.indexOf("e") !== -1) ? reqW : (reqH * ratio);
              if (!Number.isFinite(nextWidth) || nextWidth < minW) {
                nextWidth = minW;
              }
              var nextHeight = nextWidth / ratio;
              if (nextHeight < minH) {
                nextHeight = minH;
                nextWidth = nextHeight * ratio;
              }

              state.x = (dir.indexOf("w") !== -1) ? (anchorX - nextWidth) : anchorX;
              state.y = (dir.indexOf("n") !== -1) ? (anchorY - nextHeight) : anchorY;
              state.width = nextWidth;
              state.height = nextHeight;
            } else {
              var nextX = state.x;
              var nextY = state.y;
              var nextW = state.width;
              var nextH = state.height;

              if (dir.indexOf("w") !== -1) {
                var w = activeOverlayDrag.originWidth - dx;
                if (w >= minW) {
                  nextX = activeOverlayDrag.originX + dx;
                  nextW = w;
                }
              } else if (dir.indexOf("e") !== -1) {
                var w = activeOverlayDrag.originWidth + dx;
                if (w >= minW) {
                  nextW = w;
                }
              }

              if (dir.indexOf("n") !== -1) {
                var h = activeOverlayDrag.originHeight - dy;
                if (h >= minH) {
                  nextY = activeOverlayDrag.originY + dy;
                  nextH = h;
                }
              } else if (dir.indexOf("s") !== -1) {
                var h = activeOverlayDrag.originHeight + dy;
                if (h >= minH) {
                  nextH = h;
                }
              }

              state.x = nextX;
              state.y = nextY;
              state.width = nextW;
              state.height = nextH;
            }
          }
          clampWidgetRect(state, type);
          var node = windowNodeByType[type];
          if (node) applyOverlayWindowStateToNode(node, state);
          updatePresetSelectionIndicators();
          event.preventDefault();
        });

        function endOverlayDrag() {
          if (!activeOverlayDrag) return;
          activeOverlayDrag = null;
          clearOverlayDragCursor();
          updatePresetSelectionIndicators();
          saveWidgetLayoutState();
        }
        window.addEventListener("pointerup", endOverlayDrag);
        window.addEventListener("pointercancel", endOverlayDrag);
        window.addEventListener("mouseup", endOverlayDrag, true);
        window.addEventListener("mouseleave", endOverlayDrag);
        document.addEventListener("visibilitychange", function () {
          if (document.hidden) endOverlayDrag();
        });
        window.addEventListener("blur", endOverlayDrag);
        window.addEventListener("resize", function () {
          normalizeOverlayStateForViewport();
          renderStage();
          renderManager();
          saveWidgetLayoutState();
        });

        // Gestionnaire pour l'aperçu de la vidéo YouTube
        var videoPreview = document.getElementById("videoPreview");
        if (videoPreview) {
          videoPreview.addEventListener("click", function () {
            var wrapper = document.getElementById("guideVideoWrapper");
            if (wrapper) {
              wrapper.innerHTML = '<iframe id="guideVideoIframe" width="100%" height="100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&autoplay=1" title="Guide Vidéo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
            }
          });
        }
      }

