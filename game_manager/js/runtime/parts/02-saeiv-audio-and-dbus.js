/*
 * Game2 runtime chunk: 02-saeiv-audio-and-dbus.js
 * Audio SAEIV, DBus/FIS, selection de routes.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function ensureTrailingSlash(path) {
        return /\/$/.test(String(path || "")) ? String(path || "") : (String(path || "") + "/");
      }
      function encodePathSegment(segment) {
        var cleaned = String(segment || "").replace(/[\\/]+/g, " ").trim();
        if (!cleaned) return "";
        return encodeURIComponent(cleaned);
      }
      function joinEncodedPath(basePath) {
        var out = String(basePath || "").replace(/\/+$/g, "");
        for (var i = 1; i < arguments.length; i += 1) {
          var encoded = encodePathSegment(arguments[i]);
          if (!encoded) continue;
          out += "/" + encoded;
        }
        return out;
      }
      function decodePathSegmentSafe(value) {
        var raw = String(value || "");
        try { return decodeURIComponent(raw); } catch (err) { return raw; }
      }
      function normalizeAudioNameToken(value) {
        return String(value || "")
          .replace(/\.mp3$/i, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/&/g, " et ")
          .replace(/[’`´']/g, "")
          .replace(/[‐‑‒–—−-]/g, " ")
          .replace(/\u00A0/g, " ")
          .replace(/[^a-z0-9\s]/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }
      function stripProvisoire(text) {
        return String(text || "")
          .replace(/\s*\(\s*provisoire\s*\)\s*/i, " ")
          .replace(/\s*-\s*provisoire\b/i, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      function getDbusFisLineFolderName(line, route) {
        var parsed = String(parseRouteName(route && route.name).lineNumber || "").trim();
        var fallback = String(getLineNumber(line, route) || (line && line.number) || "").trim();
        var raw = parsed || fallback;
        return raw
          .replace(/\s*\([^)]*\)\s*/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      function getDbusFisLineCode(line, route) {
        var parsed = String(parseRouteName(route && route.name).lineNumber || "").trim();
        var fallback = String(getLineNumber(line, route) || (line && line.number) || "").trim();
        var raw = (parsed || fallback)
          .replace(/\s+/g, "")
          .replace(/[^0-9a-z_-]/gi, "")
          .trim();
        return raw;
      }
      function getSaeivDepartureClipCandidates(line, route) {
        var rawLineLabel = String(getDbusFisLineFolderName(line, route) || "").replace(/\s+/g, " ").trim();
        var lineCode = String(getDbusFisLineCode(line, route) || "").trim();
        var candidates = [];
        if (rawLineLabel) {
          candidates.push("Départ_" + rawLineLabel);
          candidates.push("Depart_" + rawLineLabel);
        }
        if (lineCode) {
          candidates.push("Départ_" + lineCode);
          candidates.push("Depart_" + lineCode);
        }
        candidates.push("Départ");
        candidates.push("Depart");
        var out = [];
        var seen = new Set();
        candidates.forEach(function (name) {
          var text = String(name || "").trim();
          if (!text) return;
          var key = normalizeAudioNameToken(text);
          if (!key || seen.has(key)) return;
          seen.add(key);
          out.push(text);
        });
        return out;
      }
      function resolveSaeivDepartureClipName(files, line, route) {
        var names = Array.isArray(files) ? files : [];
        var byToken = new Map();
        names.forEach(function (name) {
          var token = normalizeAudioNameToken(name);
          if (!token || byToken.has(token)) return;
          byToken.set(token, String(name || "").trim());
        });
        var candidates = getSaeivDepartureClipCandidates(line, route);
        for (var i = 0; i < candidates.length; i += 1) {
          var token = normalizeAudioNameToken(candidates[i]);
          if (!token) continue;
          var exact = String(byToken.get(token) || "").trim();
          if (exact) return exact;
        }
        return "";
      }
      function linePreviewAudioClipUrl(folderPath, clipName) {
        return joinEncodedPath(folderPath, String(clipName || "").trim() + ".mp3");
      }
      function loadDbusFisIndex() {
        if (dbusFisIndex) return Promise.resolve(dbusFisIndex);
        if (dbusFisIndexPromise) return dbusFisIndexPromise;
        dbusFisIndexPromise = fetch("./map_files/dbus_fis_index.json", { cache: "no-store" })
          .then(function (res) {
            if (!res || !res.ok) return {};
            return res.json();
          })
          .then(function (data) {
            dbusFisIndex = (data && typeof data === "object") ? data : {};
            return dbusFisIndex;
          })
          .catch(function () {
            dbusFisIndex = {};
            return dbusFisIndex;
          });
        return dbusFisIndexPromise;
      }
      function listDirectoryEntriesFromIndex(path) {
        return loadDbusFisIndex().then(function (index) {
          var clean = String(path || "")
            .replace(/^\.?\//, "")
            .replace(/^map_files\/dbus_fis\/?/i, "")
            .replace(/\/+$/g, "");
          if (!clean) {
            return Object.keys(index).map(function (name) { return { name: name, isDirectory: true }; });
          }
          var parts = clean.split("/").map(decodePathSegmentSafe).filter(Boolean);
          var node = index;
          for (var i = 0; i < parts.length; i += 1) {
            var p = parts[i];
            if (!node || typeof node !== "object" || !Object.prototype.hasOwnProperty.call(node, p)) return [];
            node = node[p];
          }
          if (!node || typeof node !== "object") return [];
          var out = [];
          Object.keys(node).forEach(function (key) {
            if (key === "_files") return;
            out.push({ name: key, isDirectory: true });
          });
          if (Array.isArray(node._files)) {
            node._files.forEach(function (fileName) {
              out.push({ name: String(fileName || "") + ".mp3", isDirectory: false });
            });
          }
          return out;
        });
      }
      function listDirectorySubfolders(path) {
        return listDirectoryEntriesFromIndex(path).then(function (entries) {
          return entries
            .filter(function (entry) { return !!(entry && entry.isDirectory); })
            .map(function (entry) { return String(entry.name || "").trim(); })
            .filter(Boolean);
        });
      }
      function listDirectoryMp3BaseNames(path) {
        return listDirectoryEntriesFromIndex(path).then(function (entries) {
          return entries
            .filter(function (entry) { return entry && !entry.isDirectory && /\.mp3$/i.test(String(entry.name || "")); })
            .map(function (entry) { return String(entry.name || "").replace(/\.mp3$/i, "").trim(); })
            .filter(Boolean);
        });
      }
      function buildSaeivRouteAudioTokenMap(files) {
        var byToken = new Map();
        (Array.isArray(files) ? files : []).forEach(function (name) {
          var clipName = String(name || "").trim();
          if (!clipName) return;
          var token = normalizeAudioNameToken(clipName);
          if (!token || byToken.has(token)) return;
          byToken.set(token, clipName);
        });
        return byToken;
      }
      function collectRouteRequiredStopTokens(entries) {
        var out = new Set();
        var terminusToken = normalizeAudioNameToken("Terminus");
        if (terminusToken) out.add(terminusToken);
        (Array.isArray(entries) ? entries : []).forEach(function (entry) {
          var rawName = String(entry && entry.name || "").trim();
          if (!rawName) return;
          var clean = stripProvisoire(rawName) || rawName;
          var token = normalizeAudioNameToken(clean);
          if (token) out.add(token);
        });
        return out;
      }
      function stopSaeivRouteAudioPlayback() {
        saeivRouteAudio.playbackToken += 1;
        saeivRouteAudio.queue = [];
        saeivRouteAudio.playing = false;
        saeivRouteAudio.preparePromise = null;
        saeivRouteAudio.currentClipName = "";
        saeivRouteAudio.currentClipEndedHooks = [];
        if (saeivRouteAudio.terminusAudio) {
          try { saeivRouteAudio.terminusAudio.pause(); } catch (err0) { }
          try { saeivRouteAudio.terminusAudio.src = ""; } catch (err1) { }
        }
        saeivRouteAudio.terminusAudio = null;
        saeivRouteAudio.terminusClipName = "";
        if (saeivRouteAudio.audio) {
          try { saeivRouteAudio.audio.pause(); } catch (err) { }
          try { saeivRouteAudio.audio.src = ""; } catch (err2) { }
        }
        saeivRouteAudio.audio = null;
      }
      function primeSaeivTerminusAudio(clipName) {
        var safeName = String(clipName || "").trim();
        if (!safeName || !saeivRouteAudio.available) return false;
        safeName = findSaeivAudioClipName(safeName);
        if (!safeName) return false;
        var url = linePreviewAudioClipUrl(saeivRouteAudio.folderPath, safeName);
        var audio = new Audio(url);
        audio.volume = getGlobalAudioVolumeFactor();
        audio.preload = "auto";
        try { audio.load(); } catch (err) { }
        saeivRouteAudio.terminusClipName = safeName;
        saeivRouteAudio.terminusAudio = audio;
        return true;
      }
      function processSaeivRouteAudioQueue() {
        if (saeivRouteAudio.playing) return;
        if (!saeivRouteAudio.available) return;
        var nextEntry = saeivRouteAudio.queue.shift();
        if (!nextEntry) return;
        var next = (typeof nextEntry === "string")
          ? { clipName: nextEntry, onEnded: null }
          : nextEntry;
        var nextClip = String(next && next.clipName || "").trim();
        if (!nextClip) {
          processSaeivRouteAudioQueue();
          return;
        }
        nextClip = findSaeivAudioClipName(nextClip);
        if (!nextClip) {
          processSaeivRouteAudioQueue();
          return;
        }
        var onEnded = typeof (next && next.onEnded) === "function" ? next.onEnded : null;
        var url = linePreviewAudioClipUrl(saeivRouteAudio.folderPath, nextClip);
        var token = saeivRouteAudio.playbackToken + 1;
        saeivRouteAudio.playbackToken = token;
        var audio = new Audio(url);
        audio.volume = getGlobalAudioVolumeFactor();
        saeivRouteAudio.audio = audio;
        saeivRouteAudio.playing = true;
        saeivRouteAudio.currentClipName = nextClip;
        saeivRouteAudio.currentClipEndedHooks = [];
        var finished = false;
        var finish = function () {
          if (finished) return;
          finished = true;
          if (token !== saeivRouteAudio.playbackToken) return;
          saeivRouteAudio.playing = false;
          saeivRouteAudio.audio = null;
          var hooks = Array.isArray(saeivRouteAudio.currentClipEndedHooks)
            ? saeivRouteAudio.currentClipEndedHooks.slice()
            : [];
          saeivRouteAudio.currentClipEndedHooks = [];
          saeivRouteAudio.currentClipName = "";
          if (onEnded) {
            try { onEnded(); } catch (errOnEnded) { }
          }
          hooks.forEach(function (hook) {
            if (typeof hook !== "function") return;
            try { hook(); } catch (errHook) { }
          });
          processSaeivRouteAudioQueue();
        };
        audio.onended = finish;
        audio.onerror = finish;
        // audio.onpause = finish; // Removed to allow resume after pause/menu
        audio.play().catch(finish);
      }
      function syncSaeivAudioPauseState() {
        var shouldMute = (typeof managerState !== "undefined" && managerState.visible) || (typeof telemetryPaused !== "undefined" && telemetryPaused);
        var audio = saeivRouteAudio.audio;
        if (!audio) return;
        if (shouldMute) {
          if (!audio.paused) {
            try { audio.pause(); } catch (err) { }
          }
        } else {
          if (audio.paused && saeivRouteAudio.playing) {
            audio.play().catch(function (err) { });
          }
        }
      }

      function syncWidgetsPauseState() {
        var isManagerVisible = (typeof managerState !== "undefined" && managerState.visible);
        var isTelemetryPaused = (typeof telemetryPaused !== "undefined" && telemetryPaused);
        var isPaused = isManagerVisible || isTelemetryPaused;
        if (typeof windowNodeByType === "undefined") return;
        Object.keys(windowNodeByType).forEach(function (type) {
          var node = windowNodeByType[type];
          if (node) {
            var iframe = node.querySelector("iframe");
            if (iframe && iframe.contentWindow) {
              // Passenger boarding/alighting must keep running while widget manager is open.
              // For bus_status, only the telemetry pause is propagated.
              var pausedForWidget = (String(type || "") === "bus_status") ? isTelemetryPaused : isPaused;
              iframe.contentWindow.postMessage({
                scope: "idf_game_widget_bridge_v1",
                type: 'game_pause_state',
                paused: pausedForWidget,
                pausedByManager: !!isManagerVisible,
                pausedByTelemetry: !!isTelemetryPaused
              }, '*');
            }
          }
        });
      }

      function updateSaeivSimulationPauseState() {
        var shouldPause = (typeof managerState !== "undefined" && managerState.visible) || (typeof telemetryPaused !== "undefined" && telemetryPaused);
        var isActuallyPaused = saeivIrlPauseStartAtMs > 0;

        if (shouldPause && !isActuallyPaused) {
          saeivIrlPauseStartAtMs = Date.now();
        } else if (!shouldPause && isActuallyPaused) {
          saeivIrlPauseTotalMs += (Date.now() - saeivIrlPauseStartAtMs);
          saeivIrlPauseStartAtMs = 0;
        }

        // syncSaeivAudioPauseState();
        syncWidgetsPauseState();
      }
      function enqueueSaeivRouteAudioClip(clipName, options) {
        var safeName = String(clipName || "").trim();
        if (!safeName || !saeivRouteAudio.available) return false;
        safeName = findSaeivAudioClipName(safeName);
        if (!safeName) return false;
        var opts = options && typeof options === "object" ? options : {};
        var onEnded = typeof opts.onEnded === "function" ? opts.onEnded : null;
        saeivRouteAudio.queue.push({
          clipName: safeName,
          onEnded: onEnded
        });
        processSaeivRouteAudioQueue();
        return true;
      }
      function playSaeivRouteAudioClipImmediate(clipName) {
        var safeName = String(clipName || "").trim();
        if (!safeName || !saeivRouteAudio.available) return false;
        safeName = findSaeivAudioClipName(safeName);
        if (!safeName) return false;
        // Hard-cut current/queued announcements to keep exact timing.
        var token = saeivRouteAudio.playbackToken + 1;
        saeivRouteAudio.playbackToken = token;
        saeivRouteAudio.queue = [];
        saeivRouteAudio.playing = false;
        if (saeivRouteAudio.audio) {
          try { saeivRouteAudio.audio.pause(); } catch (err) { }
          try { saeivRouteAudio.audio.src = ""; } catch (err2) { }
        }
        var audio = null;
        if (
          saeivRouteAudio.terminusAudio &&
          String(saeivRouteAudio.terminusClipName || "") === safeName
        ) {
          var src = String(saeivRouteAudio.terminusAudio.currentSrc || saeivRouteAudio.terminusAudio.src || "").trim();
          if (src) {
            audio = new Audio(src);
            audio.volume = getGlobalAudioVolumeFactor();
          }
        }
        if (!audio) {
          audio = new Audio(linePreviewAudioClipUrl(saeivRouteAudio.folderPath, safeName));
          audio.volume = getGlobalAudioVolumeFactor();
        }
        saeivRouteAudio.audio = audio;
        saeivRouteAudio.playing = true;
        saeivRouteAudio.currentClipName = safeName;
        saeivRouteAudio.currentClipEndedHooks = [];
        var finish = function () {
          if (token !== saeivRouteAudio.playbackToken) return;
          saeivRouteAudio.playing = false;
          saeivRouteAudio.audio = null;
          saeivRouteAudio.currentClipName = "";
          saeivRouteAudio.currentClipEndedHooks = [];
          processSaeivRouteAudioQueue();
        };
        audio.onended = finish;
        audio.onerror = finish;
        // audio.onpause = finish; // Removed to allow resume after pause/menu
        audio.play().catch(finish);
        return true;
      }
      function cancelSaeivTerminusAnnouncement() {
        if (saeivTerminusAnnounceTimer) {
          clearTimeout(saeivTerminusAnnounceTimer);
          saeivTerminusAnnounceTimer = 0;
        }
      }
      function findSaeivAudioClipName(clipName) {
        if (!saeivRouteAudio.available || !saeivRouteAudio.filesByToken) return "";
        var token = normalizeAudioNameToken(clipName);
        if (!token) return "";
        return String(saeivRouteAudio.filesByToken.get(token) || "").trim();
      }
      function findSaeivTerminusClipName() {
        return findSaeivAudioClipName("Terminus");
      }
      function findSaeivDepartureClipName() {
        var explicit = String(saeivRouteAudio.departureClipName || "").trim();
        if (explicit) {
          var explicitClip = findSaeivAudioClipName(explicit);
          if (explicitClip) return explicitClip;
        }
        if (!saeivRouteAudio.available || !saeivRouteAudio.filesByToken) return "";
        var primaryToken = normalizeAudioNameToken("Départ");
        var fallbackToken = normalizeAudioNameToken("Depart");
        if (primaryToken) {
          var primaryClip = String(saeivRouteAudio.filesByToken.get(primaryToken) || "").trim();
          if (primaryClip) return primaryClip;
        }
        if (fallbackToken) {
          var fallbackClip = String(saeivRouteAudio.filesByToken.get(fallbackToken) || "").trim();
          if (fallbackClip) return fallbackClip;
        }
        return "";
      }
      function findSaeivStopClipName(entry) {
        if (!entry) return "";
        var rawName = String(entry.name || "").trim();
        if (!rawName) return "";
        var cleanName = stripProvisoire(rawName) || rawName;
        return findSaeivAudioClipName(cleanName);
      }
      function isSaeivHudWidgetTypeActive(type) {
        var safeType = (typeof normalizeWidgetType === "function")
          ? normalizeWidgetType(type)
          : String(type || "").trim();
        if (!safeType) return false;
        if (typeof findWidgetIdByType === "function" && findWidgetIdByType(safeType)) return true;
        try {
          return !!document.querySelector('[data-widget-type="' + safeType + '"]');
        } catch (err) {
          return false;
        }
      }
      function shouldAutoPlaySaeivDestinationOnSelection() {
        return isSaeivHudWidgetTypeActive("saeiv");
      }
      function shouldAutoPlaySaeivDestinationOnStart() {
        return isSaeivHudWidgetTypeActive("saeiv_mini") && !isSaeivHudWidgetTypeActive("saeiv");
      }
      function scheduleSaeivDestinationAnnouncementWhenAudioReady(routeKey) {
        var expectedKey = String(routeKey || (saeivRouteState && saeivRouteState.selectedKey) || "").trim();
        if (!expectedKey) return false;
        var playWhenCurrent = function () {
          if (!saeivRouteState || typeof saeivRouteState !== "object") return false;
          if (String(saeivRouteState.selectedKey || "").trim() !== expectedKey) return false;
          return playSaeivDestinationAnnouncementIfAvailable({
            action: "game-destination-announcement-auto",
            requireShortcutContext: false
          });
        };
        var preparePromise = saeivRouteAudio && saeivRouteAudio.preparePromise;
        if (preparePromise && typeof preparePromise.then === "function") {
          preparePromise
            .then(function () {
              setTimeout(playWhenCurrent, 0);
            })
            .catch(function () { });
          return true;
        }
        setTimeout(playWhenCurrent, 0);
        return true;
      }
      function chainSaeivAudioEndCallback(existing, appended) {
        if (typeof appended !== "function") return existing;
        if (typeof existing !== "function") return appended;
        return function () {
          try { existing(); } catch (errExisting) { }
          try { appended(); } catch (errAppended) { }
        };
      }
      function attachSaeivAudioEndCallbackForClip(clipName, callback) {
        var safeClip = String(clipName || "").trim();
        if (!safeClip || typeof callback !== "function") return false;
        if (saeivRouteAudio.playing && String(saeivRouteAudio.currentClipName || "") === safeClip) {
          if (!Array.isArray(saeivRouteAudio.currentClipEndedHooks)) {
            saeivRouteAudio.currentClipEndedHooks = [];
          }
          saeivRouteAudio.currentClipEndedHooks.push(callback);
          return true;
        }
        var queue = Array.isArray(saeivRouteAudio.queue) ? saeivRouteAudio.queue : [];
        for (var i = 0; i < queue.length; i += 1) {
          var item = queue[i];
          var clip = "";
          if (typeof item === "string") {
            clip = String(item || "").trim();
          } else {
            clip = String(item && item.clipName || "").trim();
          }
          if (!clip || clip !== safeClip) continue;
          var normalized = (typeof item === "string")
            ? { clipName: clip, onEnded: null }
            : item;
          normalized.onEnded = chainSaeivAudioEndCallback(normalized.onEnded, callback);
          queue[i] = normalized;
          return true;
        }
        return false;
      }
      function scheduleSaeivTerminusAnnouncement(terminusEntry) {
        if (!terminusEntry || !Number.isFinite(Number(terminusEntry.uid))) return false;
        if (!saeivRouteState || typeof saeivRouteState !== "object") return false;
        var routeKey = String(saeivRouteState.selectedKey || "");
        if (!routeKey) return false;
        if (saeivTerminusAnnouncedRouteKey === routeKey) return false;
        if (saeivTerminusAnnounceTimer) return true;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (!entries.length) return false;
        var lastEntry = entries[entries.length - 1] || null;
        if (!lastEntry || String(lastEntry.uid || "") !== String(terminusEntry.uid || "")) return false;
        var clipName = findSaeivTerminusClipName();
        if (!clipName) return false;
        cancelSaeivTerminusAnnouncement();
        saeivTerminusAnnounceTimer = setTimeout(function () {
          saeivTerminusAnnounceTimer = 0;
          if (!saeivRouteState || typeof saeivRouteState !== "object") return;
          var liveRouteKey = String(saeivRouteState.selectedKey || "");
          if (!liveRouteKey || liveRouteKey !== routeKey) return;
          if (saeivTerminusAnnouncedRouteKey === routeKey) return;
          var played = playSaeivRouteAudioClipImmediate(clipName);
          if (!played) return;
          saeivTerminusAnnouncedRouteKey = routeKey;
          cancelSaeivTerminusAnnouncement();
        }, Math.max(0, Number(SAEIV_TERMINUS_ANNOUNCE_DELAY_MS) || 0));
        return true;
      }
      function isSaeivAudioStyleLikelyMatchingCurrentRoute() {
        if (!saeivRouteState || typeof saeivRouteState !== "object") return false;
        var selectedKey = String(saeivRouteState.selectedKey || "").trim();
        var audioRouteKey = String(saeivRouteAudio.routeKey || "").trim();
        if (!selectedKey || !audioRouteKey || selectedKey !== audioRouteKey) return false;
        var routeLineNumber = String(saeivRouteState.lineNumber || "").trim();
        if (!routeLineNumber) {
          routeLineNumber = String(parseRouteName(saeivRouteState.routeName).lineNumber || "").trim();
        }
        var lineToken = normalizeAudioNameToken(routeLineNumber);
        if (!lineToken) return true;
        var styleToken = normalizeAudioNameToken(saeivRouteAudio.styleName);
        var folderToken = normalizeAudioNameToken(saeivRouteAudio.folderPath);
        if (styleToken && (styleToken === lineToken || styleToken.indexOf(lineToken) !== -1)) return true;
        if (folderToken && (folderToken === lineToken || folderToken.indexOf(lineToken) !== -1)) return true;
        return false;
      }
      function playSaeivDestinationAnnouncementIfAvailable(options) {
        var opts = options && typeof options === "object" ? options : {};
        if (opts.requireShortcutContext !== false && (managerState.visible || telemetryPaused || !telemetryConnected)) return false;
        if (!saeivRouteState || typeof saeivRouteState !== "object") return false;
        var activeRouteKey = String(saeivRouteState.selectedKey || "").trim();
        if (!activeRouteKey) return false;
        if (String(saeivRouteAudio.routeKey || "").trim() !== activeRouteKey) return false;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (!entries.length || !saeivRouteAudio.available) return false;
        if (saeivRouteAudio.playing || (Array.isArray(saeivRouteAudio.queue) && saeivRouteAudio.queue.length > 0)) {
          return false;
        }
        var lastEntry = entries[entries.length - 1] || null;
        var departureClip = findSaeivDepartureClipName();
        var destinationClip = findSaeivStopClipName(lastEntry);
        if (!departureClip || !destinationClip) return false;
        var clips = [];
        clips.push(departureClip);
        clips.push(destinationClip);
        for (var i = 0; i < clips.length; i += 1) {
          if (!enqueueSaeivRouteAudioClip(clips[i])) return false;
        }
        saeivLastAction = String(opts.action || "game-destination-announcement-shortcut");
        syncSaeivExternalState(true);
        return true;
      }
      function triggerSaeivDestinationAnnouncementFromShortcut() {
        return playSaeivDestinationAnnouncementIfAvailable({
          action: "game-destination-announcement-shortcut",
          requireShortcutContext: true
        });
      }
      function listDbusFisRouteStyleFoldersFromDossiers() {
        var rootPath = ensureTrailingSlash(DBUS_FIS_DOSSIERS_ROOT);
        var folders = [];
        return listDirectoryMp3BaseNames(rootPath)
          .then(function (rootClips) {
            if (rootClips.length) {
              folders.push({ name: ".", path: rootPath, files: rootClips });
            }
            return listDirectorySubfolders(rootPath);
          })
          .then(function (subfolders) {
            var chain = Promise.resolve();
            subfolders.forEach(function (subfolderName) {
              chain = chain.then(function () {
                var folderPath = ensureTrailingSlash(joinEncodedPath(rootPath, subfolderName));
                return listDirectoryMp3BaseNames(folderPath).then(function (files) {
                  if (!files.length) return;
                  folders.push({ name: subfolderName, path: folderPath, files: files });
                });
              });
            });
            return chain;
          })
          .then(function () {
            return folders;
          });
      }
      function prepareSaeivRouteAudio(line, route, entries) {
        var routeKey = String(line && line.uid || "") + ":" + String(route && route.uid || "");
        stopSaeivRouteAudioPlayback();
        saeivRouteAudio.routeKey = routeKey;
        saeivRouteAudio.styleName = "";
        saeivRouteAudio.folderPath = "";
        saeivRouteAudio.available = false;
        saeivRouteAudio.filesByToken = new Map();
        saeivRouteAudio.departureClipName = "";
        var requiredTokens = collectRouteRequiredStopTokens(entries);
        var lineFolderName = String(getDbusFisLineFolderName(line, route) || "").trim();
        var routeLineToken = normalizeAudioNameToken(lineFolderName);
        return listDbusFisRouteStyleFoldersFromDossiers()
          .then(function (folders) {
            if (!folders.length) return null;
            var best = null;
            var bestLineMatched = null;
            folders.forEach(function (folder) {
              var files = Array.isArray(folder && folder.files) ? folder.files : [];
              if (!files.length) return;
              var byToken = buildSaeivRouteAudioTokenMap(files);
              var matchCount = 0;
              requiredTokens.forEach(function (token) {
                if (byToken.has(token)) matchCount += 1;
              });
              var score = (matchCount * 1000) - (files.length - matchCount);
              var candidate = {
                score: score,
                matchCount: matchCount,
                byToken: byToken,
                files: files.slice(),
                folderPath: ensureTrailingSlash(String(folder.path || "")),
                styleName: String(folder.name || "."),
                lineMatched: false
              };
              if (routeLineToken) {
                var styleToken = normalizeAudioNameToken(candidate.styleName);
                var folderToken = normalizeAudioNameToken(candidate.folderPath);
                candidate.lineMatched =
                  (!!styleToken && (styleToken === routeLineToken || styleToken.indexOf(routeLineToken) !== -1)) ||
                  (!!folderToken && (folderToken === routeLineToken || folderToken.indexOf(routeLineToken) !== -1));
              }
              if (!best || candidate.score > best.score) best = candidate;
              if (candidate.lineMatched) {
                if (!bestLineMatched || candidate.score > bestLineMatched.score) bestLineMatched = candidate;
              }
            });
            if (bestLineMatched) return bestLineMatched;
            return best;
          })
          .then(function (best) {
            if (!best || best.matchCount <= 0) return false;
            if (saeivRouteAudio.routeKey !== routeKey) return false;
            saeivRouteAudio.styleName = best.styleName;
            saeivRouteAudio.folderPath = best.folderPath;
            saeivRouteAudio.available = true;
            saeivRouteAudio.filesByToken = best.byToken;
            saeivRouteAudio.departureClipName = resolveSaeivDepartureClipName(best.files, line, route);
            var terminusToken = normalizeAudioNameToken("Terminus");
            var terminusClip = terminusToken ? String(best.byToken.get(terminusToken) || "").trim() : "";
            saeivRouteAudio.terminusClipName = terminusClip;
            saeivRouteAudio.terminusAudio = null;
            if (terminusClip) {
              primeSaeivTerminusAudio(terminusClip);
            }
            saeivLastStateKey = "";
            syncSaeivExternalState(true);
            return true;
          })
          .catch(function () {
            return false;
          });
      }
      function fetchXmlDoc(path) {
        return fetch(path, { cache: "no-store" })
          .then(function (res) {
            if (!res || !res.ok) throw new Error("XML load failed: " + path);
            return res.text();
          })
          .then(function (txt) {
            return new DOMParser().parseFromString(txt, "text/xml");
          });
      }
      function parseDbusStopsXml(xml) {
        var out = new Map();
        var nodes = Array.prototype.slice.call((xml && xml.querySelectorAll) ? xml.querySelectorAll("busstops > busstop") : []);
        nodes.forEach(function (node) {
          var id = parseInt(String((node.querySelector("id") && node.querySelector("id").textContent) || "0").trim(), 10);
          if (!Number.isFinite(id)) return;
          var name = String((node.querySelector("name") && node.querySelector("name").textContent) || "").trim();
          var locRaw = String((node.querySelector("location") && node.querySelector("location").textContent) || "").trim();
          var parts = locRaw.split(";").map(function (part) { return parseFloat(part); });
          var X = Number(parts[0]);
          var Y = Number(parts[1]);
          var Z = Number(parts[2]);
          var Heading = Number(parts[3]);
          if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) return;
          out.set(id, {
            id: id,
            name: name,
            X: X,
            Y: Y,
            Z: Z,
            Heading: Number.isFinite(Heading) ? (Heading * 180 / Math.PI) : undefined
          });
        });
        return out;
      }
      function parseDbusLinesXml(xml) {
        var seenLineUids = new Map();
        var lineNodes = Array.prototype.slice.call((xml && xml.querySelectorAll) ? xml.querySelectorAll("lines > line") : []);
        return lineNodes.map(function (lineNode, lineIndex) {
          var rawUid = String(lineNode.getAttribute("uid") || "").trim();
          var number = String(lineNode.getAttribute("number") || "?").trim() || "?";
          var uidBase = rawUid || ("line_" + String(lineIndex));
          var seenCount = (seenLineUids.get(uidBase) || 0) + 1;
          seenLineUids.set(uidBase, seenCount);
          var safeNumber = number
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "_")
            .replace(/^_+|_+$/g, "") || "line";
          var lineUid = seenCount === 1 ? uidBase : (uidBase + "__" + safeNumber + "__" + String(lineIndex));
          var routeNodes = Array.prototype.slice.call(lineNode.querySelectorAll(":scope > route"));
          var routes = routeNodes.map(function (routeNode) {
            var routeUid = String(routeNode.getAttribute("uid") || "").trim();
            var routeName = String(routeNode.getAttribute("name") || "").trim();
            var stopNodes = Array.prototype.slice.call(routeNode.querySelectorAll(":scope > busstop"));
            var stops = stopNodes.map(function (stopNode) {
              var stopId = parseInt(String(stopNode.getAttribute("uid") || "0"), 10);
              var nextStopTime = parseInt(String(stopNode.getAttribute("nextStopTime") || "0"), 10);
              var passengersMin = parseFloat(String(stopNode.getAttribute("passengersMin") || "NaN"));
              var passengersMax = parseFloat(String(stopNode.getAttribute("passengersMax") || "NaN"));
              var coefOn = parseFloat(String(stopNode.getAttribute("coefOn") || "NaN"));
              return {
                uid: stopId,
                nextStopTime: Number.isFinite(nextStopTime) ? nextStopTime : 0,
                passengersMin: Number.isFinite(passengersMin) ? passengersMin : Number.NaN,
                passengersMax: Number.isFinite(passengersMax) ? passengersMax : Number.NaN,
                coefOn: Number.isFinite(coefOn) ? coefOn : Number.NaN
              };
            }).filter(function (stopRef) {
              return Number.isFinite(stopRef.uid);
            });
            var totalMinutes = stops.reduce(function (sum, stopRef) {
              return sum + (Number(stopRef.nextStopTime) || 0);
            }, 0);
            return {
              uid: routeUid,
              name: routeName,
              stops: stops,
              totalMinutes: totalMinutes
            };
          });
          return {
            uid: lineUid,
            uidRaw: rawUid,
            number: number,
            routes: routes
          };
        });
      }
      function loadDbusDataForVersion(version) {
        var safeVersion = String(version || "").trim();
        if (!safeVersion) return Promise.reject(new Error("version_missing"));
        var basePath = "./map_files/" + safeVersion + "/DBus/IDF%20MAP";
        return Promise.all([
          fetchXmlDoc(basePath + "/stops.xml"),
          fetchXmlDoc(basePath + "/lines.xml")
        ]).then(function (list) {
          return {
            version: safeVersion,
            stops: parseDbusStopsXml(list[0]),
            lines: parseDbusLinesXml(list[1])
          };
        });
      }
      function ensureDbusDataLoaded() {
        if (dbusLoadPromise) return dbusLoadPromise;
        if (dbusStopsById.size && dbusLines.length) {
          return Promise.resolve({
            version: dbusDataVersion,
            stops: dbusStopsById,
            lines: dbusLines
          });
        }
        dbusLoadPromise = loadBestNavGraphVersion()
          .then(function (bestVersion) {
            var candidates = [];
            var primary = String(bestVersion || "").trim();
            if (primary) candidates.push(primary);
            if (candidates.indexOf(DBUS_GAME_FALLBACK_VERSION) === -1) {
              candidates.push(DBUS_GAME_FALLBACK_VERSION);
            }
            function tryVersion(index) {
              if (index >= candidates.length) throw new Error("dbus_data_unavailable");
              return loadDbusDataForVersion(candidates[index]).catch(function () {
                return tryVersion(index + 1);
              });
            }
            return tryVersion(0);
          })
          .then(function (loaded) {
            dbusDataVersion = String(loaded.version || "");
            dbusStopsById = loaded.stops instanceof Map ? loaded.stops : new Map();
            dbusLines = Array.isArray(loaded.lines) ? loaded.lines : [];
            return {
              version: dbusDataVersion,
              stops: dbusStopsById,
              lines: dbusLines
            };
          })
          .catch(function (err) {
            dbusLoadPromise = null;
            throw err;
          });
        return dbusLoadPromise;
      }
      function getRouteStopEntries(route) {
        var refs = Array.isArray(route && route.stops) ? route.stops : [];
        var out = [];
        refs.forEach(function (stopRef, index) {
          var stopId = Number(stopRef && stopRef.uid);
          if (!Number.isFinite(stopId)) return;
          var stop = dbusStopsById.get(stopId);
          if (!stop) return;
          var X = Number(stop.X);
          var Y = Number(stop.Y);
          var Z = Number(stop.Z);
          if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) return;
          var name = String(stop.name || ("Arret " + String(index + 1))).trim();
          out.push({
            uid: stopId,
            name: name,
            X: X,
            Y: Y,
            Z: Z,
            stopHeading: stop.Heading,
            point: { x: X, y: Y, z: Z },
            nextStopTime: Number(stopRef && stopRef.nextStopTime) || 0,
            passengersMin: Number(stopRef && stopRef.passengersMin),
            passengersMax: Number(stopRef && stopRef.passengersMax),
            coefOn: Number(stopRef && stopRef.coefOn)
          });
        });
        applyNavStopLinksToEntries(out);
        return out;
      }
      function clampRouteStopIndex(value, lastIndex) {
        var n = Number(value);
        if (!Number.isFinite(n)) n = 0;
        if (!Number.isFinite(lastIndex) || lastIndex < 0) return 0;
        return Math.max(0, Math.min(lastIndex, Math.floor(n)));
      }
      function clampReachedStopIndex(value, lastIndex) {
        var n = Number(value);
        if (!Number.isFinite(n)) n = -1;
        if (!Number.isFinite(lastIndex) || lastIndex < 0) return -1;
        return Math.max(-1, Math.min(lastIndex, Math.floor(n)));
      }
      function setSaeivStoppedAtStop(index, entries) {
        var lastIndex = Math.max(0, (Array.isArray(entries) ? entries.length : 0) - 1);
        var nextIndex = clampReachedStopIndex(index, lastIndex);
        var nextUid = "";
        if (nextIndex >= 0 && Array.isArray(entries) && entries[nextIndex]) {
          nextUid = String(entries[nextIndex].uid || "");
        }
        var changed = (nextIndex !== saeivStoppedAtStopIndex) || (nextUid !== saeivStoppedAtStopUid);
        saeivStoppedAtStopIndex = nextIndex;
        saeivStoppedAtStopUid = nextUid;
        return changed;
      }
      function getSaeivRouteStartStopInfo(signal) {
        var out = {
          valid: false,
          startEntry: null,
          distanceM: Number.NaN,
          atStartStop: false
        };
        if (!saeivRouteState || typeof saeivRouteState !== "object") return out;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (!entries.length) return out;
        var startEntry = entries[0] || null;
        if (!startEntry || !startEntry.point) return out;
        out.valid = true;
        out.startEntry = startEntry;
        var sig = signal && typeof signal === "object" ? signal : telemetryLastSignal;
        var x = Number(sig && sig.x);
        var y = Number(sig && sig.y);
        var z = Number(sig && sig.z);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          var dist = worldPointDistance({ x: x, y: y, z: z }, startEntry.point);
          out.distanceM = dist;
          out.atStartStop = Number.isFinite(dist) && dist <= SAEIV_STOP_REACH_DISTANCE;
        }
        return out;
      }
      function readSaeivSignalString(source, keys) {
        if (!source || typeof source !== "object" || !Array.isArray(keys)) return "";
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
          var value = source[key];
          if (value == null) continue;
          var text = String(value).trim();
          if (text) return text;
        }
        return "";
      }
      function readSaeivTelemetrySteamId(signal) {
        var source = signal && typeof signal === "object" ? signal : null;
        if (!source) return "";
        var keys = ["steamid", "steamId", "steamID", "steam_id", "idf_steamid", "idf_steam_id"];
        var direct = readSaeivSignalString(source, keys);
        if (direct) return direct;
        var player = source.player && typeof source.player === "object" ? source.player : null;
        var identity = source.identity && typeof source.identity === "object" ? source.identity : null;
        return readSaeivSignalString(player, keys) || readSaeivSignalString(identity, keys);
      }
      function updateTelemetryEstimatedSpeed(signal, sampleTs) {
        var nowTs = Number(sampleTs);
        if (!Number.isFinite(nowTs)) nowTs = Date.now();
        var x = Number(signal && signal.x);
        var y = Number(signal && signal.y);
        var z = Number(signal && signal.z);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          telemetrySpeedSample = null;
          telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
          telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
          return telemetryInstantSpeedKmh;
        }
        var previous = telemetrySpeedSample;
        telemetrySpeedSample = { x: x, y: y, z: z, ts: nowTs };
        if (!previous || !Number.isFinite(previous.ts)) {
          telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
          telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
          return telemetryInstantSpeedKmh;
        }
        var dtSec = (nowTs - previous.ts) / 1000;
        if (!Number.isFinite(dtSec) || dtSec <= 0) return telemetryInstantSpeedKmh;
        if (dtSec > TELEMETRY_SPEED_RESET_DT_SEC) {
          telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
          telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
          return telemetryInstantSpeedKmh;
        }
        var distanceM = Math.hypot(x - previous.x, y - previous.y, z - previous.z);
        if (!Number.isFinite(distanceM)) {
          telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
          return telemetryInstantSpeedKmh;
        }
        if (distanceM < TELEMETRY_SPEED_NOISE_DISTANCE_M) distanceM = 0;
        var instantKmh = (distanceM / dtSec) * 3.6;
        if (!Number.isFinite(instantKmh) || instantKmh < 0) {
          telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
          return telemetryInstantSpeedKmh;
        }
        telemetryInstantSpeedKmh = instantKmh;
        if (!Number.isFinite(telemetryEstimatedSpeedKmh)) {
          telemetryEstimatedSpeedKmh = instantKmh;
        } else {
          telemetryEstimatedSpeedKmh = (telemetryEstimatedSpeedKmh * 0.35) + (instantKmh * 0.65);
        }
        return telemetryInstantSpeedKmh;
      }
      function telemetrySpeedForStopDecision(instantSpeedKmh) {
        var instant = Number(instantSpeedKmh);
        var estimated = Number(telemetryEstimatedSpeedKmh);
        if (Number.isFinite(instant) && Number.isFinite(estimated)) return Math.min(instant, estimated);
        if (Number.isFinite(instant)) return instant;
        if (Number.isFinite(estimated)) return estimated;
        return Number.POSITIVE_INFINITY;
      }
      function announceStopArrivalOnce(entry, options) {
        if (!entry || !Number.isFinite(Number(entry.uid))) return false;
        var opts = options && typeof options === "object" ? options : {};
        var stopUid = Number(entry.uid);
        if (saeivAnnouncedStopUids.has(stopUid)) return false;
        var clipName = findSaeivStopClipName(entry);
        if (!clipName) {
          saeivAnnouncedStopUids.add(stopUid);
          return false;
        }
        var onPlayed = typeof opts.onPlayed === "function" ? opts.onPlayed : null;
        var onStopAnnouncementEnded = function () {
          saeivStopAnnounceEndedAtByUid.set(stopUid, Date.now());
          if (onPlayed) {
            try { onPlayed(); } catch (errOnPlayed) { }
          }
        };
        var queued = enqueueSaeivRouteAudioClip(clipName, {
          onEnded: onStopAnnouncementEnded
        });
        if (queued) saeivAnnouncedStopUids.add(stopUid);
        return queued;
      }
      function getNearestStopIndexFromPoint(worldPoint, entries) {
        if (!worldPoint || !Array.isArray(entries) || !entries.length) return 0;
        var bestIndex = 0;
        var bestDistance = Number.POSITIVE_INFINITY;
        for (var i = 0; i < entries.length; i += 1) {
          var entry = entries[i];
          var dist = worldPointDistance(worldPoint, entry && entry.point);
          if (!Number.isFinite(dist)) continue;
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = i;
          }
        }
        return bestIndex;
      }
      function computeSaeivStopHeadingDeg(entries, index, fallbackHeadingDeg) {
        var list = Array.isArray(entries) ? entries : [];
        var idx = Math.max(0, Math.min(Math.floor(Number(index) || 0), Math.max(0, list.length - 1)));
        var current = parseWorldPoint3D(list[idx] && list[idx].point);
        if (!current) return Number(fallbackHeadingDeg);
        var prev = idx > 0 ? parseWorldPoint3D(list[idx - 1] && list[idx - 1].point) : null;
        var next = idx < (list.length - 1) ? parseWorldPoint3D(list[idx + 1] && list[idx + 1].point) : null;
        var a = prev || current;
        var b = next || current;
        var dx = Number(b.x) - Number(a.x);
        var dy = Number(b.y) - Number(a.y);
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6)) {
          return Number(fallbackHeadingDeg);
        }
        // Heading in degrees using the same convention as telemetry (north_ccw-like).
        var heading = Math.atan2(dy, dx) * 180 / Math.PI;
        if (!Number.isFinite(heading)) return Number(fallbackHeadingDeg);
        return heading;
      }
      function buildSaeivStatePayloadFromGame() {
        var payload = {
          lang: "fr",
          canUseFeature: true,
          selected: false,
          lineSelected: false,
          routeSelected: false,
          dbusVersion: String(dbusDataVersion || ""),
          steamid: readSaeivTelemetrySteamId(telemetryLastSignal),
          selectedKey: "",
          selectedLineUid: "",
          selectedRouteUid: "",
          lineNumber: "",
          routeName: "",
          hasLinkedAudio: !!saeivRouteAudio.available,
          audioCurrentIndex: 0,
          audioStopNames: [],
          stopName: "",
          nextStopName: "",
          thirdStopName: "",
          currentStopLabel: "Prochain arrêt",
          distanceToDisplayStopM: Number.NaN,
          distanceToDisplayStopGpsM: Number.NaN,
          vehicleAtStop: false,
          vehicleAtStopIndex: -1,
          vehicleAtStopUid: "",
          departMinutes: "",
          refTime: getSaeivClockText(),
          clockNowMs: getSaeivNowTimestampMs(),
          timeSystem: normalizeSaeivTimeSystem(saeivTimeSystem),
          routeStopCount: 0,
          routeReachedIndex: -1,
          routeTargetIndex: 0,
          routeCompleted: false,
          routeWaitingStart: false,
          routeCanStart: false,
          routeStarted: false,
          startStopName: "",
          startStopDistanceM: Number.NaN,
          routeSelectedAtMs: 0,
          routeStartedAtMs: 0,
          routeTerminusReachedAtMs: 0,
          routeCompletedAtMs: 0,
          routePlannedTerminusAtMs: Number.NaN,
          routeActualTerminusAtMs: 0,
          routeElapsedMs: 0,
          routeLiveElapsedMs: 0,
          routeFinalDelayMinutes: Number.NaN,
          routeLiveDelayMinutes: Number.NaN,
          routeReachedStopsCount: 0,
          routeLateStopsCount: 0,
          routeMissedStopsCount: 0,
          routeTransportedPassengers: 0,
          vehicleName: "",
          busMaxCapacity: SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT,
          busMaxCapacityUnlimited: false,
          busMaxCapacityDisplay: String(SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT),
          passengersMin: Math.max(0, Number(saeivPassengerDefaults && saeivPassengerDefaults.passengersMin) || 0),
          passengersMax: Math.max(0, Number(saeivPassengerDefaults && saeivPassengerDefaults.passengersMax) || 0),
          coefOn: Math.max(0, Number(saeivPassengerDefaults && saeivPassengerDefaults.coefOn) || 0),
          passengersInBus: 0,
          passengersAtStop: 0,
          stopBoardingTotal: 0,
          stopBoardingDone: 0,
          stopAlightingTotal: 0,
          stopAlightingDone: 0,
          busStatusPassengerServiceLinked: false,
          busStatusPassengerServiceActive: false,
          busStatusPassengerServiceReady: false,
          busX: Number.NaN,
          busY: Number.NaN,
          busZ: Number.NaN,
          busHeading: Number.NaN,
          stopX: Number.NaN,
          stopY: Number.NaN,
          stopZ: Number.NaN,
          stopPrevX: Number.NaN,
          stopPrevZ: Number.NaN,
          stopNextX: Number.NaN,
          stopNextZ: Number.NaN,
          stopHeading: Number.NaN,
          stopRequested: false,
          stopNecessary: false,
          busSpeedKmh: (telemetryLastSignal && Number.isFinite(telemetryLastSignal.speedKmh)) ? telemetryLastSignal.speedKmh : 0,
          truckDamagePercent: (telemetryLastSignal && Number.isFinite(telemetryLastSignal.truckDamagePercent)) ? telemetryLastSignal.truckDamagePercent : 0,
          audioFolderPath: String(saeivRouteAudio.folderPath || ""),
          audioVoiceStyle: String(saeivRouteAudio.styleName || ""),
          globalAudioFolderPath: "",
          globalAudioLabels: [],
          globalAudioUrls: [],
          globalAudioCount: 0,
          globalAudioVolumeMultiplier: getGlobalAudioVolumeFactor(),
          passengerValidationSoundsEnabled: saeivPassengerValidationSoundsEnabled === true,
          passengerValidationSoundVolume: Math.max(0, Math.min(1, getGlobalAudioVolumeFactor() / 2)),
          audioPlaybackBusy: !!saeivRouteAudio.playing,
          lastAction: String(saeivLastAction || "")
        };
        var busSignalXVal = Number(telemetryLastSignal && telemetryLastSignal.x);
        var busSignalYVal = Number(telemetryLastSignal && telemetryLastSignal.y);
        var busSignalZVal = Number(telemetryLastSignal && telemetryLastSignal.z);
        var busSignalHeadingVal = Number(telemetryLastSignal && telemetryLastSignal.heading);
        if (Number.isFinite(busSignalXVal)) payload.busX = busSignalXVal;
        if (Number.isFinite(busSignalYVal)) payload.busY = busSignalYVal;
        if (Number.isFinite(busSignalZVal)) payload.busZ = busSignalZVal;
        if (Number.isFinite(busSignalHeadingVal)) payload.busHeading = busSignalHeadingVal;
        var runtimeVehicleName = String(
          saeivVehicleName ||
          (telemetryLastSignal && telemetryLastSignal.vehicleName) ||
          ""
        ).trim();
        payload.vehicleName = runtimeVehicleName;
        var runtimeActiveCapacity = getSaeivActiveCapacityState(runtimeVehicleName);
        payload.busMaxCapacity = Math.max(1, Math.round(Number(runtimeActiveCapacity.capacity) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT));
        payload.busMaxCapacityUnlimited = runtimeActiveCapacity.unlimited === true;
        payload.busMaxCapacityDisplay = String(runtimeActiveCapacity.display || payload.busMaxCapacity);
        var gpsComputedDistanceToStop = Number(lastWazeBridgePacket && lastWazeBridgePacket.distanceToCurrentStopM);
        if (Number.isFinite(gpsComputedDistanceToStop) && gpsComputedDistanceToStop >= 0) {
          payload.distanceToDisplayStopGpsM = gpsComputedDistanceToStop;
        }
        if (!saeivRouteState || typeof saeivRouteState !== "object") return payload;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (!entries.length) return payload;
        var names = entries.map(function (entry) { return String(entry && entry.name || "").trim(); }).filter(Boolean);
        if (!names.length) return payload;
        var lastIndex = Math.max(0, names.length - 1);
        var reachedIndex = clampReachedStopIndex(saeivRouteState.reachedIndex, lastIndex);
        var targetIndex = clampRouteStopIndex(saeivRouteState.targetIndex, lastIndex);
        // UI rule: while driving to next target stop, display that target as current.
        // This keeps the arrow after a passed stop instead of before it.
        var displayIndex = reachedIndex < 0 ? 0 : reachedIndex;
        // If vehicle is physically stopped at a stop, always keep this stop in UI.
        if (saeivStoppedAtStopIndex >= 0) {
          displayIndex = clampRouteStopIndex(saeivStoppedAtStopIndex, lastIndex);
        } else if (targetIndex > reachedIndex) {
          displayIndex = targetIndex;
        }
        var displayEntry = entries[displayIndex] || entries[0] || null;
        var stopPoint = parseWorldPoint3D(displayEntry && displayEntry.point);
        var prevStopPoint = parseWorldPoint3D(entries[displayIndex - 1] && entries[displayIndex - 1].point);
        var nextStopPoint = parseWorldPoint3D(entries[displayIndex + 1] && entries[displayIndex + 1].point);
        if (stopPoint) {
          payload.stopX = Number(stopPoint.x);
          payload.stopZ = Number(stopPoint.y);
          if (Number.isFinite(Number(stopPoint.h))) {
            payload.stopY = Number(stopPoint.h);
          }
        }
        if (prevStopPoint) {
          payload.stopPrevX = Number(prevStopPoint.x);
          payload.stopPrevZ = Number(prevStopPoint.y);
        }
        if (nextStopPoint) {
          payload.stopNextX = Number(nextStopPoint.x);
          payload.stopNextZ = Number(nextStopPoint.y);
        }
        var stopHeadingVal = Number(displayEntry && (displayEntry.stopHeading ?? displayEntry.heading ?? displayEntry.Heading));
        if (!Number.isFinite(stopHeadingVal)) {
          stopHeadingVal = computeSaeivStopHeadingDeg(entries, displayIndex, payload.busHeading);
        }
        if (!Number.isFinite(stopHeadingVal)) stopHeadingVal = Number(payload.busHeading);
        if (Number.isFinite(stopHeadingVal)) payload.stopHeading = stopHeadingVal;
        var displayStopConfig = resolveSaeivPassengerConfigForStop(saeivPassengerState || saeivPassengerDefaults, displayEntry);
        payload.passengersMin = Math.max(0, Number(displayStopConfig.passengersMin) || 0);
        payload.passengersMax = Math.max(payload.passengersMin, Number(displayStopConfig.passengersMax) || 0);
        payload.coefOn = Math.max(0, Math.min(100, Number(displayStopConfig.coefOn) || 0));
        payload.stopOptionalByConfig = isSaeivStopOptionalByConfig(displayStopConfig);
        var currentName = String(names[displayIndex] || "Arret").trim() || "Arret";
        var nextName = displayIndex < lastIndex ? String(names[displayIndex + 1] || "").trim() : "";
        var thirdName = (displayIndex + 2) <= lastIndex ? String(names[displayIndex + 2] || "").trim() : "";
        var departMinutesRaw = Number(displayEntry && displayEntry.nextStopTime);
        var departMinutes = departMinutesRaw > 0 ? String(Math.floor(departMinutesRaw)).padStart(2, "0") : "";
        payload.selected = true;
        payload.lineSelected = true;
        payload.routeSelected = true;
        payload.selectedKey = String(saeivRouteState.selectedKey || "");
        payload.selectedLineUid = String(saeivRouteState.lineUid || "");
        payload.selectedRouteUid = String(saeivRouteState.routeUid || "");
        payload.lineNumber = String(saeivRouteState.lineNumber || "");
        payload.routeName = String(saeivRouteState.routeName || "");
        var routeStarted = saeivRouteState.started === true;
        payload.routeStarted = routeStarted;
        payload.routeWaitingStart = !routeStarted;
        payload.audioCurrentIndex = displayIndex;
        payload.audioStopNames = names;
        payload.stopName = currentName;
        payload.nextStopName = nextName;
        payload.thirdStopName = thirdName;
        payload.vehicleAtStop = saeivStoppedAtStopIndex >= 0;
        payload.vehicleAtStopIndex = saeivStoppedAtStopIndex >= 0 ? saeivStoppedAtStopIndex : -1;
        payload.vehicleAtStopUid = String(saeivStoppedAtStopUid || "");
        payload.departMinutes = departMinutes;
        payload.routeStopCount = names.length;
        payload.routeReachedIndex = reachedIndex;
        payload.routeTargetIndex = targetIndex;
        payload.vehicleName = String(saeivVehicleName || "");
        var activeCapacity = getSaeivActiveCapacityState(payload.vehicleName);
        payload.busMaxCapacity = Math.max(1, Math.round(Number(activeCapacity.capacity) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT));
        payload.busMaxCapacityUnlimited = activeCapacity.unlimited === true;
        payload.busMaxCapacityDisplay = String(activeCapacity.display || payload.busMaxCapacity);
        if (saeivPassengerState && typeof saeivPassengerState === "object") {
          payload.passengersInBus = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
          payload.passengersAtStop = Math.max(0, Math.round(Number(saeivPassengerState.passengersAtStop) || 0));
          payload.stopBoardingTotal = Math.max(0, Math.round(Number(saeivPassengerState.stopBoardingTotal) || 0));
          payload.stopBoardingDone = Math.max(0, Math.round(Number(saeivPassengerState.stopBoardingDone) || 0));
          payload.stopAlightingTotal = Math.max(0, Math.round(Number(saeivPassengerState.stopAlightingTotal) || 0));
          payload.stopAlightingDone = Math.max(0, Math.round(Number(saeivPassengerState.stopAlightingDone) || 0));
          payload.stopRequested = saeivPassengerState.stopRequested === true;
          payload.stopNecessary = saeivPassengerState.stopNecessary === true;
          payload.stopOptionalByConfig = saeivPassengerState.stopOptionalByConfig === true || payload.stopOptionalByConfig === true;
          payload.routeMissedStopsCount = Math.max(0, Math.round(Number(saeivPassengerState.missedStops) || 0));
          payload.routeTransportedPassengers = Math.max(0, Math.round(Number(saeivPassengerState.transportedPassengers) || 0));
        }
        var externalInBus = getBusStatusPassengerCountNow();
        if (externalInBus !== null) {
          payload.passengersInBus = Math.max(0, Math.round(Number(externalInBus) || 0));
        }
        var externalPassengerServiceState = getBusStatusPassengerServiceStateNow();
        if (externalPassengerServiceState) {
          payload.busStatusPassengerServiceLinked = true;
          payload.busStatusPassengerServiceActive = externalPassengerServiceState.active === true;
          payload.busStatusPassengerServiceReady = externalPassengerServiceState.ready === true;
          payload.stopBoardingTotal = Math.max(0, Math.round(Number(externalPassengerServiceState.boardingTotal) || 0));
          payload.stopBoardingDone = Math.max(0, Math.round(Number(externalPassengerServiceState.boardingDone) || 0));
          payload.stopAlightingTotal = Math.max(0, Math.round(Number(externalPassengerServiceState.alightingTotal) || 0));
          payload.stopAlightingDone = Math.max(0, Math.round(Number(externalPassengerServiceState.alightingDone) || 0));
        }
        var isActuallyAtTerminus = reachedIndex >= lastIndex || (saeivStoppedAtStopIndex >= 0 && saeivStoppedAtStopIndex >= lastIndex);
        if (isActuallyAtTerminus) {
          payload.passengersAtStop = 0;
          payload.stopBoardingTotal = 0;
          var alightDoneNow = Math.max(0, Math.round(Number(payload.stopAlightingDone) || 0));
          var inBusNowForTerminus = Math.max(0, Math.round(Number(payload.passengersInBus) || 0));
          var alightTotalNow = Math.max(0, Math.round(Number(payload.stopAlightingTotal) || 0));
          // Keep a stable terminus denominator while passengers are alighting:
          // total served = already alighted + still in bus.
          var computedTerminusTotal = alightDoneNow + inBusNowForTerminus;
          payload.stopAlightingTotal = Math.max(alightTotalNow, computedTerminusTotal);
          payload.stopNecessary = true;
        }

        var startInfo = getSaeivRouteStartStopInfo(telemetryLastSignal);
        payload.startStopName = String(startInfo && startInfo.startEntry && startInfo.startEntry.name || names[0] || "").trim();
        payload.startStopDistanceM = Number(startInfo && startInfo.distanceM);
        payload.routeCanStart = !!(startInfo && startInfo.atStartStop);
        var distanceToDisplayStopM = Number.NaN;
        var signalX = Number(telemetryLastSignal && telemetryLastSignal.x);
        var signalY = Number(telemetryLastSignal && telemetryLastSignal.y);
        var signalZ = Number(telemetryLastSignal && telemetryLastSignal.z);
        if (Number.isFinite(signalX) && Number.isFinite(signalY) && Number.isFinite(signalZ) && displayEntry && displayEntry.point) {
          distanceToDisplayStopM = worldPointDistance(
            { x: signalX, y: signalY, z: signalZ },
            displayEntry.point
          );
        }
        payload.distanceToDisplayStopM = distanceToDisplayStopM;
        if (Number.isFinite(distanceToDisplayStopM)) {
          payload.currentStopLabel = distanceToDisplayStopM <= SAEIV_STOP_REACH_DISTANCE ? "Arrêt actuel" : "Prochain arrêt";
        } else {
          payload.currentStopLabel = payload.vehicleAtStop ? "Arrêt actuel" : "Prochain arrêt";
        }
        if (!routeStarted) {
          payload.currentStopLabel = "Station de départ";
          payload.stopName = payload.startStopName || payload.stopName;
          payload.distanceToDisplayStopM = payload.startStopDistanceM;
          payload.routeCompleted = false;
          payload.routeReachedIndex = -1;
          payload.routeTargetIndex = 0;
          return payload;
        }
        var refArrivalTs = computeSaeivRefArrivalTimestampMs(
          entries,
          displayIndex,
          reachedIndex,
          targetIndex,
          { x: signalX, y: signalY, z: signalZ }
        );
        payload.refTime = formatClockTextFromTimestamp(refArrivalTs);
        var completion = buildSaeivCompletionMetrics(entries, reachedIndex);
        // Fin de course : Index atteint le terminus ET bus vide
        var isAtTerminus = completion.completed === true;
        var isBusEmpty = Number(payload.passengersInBus) === 0;
        payload.routeCompleted = isAtTerminus && isBusEmpty;
        if (payload.routeCompleted) {
          if (!Number.isFinite(Number(saeivRouteCompletedAtMs)) || Number(saeivRouteCompletedAtMs) <= 0) {
            saeivRouteCompletedAtMs = Number(payload.clockNowMs) || getSaeivNowTimestampMs();
          }
        } else {
          saeivRouteCompletedAtMs = 0;
        }
        payload.routeSelectedAtMs = Number(completion.selectedAtMs) || 0;
        payload.routeStartedAtMs = Number(completion.startedAtMs) || 0;
        payload.routeTerminusReachedAtMs = Number(completion.terminusReachedAtMs) || 0;
        payload.routeCompletedAtMs = Number(saeivRouteCompletedAtMs) || 0;
        payload.routePlannedTerminusAtMs = Number(completion.plannedTerminusAtMs);
        payload.routeActualTerminusAtMs = payload.routeCompleted ? (Number(saeivRouteCompletedAtMs) || payload.routeTerminusReachedAtMs || Number(payload.clockNowMs) || 0) : 0;
        var elapsedBase = Number(payload.routeStartedAtMs) > 0 ? Number(payload.routeStartedAtMs) : Number(payload.routeSelectedAtMs);
        var elapsedNow = payload.routeCompleted
          ? Number(payload.routeActualTerminusAtMs)
          : (Number(payload.clockNowMs) || getSaeivNowTimestampMs());
        var elapsedMs = 0;
        if (Number.isFinite(elapsedBase) && elapsedBase > 0 && Number.isFinite(elapsedNow) && elapsedNow > 0) {
          elapsedMs = Math.max(0, elapsedNow - elapsedBase);
        } else {
          elapsedMs = Number(completion.elapsedMs) || 0;
        }
        payload.routeElapsedMs = elapsedMs;
        payload.routeLiveElapsedMs = elapsedMs;
        var liveDelayMinutes = computeSaeivDelayMinutesByTimestamp(
          payload.routeCompleted ? payload.routeActualTerminusAtMs : elapsedNow,
          payload.routePlannedTerminusAtMs
        );
        payload.routeLiveDelayMinutes = liveDelayMinutes;
        payload.routeFinalDelayMinutes = payload.routeCompleted
          ? (Number.isFinite(liveDelayMinutes) ? liveDelayMinutes : Number(completion.finalDelayMinutes))
          : Number.NaN;
        payload.routeReachedStopsCount = Math.max(0, Number(completion.reachedStops) || 0);
        payload.routeServedStopsCount = Math.max(0, Number(completion.servedStops) || 0);
        payload.routeLateStopsCount = Math.max(0, Number(completion.lateStops) || 0);
        payload.routeMissedStopsCount = Math.max(0, Number(completion.missedStops) || 0);
        payload.routeTransportedPassengers = Math.max(0, Number(completion.transportedPassengers) || 0);
        return payload;
      }
      function syncSaeivExternalState(force) {
        var now = Date.now();
        if (!force && saeivLastExternalSyncAt && (now - saeivLastExternalSyncAt) < SAEIV_STATE_SYNC_MIN_INTERVAL_MS) {
          return false;
        }
        if (typeof ensureBackgroundBusStatusRuntime === "function") {
          ensureBackgroundBusStatusRuntime();
        }
        var payload = buildSaeivStatePayloadFromGame();
        var key = "";
        try { key = JSON.stringify(payload); } catch (err) { key = ""; }
        if (!force && key && key === saeivLastStateKey) return false;
        saeivLastStateKey = key;
        saeivLastExternalSyncAt = now;
        return postSaeivBridgeMessage({
          type: "saeiv:state",
          payload: payload
        });
      }
      function toRouteBridgePoint(entry) {
        if (!entry) return null;
        var X = Number(entry.X);
        var Y = Number(entry.Y);
        var Z = Number(entry.Z);
        if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) return null;
        return { x: X, y: Y, z: Z };
      }
      function ensureSaeivRouteDestinationSynced(force) {
        if (!saeivRouteState || typeof saeivRouteState !== "object") return false;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (!entries.length) return false;
        var routeStarted = saeivRouteState.started === true;
        var lastIndex = entries.length - 1;
        var reachedIndex = clampReachedStopIndex(saeivRouteState.reachedIndex, lastIndex);
        var targetIndex = clampRouteStopIndex(saeivRouteState.targetIndex, lastIndex);
        // Important: do not auto-jump to the next stop here.
        // targetIndex must advance only after dwell validation in maybeAdvanceSaeivStopFromSignal().
        saeivRouteState.reachedIndex = reachedIndex;
        saeivRouteState.targetIndex = targetIndex;
        if (reachedIndex >= lastIndex || targetIndex <= reachedIndex) {
          if (activeBridgeDestinationPoint) {
            clearManualWazeBridgeDestination();
            return true;
          }
          return false;
        }
        // RDV au départ (non démarré) : premier arrêt. En ligne : prochain arrêt (targetIndex).
        var destinationEntry = routeStarted ? entries[targetIndex] : entries[0];
        var targetPoint = toRouteBridgePoint(destinationEntry);
        if (!targetPoint) return false;
        if (!force && activeBridgeDestinationPoint && worldPointDistance(activeBridgeDestinationPoint, targetPoint) <= 0.001) {
          return false;
        }
        if (!lastBridgeArrowPoint) {
          var startFallback = parseWorldPoint3D(saeivRouteStartPoint) || targetPoint;
          if (startFallback) {
            publishManualWazeBridgePositionXYZ(
              Number(startFallback.x),
              Number(startFallback.y),
              Number(startFallback.z),
              Number.isFinite(lastBridgeHeadingDeg) ? lastBridgeHeadingDeg : 0
            );
          }
        }
        var applied = publishManualWazeBridgeDestinationXYZ(destinationEntry.X, destinationEntry.Y, destinationEntry.Z);
        if (applied && activeBridgeDestinationPoint && lastBridgeArrowPoint) {
          publishActiveRouteFromState(true, { allowRecompute: true });
          setTimeout(function () {
            if (!activeBridgeDestinationPoint || !lastBridgeArrowPoint) return;
            publishActiveRouteFromState(true, { allowRecompute: true });
          }, 180);
          setTimeout(function () {
            if (!activeBridgeDestinationPoint || !lastBridgeArrowPoint) return;
            publishActiveRouteFromState(true, { allowRecompute: true });
          }, 520);
        }
        return applied;
      }
      function maybeAdvanceSaeivStopFromSignal(signal) {
        if (!saeivRouteState || typeof saeivRouteState !== "object") return false;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (!entries.length) return false;
        if (saeivRouteState.started !== true) {
          var startInfo = getSaeivRouteStartStopInfo(signal);
          setSaeivStoppedAtStop(startInfo && startInfo.atStartStop ? 0 : -1, entries);
          resetSaeivPassengerTargetState(entries, 0);
          return false;
        }
        var now = Date.now();
        var nowClock = getSaeivNowTimestampMs();
        var speedKmhLive = updateTelemetryEstimatedSpeed(signal, now);
        var vehiclePoint = {
          x: Number(signal && signal.x),
          y: Number(signal && signal.y),
          z: Number(signal && signal.z)
        };
        if (!Number.isFinite(vehiclePoint.x) || !Number.isFinite(vehiclePoint.y) || !Number.isFinite(vehiclePoint.z)) return false;
        var lastIndex = entries.length - 1;
        var currentIndex = clampReachedStopIndex(saeivRouteState.reachedIndex, lastIndex);
        var targetIndex = clampRouteStopIndex(saeivRouteState.targetIndex, lastIndex);
        if (targetIndex <= currentIndex) return false;
        var targetEntry = entries[targetIndex];
        if (!targetEntry) return false;
        var targetUid = String(targetEntry.uid || "");
        if (targetUid !== saeivTargetArrivalUid) {
          saeivTargetArrivalUid = targetUid;
          saeivTargetArrivalArmed = false;
          saeivTargetDwellUid = "";
          saeivTargetDwellStartAt = 0;
        }
        resetSaeivPassengerTargetState(entries, targetIndex);
        var targetDistance = worldPointDistance(vehiclePoint, targetEntry.point);
        if (!Number.isFinite(targetDistance)) return false;
        if (saeivPassengerState && typeof saeivPassengerState === "object") {
          var bestTargetDistance = Number(saeivPassengerState.targetMinDistanceM);
          if (!Number.isFinite(bestTargetDistance) || targetDistance < bestTargetDistance) {
            saeivPassengerState.targetMinDistanceM = targetDistance;
          }
          maybeRollSaeivStopRequested(targetDistance, now, targetIndex >= lastIndex);
        }
        var speedKmh = telemetrySpeedForStopDecision(speedKmhLive);
        var isStopped = Number.isFinite(speedKmh) && Math.abs(speedKmh) < SAEIV_STOP_DWELL_MAX_SPEED_KMH;
        var reachDistance = Math.max(Number(SAEIV_STOP_REACH_DISTANCE) || 0, Number(SAEIV_STOP_DWELL_REACH_DISTANCE) || 0);
        var atStopIndex = -1;
        if (isStopped && currentIndex >= 0 && entries[currentIndex]) {
          var reachedDistance = worldPointDistance(vehiclePoint, entries[currentIndex].point);
          if (Number.isFinite(reachedDistance) && reachedDistance <= reachDistance) {
            atStopIndex = currentIndex;
          }
        }
        if (atStopIndex < 0 && isStopped && targetDistance <= reachDistance) {
          atStopIndex = targetIndex;
        }
        setSaeivStoppedAtStop(atStopIndex, entries);
        if (saeivStopAnnouncementSoundsEnabled && targetDistance <= SAEIV_STOP_ANNOUNCE_DISTANCE) {
          if (targetIndex >= lastIndex) {
            var finalStopUid = Number(targetEntry && targetEntry.uid);
            var finalStopWasAlreadyHandled = Number.isFinite(finalStopUid) && saeivAnnouncedStopUids.has(finalStopUid);
            var finalStopClipName = findSaeivStopClipName(targetEntry);
            var finalStopAnnouncementQueued = announceStopArrivalOnce(targetEntry, {
              onPlayed: function () {
                scheduleSaeivTerminusAnnouncement(targetEntry);
              }
            });
            if (!finalStopAnnouncementQueued && !finalStopWasAlreadyHandled && !finalStopClipName) {
              scheduleSaeivTerminusAnnouncement(targetEntry);
            }
          } else {
            announceStopArrivalOnce(targetEntry);
          }
        }
        var reachedTerminusNow = targetIndex >= lastIndex;
        var inReach = targetDistance <= reachDistance;
        var passengerTick = processSaeivPassengerServiceTick(targetIndex, {
          inReach: inReach,
          isStopped: isStopped,
          isTerminus: reachedTerminusNow,
          nowMs: now
        });
        if (passengerTick && passengerTick.changed) saeivLastStateKey = "";

        if (targetDistance > reachDistance) {
          var stopNecessaryFar = !!(saeivPassengerState && saeivPassengerState.stopNecessary === true);
          var minSeenDistance = Number(saeivPassengerState && saeivPassengerState.targetMinDistanceM);
          var missedAdvanceMultiplier = Number(SAEIV_STOP_MISSED_ADVANCE_DISTANCE_MULTIPLIER);
          if (!Number.isFinite(missedAdvanceMultiplier) || missedAdvanceMultiplier <= 0) missedAdvanceMultiplier = 1;
          var passThroughThreshold = Math.max(reachDistance + 20, reachDistance * 1.65) * missedAdvanceMultiplier;
          var hasPassedTarget = stopNecessaryFar &&
            Number.isFinite(minSeenDistance) &&
            minSeenDistance <= reachDistance &&
            targetDistance >= passThroughThreshold;
          if (
            hasPassedTarget &&
            (now - saeivLastStopAdvanceAt) >= SAEIV_STOP_ADVANCE_COOLDOWN_MS
          ) {
            applySaeivStopPassengerService(targetIndex, false, reachedTerminusNow);
            currentIndex = targetIndex;
            saeivRouteState.reachedIndex = currentIndex;
            saeivRouteState.targetIndex = currentIndex < lastIndex ? (currentIndex + 1) : currentIndex;
            recordReachedStopStats(entries, currentIndex, nowClock);
            setSaeivStoppedAtStop(-1, entries);
            if (currentIndex >= lastIndex) {
              saeivTerminusReachedAtMs = nowClock;
            } else {
              saeivTerminusReachedAtMs = 0;
            }
            saeivTargetArrivalUid = "";
            saeivTargetArrivalArmed = false;
            saeivTargetDwellUid = "";
            saeivTargetDwellStartAt = 0;
            saeivLastStopAdvanceAt = now;
            resetSaeivPassengerTargetState(entries, saeivRouteState.targetIndex);
            saeivLastAction = "game-stop-missed";
            saeivLastStateKey = "";
            syncSaeivExternalState(true);
            ensureSaeivRouteDestinationSynced(true);
            return true;
          }
          saeivTargetArrivalArmed = true;
          saeivTargetDwellUid = targetUid;
          saeivTargetDwellStartAt = 0;
          return false;
        }
        if ((now - saeivLastStopAdvanceAt) < SAEIV_STOP_ADVANCE_COOLDOWN_MS) return false;
        var stopNecessary = !!(saeivPassengerState && saeivPassengerState.stopNecessary === true);
        if (stopNecessary && !isStopped) return false;
        if (stopNecessary) {
          // Si le widget bus_status est connecté, on attend son signal "ready" (Prêt au départ)
          var busStatusState = getBusStatusPassengerServiceStateNow();
          if (busStatusState !== null) {
            if (busStatusState.ready !== true) return false;
          } else {
            // Sinon on utilise la simulation interne
            if (!(passengerTick && passengerTick.completed === true)) return false;
          }
        }
        var stopServed = !stopNecessary || (passengerTick && passengerTick.completed === true);
        applySaeivStopPassengerService(targetIndex, stopServed, reachedTerminusNow);
        currentIndex = targetIndex;
        saeivRouteState.reachedIndex = currentIndex;
        saeivRouteState.targetIndex = currentIndex < lastIndex ? (currentIndex + 1) : currentIndex;
        recordReachedStopStats(entries, currentIndex, nowClock);
        if (stopServed) setSaeivStoppedAtStop(currentIndex, entries);
        else setSaeivStoppedAtStop(-1, entries);
        reachedTerminusNow = currentIndex >= lastIndex;
        if (reachedTerminusNow) {
          saeivTerminusReachedAtMs = nowClock;
        } else {
          saeivTerminusReachedAtMs = 0;
        }
        saeivTargetArrivalUid = "";
        saeivTargetArrivalArmed = false;
        saeivTargetDwellUid = "";
        saeivTargetDwellStartAt = 0;
        saeivLastStopAdvanceAt = now;
        resetSaeivPassengerTargetState(entries, saeivRouteState.targetIndex);
        saeivLastAction = "game-stop-reached";
        saeivLastStateKey = "";
        syncSaeivExternalState(true);
        ensureSaeivRouteDestinationSynced(true);
        return true;
      }
      function handleSaeivTelemetrySignal(signal) {
        if (!saeivRouteState || typeof saeivRouteState !== "object") return;
        ensureSaeivRouteDestinationSynced(false);
        var advanced = maybeAdvanceSaeivStopFromSignal(signal);
        if (!advanced) syncSaeivExternalState(false);
      }
      function buildRouteRuntimeSummary() {
        if (!saeivRouteState || typeof saeivRouteState !== "object") return null;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        var names = entries.map(function (entry) { return String(entry && entry.name || "").trim(); }).filter(Boolean);
        var lastIndex = Math.max(0, names.length - 1);
        var reachedIndex = clampReachedStopIndex(saeivRouteState.reachedIndex, lastIndex);
        var targetIndex = clampRouteStopIndex(saeivRouteState.targetIndex, lastIndex);
        var displayIndex = reachedIndex < 0 ? 0 : reachedIndex;
        var startInfo = getSaeivRouteStartStopInfo(telemetryLastSignal);
        var routeStarted = saeivRouteState.started === true;
        var externalInBus = getBusStatusPassengerCountNow();
        var runtimePassengersInBus = externalInBus !== null
          ? Math.max(0, Math.round(Number(externalInBus) || 0))
          : Math.max(0, Math.round(Number(saeivPassengerState && saeivPassengerState.passengersInBus) || 0));
        var activeCapacity = getSaeivActiveCapacityState(saeivVehicleName);
        return {
          version: dbusDataVersion,
          selectedKey: String(saeivRouteState.selectedKey || ""),
          lineUid: String(saeivRouteState.lineUid || ""),
          routeUid: String(saeivRouteState.routeUid || ""),
          lineNumber: String(saeivRouteState.lineNumber || ""),
          routeName: String(saeivRouteState.routeName || ""),
          started: routeStarted,
          waitingStart: !routeStarted,
          canStart: !!(startInfo && startInfo.atStartStop),
          startStop: String(startInfo && startInfo.startEntry && startInfo.startEntry.name || names[0] || ""),
          startStopDistanceM: Number(startInfo && startInfo.distanceM),
          reachedIndex: reachedIndex,
          currentIndex: displayIndex,
          targetIndex: targetIndex,
          stopCount: names.length,
          currentStop: String(names[displayIndex] || ""),
          nextStop: targetIndex > reachedIndex ? String(names[targetIndex] || "") : "",
          vehicleName: String(saeivVehicleName || ""),
          passengersInBus: runtimePassengersInBus,
          busMaxCapacity: Math.max(1, Math.round(Number(activeCapacity.capacity) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT)),
          busMaxCapacityUnlimited: activeCapacity.unlimited === true,
          busMaxCapacityDisplay: String(activeCapacity.display || ""),
          passengersAtStop: Math.max(0, Math.round(Number(saeivPassengerState && saeivPassengerState.passengersAtStop) || 0)),
          stopRequested: !!(saeivPassengerState && saeivPassengerState.stopRequested === true),
          stopNecessary: !!(saeivPassengerState && saeivPassengerState.stopNecessary === true),
          missedStops: Math.max(0, Math.round(Number(saeivPassengerState && saeivPassengerState.missedStops) || 0)),
          transportedPassengers: Math.max(0, Math.round(Number(saeivPassengerState && saeivPassengerState.transportedPassengers) || 0)
          )
        };
      }
      function clearSaeivRouteSelection(options) {
        var opts = options && typeof options === "object" ? options : {};
        var keepWazeDestination = opts.keepWazeDestination === true;
        cancelSaeivTerminusAnnouncement();
        saeivRouteSelectedAtMs = 0;
        saeivRouteStartedAtMs = 0;
        saeivTerminusReachedAtMs = 0;
        saeivRouteCompletedAtMs = 0;
        saeivRouteState = null;
        saeivRouteStartPoint = null;
        saeivTerminusAnnouncedRouteKey = "";
        saeivRouteSuffixCache = new Map();
        saeivNominalSegmentDistanceCache = new Map();
        saeivReachedStopsCount = 0;
        saeivServedStopsCount = 0;
        saeivLateStopsCount = 0;
        saeivMaxPassengersEverInBus = 0;
        saeivStatsRecordedReachedIndex = -1;
        saeivStatsRecordedServedIndex = -1;
        saeivStopServedLog = {};
        saeivCurrentStopWasServed = false;
        saeivLastStopAdvanceAt = 0;
        saeivAnnouncedStopUids.clear();
        saeivStopAnnounceEndedAtByUid = new Map();
        saeivTargetArrivalUid = "";
        saeivTargetArrivalArmed = false;
        saeivTargetDwellUid = "";
        saeivTargetDwellStartAt = 0;
        saeivStoppedAtStopIndex = -1;
        saeivStoppedAtStopUid = "";
        saeivPassengerDefaults = {
          passengersMin: 0,
          passengersMax: 0,
          coefOn: 0
        };
        saeivPassengerState = null;
        telemetrySpeedSample = null;
        telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
        telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
        stopSaeivRouteAudioPlayback();
        saeivRouteAudio.routeKey = "";
        saeivRouteAudio.styleName = "";
        saeivRouteAudio.folderPath = "";
        saeivRouteAudio.available = false;
        saeivRouteAudio.filesByToken = new Map();
        saeivRouteAudio.departureClipName = "";
        saeivRouteAudio.terminusClipName = "";
        saeivRouteAudio.terminusAudio = null;
        saeivLastAction = "game-route-cleared";
        saeivLastStateKey = "";
        if (!keepWazeDestination) clearManualWazeBridgeDestination();
        syncSaeivExternalState(true);
        return true;
      }
      function startSaeivSelectedRoute() {
        if (!saeivRouteState || typeof saeivRouteState !== "object") {
          return { ok: false, error: "Aucune ligne selectionnee." };
        }
        if (saeivRouteState.started === true) {
          return Object.assign({ ok: true, alreadyStarted: true }, buildRouteRuntimeSummary());
        }
        var startInfo = getSaeivRouteStartStopInfo(telemetryLastSignal);
        if (!startInfo.valid) {
          return { ok: false, error: "Station de départ introuvable." };
        }
        if (!startInfo.atStartStop) {
          var stopName = String(startInfo.startEntry && startInfo.startEntry.name || "Arrêt de départ").trim();
          return { ok: false, error: "Rendez-vous à la station de départ : " + stopName };
        }
        saeivRouteState.started = true;
        var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
        if (entries.length) {
          var firstUid = Number(entries[0] && entries[0].uid);
          if (Number.isFinite(firstUid)) {
            // Rule: no audio announcement for the very first stop of the line.
            saeivAnnouncedStopUids.add(firstUid);
          }
        }
        var startClockNow = getSaeivNowTimestampMs();
        saeivRouteStartedAtMs = startClockNow;
        saeivRouteSelectedAtMs = startClockNow + Math.max(0, Number(SAEIV_ROUTE_START_DELAY_MS) || 0);
        saeivTerminusReachedAtMs = 0;
        saeivRouteCompletedAtMs = 0;
        saeivLastAction = "game-route-started";
        saeivLastStateKey = "";
        syncSaeivExternalState(true);
        ensureSaeivRouteDestinationSynced(true);
        if (shouldAutoPlaySaeivDestinationOnStart()) {
          scheduleSaeivDestinationAnnouncementWhenAudioReady(String(saeivRouteState.selectedKey || ""));
        }
        return Object.assign({ ok: true, started: true }, buildRouteRuntimeSummary());
      }
      function activateSaeivRouteSelection(line, route, options) {
        var opts = options && typeof options === "object" ? options : {};
        var entries = getRouteStopEntries(route);
        if (!entries.length) {
          return {
            ok: false,
            error: "Aucun arret valide pour cette route."
          };
        }
        cancelSaeivTerminusAnnouncement();
        saeivRouteSelectedAtMs = 0;
        saeivRouteStartedAtMs = 0;
        saeivTerminusReachedAtMs = 0;
        saeivRouteCompletedAtMs = 0;
        saeivTerminusAnnouncedRouteKey = "";
        var lastIndex = entries.length - 1;
        var reachedIndex = -1;
        var targetIndex = 0;
        reachedIndex = clampReachedStopIndex(reachedIndex, lastIndex);
        targetIndex = clampRouteStopIndex(targetIndex, lastIndex);
        var selectedKey = String(line.uid || "") + ":" + String(route.uid || "");
        var routeStartPoint = null;
        var bridgePointX = Number(lastBridgeArrowPoint && lastBridgeArrowPoint.x);
        var bridgePointY = Number(lastBridgeArrowPoint && lastBridgeArrowPoint.y);
        var bridgePointZ = Number(lastBridgeArrowPoint && lastBridgeArrowPoint.z);
        if (Number.isFinite(bridgePointX) && Number.isFinite(bridgePointY) && Number.isFinite(bridgePointZ)) {
          routeStartPoint = {
            x: bridgePointX,
            y: bridgePointY,
            z: bridgePointZ
          };
        }
        if (!routeStartPoint) {
          var signalX = Number(telemetryLastSignal && telemetryLastSignal.x);
          var signalY = Number(telemetryLastSignal && telemetryLastSignal.y);
          var signalZ = Number(telemetryLastSignal && telemetryLastSignal.z);
          if (Number.isFinite(signalX) && Number.isFinite(signalY) && Number.isFinite(signalZ)) {
            routeStartPoint = {
              x: signalX,
              y: signalY,
              z: signalZ
            };
          }
        }
        if (!routeStartPoint) {
          var firstEntry = entries[0] || null;
          var firstX = Number(firstEntry && firstEntry.X);
          var firstY = Number(firstEntry && firstEntry.Y);
          var firstZ = Number(firstEntry && firstEntry.Z);
          if (Number.isFinite(firstX) && Number.isFinite(firstY) && Number.isFinite(firstZ)) {
            routeStartPoint = {
              x: firstX,
              y: firstY,
              z: firstZ
            };
          }
        }
        saeivRouteStartPoint = routeStartPoint;
        saeivRouteSuffixCache = new Map();
        saeivNominalSegmentDistanceCache = new Map();
        saeivRouteState = {
          selectedKey: selectedKey,
          lineUid: String(line.uid || ""),
          routeUid: String(route.uid || ""),
          lineNumber: String(getLineNumber(line, route) || "").trim(),
          routeName: String(route.name || "").trim(),
          stops: entries,
          started: false,
          reachedIndex: reachedIndex,
          targetIndex: targetIndex
        };
        saeivReachedStopsCount = 0;
        saeivServedStopsCount = 0;
        saeivLateStopsCount = 0;
        saeivMaxPassengersEverInBus = 0;
        saeivStatsRecordedReachedIndex = -1;
        saeivStatsRecordedServedIndex = -1;
        saeivStopServedLog = {};
        saeivCurrentStopWasServed = false;
        saeivLastStopAdvanceAt = 0;
        saeivAnnouncedStopUids = new Set();
        saeivStopAnnounceEndedAtByUid = new Map();
        saeivTargetArrivalUid = "";
        saeivTargetArrivalArmed = false;
        saeivTargetDwellUid = "";
        saeivTargetDwellStartAt = 0;
        saeivStoppedAtStopIndex = -1;
        saeivStoppedAtStopUid = "";
        if (SAEIV_PASSENGERS_ENABLED === true) {
          saeivPassengerDefaults = deriveSaeivPassengerConfigFromEntries(entries, saeivPassengerDefaults);
          if (hasPassengerOverrides(opts)) {
            saeivPassengerDefaults = normalizeSaeivPassengerConfig(opts, saeivPassengerDefaults);
          }
          saeivPassengerState = createSaeivPassengerState(opts, entries, targetIndex);
        } else {
          saeivPassengerDefaults = { passengersMin: 0, passengersMax: 0, coefOn: 0 };
          saeivPassengerState = null;
        }
        telemetrySpeedSample = null;
        telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
        telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
        stopSaeivRouteAudioPlayback();
        saeivRouteAudio.routeKey = selectedKey;
        saeivRouteAudio.styleName = "";
        saeivRouteAudio.folderPath = "";
        saeivRouteAudio.available = false;
        saeivRouteAudio.filesByToken = new Map();
        saeivRouteAudio.departureClipName = "";
        saeivRouteAudio.terminusClipName = "";
        saeivRouteAudio.terminusAudio = null;
        saeivRouteAudio.preparePromise = null;
        saeivLastAction = "game-route-selected";
        saeivLastStateKey = "";
        if (!lastBridgeArrowPoint && routeStartPoint) {
          var startHeading = Number.isFinite(lastBridgeHeadingDeg) ? lastBridgeHeadingDeg : 0;
          publishManualWazeBridgePositionXYZ(
            Number(routeStartPoint.x),
            Number(routeStartPoint.y),
            Number(routeStartPoint.z),
            startHeading
          );
        }
        syncSaeivExternalState(true);
        ensureNavStopLinksLoaded().catch(function () { });
        ensureNavBridgesLoaded().catch(function () { });
        ensureSaeivRouteDestinationSynced(true);
        var autoAnnounceOnSelection = shouldAutoPlaySaeivDestinationOnSelection();
        var audioPreparePromise = prepareSaeivRouteAudio(line, route, entries).catch(function () { return false; });
        saeivRouteAudio.preparePromise = audioPreparePromise;
        if (autoAnnounceOnSelection) {
          scheduleSaeivDestinationAnnouncementWhenAudioReady(selectedKey);
        }
        return Object.assign({ ok: true }, buildRouteRuntimeSummary());
      }
      function findLineByReference(reference, uidOnly, routeReference) {
        var raw = String(reference || "").trim();
        if (!raw) return null;
        var query = normalizeSearchToken(raw);
        var lines = Array.isArray(dbusLines) ? dbusLines : [];
        var exactUid = lines.find(function (line) {
          return String(line && line.uid || "").trim() === raw;
        }) || null;
        if (exactUid) return exactUid;
        if (uidOnly) {
          // Backward compatibility: accept raw line uid from lines.xml as well.
          var exactUidRawMatches = lines.filter(function (line) {
            return String(line && line.uidRaw || "").trim() === raw;
          });
          if (exactUidRawMatches.length === 1) return exactUidRawMatches[0];
          if (exactUidRawMatches.length > 1) {
            var routeRaw = String(routeReference || "").trim();
            if (routeRaw) {
              var routed = exactUidRawMatches.find(function (line) {
                return Array.isArray(line && line.routes) && line.routes.some(function (route) {
                  return String(route && route.uid || "").trim() === routeRaw;
                });
              }) || null;
              if (routed) return routed;
            }
            return exactUidRawMatches[0];
          }
          return null;
        }
        var exactNumber = lines.find(function (line) {
          return normalizeSearchToken(String(line && line.number || "")) === query;
        }) || null;
        if (exactNumber) return exactNumber;
        return lines.find(function (line) {
          var lineUidToken = normalizeSearchToken(String(line && line.uid || ""));
          var lineNumberToken = normalizeSearchToken(String(line && line.number || ""));
          return lineUidToken.indexOf(query) !== -1 || lineNumberToken.indexOf(query) !== -1;
        }) || null;
      }
      function findRouteByReference(line, reference, uidOnly) {
        if (!line || !Array.isArray(line.routes) || !line.routes.length) return null;
        var raw = String(reference || "").trim();
        if (!raw) return line.routes[0];
        var query = normalizeSearchToken(raw);
        var exactUid = line.routes.find(function (route) {
          return String(route && route.uid || "").trim() === raw;
        }) || null;
        if (exactUid) return exactUid;
        if (uidOnly) return null;
        var exactName = line.routes.find(function (route) {
          return normalizeSearchToken(String(route && route.name || "")) === query;
        }) || null;
        if (exactName) return exactName;
        return line.routes.find(function (route) {
          return normalizeSearchToken(String(route && route.name || "")).indexOf(query) !== -1;
        }) || null;
      }
      function listLineRouteCatalog(filterValue) {
        var query = normalizeSearchToken(filterValue);
        var out = [];
        (Array.isArray(dbusLines) ? dbusLines : []).forEach(function (line) {
          (Array.isArray(line.routes) ? line.routes : []).forEach(function (route) {
            var descriptor = {
              lineUid: String(line.uid || ""),
              lineNumber: String(getLineNumber(line, route) || "").trim(),
              routeUid: String(route.uid || ""),
              routeName: String(route.name || "").trim(),
              stopCount: Array.isArray(route.stops) ? route.stops.length : 0
            };
            if (!query) {
              out.push(descriptor);
              return;
            }
            var haystack = normalizeSearchToken(
              descriptor.lineUid + " " +
              descriptor.lineNumber + " " +
              descriptor.routeUid + " " +
              descriptor.routeName
            );
            if (haystack.indexOf(query) !== -1) out.push(descriptor);
          });
        });
        return out;
      }
