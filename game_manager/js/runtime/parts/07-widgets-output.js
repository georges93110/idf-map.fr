/*
 * Game2 runtime chunk: 07-widgets-output.js
 * Creation widgets, lanes, rendu stage, tabs/PIP.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function createWidget(type) {
        var safeType = normalizeWidgetType(type);
        if (!isType(safeType)) return null;
        var id = "w" + String(nextId++);
        widgetsById[id] = { id: id, type: safeType };
        return id;
      }

      function widgetName(id) {
        var widget = widgetsById[id];
        if (!widget) return id;
        return TYPES[widget.type].label;
      }

      function findWidgetIdByType(type) {
        var safeType = normalizeWidgetType(type);
        if (!isType(safeType)) return null;
        var ids = Object.keys(widgetsById);
        for (var i = 0; i < ids.length; i += 1) {
          var widget = widgetsById[ids[i]];
          if (widget && widget.type === safeType) return ids[i];
        }
        return null;
      }
      function getWidgetLayoutStorageKey(mode) {
        var base = "idf_game2_widget_layout_v4";
        var safe = normalizeGameMode(mode);
        if (!safe) return base;
        return base + "_" + safe;
      }
      function findActiveTypeByLaneOrder(typeList) {
        var allow = Object.create(null);
        (typeList || []).forEach(function (type) {
          var safe = normalizeWidgetType(type);
          if (isType(safe)) allow[safe] = true;
        });
        var orderedIds = []
          .concat(lanes.inline || [])
          .concat(lanes.tab || [])
          .concat(lanes.pip || []);
        for (var i = 0; i < orderedIds.length; i += 1) {
          var id = orderedIds[i];
          var widget = widgetsById[id];
          var safeType = normalizeWidgetType(widget && widget.type);
          if (allow[safeType] === true) return safeType;
        }
        var keys = Object.keys(allow);
        for (var j = 0; j < keys.length; j += 1) {
          if (findWidgetIdByType(keys[j])) return keys[j];
        }
        return "";
      }

      function removeTypesInGroupExcept(typeList, keepType) {
        var keep = normalizeWidgetType(keepType);
        var keepConsumed = false;
        (typeList || []).forEach(function (type) {
          var safeType = normalizeWidgetType(type);
          if (!isType(safeType)) return;
          var id = findWidgetIdByType(safeType);
          if (!id) return;
          if (safeType === keep && !keepConsumed) {
            keepConsumed = true;
            return;
          }
          removeWidget(id);
        });
      }

      function enforceSingleWidgetPerCategory() {
        removeTypesInGroupExcept(GPS_WIDGET_TYPES, findActiveTypeByLaneOrder(GPS_WIDGET_TYPES));
        removeTypesInGroupExcept(HUD_WIDGET_TYPES, findActiveTypeByLaneOrder(HUD_WIDGET_TYPES));
      }

      function refreshWidgetTypeSelectors() {
        if (!el.widgetGpsSelect || !el.widgetHudSelect) return;
        syncingWidgetTypeSelectors = true;
        var gpsType = findActiveTypeByLaneOrder(GPS_WIDGET_TYPES);
        var hudType = findActiveTypeByLaneOrder(HUD_WIDGET_TYPES);
        el.widgetGpsSelect.value = gpsType || "";
        el.widgetHudSelect.value = hudType || "";
        el.widgetGpsSelect.disabled = el.widgetGpsSelect.options.length <= 1;
        el.widgetHudSelect.disabled = el.widgetHudSelect.options.length <= 1;
        if (el.widgetToolbar) {
          var toolbarDisabled = el.widgetGpsSelect.disabled && el.widgetHudSelect.disabled;
          el.widgetToolbar.classList.toggle("is-disabled", toolbarDisabled);
        }
        syncingWidgetTypeSelectors = false;
      }

      function applyWidgetSelectionForGroup(typeList, selectedTypeRaw) {
        var selectedType = normalizeWidgetType(selectedTypeRaw);
        var allowed = Object.create(null);
        (typeList || []).forEach(function (type) {
          var safe = normalizeWidgetType(type);
          if (isType(safe)) allowed[safe] = true;
        });
        if (!allowed[selectedType]) selectedType = "";

        var changed = false;
        var keptId = "";
        (typeList || []).forEach(function (type) {
          var safeType = normalizeWidgetType(type);
          if (!isType(safeType)) return;
          var id = findWidgetIdByType(safeType);
          if (!id) return;
          if (selectedType && safeType === selectedType && !keptId) {
            keptId = id;
            return;
          }
          removeWidget(id);
          changed = true;
        });

        if (!selectedType) return changed;
        if (keptId) {
          if (!findOutputByWidgetId(keptId)) {
            lanes.inline.push(keptId);
            changed = true;
          }
          return changed;
        }
        var createdId = createWidget(selectedType);
        if (!createdId) return changed;
        lanes.inline.push(createdId);
        return true;
      }

      function sanitize() {
        var seen = Object.create(null);
        var next = { inline: [], tab: [], pip: [] };
        OUTPUTS.forEach(function (output) {
          if (!isOutputEnabled(output)) return;
          (lanes[output] || []).forEach(function (id) {
            if (!widgetsById[id]) return;
            if (seen[id]) return;
            seen[id] = true;
            next[output].push(id);
          });
        });
        Object.keys(widgetsById).forEach(function (id) {
          if (seen[id]) return;
          next.inline.push(id);
          seen[id] = true;
        });
        lanes = next;
      }

      function removeWidget(id) {
        OUTPUTS.forEach(function (output) {
          lanes[output] = lanes[output].filter(function (x) { return x !== id; });
        });
        var ref = tabRefs[id];
        if (ref && !ref.closed) {
          try { ref.close(); } catch (err) { }
        }
        delete tabRefs[id];
        delete widgetsById[id];
      }

      function moveWidget(id, toOutput, toIndex) {
        if (!widgetsById[id]) return false;
        if (OUTPUTS.indexOf(toOutput) === -1) return false;
        if (!isOutputEnabled(toOutput)) return false;
        OUTPUTS.forEach(function (output) {
          lanes[output] = lanes[output].filter(function (x) { return x !== id; });
        });
        var list = lanes[toOutput];
        var index = Number(toIndex);
        if (!Number.isFinite(index)) index = list.length;
        index = Math.max(0, Math.min(index, list.length));
        list.splice(index, 0, id);
        return true;
      }

      function forceInline(id) {
        return moveWidget(id, "inline", lanes.inline.length);
      }

      function computeWazeColumnWidth(stageWidth) {
        var w = Math.max(1, Number(stageWidth) || 0);
        var col = Math.floor(w * 0.34);
        return Math.max(220, Math.min(460, col));
      }
      function getStableWazeColumnWidth(stageWidth) {
        var candidate = computeWazeColumnWidth(stageWidth);
        if (!Number.isFinite(lastStableWazeColWidth) || lastStableWazeColWidth <= 0) {
          lastStableWazeColWidth = candidate;
          return candidate;
        }
        if (Math.abs(candidate - lastStableWazeColWidth) <= 3) {
          return lastStableWazeColWidth;
        }
        lastStableWazeColWidth = candidate;
        return candidate;
      }

      function findOutputByWidgetId(id) {
        for (var i = 0; i < OUTPUTS.length; i += 1) {
          var output = OUTPUTS[i];
          if (lanes[output].indexOf(id) !== -1) return output;
        }
        return null;
      }

      function createStagePaneElement(id) {
        var widget = widgetsById[id];
        if (!widget) return null;
        var meta = TYPES[widget.type];
        var section = document.createElement("section");
        section.className = "pane";
        section.dataset.widgetId = id;
        section.setAttribute("aria-label", meta.label);

        var frame = document.createElement("iframe");
        frame.className = "pane-frame";
        frame.src = meta.url;
        frame.title = meta.label;
        frame.setAttribute("frameborder", "0");
        frame.dataset.widgetType = widget.type;

        section.appendChild(frame);
        return section;
      }

      function renderStage() {
        var ids = lanes.inline.slice();
        el.stage.className = "widget-stage";
        el.stage.style.gridTemplateRows = "";
        el.stage.style.gridTemplateColumns = "";

        if (!ids.length) {
          el.stage.classList.add("stage-empty");
          el.stage.innerHTML = "Aucun widget en fenetre integree.";
          stageRenderKey = "";
          return;
        }

        if (ids.length === 1) {
          el.stage.style.gridTemplateRows = "1fr";
          el.stage.style.gridTemplateColumns = "1fr";
          lastStableWazeColWidth = 0;
        } else if (ids.length === 2) {
          var firstType = widgetsById[ids[0]] ? widgetsById[ids[0]].type : "";
          var secondType = widgetsById[ids[1]] ? widgetsById[ids[1]].type : "";
          if (
            (firstType === "waze" && secondType === "saeiv") ||
            (firstType === "saeiv" && secondType === "waze")
          ) {
            var stageWidth = Math.max(1, Number(el.stage.clientWidth) || 1);
            var wazeCol = getStableWazeColumnWidth(stageWidth);
            el.stage.style.gridTemplateRows = "1fr";
            el.stage.style.gridTemplateColumns = firstType === "waze"
              ? (wazeCol + "px 1fr")
              : ("1fr " + wazeCol + "px");
          } else {
            el.stage.style.gridTemplateRows = "1fr";
            el.stage.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
            lastStableWazeColWidth = 0;
          }
        } else {
          el.stage.style.gridTemplateRows = "1fr";
          el.stage.style.gridTemplateColumns = "repeat(" + ids.length + ", minmax(0, 1fr))";
          lastStableWazeColWidth = 0;
        }
        var nextKey = ids.join("|");
        var existingCount = el.stage.querySelectorAll(".pane[data-widget-id]").length;
        if (stageRenderKey === nextKey && existingCount === ids.length) return;

        var existing = Object.create(null);
        Array.prototype.forEach.call(el.stage.querySelectorAll(".pane[data-widget-id]"), function (node) {
          var id = node && node.dataset ? node.dataset.widgetId : "";
          if (!id) return;
          existing[id] = node;
        });

        var frag = document.createDocumentFragment();
        ids.forEach(function (id) {
          var pane = existing[id] || createStagePaneElement(id);
          if (!pane) return;
          frag.appendChild(pane);
        });

        el.stage.innerHTML = "";
        el.stage.appendChild(frag);
        stageRenderKey = nextKey;
      }

      function ensurePipShell(doc) {
        if (!doc.getElementById("idfPipStyle")) {
          var style = doc.createElement("style");
          style.id = "idfPipStyle";
          style.textContent =
            "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#060b14}" +
            ".layout{width:100%;height:100%;display:grid;grid-template-rows:1fr;gap:0}" +
            ".pane{border:0;overflow:hidden;background:#000;min-width:0;min-height:0}" +
            ".pane-frame{width:100%;height:100%;border:0;display:block;background:#000}";
          doc.head.appendChild(style);
        }
        var root = doc.getElementById("idfPipRoot");
        if (!root) {
          root = doc.createElement("main");
          root.id = "idfPipRoot";
          root.className = "layout";
          doc.body.innerHTML = "";
          doc.body.appendChild(root);
        }
        return root;
      }
      function createPipPane(doc, id) {
        var widget = widgetsById[id];
        if (!widget) return null;
        var meta = TYPES[widget.type];
        if (!meta) return null;
        var section = doc.createElement("section");
        section.className = "pane";
        section.dataset.widgetId = id;
        var frame = doc.createElement("iframe");
        frame.className = "pane-frame";
        frame.src = meta.url;
        frame.title = meta.label;
        frame.setAttribute("frameborder", "0");
        frame.dataset.widgetType = widget.type;
        section.appendChild(frame);
        return section;
      }
      function syncPipPaneSource(pane, id) {
        var widget = widgetsById[id];
        if (!pane || !widget) return;
        var meta = TYPES[widget.type];
        if (!meta) return;
        pane.dataset.widgetId = id;
        var frame = pane.querySelector("iframe.pane-frame");
        if (!frame) {
          frame = pane.ownerDocument.createElement("iframe");
          frame.className = "pane-frame";
          frame.setAttribute("frameborder", "0");
          frame.dataset.widgetType = widget.type;
          pane.appendChild(frame);
        }
        if (frame.dataset.widgetType !== widget.type) {
          frame.src = meta.url;
          frame.dataset.widgetType = widget.type;
        }
        frame.title = meta.label;
      }
      function renderPip(win, ids) {
        var doc = win.document;
        doc.documentElement.lang = "fr";
        doc.title = "PIP";
        var root = ensurePipShell(doc);
        root.style.gap = String(PIP_PANE_GAP_PX) + "px";
        if (ids.length > 1) {
          var ratioCols = ids.map(function (id) {
            var widget = widgetsById[id];
            if (!widget) return "1fr";
            return typeAspectRatio(widget.type).toFixed(4) + "fr";
          });
          root.style.gridTemplateColumns = ratioCols.join(" ");
        } else {
          root.style.gridTemplateColumns = "repeat(" + Math.max(1, ids.length) + ", minmax(0, 1fr))";
        }

        var keep = Object.create(null);
        ids.forEach(function (id) { keep[id] = true; });
        Array.prototype.forEach.call(root.querySelectorAll(".pane[data-widget-id]"), function (node) {
          var id = node && node.dataset ? node.dataset.widgetId : "";
          if (!id || keep[id]) return;
          if (node.parentNode) node.parentNode.removeChild(node);
        });

        var byId = Object.create(null);
        Array.prototype.forEach.call(root.querySelectorAll(".pane[data-widget-id]"), function (node) {
          var nodeId = node && node.dataset ? node.dataset.widgetId : "";
          if (!nodeId) return;
          byId[nodeId] = node;
        });

        ids.forEach(function (id, index) {
          var pane = byId[id] || createPipPane(doc, id);
          if (!pane) return;
          syncPipPaneSource(pane, id);
          var currentAtIndex = root.children[index];
          if (currentAtIndex !== pane) root.insertBefore(pane, currentAtIndex || null);
        });
      }

      function bindPipResize(win) {
        if (!win || win.__idfResizeBound) return;
        win.__idfResizeBound = true;
        // Ne pas rerendre au resize: sinon certains navigateurs peuvent recharger les iframes.
        win.addEventListener("resize", function () { });
      }

      function syncTabs(notes) {
        if (!isOutputEnabled("tab")) {
          lanes.tab.slice().forEach(function (id) { forceInline(id); });
          Object.keys(tabRefs).forEach(function (id) {
            var ref = tabRefs[id];
            if (ref && !ref.closed) {
              try { ref.close(); } catch (err) { }
            }
            delete tabRefs[id];
          });
          return;
        }
        var wanted = Object.create(null);
        lanes.tab.forEach(function (id) { wanted[id] = true; });

        Object.keys(tabRefs).forEach(function (id) {
          if (wanted[id]) return;
          var ref = tabRefs[id];
          if (ref && !ref.closed) {
            try { ref.close(); } catch (err) { }
          }
          delete tabRefs[id];
        });

        lanes.tab.slice().forEach(function (id) {
          var widget = widgetsById[id];
          if (!widget) return;
          var current = tabRefs[id];
          if (current && !current.closed) return;
          var opened = null;
          try { opened = openGame2Tab(TYPES[widget.type].url, "idf_game_tab_" + id); } catch (err) { }
          if (opened) {
            tabRefs[id] = opened;
            syncExternalTelemetryBlocks();
          } else {
            notes.push("Popup bloquee pour " + widgetName(id));
            forceInline(id);
          }
        });
      }

      function syncPip(notes) {
        if (!isOutputEnabled("pip")) {
          lanes.pip.slice().forEach(function (id) { forceInline(id); });
          if (pipWindow) {
            try { pipWindow.close(); } catch (err0) { }
          }
          pipWindow = null;
          pipActiveIds = [];
          return Promise.resolve();
        }
        var ids = lanes.pip.slice();
        if (!ids.length) {
          if (pipWindow) {
            try { pipWindow.close(); } catch (err) { }
          }
          pipWindow = null;
          pipActiveIds = [];
          return Promise.resolve();
        }

        var dpi = window.documentPictureInPicture;
        if (!dpi || typeof dpi.requestWindow !== "function") {
          notes.push("Document Picture-in-Picture non supporte sur ce navigateur.");
          ids.forEach(forceInline);
          return Promise.resolve();
        }

        if (pipWindow && pipWindow.closed) pipWindow = null;

        var pipTargetHeight = ids.length > 1 ? 760 : (ids[0] && widgetsById[ids[0]] && widgetsById[ids[0]].type === "waze" ? 940 : 620);
        var pipTargetWidth = 980;
        if (ids.length > 1) {
          var totalRatio = 0;
          ids.forEach(function (id) {
            var widget = widgetsById[id];
            if (!widget) return;
            totalRatio += typeAspectRatio(widget.type);
          });
          pipTargetWidth = Math.round((pipTargetHeight * Math.max(1, totalRatio)) + (PIP_PANE_GAP_PX * Math.max(0, ids.length - 1)));
        } else if (ids[0] && widgetsById[ids[0]]) {
          var singleRatio = typeAspectRatio(widgetsById[ids[0]].type);
          pipTargetWidth = Math.round(pipTargetHeight * singleRatio);
        }

        var openPromise = pipWindow
          ? Promise.resolve(pipWindow)
          : dpi.requestWindow({
            width: pipTargetWidth,
            height: pipTargetHeight
          }).then(function (win) {
            pipWindow = win;
            bindPipResize(win);
            win.addEventListener("pagehide", function () {
              pipWindow = null;
              if (pipActiveIds.length) {
                pipActiveIds.forEach(forceInline);
                pipActiveIds = [];
              }
              if (!applying) apply();
            });
            return win;
          }, function () {
            notes.push("Ouverture PIP refusee ou bloquee.");
            ids.forEach(forceInline);
            return null;
          });

        return openPromise.then(function (win) {
          if (!win) return;
          pipActiveIds = ids.slice();
          try { renderPip(win, ids); } catch (err) { notes.push("Erreur de rendu PIP."); }
          syncExternalTelemetryBlocks();
        });
      }

      function renderLists() {
        OUTPUTS.forEach(function (output) {
          var listEl = getListEl(output);
          if (!listEl) return;
          listEl.innerHTML = "";
          var ids = lanes[output];
          if (!ids.length) {
            var empty = document.createElement("div");
            empty.className = "output-empty";
            empty.textContent = "Aucun widget";
            listEl.appendChild(empty);
            return;
          }

          ids.forEach(function (id) {
            var item = document.createElement("div");
            item.className = "output-widget";
            item.draggable = false;
            item.dataset.widgetId = id;
            item.dataset.output = output;

            var name = document.createElement("span");
            name.textContent = widgetName(id);

            var close = document.createElement("button");
            close.type = "button";
            close.className = "widget-close";
            close.textContent = "x";
            close.setAttribute("aria-label", "Retirer " + widgetName(id));

            close.addEventListener("click", function (event) {
              event.preventDefault();
              event.stopPropagation();
              var widgetId = id;
              var workspaceNode = windowNodeByType[widgetName(id).toLowerCase().replace(/ /g, "_")];
              // On essaie de trouver le noeud par le type si l'ID ne suffit pas
              var widget = widgetsById[widgetId];
              var type = normalizeWidgetType(widget && widget.type);
              var node = windowNodeByType[type];

              if (node) {
                node.classList.add("is-leaving");
                setTimeout(function () {
                  removeWidget(widgetId);
                  apply();
                }, 400);
              } else {
                removeWidget(widgetId);
                apply();
              }
            });

            item.appendChild(name);
            item.appendChild(close);
            listEl.appendChild(item);
          });
        });
      }

      function getDropIndex(listEl, event, draggedId, sourceOutput, targetOutput) {
        var all = Array.prototype.slice.call(listEl.querySelectorAll(".output-widget"));
        var cards = all.filter(function (node) {
          if (sourceOutput === targetOutput && node.dataset.widgetId === draggedId) return false;
          return true;
        });
        if (!cards.length) return 0;

        var hit = document.elementFromPoint(event.clientX, event.clientY);
        var card = hit && hit.closest ? hit.closest(".output-widget") : null;
        if (card && listEl.contains(card)) {
          var idx = cards.indexOf(card);
          if (idx < 0) return cards.length;
          var rect = card.getBoundingClientRect();
          var before = event.clientX < (rect.left + rect.width / 2);
          return before ? idx : idx + 1;
        }
        return cards.length;
      }

      function clearDropStyles() {
        OUTPUTS.forEach(function (output) {
          var listEl = getListEl(output);
          if (!listEl) return;
          listEl.classList.remove("is-over");
        });
      }

      function getOutputListFromPoint(x, y) {
        var hit = document.elementFromPoint(x, y);
        if (!hit || !hit.closest) return null;
        return hit.closest(".output-list");
      }

      function finishPointerDrag(commitMove) {
        var state = pointerDragState;
        pointerDragState = null;
        if (!state) return;
        if (state.card) state.card.classList.remove("dragging");
        clearDropStyles();

        if (!commitMove || !state.moved || !state.id || !state.src) return;
        var targetList = getOutputListFromPoint(state.lastX, state.lastY);
        if (!targetList || !targetList.dataset || !targetList.dataset.output) return;
        var targetOutput = targetList.dataset.output;
        var idx = getDropIndex(
          targetList,
          { clientX: state.lastX, clientY: state.lastY },
          state.id,
          state.src,
          targetOutput
        );
        if (!moveWidget(state.id, targetOutput, idx)) return;
        apply();
      }

      function bindDndFor(output) {
        var listEl = getListEl(output);
        if (!listEl) return;

        listEl.addEventListener("dragstart", function (event) {
          finishPointerDrag(false);
          var card = event.target && event.target.closest(".output-widget");
          if (!card) return;
          var id = card.dataset.widgetId;
          var src = card.dataset.output;
          if (!id || !src) return;
          dragState = { id: id, src: src };
          card.classList.add("dragging");
          try {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", JSON.stringify(dragState));
          } catch (err) { }
        });

        listEl.addEventListener("dragend", function () {
          dragState = null;
          clearDropStyles();
          Array.prototype.forEach.call(document.querySelectorAll(".output-widget.dragging"), function (node) {
            node.classList.remove("dragging");
          });
        });

        listEl.addEventListener("dragover", function (event) {
          if (!dragState) return;
          event.preventDefault();
          try { event.dataTransfer.dropEffect = "move"; } catch (err) { }
          listEl.classList.add("is-over");
        });

        listEl.addEventListener("dragleave", function (event) {
          var rel = event.relatedTarget;
          if (rel && listEl.contains(rel)) return;
          listEl.classList.remove("is-over");
        });

        listEl.addEventListener("drop", function (event) {
          event.preventDefault();
          listEl.classList.remove("is-over");

          var payload = dragState;
          if (!payload) {
            try { payload = JSON.parse(event.dataTransfer.getData("text/plain")); }
            catch (err) { payload = null; }
          }
          if (!payload || !payload.id) return;
          var targetOutput = listEl.dataset.output;
          var idx = getDropIndex(listEl, event, payload.id, payload.src, targetOutput);
          if (!moveWidget(payload.id, targetOutput, idx)) return;
          apply();
        });
      }

      function apply() {
        if (applying) return;
        applying = true;
        applyOutputVisibility();
        enforceOutputModeConstraints();
        enforceWidgetsAllowedForCurrentMode();
        enforceSingleWidgetPerCategory();
        ensureModeDefaultWidgetSelection();
        sanitize();
        refreshWidgetTypeSelectors();
        renderLists();

        var notes = [];
        syncTabs(notes);
        sanitize();
        refreshWidgetTypeSelectors();
        renderLists();

        syncPip(notes).then(function () {
          sanitize();
          refreshWidgetTypeSelectors();
          renderLists();
          renderStage();
          saveWidgetLayoutState();
          applying = false;
        }, function () {
          saveWidgetLayoutState();
          applying = false;
        });
      }

