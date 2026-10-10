(function () {
  "use strict";

  var manager = window.GAME2_MANAGER = window.GAME2_MANAGER || {};
  var runtime = manager.runtime = manager.runtime || {};

  var PARTS = [
    "parts/00-state-and-config.js",
    "parts/00a-bus-service.js",
    "parts/01-bridge-and-saeiv-state.js",
    "parts/01a-bus-spatial-audio.js",
    "parts/02-saeiv-audio-and-dbus.js",
    "parts/03-navigation-routing.js",
    "parts/04-waze-bridge.js",
    "parts/05-telemetry-and-shortcuts.js",
    "parts/05a-native-stop-marker.js",
    "parts/05b-native-gps.js",
    "parts/05c-native-passengers.js",
    "parts/05d-native-ui.js",
    "parts/05e-native-services.js",
    "parts/05f-police.js",
    "parts/06-settings-and-modes.js",
    "parts/07-widgets-output.js",
    "parts/08-overlay-ui-state.js",
    "parts/09-interactions-main-menu.js",
    "parts/10-startup.js"
  ];

  runtime.parts = PARTS.slice();
  runtime.version = "police-3";

  function currentScriptUrl() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }
    return new URL("js/runtime/game2-main.js", window.location.href).href;
  }

  function loadTextOnce(url) {
    if (typeof fetch !== "function" || typeof AbortController !== "function") return loadTextWithXhr(url);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    return fetch(url, { cache: "no-cache", signal: controller.signal }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status + " : " + url);
      return response.text();
    }).finally(function () { clearTimeout(timer); });
  }

  function loadText(url, attempt) {
    attempt = attempt || 0;
    return loadTextOnce(url).then(function (text) {
      if (!text.trim() || /^\s*(?:<!doctype\s+html|<html)/i.test(text)) throw new Error("Script absent : " + url);
      return text;
    }).catch(function (error) {
      if (attempt >= 2) throw error;
      return new Promise(function (resolve) { setTimeout(resolve, 500 * (attempt + 1)); })
        .then(function () { return loadText(url, attempt + 1); });
    });
  }

  function loadTextWithXhr(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.setRequestHeader("Cache-Control", "no-cache");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
          resolve(xhr.responseText || "");
        } else {
          reject(new Error("HTTP " + xhr.status + " while loading " + url));
        }
      };
      xhr.onerror = function () {
        reject(new Error("Network error while loading " + url));
      };
      xhr.timeout = 15000;
      xhr.ontimeout = function () { reject(new Error("DÃ©lai de chargement dÃ©passÃ© : " + url)); };
      xhr.send(null);
    });
  }

  function sourceForPart(url, text) {
    return [
      "\n/* ===== BEGIN " + url + " ===== */\n",
      text,
      "\n/* ===== END " + url + " ===== */\n"
    ].join("");
  }

  function runRuntime(source) {
    runtime.startedAt = new Date().toISOString();
    runtime.sourceLength = source.length;
    runtime.partCount = PARTS.length;
    new Function(source + "\n//# sourceURL=game2-runtime-assembled.js")();
    runtime.loadedAt = new Date().toISOString();
  }

  function failRuntime(error) {
    runtime.error = error;
    // Retry the whole page after a failed/partial runtime assembly. Re-running
    // its closure would duplicate listeners; reload preserves the same profile.
    if(!runtime.retryTimer)runtime.retryTimer=setTimeout(function(){window.location.reload();},15000);
    var screen = document.getElementById("globalLoadingScreen");
    if (screen) {
      screen.classList.add("is-active");
      screen.style.cssText = "display:flex!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;z-index:2147483647!important";
      document.body.classList.add("is-loading-visible");
      if (!document.getElementById("idfRuntimeRetry")) {
        var retry=document.createElement("button");retry.id="idfRuntimeRetry";
        retry.className="manager-action-btn";retry.textContent="RÃ©essayer le chargement";
        retry.onclick=function(){window.location.reload();};
        (screen.querySelector(".global-loading-content")||screen).appendChild(retry);
      }
    }
    var message = document.getElementById("globalLoadingSubtext");
    if (message) {
      message.textContent = "Chargement interrompu : " + (error.message || error) + ". Rechargez la page aprÃ¨s publication complÃ¨te des fichiers.";
      message.setAttribute("role", "alert");
    }
    console.error("[Game2] Impossible de charger le runtime decoupe.", error);
  }

  var baseUrl = new URL("./", currentScriptUrl());
  Promise.all(PARTS.map(function (part) {
    var partUrl = new URL(part, baseUrl);
    partUrl.searchParams.set("v", "bus-coach-27");
    var url = partUrl.href;
    return loadText(url).then(function (text) {
      if (part === "parts/05d-native-ui.js" && text.indexOf("function syncNativeBusHud(") < 0) {
        throw new Error("Publication incomplete : le script du panneau bus ETS2 est encore ancien");
      }
      return sourceForPart(part, text);
    });
  })).then(function (sources) {
    runRuntime(sources.join("\n"));
  }).catch(failRuntime);
})();
