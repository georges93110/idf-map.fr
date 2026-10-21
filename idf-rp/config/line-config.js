(function initLineStylesConfig() {
  "use strict";
  // XML attributes: color, textColor, validationSounds (pack name or false),
  // passengerVariation="min,max". All lines are visible in PCC.
  // A route inherits its line's metadata; explicit route attributes override it.
  // reseau selects the sound pack. badgeImage and prefixImage are image URLs, or false to hide them.
  // badge=false + badgeImage: image only. badge=true + badgeImage: logo + chip.
  // Lumiplan example: prefixImage="/idf-rp/lumiplan/source/dist/modes/noctilien.svg".
  // Use prefixImage="false" for no prefix. Relative image links start at the website root.
  // Data lives in lines.xml. Keep this object stable for the existing badge
  // renderers; rebuilding a catalogue also removes entries from the old version.
  var styles = Object.create(null);
  var lookup = Object.create(null);
  function text(value) { return String(value == null ? "" : value).trim(); }
  function token(value) { return text(value).toLocaleLowerCase("fr").replace(/\s+/g, " "); }
  function attr(line, route, name) {
    if (route && route.hasAttribute(name)) return text(route.getAttribute(name));
    return line ? text(line.getAttribute(name)) : "";
  }
  function label(line) {
    return text(line.getAttribute("linename")) || text(line.getAttribute("number")) || text(line.getAttribute("uid"));
  }
  function routeLabel(route) {
    if (route.hasAttribute("linename")) return text(route.getAttribute("linename"));
    var name = text(route.getAttribute("name"));
    // A name without ":" is an itinerary, not a second line identifier.
    return name.includes(":") ? text(name.split(":")[0].replace(/\s*\([^)]*\)/g, "")) : "";
  }
  function stopNames(xml) {
    var stops = new Map();
    Array.prototype.forEach.call(xml.querySelectorAll("busstops > busstop"), function (node) {
      var id = node.querySelector("id"), name = node.querySelector("name");
      if (id) stops.set(Number(id.textContent), {name: text(name && name.textContent)});
    });
    return stops;
  }
  function routeName(line, route, stops) {
    var refs = Array.prototype.slice.call(route.querySelectorAll(":scope > busstop"));
    function name(ref) {
      if (!ref) return "";
      var id = Number(ref.getAttribute("uid"));
      var stop = stops && typeof stops.get === "function" ? stops.get(id) : null;
      return text(stop && stop.name) || String(id);
    }
    var prefix = routeLabel(route) || label(line);
    return prefix + ": " + (refs.length ? name(refs[0]) + " > " + name(refs[refs.length - 1]) : "");
  }
  function image(value) {
    var raw = text(value);
    if (!raw || /^(?:false|0)$/i.test(raw)) return false;
    // XML paths are relative to the website root, not to the requesting widget.
    try {
      var url = new URL(raw, new URL("/", window.location.href));
      return /^https?:$/.test(url.protocol) ? url.href : false;
    } catch (_) { return false; }
  }
  function presentation(entry) {
    if (!entry) return null;
    return {badge: entry.badge !== false, badgeImage: entry.badgeImage || false,
      prefixImage: entry.prefixImage === undefined ? undefined : entry.prefixImage};
  }
  function badgeElement(entry, name, height) {
    if (!entry || !entry.badgeImage) return null;
    var wrap = document.createElement("span");
    wrap.className = "idf-configured-badge";
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;flex-shrink:0;max-width:100%;height:" + (height || 32) + "px";
    var logo = document.createElement("img");
    logo.src = entry.badgeImage; logo.alt = text(name);
    logo.style.cssText = "height:100%;max-width:110px;object-fit:contain";
    wrap.appendChild(logo);
    if (entry.badge !== false) {
      var chip = document.createElement("span");
      chip.textContent = text(name).replace(/^Titus\\s*/i, "");
      chip.style.cssText = "border-radius:4px;padding:2px 7px;font-weight:bold;white-space:nowrap";
      chip.style.background = entry[0]; chip.style.color = entry[1];
      wrap.appendChild(chip);
    }
    return wrap;
  }
  function color(value, fallback) { return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback; }
  function network(value) {
    var name = text(value);
    return /[\\/\x00-\x1f]/.test(name) || name === "." || name === ".." ? "" : name;
  }
  function read(line, route) {
    var values = attr(line, route, "passengerVariation").split(/[;,\s]+/).filter(Boolean).map(Number);
    var variation = values.length === 2 && values.every(Number.isFinite)
      ? [Math.round(Math.min.apply(null, values)), Math.round(Math.max.apply(null, values))] : [0, 0];
    // Sparse projection for existing renderers: URL and per-line audio paths
    // (old slots 2, 3, 5, 6, 7) no longer exist.
    var entry = [];
    entry[0] = color(attr(line, route, "color"), "#3a3a3a");
    entry[1] = color(attr(line, route, "textColor"), "#ffffff");
    var validationPack = network(attr(line, route, "validationSounds"));
    entry[4] = validationPack && !/^(?:false|true|0|1)$/i.test(validationPack) ? validationPack : false;
    entry[8] = variation;
    entry[9] = true;
    entry.reseau = network(attr(line, route, "reseau"));
    entry.badge = !/^(?:false|0)$/i.test(attr(line, route, "badge"));
    entry.badgeImage = image(attr(line, route, "badgeImage"));
    var prefix = attr(line, route, "prefixImage");
    entry.prefixImage = prefix ? image(prefix) : undefined;
    return entry;
  }
  function add(key, entry, replace) {
    key = text(key);
    if (!key || (!replace && lookup[token(key)])) return;
    styles[key] = entry;
    lookup[token(key)] = entry;
  }
  function load(xml) {
    if (!xml || !xml.querySelectorAll || xml.querySelector("parsererror")) throw new Error("lines_xml_invalid");
    Object.keys(styles).forEach(function (key) { delete styles[key]; });
    lookup = Object.create(null);
    var lines = Array.prototype.slice.call(xml.querySelectorAll("lines > line"));
    // Real line names win over incidental route-name aliases.
    lines.forEach(function (line) {
      add(label(line), read(line), true);
    });
    lines.forEach(function (line) {
      Array.prototype.forEach.call(line.querySelectorAll(":scope > route"), function (route) {
        add(routeLabel(route), read(line, route), false);
      });
    });
    return styles;
  }
  function parseXml(source) {
    // Accept the catalogue's legacy unquoted boolean flags only in attributes.
    source = String(source).replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g, function (tag) {
      if (tag.slice(0, 2) === "<!") return tag;
      return tag.replace(/"[^"]*"|'[^']*'|\b(badge|partiel)\s*=\s*(true|false)(?=\s|\/?>)/gi, function (full, key, value) {
        return key ? key + '="' + value.toLowerCase() + '"' : full;
      });
    });
    var xml = new DOMParser().parseFromString(source, "text/xml");
    if (xml.querySelector("parsererror")) throw new Error("lines_xml_invalid");
    return xml;
  }
  window.LINE_STYLES = styles;
  window.IDF_LINE_CONFIG = { read: read, load: load, parseXml: parseXml, network: network, routeLabel: routeLabel,
    routeName: routeName, stopNames: stopNames, image: image, presentation: presentation, badgeElement: badgeElement,
    find: function (name) { return lookup[token(name)] || null; } };
})();
