/*
 * Game2 runtime chunk: 08-overlay-ui-state.js
 * Etat overlay, persistance layout, rendu fenetres.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function applyWidgetSelectorsFromUi() {
        if (syncingWidgetTypeSelectors) return;
        var changed = false;
        changed = applyWidgetSelectionForGroup(GPS_WIDGET_TYPES, el.widgetGpsSelect && el.widgetGpsSelect.value) || changed;
        changed = applyWidgetSelectionForGroup(HUD_WIDGET_TYPES, el.widgetHudSelect && el.widgetHudSelect.value) || changed;
        if (!changed) {
          refreshWidgetTypeSelectors();
          return;
        }
        if (widgetSelectorApplyTimer) {
          clearTimeout(widgetSelectorApplyTimer);
          widgetSelectorApplyTimer = 0;
        }
        widgetSelectorApplyTimer = setTimeout(function () {
          widgetSelectorApplyTimer = 0;
          apply();
        }, 0);
      }
      function getOverlayTypeDefaults(type) {
        var index = 0;
        var keys = ["waze", "saeiv", "saeiv_mini"];
        for (var i = 0; i < keys.length; i += 1) {
          if (keys[i] === type) {
            index = i;
            break;
          }
        }
        var baseX = scaleUiSize(26 + (index * 34));
        var baseY = scaleUiSize(62 + (index * 28));
        var ratio = typeAspectRatio(type);
        if (type === "waze") {
          var wazeDefaultWidth = scaleWidgetSize(scaleUiSize(360));
          var wazeMinWidth = scaleWidgetSize(scaleUiSize(140));
          return {
            x: baseX,
            y: baseY,
            width: wazeDefaultWidth,
            height: Math.round(wazeDefaultWidth / ratio),
            minWidth: wazeMinWidth,
            minHeight: Math.round(wazeMinWidth / ratio)
          };
        }
        if (type === "saeiv_mini") {
          var miniDefaultWidth = scaleWidgetSize(scaleUiSize(720));
          var miniDefaultHeight = scaleWidgetSize(scaleUiSize(420));
          return {
            x: baseX,
            y: baseY,
            width: miniDefaultWidth,
            height: miniDefaultHeight,
            minWidth: scaleWidgetSize(scaleUiSize(220)),
            minHeight: scaleWidgetSize(scaleUiSize(120))
          };
        }
        var hudDefaultWidth = scaleWidgetSize(scaleUiSize(720));
        var hudMinWidth = scaleWidgetSize(scaleUiSize(260));
        return {
          x: baseX,
          y: baseY,
          width: hudDefaultWidth,
          height: Math.round(hudDefaultWidth / ratio),
          minWidth: hudMinWidth,
          minHeight: Math.round(hudMinWidth / ratio)
        };
      }

      function clampOverlayRect(state, minWidth, minHeight) {
        var viewportWidth = Math.max(240, Number(window.innerWidth) || 0);
        var viewportHeight = Math.max(180, Number(window.innerHeight) || 0);
        var minW = Math.max(120, Number(minWidth) || 120);
        var minH = Math.max(80, Number(minHeight) || 80);

        state.width = Math.max(minW, Math.min(Number(state.width) || minW, viewportWidth));
        state.height = Math.max(minH, Math.min(Number(state.height) || minH, viewportHeight));

        state.x = Number(state.x) || 0;
        state.y = Number(state.y) || 0;

        if (state.x + state.width > viewportWidth) state.x = Math.max(0, viewportWidth - state.width);
        if (state.y + state.height > viewportHeight) state.y = Math.max(0, viewportHeight - state.height);
        if (state.x < 0) state.x = 0;
        if (state.y < 0) state.y = 0;
      }
      function clampManagerScalePercent(value) {
        var n = Math.round(Number(value));
        if (!Number.isFinite(n)) n = OVERLAY_MANAGER_SCALE_DEFAULT;
        if (n < OVERLAY_MANAGER_SCALE_MIN) n = OVERLAY_MANAGER_SCALE_MIN;
        if (n > OVERLAY_MANAGER_SCALE_MAX) n = OVERLAY_MANAGER_SCALE_MAX;
        return n;
      }
      function clampTelemetryOverlayAlphaPercent(value) {
        var n = Math.round(Number(value));
        if (!Number.isFinite(n)) n = TELEMETRY_OVERLAY_ALPHA_DEFAULT;
        if (n < TELEMETRY_OVERLAY_ALPHA_MIN) n = TELEMETRY_OVERLAY_ALPHA_MIN;
        if (n > TELEMETRY_OVERLAY_ALPHA_MAX) n = TELEMETRY_OVERLAY_ALPHA_MAX;
        return n;
      }
      function clampNotificationScalePercent(value) {
        var n = Math.round(Number(value));
        if (!Number.isFinite(n)) n = NOTIFICATION_SCALE_DEFAULT;
        if (n < NOTIFICATION_SCALE_MIN) n = NOTIFICATION_SCALE_MIN;
        if (n > NOTIFICATION_SCALE_MAX) n = NOTIFICATION_SCALE_MAX;
        return n;
      }
      function clampGlobalAudioVolumePercent(value) {
        var n = Math.round(Number(value));
        if (!Number.isFinite(n)) n = GLOBAL_AUDIO_VOLUME_DEFAULT;
        if (n < GLOBAL_AUDIO_VOLUME_MIN) n = GLOBAL_AUDIO_VOLUME_MIN;
        if (n > GLOBAL_AUDIO_VOLUME_MAX) n = GLOBAL_AUDIO_VOLUME_MAX;
        return n;
      }
      function getGlobalAudioVolumeFactor() {
        return clampGlobalAudioVolumePercent(globalAudioVolumePercent) / 100;
      }
      function updateSliderFill(slider) {
        if (!slider) return;
        var min = parseFloat(slider.min) || 0;
        var max = parseFloat(slider.max) || 100;
        var val = parseFloat(slider.value) || 0;
        var percent = (val - min) / (max - min) * 100;
        slider.style.setProperty('--value-percent', percent + '%');
      }
      function syncManagerScaleUi() {
        if (el.overlayManagerScale) {
          el.overlayManagerScale.min = String(OVERLAY_MANAGER_SCALE_MIN);
          el.overlayManagerScale.max = String(OVERLAY_MANAGER_SCALE_MAX);
          el.overlayManagerScale.value = String(clampManagerScalePercent(managerScalePercent));
          updateSliderFill(el.overlayManagerScale);
        }
        if (el.overlayManagerScaleValue) {
          el.overlayManagerScaleValue.textContent = String(clampManagerScalePercent(managerScalePercent)) + "%";
        }
      }
      function syncTelemetryOverlayAlphaUi() {
        if (el.overlayBackdropOpacity) {
          el.overlayBackdropOpacity.min = String(TELEMETRY_OVERLAY_ALPHA_MIN);
          el.overlayBackdropOpacity.max = String(TELEMETRY_OVERLAY_ALPHA_MAX);
          el.overlayBackdropOpacity.value = String(clampTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent));
          updateSliderFill(el.overlayBackdropOpacity);
        }
        if (el.overlayBackdropOpacityValue) {
          el.overlayBackdropOpacityValue.textContent = String(clampTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent)) + "%";
        }
      }
      function syncNotificationScaleUi() {
        if (el.overlayNotificationScale) {
          el.overlayNotificationScale.min = String(NOTIFICATION_SCALE_MIN);
          el.overlayNotificationScale.max = String(NOTIFICATION_SCALE_MAX);
          el.overlayNotificationScale.value = String(clampNotificationScalePercent(notificationScalePercent));
          updateSliderFill(el.overlayNotificationScale);
        }
        if (el.overlayNotificationScaleValue) {
          el.overlayNotificationScaleValue.textContent = String(clampNotificationScalePercent(notificationScalePercent)) + "%";
        }
      }
      function syncGlobalAudioVolumeUi() {
        if (el.overlayGlobalAudioVolume) {
          el.overlayGlobalAudioVolume.min = String(GLOBAL_AUDIO_VOLUME_MIN);
          el.overlayGlobalAudioVolume.max = String(GLOBAL_AUDIO_VOLUME_MAX);
          el.overlayGlobalAudioVolume.value = String(clampGlobalAudioVolumePercent(globalAudioVolumePercent));
          updateSliderFill(el.overlayGlobalAudioVolume);
        }
        if (el.overlayGlobalAudioVolumeValue) {
          el.overlayGlobalAudioVolumeValue.textContent = String(clampGlobalAudioVolumePercent(globalAudioVolumePercent)) + "%";
        }
      }
      function applyManagerScalePercent(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        managerScalePercent = clampManagerScalePercent(value);
        var factor = managerScalePercent / 100;
        managerState.width = Math.round(OVERLAY_MANAGER_BASE_WIDTH * factor);
        managerState.height = Math.round(OVERLAY_MANAGER_BASE_HEIGHT * factor);
        clampOverlayRect(managerState, OVERLAY_MANAGER_MIN_WIDTH, OVERLAY_MANAGER_MIN_HEIGHT);
        if (opts.syncUi !== false) syncManagerScaleUi();
        if (opts.render !== false) renderManager();
      }
      function applyTelemetryOverlayAlphaPercent(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        telemetryOverlayAlphaPercent = clampTelemetryOverlayAlphaPercent(value);
        var alpha = telemetryOverlayAlphaPercent / 100;
        document.documentElement.style.setProperty("--telemetry-overlay-alpha", String(alpha));
        if (opts.syncUi !== false) syncTelemetryOverlayAlphaUi();
      }
      function applyNotificationScaleToWindow(win, scale) {
        if (!win || win.closed) return;
        var doc = null;
        try { doc = win.document; } catch (err) { doc = null; }
        if (!doc || !doc.documentElement) return;
        try {
          doc.documentElement.style.setProperty("--idf-notification-scale", String(scale));
        } catch (err2) { }
      }
      function applyNotificationScalePercent(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        notificationScalePercent = clampNotificationScalePercent(value);
        var scale = notificationScalePercent / 100;
        document.documentElement.style.setProperty("--notification-text-scale", String(scale));
        applyNotificationScaleToWindow(pipWindow, scale);
        Object.keys(tabRefs).forEach(function (id) {
          applyNotificationScaleToWindow(tabRefs[id], scale);
        });
        if (opts.syncUi !== false) syncNotificationScaleUi();
      }
      function applyGlobalAudioVolumePercent(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        globalAudioVolumePercent = clampGlobalAudioVolumePercent(value);
        if (typeof syncSaeivRuntimeAudioVolumes === "function") {
          syncSaeivRuntimeAudioVolumes();
        }
        if (opts.syncUi !== false) syncGlobalAudioVolumeUi();
        if (opts.syncState !== false && typeof syncSaeivExternalState === "function") {
          saeivLastStateKey = "";
          syncSaeivExternalState(true);
        }
      }
      function playNotificationSound() {
        if (!notificationSoundsEnabled) return;
        try {
          var AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          var ctx = new AudioContextClass();
          var volume = (clampGlobalAudioVolumePercent(globalAudioVolumePercent) / 100) * 0.3;

          var playTone = function (freq, start, duration) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(volume, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration);
          };

          // Double carillon harmonieux (Mi5 -> La5)
          playTone(659.25, ctx.currentTime, 0.25);
          playTone(880.00, ctx.currentTime + 0.1, 0.3);
        } catch (err) { }
      }

      function showOverlayNotification(title, description, durationMs) {
        var preview = el.overlayNotificationPreview;
        if (!preview) return;

        var effectiveDescription = description;
        var effectiveDuration = durationMs;

        // Autorise l'appel court: showOverlayNotification("Titre", 1800)
        if (typeof description === "number" && (durationMs === undefined || durationMs === null)) {
          effectiveDuration = description;
          effectiveDescription = "";
        }

        if (el.overlayNotificationPreviewTitle) {
          el.overlayNotificationPreviewTitle.textContent = String(title || "Notification");
        }
        var hasDescription = effectiveDescription !== null && effectiveDescription !== undefined && String(effectiveDescription).trim() !== "";
        if (el.overlayNotificationPreviewDescription) {
          el.overlayNotificationPreviewDescription.textContent = hasDescription ? String(effectiveDescription) : "";
          el.overlayNotificationPreviewDescription.style.display = hasDescription ? "" : "none";
        }
        notificationPreviewKind = "notification";
        preview.classList.toggle("is-title-only", !hasDescription);
        preview.classList.add("is-visible");

        // Jouer le son de notification
        playNotificationSound();

        if (notificationPreviewTimer) {
          clearTimeout(notificationPreviewTimer);
          notificationPreviewTimer = 0;
        }
        var delay = Math.max(
          OVERLAY_NOTIFICATION_MIN_DURATION_MS,
          Number(effectiveDuration) || OVERLAY_NOTIFICATION_MIN_DURATION_MS
        );
        notificationPreviewTimer = setTimeout(function () {
          notificationPreviewTimer = 0;
          if (!el.overlayNotificationPreview) return;
          notificationPreviewKind = "";
          el.overlayNotificationPreview.classList.remove("is-visible");
        }, delay);
      }
      function renderWebsocketMode1Hint() {
        var preview = el.overlayNotificationPreview;
        if (!preview) return;
        if (notificationPreviewKind === "notification" || notificationPreviewKind === "preview") return;
        function normalizeHintKeyLabel(rawKey) {
          var key = String(rawKey || "").trim();
          if (!key) return "";
          var lower = key.toLowerCase();
          if (lower === "control" || lower === "ctrl") return "Ctrl";
          if (lower === "meta" || lower === "win" || lower === "os" || lower === "windows") return "Windows";
          if (lower === "delete" || lower === "del" || lower === "suppr") return "Suppr";
          if (lower === "escape" || lower === "esc" || lower === "echap") return "Echap";
          if (key.length === 1) return key.toUpperCase();
          return key;
        }
        function buildShortcutBadges(keys) {
          var wrap = document.createElement("span");
          wrap.className = "overlay-shortcut-badges";
          var list = Array.isArray(keys) ? keys : [];
          for (var i = 0; i < list.length; i += 1) {
            var label = normalizeHintKeyLabel(list[i]);
            if (!label) continue;
            if (wrap.childNodes.length > 0) {
              var plus = document.createElement("span");
              plus.className = "overlay-shortcut-plus";
              plus.textContent = "+";
              wrap.appendChild(plus);
            }
            var badge = document.createElement("span");
            badge.className = "overlay-shortcut-badge";
            badge.textContent = label;
            wrap.appendChild(badge);
          }
          return wrap;
        }
        if (notificationPreviewTimer) {
          clearTimeout(notificationPreviewTimer);
          notificationPreviewTimer = 0;
        }
        if (el.overlayNotificationPreviewTitle) {
          el.overlayNotificationPreviewTitle.textContent = "Bienvenue !";
        }
        if (el.overlayNotificationPreviewDescription) {
          var shortcut = null;
          try {
            if (typeof getEffectiveShortcutForScope === "function" && typeof OVERLAY_SHORTCUT_SCOPE_OVERLAY !== "undefined") {
              shortcut = getEffectiveShortcutForScope(OVERLAY_SHORTCUT_SCOPE_OVERLAY);
            }
          } catch (err0) { shortcut = null; }
          var overlayKeys = (shortcut && Array.isArray(shortcut.keys) && shortcut.keys.length)
            ? shortcut.keys.slice()
            : (OVERLAY_TOGGLE_DEFAULT_SHORTCUT && Array.isArray(OVERLAY_TOGGLE_DEFAULT_SHORTCUT.keys) ? OVERLAY_TOGGLE_DEFAULT_SHORTCUT.keys.slice() : ["Suppr"]);

          var descEl = el.overlayNotificationPreviewDescription;
          descEl.innerHTML = "";
          descEl.appendChild(document.createTextNode("Utilisez "));
          descEl.appendChild(buildShortcutBadges(overlayKeys));
          descEl.appendChild(document.createTextNode(" pour ouvrir le menu."));
          descEl.style.display = "";
        }
        notificationPreviewKind = "hint";
        preview.classList.remove("is-title-only");
        preview.classList.add("is-visible");
      }
      function stopWebsocketMode1Hint() {
        if (websocketMode1HintTimer) {
          clearInterval(websocketMode1HintTimer);
          websocketMode1HintTimer = 0;
        }
        var preview = el.overlayNotificationPreview;
        if (preview && notificationPreviewKind === "hint") {
          notificationPreviewKind = "";
          preview.classList.remove("is-visible");
        }
      }
      function syncWebsocketMode1HintVisibility() {
        if (FORCE_DEV_UI) {
          stopWebsocketMode1Hint();
          return;
        }
        if (!firstVisitMode1HintEnabled) {
          stopWebsocketMode1Hint();
          return;
        }
        if (telemetryUiMode !== 1) {
          stopWebsocketMode1Hint();
          return;
        }
        renderWebsocketMode1Hint();
        if (websocketMode1HintTimer) return;
        websocketMode1HintTimer = setInterval(function () {
          if (telemetryUiMode !== 1) {
            stopWebsocketMode1Hint();
            return;
          }
          renderWebsocketMode1Hint();
        }, 900);
      }
      function readSystemNameValue() {
        var directName = "";
        try {
          if (typeof systemName !== "undefined" && systemName !== null) {
            directName = String(systemName).trim();
          }
        } catch (err0) { directName = ""; }
        if (directName) return directName;
        try { directName = String(window.systemName || "").trim(); } catch (err1) { directName = ""; }
        if (directName) return directName;
        try { directName = String((typeof globalThis !== "undefined" ? globalThis.systemName : "") || "").trim(); } catch (err2) { directName = ""; }
        if (directName) return directName;
        try { directName = String(window.parent && window.parent.systemName || "").trim(); } catch (err3) { directName = ""; }
        if (directName) return directName;
        try { directName = String(window.top && window.top.systemName || "").trim(); } catch (err4) { directName = ""; }
        if (directName) return directName;
        var fromQuery = "";
        try {
          var params = new URLSearchParams((window.location && window.location.search) || "");
          fromQuery = String(
            params.get("systemName") ||
            params.get("systemname") ||
            params.get("system_name") ||
            params.get("system") ||
            params.get("name") ||
            ""
          ).trim();
        } catch (err5) { fromQuery = ""; }
        if (fromQuery) return fromQuery;
        try { directName = String(localStorage.getItem("systemName") || "").trim(); } catch (err6) { directName = ""; }
        if (directName) return directName;
        return "";
      }
      function readSystemName() {
        var name = readSystemNameValue();
        return name || "Systeme";
      }
      function toggleNotificationScalePreview(show) {
        if (show) {
          var preview = el.overlayNotificationPreview;
          if (!preview) return;
          if (notificationPreviewTimer) {
            clearTimeout(notificationPreviewTimer);
            notificationPreviewTimer = 0;
          }
          if (el.overlayNotificationPreviewTitle) {
            el.overlayNotificationPreviewTitle.textContent = "Aper\u00E7u d'une notification";
          }
          if (el.overlayNotificationPreviewDescription) {
            el.overlayNotificationPreviewDescription.textContent = "Aper\u00E7u de la description de la notification.";
            el.overlayNotificationPreviewDescription.style.display = "";
          }
          notificationPreviewKind = "preview";
          preview.classList.remove("is-title-only");
          preview.classList.add("is-visible");
          document.body.classList.add("is-previewing-notification");
        } else {
          document.body.classList.remove("is-previewing-notification");
          var preview = el.overlayNotificationPreview;
          if (preview && notificationPreviewKind === "preview") {
            notificationPreviewKind = "";
            preview.classList.remove("is-visible");
          }
        }
      }
      function consumeReloadNoticeIntent() {
        var raw = "";
        try { raw = String(sessionStorage.getItem(RELOAD_NOTICE_INTENT_KEY) || ""); } catch (err0) { raw = ""; }
        if (raw !== "1") return false;
        try { sessionStorage.removeItem(RELOAD_NOTICE_INTENT_KEY); } catch (err1) { }
        return true;
      }
      function buildSystemLoadedTitle(name, isReloaded) {
        var safeName = String(name || "Systeme");
        return safeName + (isReloaded ? " recharg\u00E9e" : " charg\u00E9");
      }
      function showSystemLoadedNotification() {
        var systemName = readSystemName();
        var isReloaded = consumeReloadNoticeIntent();
        showOverlayNotification(buildSystemLoadedTitle(systemName, isReloaded), 3200);
      }
      function showSystemLoadedNotificationWhenReady() {
        var tries = 0;
        var maxTries = 20;
        var isReloaded = consumeReloadNoticeIntent();
        function attempt() {
          tries += 1;
          var detected = readSystemNameValue();
          if (detected || tries >= maxTries) {
            var finalName = detected || "Systeme";
            showOverlayNotification(buildSystemLoadedTitle(finalName, isReloaded), 3200);
            return;
          }
          setTimeout(attempt, 150);
        }
        attempt();
      }

      function clampWidgetRect(state, type) {
        var safeType = normalizeWidgetType(type);
        if (!state || !isType(safeType)) return;
        var defaults = getOverlayTypeDefaults(safeType);
        var lockRatio = isAspectRatioLocked(safeType);
        var ratio = typeAspectRatio(safeType);
        var viewportWidth = Math.max(240, Number(window.innerWidth) || 0);
        var viewportHeight = Math.max(180, Number(window.innerHeight) || 0);
        var topInset = 0;
        var maxContentHeight = Math.max(80, viewportHeight - topInset);
        var minWidth = Math.max(120, Number(defaults.minWidth) || 120);
        var minHeight = Math.max(80, Number(defaults.minHeight) || 80);
        var width = Number(state.width);
        var height = Number(state.height);
        if (lockRatio) {
          var effectiveMinWidth = Math.max(minWidth, minHeight * ratio);
          var maxWidth = Math.min(viewportWidth, maxContentHeight * ratio);
          if (!Number.isFinite(maxWidth) || maxWidth <= 0) maxWidth = effectiveMinWidth;
          if (maxWidth < effectiveMinWidth) effectiveMinWidth = maxWidth;

          if (!Number.isFinite(width) || width <= 0) {
            if (Number.isFinite(height) && height > 0) width = height * ratio;
          }
          if (!Number.isFinite(width) || width <= 0) width = Number(defaults.width) || effectiveMinWidth;
          width = Math.max(effectiveMinWidth, Math.min(width, maxWidth));
          state.width = width;
          state.height = width / ratio;
        } else {
          var maxWidthFree = viewportWidth;
          var maxHeightFree = maxContentHeight;
          if (!Number.isFinite(width) || width <= 0) width = Number(defaults.width) || minWidth;
          if (!Number.isFinite(height) || height <= 0) height = Number(defaults.height) || minHeight;
          state.width = Math.max(minWidth, Math.min(width, maxWidthFree));
          state.height = Math.max(minHeight, Math.min(height, maxHeightFree));
        }
        state.x = Number(state.x) || 0;
        state.y = Number(state.y) || 0;
        var minY = topInset;

        if (state.x + state.width > viewportWidth) state.x = Math.max(0, viewportWidth - state.width);
        if (state.y + state.height > viewportHeight) state.y = Math.max(minY, viewportHeight - state.height);
        if (state.x < 0) state.x = 0;
        if (state.y < minY) state.y = minY;
      }

      function bumpOverlayZ() {
        nextOverlayZ += 1;
        if (!Number.isFinite(nextOverlayZ) || nextOverlayZ > 2147000000) nextOverlayZ = 50;
        return nextOverlayZ;
      }

      function ensureWindowState(type) {
        var safeType = normalizeWidgetType(type);
        if (!isType(safeType)) return null;
        var state = windowsByType[safeType];
        if (!state || typeof state !== "object") {
          var defaults = getOverlayTypeDefaults(safeType);

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
              if (targetX < mx + mw && targetX + defaults.width > mx &&
                targetY < my + mh && targetY + defaults.height > my) {
                collision = true;
              }
            }

            var activeTypes = typeof getInlineActiveTypes === "function" ? getInlineActiveTypes() : [];
            var keys = Object.keys(windowsByType);
            for (var k = 0; k < keys.length; k++) {
              var otherType = keys[k];
              if (otherType === safeType) continue;

              var other = windowsByType[otherType];
              if (!other) continue;

              if (activeTypes.indexOf(otherType) === -1) continue;
              var ox = other.x, oy = other.y, ow = other.width, oh = other.height;

              if (targetX < ox + ow && targetX + defaults.width > ox &&
                targetY < oy + oh && targetY + defaults.height > oy) {
                collision = true;
                break;
              }
            }

            if (!collision) {
              found = true;
            } else {
              targetX += defaults.width + gap;
              if (targetX + defaults.width > viewportW - scaleUiSize(20)) {
                targetX = scaleUiSize(20);
                targetY += defaults.height + gap + scaleUiSize(40);
              }
            }
          }

          if (!found) {
            targetX = defaults.x;
            targetY = defaults.y;
          }

          state = {
            x: targetX,
            y: targetY,
            width: defaults.width,
            height: defaults.height,
            z: bumpOverlayZ()
          };
          windowsByType[safeType] = state;
        }
        clampWidgetRect(state, safeType);
        if (!Number.isFinite(Number(state.z))) state.z = bumpOverlayZ();
        return state;
      }

      function bringManagerToFront() {
        managerState.z = bumpOverlayZ();
        renderManager();
      }

      function bringWidgetTypeToFront(type) {
        var state = ensureWindowState(type);
        if (!state) return;
        state.z = bumpOverlayZ();
        var node = windowNodeByType[type];
        if (node) node.style.zIndex = String(state.z);
      }

      function applyOverlayWindowStateToNode(node, state) {
        if (!node || !state) return;
        var safeType = normalizeWidgetType(node.dataset ? node.dataset.widgetType : "");
        if (isType(safeType)) {
          if (isAspectRatioLocked(safeType)) {
            node.style.aspectRatio = String(typeAspectRatio(safeType));
          } else {
            node.style.removeProperty("aspect-ratio");
          }
        }
        node.style.left = Math.round(state.x) + "px";
        node.style.top = Math.round(state.y) + "px";
        node.style.width = Math.round(state.width) + "px";
        node.style.height = Math.round(state.height) + "px";
        node.style.zIndex = String(Math.max(1, Math.round(Number(state.z) || 1)));
      }

      function getInlineActiveTypes() {
        var seenTypes = Object.create(null);
        var out = [];
        (lanes.inline || []).forEach(function (id) {
          var widget = widgetsById[id];
          var type = normalizeWidgetType(widget && widget.type);
          if (!isType(type) || seenTypes[type]) return;
          seenTypes[type] = true;
          out.push(type);
        });
        return out;
      }

      function sanitize() {
        var nextInline = [];
        var seenIds = Object.create(null);
        var seenTypes = Object.create(null);
        (lanes.inline || []).forEach(function (id) {
          if (seenIds[id]) return;
          var widget = widgetsById[id];
          var type = normalizeWidgetType(widget && widget.type);
          if (!widget || !isType(type) || seenTypes[type]) return;
          seenIds[id] = true;
          seenTypes[type] = true;
          nextInline.push(id);
        });
        Object.keys(widgetsById).forEach(function (id) {
          if (seenIds[id]) return;
          var widget = widgetsById[id];
          var type = normalizeWidgetType(widget && widget.type);
          if (!widget || !isType(type) || seenTypes[type]) return;
          seenIds[id] = true;
          seenTypes[type] = true;
          nextInline.push(id);
        });
        lanes = { inline: nextInline, tab: [], pip: [] };
      }

      function saveWidgetLayoutState() {
        sanitize();
        var key = getWidgetLayoutStorageKey(currentGameMode);
        var state = {
          version: 4,
          nextId: Math.max(1, Number(nextId) || 1),
          activeTypes: getInlineActiveTypes(),
          windowsByType: {},
          manager: {
            x: managerState.x,
            y: managerState.y,
            width: managerState.width,
            height: managerState.height,
            z: managerState.z,
            visible: managerState.visible !== false,
            scale: clampManagerScalePercent(managerScalePercent),
            overlayAlpha: clampTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent),
            notificationScale: clampNotificationScalePercent(notificationScalePercent),
            globalAudioVolume: clampGlobalAudioVolumePercent(globalAudioVolumePercent),
            timeSystem: normalizeSaeivTimeSystem(saeivTimeSystem),
            showExperimentalWidgets: showExperimentalWidgets === true,
            stopAnnouncementSoundsEnabled: saeivStopAnnouncementSoundsEnabled === true,
            passengerValidationSoundsEnabled: saeivPassengerValidationSoundsEnabled === true,
            hideUiWhenManagerHidden: hideUiWhenManagerHidden === true,
            unknownBusCapacityValue: Math.max(1, Math.round(Number(saeivUnknownBusCapacityInputValue) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT)),
            unknownBusCapacityUnlimited: saeivUnknownBusCapacityUnlimited === true,
            forceListedBusCapacityForAll: saeivForceListedCapacityForAllBuses === true
          }
        };

        Object.keys(windowsByType).forEach(function (type) {
          var safeType = normalizeWidgetType(type);
          if (!isType(safeType)) return;
          var src = ensureWindowState(safeType);
          if (!src) return;
          state.windowsByType[safeType] = {
            x: src.x,
            y: src.y,
            width: src.width,
            height: src.height,
            z: src.z
          };
        });

        // On ne sauvegarde PLUS dans la clé globale pour éviter les écrasements entre modes
        // try { localStorage.setItem(WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(state)); } catch (err) { }
        try {
          localStorage.setItem(OVERLAY_MANAGER_STORAGE_KEY, JSON.stringify({
            x: managerState.x,
            y: managerState.y,
            width: managerState.width,
            height: managerState.height,
            z: managerState.z,
            visible: managerState.visible !== false,
            scale: clampManagerScalePercent(managerScalePercent),
            overlayAlpha: clampTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent),
            notificationScale: clampNotificationScalePercent(notificationScalePercent),
            globalAudioVolume: clampGlobalAudioVolumePercent(globalAudioVolumePercent),
            timeSystem: normalizeSaeivTimeSystem(saeivTimeSystem),
            showExperimentalWidgets: showExperimentalWidgets === true,
            stopAnnouncementSoundsEnabled: saeivStopAnnouncementSoundsEnabled === true,
            passengerValidationSoundsEnabled: saeivPassengerValidationSoundsEnabled === true,
            notificationSoundsEnabled: notificationSoundsEnabled === true,
            hideUiWhenManagerHidden: hideUiWhenManagerHidden === true,
            defaultStartupMode: normalizeDefaultStartupMode(defaultStartupMode),
            unknownBusCapacityValue: Math.max(1, Math.round(Number(saeivUnknownBusCapacityInputValue) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT)),
            unknownBusCapacityUnlimited: saeivUnknownBusCapacityUnlimited === true,
            forceListedBusCapacityForAll: saeivForceListedCapacityForAllBuses === true
          }));
        } catch (err2) { }
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch (err3) { }
      }

      function restoreWidgetLayoutState() {
        var modeKey = getWidgetLayoutStorageKey(currentGameMode);
        var raw = "";
        try {
          raw = String(localStorage.getItem(modeKey) || "");
          // Fallback : si pas de sauvegarde spécifique au mode, on tente de récupérer la globale (v4)
          if (!raw) {
            raw = String(localStorage.getItem(WIDGET_LAYOUT_STORAGE_KEY) || "");
          }
        } catch (err0) { raw = ""; }

        var parsed = null;
        if (raw) {
          try { parsed = JSON.parse(raw); } catch (err1) { parsed = null; }
        }

        // On nettoie physiquement le DOM avant de réinitialiser les références
        // pour éviter d'avoir des widgets "zombies" qu'on ne peut plus fermer.
        if (windowNodeByType) {
          Object.keys(windowNodeByType).forEach(function (type) {
            var node = windowNodeByType[type];
            if (node && node.parentNode) {
              node.parentNode.removeChild(node);
            }
          });
        }

        widgetsById = Object.create(null);
        lanes = { inline: [], tab: [], pip: [] };
        windowsByType = Object.create(null);
        windowNodeByType = Object.create(null);
        nextId = 1;

        var parsedVersion = Number(parsed && parsed.version);
        if (!parsed || typeof parsed !== "object" || (parsedVersion !== 3 && parsedVersion !== 4)) {
          return false;
        }

        var activeTypes = Array.isArray(parsed.activeTypes) ? parsed.activeTypes : [];
        activeTypes.forEach(function (typeRaw) {
          var type = normalizeWidgetType(typeRaw);
          if (!isType(type)) return;
          var id = createWidget(type);
          if (!id) return;
          lanes.inline.push(id);
        });

        var parsedWindows = parsed.windowsByType && typeof parsed.windowsByType === "object" ? parsed.windowsByType : {};
        Object.keys(parsedWindows).forEach(function (typeRaw) {
          var type = normalizeWidgetType(typeRaw);
          if (!isType(type)) return;
          var src = parsedWindows[typeRaw] && typeof parsedWindows[typeRaw] === "object" ? parsedWindows[typeRaw] : null;
          if (!src) return;
          windowsByType[type] = {
            x: Number(src.x),
            y: Number(src.y),
            width: Number(src.width),
            height: Number(src.height),
            z: Number(src.z)
          };
          if (parsedVersion === 3) {
            windowsByType[type].width = scaleWidgetSize(windowsByType[type].width);
            windowsByType[type].height = scaleWidgetSize(windowsByType[type].height);
          }
          clampWidgetRect(windowsByType[type], type);
          if (!Number.isFinite(Number(windowsByType[type].z))) windowsByType[type].z = bumpOverlayZ();
        });

        var parsedNextId = Math.floor(Number(parsed.nextId));
        if (Number.isFinite(parsedNextId) && parsedNextId > 0) nextId = parsedNextId;

        var hasStoredShowExperimentalWidgets = false;
        var storedShowExperimentalWidgets = false;
        var hasStoredStopAnnouncementSounds = false;
        var hasStoredHideUiWhenManagerHidden = false;
        var storedHideUiWhenManagerHidden = false;
        var storedStopAnnouncementSounds = true;
        var hasStoredPassengerValidationSounds = false;
        var storedPassengerValidationSounds = true;
        var hasStoredDefaultStartupMode = false;
        var storedDefaultStartupMode = DEFAULT_STARTUP_MODE_MENU;
        var hasStoredUnknownBusCapacityValue = false;
        var storedUnknownBusCapacityValue = SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT;
        var hasStoredUnknownBusCapacityUnlimited = false;
        var storedUnknownBusCapacityUnlimited = false;
        var hasStoredForceListedBusCapacity = false;
        var storedForceListedBusCapacity = false;
        var hasStoredGlobalAudioVolume = false;
        var storedGlobalAudioVolume = GLOBAL_AUDIO_VOLUME_DEFAULT;

        if (parsed.manager && typeof parsed.manager === "object") {
          managerState.x = Number(parsed.manager.x);
          managerState.y = Number(parsed.manager.y);
          managerState.width = Number(parsed.manager.width);
          managerState.height = Number(parsed.manager.height);
          managerState.z = Number(parsed.manager.z);
          managerState.visible = parsed.manager.visible !== false;
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "scale")) {
            managerScalePercent = clampManagerScalePercent(parsed.manager.scale);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "overlayAlpha")) {
            telemetryOverlayAlphaPercent = clampTelemetryOverlayAlphaPercent(parsed.manager.overlayAlpha);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "notificationScale")) {
            notificationScalePercent = clampNotificationScalePercent(parsed.manager.notificationScale);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "globalAudioVolume")) {
            hasStoredGlobalAudioVolume = true;
            storedGlobalAudioVolume = clampGlobalAudioVolumePercent(parsed.manager.globalAudioVolume);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "timeSystem")) {
            applySaeivTimeSystem(parsed.manager.timeSystem, { syncUi: true });
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "showExperimentalWidgets")) {
            hasStoredShowExperimentalWidgets = true;
            storedShowExperimentalWidgets = normalizeShowExperimentalWidgets(parsed.manager.showExperimentalWidgets);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "stopAnnouncementSoundsEnabled")) {
            hasStoredStopAnnouncementSounds = true;
            storedStopAnnouncementSounds = normalizeStopAnnouncementSoundsEnabled(parsed.manager.stopAnnouncementSoundsEnabled);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "passengerValidationSoundsEnabled")) {
            hasStoredPassengerValidationSounds = true;
            storedPassengerValidationSounds = normalizePassengerValidationSoundsEnabled(parsed.manager.passengerValidationSoundsEnabled);
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "hideUiWhenManagerHidden")) {
            hasStoredHideUiWhenManagerHidden = true;
            storedHideUiWhenManagerHidden = parsed.manager.hideUiWhenManagerHidden === true;
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "defaultStartupMode")) {
            hasStoredDefaultStartupMode = true;
            storedDefaultStartupMode = normalizeDefaultStartupMode(parsed.manager.defaultStartupMode);
          } else if (Object.prototype.hasOwnProperty.call(parsed.manager, "showMenuOnStartup")) {
            hasStoredDefaultStartupMode = true;
            storedDefaultStartupMode = parsed.manager.showMenuOnStartup === true
              ? DEFAULT_STARTUP_MODE_MENU
              : GAME_MODES.BUS;
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "unknownBusCapacityValue")) {
            var storedCapacityRaw = parseStrictPositiveInteger(parsed.manager.unknownBusCapacityValue);
            if (storedCapacityRaw !== null) {
              hasStoredUnknownBusCapacityValue = true;
              storedUnknownBusCapacityValue = storedCapacityRaw;
            }
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "unknownBusCapacityUnlimited")) {
            hasStoredUnknownBusCapacityUnlimited = true;
            storedUnknownBusCapacityUnlimited = parsed.manager.unknownBusCapacityUnlimited === true;
          }
          if (Object.prototype.hasOwnProperty.call(parsed.manager, "forceListedBusCapacityForAll")) {
            hasStoredForceListedBusCapacity = true;
            storedForceListedBusCapacity = parsed.manager.forceListedBusCapacityForAll === true;
          }
        } else {
          var managerRaw = "";
          try { managerRaw = String(localStorage.getItem(OVERLAY_MANAGER_STORAGE_KEY) || ""); } catch (err2) { managerRaw = ""; }
          if (managerRaw) {
            var managerParsed = null;
            try { managerParsed = JSON.parse(managerRaw); } catch (err3) { managerParsed = null; }
            if (managerParsed && typeof managerParsed === "object") {
              managerState.x = Number(managerParsed.x);
              managerState.y = Number(managerParsed.y);
              managerState.width = Number(managerParsed.width);
              managerState.height = Number(managerParsed.height);
              managerState.z = Number(managerParsed.z);
              managerState.visible = managerParsed.visible !== false;
              if (Object.prototype.hasOwnProperty.call(managerParsed, "scale")) {
                managerScalePercent = clampManagerScalePercent(managerParsed.scale);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "overlayAlpha")) {
                telemetryOverlayAlphaPercent = clampTelemetryOverlayAlphaPercent(managerParsed.overlayAlpha);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "notificationScale")) {
                notificationScalePercent = clampNotificationScalePercent(managerParsed.notificationScale);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "globalAudioVolume")) {
                hasStoredGlobalAudioVolume = true;
                storedGlobalAudioVolume = clampGlobalAudioVolumePercent(managerParsed.globalAudioVolume);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "timeSystem")) {
                applySaeivTimeSystem(managerParsed.timeSystem, { syncUi: true });
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "showExperimentalWidgets")) {
                hasStoredShowExperimentalWidgets = true;
                storedShowExperimentalWidgets = normalizeShowExperimentalWidgets(managerParsed.showExperimentalWidgets);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "stopAnnouncementSoundsEnabled")) {
                hasStoredStopAnnouncementSounds = true;
                storedStopAnnouncementSounds = normalizeStopAnnouncementSoundsEnabled(managerParsed.stopAnnouncementSoundsEnabled);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "passengerValidationSoundsEnabled")) {
                hasStoredPassengerValidationSounds = true;
                storedPassengerValidationSounds = normalizePassengerValidationSoundsEnabled(managerParsed.passengerValidationSoundsEnabled);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "notificationSoundsEnabled")) {
                notificationSoundsEnabled = normalizeNotificationSoundsEnabled(managerParsed.notificationSoundsEnabled);
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "hideUiWhenManagerHidden")) {
                hasStoredHideUiWhenManagerHidden = true;
                storedHideUiWhenManagerHidden = managerParsed.hideUiWhenManagerHidden === true;
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "defaultStartupMode")) {
                hasStoredDefaultStartupMode = true;
                storedDefaultStartupMode = normalizeDefaultStartupMode(managerParsed.defaultStartupMode);
              } else if (Object.prototype.hasOwnProperty.call(managerParsed, "showMenuOnStartup")) {
                hasStoredDefaultStartupMode = true;
                storedDefaultStartupMode = managerParsed.showMenuOnStartup === true
                  ? DEFAULT_STARTUP_MODE_MENU
                  : GAME_MODES.BUS;
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "unknownBusCapacityValue")) {
                var fallbackCapacityRaw = parseStrictPositiveInteger(managerParsed.unknownBusCapacityValue);
                if (fallbackCapacityRaw !== null) {
                  hasStoredUnknownBusCapacityValue = true;
                  storedUnknownBusCapacityValue = fallbackCapacityRaw;
                }
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "unknownBusCapacityUnlimited")) {
                hasStoredUnknownBusCapacityUnlimited = true;
                storedUnknownBusCapacityUnlimited = managerParsed.unknownBusCapacityUnlimited === true;
              }
              if (Object.prototype.hasOwnProperty.call(managerParsed, "forceListedBusCapacityForAll")) {
                hasStoredForceListedBusCapacity = true;
                storedForceListedBusCapacity = managerParsed.forceListedBusCapacityForAll === true;
              }
            }
          }
        }

        applyStopAnnouncementSoundsEnabled(
          hasStoredStopAnnouncementSounds ? storedStopAnnouncementSounds : true,
          { syncUi: true }
        );
        applyPassengerValidationSoundsEnabled(
          hasStoredPassengerValidationSounds ? storedPassengerValidationSounds : false,
          { syncUi: true, syncState: false }
        );
        applyHideUiWhenManagerHidden(
          hasStoredHideUiWhenManagerHidden ? storedHideUiWhenManagerHidden : false,
          { syncUi: true, render: false }
        );
        var globalManagerRaw = "";
        try {
          globalManagerRaw = String(localStorage.getItem(OVERLAY_MANAGER_STORAGE_KEY) || "");
        } catch (errGlobalManagerRaw) {
          globalManagerRaw = "";
        }

        if (globalManagerRaw) {
          var globalManagerParsed = null;

          try {
            globalManagerParsed = JSON.parse(globalManagerRaw);
          } catch (errGlobalManagerParse) {
            globalManagerParsed = null;
          }

          if (globalManagerParsed && typeof globalManagerParsed === "object") {
            if (Object.prototype.hasOwnProperty.call(globalManagerParsed, "defaultStartupMode")) {
              hasStoredDefaultStartupMode = true;
              storedDefaultStartupMode = normalizeDefaultStartupMode(globalManagerParsed.defaultStartupMode);
            } else if (Object.prototype.hasOwnProperty.call(globalManagerParsed, "showMenuOnStartup")) {
              hasStoredDefaultStartupMode = true;
              storedDefaultStartupMode = globalManagerParsed.showMenuOnStartup === true
                ? DEFAULT_STARTUP_MODE_MENU
                : GAME_MODES.BUS;
            }
          }
        }
        applyDefaultStartupMode(
          hasStoredDefaultStartupMode ? storedDefaultStartupMode : DEFAULT_STARTUP_MODE_MENU,
          { syncUi: true }
        );
        var hideUiInitDone = false;
        try { hideUiInitDone = String(localStorage.getItem(HIDE_UI_OPTION_INIT_KEY) || "") === "1"; } catch (errInitRead) { hideUiInitDone = false; }
        if (!hideUiInitDone) {
          applyHideUiWhenManagerHidden(false, { syncUi: true, render: false });
          try { localStorage.setItem(HIDE_UI_OPTION_INIT_KEY, "1"); } catch (errInitWrite) { }
        }
        if (hasStoredUnknownBusCapacityUnlimited && storedUnknownBusCapacityUnlimited) {
          applyUnknownBusCapacityInputValue(String(SAEIV_BUS_UNLIMITED_THRESHOLD + 1), { syncUi: true, syncState: false });
        } else {
          applyUnknownBusCapacityInputValue(
            String(hasStoredUnknownBusCapacityValue ? storedUnknownBusCapacityValue : SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT),
            { syncUi: true, syncState: false }
          );
        }
        applyForceListedCapacityForAllBuses(
          hasStoredForceListedBusCapacity ? storedForceListedBusCapacity : false,
          { syncUi: true, syncState: false }
        );
        applyShowExperimentalWidgets(hasStoredShowExperimentalWidgets ? storedShowExperimentalWidgets : false, { syncUi: true, apply: false });

        clampOverlayRect(managerState, OVERLAY_MANAGER_MIN_WIDTH, OVERLAY_MANAGER_MIN_HEIGHT);
        if (!Number.isFinite(Number(managerScalePercent))) {
          managerScalePercent = Math.round((Number(managerState.width) || OVERLAY_MANAGER_BASE_WIDTH) / Math.max(1, OVERLAY_MANAGER_BASE_WIDTH) * 100);
        }
        managerScalePercent = clampManagerScalePercent(managerScalePercent);
        telemetryOverlayAlphaPercent = clampTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent);
        notificationScalePercent = clampNotificationScalePercent(notificationScalePercent);

        var isDevMode = /[?&]dev($|[=&])/.test(window.location.search);
        if (isDevMode) {
          isGameUnlocked = true;
        }
        globalAudioVolumePercent = clampGlobalAudioVolumePercent(
          hasStoredGlobalAudioVolume ? storedGlobalAudioVolume : globalAudioVolumePercent
        );
        applyManagerScalePercent(managerScalePercent, { render: false, syncUi: true });
        applyTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent, { syncUi: true });
        applyNotificationScalePercent(notificationScalePercent, { syncUi: true });
        applyGlobalAudioVolumePercent(globalAudioVolumePercent, { syncUi: true, syncState: false });
        syncSaeivTimeSystemUi();
        syncStopAnnouncementSoundsUi();
        syncPassengerValidationSoundsUi();
        syncHideUiWhenManagerHiddenUi();
        syncBusCapacitySettingsUi();
        syncShowExperimentalWidgetsUi();
        if (!Number.isFinite(Number(managerState.z))) managerState.z = 1200;
        sanitize();
        return true;
      }

      function createOverlayWindowNode(type) {
        var meta = TYPES[type];
        if (!meta || !el.overlayWorkspace) return null;
        var section = document.createElement("section");
        section.className = "overlay-window";
        section.dataset.widgetType = type;
        section.setAttribute("aria-label", meta.label);

        var titlebar = document.createElement("header");
        titlebar.className = "overlay-window-titlebar";
        titlebar.dataset.role = "drag";
        var title = document.createElement("span");
        title.className = "overlay-window-title";
        applyWidgetTitleWithExperimentalBadge(title, meta.label, type);
        var actions = document.createElement("div");
        actions.className = "overlay-window-actions";
        var closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "overlay-window-btn is-danger";
        closeBtn.textContent = "x";
        closeBtn.setAttribute("aria-label", "Fermer " + meta.label);
        closeBtn.dataset.role = "close";
        actions.appendChild(closeBtn);
        titlebar.appendChild(title);
        titlebar.appendChild(actions);

        var content = document.createElement("div");
        content.className = "overlay-window-content";
        var frame = document.createElement("iframe");
        frame.className = "overlay-window-frame";
        frame.src = meta.url;
        frame.title = meta.label;
        frame.setAttribute("frameborder", "0");
        frame.dataset.widgetType = type;
        content.appendChild(frame);

        function bindIframeContextMenu() {
          try {
            if (frame.contentWindow) {
              frame.contentWindow.removeEventListener("contextmenu", handleIframeContextMenu, true);
              frame.contentWindow.addEventListener("contextmenu", handleIframeContextMenu, true);
            }
          } catch (e) { }
        }
        function handleIframeContextMenu(event) {
          if (event.target && event.target.closest && event.target.closest("button")) return;
          event.preventDefault();
          event.stopPropagation();
          toggleOverlayEditMode();
        }
        frame.addEventListener("load", bindIframeContextMenu);
        bindIframeContextMenu();

        var editOverlay = document.createElement("div");
        editOverlay.className = "edit-mode-overlay";

        var widgetName = document.createElement("div");
        widgetName.className = "edit-mode-widget-name";
        applyWidgetTitleWithExperimentalBadge(widgetName, meta.label, type);

        var bigCloseBtn = document.createElement("button");
        bigCloseBtn.type = "button";
        bigCloseBtn.className = "edit-mode-center-close-btn";
        bigCloseBtn.textContent = "×";
        bigCloseBtn.setAttribute("aria-label", "Fermer le widget");

        bigCloseBtn.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          ensureWidgetTypeEnabled(type, false);
          apply();
        });

        editOverlay.appendChild(widgetName);
        var editCenterActions = document.createElement("div");
        editCenterActions.className = "edit-mode-center-actions";
        editCenterActions.appendChild(bigCloseBtn);
        if (type === "saeiv") {
          var saeivHelpBtn = document.createElement("button");
          saeivHelpBtn.type = "button";
          saeivHelpBtn.className = "edit-mode-center-help-btn";
          saeivHelpBtn.textContent = "?";
          saeivHelpBtn.setAttribute("aria-label", "Ouvrir les IDs lignes SAEIV");
          saeivHelpBtn.title = "IDs lignes SAEIV";
          saeivHelpBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var helpUrl = new URL("html_divers/id_lignes_saeiv.html", window.location.href).href;
            if (typeof requestOpenUrl === "function") {
              requestOpenUrl(helpUrl);
            } else if (typeof openGame2Tab === "function") {
              openGame2Tab(helpUrl, "idf_saeiv_line_ids");
            } else {
              window.open(helpUrl, "_blank", "noopener,noreferrer");
            }
            if (typeof showOverlayNotification === "function") {
              showOverlayNotification("Lien ouvert dans votre navigateur", 1800);
            }
          });
          editCenterActions.appendChild(saeivHelpBtn);
        }
        editOverlay.appendChild(editCenterActions);
        section.appendChild(editOverlay);

        var resizeHandle = document.createElement("div");
        resizeHandle.className = "overlay-window-resize";
        resizeHandle.dataset.role = "resize";

        section.appendChild(titlebar);
        section.appendChild(content);
        section.appendChild(resizeHandle);
        setupAllSidesResize(section, type);

        section.addEventListener("pointerdown", function (event) {
          bringWidgetTypeToFront(type);
          saveWidgetLayoutState();

          if (overlayEditMode) {
            if (!isOverlayManagerVisibleForLayoutEdit()) {
              window.disengageOverlayEditMode();
              return;
            }

            if (event.button !== 0) return;
            if (
              event.target &&
              event.target.closest &&
              (
                event.target.closest(".resize-handle") ||
                event.target.closest(".edit-mode-center-close-btn") ||
                event.target.closest(".edit-mode-center-help-btn")
              )
            ) return;

            var state = ensureWindowState(type);
            if (!state) return;
            activeOverlayDrag = {
              pointerId: event.pointerId,
              mode: "move",
              type: type,
              startX: event.clientX,
              startY: event.clientY,
              originX: state.x,
              originY: state.y,
              originWidth: state.width,
              originHeight: state.height
            };
            try { section.setPointerCapture(event.pointerId); } catch (err) { }
            event.preventDefault();
          }
        });
        closeBtn.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          var id = findWidgetIdByType(type);
          if (!id) return;

          // Ajout du tween de sortie
          section.classList.add("is-leaving");

          setTimeout(function () {
            removeWidget(id);
            apply();
          }, 400);
        });
        titlebar.addEventListener("pointerdown", function (event) {
          if (event.button !== 0) return;
          if (event.target && event.target.closest && event.target.closest("[data-role='close']")) return;
          bringWidgetTypeToFront(type);
          var state = ensureWindowState(type);
          if (!state) return;
          activeOverlayDrag = {
            pointerId: event.pointerId,
            mode: "move",
            type: type,
            startX: event.clientX,
            startY: event.clientY,
            originX: state.x,
            originY: state.y,
            originWidth: state.width,
            originHeight: state.height
          };
          try { titlebar.setPointerCapture(event.pointerId); } catch (err) { }
          event.preventDefault();
        });
        resizeHandle.addEventListener("pointerdown", function (event) {
          if (event.button !== 0) return;
          bringWidgetTypeToFront(type);
          var state = ensureWindowState(type);
          if (!state) return;
          activeOverlayDrag = {
            pointerId: event.pointerId,
            mode: "resize",
            type: type,
            startX: event.clientX,
            startY: event.clientY,
            originX: state.x,
            originY: state.y,
            originWidth: state.width,
            originHeight: state.height
          };
          try { resizeHandle.setPointerCapture(event.pointerId); } catch (err) { }
          event.preventDefault();
          event.stopPropagation();
        });
        return section;
      }




      function renderManager() {
        if (!el.overlayManager) return;

        var mainMenu = document.getElementById("mainMenuModal");
        var isMenuOpen = mainMenu && mainMenu.classList.contains("is-open");

        if (telemetryUiMode !== 2) {
          if (mainMenu && mainMenu.classList.contains("is-open")) {
            // On ne débloque les widgets que si le menu n'est pas le menu forcé du démarrage
            if (!mainMenu.classList.contains("is-forced")) {
              isGameUnlocked = true;
            }
            mainMenu.classList.remove("is-open", "is-forced");
          }
          isMenuOpen = false;
        }

        document.body.classList.toggle("is-main-menu-open", !!isMenuOpen);
        document.body.classList.toggle("is-game-unlocked", !!isGameUnlocked);
        document.body.classList.toggle("is-manager-mode", telemetryUiMode === 2);
        document.body.classList.toggle("is-game-mode", telemetryUiMode !== 2);
        var managerHidden = (telemetryUiMode !== 2 || !!isMenuOpen);
        document.body.classList.toggle("is-manager-hidden", managerHidden);

        // 3. Gestion de l'affichage
        managerState.visible = !managerHidden;
        document.body.classList.toggle("is-telemetry-mode-1", FORCE_DEV_UI ? false : (telemetryUiMode === 2));
        var hideAllUiNow = (telemetryUiMode !== 2 && hideUiWhenManagerHidden && !isMenuOpen);
        document.body.classList.toggle("is-overlay-ui-fully-hidden", hideAllUiNow);
        if (el.overlayRoot) el.overlayRoot.style.display = hideAllUiNow ? "none" : "";
        if (el.overlayNotificationPreview) el.overlayNotificationPreview.style.display = hideAllUiNow ? "none" : "";
        updateSaeivSimulationPauseState();
        clampOverlayRect(managerState, OVERLAY_MANAGER_MIN_WIDTH, OVERLAY_MANAGER_MIN_HEIGHT);
        el.overlayManager.style.removeProperty("aspect-ratio");
        el.overlayManager.style.left = Math.round(managerState.x) + "px";
        el.overlayManager.style.top = Math.round(managerState.y) + "px";
        el.overlayManager.style.width = Math.round(managerState.width) + "px";
        el.overlayManager.style.height = "auto";
        el.overlayManager.style.zIndex = String(Math.max(1, Number(managerState.z) || 1));
        // On ne met PLUS display = "none" pour permettre le tween CSS
        // el.overlayManager.style.display = managerHidden ? "none" : "";
        if (!managerHidden) {
          var measuredHeight = Number(el.overlayManager.offsetHeight) || Number(managerState.height) || OVERLAY_MANAGER_MIN_HEIGHT;
          managerState.height = Math.max(OVERLAY_MANAGER_MIN_HEIGHT, measuredHeight);
          var viewportHeight = Math.max(180, Number(window.innerHeight) || 0);
          if (managerState.y + managerState.height > viewportHeight) {
            managerState.y = Math.max(0, viewportHeight - managerState.height);
            el.overlayManager.style.top = Math.round(managerState.y) + "px";
          }
        }

        if (isMenuOpen) {
          syncSaeivTimeSystemUi();
        }
      }

      // Boucle de rafraîchissement régulière pour l'heure dans le menu (indépendante de la télémétrie)
      setInterval(function () {
        var mainMenu = document.getElementById("mainMenuModal");
        if (mainMenu && mainMenu.classList.contains("is-open")) {
          syncSaeivTimeSystemUi();
        }
      }, 500);

      function refreshManagerUi() {
        var selectEl = el.overlayWidgetAddSelect;
        var addBtn = el.overlayWidgetAddBtn;
        if (!selectEl) return;
        var active = Object.create(null);
        getInlineActiveTypes().forEach(function (type) {
          active[type] = true;
        });

        var previousValue = normalizeWidgetType(String(overlayWidgetSelectedType || selectEl.value || ""));
        var availableTypes = Object.keys(TYPES).map(normalizeWidgetType).filter(function (type) {
          return isType(type) && !active[type] && isTypeAllowedForMode(type, currentGameMode);
        });
        if (!showExperimentalWidgets) {
          availableTypes = availableTypes.filter(function (type) {
            return !isExperimentalWidgetType(type);
          });
        }

        selectEl.innerHTML = "";
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = availableTypes.length ? "Choisir" : "Tous ajoutés";
        placeholder.disabled = true;
        placeholder.hidden = !!availableTypes.length;
        selectEl.appendChild(placeholder);

        availableTypes.forEach(function (type) {
          var option = document.createElement("option");
          option.value = type;
          var label = String(TYPES[type] && TYPES[type].label || type);
          if (isExperimentalWidgetType(type)) {
            option.textContent = label;
            option.className = "is-experimental";
            option.dataset.experimental = "1";
          } else {
            option.textContent = label;
            option.dataset.experimental = "0";
          }
          selectEl.appendChild(option);
        });

        if (previousValue && availableTypes.indexOf(previousValue) !== -1) {
          selectEl.value = previousValue;
          overlayWidgetSelectedType = previousValue;
        } else {
          selectEl.value = "";
          overlayWidgetSelectedType = "";
          if (selectEl.options && selectEl.options.length) {
            selectEl.selectedIndex = 0;
          }
        }

        var allAdded = !availableTypes.length;
        selectEl.disabled = allAdded;
        if (addBtn) {
          addBtn.disabled = allAdded || !selectEl.value;
          addBtn.dataset.allAdded = allAdded ? "true" : "false";
        }
        refreshOverlayWidgetExperimentalBadge(overlayWidgetSelectedType);
        updateOverlayWidgetAddDisplay();
        rebuildOverlayWidgetAddMenu();
        if (allAdded) closeOverlayWidgetAddMenu();
      }

      function ensureWidgetTypeEnabled(type, enabled) {
        var safeType = normalizeWidgetType(type);
        if (!isType(safeType)) return false;
        if (enabled && !isTypeAllowedForMode(safeType, currentGameMode)) return false;
        var currentId = findWidgetIdByType(safeType);
        if (enabled) {
          if (currentId) {
            if (!findOutputByWidgetId(currentId)) {
              lanes.inline.push(currentId);
              return true;
            }
            return false;
          }
          var created = createWidget(safeType);
          if (!created) return false;
          lanes.inline.push(created);
          return true;
        }
        if (!currentId) return false;
        removeWidget(currentId);
        return true;
      }

      function normalizeOverlayStateForViewport() {
        Object.keys(windowsByType).forEach(function (type) {
          var safeType = normalizeWidgetType(type);
          if (!isType(safeType)) return;
          var state = ensureWindowState(safeType);
          if (!state) return;
          clampWidgetRect(state, safeType);
        });
        clampOverlayRect(managerState, OVERLAY_MANAGER_MIN_WIDTH, OVERLAY_MANAGER_MIN_HEIGHT);
      }

      function renderStage() {
        if (!el.overlayWorkspace) return;
        sanitize();
        var activeTypes = getInlineActiveTypes();
        var keep = Object.create(null);
        activeTypes.forEach(function (type) {
          keep[type] = true;
        });

        Object.keys(windowNodeByType).forEach(function (type) {
          if (keep[type]) return;
          var node = windowNodeByType[type];
          if (node && node.parentNode) node.parentNode.removeChild(node);
          delete windowNodeByType[type];
        });

        activeTypes.forEach(function (type) {
          var state = ensureWindowState(type);
          if (!state) return;
          var node = windowNodeByType[type];
          if (!node) {
            node = createOverlayWindowNode(type);
            if (!node) return;
            windowNodeByType[type] = node;
            el.overlayWorkspace.appendChild(node);
          }
          var frame = node.querySelector("iframe.overlay-window-frame");
          if (frame && frame.dataset.widgetType !== type) {
            frame.src = TYPES[type].url;
            frame.dataset.widgetType = type;
          }
          applyOverlayWindowStateToNode(node, state);
        });
      }

      function applyOutputVisibility() { }
      function enforceOutputModeConstraints() { }

      function resolveTelemetryDotState() {
        var wsOpen = !!(telemetryWs && telemetryWs.readyState === WebSocket.OPEN);
        if (!wsOpen) return "offline";
        var lastPacketAt = Number(telemetryLastPacketAt);
        if (Number.isFinite(lastPacketAt) && lastPacketAt > 0) {
          var ageMs = Date.now() - lastPacketAt;
          if (Number.isFinite(ageMs) && ageMs <= Math.max(600, Number(TELEMETRY_PACKET_TIMEOUT_MS) || 2000)) {
            return "online";
          }
        }
        return "checking";
      }

      function setTelemetryConnectionState(isConnected, reason) {
        var nextConnected = !!isConnected;
        telemetryConnected = nextConnected;
        telemetryLastErrorReason = telemetryConnected ? "" : String(reason || "Connexion indisponible.");
        telemetryOfflineLock = !telemetryConnected;
        setTelemetryDotState(resolveTelemetryDotState());
        if (el.telemetryErrorOverlay) el.telemetryErrorOverlay.hidden = true;
        document.body.classList.remove("is-telemetry-blocked");
        syncExternalTelemetryBlocks();
        if (typeof refreshTelemetryVisibility === "function") refreshTelemetryVisibility();
      }

      function updatePresetSelectionIndicators() {
        var title = document.getElementById("overlayWidgetsSectionTitle");
        var grid = document.getElementById("overlayWidgetsGrid");
        if (title) title.style.display = "block";
        if (grid) grid.style.display = "flex";
      }

      function apply() {
        if (applying) return;
        applying = true;
        sanitize();
        normalizeOverlayStateForViewport();
        renderStage();
        renderManager();
        refreshManagerUi();
        updatePresetSelectionIndicators();
        ensureBackgroundBusStatusRuntime();
        saveWidgetLayoutState();
        applying = false;
      }

      function setupAllSidesResize(element, type) {
        var dirs = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
        if (type === "__manager__") {
          dirs = [];
        }
        dirs.forEach(function (dir) {
          var handle = document.createElement("div");
          handle.className = "resize-handle " + dir;
          element.appendChild(handle);

          handle.addEventListener("pointerdown", function (event) {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();

            if (type !== "__manager__") {
              bringWidgetTypeToFront(type);
            } else {
              bringManagerToFront();
            }

            var state = (type === "__manager__") ? managerState : ensureWindowState(type);
            if (!state) return;

            activeOverlayDrag = {
              pointerId: event.pointerId,
              mode: (type === "__manager__") ? "manager-resize" : "resize",
              type: type,
              dir: dir,
              startX: event.clientX,
              startY: event.clientY,
              originX: state.x,
              originY: state.y,
              originWidth: state.width,
              originHeight: state.height
            };
            try { handle.setPointerCapture(event.pointerId); } catch (err) { }
          });
        });
      }

      function setOverlayDragCursor(targetNode) {
        document.body.classList.add("is-overlay-dragging");
        if (targetNode) targetNode.classList.add("is-dragging");
      }

      function clearOverlayDragCursor() {
        document.body.classList.remove("is-overlay-dragging");
        document.querySelectorAll(".overlay-window.is-dragging, #overlayManager.is-dragging").forEach(function (node) {
          node.classList.remove("is-dragging");
        });
      }

