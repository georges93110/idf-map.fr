/*
 * Game2 runtime chunk: 03-navigation-routing.js
 * Catalogue lignes, graph NAV, calculs de route/ETA.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function selectRouteByReferences(lineReference, routeReference, options) {
        var opts = options && typeof options === "object" ? options : {};
        var rawLineRef = String(lineReference || "").trim();
        var rawRouteRef = String(routeReference || "").trim();
        var uidOnly = !!opts.uidOnly;
        if (!rawRouteRef && rawLineRef.indexOf(":") !== -1) {
          var split = rawLineRef.split(":");
          rawLineRef = String(split[0] || "").trim();
          rawRouteRef = String(split[1] || "").trim();
          uidOnly = true;
        }
        if (!rawLineRef) {
          return {
            ok: false,
            error: "Ligne manquante."
          };
        }
        var line = findLineByReference(rawLineRef, uidOnly, rawRouteRef);
        if (!line) {
          return {
            ok: false,
            error: "Ligne introuvable: " + rawLineRef
          };
        }
        var route = findRouteByReference(line, rawRouteRef, uidOnly);
        if (!route) {
          return {
            ok: false,
            error: "Route introuvable: " + rawRouteRef
          };
        }
        return activateSaeivRouteSelection(line, route, opts);
      }
      window.gameListLineRoutes = function gameListLineRoutes(filterValue) {
        return ensureDbusDataLoaded()
          .then(function () {
            var list = listLineRouteCatalog(filterValue);
            try { console.table(list.slice(0, 250)); } catch (err) {}
            return list;
          })
          .catch(function (err) {
            return {
              ok: false,
              error: String(err && err.message || err || "Chargement DBUS impossible.")
            };
          });
      };
      window.gameSelectLineRoute = function gameSelectLineRoute(lineReference, routeReference, options) {
        var routeRef = routeReference;
        var opts = options;
        if (routeRef && typeof routeRef === "object" && !Array.isArray(routeRef) && (!opts || typeof opts !== "object")) {
          opts = routeRef;
          routeRef = "";
        }
        return Promise.all([
          ensureDbusDataLoaded(),
          ensureNavStopLinksLoaded().catch(function () { return new Map(); })
        ])
          .then(function () {
            var result = selectRouteByReferences(lineReference, routeRef, opts);
            if (!result.ok) {
              try { console.warn("[game] selection route impossible:", result.error); } catch (err) {}
            } else {
              try { console.info("[game] route active:", result); } catch (err) {}
            }
            return result;
          })
          .catch(function (err) {
            var failed = {
              ok: false,
              error: String(err && err.message || err || "Chargement DBUS impossible.")
            };
            try { console.error("[game] erreur selection route:", failed.error); } catch (e) {}
            return failed;
          });
      };
      window.gameSelectLineRouteByUid = function gameSelectLineRouteByUid(lineUid, routeUid, options) {
        var opts = Object.assign({}, options || {}, { uidOnly: true });
        return window.gameSelectLineRoute(lineUid, routeUid, opts);
      };
      window.gameStartSelectedLineRoute = function gameStartSelectedLineRoute() {
        return startSaeivSelectedRoute();
      };
      window.gameClearLineRoute = function gameClearLineRoute() {
        return clearSaeivRouteSelection();
      };
      window.gameGetRouteState = function gameGetRouteState() {
        return buildRouteRuntimeSummary();
      };
      window.gameSetPassengerConfig = function gameSetPassengerConfig(options) {
        if (SAEIV_PASSENGERS_ENABLED !== true) {
          saeivPassengerDefaults = { passengersMin: 0, passengersMax: 0, coefOn: 0 };
          saeivPassengerState = null;
          return Object.assign({}, saeivPassengerDefaults);
        }
        var config = normalizeSaeivPassengerConfig(options, saeivPassengerDefaults);
        saeivPassengerDefaults = config;
        if (saeivPassengerState && typeof saeivPassengerState === "object") {
          saeivPassengerState.passengersMin = config.passengersMin;
          saeivPassengerState.passengersMax = config.passengersMax;
          saeivPassengerState.coefOn = config.coefOn;
          if (saeivRouteState && Array.isArray(saeivRouteState.stops)) {
            resetSaeivPassengerTargetState(saeivRouteState.stops, saeivRouteState.targetIndex);
          }
          saeivLastStateKey = "";
          syncSaeivExternalState(true);
        }
        return Object.assign({}, config);
      };
      window.gameGetPassengerConfig = function gameGetPassengerConfig() {
        return Object.assign({}, normalizeSaeivPassengerConfig(null, saeivPassengerDefaults));
      };
      function parseVersionTag(value) {
        var text = String(value || "").trim();
        var m = /^(\d+)\.(\d+)\.(\d+)([a-z])$/i.exec(text);
        if (!m) return null;
        return {
          raw: String(parseInt(m[1], 10)) + "." + String(parseInt(m[2], 10)) + "." + String(parseInt(m[3], 10)) + String(m[4]).toLowerCase(),
          major: parseInt(m[1], 10),
          minor: parseInt(m[2], 10),
          patch: parseInt(m[3], 10),
          suffix: String(m[4]).toLowerCase()
        };
      }
      function compareVersionTags(a, b) {
        if (a.major !== b.major) return a.major - b.major;
        if (a.minor !== b.minor) return a.minor - b.minor;
        if (a.patch !== b.patch) return a.patch - b.patch;
        if (a.suffix < b.suffix) return -1;
        if (a.suffix > b.suffix) return 1;
        return 0;
      }
      function loadBestNavGraphVersion() {
        return fetch("./map_files/versions.json", { cache: "no-store" })
          .then(function (res) {
            if (!res || !res.ok) return null;
            return res.json();
          })
          .then(function (data) {
            var list = [];
            if (Array.isArray(data)) list = data;
            else if (data && Array.isArray(data.versions)) list = data.versions;
            var parsed = [];
            list.forEach(function (v) {
              var p = parseVersionTag(v);
              if (p) parsed.push(p);
            });
            if (!parsed.length) return null;
            parsed.sort(compareVersionTags);
            return parsed[parsed.length - 1].raw;
          })
          .catch(function () { return null; });
      }
      function loadNavBridgesForVersion(version) {
        var safeVersion = String(version || "").trim();
        if (!safeVersion) return Promise.reject(new Error("version_missing"));
        return fetch("./map_files/" + safeVersion + "/nav_bridges.json", { cache: "no-store" })
          .then(function (res) {
            if (!res || !res.ok) throw new Error("nav_bridges");
            return res.json();
          })
          .then(function (raw) {
            var rules = Array.isArray(raw && raw.rules) ? raw.rules : [];
            return rules.filter(function (rule) {
              return !!rule && rule.enabled !== false;
            });
          });
      }
      function ensureNavBridgesLoaded() {
        if (navBridgeLoaded) return Promise.resolve(navBridgeRules);
        if (navBridgeLoadPromise) return navBridgeLoadPromise;
        navBridgeLoadPromise = loadBestNavGraphVersion()
          .then(function (bestVersion) {
            var candidates = [];
            var primary = String(bestVersion || "").trim();
            if (primary) candidates.push(primary);
            if (candidates.indexOf(DBUS_GAME_FALLBACK_VERSION) === -1) {
              candidates.push(DBUS_GAME_FALLBACK_VERSION);
            }
            function tryVersion(index) {
              if (index >= candidates.length) throw new Error("nav_bridges_unavailable");
              var version = String(candidates[index] || "").trim();
              return loadNavBridgesForVersion(version)
                .then(function (rules) {
                  return {
                    version: version,
                    rules: Array.isArray(rules) ? rules : []
                  };
                })
                .catch(function () {
                  return tryVersion(index + 1);
                });
            }
            return tryVersion(0);
          })
          .then(function (loaded) {
            navBridgeRules = Array.isArray(loaded && loaded.rules) ? loaded.rules : [];
            navBridgeLoadedVersion = String(loaded && loaded.version || "");
            navBridgeLoaded = true;
            navBridgeLoadPromise = null;
            clearActiveRouteCache();
            if (activeBridgeDestinationPoint && lastBridgeArrowPoint) {
              publishActiveRouteFromState(true);
            }
            return navBridgeRules;
          })
          .catch(function () {
            navBridgeRules = [];
            navBridgeLoadedVersion = "";
            navBridgeLoaded = false;
            navBridgeLoadPromise = null;
            return navBridgeRules;
          });
        return navBridgeLoadPromise;
      }
      function parseNavStopLinkEntry(entry) {
        if (!entry || typeof entry !== "object") return null;
        var uid = Number(entry.stop_uid ?? entry.uid ?? entry.id ?? entry.stopId);
        function parseLinkPoint(rawPoint) {
          if (!rawPoint || typeof rawPoint !== "object") return null;
          var px = Number(rawPoint.x ?? rawPoint.X);
          var py = Number(rawPoint.y ?? rawPoint.Y ?? rawPoint.z ?? rawPoint.Z);
          if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
          return { x: px, y: py };
        }
        var rawPoints =
          entry.points ??
          entry.nav_points ??
          entry.route_points ??
          entry.control_points ??
          entry.waypoints ??
          null;
        var points = [];
        if (Array.isArray(rawPoints)) {
          rawPoints.forEach(function (rawPoint) {
            var parsed = Array.isArray(rawPoint)
              ? parseLinkPoint({ x: rawPoint[0], y: rawPoint[1] })
              : parseLinkPoint(rawPoint);
            if (parsed) points.push(parsed);
          });
        }
        if (!points.length) {
          var single = parseLinkPoint(entry);
          if (single) points.push(single);
        }
        if (!Number.isFinite(uid) || !points.length) return null;
        return {
          uid: Math.floor(uid),
          x: points[0].x,
          y: points[0].y,
          points: points
        };
      }
      function loadNavStopLinksForVersion(version) {
        var safeVersion = String(version || "").trim();
        if (!safeVersion) return Promise.reject(new Error("version_missing"));
        return fetch("./map_files/" + safeVersion + "/nav_stop_links.json", { cache: "no-store" })
          .then(function (res) {
            if (!res || !res.ok) throw new Error("nav_stop_links");
            return res.json();
          })
          .then(function (raw) {
            var list = [];
            if (Array.isArray(raw)) list = raw;
            else if (raw && Array.isArray(raw.links)) list = raw.links;
            var out = [];
            for (var i = 0; i < list.length; i += 1) {
              var parsed = parseNavStopLinkEntry(list[i]);
              if (parsed) out.push(parsed);
            }
            return out;
          });
      }
      function applyNavStopLinksToEntries(entries) {
        var list = Array.isArray(entries) ? entries : [];
        for (var i = 0; i < list.length; i += 1) {
          var entry = list[i];
          if (!entry || typeof entry !== "object") continue;
          var uid = Number(entry.uid);
          var link = navStopLinksByUid.get(Math.floor(uid));
          entry.point = { x: Number(entry.X), y: Number(entry.Y), z: Number(entry.Z) };
          if (link && Number.isFinite(link.x) && Number.isFinite(link.y)) {
            var linkedPoints = Array.isArray(link.points)
              ? link.points.map(function (point) { return parseWorldPoint3D(point); }).filter(Boolean)
              : [];
            if (!linkedPoints.length) linkedPoints.push({ x: Number(link.x), y: Number(link.y) });
            entry.navLinkedPoint = {
              x: Number(linkedPoints[0].x),
              y: Number(linkedPoints[0].y)
            };
            entry.navLinkedPoints = linkedPoints;
            entry.navLinked = true;
          } else {
            entry.navLinkedPoint = null;
            entry.navLinkedPoints = [];
            entry.navLinked = false;
          }
        }
      }
      function ensureNavStopLinksLoaded() {
        if (navStopLinksLoaded) return Promise.resolve(navStopLinksByUid);
        if (navStopLinksLoadPromise) return navStopLinksLoadPromise;
        navStopLinksLoadPromise = loadBestNavGraphVersion()
          .then(function (bestVersion) {
            var candidates = [];
            var primary = String(bestVersion || "").trim();
            if (primary) candidates.push(primary);
            if (candidates.indexOf(DBUS_GAME_FALLBACK_VERSION) === -1) {
              candidates.push(DBUS_GAME_FALLBACK_VERSION);
            }
            function tryVersion(index) {
              if (index >= candidates.length) throw new Error("nav_stop_links_unavailable");
              var version = String(candidates[index] || "").trim();
              return loadNavStopLinksForVersion(version)
                .then(function (list) {
                  return {
                    version: version,
                    links: Array.isArray(list) ? list : []
                  };
                })
                .catch(function () {
                  return tryVersion(index + 1);
                });
            }
            return tryVersion(0);
          })
          .then(function (loaded) {
            var nextMap = new Map();
            var links = Array.isArray(loaded && loaded.links) ? loaded.links : [];
            for (var i = 0; i < links.length; i += 1) {
              var item = links[i];
              if (!item) continue;
              var uid = Number(item.uid);
              var x = Number(item.x);
              var y = Number(item.y);
              if (!Number.isFinite(uid) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
              var points = Array.isArray(item.points)
                ? item.points.map(function (point) { return parseWorldPoint3D(point); }).filter(Boolean)
                : [];
              if (!points.length) points.push({ x: x, y: y });
              nextMap.set(Math.floor(uid), { x: x, y: y, points: points });
            }
            navStopLinksByUid = nextMap;
            saeivNavNodesByStopKey.clear();
            navStopLinksLoadedVersion = String(loaded && loaded.version || "");
            navStopLinksLoaded = true;
            navStopLinksLoadPromise = null;

            if (saeivRouteState && Array.isArray(saeivRouteState.stops) && saeivRouteState.stops.length) {
              applyNavStopLinksToEntries(saeivRouteState.stops);
              clearActiveRouteCache();
              if (activeBridgeDestinationPoint && lastBridgeArrowPoint) {
                publishActiveRouteFromState(true);
              }
            }
            return navStopLinksByUid;
          })
          .catch(function () {
            navStopLinksByUid = new Map();
            navStopLinksLoadedVersion = "";
            navStopLinksLoaded = false;
            navStopLinksLoadPromise = null;
            return navStopLinksByUid;
          });
        return navStopLinksLoadPromise;
      }
      function createMinHeap() {
        var arr = [];
        function swap(a, b) {
          var tmp = arr[a];
          arr[a] = arr[b];
          arr[b] = tmp;
        }
        function bubbleUp(index) {
          var i = index;
          while (i > 0) {
            var parent = Math.floor((i - 1) / 2);
            if (arr[parent].f <= arr[i].f) break;
            swap(parent, i);
            i = parent;
          }
        }
        function bubbleDown(index) {
          var i = index;
          for (;;) {
            var left = (i * 2) + 1;
            var right = left + 1;
            var smallest = i;
            if (left < arr.length && arr[left].f < arr[smallest].f) smallest = left;
            if (right < arr.length && arr[right].f < arr[smallest].f) smallest = right;
            if (smallest === i) break;
            swap(i, smallest);
            i = smallest;
          }
        }
        return {
          push: function (item) {
            arr.push(item);
            bubbleUp(arr.length - 1);
          },
          pop: function () {
            if (!arr.length) return null;
            var first = arr[0];
            var last = arr.pop();
            if (arr.length && last) {
              arr[0] = last;
              bubbleDown(0);
            }
            return first;
          },
          size: function () {
            return arr.length;
          }
        };
      }
      function parseWorldPoint3D(rawPoint) {
        if (!rawPoint || typeof rawPoint !== "object") return null;
        var hasZKey =
          Object.prototype.hasOwnProperty.call(rawPoint, "z") ||
          Object.prototype.hasOwnProperty.call(rawPoint, "Z");
        var x = Number(rawPoint.x ?? rawPoint.X);
        var y = Number(hasZKey ? (rawPoint.z ?? rawPoint.Z) : (rawPoint.y ?? rawPoint.Y));
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        var h = Number(rawPoint.h ?? rawPoint.H ?? rawPoint.height ?? rawPoint.alt ?? rawPoint.altitude);
        if (!Number.isFinite(h) && hasZKey) {
          h = Number(rawPoint.y ?? rawPoint.Y);
        }
        var out = { x: x, y: y };
        if (Number.isFinite(h)) out.h = h;
        return out;
      }
      function worldPointDistance(a, b) {
        var pa = parseWorldPoint3D(a);
        var pb = parseWorldPoint3D(b);
        if (!pa || !pb) return Number.POSITIVE_INFINITY;
        var dx = pa.x - pb.x;
        var dy = pa.y - pb.y;
        if (Number.isFinite(pa.h) && Number.isFinite(pb.h)) {
          return Math.hypot(dx, dy, pa.h - pb.h);
        }
        return Math.hypot(dx, dy);
      }
      function worldPolylineDistance(points) {
        var list = Array.isArray(points) ? points : [];
        if (list.length < 2) return 0;
        var total = 0;
        for (var i = 1; i < list.length; i += 1) {
          var seg = worldPointDistance(list[i - 1], list[i]);
          if (!Number.isFinite(seg)) continue;
          total += seg;
        }
        return total;
      }
      function truncateWorldPolylineFromStart(points, maxDistance) {
        var list = Array.isArray(points) ? points : [];
        var limit = Number(maxDistance);
        if (list.length < 2 || !Number.isFinite(limit) || limit <= 0) return list.slice();
        var out = [];
        appendUniqueWorldPoint(out, list[0]);
        var traversed = 0;
        for (var i = 1; i < list.length; i += 1) {
          var prev = parseWorldPoint3D(list[i - 1]);
          var curr = parseWorldPoint3D(list[i]);
          if (!prev || !curr) continue;
          var segLen = worldPointDistance(prev, curr);
          if (!Number.isFinite(segLen) || segLen <= 0.0001) {
            appendUniqueWorldPoint(out, curr);
            continue;
          }
          if ((traversed + segLen) <= limit) {
            appendUniqueWorldPoint(out, curr);
            traversed += segLen;
            continue;
          }
          var remain = Math.max(0, limit - traversed);
          var t = remain / segLen;
          t = Math.max(0, Math.min(1, t));
          var cut = {
            x: prev.x + ((curr.x - prev.x) * t),
            y: prev.y + ((curr.y - prev.y) * t)
          };
          if (Number.isFinite(prev.h) && Number.isFinite(curr.h)) {
            cut.h = prev.h + ((curr.h - prev.h) * t);
          }
          appendUniqueWorldPoint(out, cut);
          break;
        }
        if (out.length < 2) {
          appendUniqueWorldPoint(out, list[1]);
        }
        return out;
      }
      function worldPointToSegmentDistance(point, segStart, segEnd) {
        var p = parseWorldPoint3D(point);
        var a = parseWorldPoint3D(segStart);
        var b = parseWorldPoint3D(segEnd);
        if (!p || !a || !b) return Number.POSITIVE_INFINITY;
        var ax = a.x;
        var ay = a.y;
        var bx = b.x;
        var by = b.y;
        var px = p.x;
        var py = p.y;
        var dx = bx - ax;
        var dy = by - ay;
        var len2 = (dx * dx) + (dy * dy);
        if (!Number.isFinite(len2) || len2 <= 1e-9) return worldPointDistance(p, a);
        var t = ((px - ax) * dx + (py - ay) * dy) / len2;
        if (!Number.isFinite(t)) t = 0;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        var proj = { x: ax + (t * dx), y: ay + (t * dy) };
        if (Number.isFinite(a.h) && Number.isFinite(b.h)) {
          proj.h = Number(a.h) + (t * (Number(b.h) - Number(a.h)));
        }
        return worldPointDistance(p, proj);
      }
      function worldPointToPolylineMinDistance(point, polyline) {
        var p = parseWorldPoint3D(point);
        var list = Array.isArray(polyline) ? polyline : [];
        if (!p || list.length < 2) return Number.POSITIVE_INFINITY;
        var best = Number.POSITIVE_INFINITY;
        for (var i = 1; i < list.length; i += 1) {
          var segDist = worldPointToSegmentDistance(p, list[i - 1], list[i]);
          if (segDist < best) best = segDist;
        }
        return best;
      }
      function appendUniqueWorldPoint(target, point) {
        var parsed = parseWorldPoint3D(point);
        if (!parsed) return;
        var last = target[target.length - 1];
        if (last) {
          var sameXY = Math.abs(Number(last.x) - parsed.x) < 0.001 && Math.abs(Number(last.y) - parsed.y) < 0.001;
          var hasH = Number.isFinite(parsed.h);
          var lastHasH = Number.isFinite(Number(last.h));
          var sameH = (!hasH && !lastHasH) || (hasH && lastHasH && Math.abs(Number(last.h) - parsed.h) < 0.001);
          if (sameXY && sameH) return;
        }
        var out = { x: parsed.x, y: parsed.y };
        if (Number.isFinite(parsed.h)) out.h = parsed.h;
        target.push(out);
      }
      function cloneWorldPolyline(points) {
        var src = Array.isArray(points) ? points : [];
        var out = [];
        for (var i = 0; i < src.length; i += 1) appendUniqueWorldPoint(out, src[i]);
        return out;
      }
      function findNearestWorldPointMatch(points, worldPoint, maxDistance) {
        var list = Array.isArray(points) ? points : [];
        var refPoint = parseWorldPoint3D(worldPoint);
        var limit = Number(maxDistance);
        if (!Number.isFinite(limit) || limit <= 0) limit = Number.POSITIVE_INFINITY;
        if (!list.length || !refPoint) {
          return { index: -1, distance: Number.POSITIVE_INFINITY };
        }
        var bestIndex = -1;
        var bestDistance = Number.POSITIVE_INFINITY;
        for (var i = 0; i < list.length; i += 1) {
          var point = list[i];
          if (!point) continue;
          var dist = worldPointDistance(point, refPoint);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = i;
          }
        }
        if (!Number.isFinite(bestDistance) || bestDistance > limit) {
          return { index: -1, distance: bestDistance };
        }
        return { index: bestIndex, distance: bestDistance };
      }
      function parseNavBridgeControlPoints(rawList) {
        var list = Array.isArray(rawList) ? rawList : [];
        var out = [];
        for (var i = 0; i < list.length; i += 1) {
          var point = parseWorldPoint3D(list[i]);
          if (!point) continue;
          out.push(point);
        }
        return out;
      }
      function normalizeNavBridgePointPair(raw) {
        if (!raw || typeof raw !== "object") return null;
        var from = parseWorldPoint3D(raw.from ?? raw.start ?? raw.a);
        var to = parseWorldPoint3D(raw.to ?? raw.end ?? raw.b);
        if (!from || !to) return null;
        return { from: from, to: to };
      }
      function anchorNavBridgePointChain(points, options) {
        var source = Array.isArray(points) ? points : [];
        if (!source.length) return [];
        var opts = options && typeof options === "object" ? options : {};
        var out = [];
        var anchorStart = parseWorldPoint3D(opts.anchorStart);
        var anchorEnd = parseWorldPoint3D(opts.anchorEnd);
        if (anchorStart) appendUniqueWorldPoint(out, anchorStart);
        for (var i = 0; i < source.length; i += 1) appendUniqueWorldPoint(out, source[i]);
        if (anchorEnd) appendUniqueWorldPoint(out, anchorEnd);
        return out;
      }
      function getNavGraphNodeWorldPoint(nodeId) {
        var id = Number(nodeId);
        if (!Number.isFinite(id) || !navGraph || !navGraph.nodesById) return null;
        var node = navGraph.nodesById.get(id);
        if (!node) return null;
        var out = { x: Number(node.x), y: Number(node.y) };
        if (Number.isFinite(Number(node.h))) out.h = Number(node.h);
        return out;
      }
      function getSaeivStopWorldPoint(stop) {
        if (!stop || typeof stop !== "object") return null;
        var byPoint = parseWorldPoint3D(stop.point);
        if (byPoint) return byPoint;
        var x = Number(stop.X);
        var y = Number(stop.Z);
        var h = Number(stop.Y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        var out = { x: x, y: y };
        if (Number.isFinite(h)) out.h = h;
        return out;
      }
      function getSaeivStopExactWorldPoint(stop) {
        if (!stop || typeof stop !== "object") return null;
        var x = Number(stop.X);
        var y = Number(stop.Z);
        var h = Number(stop.Y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        var out = { x: x, y: y };
        if (Number.isFinite(h)) out.h = h;
        return out;
      }
      function getSaeivStopNavWorldPoint(stop) {
        if (!stop || typeof stop !== "object") return null;
        var exact = getSaeivStopExactWorldPoint(stop);
        var point = parseWorldPoint3D(stop.navLinkedPoint) || parseWorldPoint3D(stop.point) || exact;
        if (point && !Number.isFinite(point.h) && exact && Number.isFinite(exact.h)) {
          point.h = exact.h;
        }
        return point;
      }
      function getSaeivStopNavLinkPoints(stop) {
        if (!stop || typeof stop !== "object") return [];
        var exact = getSaeivStopExactWorldPoint(stop);
        var source = Array.isArray(stop.navLinkedPoints) ? stop.navLinkedPoints : [];
        var points = source.map(function (point) { return parseWorldPoint3D(point); }).filter(Boolean);
        if (!points.length) {
          var single = parseWorldPoint3D(stop.navLinkedPoint);
          if (single) points.push(single);
        }
        if (exact && Number.isFinite(exact.h)) {
          points.forEach(function (point) {
            if (!Number.isFinite(point.h)) point.h = exact.h;
          });
        }
        return points;
      }
      function getSaeivStopRouteEntryWorldPoint(stop) {
        var links = getSaeivStopNavLinkPoints(stop);
        if (links.length) return links[0];
        return getSaeivStopNavWorldPoint(stop) || getSaeivStopExactWorldPoint(stop);
      }
      function getSaeivStopRouteExitWorldPoint(stop) {
        var links = getSaeivStopNavLinkPoints(stop);
        if (links.length) return links[links.length - 1];
        return getSaeivStopNavWorldPoint(stop) || getSaeivStopExactWorldPoint(stop);
      }
      function getSaeivStopRouteEndWorldPoint(stop) {
        var links = getSaeivStopNavLinkPoints(stop);
        if (links.length) return links[links.length - 1];
        return getSaeivStopExactWorldPoint(stop) || getSaeivStopNavWorldPoint(stop);
      }
      function getSaeivStopNavCacheKey(stop, limit, mode) {
        if (!stop || typeof stop !== "object") return "";
        var uid = Number(stop.uid ?? stop.id);
        var nav = String(mode || "") === "from"
          ? getSaeivStopRouteExitWorldPoint(stop)
          : getSaeivStopRouteEntryWorldPoint(stop);
        nav = nav || getSaeivStopExactWorldPoint(stop);
        if (!nav) return "";
        return [
          Number.isFinite(uid) ? Math.floor(uid) : "x",
          String(mode || "to"),
          Number(nav.x).toFixed(3),
          Number(nav.y).toFixed(3),
          String(Math.max(1, Math.floor(Number(limit) || SAEIV_NAV_STOP_CANDIDATES)))
        ].join("|");
      }
      function getNearestSaeivNavNodesForStop(stop, limit, mode) {
        if (!navGraph || !stop) return [];
        var maxCount = Math.max(1, Math.floor(Number(limit) || SAEIV_NAV_STOP_CANDIDATES));
        var directionMode = String(mode || "to") === "from" ? "from" : "to";
        var cacheKey = getSaeivStopNavCacheKey(stop, maxCount, directionMode);
        if (cacheKey && saeivNavNodesByStopKey.has(cacheKey)) {
          return (saeivNavNodesByStopKey.get(cacheKey) || []).slice(0, maxCount);
        }
        var stopPoint = directionMode === "from"
          ? getSaeivStopRouteExitWorldPoint(stop)
          : getSaeivStopRouteEntryWorldPoint(stop);
        stopPoint = stopPoint || getSaeivStopExactWorldPoint(stop);
        if (!stopPoint) return [];
        var candidates = [];
        for (var i = 0; i < navGraph.nodeList.length; i += 1) {
          var node = navGraph.nodeList[i];
          var dist = worldPointDistance(node, stopPoint);
          if (dist > SAEIV_NAV_STOP_SNAP_DISTANCE) continue;
          candidates.push({ nodeId: Number(node.id), distance: dist });
        }
        candidates.sort(function (a, b) { return a.distance - b.distance; });
        var out = candidates.slice(0, maxCount);
        if (cacheKey) saeivNavNodesByStopKey.set(cacheKey, out);
        return out.slice();
      }
      function pickBestSaeivNavSegment(fromStop, toStop, options) {
        var fromCandidates = getNearestSaeivNavNodesForStop(fromStop, SAEIV_NAV_STOP_CANDIDATES, "from");
        var toCandidates = getNearestSaeivNavNodesForStop(toStop, SAEIV_NAV_STOP_CANDIDATES, "to");
        if (!navGraph || !fromCandidates.length || !toCandidates.length) return null;
        var best = null;
        for (var i = 0; i < fromCandidates.length; i += 1) {
          var fromCandidate = fromCandidates[i];
          for (var j = 0; j < toCandidates.length; j += 1) {
            var toCandidate = toCandidates[j];
            var path = null;
            if (fromCandidate.nodeId === toCandidate.nodeId) {
              var node = navGraph.nodesById.get(fromCandidate.nodeId);
              if (!node) continue;
              var nodePoint = { x: Number(node.x), y: Number(node.y) };
              if (Number.isFinite(Number(node.h))) nodePoint.h = Number(node.h);
              path = { points: [nodePoint], cost: 0 };
            } else {
              path = getPathBetweenNodes(fromCandidate.nodeId, toCandidate.nodeId, options);
              if (!path) continue;
            }
            var cost = (Number(path && path.cost) || 0) + fromCandidate.distance + toCandidate.distance;
            if (!best || cost < best.cost) best = { cost: cost, path: path };
          }
        }
        return best;
      }
      function buildSaeivWorldPolylineFromStops(routeStops, startIndex, endIndex, options) {
        var stops = Array.isArray(routeStops) ? routeStops : [];
        if (!stops.length) return [];
        var start = Math.max(0, Math.min(stops.length - 1, Math.floor(Number(startIndex) || 0)));
        var end = Math.max(0, Math.min(stops.length - 1, Math.floor(Number(endIndex) || 0)));
        if (start > end) return [];
        var worldPoints = [];
        if (start === end) {
          appendUniqueWorldPoint(worldPoints, getSaeivStopExactWorldPoint(stops[start]));
          return worldPoints;
        }
        for (var i = start; i < end; i += 1) {
          var fromStop = stops[i];
          var toStop = stops[i + 1];
          if (!fromStop || !toStop) continue;
          var fromExact = getSaeivStopExactWorldPoint(fromStop);
          var toExact = getSaeivStopExactWorldPoint(toStop);
          var fromLinkPoints = getSaeivStopNavLinkPoints(fromStop);
          var toLinkPoints = getSaeivStopNavLinkPoints(toStop);
          var fromNav = getSaeivStopRouteExitWorldPoint(fromStop) || fromExact;
          var toNav = getSaeivStopRouteEntryWorldPoint(toStop) || toExact;
          if (i === start) appendUniqueWorldPoint(worldPoints, fromLinkPoints.length ? fromNav : fromExact);
          if (fromNav) appendUniqueWorldPoint(worldPoints, fromNav);
          var segment = pickBestSaeivNavSegment(fromStop, toStop, options);
          if (segment && segment.path && Array.isArray(segment.path.points) && segment.path.points.length) {
            segment.path.points.forEach(function (point) {
              appendUniqueWorldPoint(worldPoints, point);
            });
          } else {
            appendUniqueWorldPoint(worldPoints, fromNav || fromExact);
            appendUniqueWorldPoint(worldPoints, toNav || toExact);
          }
          if (toLinkPoints.length) {
            toLinkPoints.forEach(function (point) {
              appendUniqueWorldPoint(worldPoints, point);
            });
          } else {
            if (toNav) appendUniqueWorldPoint(worldPoints, toNav);
            appendUniqueWorldPoint(worldPoints, toExact);
          }
        }
        return worldPoints;
      }
      function buildNavBridgeForcedChainWorldPoints(edgeIdChain, options) {
        if (!navGraph) return null;
        var ids = Array.isArray(edgeIdChain)
          ? edgeIdChain.map(function (id) { return Number(id); }).filter(function (id) { return Number.isFinite(id); })
          : [];
        if (!ids.length) return null;
        var opts = options && typeof options === "object" ? options : {};
        var anchorStart = parseWorldPoint3D(opts.anchorStart);
        var anchorEnd = parseWorldPoint3D(opts.anchorEnd);
        var out = [];
        var previous = anchorStart;
        var allEdgesReversible = true;
        for (var i = 0; i < ids.length; i += 1) {
          var edge = navGraph.edgesById && navGraph.edgesById.get(ids[i]);
          if (!edge) return null;
          if (edge.oneWay) allEdgesReversible = false;
          var raw = Array.isArray(edge.polyline)
            ? edge.polyline.map(function (pt) { return parseWorldPoint3D(pt); }).filter(Boolean)
            : [];
          if (raw.length < 2) continue;
          var reversed = raw.slice().reverse();
          var chosen = raw;
          if (previous) {
            var distForward = worldPointDistance(raw[0], previous);
            var distReverse = worldPointDistance(reversed[0], previous);
            if (distReverse < distForward) {
              if (edge.oneWay) return null;
              chosen = reversed;
            }
          }
          chosen.forEach(function (point) { appendUniqueWorldPoint(out, point); });
          previous = out[out.length - 1] || previous;
        }
        if (!out.length) return null;
        if (anchorStart && anchorEnd && out.length >= 2) {
          var first = out[0];
          var last = out[out.length - 1];
          var directCost = worldPointDistance(first, anchorStart) + worldPointDistance(last, anchorEnd);
          var reverseCost = worldPointDistance(last, anchorStart) + worldPointDistance(first, anchorEnd);
          if (reverseCost < directCost) {
            if (!allEdgesReversible) return null;
            out = out.slice().reverse();
          }
        }
        if (anchorStart) {
          var firstPoint = out[0];
          if (!firstPoint || worldPointDistance(firstPoint, anchorStart) > 0.001) {
            var withStart = [];
            appendUniqueWorldPoint(withStart, anchorStart);
            out.forEach(function (point) { appendUniqueWorldPoint(withStart, point); });
            out = withStart;
          }
        }
        if (anchorEnd) {
          var lastPoint = out[out.length - 1];
          if (!lastPoint || worldPointDistance(lastPoint, anchorEnd) > 0.001) appendUniqueWorldPoint(out, anchorEnd);
        }
        return out;
      }
      function canReverseNavBridgeEdgeChain(edgeIdChain) {
        if (!navGraph) return false;
        var ids = Array.isArray(edgeIdChain)
          ? edgeIdChain.map(function (id) { return Number(id); }).filter(function (id) { return Number.isFinite(id); })
          : [];
        if (!ids.length) return false;
        for (var i = 0; i < ids.length; i += 1) {
          var edge = navGraph.edgesById && navGraph.edgesById.get(ids[i]);
          if (!edge || edge.oneWay) return false;
        }
        return true;
      }
      function buildNavBridgeForcedNodeChainWorldPoints(nodeIdChain, navOptions, options) {
        if (!navGraph) return null;
        var ids = Array.isArray(nodeIdChain)
          ? nodeIdChain.map(function (id) { return Number(id); }).filter(function (id) { return Number.isFinite(id); })
          : [];
        if (ids.length < 2) return null;
        var opts = options && typeof options === "object" ? options : {};
        var anchorStart = parseWorldPoint3D(opts.anchorStart);
        var anchorEnd = parseWorldPoint3D(opts.anchorEnd);
        var out = [];
        for (var i = 0; i < ids.length - 1; i += 1) {
          var fromId = ids[i];
          var toId = ids[i + 1];
          var fromNode = navGraph.nodesById.get(fromId);
          var toNode = navGraph.nodesById.get(toId);
          if (!fromNode || !toNode) return null;
          if (i === 0) appendUniqueWorldPoint(out, fromNode);
          var path = getPathBetweenNodes(fromId, toId, navOptions);
          if (path && Array.isArray(path.points) && path.points.length >= 2) {
            path.points.forEach(function (point) { appendUniqueWorldPoint(out, point); });
          } else {
            return null;
          }
          appendUniqueWorldPoint(out, toNode);
        }
        if (!out.length) return null;
        if (anchorStart) {
          var first = out[0];
          if (!first || worldPointDistance(first, anchorStart) > 0.001) {
            var nextOut = [];
            appendUniqueWorldPoint(nextOut, anchorStart);
            out.forEach(function (point) { appendUniqueWorldPoint(nextOut, point); });
            out = nextOut;
          }
        }
        if (anchorEnd) {
          var last = out[out.length - 1];
          if (!last || worldPointDistance(last, anchorEnd) > 0.001) appendUniqueWorldPoint(out, anchorEnd);
        }
        return out;
      }
      function mapNavBridgePointsToNodeIds(points, maxDistance) {
        var list = Array.isArray(points) ? points : [];
        var limit = Number(maxDistance);
        if (!Number.isFinite(limit) || limit <= 0) limit = SAEIV_NAV_STOP_SNAP_DISTANCE * 6;
        if (!list.length) return null;
        var out = [];
        for (var i = 0; i < list.length; i += 1) {
          var nodeId = getNearestNodeIdForPoint(list[i], limit);
          if (!Number.isFinite(nodeId)) return null;
          out.push(nodeId);
        }
        return out;
      }
      function resolveNavBridgeRefPoints(rawValue) {
        var out = [];
        function pushOne(value) {
          if (value == null) return;
          if (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))) {
            var nodePoint = getNavGraphNodeWorldPoint(Number(value));
            if (nodePoint) out.push(nodePoint);
            return;
          }
          var point = parseWorldPoint3D(value);
          if (point) out.push(point);
        }
        if (Array.isArray(rawValue)) {
          rawValue.forEach(function (value) { pushOne(value); });
        } else {
          pushOne(rawValue);
        }
        return out;
      }
      function parseNavBridgeControlNodeIds(rawValue) {
        if (Array.isArray(rawValue)) {
          return rawValue.map(function (value) { return Number(value); }).filter(function (value) { return Number.isFinite(value); });
        }
        if (Number.isFinite(Number(rawValue))) return [Number(rawValue)];
        var text = String(rawValue || "").trim();
        if (!text) return [];
        return text
          .split(/[;,\s]+/g)
          .map(function (value) { return Number(value); })
          .filter(function (value) { return Number.isFinite(value); });
      }
      function buildNavBridgeControlPoints(entry, navOptions, options) {
        if (!entry || typeof entry !== "object") return [];
        var opts = options && typeof options === "object" ? options : {};
        var points = parseNavBridgeControlPoints(entry.points ?? entry.control_points);
        var nodeIds = parseNavBridgeControlNodeIds(entry.node_ids ?? entry.control_nodes ?? entry.control_node_ids ?? entry.node_ids_csv);
        var forceDirectLinks =
          entry.force_direct_links === true ||
          entry.force_direct === true ||
          entry.ignore_existing_paths === true;
        if (points.length) {
          if (forceDirectLinks) return points;
          if (points.length >= 2) {
            var snappedNodeIds = mapNavBridgePointsToNodeIds(points);
            if (snappedNodeIds && snappedNodeIds.length === points.length) {
              var chain = buildNavBridgeForcedNodeChainWorldPoints(snappedNodeIds, navOptions, {
                anchorStart: opts.anchorStart || null,
                anchorEnd: opts.anchorEnd || null
              });
              if (chain && chain.length) return chain;
              return [];
            }
          }
          return points;
        }
        if (forceDirectLinks) {
          return nodeIds.map(function (id) { return getNavGraphNodeWorldPoint(id); }).filter(Boolean);
        }
        if (nodeIds.length >= 2) {
          var nodeChain = buildNavBridgeForcedNodeChainWorldPoints(nodeIds, navOptions, {
            anchorStart: opts.anchorStart || null,
            anchorEnd: opts.anchorEnd || null
          });
          if (nodeChain && nodeChain.length) return nodeChain;
          return [];
        }
        return nodeIds.map(function (id) { return getNavGraphNodeWorldPoint(id); }).filter(Boolean);
      }
      function removeNavBridgeIgnoredNodes(worldPoints, ignoredRefs) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        var ignoredPoints = resolveNavBridgeRefPoints(ignoredRefs);
        if (!ignoredPoints.length) return { points: base, removedCount: 0 };
        var out = [];
        var removedCount = 0;
        var threshold = 1.5;
        for (var i = 0; i < base.length; i += 1) {
          var point = base[i];
          if (!point) continue;
          var shouldRemove = false;
          for (var j = 0; j < ignoredPoints.length; j += 1) {
            if (worldPointDistance(point, ignoredPoints[j]) <= threshold) {
              shouldRemove = true;
              break;
            }
          }
          if (shouldRemove) {
            removedCount += 1;
            continue;
          }
          appendUniqueWorldPoint(out, point);
        }
        if (out.length < 2) return { points: base, removedCount: 0 };
        return { points: out, removedCount: removedCount };
      }
      function insertNavBridgeControlPointsAtIndex(worldPoints, insertIndex, controlPoints, mode) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        var points = Array.isArray(controlPoints) ? controlPoints : [];
        if (!base.length || !points.length) return null;
        var idx = Math.max(0, Math.min(base.length - 1, Math.floor(Number(insertIndex) || 0)));
        var beforeMode = String(mode || "").toLowerCase() === "before";
        var merged = [];
        for (var i = 0; i < base.length; i += 1) {
          if (beforeMode && i === idx) {
            for (var b = 0; b < points.length; b += 1) appendUniqueWorldPoint(merged, points[b]);
          }
          appendUniqueWorldPoint(merged, base[i]);
          if (!beforeMode && i === idx) {
            for (var a = 0; a < points.length; a += 1) appendUniqueWorldPoint(merged, points[a]);
          }
        }
        return merged.length >= 2 ? merged : null;
      }
      function insertNavBridgeControlPointsRelativeToPoint(worldPoints, worldPoint, controlPoints, mode) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        if (base.length < 2) return null;
        var refPoint = parseWorldPoint3D(worldPoint);
        if (!refPoint) return null;
        var match = findNearestWorldPointMatch(base, refPoint, NAV_GRAPH_MAX_SNAP_DISTANCE * 10);
        if (!(match.index >= 0)) return null;
        return insertNavBridgeControlPointsAtIndex(base, match.index, controlPoints, mode);
      }
      function insertNavBridgeControlPointsRelativeToStop(worldPoints, routeStops, stopNumber, controlPoints, mode) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        var stops = Array.isArray(routeStops) ? routeStops : [];
        if (base.length < 2 || !stops.length) return null;
        var stopIndex = Math.floor(Number(stopNumber)) - 1;
        if (!(stopIndex >= 0 && stopIndex < stops.length)) return null;
        var stopPoint = getSaeivStopWorldPoint(stops[stopIndex]);
        if (!stopPoint) return null;
        var match = findNearestWorldPointMatch(base, stopPoint, NAV_GRAPH_MAX_SNAP_DISTANCE * 10);
        if (!(match.index >= 0)) return null;
        return insertNavBridgeControlPointsAtIndex(base, match.index, controlPoints, mode);
      }
      function resolveNavBridgeNodeRefPoint(operation, mode) {
        var op = operation && typeof operation === "object" ? operation : {};
        var nodeRef = null;
        if (mode === "after") {
          nodeRef = op.node ?? op.after_node ?? op.node_point ?? op.after_point;
        } else {
          nodeRef = op.node ?? op.before_node ?? op.node_point ?? op.before_point;
        }
        var nodeId = Number(nodeRef);
        if (Number.isFinite(nodeId)) {
          var nodePoint = getNavGraphNodeWorldPoint(nodeId);
          if (nodePoint) return nodePoint;
        }
        return parseWorldPoint3D(nodeRef);
      }
      function applyNavBridgeInsertionOperation(worldPoints, routeStops, operation) {
        if (!operation || typeof operation !== "object") return null;
        var position = String(operation.position || "").trim().toLowerCase();
        var controlPoints = parseNavBridgeControlPoints(operation.points ?? operation.control_points);
        if (!controlPoints.length) return null;
        if (position === "after_node") {
          return insertNavBridgeControlPointsRelativeToPoint(
            worldPoints,
            resolveNavBridgeNodeRefPoint(operation, "after"),
            controlPoints,
            "after"
          );
        }
        if (position === "before_node") {
          return insertNavBridgeControlPointsRelativeToPoint(
            worldPoints,
            resolveNavBridgeNodeRefPoint(operation, "before"),
            controlPoints,
            "before"
          );
        }
        if (position === "after_point") {
          return insertNavBridgeControlPointsRelativeToPoint(
            worldPoints,
            operation.point ?? operation.after_point,
            controlPoints,
            "after"
          );
        }
        if (position === "before_point") {
          return insertNavBridgeControlPointsRelativeToPoint(
            worldPoints,
            operation.point ?? operation.before_point,
            controlPoints,
            "before"
          );
        }
        if (position === "after_stop") {
          return insertNavBridgeControlPointsRelativeToStop(
            worldPoints,
            routeStops,
            operation.stop_number ?? operation.stop ?? operation.after_stop,
            controlPoints,
            "after"
          );
        }
        if (position === "before_stop") {
          return insertNavBridgeControlPointsRelativeToStop(
            worldPoints,
            routeStops,
            operation.stop_number ?? operation.stop ?? operation.before_stop,
            controlPoints,
            "before"
          );
        }
        return null;
      }
      function getNavBridgeOptionsForRule(bridgeRule) {
        var blockedEdgeIds = new Set(
          (Array.isArray(bridgeRule && bridgeRule.remove_links) ? bridgeRule.remove_links : [])
            .map(function (id) { return Number(id); })
            .filter(function (id) { return Number.isFinite(id); })
        );
        return blockedEdgeIds.size ? { blockedEdgeIds: blockedEdgeIds } : null;
      }
      function insertNavBridgeControlPointsAtIndexDetailed(worldPoints, insertIndex, controlPoints, mode) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        var points = Array.isArray(controlPoints) ? controlPoints : [];
        if (!base.length || !points.length) return null;
        var idx = Math.max(0, Math.min(base.length - 1, Math.floor(Number(insertIndex) || 0)));
        var beforeMode = String(mode || "").toLowerCase() === "before";
        var merged = [];
        for (var i = 0; i < base.length; i += 1) {
          if (beforeMode && i === idx) {
            points.forEach(function (point) { appendUniqueWorldPoint(merged, point); });
          }
          appendUniqueWorldPoint(merged, base[i]);
          if (!beforeMode && i === idx) {
            points.forEach(function (point) { appendUniqueWorldPoint(merged, point); });
          }
        }
        if (merged.length < 2) return null;
        return { points: merged, insertedAtIndex: idx, insertedCount: points.length };
      }
      function insertNavBridgeControlPointsRelativeToPointDetailed(worldPoints, worldPoint, controlPointsEntry, mode, navOptions) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        if (!base.length) return null;
        var refPoint = parseWorldPoint3D(worldPoint);
        if (!refPoint) return null;
        var match = findNearestWorldPointMatch(base, refPoint, SAEIV_NAV_STOP_SNAP_DISTANCE * 10);
        if (!(match.index >= 0)) return null;
        var points = buildNavBridgeControlPoints(controlPointsEntry, navOptions, {
          anchorStart: String(mode || "").toLowerCase() === "after" ? base[match.index] : null,
          anchorEnd: String(mode || "").toLowerCase() === "before" ? base[match.index] : null
        });
        if (!points.length) return null;
        var inserted = insertNavBridgeControlPointsAtIndexDetailed(base, match.index, points, mode);
        if (!inserted) return null;
        inserted.matchIndex = match.index;
        inserted.pointDistance = match.distance;
        return inserted;
      }
      function insertNavBridgeControlPointsRelativeToNodeDetailed(worldPoints, nodeId, controlPointsEntry, mode, navOptions) {
        var nodePoint = getNavGraphNodeWorldPoint(nodeId);
        if (!nodePoint) return null;
        var inserted = insertNavBridgeControlPointsRelativeToPointDetailed(worldPoints, nodePoint, controlPointsEntry, mode, navOptions);
        if (!inserted) return null;
        inserted.nodeDistance = inserted.pointDistance;
        return inserted;
      }
      function insertNavBridgeControlPointsRelativeToStopDetailed(worldPoints, routeStops, stopNumber, controlPointsEntry, mode, navOptions) {
        var stops = Array.isArray(routeStops) ? routeStops : [];
        if (!stops.length) return null;
        var stopIndex = Math.floor(Number(stopNumber)) - 1;
        if (!(stopIndex >= 0 && stopIndex < stops.length)) return null;
        var stopPoint = getSaeivStopExactWorldPoint(stops[stopIndex]);
        if (!stopPoint) return null;
        var inserted = insertNavBridgeControlPointsRelativeToPointDetailed(worldPoints, stopPoint, controlPointsEntry, mode, navOptions);
        if (!inserted) return null;
        inserted.stopIndex = stopIndex;
        inserted.stopDistance = inserted.pointDistance;
        return inserted;
      }
      function applyNavBridgeInsertionOperationDetailed(worldPoints, routeStops, operation, navOptions) {
        if (!operation || typeof operation !== "object") return null;
        var ignoredRefs =
          operation.ignore_points ??
          operation.ignore_point ??
          operation.ignore_node_ids ??
          operation.ignore_nodes ??
          operation.ignore_node;
        var cleaned = removeNavBridgeIgnoredNodes(worldPoints, ignoredRefs);
        var basePoints = cleaned.points;
        var position = String(operation.position || "").trim().toLowerCase();
        var inserted = null;
        if (position === "after_node") {
          var afterNodeRef = operation.node ?? operation.after_node ?? operation.node_point ?? operation.after_point;
          var afterNodeId = Number(afterNodeRef);
          inserted = Number.isFinite(afterNodeId)
            ? insertNavBridgeControlPointsRelativeToNodeDetailed(basePoints, afterNodeId, operation, "after", navOptions)
            : insertNavBridgeControlPointsRelativeToPointDetailed(basePoints, parseWorldPoint3D(afterNodeRef), operation, "after", navOptions);
        } else if (position === "after_point") {
          inserted = insertNavBridgeControlPointsRelativeToPointDetailed(basePoints, operation.point ?? operation.after_point, operation, "after", navOptions);
        } else if (position === "before_node") {
          var beforeNodeRef = operation.node ?? operation.before_node ?? operation.node_point ?? operation.before_point;
          var beforeNodeId = Number(beforeNodeRef);
          inserted = Number.isFinite(beforeNodeId)
            ? insertNavBridgeControlPointsRelativeToNodeDetailed(basePoints, beforeNodeId, operation, "before", navOptions)
            : insertNavBridgeControlPointsRelativeToPointDetailed(basePoints, parseWorldPoint3D(beforeNodeRef), operation, "before", navOptions);
        } else if (position === "before_point") {
          inserted = insertNavBridgeControlPointsRelativeToPointDetailed(basePoints, operation.point ?? operation.before_point, operation, "before", navOptions);
        } else if (position === "after_stop") {
          inserted = insertNavBridgeControlPointsRelativeToStopDetailed(
            basePoints,
            routeStops,
            operation.stop_number ?? operation.stop ?? operation.after_stop,
            operation,
            "after",
            navOptions
          );
        } else if (position === "before_stop") {
          inserted = insertNavBridgeControlPointsRelativeToStopDetailed(
            basePoints,
            routeStops,
            operation.stop_number ?? operation.stop ?? operation.before_stop,
            operation,
            "before",
            navOptions
          );
        }
        if (inserted && cleaned.removedCount > 0) inserted.ignoredRemovedCount = cleaned.removedCount;
        return inserted;
      }
      function findNearestSaeivRouteStopIndex(routeStops, worldPoint, maxDistance) {
        var stops = Array.isArray(routeStops) ? routeStops : [];
        var ref = parseWorldPoint3D(worldPoint);
        if (!stops.length || !ref) return -1;
        var limit = Number(maxDistance);
        if (!Number.isFinite(limit) || limit <= 0) limit = SAEIV_NAV_STOP_SNAP_DISTANCE * 3;
        var bestIndex = -1;
        var bestDistance = Number.POSITIVE_INFINITY;
        for (var i = 0; i < stops.length; i += 1) {
          var stopPoint = getSaeivStopExactWorldPoint(stops[i]);
          if (!stopPoint) continue;
          var dist = worldPointDistance(stopPoint, ref);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = i;
          }
        }
        if (!Number.isFinite(bestDistance) || bestDistance > limit) return -1;
        return bestIndex;
      }
      function applyNavBridgeRuleToRouteWorldPoints(worldPoints, routeStops, bridgeRule, navOptions) {
        var base = Array.isArray(worldPoints) ? worldPoints : [];
        if (base.length < 2 || !bridgeRule || typeof bridgeRule !== "object") return base;
        var stops = Array.isArray(routeStops) ? routeStops : [];
        var effectiveNavOptions = navOptions || getNavBridgeOptionsForRule(bridgeRule);
        var out = cloneWorldPolyline(base);
        var forcedNodeChainApplied = false;
        var replaceBetweenNodes = bridgeRule.replace_between_nodes && typeof bridgeRule.replace_between_nodes === "object"
          ? bridgeRule.replace_between_nodes
          : null;
        var replaceBetweenPoints = normalizeNavBridgePointPair(bridgeRule.replace_between_points);
        var forcedNodeChain = Array.isArray(bridgeRule.force_node_chain)
          ? bridgeRule.force_node_chain.map(function (id) { return Number(id); }).filter(function (id) { return Number.isFinite(id); })
          : [];
        var forcedPointChain = parseNavBridgeControlPoints(bridgeRule.force_point_chain);
        var forcePointChainExact =
          bridgeRule.force_point_chain_exact === true ||
          bridgeRule.force_points_even_without_nodes === true ||
          bridgeRule.force_points_always === true;
        if (!forcePointChainExact && !forcedNodeChain.length && forcedPointChain.length >= 2) {
          var mappedNodeIds = forcedPointChain
            .map(function (point) { return getNearestNodeIdForPoint(point, SAEIV_NAV_STOP_SNAP_DISTANCE * 6); })
            .filter(function (id) { return Number.isFinite(id); });
          if (mappedNodeIds.length === forcedPointChain.length) forcedNodeChain = mappedNodeIds;
        }
        if (forcedNodeChain.length >= 2 || forcedPointChain.length >= 2) {
          var fromNodeId = Number(replaceBetweenNodes && replaceBetweenNodes.from);
          var toNodeId = Number(replaceBetweenNodes && replaceBetweenNodes.to);
          var effectiveFromNodeId = Number.isFinite(fromNodeId) ? fromNodeId : forcedNodeChain[0];
          var effectiveToNodeId = Number.isFinite(toNodeId) ? toNodeId : forcedNodeChain[forcedNodeChain.length - 1];
          var fromNodePoint =
            (replaceBetweenPoints && replaceBetweenPoints.from) ||
            getNavGraphNodeWorldPoint(effectiveFromNodeId) ||
            forcedPointChain[0] ||
            null;
          var toNodePoint =
            (replaceBetweenPoints && replaceBetweenPoints.to) ||
            getNavGraphNodeWorldPoint(effectiveToNodeId) ||
            forcedPointChain[forcedPointChain.length - 1] ||
            null;
          var forcedRawNodes = forcedNodeChain.length >= 2
            ? buildNavBridgeForcedNodeChainWorldPoints(forcedNodeChain, effectiveNavOptions)
            : anchorNavBridgePointChain(forcedPointChain);
          if (forcedRawNodes && forcedRawNodes.length >= 2 && fromNodePoint && toNodePoint) {
            var startMatch = findNearestWorldPointMatch(out, fromNodePoint);
            var endMatch = findNearestWorldPointMatch(out, toNodePoint);
            var startIdx = startMatch.index;
            var endIdx = endMatch.index;
            if (startIdx >= 0 && endIdx > startIdx) {
              var forcedAnchored = (forcedNodeChain.length >= 2
                ? buildNavBridgeForcedNodeChainWorldPoints(forcedNodeChain, effectiveNavOptions, {
                    anchorStart: out[startIdx],
                    anchorEnd: out[endIdx]
                  })
                : anchorNavBridgePointChain(forcedPointChain, {
                    anchorStart: out[startIdx],
                    anchorEnd: out[endIdx]
                  })) || forcedRawNodes;
              var merged = [];
              for (var i = 0; i <= startIdx; i += 1) appendUniqueWorldPoint(merged, out[i]);
              forcedAnchored.forEach(function (point) { appendUniqueWorldPoint(merged, point); });
              for (var j = endIdx; j < out.length; j += 1) appendUniqueWorldPoint(merged, out[j]);
              if (merged.length >= 2) {
                out = merged;
                forcedNodeChainApplied = true;
              }
            } else if (stops.length >= 2) {
              var forcedFullRoute = (forcedNodeChain.length >= 2
                ? buildNavBridgeForcedNodeChainWorldPoints(forcedNodeChain, effectiveNavOptions, {
                    anchorStart: getSaeivStopExactWorldPoint(stops[0]),
                    anchorEnd: getSaeivStopExactWorldPoint(stops[stops.length - 1])
                  })
                : anchorNavBridgePointChain(forcedPointChain, {
                    anchorStart: getSaeivStopExactWorldPoint(stops[0]),
                    anchorEnd: getSaeivStopExactWorldPoint(stops[stops.length - 1])
                  })) || forcedRawNodes;
              if (forcedFullRoute && forcedFullRoute.length >= 2) {
                out = forcedFullRoute;
                forcedNodeChainApplied = true;
              }
            }
          }
        }

        var forcedChain = Array.isArray(bridgeRule.force_link_chain)
          ? bridgeRule.force_link_chain.map(function (id) { return Number(id); }).filter(function (id) { return Number.isFinite(id); })
          : [];
        if (!forcedNodeChainApplied && forcedChain.length >= 1) {
          var forcedRaw = buildNavBridgeForcedChainWorldPoints(forcedChain);
          if (forcedRaw && forcedRaw.length >= 2) {
            var chainToUse = forcedChain;
          var chainRawToUse = forcedRaw;
          var startStopIdx = findNearestSaeivRouteStopIndex(stops, chainRawToUse[0]);
          var endStopIdx = findNearestSaeivRouteStopIndex(stops, chainRawToUse[chainRawToUse.length - 1]);
          if (!(startStopIdx >= 0 && endStopIdx > startStopIdx)) {
            var reversedRaw = forcedRaw.slice().reverse();
            var reversedStartIdx = findNearestSaeivRouteStopIndex(stops, reversedRaw[0]);
            var reversedEndIdx = findNearestSaeivRouteStopIndex(stops, reversedRaw[reversedRaw.length - 1]);
            if (reversedStartIdx >= 0 && reversedEndIdx > reversedStartIdx && canReverseNavBridgeEdgeChain(forcedChain)) {
              chainToUse = forcedChain.slice().reverse();
              chainRawToUse = reversedRaw;
              startStopIdx = reversedStartIdx;
              endStopIdx = reversedEndIdx;
            }
            }
            if (startStopIdx >= 0 && endStopIdx > startStopIdx) {
              var forcedAnchoredChain = buildNavBridgeForcedChainWorldPoints(chainToUse, {
                anchorStart: getSaeivStopExactWorldPoint(stops[startStopIdx]),
                anchorEnd: getSaeivStopExactWorldPoint(stops[endStopIdx])
              }) || chainRawToUse;
              var routeMerged = [];
              var prefixWorld = buildSaeivWorldPolylineFromStops(stops, 0, startStopIdx, effectiveNavOptions);
              var suffixWorld = buildSaeivWorldPolylineFromStops(stops, endStopIdx, stops.length - 1, effectiveNavOptions);
              prefixWorld.forEach(function (point) { appendUniqueWorldPoint(routeMerged, point); });
              forcedAnchoredChain.forEach(function (point) { appendUniqueWorldPoint(routeMerged, point); });
              suffixWorld.forEach(function (point) { appendUniqueWorldPoint(routeMerged, point); });
              if (routeMerged.length >= 2) out = routeMerged;
            } else if (stops.length >= 2) {
              var forcedFullChain = buildNavBridgeForcedChainWorldPoints(chainToUse, {
                anchorStart: getSaeivStopExactWorldPoint(stops[0]),
                anchorEnd: getSaeivStopExactWorldPoint(stops[stops.length - 1])
              }) || chainRawToUse;
              if (forcedFullChain && forcedFullChain.length >= 2) out = forcedFullChain;
            }
          }
        }

        var insertionOps = [];
        if (bridgeRule.insert_control_points_after_node && typeof bridgeRule.insert_control_points_after_node === "object") {
          var legacy = bridgeRule.insert_control_points_after_node;
          insertionOps.push({
            position: "after_node",
            node: legacy.after_node ?? legacy.node ?? legacy.after_point ?? legacy.node_point,
            points: legacy.points ?? legacy.control_points,
            node_ids: legacy.node_ids ?? legacy.control_node_ids ?? legacy.control_nodes
          });
        }
        if (Array.isArray(bridgeRule.insert_control_points)) {
          bridgeRule.insert_control_points.forEach(function (operation) {
            if (operation && typeof operation === "object") insertionOps.push(operation);
          });
        }
        insertionOps.forEach(function (operation) {
          var injected = applyNavBridgeInsertionOperationDetailed(out, stops, operation, effectiveNavOptions);
          if (injected && Array.isArray(injected.points) && injected.points.length >= 2) out = injected.points;
        });
        return out.length >= 2 ? out : base;
      }
      function buildNavGraph(raw) {
        var nodes = Array.isArray(raw && raw.nodes) ? raw.nodes : [];
        var edges = Array.isArray(raw && raw.edges) ? raw.edges : [];
        if (!nodes.length || !edges.length) return null;
        var nodesById = new Map();
        var nodeList = [];
        nodes.forEach(function (node) {
          var point = parseWorldPoint3D(node);
          var id = Number(node && node.id);
          if (!point || !Number.isFinite(id)) return;
          var rec = {
            id: id,
            x: point.x,
            y: point.y
          };
          if (Number.isFinite(point.h)) rec.h = point.h;
          nodesById.set(id, rec);
          nodeList.push(rec);
        });
        if (!nodeList.length) return null;
        var adjacency = new Map();
        var edgeList = [];
        var edgesById = new Map();
        function addTransition(from, to, weight, points, reverse, edgeId) {
          if (!adjacency.has(from)) adjacency.set(from, []);
          adjacency.get(from).push({ from: from, to: to, weight: weight, points: points, reverse: !!reverse, edgeId: edgeId });
        }
        edges.forEach(function (edge) {
          var edgeId = Number(edge && edge.id);
          var from = Number(edge && edge.from);
          var to = Number(edge && edge.to);
          var fromNode = nodesById.get(from);
          var toNode = nodesById.get(to);
          if (!fromNode || !toNode) return;
          var weight = Number(edge && edge.length);
          if (!Number.isFinite(weight) || weight <= 0) {
            weight = Math.hypot(fromNode.x - toNode.x, fromNode.y - toNode.y);
          }
          var points = Array.isArray(edge && edge.polyline)
            ? edge.polyline.map(function (pt) { return parseWorldPoint3D(pt); }).filter(Boolean)
            : [];
          var safePoints = points.length >= 2 ? points : [fromNode, toNode];
          var edgeRec = {
            id: edgeId,
            from: from,
            to: to,
            oneWay: !!(edge && edge.one_way),
            flags: edge && edge.flags && typeof edge.flags === "object" ? edge.flags : null,
            polyline: safePoints
          };
          edgeList.push(edgeRec);
          if (Number.isFinite(edgeId)) edgesById.set(edgeId, edgeRec);
          addTransition(from, to, weight, points, false, edgeId);
          if (!(edge && edge.one_way)) addTransition(to, from, weight, points, true, edgeId);
        });
        return {
          nodesById: nodesById,
          nodeList: nodeList,
          adjacency: adjacency,
          edgeList: edgeList,
          edgesById: edgesById
        };
      }
      function ensureNavGraphLoaded() {
        if (navGraph) return Promise.resolve(navGraph);
        if (navGraphLoadPromise) return navGraphLoadPromise;
        navGraphLoadPromise = loadBestNavGraphVersion()
          .then(function (version) {
            var candidates = [];
            var primary = String(version || "").trim();
            if (primary) candidates.push(primary);
            if (candidates.indexOf("0.1.6a") === -1) candidates.push("0.1.6a");
            function tryFetch(index) {
              if (index >= candidates.length) throw new Error("nav_graph");
              var safeVersion = candidates[index];
              return fetch("./map_files/" + safeVersion + "/nav_graph.json", { cache: "no-store" })
                .then(function (res) {
                  if (!res || !res.ok) throw new Error("nav_graph");
                  return res.json();
                })
                .catch(function () {
                  return tryFetch(index + 1);
                });
            }
            return tryFetch(0);
          })
          .then(function (raw) {
            navGraph = buildNavGraph(raw);
            navPathCache.clear();
            saeivNavNodesByStopKey.clear();
            if (!navGraph) navGraphLoadPromise = null;
            if (navGraph) {
              clearActiveRouteCache();
              if (activeBridgeDestinationPoint && lastBridgeArrowPoint) {
                publishActiveRouteFromState(true);
              }
            }
            return navGraph;
          })
          .catch(function () {
            navGraph = null;
            navGraphLoadPromise = null;
            return null;
          });
        return navGraphLoadPromise;
      }
      function navHeuristic(fromId, toId) {
        if (!navGraph) return 0;
        var a = navGraph.nodesById.get(fromId);
        var b = navGraph.nodesById.get(toId);
        if (!a || !b) return 0;
        return Math.hypot(a.x - b.x, a.y - b.y);
      }
      function findPathTransitions(fromId, toId, options) {
        if (fromId === toId) return [];
        if (!navGraph) return null;
        var blockedEdgeIds = options && options.blockedEdgeIds instanceof Set ? options.blockedEdgeIds : null;
        var open = createMinHeap();
        var best = new Map([[fromId, 0]]);
        var prev = new Map();
        var EPS = 1e-9;
        open.push({ id: fromId, g: 0, f: navHeuristic(fromId, toId) });
        while (open.size() > 0) {
          var current = open.pop();
          if (!current) break;
          var known = best.get(current.id);
          if (!Number.isFinite(known) || current.g > known + EPS) continue;
          if (current.id === toId) break;
          var transitions = navGraph.adjacency.get(current.id) || [];
          for (var i = 0; i < transitions.length; i += 1) {
            var t = transitions[i];
            if (blockedEdgeIds && Number.isFinite(Number(t.edgeId)) && blockedEdgeIds.has(Number(t.edgeId))) continue;
            var nextG = current.g + (Number(t.weight) || 0);
            var knownNext = best.get(t.to);
            if (Number.isFinite(knownNext) && nextG >= knownNext - EPS) continue;
            best.set(t.to, nextG);
            prev.set(t.to, { from: current.id, transition: t });
            open.push({
              id: t.to,
              g: nextG,
              f: nextG + navHeuristic(t.to, toId)
            });
          }
        }
        if (!prev.has(toId)) return null;
        var out = [];
        var cursor = toId;
        while (cursor !== fromId) {
          var step = prev.get(cursor);
          if (!step) return null;
          out.push(step.transition);
          cursor = step.from;
        }
        out.reverse();
        return out;
      }
      function appendTransitionWorldPoints(target, transition) {
        if (!navGraph || !transition) return;
        var rawPoints = Array.isArray(transition.points) ? transition.points : [];
        if (rawPoints.length) {
          if (transition.reverse) {
            for (var i = rawPoints.length - 1; i >= 0; i -= 1) appendUniqueWorldPoint(target, rawPoints[i]);
          } else {
            for (var j = 0; j < rawPoints.length; j += 1) appendUniqueWorldPoint(target, rawPoints[j]);
          }
        } else {
          appendUniqueWorldPoint(target, navGraph.nodesById.get(transition.from));
          appendUniqueWorldPoint(target, navGraph.nodesById.get(transition.to));
        }
        appendUniqueWorldPoint(target, navGraph.nodesById.get(transition.to));
      }
      function getPathBetweenNodes(fromId, toId, options) {
        var hasBlockedEdges = options && options.blockedEdgeIds instanceof Set && options.blockedEdgeIds.size > 0;
        var key = hasBlockedEdges ? null : (String(fromId) + ">" + String(toId));
        if (key && navPathCache.has(key)) return navPathCache.get(key);
        if (!navGraph) return null;
        var fromNode = navGraph.nodesById.get(fromId);
        var toNode = navGraph.nodesById.get(toId);
        if (!fromNode || !toNode) return null;
        var transitions = findPathTransitions(fromId, toId, options);
        if (!transitions) {
          if (key) navPathCache.set(key, null);
          return null;
        }
        var points = [];
        var cost = 0;
        appendUniqueWorldPoint(points, fromNode);
        transitions.forEach(function (t) {
          cost += Number(t && t.weight) || 0;
          appendTransitionWorldPoints(points, t);
        });
        appendUniqueWorldPoint(points, toNode);
        var out = points.length ? { points: points, cost: cost } : null;
        if (key) navPathCache.set(key, out);
        return out;
      }
      function getNearestNodeIdForPoint(worldPoint, maxDistance) {
        var ref = parseWorldPoint3D(worldPoint);
        if (!navGraph || !ref) return null;
        var limit = Number(maxDistance);
        if (!Number.isFinite(limit) || limit <= 0) limit = Number.POSITIVE_INFINITY;
        var exactThreshold = 0.05;
        var exactId = null;
        var exactDist = Number.POSITIVE_INFINITY;
        var bestId = null;
        var bestDist = Number.POSITIVE_INFINITY;
        for (var i = 0; i < navGraph.nodeList.length; i += 1) {
          var node = navGraph.nodeList[i];
          var dx = Number(node && node.x) - Number(ref.x);
          var dy = Number(node && node.y) - Number(ref.y);
          var dist = Math.hypot(dx, dy);
          if (dist <= exactThreshold && dist < exactDist) {
            exactDist = dist;
            exactId = Number(node.id);
          }
          if (dist < bestDist) {
            bestDist = dist;
            bestId = Number(node.id);
          }
        }
        if (Number.isFinite(exactId)) return exactId;
        if (!Number.isFinite(bestDist) || bestDist > limit) return null;
        return Number.isFinite(bestId) ? bestId : null;
      }
      function findReachableNearbyNodeId(fromNodeId, nearWorldPoint, maxCandidates) {
        var fromId = Number(fromNodeId);
        var ref = parseWorldPoint3D(nearWorldPoint);
        if (!navGraph || !Number.isFinite(fromId) || !ref) return null;
        var maxCount = Math.max(1, Math.floor(Number(maxCandidates) || NAV_FORCE_NEARBY_CANDIDATES_MAX));
        var ranked = [];
        for (var i = 0; i < navGraph.nodeList.length; i += 1) {
          var node = navGraph.nodeList[i];
          var id = Number(node && node.id);
          if (!Number.isFinite(id)) continue;
          var dx = Number(node.x) - Number(ref.x);
          var dy = Number(node.y) - Number(ref.y);
          ranked.push({ id: id, dist: Math.hypot(dx, dy) });
        }
        ranked.sort(function (a, b) { return a.dist - b.dist; });
        for (var n = 0; n < ranked.length && n < maxCount; n += 1) {
          var candidateId = Number(ranked[n].id);
          if (!Number.isFinite(candidateId)) continue;
          if (candidateId === fromId) return candidateId;
          var path = getPathBetweenNodes(fromId, candidateId);
          if (path && Array.isArray(path.points) && path.points.length) return candidateId;
        }
        return null;
      }
      function snapWorldPointToNearestNavNode(worldPoint, maxDistance) {
        var ref = parseWorldPoint3D(worldPoint);
        if (!ref || !navGraph) return null;
        var limit = Number(maxDistance);
        if (!Number.isFinite(limit) || limit <= 0) limit = Number.POSITIVE_INFINITY;
        var nodeId = getNearestNodeIdForPoint(ref, limit);
        if (!Number.isFinite(nodeId)) return null;
        var snapped = getNavGraphNodeWorldPoint(nodeId);
        if (!snapped) return null;
        if (!Number.isFinite(snapped.h) && Number.isFinite(ref.h)) snapped.h = ref.h;
        return snapped;
      }
      function buildShortestRoutePoints(startWorld, endWorld, options) {
        var start = parseWorldPoint3D(startWorld);
        var end = parseWorldPoint3D(endWorld);
        if (!start || !end) return [];
        var opts = options && typeof options === "object" ? options : {};
        var forceNav = opts.forceNav === true;
        var snapDistance = forceNav ? Number.POSITIVE_INFINITY : NAV_GRAPH_MAX_SNAP_DISTANCE;
        var maxNearbyCandidates = Math.max(1, Math.floor(Number(opts.maxNearbyCandidates) || NAV_FORCE_NEARBY_CANDIDATES_MAX));
        var out = [];
        appendUniqueWorldPoint(out, start);
        var hasNavPath = false;
        if (navGraph) {
          var startNodeId = getNearestNodeIdForPoint(start, snapDistance);
          var endNodeId = getNearestNodeIdForPoint(end, snapDistance);
          var resolvedEndNodeId = Number.isFinite(endNodeId) ? endNodeId : null;
          var graphPath = null;
          if (Number.isFinite(startNodeId) && Number.isFinite(endNodeId)) {
            if (startNodeId === endNodeId) {
              appendUniqueWorldPoint(out, navGraph.nodesById.get(startNodeId));
              hasNavPath = true;
            } else {
              graphPath = getPathBetweenNodes(startNodeId, endNodeId);
              hasNavPath = !!(graphPath && Array.isArray(graphPath.points) && graphPath.points.length);
            }
            if (!hasNavPath && forceNav) {
              var nearbyNodeId = findReachableNearbyNodeId(startNodeId, end, maxNearbyCandidates);
              if (Number.isFinite(nearbyNodeId)) {
                resolvedEndNodeId = nearbyNodeId;
                if (startNodeId === nearbyNodeId) {
                  hasNavPath = true;
                  graphPath = null;
                } else {
                  graphPath = getPathBetweenNodes(startNodeId, nearbyNodeId);
                  hasNavPath = !!(graphPath && Array.isArray(graphPath.points) && graphPath.points.length);
                }
              }
            }
            if (hasNavPath) {
              if (startNodeId !== resolvedEndNodeId && graphPath && Array.isArray(graphPath.points) && graphPath.points.length) {
                graphPath.points.forEach(function (point) {
                  appendUniqueWorldPoint(out, point);
                });
              }
            }
          }
        }
        if (forceNav && !hasNavPath) return [];
        appendUniqueWorldPoint(out, end);
        return out.length >= 2 ? out : [start, end];
      }
      function shouldRecomputeActiveRoute(startPoint, endPoint, force, forceNavMode) {
        if (force) return true;
        if (!Array.isArray(activeBridgeRoutePoints) || activeBridgeRoutePoints.length < 2) return true;
        if (!activeBridgeRouteStartPoint || !activeBridgeRouteEndPoint) return true;
        if ((activeBridgeRouteForceNavMode === true) !== (forceNavMode === true)) return true;
        if (worldPointDistance(activeBridgeRouteEndPoint, endPoint) > 0.001) return true;
        var since = Date.now() - activeBridgeRouteComputedAt;
        if (since < NAV_ROUTE_RECOMPUTE_MIN_MS) return false;
        return worldPointDistance(activeBridgeRouteStartPoint, startPoint) >= NAV_ROUTE_RECOMPUTE_MIN_MOVE;
      }
      function getActiveRoutePoints(startPoint, endPoint, force, options) {
        var start = parseWorldPoint3D(startPoint);
        var end = parseWorldPoint3D(endPoint);
        if (!start || !end) return [startPoint, endPoint];
        var opts = options && typeof options === "object" ? options : {};
        var forceNav = opts.forceNav === true;
        ensureNavGraphLoaded();
        if (!shouldRecomputeActiveRoute(start, end, !!force, forceNav)) return activeBridgeRoutePoints;
        var route = buildShortestRoutePoints(start, end, { forceNav: forceNav });
        var effectiveEnd = (Array.isArray(route) && route.length)
          ? (parseWorldPoint3D(route[route.length - 1]) || end)
          : end;
        activeBridgeRoutePoints = route;
        activeBridgeRouteStartPoint = start;
        activeBridgeRouteEndPoint = effectiveEnd;
        activeBridgeRouteComputedAt = Date.now();
        activeBridgeRouteForceNavMode = forceNav;
        return route;
      }
      function routePointsForBridge(arrowPoint, routePoints) {
        var list = Array.isArray(routePoints) ? routePoints.filter(Boolean) : [];
        return list;
      }
      function getSaeivRouteCacheBaseKey(entries) {
        var selectedKey = String(saeivRouteState && saeivRouteState.selectedKey || "");
        var lastUid = "";
        if (Array.isArray(entries) && entries.length) {
          lastUid = String(entries[entries.length - 1] && entries[entries.length - 1].uid || "");
        }
        var forceNavToken = activeBridgeDestinationForceNav === true ? "1" : "0";
        return selectedKey + "|" + String(entries && entries.length || 0) + "|" + lastUid + "|" + forceNavToken;
      }
      function getRouteSuffixFromTarget(entries, targetIndex) {
        var list = Array.isArray(entries) ? entries : [];
        var idxRaw = Number(targetIndex);
        if (!list.length || !Number.isFinite(idxRaw)) return [];
        var idx = Math.max(0, Math.min(list.length - 1, Math.floor(idxRaw)));
        var forceNavRoute = activeBridgeDestinationForceNav === true;
        var key = getSaeivRouteCacheBaseKey(list) + "|suffix|" + String(idx);
        if (saeivRouteSuffixCache.has(key)) {
          return saeivRouteSuffixCache.get(key) || [];
        }
        var out = [];
        var targetPoint = parseWorldPoint3D(list[idx] && list[idx].point);
        if (!targetPoint) {
          saeivRouteSuffixCache.set(key, out);
          return out;
        }
        appendUniqueWorldPoint(out, targetPoint);
        for (var i = idx + 1; i < list.length; i += 1) {
          var nextPoint = parseWorldPoint3D(list[i] && list[i].point);
          if (!nextPoint) continue;
          var seg = buildShortestRoutePoints(out[out.length - 1], nextPoint, {
            forceNav: forceNavRoute
          });
          if (Array.isArray(seg) && seg.length >= 2) {
            seg.forEach(function (point) {
              appendUniqueWorldPoint(out, point);
            });
          } else {
            appendUniqueWorldPoint(out, nextPoint);
          }
        }
        saeivRouteSuffixCache.set(key, out);
        return out;
      }
      function buildSaeivMapStyleRouteWorldPoints(entries) {
        var list = Array.isArray(entries) ? entries : [];
        if (list.length < 2) return list.length ? [getSaeivStopRouteEndWorldPoint(list[0]) || getSaeivStopExactWorldPoint(list[0])].filter(Boolean) : [];
        var bridgeRule = getActiveSaeivNavBridgeRule();
        var navOptions = getNavBridgeOptionsForRule(bridgeRule);
        var worldPoints = buildSaeivWorldPolylineFromStops(list, 0, list.length - 1, navOptions);
        if (bridgeRule) {
          worldPoints = applyNavBridgeRuleToRouteWorldPoints(worldPoints, list, bridgeRule, navOptions);
        }
        return Array.isArray(worldPoints) ? worldPoints : [];
      }
      function sliceSaeivRouteWorldPointsBetweenStops(routePoints, entries, fromIndex, toIndex) {
        var points = Array.isArray(routePoints) ? routePoints : [];
        var stops = Array.isArray(entries) ? entries : [];
        if (points.length < 2 || !stops.length) return [];
        var fromIdx = Math.max(0, Math.min(stops.length - 1, Math.floor(Number(fromIndex) || 0)));
        var toIdx = Math.max(0, Math.min(stops.length - 1, Math.floor(Number(toIndex) || 0)));
        if (fromIdx > toIdx) return [];
        var fromPoint = getSaeivStopRouteEndWorldPoint(stops[fromIdx]) || getSaeivStopExactWorldPoint(stops[fromIdx]);
        var toPoint = getSaeivStopRouteEndWorldPoint(stops[toIdx]) || getSaeivStopExactWorldPoint(stops[toIdx]);
        if (!fromPoint || !toPoint) return [];
        var startMatch = findNearestWorldPointMatch(points, fromPoint, SAEIV_NAV_STOP_SNAP_DISTANCE * 10);
        var endMatch = findNearestWorldPointMatch(points, toPoint, SAEIV_NAV_STOP_SNAP_DISTANCE * 10);
        if (!(startMatch.index >= 0 && endMatch.index >= startMatch.index)) return [];
        var out = [];
        appendUniqueWorldPoint(out, fromPoint);
        for (var i = startMatch.index; i <= endMatch.index; i += 1) {
          appendUniqueWorldPoint(out, points[i]);
        }
        appendUniqueWorldPoint(out, toPoint);
        return out.length >= 2 ? out : [];
      }
      function projectWorldPointOnSegment(point, segStart, segEnd) {
        var p = parseWorldPoint3D(point);
        var a = parseWorldPoint3D(segStart);
        var b = parseWorldPoint3D(segEnd);
        if (!p || !a || !b) return null;
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var lenSq = (dx * dx) + (dy * dy);
        if (!(lenSq > 1e-9)) return null;
        var t = (((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / lenSq;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        var projected = {
          x: a.x + (t * dx),
          y: a.y + (t * dy)
        };
        if (Number.isFinite(a.h) && Number.isFinite(b.h)) {
          projected.h = a.h + (t * (b.h - a.h));
        }
        return { point: projected, t: t };
      }
      function findNearestPointOnWorldPolyline(point, routeWorldPoints) {
        var route = Array.isArray(routeWorldPoints) ? routeWorldPoints.map(function (pt) { return parseWorldPoint3D(pt); }).filter(Boolean) : [];
        var origin = parseWorldPoint3D(point);
        if (!origin || route.length < 2) return null;
        var best = null;
        for (var i = 0; i < route.length - 1; i += 1) {
          var projected = projectWorldPointOnSegment(origin, route[i], route[i + 1]);
          if (!projected || !projected.point) continue;
          var dist = worldPointDistance(origin, projected.point);
          if (!best || dist < best.distance) {
            best = {
              point: projected.point,
              segmentIndex: i,
              t: projected.t,
              distance: dist
            };
          }
        }
        return best;
      }
      function buildRouteJoinedToNearestWorldPoint(startPoint, routeWorldPoints, endPoint) {
        var start = parseWorldPoint3D(startPoint);
        var end = parseWorldPoint3D(endPoint);
        var route = Array.isArray(routeWorldPoints)
          ? routeWorldPoints.map(function (point) { return parseWorldPoint3D(point); }).filter(Boolean)
          : [];
        if (route.length < 2) {
          var fallback = [];
          appendUniqueWorldPoint(fallback, end);
          return fallback.length >= 2 ? fallback : route;
        }
        var baseRoute = route.slice();
        if (end) baseRoute[baseRoute.length - 1] = end;
        if (!start) return baseRoute;
        var nearest = findNearestPointOnWorldPolyline(start, baseRoute);
        if (!nearest || !nearest.point) {
          return baseRoute;
        }
        var eps = 1e-3;
        var suffix = [];
        var projectedInsideSegment = nearest.t > eps && nearest.t < (1 - eps);
        if (projectedInsideSegment) appendUniqueWorldPoint(suffix, nearest.point);
        var startIndex = (projectedInsideSegment || nearest.t >= (1 - eps))
          ? (nearest.segmentIndex + 1)
          : nearest.segmentIndex;
        for (var i = startIndex; i < baseRoute.length; i += 1) {
          appendUniqueWorldPoint(suffix, baseRoute[i]);
        }
        var out = [];
        if (nearest.distance > 0.4) appendUniqueWorldPoint(out, nearest.point);
        suffix.forEach(function (point) { appendUniqueWorldPoint(out, point); });
        return out.length >= 2 ? out : baseRoute;
      }
      function buildStartToStopNavWorldPoints(startPoint, stopEntry) {
        var start = parseWorldPoint3D(startPoint);
        var stopPoint = getSaeivStopExactWorldPoint(stopEntry);
        var linkPoints = getSaeivStopNavLinkPoints(stopEntry);
        var navPoint = (linkPoints.length ? linkPoints[0] : null) || getSaeivStopNavWorldPoint(stopEntry) || stopPoint;
        if (!start || !stopPoint || !navPoint) return [];
        var out = [];
        var navSegment = buildShortestRoutePoints(start, navPoint, {
          forceNav: false,
          maxNearbyCandidates: SAEIV_NAV_STOP_CANDIDATES
        });
        var directDistance = worldPointDistance(start, navPoint);
        var navDistance = worldPolylineDistance(navSegment);
        var acceptsNavSegment =
          Array.isArray(navSegment) &&
          navSegment.length >= 2 &&
          (!Number.isFinite(navDistance) || !Number.isFinite(directDistance) || navDistance <= Math.max(800, directDistance * 4));
        if (acceptsNavSegment) {
          navSegment.forEach(function (point, index) {
            if (index === 0 && worldPointDistance(point, start) <= 0.75) return;
            appendUniqueWorldPoint(out, point);
          });
        } else {
          appendUniqueWorldPoint(out, navPoint);
        }
        if (linkPoints.length) {
          linkPoints.forEach(function (point) {
            appendUniqueWorldPoint(out, point);
          });
        } else {
          appendUniqueWorldPoint(out, stopPoint);
        }
        return out.length >= 2 ? out : [];
      }
      function buildRoutePointsThroughStops(startPoint, entries, targetIndex, forceFullSuffix) {
        var start = parseWorldPoint3D(startPoint);
        var list = Array.isArray(entries) ? entries : [];
        var idxRaw = Number(targetIndex);
        if (!start || !list.length || !Number.isFinite(idxRaw)) return [];
        var idx = Math.max(0, Math.min(list.length - 1, Math.floor(idxRaw)));
        var targetStopPoint = getSaeivStopExactWorldPoint(list[idx]);
        if (!targetStopPoint) return [];
        var targetRouteEndPoint = getSaeivStopRouteEndWorldPoint(list[idx]) || targetStopPoint;
        if (forceFullSuffix === true) {
          return buildStartToStopNavWorldPoints(start, list[idx]);
        }
        if (idx > 0 && list.length >= 2) {
          var fullMapRoute = buildSaeivMapStyleRouteWorldPoints(list);
          var legRoute = sliceSaeivRouteWorldPointsBetweenStops(fullMapRoute, list, idx - 1, idx);
          if (legRoute.length < 2) {
            var navOptions = getNavBridgeOptionsForRule(getActiveSaeivNavBridgeRule());
            legRoute = buildSaeivWorldPolylineFromStops(list, idx - 1, idx, navOptions);
          }
          if (legRoute.length >= 2) {
            var nearestOnLeg = findNearestPointOnWorldPolyline(start, legRoute);
            if (!nearestOnLeg || !Number.isFinite(nearestOnLeg.distance) || nearestOnLeg.distance > NAV_ROUTE_OFF_ROUTE_DISTANCE_M) {
              return buildStartToStopNavWorldPoints(start, list[idx]);
            }
            var joined = buildRouteJoinedToNearestWorldPoint(start, legRoute, targetRouteEndPoint);
            if (joined.length >= 2) return joined;
          }
        }
        return buildStartToStopNavWorldPoints(start, list[idx]);
      }
      function shouldRecomputeComposedRoute(startPoint, routeKey, targetIndex, entries, force) {
        if (force) return true;
        if (!Array.isArray(activeBridgeComposedRoutePoints) || activeBridgeComposedRoutePoints.length < 2) return true;
        if (!activeBridgeComposedRouteStartPoint) return true;
        if (String(activeBridgeComposedRouteKey || "") !== String(routeKey || "")) return true;
        if (Number(activeBridgeComposedRouteTargetIndex) !== Number(targetIndex)) return true;
        var now = Date.now();
        var since = now - activeBridgeComposedRouteComputedAt;
        var moved = worldPointDistance(activeBridgeComposedRouteStartPoint, startPoint);
        if (!Number.isFinite(moved)) moved = Number.POSITIVE_INFINITY;
        var list = Array.isArray(entries) ? entries : [];
        var idx = Math.max(0, Math.min(Math.max(0, list.length - 1), Math.floor(Number(targetIndex) || 0)));
        var targetPoint = parseWorldPoint3D(list[idx] && list[idx].point);
        var distanceToTarget = worldPointDistance(startPoint, targetPoint);
        var farTarget = Number.isFinite(distanceToTarget) && distanceToTarget > NAV_ROUTE_LOCAL_RECOMPUTE_RADIUS_M;
        var distToCached = worldPointToPolylineMinDistance(startPoint, activeBridgeComposedRoutePoints);
        var offRoute = Number.isFinite(distToCached) && distToCached > NAV_ROUTE_OFF_ROUTE_DISTANCE_M;
        if (offRoute) {
          var offRouteKey = String(routeKey || "") + "|" + String(targetIndex);
          var recentlyForcedSameKey =
            activeBridgeComposedOffRouteFullRecomputeKey === offRouteKey &&
            (now - activeBridgeComposedOffRouteFullRecomputeAt) < NAV_ROUTE_OFF_ROUTE_RECOMPUTE_COOLDOWN_MS;
          if (!recentlyForcedSameKey) {
            activeBridgeComposedOffRouteFullRecomputeKey = offRouteKey;
            activeBridgeComposedOffRouteFullRecomputeAt = now;
            activeBridgeComposedForceFullSuffixOnce = true;
            return true;
          }
          return false;
        }

        if (farTarget) {
          if (since < NAV_ROUTE_FAR_RECOMPUTE_MIN_MS) return false;
          // Destination loin: recalcul tres reactif + geometrie locale 500m.
          return moved >= NAV_ROUTE_FAR_RECOMPUTE_MIN_MOVE;
        }
        if (since < NAV_ROUTE_RECOMPUTE_MIN_MS) return false;
        return moved >= NAV_ROUTE_RECOMPUTE_MIN_MOVE;
      }
      function getActiveComposedRoutePoints(startPoint, entries, targetIndex, force) {
        var start = parseWorldPoint3D(startPoint);
        var list = Array.isArray(entries) ? entries : [];
        var idxRaw = Number(targetIndex);
        if (!start || !list.length || !Number.isFinite(idxRaw)) {
          return { points: [], changed: false };
        }
        var idx = Math.max(0, Math.min(list.length - 1, Math.floor(idxRaw)));
        var routeKey = getSaeivRouteCacheBaseKey(list);
        if (!shouldRecomputeComposedRoute(start, routeKey, idx, list, !!force)) {
          return { points: activeBridgeComposedRoutePoints, changed: false };
        }
        var forceFullSuffix = activeBridgeComposedForceFullSuffixOnce === true;
        activeBridgeComposedForceFullSuffixOnce = false;
        var points = buildRoutePointsThroughStops(start, list, idx, forceFullSuffix);
        activeBridgeComposedRoutePoints = points;
        activeBridgeComposedRouteStartPoint = start;
        activeBridgeComposedRouteTargetIndex = idx;
        activeBridgeComposedRouteKey = routeKey;
        activeBridgeComposedRouteComputedAt = Date.now();
        return { points: points, changed: true };
      }
      function getNominalSegmentDistance(entries, index, fallbackStartPoint) {
        var list = Array.isArray(entries) ? entries : [];
        var idxRaw = Number(index);
        if (!list.length || !Number.isFinite(idxRaw)) return Number.NaN;
        var idx = Math.max(0, Math.min(list.length - 1, Math.floor(idxRaw)));
        var cacheKey = getSaeivRouteCacheBaseKey(list) + "|nominal|" + String(idx);
        if (saeivNominalSegmentDistanceCache.has(cacheKey)) {
          return Number(saeivNominalSegmentDistanceCache.get(cacheKey));
        }
        var endPoint = parseWorldPoint3D(list[idx] && list[idx].point);
        if (!endPoint) return Number.NaN;
        var startPoint = null;
        if (idx <= 0) {
          startPoint = parseWorldPoint3D(saeivRouteStartPoint) || parseWorldPoint3D(fallbackStartPoint) || endPoint;
        } else {
          startPoint = parseWorldPoint3D(list[idx - 1] && list[idx - 1].point) || parseWorldPoint3D(fallbackStartPoint) || endPoint;
        }
        var nominalDistance = worldPolylineDistance(buildShortestRoutePoints(startPoint, endPoint));
        saeivNominalSegmentDistanceCache.set(cacheKey, nominalDistance);
        return nominalDistance;
      }
      function computeRouteEtaToTerminus(entries, targetIndex, currentPoint) {
        var list = Array.isArray(entries) ? entries : [];
        var idxRaw = Number(targetIndex);
        if (!list.length || !Number.isFinite(idxRaw)) return null;
        var idx = Math.max(0, Math.min(list.length - 1, Math.floor(idxRaw)));
        var current = parseWorldPoint3D(currentPoint) || parseWorldPoint3D(saeivRouteStartPoint) || null;
        var cacheKey = getSaeivRouteCacheBaseKey(list);
        var canUseCache = false;
        if (current && String(activeRouteEtaCache.routeKey || "") === cacheKey && Number(activeRouteEtaCache.targetIndex) === idx) {
          var dtMs = Date.now() - Number(activeRouteEtaCache.lastComputedAt || 0);
          var moved = worldPointDistance(activeRouteEtaCache.lastPoint, current);
          if (Number.isFinite(dtMs) && dtMs < ETA_RECOMPUTE_MIN_MS && Number.isFinite(moved) && moved < ETA_RECOMPUTE_MIN_MOVE) {
            canUseCache = Number.isFinite(Number(activeRouteEtaCache.remainingMinutes));
          }
        }
        if (canUseCache) {
          var cachedRemaining = Number(activeRouteEtaCache.remainingMinutes);
          var cachedPlanned = Number(activeRouteEtaCache.plannedMinutes);
          return {
            remainingMinutes: cachedRemaining,
            arrivalTimestampMs: Date.now() + Math.round(Math.max(0, cachedRemaining) * 60000),
            segmentDurationMinutes: Number.isFinite(cachedPlanned) ? cachedPlanned : 0
          };
        }
        var remainingMinutes = 0;
        var plannedMinutes = 0;
        for (var i = idx; i < list.length; i += 1) {
          var stopEntry = list[i];
          if (!stopEntry || !stopEntry.point) continue;
          var baseDuration = Number(stopEntry.nextStopTime);
          if (!Number.isFinite(baseDuration) || baseDuration <= 0) continue;
          plannedMinutes += baseDuration;
          if (i === idx) {
            var firstSegmentEnd = parseWorldPoint3D(stopEntry.point);
            if (!firstSegmentEnd) continue;
            var nominalStart = null;
            if (i <= 0) {
              nominalStart = parseWorldPoint3D(saeivRouteStartPoint) || current || firstSegmentEnd;
            } else {
              nominalStart = parseWorldPoint3D(list[i - 1] && list[i - 1].point) || current || firstSegmentEnd;
            }
            var actualStart = current || nominalStart;
            var nominalDistance = getNominalSegmentDistance(list, i, nominalStart);
            var actualDistance = worldPolylineDistance(buildShortestRoutePoints(actualStart, firstSegmentEnd));
            var ratio = 1;
            if (Number.isFinite(nominalDistance) && nominalDistance > 0.5) {
              // Keep detour penalty (>1) and shrink only when really closer to the stop.
              ratio = Math.max(0, actualDistance / nominalDistance);
            }
            remainingMinutes += Math.max(0, baseDuration * ratio);
            continue;
          }
          remainingMinutes += baseDuration;
        }
        if (!Number.isFinite(remainingMinutes) || remainingMinutes < 0) return null;
        activeRouteEtaCache.routeKey = cacheKey;
        activeRouteEtaCache.targetIndex = idx;
        activeRouteEtaCache.lastPoint = current ? { x: current.x, y: current.y, h: current.h } : null;
        activeRouteEtaCache.lastComputedAt = Date.now();
        activeRouteEtaCache.remainingMinutes = remainingMinutes;
        activeRouteEtaCache.plannedMinutes = plannedMinutes;
        return {
          remainingMinutes: remainingMinutes,
          arrivalTimestampMs: Date.now() + Math.round(remainingMinutes * 60000),
          segmentDurationMinutes: plannedMinutes
        };
      }
      function clearActiveRouteCache() {
        activeBridgeRoutePoints = null;
        activeBridgeRouteStartPoint = null;
        activeBridgeRouteEndPoint = null;
        activeBridgeRouteComputedAt = 0;
        activeBridgeRouteForceNavMode = false;
        activeBridgeComposedRoutePoints = null;
        activeBridgeComposedRouteStartPoint = null;
        activeBridgeComposedRouteTargetIndex = -1;
        activeBridgeComposedRouteKey = "";
        activeBridgeComposedRouteComputedAt = 0;
        activeBridgeComposedOffRouteFullRecomputeKey = "";
        activeBridgeComposedOffRouteFullRecomputeAt = 0;
        activeBridgeComposedForceFullSuffixOnce = false;
        lastWazeRouteRecomputeAt = 0;
        activeRouteEtaCache.routeKey = "";
        activeRouteEtaCache.targetIndex = -1;
        activeRouteEtaCache.lastPoint = null;
        activeRouteEtaCache.lastComputedAt = 0;
        activeRouteEtaCache.remainingMinutes = null;
        activeRouteEtaCache.plannedMinutes = null;
      }
      function publishActiveRouteFromState(forceRecompute, options) {
        if (!activeBridgeDestinationPoint || !lastBridgeArrowPoint) return false;
        var opts = options && typeof options === "object" ? options : {};
        var allowRecompute = (!!forceRecompute) || (opts.allowRecompute !== false);
        var heading = Number.isFinite(lastBridgeHeadingDeg) ? lastBridgeHeadingDeg : 0;
        var routePoints = [];
        var routePointsChanged = false;
        var routeStops = [];
        var routeReachedIndex = -1;
        var routeTargetIndex = -1;
        var routeStarted = false;
        var routeWaitingStart = false;
        var routeCurrentStopName = "";
        var routeCurrentStopLabel = "";
        var routeDistanceToCurrentStopM = Number.NaN;
        var routeVehicleAtStop = false;
        var etaArrivalTimestampMs = null;
        var etaRemainingMinutes = null;
        var etaSegmentDurationMinutes = null;
        var routeCacheKey = "";
        var routeEndPoint = activeBridgeDestinationPoint;
        if (saeivRouteState && typeof saeivRouteState === "object") {
          var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
          if (entries.length) {
            routeCacheKey = getSaeivRouteCacheBaseKey(entries);
            var lastIndex = entries.length - 1;
            routeStarted = saeivRouteState.started === true;
            routeWaitingStart = !routeStarted;
            routeReachedIndex = clampReachedStopIndex(saeivRouteState.reachedIndex, lastIndex);
            routeTargetIndex = clampRouteStopIndex(saeivRouteState.targetIndex, lastIndex);
            if (!routeStarted) {
              routeReachedIndex = -1;
              routeTargetIndex = 0;
            }
            var displayIndex = routeReachedIndex < 0 ? 0 : routeReachedIndex;
            if (routeTargetIndex > routeReachedIndex) displayIndex = routeTargetIndex;
            var displayEntry = entries[displayIndex] || entries[0] || null;
            var displayPoint = getSaeivStopExactWorldPoint(displayEntry) || getSaeivStopNavWorldPoint(displayEntry);
            if (displayPoint) routeEndPoint = displayPoint;
            routeVehicleAtStop = routeStarted ? (saeivStoppedAtStopIndex >= 0) : (saeivStoppedAtStopIndex === 0);
            routeCurrentStopName = String(displayEntry && displayEntry.name || "").trim();
            if (lastBridgeArrowPoint && displayPoint) {
              routeDistanceToCurrentStopM = worldPointDistance(lastBridgeArrowPoint, displayPoint);
            }
            if (!routeStarted) {
              routeCurrentStopLabel = "Station de départ";
            } else {
              if (Number.isFinite(routeDistanceToCurrentStopM)) {
                routeCurrentStopLabel = routeDistanceToCurrentStopM <= SAEIV_STOP_REACH_DISTANCE
                  ? "Arrêt actuel"
                  : "Prochain arrêt";
              } else {
                routeCurrentStopLabel = routeVehicleAtStop ? "Arrêt actuel" : "Prochain arrêt";
              }
            }
            routeStops = entries.map(function (entry, index) {
              return {
                index: index,
                uid: Number(entry && entry.uid),
                name: String(entry && entry.name || ""),
                x: Number(entry && entry.X),
                y: Number(entry && entry.Y),
                z: Number(entry && entry.Z)
              };
            }).filter(function (stop) {
              return Number.isFinite(stop.x) && Number.isFinite(stop.y) && Number.isFinite(stop.z);
            });
            if (!routeStarted) {
              var firstTarget = getSaeivStopExactWorldPoint(entries[0]) || getSaeivStopNavWorldPoint(entries[0]);
              if (firstTarget) {
                var hasCachedStartRoute =
                  Array.isArray(activeBridgeRoutePoints) &&
                  activeBridgeRoutePoints.length >= 2 &&
                  worldPointDistance(activeBridgeRouteEndPoint, firstTarget) <= 0.001;
                if (allowRecompute || !hasCachedStartRoute) {
                  routePoints = buildRoutePointsThroughStops(lastBridgeArrowPoint, entries, 0, false);
                  if (Array.isArray(routePoints) && routePoints.length >= 2) {
                    activeBridgeRoutePoints = routePoints;
                    activeBridgeRouteStartPoint = parseWorldPoint3D(lastBridgeArrowPoint);
                    activeBridgeRouteEndPoint = parseWorldPoint3D(firstTarget);
                    activeBridgeRouteComputedAt = Date.now();
                    activeBridgeRouteForceNavMode = false;
                  } else {
                    routePoints = getActiveRoutePoints(lastBridgeArrowPoint, firstTarget, !!forceRecompute, {
                      forceNav: false
                    });
                  }
                  routePointsChanged = true;
                } else {
                  routePoints = activeBridgeRoutePoints;
                }
              }
            } else {
              if (allowRecompute) {
                var composed = getActiveComposedRoutePoints(lastBridgeArrowPoint, entries, routeTargetIndex, !!forceRecompute);
                if (composed && Array.isArray(composed.points) && composed.points.length >= 2) {
                  routePoints = composed.points;
                  routePointsChanged = !!composed.changed;
                }
                var eta = computeRouteEtaToTerminus(entries, routeTargetIndex, lastBridgeArrowPoint);
                if (eta) {
                  etaArrivalTimestampMs = Number(eta.arrivalTimestampMs);
                  etaRemainingMinutes = Number(eta.remainingMinutes);
                  etaSegmentDurationMinutes = Number(eta.segmentDurationMinutes);
                }
              } else {
                var hasCachedComposedRoute =
                  Array.isArray(activeBridgeComposedRoutePoints) &&
                  activeBridgeComposedRoutePoints.length >= 2 &&
                  String(activeBridgeComposedRouteKey || "") === String(routeCacheKey || "") &&
                  Number(activeBridgeComposedRouteTargetIndex) === Number(routeTargetIndex);
                if (hasCachedComposedRoute) {
                  routePoints = activeBridgeComposedRoutePoints;
                }
                var hasCachedEta =
                  String(activeRouteEtaCache.routeKey || "") === String(routeCacheKey || "") &&
                  Number(activeRouteEtaCache.targetIndex) === Number(routeTargetIndex);
                if (hasCachedEta) {
                  var cachedRemaining = Number(activeRouteEtaCache.remainingMinutes);
                  var cachedPlanned = Number(activeRouteEtaCache.plannedMinutes);
                  if (Number.isFinite(cachedRemaining)) {
                    etaRemainingMinutes = cachedRemaining;
                    etaArrivalTimestampMs = Date.now() + Math.round(Math.max(0, cachedRemaining) * 60000);
                  }
                  if (Number.isFinite(cachedPlanned)) {
                    etaSegmentDurationMinutes = cachedPlanned;
                  }
                }
              }
            }
          }
        }
        if (!routePoints.length) {
          var hasCachedFallbackRoute =
            Array.isArray(activeBridgeRoutePoints) &&
            activeBridgeRoutePoints.length >= 2 &&
            worldPointDistance(activeBridgeRouteEndPoint, activeBridgeDestinationPoint) <= 0.001;
          if (allowRecompute || !hasCachedFallbackRoute) {
            routePoints = getActiveRoutePoints(lastBridgeArrowPoint, activeBridgeDestinationPoint, !!forceRecompute, {
              forceNav: activeBridgeDestinationForceNav === true
            });
            routePointsChanged = true;
          } else {
            routePoints = activeBridgeRoutePoints;
          }
        }
        var bridgePayload = {
          step: "B",
          start: lastBridgeArrowPoint,
          arrow: lastBridgeArrowPoint,
          end: routeEndPoint,
          routeStops: routeStops,
          routeReachedIndex: routeReachedIndex,
          routeTargetIndex: routeTargetIndex,
          routeStarted: routeStarted,
          routeWaitingStart: routeWaitingStart,
          currentStopName: routeCurrentStopName,
          currentStopLabel: routeCurrentStopLabel,
          distanceToCurrentStopM: Number.isFinite(routeDistanceToCurrentStopM) ? routeDistanceToCurrentStopM : null,
          vehicleAtStop: routeVehicleAtStop,
          etaArrivalTimestampMs: Number.isFinite(etaArrivalTimestampMs) ? etaArrivalTimestampMs : null,
          etaRemainingMinutes: Number.isFinite(etaRemainingMinutes) ? etaRemainingMinutes : null,
          etaSegmentDurationMinutes: Number.isFinite(etaSegmentDurationMinutes) ? etaSegmentDurationMinutes : null,
          heading: heading,
          headingUnit: "deg",
          headingConvention: "north_ccw"
        };
        if (routePointsChanged || !!forceRecompute || (Array.isArray(routePoints) && routePoints.length >= 2)) {
          bridgePayload.routePoints = routePointsForBridge(lastBridgeArrowPoint, routePoints);
        }
        if (allowRecompute) {
          lastWazeRouteRecomputeAt = Date.now();
        }
        postWazeBridgePayload(bridgePayload);
        return true;
      }
