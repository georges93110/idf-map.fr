(function () {
  "use strict";

  var ATTRS_TO_TRANSLATE = ["title", "aria-label", "placeholder", "alt", "data-info-title"];
  var state = {
    locale: "fr",
    keys: Object.create(null),
    literals: Object.create(null),
    ready: Promise.resolve()
  };

  function normalizeText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function suspiciousScore(value) {
    var s = String(value == null ? "" : value);
    var m = s.match(/Ã|Â|â€™|â€œ|â€|�/g);
    return m ? m.length : 0;
  }

  function decodeLatin1Utf8(value) {
    var s = String(value == null ? "" : value);
    var bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i += 1) {
      bytes[i] = s.charCodeAt(i) & 0xff;
    }
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch (err) {
      return s;
    }
  }

  function fixMojibake(value) {
    var current = String(value == null ? "" : value);
    for (var i = 0; i < 4; i += 1) {
      var next = decodeLatin1Utf8(current);
      if (next === current) break;
      if (suspiciousScore(next) <= suspiciousScore(current)) {
        current = next;
      } else {
        break;
      }
    }
    return current
      .replace(/â€™/g, "’")
      .replace(/â€œ/g, "“")
      .replace(/â€\x9d/g, "”")
      .replace(/â€“/g, "–")
      .replace(/â€”/g, "—")
      .replace(/Â /g, " ")
      .replace(/Â/g, "");
  }

  function translateRaw(value) {
    var raw = String(value == null ? "" : value);
    var normalized = normalizeText(raw);
    if (!normalized) return raw;
    if (Object.prototype.hasOwnProperty.call(state.literals, normalized)) {
      return state.literals[normalized];
    }
    var fixed = fixMojibake(normalized);
    if (Object.prototype.hasOwnProperty.call(state.literals, fixed)) {
      return state.literals[fixed];
    }
    return fixed;
  }

  function translateWithPadding(value) {
    var raw = String(value == null ? "" : value);
    var match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return translateRaw(raw);
    var lead = match[1] || "";
    var core = match[2] || "";
    var tail = match[3] || "";
    if (!core.trim()) return raw;
    var nextCore = translateRaw(core);
    if (nextCore === core) return raw;
    return lead + nextCore + tail;
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    var next = translateWithPadding(node.nodeValue || "");
    if (next !== node.nodeValue) {
      node.nodeValue = next;
    }
  }

  function translateElementAttributes(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    for (var i = 0; i < ATTRS_TO_TRANSLATE.length; i += 1) {
      var name = ATTRS_TO_TRANSLATE[i];
      if (!element.hasAttribute(name)) continue;
      var prev = element.getAttribute(name);
      var next = translateRaw(prev);
      if (next !== prev) {
        element.setAttribute(name, next);
      }
    }
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(root);
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        translateTextNode(current);
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        var tag = String(current.tagName || "").toUpperCase();
        if (tag !== "SCRIPT" && tag !== "STYLE") {
          translateElementAttributes(current);
        }
      }
      current = walker.nextNode();
    }
  }

  function observeDynamicChanges() {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target);
          continue;
        }
        if (mutation.type === "attributes") {
          translateElementAttributes(mutation.target);
          continue;
        }
        if (mutation.type === "childList") {
          for (var j = 0; j < mutation.addedNodes.length; j += 1) {
            translateTree(mutation.addedNodes[j]);
          }
        }
      }
    });

    observer.observe(document.documentElement || document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS_TO_TRANSLATE
    });
  }

  function translateDocumentTitle() {
    document.title = translateRaw(document.title);
  }

  function applyAll() {
    translateDocumentTitle();
    translateTree(document.body);
  }

  function loadFrJson() {
    return fetch("game_manager/lang/fr.json", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        if (!json || typeof json !== "object") return;
        state.locale = String(json.locale || "fr");
        state.keys = json.keys && typeof json.keys === "object" ? json.keys : Object.create(null);
        state.literals = json.literals && typeof json.literals === "object" ? json.literals : Object.create(null);
      })
      .catch(function () { });
  }

  function t(key, fallback) {
    var k = String(key == null ? "" : key);
    var dictValue = Object.prototype.hasOwnProperty.call(state.keys, k) ? state.keys[k] : undefined;
    if (typeof dictValue === "string") return dictValue;
    return translateRaw(typeof fallback === "string" ? fallback : k);
  }

  state.ready = loadFrJson().then(function () {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        applyAll();
        observeDynamicChanges();
      }, { once: true });
    } else {
      applyAll();
      observeDynamicChanges();
    }
  });

  window.game2I18n = {
    get locale() { return state.locale; },
    ready: state.ready,
    t: t,
    fixText: translateRaw,
    applyAll: applyAll
  };
})();
