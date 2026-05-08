(function () {
  "use strict";

  var manager = window.GAME2_MANAGER = window.GAME2_MANAGER || {};
  var runtime = manager.runtime = manager.runtime || {};

  var PARTS = [
    "parts/00-state-and-config.js",
    "parts/01-bridge-and-saeiv-state.js",
    "parts/02-saeiv-audio-and-dbus.js",
    "parts/03-navigation-routing.js",
    "parts/04-waze-bridge.js",
    "parts/05-telemetry-and-shortcuts.js",
    "parts/06-settings-and-modes.js",
    "parts/07-widgets-output.js",
    "parts/08-overlay-ui-state.js",
    "parts/09-interactions-main-menu.js",
    "parts/10-startup.js"
  ];

  runtime.parts = PARTS.slice();

  function currentScriptUrl() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }
    return new URL("js/runtime/game2-main.js", window.location.href).href;
  }

  function loadText(url) {
    if (typeof fetch === "function") {
      return fetch(url, { cache: "no-store" }).then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status + " " + response.statusText);
        }
        return response.text();
      }).catch(function (fetchError) {
        return loadTextWithXhr(url).catch(function () {
          throw fetchError;
        });
      });
    }
    return loadTextWithXhr(url);
  }

  function loadTextWithXhr(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
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
    runtime.loadedAt = new Date().toISOString();
    runtime.sourceLength = source.length;
    runtime.partCount = PARTS.length;
    new Function(source + "\n//# sourceURL=game2-runtime-assembled.js")();
  }

  function failRuntime(error) {
    runtime.error = error;
    console.error("[Game2] Impossible de charger le runtime decoupe.", error);
  }

  var baseUrl = new URL("./", currentScriptUrl());
  Promise.all(PARTS.map(function (part) {
    var url = new URL(part, baseUrl).href;
    return loadText(url).then(function (text) {
      return sourceForPart(part, text);
    });
  })).then(function (sources) {
    runRuntime(sources.join("\n"));
  }).catch(failRuntime);
})();
